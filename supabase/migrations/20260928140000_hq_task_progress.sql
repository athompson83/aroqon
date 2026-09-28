-- When a task is finished, the email it was created from is handled too, so
-- the Mail view and the "mail needing you" count move with the to-do list.
create or replace function hq.on_task_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    update hq.email_triage
       set handled = true, updated_at = now()
     where task_id = new.id and not handled;
  end if;
  return new;
end $$;

revoke all on function hq.on_task_done() from public, anon, authenticated;

create trigger tasks_done_handles_email
  after update of status on hq.tasks
  for each row execute function hq.on_task_done();
