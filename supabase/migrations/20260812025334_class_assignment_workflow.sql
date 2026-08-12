alter table public.classes drop constraint if exists classes_status_check;

update public.classes
set status = 'registered'
where status = 'draft';

alter table public.classes
  alter column status set default 'registered';

alter table public.classes
  add constraint classes_status_check
  check (status in ('registered', 'recruiting', 'reviewing', 'assignment_needed', 'assigned', 'completed', 'cancelled'));

create table if not exists public.class_recruitment_targets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  instructor_id uuid not null references public.user_profiles(user_id) on delete restrict,
  requested_role text not null check (requested_role in ('lead', 'assistant', 'both')),
  invited_at timestamptz not null default now(),
  last_reminded_at timestamptz,
  unique (class_id, instructor_id)
);

create table if not exists public.class_recruitment_responses (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.class_recruitment_targets(id) on delete cascade,
  role text not null check (role in ('lead', 'assistant')),
  status text not null default 'pending' check (status in ('pending', 'available', 'conditional', 'unavailable')),
  condition text,
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (target_id, role),
  constraint class_response_condition_required check (
    status <> 'conditional' or char_length(trim(coalesce(condition, ''))) > 0
  )
);

create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  instructor_id uuid not null references public.user_profiles(user_id) on delete restrict,
  role text not null check (role in ('lead', 'assistant')),
  fee_snapshot integer not null check (fee_snapshot >= 0),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  unique (class_id, instructor_id)
);

create unique index if not exists class_assignments_one_lead_idx
  on public.class_assignments (class_id)
  where role = 'lead';

create index if not exists recruitment_targets_class_idx
  on public.class_recruitment_targets (class_id);
create index if not exists recruitment_targets_instructor_idx
  on public.class_recruitment_targets (instructor_id);
create index if not exists recruitment_responses_target_idx
  on public.class_recruitment_responses (target_id, status, role);
create index if not exists class_assignments_class_idx
  on public.class_assignments (class_id, role);
create index if not exists class_assignments_instructor_idx
  on public.class_assignments (instructor_id, assigned_at desc);

alter table public.class_recruitment_targets enable row level security;
alter table public.class_recruitment_responses enable row level security;
alter table public.class_assignments enable row level security;

create policy recruitment_targets_select_admin_or_owner
on public.class_recruitment_targets for select to authenticated
using (
  instructor_id = (select auth.uid())
  or private.current_user_role() in ('super_admin', 'service_admin')
);

create policy recruitment_targets_admin_insert
on public.class_recruitment_targets for insert to authenticated
with check (private.current_user_role() in ('super_admin', 'service_admin'));

create policy recruitment_targets_admin_update
on public.class_recruitment_targets for update to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'))
with check (private.current_user_role() in ('super_admin', 'service_admin'));

create policy recruitment_targets_admin_delete
on public.class_recruitment_targets for delete to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'));

create policy recruitment_responses_select_admin_or_owner
on public.class_recruitment_responses for select to authenticated
using (
  private.current_user_role() in ('super_admin', 'service_admin')
  or exists (
    select 1 from public.class_recruitment_targets target
    where target.id = target_id
      and target.instructor_id = (select auth.uid())
  )
);

create policy recruitment_responses_admin_insert
on public.class_recruitment_responses for insert to authenticated
with check (private.current_user_role() in ('super_admin', 'service_admin'));

create policy recruitment_responses_owner_update
on public.class_recruitment_responses for update to authenticated
using (
  exists (
    select 1 from public.class_recruitment_targets target
    where target.id = target_id
      and target.instructor_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.class_recruitment_targets target
    where target.id = target_id
      and target.instructor_id = (select auth.uid())
  )
);

create policy recruitment_responses_admin_delete
on public.class_recruitment_responses for delete to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'));

create policy class_assignments_select_admin_or_owner
on public.class_assignments for select to authenticated
using (
  instructor_id = (select auth.uid())
  or private.current_user_role() in ('super_admin', 'service_admin')
);

create policy class_assignments_admin_insert
on public.class_assignments for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and private.current_user_role() in ('super_admin', 'service_admin')
);

create policy class_assignments_admin_update
on public.class_assignments for update to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'))
with check (private.current_user_role() in ('super_admin', 'service_admin'));

create policy class_assignments_admin_delete
on public.class_assignments for delete to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'));

revoke all on public.class_recruitment_targets from public, anon;
revoke all on public.class_recruitment_responses from public, anon;
revoke all on public.class_assignments from public, anon;
grant select, insert, update, delete on public.class_recruitment_targets to authenticated;
grant select, insert, delete on public.class_recruitment_responses to authenticated;
grant update (status, condition, responded_at, updated_at) on public.class_recruitment_responses to authenticated;
grant select, insert, update, delete on public.class_assignments to authenticated;

