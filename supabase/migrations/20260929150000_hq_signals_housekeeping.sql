-- Monitors, Codex and the Co-Founder all report into HQ. This migration gives
-- that traffic a shape HQ can keep tidy on its own:
--
--   * reports (hq.briefs) say which source wrote them, so the dashboard shows
--     the latest from each source instead of whichever was written last;
--   * signals are individual open issues with a stable fingerprint. A monitor
--     re-reports what it still sees and anything it stops reporting resolves;
--   * housekeeping resolves what nobody has seen for 48 hours, closes tasks
--     whose signal resolved, drops long-idle agent tasks, marks silent agents
--     idle and archives old reports. It runs from the dashboard read, at most
--     every ten minutes, so it needs no scheduler.

alter table hq.briefs
  add column source text not null default 'cofounder',
  add column project_slug text references hq.projects (slug) on delete set null,
  add column archived_at timestamptz;

update hq.briefs set source = 'codex' where headline ilike 'four-app%';
update hq.briefs set source = 'vercel-monitor' where headline ilike 'kynomy reached%';
update hq.briefs set source = 'db-monitor' where body_md ilike '## supabase maintenance%';

create index briefs_source_idx on hq.briefs (source, created_at desc);

create table hq.signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  fingerprint text not null,
  project_slug text references hq.projects (slug) on delete set null,
  severity text not null default 'warning' check (severity in ('critical', 'warning', 'info')),
  title text not null check (char_length(title) between 1 and 300),
  detail text,
  url text,
  status text not null default 'open' check (status in ('open', 'resolved', 'muted')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  unique (source, fingerprint)
);
create index signals_open_idx on hq.signals (status, severity, last_seen desc);

alter table hq.tasks add column signal_id uuid references hq.signals (id) on delete set null;

