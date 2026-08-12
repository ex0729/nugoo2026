create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  type text not null check (type in ('class_request', 'class_reminder', 'assignment_confirmed', 'class_changed', 'class_cancelled')),
  title text not null,
  body text not null,
  action_url text not null default '/instructor/dashboard',
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index internal_notifications_user_created_idx
  on public.internal_notifications (user_id, created_at desc);
create index internal_notifications_class_idx
  on public.internal_notifications (class_id, created_at desc);
create index web_push_subscriptions_user_idx
  on public.web_push_subscriptions (user_id);

alter table public.internal_notifications enable row level security;
alter table public.web_push_subscriptions enable row level security;

create policy internal_notifications_select_owner_or_admin
on public.internal_notifications for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_user_role()) in ('super_admin', 'service_admin')
);

create policy internal_notifications_admin_insert
on public.internal_notifications for insert to authenticated
with check ((select private.current_user_role()) in ('super_admin', 'service_admin'));

create policy internal_notifications_owner_read
on public.internal_notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_subscriptions_owner_or_admin_select
on public.web_push_subscriptions for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_user_role()) in ('super_admin', 'service_admin')
);
create policy push_subscriptions_owner_insert
on public.web_push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));
create policy push_subscriptions_owner_update
on public.web_push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy push_subscriptions_owner_delete
on public.web_push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.internal_notifications from public, anon, authenticated;
revoke all on public.web_push_subscriptions from public, anon, authenticated;
grant select, insert on public.internal_notifications to authenticated;
grant update (read_at) on public.internal_notifications to authenticated;
grant select, insert, update, delete on public.web_push_subscriptions to authenticated;

create or replace function public.get_push_subscriptions_for_users(target_user_ids uuid[])
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.current_user_role()) not in ('super_admin', 'service_admin') then
    raise exception 'administrator_required';
  end if;
  return query
  select subscription.user_id, subscription.endpoint, subscription.p256dh, subscription.auth
  from public.web_push_subscriptions subscription
  where subscription.user_id = any(target_user_ids);
end;
$$;

revoke all on function public.get_push_subscriptions_for_users(uuid[]) from public, anon;
grant execute on function public.get_push_subscriptions_for_users(uuid[]) to authenticated;

