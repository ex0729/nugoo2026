-- Release hardening: authorization, deadline enforcement, idempotency,
-- assignment results/acknowledgement, and consistent class change notifications.

alter table public.classes
  add column if not exists creation_key uuid;

create unique index if not exists classes_created_by_creation_key_key
  on public.classes (created_by, creation_key)
  where creation_key is not null;

alter table public.class_assignments
  add column if not exists acknowledged_at timestamptz;

drop policy if exists classes_select_admin_or_instructor on public.classes;
create policy classes_select_admin_or_instructor
on public.classes for select to authenticated
using (
  private.current_user_role() in ('super_admin', 'service_admin')
  or exists (
    select 1 from public.class_recruitment_targets target
    where target.class_id = classes.id
      and target.instructor_id = (select auth.uid())
  )
  or exists (
    select 1 from public.class_assignments assignment
    where assignment.class_id = classes.id
      and assignment.instructor_id = (select auth.uid())
  )
);

-- RLS decides which response row is writable; column privileges decide which
-- fields an instructor can mutate through the Data API.
revoke update on table public.class_recruitment_responses from authenticated;
grant update (status, condition, responded_at, updated_at)
  on table public.class_recruitment_responses to authenticated;

drop policy if exists recruitment_responses_owner_update on public.class_recruitment_responses;
create policy recruitment_responses_owner_update
on public.class_recruitment_responses for update to authenticated
using (
  exists (
    select 1
    from public.class_recruitment_targets target
    join public.classes class_row on class_row.id = target.class_id
    where target.id = class_recruitment_responses.target_id
      and target.instructor_id = (select auth.uid())
      and class_row.status in ('recruiting', 'reviewing', 'assignment_needed')
      and class_row.response_deadline > now()
  )
)
with check (
  exists (
    select 1
    from public.class_recruitment_targets target
    join public.classes class_row on class_row.id = target.class_id
    where target.id = class_recruitment_responses.target_id
      and target.instructor_id = (select auth.uid())
      and class_row.status in ('recruiting', 'reviewing', 'assignment_needed')
      and class_row.response_deadline > now()
  )
);

drop policy if exists class_assignments_owner_acknowledge on public.class_assignments;
create policy class_assignments_owner_acknowledge
on public.class_assignments for update to authenticated
using (instructor_id = (select auth.uid()))
with check (instructor_id = (select auth.uid()));

revoke update on table public.class_assignments from authenticated;
grant update (acknowledged_at) on table public.class_assignments to authenticated;