create table hq.meta (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['signals', 'meta'] loop
    execute format('alter table hq.%I enable row level security', t);
    execute format('revoke all on hq.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- Writers ---------------------------------------------------------------------
-- Agents with database access (the Co-Founder, Codex through MCP) call these
-- directly. HTTP writers go through public.hq_ingest, which calls them too.

create or replace function hq.known_project(p_slug text)
returns text language sql stable security definer set search_path = '' as $$
  select slug from hq.projects where slug = p_slug
$$;

create or replace function hq.report(
  p_source text, p_kind text, p_headline text, p_body_md text, p_project_slug text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  insert into hq.briefs (source, kind, headline, body_md, project_slug)
  values (
    lower(p_source),
    case when p_kind in ('daily', 'weekly', 'adhoc') then p_kind else 'adhoc' end,
    p_headline,
    p_body_md,
    hq.known_project(p_project_slug)
  )
  returning id into r;
  return r;
end $$;

create or replace function hq.signal(
  p_source text, p_fingerprint text, p_severity text, p_title text,
  p_detail text default null, p_project_slug text default null, p_url text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  insert into hq.signals (source, fingerprint, severity, title, detail, project_slug, url)
  values (
    lower(p_source), p_fingerprint,
    case when p_severity in ('critical', 'warning', 'info') then p_severity else 'warning' end,
    p_title, p_detail, hq.known_project(p_project_slug), p_url
  )
  on conflict (source, fingerprint) do update set
    severity = excluded.severity,
    title = excluded.title,
    detail = coalesce(excluded.detail, hq.signals.detail),
    project_slug = coalesce(excluded.project_slug, hq.signals.project_slug),
    url = coalesce(excluded.url, hq.signals.url),
    last_seen = now(),
    -- A muted signal stays muted; a resolved one that comes back reopens.
    status = case when hq.signals.status = 'muted' then 'muted' else 'open' end,
    resolved_at = case when hq.signals.status = 'muted' then hq.signals.resolved_at else null end,
    resolution = case when hq.signals.status = 'muted' then hq.signals.resolution else null end
  returning id into r;
  return r;
end $$;

-- A monitor run lists every fingerprint it still sees; the rest of its open
-- signals are fixed, so they resolve now rather than after 48 hours.
create or replace function hq.resolve_missing(p_source text, p_seen text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update hq.signals
     set status = 'resolved', resolved_at = now(),
         resolution = format('No longer reported by %s', lower(p_source))
   where source = lower(p_source) and status = 'open'
     and not (fingerprint = any (coalesce(p_seen, '{}')));
  get diagnostics n = row_count;
  return n;
end $$;

-- Housekeeping ----------------------------------------------------------------

create or replace function hq.housekeep(p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  last_run timestamptz;
  out jsonb;
  n_signals int; n_linked int; n_dropped int; n_idle int; n_archived int; n_metrics int;
begin
  select updated_at into last_run from hq.meta where key = 'housekeep';
  if not p_force and last_run is not null and last_run > now() - interval '10 minutes' then
    return (select value from hq.meta where key = 'housekeep');
  end if;

  update hq.signals
     set status = 'resolved', resolved_at = now(), resolution = 'Not reported for 48 hours'
   where status = 'open' and last_seen < now() - interval '48 hours';
  get diagnostics n_signals = row_count;

  update hq.tasks t
     set status = 'done', completed_at = now(), updated_at = now(),
         detail = concat_ws(E'\n\n', t.detail,
           format('Closed automatically: %s (%s).', s.title, coalesce(s.resolution, 'resolved')))
    from hq.signals s
   where t.signal_id = s.id and s.status = 'resolved'
     and t.status in ('open', 'doing', 'blocked');
  get diagnostics n_linked = row_count;

  -- Only work the Co-Founder or an agent owns. The owner's own to-dos are
  -- flagged as stale on the dashboard but never closed behind their back.
  update hq.tasks
     set status = 'dropped', updated_at = now(),
         detail = concat_ws(E'\n\n', detail, 'Dropped automatically: no activity for 21 days.')
   where owner in ('cofounder', 'agent') and status in ('open', 'blocked')
     and updated_at < now() - interval '21 days';
  get diagnostics n_dropped = row_count;

  update hq.agents
     set status = 'idle', updated_at = now()
   where status in ('on_track', 'drifting')
     and coalesce(last_activity_at, updated_at) < now() - interval '72 hours';
  get diagnostics n_idle = row_count;

  update hq.briefs b
     set archived_at = now()
   where archived_at is null and created_at < now() - interval '14 days'
     and b.id <> (select id from hq.briefs l where l.source = b.source
                  order by created_at desc limit 1);
  get diagnostics n_archived = row_count;

  delete from hq.metrics where as_of < now() - interval '180 days';
  get diagnostics n_metrics = row_count;

  delete from hq.login_nonces where used_at < now() - interval '1 day';

  out := jsonb_build_object(
    'ran_at', now(),
    'signals_resolved', n_signals,
    'tasks_closed', n_linked,
    'tasks_dropped', n_dropped,
    'agents_idled', n_idle,
    'reports_archived', n_archived,
    'metrics_pruned', n_metrics
  );
  insert into hq.meta (key, value, updated_at) values ('housekeep', out, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return out;
end $$;

-- Gateway (dashboard + HTTP ingest) -------------------------------------------

create or replace function public.hq_dashboard(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare housekeeping jsonb;
begin
  perform hq.assert_key(p_key);
  housekeeping := hq.housekeep(false);
  return jsonb_build_object(
    'projects', coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from hq.projects p), '[]'),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by
        case t.status when 'doing' then 0 when 'blocked' then 1 when 'open' then 2 else 3 end,
        t.priority, t.due_on nulls last, t.created_at desc)
      from hq.tasks t
      where t.status not in ('done', 'dropped') or coalesce(t.completed_at, t.updated_at) > now() - interval '7 days'
    ), '[]'),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from hq.agents a), '[]'),
    'metrics', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.metric, m.project_slug, m.as_of)
      from hq.metrics m where m.as_of > now() - interval '90 days'
    ), '[]'),
    'briefs', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at desc)
      from (select * from hq.briefs where archived_at is null order by created_at desc limit 60) b
    ), '[]'),
    'signals', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.last_seen desc)
      from hq.signals s
      where s.status = 'open' or s.resolved_at > now() - interval '7 days'
    ), '[]'),
    'triage', coalesce((select jsonb_agg(to_jsonb(e)) from hq.email_triage e), '[]'),
    'housekeeping', housekeeping
  );
end $$;