create or replace function public.create_class_reminders(
  target_class_id uuid,
  target_ids uuid[],
  request_key uuid
)
returns table (notification_id uuid, user_id uuid, title text, body text, action_url text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  class_row public.classes%rowtype;
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then
    raise exception 'administrator_required';
  end if;
  if coalesce(array_length(target_ids, 1), 0) = 0 then
    raise exception 'reminder_targets_required';
  end if;

  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;

  if exists (
    select 1 from unnest(target_ids) requested_id
    where not exists (
      select 1
      from public.class_recruitment_targets target
      join public.class_recruitment_responses response on response.target_id = target.id
      where target.id = requested_id
        and target.class_id = target_class_id
        and response.status = 'pending'
    )
  ) then raise exception 'pending_target_required'; end if;

  update public.class_recruitment_targets
  set last_reminded_at = now()
  where class_id = target_class_id and id = any(target_ids);

  return query
  insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
  select
    target.instructor_id,
    target_class_id,
    'class_reminder',
    '수업 요청 응답 마감이 얼마 남지 않았습니다.',
    format(
      '%s · %s / %s %s~%s / %s / 응답 마감 %s',
      class_row.institution,
      class_row.title,
      to_char(class_row.class_date, 'YYYY-MM-DD'),
      to_char(class_row.start_time, 'HH24:MI'),
      to_char(class_row.end_time, 'HH24:MI'),
      case target.requested_role
        when 'lead' then format('주강사 · %s원', to_char(class_row.lead_fee, 'FM999,999,999'))
        when 'assistant' then format('보조강사 · 1인당 %s원', to_char(class_row.assistant_fee, 'FM999,999,999'))
        else format('주강사 %s원 / 보조강사 1인당 %s원', to_char(class_row.lead_fee, 'FM999,999,999'), to_char(class_row.assistant_fee, 'FM999,999,999'))
      end,
      to_char(class_row.response_deadline at time zone 'Asia/Seoul', 'MM-DD HH24:MI')
    ),
    '/instructor/dashboard#request-' || target_class_id::text,
    'reminder:' || target_class_id::text || ':' || target.id::text || ':' || request_key::text
  from public.class_recruitment_targets target
  where target.class_id = target_class_id and target.id = any(target_ids)
  on conflict (dedupe_key) do nothing
  returning id, internal_notifications.user_id, internal_notifications.title, internal_notifications.body, internal_notifications.action_url;

  perform public.record_admin_activity(
    'assignment_reminded',
    jsonb_build_object('class_id', target_class_id, 'recipient_count', array_length(target_ids, 1), 'request_key', request_key)
  );
end;
$$;

revoke all on function public.create_class_reminders(uuid, uuid[], uuid) from public, anon;
grant execute on function public.create_class_reminders(uuid, uuid[], uuid) to authenticated;

create or replace function public.set_class_recruitment(
  target_class_id uuid,
  recruitment jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  target_id uuid;
  instructor_id uuid;
  requested text;
  class_row public.classes%rowtype;
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then raise exception 'administrator_required'; end if;
  if jsonb_typeof(recruitment) <> 'array' or jsonb_array_length(recruitment) = 0 then raise exception 'recruitment_targets_required'; end if;

  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if exists (
    select 1 from public.class_recruitment_responses response
    join public.class_recruitment_targets target on target.id = response.target_id
    where target.class_id = target_class_id and response.status <> 'pending'
  ) then raise exception 'responses_already_exist'; end if;

  delete from public.class_recruitment_targets where class_id = target_class_id;

  for item in select value from jsonb_array_elements(recruitment)
  loop
    requested := item ->> 'requested_role';
    instructor_id := (item ->> 'instructor_id')::uuid;
    if requested not in ('lead', 'assistant', 'both') then raise exception 'invalid_requested_role'; end if;

    insert into public.class_recruitment_targets (class_id, instructor_id, requested_role)
    select target_class_id, instructor_id, requested
    from public.user_profiles profile
    where profile.user_id = instructor_id and profile.role = 'instructor' and profile.status = 'active'
    returning id into target_id;
    if target_id is null then raise exception 'active_instructor_required'; end if;

    if requested in ('lead', 'both') then insert into public.class_recruitment_responses (target_id, role) values (target_id, 'lead'); end if;
    if requested in ('assistant', 'both') then insert into public.class_recruitment_responses (target_id, role) values (target_id, 'assistant'); end if;

    insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
    values (
      instructor_id,
      target_class_id,
      'class_request',
      '새 수업 요청이 도착했습니다.',
      format('%s · %s / %s %s~%s / 응답 마감 %s', class_row.institution, class_row.title, to_char(class_row.class_date, 'YYYY-MM-DD'), to_char(class_row.start_time, 'HH24:MI'), to_char(class_row.end_time, 'HH24:MI'), to_char(class_row.response_deadline at time zone 'Asia/Seoul', 'MM-DD HH24:MI')),
      '/instructor/dashboard#request-' || target_class_id::text,
      'request:' || target_class_id::text || ':' || instructor_id::text
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  update public.classes set status = 'recruiting', updated_at = now() where id = target_class_id;
  perform public.record_admin_activity('assignment_requested', jsonb_build_object('class_id', target_class_id, 'recipient_count', jsonb_array_length(recruitment)));
end;
$$;

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
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then raise exception 'administrator_required'; end if;
  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if class_row.status in ('completed', 'cancelled') then raise exception 'class_closed'; end if;
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

  delete from public.class_assignments where class_id = target_class_id;
  insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
  values (target_class_id, lead_instructor_id, 'lead', class_row.lead_fee, (select auth.uid()));
  foreach assistant_id in array assistant_instructor_ids loop
    insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
    values (target_class_id, assistant_id, 'assistant', class_row.assistant_fee, (select auth.uid()));
  end loop;

  insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
  select assignment.instructor_id, target_class_id, 'assignment_confirmed', '수업 배정이 확정되었습니다.',
    format('%s · %s / %s / %s · %s원', class_row.institution, class_row.title, to_char(class_row.class_date, 'YYYY-MM-DD'), case assignment.role when 'lead' then '주강사' else '보조강사' end, to_char(assignment.fee_snapshot, 'FM999,999,999')),
    '/instructor/dashboard#request-' || target_class_id::text,
    'assignment:' || target_class_id::text || ':' || assignment.instructor_id::text
  from public.class_assignments assignment
  where assignment.class_id = target_class_id
  on conflict (dedupe_key) do nothing;

  update public.classes set status = 'assigned', updated_at = now() where id = target_class_id;
  perform public.record_admin_activity('assignment_confirmed', jsonb_build_object('class_id', target_class_id, 'lead_instructor_id', lead_instructor_id, 'assistant_count', coalesce(array_length(assistant_instructor_ids, 1), 0)));
end;
$$;

revoke all on function public.set_class_recruitment(uuid, jsonb) from public, anon;
grant execute on function public.set_class_recruitment(uuid, jsonb) to authenticated;
revoke all on function public.finalize_class_assignment(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.finalize_class_assignment(uuid, uuid, uuid[]) to authenticated;