create or replace function public.submit_recruitment_response(
  response_id uuid,
  next_status text,
  next_condition text default null
)
returns table (id uuid, status text, condition text, responded_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  updated_response public.class_recruitment_responses%rowtype;
begin
  if private.current_user_role() <> 'instructor' then raise exception 'instructor_required'; end if;
  if next_status not in ('available', 'conditional', 'unavailable') then raise exception 'invalid_response'; end if;
  if next_status = 'conditional' and char_length(trim(coalesce(next_condition, ''))) = 0 then raise exception 'condition_required'; end if;

  update public.class_recruitment_responses response
  set status = next_status,
      condition = case when next_status = 'conditional' then trim(next_condition) else null end,
      responded_at = now(),
      updated_at = now()
  where response.id = response_id
  returning response.* into updated_response;

  if not found then raise exception 'response_unavailable'; end if;
  return query select updated_response.id, updated_response.status, updated_response.condition, updated_response.responded_at;
end;
$$;

revoke all on function public.submit_recruitment_response(uuid, text, text) from public, anon;
grant execute on function public.submit_recruitment_response(uuid, text, text) to authenticated;

create or replace function public.acknowledge_class_assignment(target_assignment_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  acknowledged timestamptz;
begin
  if private.current_user_role() <> 'instructor' then raise exception 'instructor_required'; end if;
  update public.class_assignments assignment
  set acknowledged_at = coalesce(assignment.acknowledged_at, now())
  where assignment.id = target_assignment_id
    and assignment.instructor_id = (select auth.uid())
  returning assignment.acknowledged_at into acknowledged;
  if acknowledged is null then raise exception 'assignment_not_found'; end if;
  return acknowledged;
end;
$$;

revoke all on function public.acknowledge_class_assignment(uuid) from public, anon;
grant execute on function public.acknowledge_class_assignment(uuid) to authenticated;

create or replace function public.update_class_details(
  target_class_id uuid,
  class_payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  existing public.classes%rowtype;
  changed boolean;
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then raise exception 'administrator_required'; end if;
  select * into existing from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if existing.status in ('completed', 'cancelled') then raise exception 'class_closed'; end if;
  if exists (select 1 from public.class_recruitment_targets where class_id = target_class_id)
    and existing.assistant_count <> (class_payload ->> 'assistant_count')::integer
  then raise exception 'recruitment_locked'; end if;

  changed := existing.class_date <> (class_payload ->> 'class_date')::date
    or existing.start_time <> (class_payload ->> 'start_time')::time
    or existing.end_time <> (class_payload ->> 'end_time')::time
    or existing.address <> trim(class_payload ->> 'address')
    or existing.lead_fee <> (class_payload ->> 'lead_fee')::integer
    or existing.assistant_fee <> (class_payload ->> 'assistant_fee')::integer;

  update public.classes
  set title = trim(class_payload ->> 'title'),
      institution = trim(class_payload ->> 'institution'),
      contact = nullif(trim(class_payload ->> 'contact'), ''),
      class_date = (class_payload ->> 'class_date')::date,
      start_time = (class_payload ->> 'start_time')::time,
      end_time = (class_payload ->> 'end_time')::time,
      address = trim(class_payload ->> 'address'),
      target_group = trim(class_payload ->> 'target_group'),
      grade = trim(class_payload ->> 'grade'),
      participant_count = (class_payload ->> 'participant_count')::integer,
      description = coalesce(class_payload ->> 'description', ''),
      assistant_count = (class_payload ->> 'assistant_count')::integer,
      lead_fee = (class_payload ->> 'lead_fee')::integer,
      assistant_fee = (class_payload ->> 'assistant_fee')::integer,
      fee_notes = coalesce(class_payload ->> 'fee_notes', ''),
      response_deadline = (class_payload ->> 'response_deadline')::timestamptz,
      updated_at = now()
  where id = target_class_id;

  if changed then
    insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
    select distinct recipient.user_id, target_class_id, 'class_changed', '수업 정보가 변경되었습니다.',
      format('%s · %s / %s %s~%s / 변경된 일정과 수업료를 확인해 주세요.', trim(class_payload ->> 'institution'), trim(class_payload ->> 'title'), class_payload ->> 'class_date', class_payload ->> 'start_time', class_payload ->> 'end_time'),
      '/instructor/dashboard#request-' || target_class_id::text,
      'class-changed:' || target_class_id::text || ':' || recipient.user_id::text || ':' || txid_current()::text
    from (
      select instructor_id as user_id from public.class_recruitment_targets where class_id = target_class_id
      union
      select instructor_id as user_id from public.class_assignments where class_id = target_class_id
    ) recipient;
  end if;

  perform public.record_admin_activity('class_updated', jsonb_build_object('class_id', target_class_id, 'notified', changed));
end;
$$;

revoke all on function public.update_class_details(uuid, jsonb) from public, anon;
grant execute on function public.update_class_details(uuid, jsonb) to authenticated;

create or replace function public.set_class_status(target_class_id uuid, next_status text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  class_row public.classes%rowtype;
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then raise exception 'administrator_required'; end if;
  if next_status not in ('completed', 'cancelled') then raise exception 'invalid_status'; end if;
  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if class_row.status = 'cancelled' then raise exception 'class_closed'; end if;

  if next_status = 'cancelled' then
    insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
    select distinct recipient.user_id, target_class_id, 'class_cancelled', '수업이 취소되었습니다.',
      format('%s · %s / %s 수업이 취소되었습니다.', class_row.institution, class_row.title, to_char(class_row.class_date, 'YYYY-MM-DD')),
      '/instructor/dashboard#request-' || target_class_id::text,
      'class-cancelled:' || target_class_id::text || ':' || recipient.user_id::text
    from (
      select instructor_id as user_id from public.class_recruitment_targets where class_id = target_class_id
      union
      select instructor_id as user_id from public.class_assignments where class_id = target_class_id
    ) recipient
    on conflict (dedupe_key) do nothing;
  end if;

  update public.classes set status = next_status, updated_at = now() where id = target_class_id;
  perform public.record_admin_activity(case when next_status = 'cancelled' then 'class_cancelled' else 'class_updated' end, jsonb_build_object('class_id', target_class_id, 'status', next_status));
end;
$$;

revoke all on function public.set_class_status(uuid, text) from public, anon;
grant execute on function public.set_class_status(uuid, text) to authenticated;

create or replace function public.finalize_class_assignment(
  target_class_id uuid,
  lead_instructor_id uuid,
  assistant_instructor_ids uuid[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  class_row public.classes%rowtype;
  assistant_id uuid;
  selected_ids uuid[];
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then raise exception 'administrator_required'; end if;
  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if class_row.status in ('assigned', 'completed', 'cancelled') or exists (select 1 from public.class_assignments where class_id = target_class_id) then raise exception 'assignment_already_finalized'; end if;
  if coalesce(array_length(assistant_instructor_ids, 1), 0) <> class_row.assistant_count then raise exception 'assistant_count_mismatch'; end if;
  if lead_instructor_id = any(assistant_instructor_ids) then raise exception 'duplicate_instructor_role'; end if;
  if coalesce(array_length(assistant_instructor_ids, 1), 0) <> (select count(distinct value)::int from unnest(assistant_instructor_ids) value) then raise exception 'duplicate_assistant'; end if;

  if not exists (
    select 1 from public.class_recruitment_targets target
    join public.class_recruitment_responses response on response.target_id = target.id
    where target.class_id = target_class_id and target.instructor_id = lead_instructor_id and response.role = 'lead' and response.status in ('available', 'conditional')
  ) then raise exception 'lead_response_required'; end if;
  foreach assistant_id in array assistant_instructor_ids loop
    if not exists (
      select 1 from public.class_recruitment_targets target
      join public.class_recruitment_responses response on response.target_id = target.id
      where target.class_id = target_class_id and target.instructor_id = assistant_id and response.role = 'assistant' and response.status in ('available', 'conditional')
    ) then raise exception 'assistant_response_required'; end if;
  end loop;

  insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
  values (target_class_id, lead_instructor_id, 'lead', class_row.lead_fee, (select auth.uid()));
  foreach assistant_id in array assistant_instructor_ids loop
    insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
    values (target_class_id, assistant_id, 'assistant', class_row.assistant_fee, (select auth.uid()));
  end loop;

  selected_ids := array_prepend(lead_instructor_id, assistant_instructor_ids);
  insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
  select assignment.instructor_id, target_class_id, 'assignment_confirmed', '수업 배정이 확정되었습니다.',
    format('%s · %s / %s / %s · %s원', class_row.institution, class_row.title, to_char(class_row.class_date, 'YYYY-MM-DD'), case assignment.role when 'lead' then '주강사' else '보조강사' end, to_char(assignment.fee_snapshot, 'FM999,999,999')),
    '/instructor/dashboard#schedule', 'assignment:' || target_class_id::text || ':' || assignment.instructor_id::text
  from public.class_assignments assignment where assignment.class_id = target_class_id
  on conflict (dedupe_key) do nothing;

  insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
  select target.instructor_id, target_class_id, 'assignment_result', '수업 모집 결과가 확정되었습니다.',
    format('%s · %s / 이번 수업에는 배정되지 않았습니다.', class_row.institution, class_row.title),
    '/instructor/dashboard#request-' || target_class_id::text,
    'not-selected:' || target_class_id::text || ':' || target.instructor_id::text
  from public.class_recruitment_targets target
  where target.class_id = target_class_id and not (target.instructor_id = any(selected_ids))
  on conflict (dedupe_key) do nothing;

  update public.classes set status = 'assigned', updated_at = now() where id = target_class_id;
  perform public.record_admin_activity('assignment_confirmed', jsonb_build_object('class_id', target_class_id, 'lead_instructor_id', lead_instructor_id, 'assistant_count', coalesce(array_length(assistant_instructor_ids, 1), 0)));
end;
$$;

revoke all on function public.finalize_class_assignment(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.finalize_class_assignment(uuid, uuid, uuid[]) to authenticated;

create or replace function private.guard_recruitment_target_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_class_id uuid := coalesce(new.class_id, old.class_id);
  class_row public.classes%rowtype;
begin
  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if class_row.status in ('assigned', 'completed', 'cancelled') then raise exception 'class_closed'; end if;
  if class_row.response_deadline <= now() then raise exception 'response_deadline_passed'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_recruitment_target_change on public.class_recruitment_targets;
create trigger guard_recruitment_target_change
before insert or update or delete on public.class_recruitment_targets
for each row execute function private.guard_recruitment_target_change();

alter table public.internal_notifications drop constraint if exists internal_notifications_type_check;
alter table public.internal_notifications add constraint internal_notifications_type_check
  check (type in ('class_request', 'class_reminder', 'assignment_confirmed', 'assignment_result', 'class_changed', 'class_cancelled'));

grant select, insert, update on public.classes to authenticated;
grant select on public.class_recruitment_targets to authenticated;
grant select on public.class_recruitment_responses to authenticated;
grant select, insert on public.class_assignments to authenticated;
grant select, insert on public.internal_notifications to authenticated;
grant update (read_at) on public.internal_notifications to authenticated;