create or replace function public.hq_signal_set(p_key text, p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r hq.signals;
begin
  perform hq.assert_key(p_key);
  if p_status not in ('open', 'resolved', 'muted') then
    raise exception 'hq: bad status' using errcode = '22023';
  end if;
  update hq.signals
     set status = p_status,
         resolved_at = case when p_status = 'open' then null else now() end,
         resolution = case p_status when 'resolved' then 'Resolved by owner'
                                    when 'muted' then 'Muted by owner' else null end
   where id = p_id
  returning * into r;
  if r.id is null then raise exception 'hq: signal not found' using errcode = 'P0002'; end if;
  perform hq.housekeep(true);
  return to_jsonb(r);
end $$;

-- One call per monitor run. The web app validates the payload before it gets
-- here; this still treats every field as untrusted text.
create or replace function public.hq_ingest(p_key text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  src text := lower(p_payload->>'source');
  item jsonb;
  sig_id uuid;
  existing uuid;
  n_reports int := 0; n_signals int := 0; n_resolved int := 0; n_metrics int := 0; n_tasks int := 0;
begin
  perform hq.assert_key(p_key);
  if src is null or src !~ '^[a-z0-9][a-z0-9._-]{0,40}$' then
    raise exception 'hq: source must be a short slug' using errcode = '22023';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'reports', '[]')) loop
    perform hq.report(src, item->>'kind', item->>'headline', item->>'body_md', item->>'project_slug');
    n_reports := n_reports + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'signals', '[]')) loop
    perform hq.signal(src, item->>'fingerprint', item->>'severity', item->>'title',
                      item->>'detail', item->>'project_slug', item->>'url');
    n_signals := n_signals + 1;
  end loop;

  if coalesce((p_payload->>'complete')::boolean, false) then
    n_resolved := hq.resolve_missing(src, array(
      select jsonb_array_elements(coalesce(p_payload->'signals', '[]'))->>'fingerprint'));
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'metrics', '[]')) loop
    insert into hq.metrics (metric, project_slug, value, unit, source, as_of)
    values (
      item->>'metric', hq.known_project(item->>'project_slug'), (item->>'value')::numeric,
      nullif(item->>'unit', ''), src, coalesce((item->>'as_of')::timestamptz, now())
    );
    n_metrics := n_metrics + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload->'tasks', '[]')) loop
    sig_id := null;
    if item ? 'signal_fingerprint' then
      select id into sig_id from hq.signals where source = src and fingerprint = item->>'signal_fingerprint';
    end if;
    existing := null;
    select id into existing from hq.tasks
     where status in ('open', 'doing', 'blocked')
       and ((sig_id is not null and signal_id = sig_id)
            or (nullif(item->>'source_url', '') is not null and source_url = item->>'source_url'))
     limit 1;
    if existing is not null then
      update hq.tasks set
        title = coalesce(item->>'title', title),
        detail = coalesce(item->>'detail', detail),
        priority = coalesce(nullif(item->>'priority', ''), priority),
        signal_id = coalesce(sig_id, signal_id),
        updated_at = now()
      where id = existing;
    else
      insert into hq.tasks (title, detail, project_slug, owner, priority, status, source, source_url, created_by, signal_id)
      values (
        item->>'title', item->>'detail', hq.known_project(item->>'project_slug'),
        coalesce(nullif(item->>'owner', ''), 'owner'), coalesce(nullif(item->>'priority', ''), 'p2'), 'open',
        src, nullif(item->>'source_url', ''), src, sig_id
      );
    end if;
    n_tasks := n_tasks + 1;
  end loop;

  return jsonb_build_object('reports', n_reports, 'signals', n_signals, 'resolved', n_resolved,
                            'metrics', n_metrics, 'tasks', n_tasks, 'housekeeping', hq.housekeep(true));
end $$;

revoke all on function hq.known_project(text) from public, anon, authenticated;
revoke all on function hq.report(text, text, text, text, text) from public, anon, authenticated;
revoke all on function hq.signal(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function hq.resolve_missing(text, text[]) from public, anon, authenticated;
revoke all on function hq.housekeep(boolean) from public, anon, authenticated;
revoke all on function public.hq_signal_set(text, uuid, text) from public;
revoke all on function public.hq_ingest(text, jsonb) from public;
grant execute on function public.hq_signal_set(text, uuid, text) to anon;
grant execute on function public.hq_ingest(text, jsonb) to anon;