drop policy if exists classes_select_active_admin on public.classes;
create policy classes_select_admin_or_instructor
on public.classes for select to authenticated
using (
  private.current_user_role() in ('super_admin', 'service_admin')
  or exists (
    select 1 from public.class_recruitment_targets target
    where target.class_id = id and target.instructor_id = (select auth.uid())
  )
  or exists (
    select 1 from public.class_assignments assignment
    where assignment.class_id = id and assignment.instructor_id = (select auth.uid())
  )
);

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
  requested text;
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then
    raise exception 'administrator_required';
  end if;

  if jsonb_typeof(recruitment) <> 'array' or jsonb_array_length(recruitment) = 0 then
    raise exception 'recruitment_targets_required';
  end if;

  perform 1 from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;

  if exists (
    select 1
    from public.class_recruitment_responses response
    join public.class_recruitment_targets target on target.id = response.target_id
    where target.class_id = target_class_id and response.status <> 'pending'
  ) then
    raise exception 'responses_already_exist';
  end if;

  delete from public.class_recruitment_targets where class_id = target_class_id;

  for item in select value from jsonb_array_elements(recruitment)
  loop
    requested := item ->> 'requested_role';
    if requested not in ('lead', 'assistant', 'both') then
      raise exception 'invalid_requested_role';
    end if;

    insert into public.class_recruitment_targets (class_id, instructor_id, requested_role)
    select target_class_id, (item ->> 'instructor_id')::uuid, requested
    from public.user_profiles profile
    where profile.user_id = (item ->> 'instructor_id')::uuid
      and profile.role = 'instructor'
      and profile.status = 'active'
    returning id into target_id;

    if target_id is null then raise exception 'active_instructor_required'; end if;

    if requested in ('lead', 'both') then
      insert into public.class_recruitment_responses (target_id, role) values (target_id, 'lead');
    end if;
    if requested in ('assistant', 'both') then
      insert into public.class_recruitment_responses (target_id, role) values (target_id, 'assistant');
    end if;
  end loop;

  update public.classes
  set status = 'recruiting', updated_at = now()
  where id = target_class_id;

  perform public.record_admin_activity(
    'assignment_requested',
    jsonb_build_object('class_id', target_class_id, 'recipient_count', jsonb_array_length(recruitment))
  );
end;
$$;

revoke all on function public.set_class_recruitment(uuid, jsonb) from public, anon;
grant execute on function public.set_class_recruitment(uuid, jsonb) to authenticated;

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
  if private.current_user_role() not in ('super_admin', 'service_admin') then
    raise exception 'administrator_required';
  end if;

  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if class_row.status in ('completed', 'cancelled') then raise exception 'class_closed'; end if;
  if coalesce(array_length(assistant_instructor_ids, 1), 0) <> class_row.assistant_count then
    raise exception 'assistant_count_mismatch';
  end if;
  if lead_instructor_id = any(assistant_instructor_ids) then raise exception 'duplicate_instructor_role'; end if;
  if array_length(assistant_instructor_ids, 1) <> (
    select count(distinct value)::int from unnest(assistant_instructor_ids) value
  ) then raise exception 'duplicate_assistant'; end if;

  if not exists (
    select 1
    from public.class_recruitment_targets target
    join public.class_recruitment_responses response on response.target_id = target.id
    where target.class_id = target_class_id
      and target.instructor_id = lead_instructor_id
      and response.role = 'lead'
      and response.status in ('available', 'conditional')
  ) then raise exception 'lead_response_required'; end if;

  foreach assistant_id in array assistant_instructor_ids
  loop
    if not exists (
      select 1
      from public.class_recruitment_targets target
      join public.class_recruitment_responses response on response.target_id = target.id
      where target.class_id = target_class_id
        and target.instructor_id = assistant_id
        and response.role = 'assistant'
        and response.status in ('available', 'conditional')
    ) then raise exception 'assistant_response_required'; end if;
  end loop;

  delete from public.class_assignments where class_id = target_class_id;
  insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
  values (target_class_id, lead_instructor_id, 'lead', class_row.lead_fee, (select auth.uid()));

  foreach assistant_id in array assistant_instructor_ids
  loop
    insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
    values (target_class_id, assistant_id, 'assistant', class_row.assistant_fee, (select auth.uid()));
  end loop;

  update public.classes set status = 'assigned', updated_at = now() where id = target_class_id;
  perform public.record_admin_activity(
    'assignment_confirmed',
    jsonb_build_object('class_id', target_class_id, 'lead_instructor_id', lead_instructor_id, 'assistant_count', coalesce(array_length(assistant_instructor_ids, 1), 0))
  );
end;
$$;

revoke all on function public.finalize_class_assignment(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.finalize_class_assignment(uuid, uuid, uuid[]) to authenticated;
