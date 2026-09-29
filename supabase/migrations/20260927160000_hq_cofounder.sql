-- Aroqon HQ: the Co-Founder agent's state.
--
-- Lives in its own `hq` schema, which PostgREST does not expose. The only way
-- in from the internet is the `public.hq_*` functions below, and every one of
-- them first checks a gateway key against a bcrypt hash. The dashboard holds
-- that key server-side; the Co-Founder agent writes through SQL directly.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists hq;
revoke all on schema hq from public, anon, authenticated;

create table hq.gateway_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table hq.projects (
  slug text primary key,
  name text not null,
  repo text,
  url text,
  stage text not null default 'build'
    check (stage in ('idea', 'build', 'beta', 'live', 'paused', 'retired')),
  health text not null default 'unknown'
    check (health in ('green', 'yellow', 'red', 'unknown')),
  focus text,
  next_milestone text,
  updated_at timestamptz not null default now()
);

create table hq.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  detail text,
  project_slug text references hq.projects (slug) on delete set null,
  owner text not null default 'owner' check (owner in ('owner', 'cofounder', 'agent')),
  priority text not null default 'p2' check (priority in ('p0', 'p1', 'p2', 'p3')),
  status text not null default 'open' check (status in ('open', 'doing', 'blocked', 'done', 'dropped')),
  due_on date,
  source text,
  source_url text,
  created_by text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index tasks_open_idx on hq.tasks (status, priority, due_on);

-- One row per agent/workstream the Co-Founder supervises. "On task" is a
-- judgement the Co-Founder records, with the evidence it used.
create table hq.agents (
  id text primary key,
  name text not null,
  project_slug text references hq.projects (slug) on delete set null,
  mission text,
  status text not null default 'unknown'
    check (status in ('on_track', 'drifting', 'blocked', 'idle', 'unknown')),
  last_activity_at timestamptz,
  last_activity text,
  evidence_url text,
  updated_at timestamptz not null default now()
);

create table hq.metrics (
  id bigint generated always as identity primary key,
  metric text not null,
  project_slug text references hq.projects (slug) on delete set null,
  value numeric not null,
  unit text,
  source text not null,
  as_of timestamptz not null default now()
);
create index metrics_series_idx on hq.metrics (metric, project_slug, as_of desc);

create table hq.briefs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'daily' check (kind in ('daily', 'weekly', 'adhoc')),
  headline text not null,
  body_md text not null,
  created_at timestamptz not null default now()
);

create table hq.email_triage (
  email_id text primary key,
  direction text not null check (direction in ('received', 'sent')),
  category text not null,
  priority text not null default 'normal' check (priority in ('urgent', 'normal', 'low')),
  summary text,
  action text,
  task_id uuid references hq.tasks (id) on delete set null,
  handled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table hq.login_nonces (
  nonce text primary key,
  used_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['gateway_keys','projects','tasks','agents','metrics','briefs','email_triage','login_nonces'] loop
    execute format('alter table hq.%I enable row level security', t);
    execute format('revoke all on hq.%I from public, anon, authenticated', t);
  end loop;
end $$;

create or replace function hq.assert_key(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or char_length(p_key) < 32 or not exists (
    select 1 from hq.gateway_keys k
    where k.revoked_at is null
      and k.key_hash = extensions.crypt(p_key, k.key_hash)
  ) then
    raise exception 'hq: forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.hq_dashboard(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform hq.assert_key(p_key);
  return jsonb_build_object(
    'projects', coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from hq.projects p), '[]'),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by
        case t.status when 'doing' then 0 when 'blocked' then 1 when 'open' then 2 else 3 end,
        t.priority, t.due_on nulls last, t.created_at desc)
      from hq.tasks t
      where t.status not in ('done', 'dropped') or t.completed_at > now() - interval '7 days'
    ), '[]'),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.name) from hq.agents a), '[]'),
    'metrics', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.metric, m.project_slug, m.as_of)
      from hq.metrics m where m.as_of > now() - interval '90 days'
    ), '[]'),
    'briefs', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at desc)
      from (select * from hq.briefs order by created_at desc limit 10) b
    ), '[]'),
    'triage', coalesce((select jsonb_agg(to_jsonb(e)) from hq.email_triage e), '[]')
  );
end $$;

create or replace function public.hq_task_save(p_key text, p_task jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r hq.tasks;
begin
  perform hq.assert_key(p_key);
  if p_task ? 'id' and nullif(p_task->>'id', '') is not null then
    update hq.tasks t set
      title = coalesce(p_task->>'title', t.title),
      detail = case when p_task ? 'detail' then p_task->>'detail' else t.detail end,
      project_slug = case when p_task ? 'project_slug' then nullif(p_task->>'project_slug', '') else t.project_slug end,
      owner = coalesce(p_task->>'owner', t.owner),
      priority = coalesce(p_task->>'priority', t.priority),
      status = coalesce(p_task->>'status', t.status),
      due_on = case when p_task ? 'due_on' then nullif(p_task->>'due_on', '')::date else t.due_on end,
      completed_at = case
        when coalesce(p_task->>'status', t.status) = 'done' then coalesce(t.completed_at, now())
        else null end,
      updated_at = now()
    where t.id = (p_task->>'id')::uuid
    returning * into r;
    if r.id is null then raise exception 'hq: task not found' using errcode = 'P0002'; end if;
  else
    insert into hq.tasks (title, detail, project_slug, owner, priority, status, due_on, source, created_by)
    values (
      p_task->>'title',
      p_task->>'detail',
      nullif(p_task->>'project_slug', ''),
      coalesce(p_task->>'owner', 'owner'),
      coalesce(p_task->>'priority', 'p2'),
      coalesce(p_task->>'status', 'open'),
      nullif(p_task->>'due_on', '')::date,
      'dashboard',
      'owner'
    )
    returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.hq_triage_save(p_key text, p_triage jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r hq.email_triage;
begin
  perform hq.assert_key(p_key);
  insert into hq.email_triage (email_id, direction, category, priority, summary, action, handled)
  values (
    p_triage->>'email_id',
    p_triage->>'direction',
    p_triage->>'category',
    coalesce(p_triage->>'priority', 'normal'),
    p_triage->>'summary',
    p_triage->>'action',
    coalesce((p_triage->>'handled')::boolean, false)
  )
  on conflict (email_id) do update set
    category = coalesce(p_triage->>'category', hq.email_triage.category),
    priority = coalesce(p_triage->>'priority', hq.email_triage.priority),
    handled = coalesce((p_triage->>'handled')::boolean, hq.email_triage.handled),
    updated_at = now()
  returning * into r;
  return to_jsonb(r);
end $$;

-- Single use for magic sign-in links: true the first time a nonce is seen.
create or replace function public.hq_consume_nonce(p_key text, p_nonce text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare inserted int;
begin
  perform hq.assert_key(p_key);
  delete from hq.login_nonces where used_at < now() - interval '1 day';
  insert into hq.login_nonces (nonce) values (p_nonce) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end $$;

revoke all on function hq.assert_key(text) from public, anon, authenticated;
revoke all on function public.hq_dashboard(text) from public;
revoke all on function public.hq_task_save(text, jsonb) from public;
revoke all on function public.hq_triage_save(text, jsonb) from public;
revoke all on function public.hq_consume_nonce(text, text) from public;
grant execute on function public.hq_dashboard(text) to anon;
grant execute on function public.hq_task_save(text, jsonb) to anon;
grant execute on function public.hq_triage_save(text, jsonb) to anon;
grant execute on function public.hq_consume_nonce(text, text) to anon;
