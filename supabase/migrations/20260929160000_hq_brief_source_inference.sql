-- Writers that insert into hq.briefs directly (without hq.report) do not say
-- who they are, and every such report would otherwise land under the
-- Co-Founder's tab. This infers the source from the report itself, but only
-- when the writer did not name one: hq.report marks its own inserts.

create or replace function hq.report(
  p_source text, p_kind text, p_headline text, p_body_md text, p_project_slug text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  perform set_config('hq.explicit_source', 'on', true);
  insert into hq.briefs (source, kind, headline, body_md, project_slug)
  values (
    lower(p_source),
    case when p_kind in ('daily', 'weekly', 'adhoc') then p_kind else 'adhoc' end,
    p_headline,
    p_body_md,
    hq.known_project(p_project_slug)
  )
  returning id into r;
  perform set_config('hq.explicit_source', '', true);
  return r;
end $$;

create or replace function hq.infer_brief_source()
returns trigger language plpgsql security definer set search_path = '' as $$
declare text_ text := lower(coalesce(new.headline, '') || E'\n' || left(coalesce(new.body_md, ''), 4000));
begin
  if coalesce(current_setting('hq.explicit_source', true), '') = 'on' or new.source <> 'cofounder' then
    return new;
  end if;
  new.source := case
    when text_ like '%four-app%' or text_ like '%executive readiness%' then 'codex'
    when text_ like '%supabase maintenance%' or text_ like '%accessible supabase projects%'
      or text_ like '%accessible valor projects%' then 'db-monitor'
    when text_ like '%github actions%' or text_ like '%workflow run%' then 'actions-monitor'
    when new.kind = 'adhoc' and (text_ like '%vercel team%' or text_ like '%production build%'
      or text_ like '%deployment inventory%') then 'vercel-monitor'
    else new.source
  end;
  return new;
end $$;

revoke all on function hq.infer_brief_source() from public, anon, authenticated;

create trigger briefs_infer_source
  before insert on hq.briefs
  for each row execute function hq.infer_brief_source();
