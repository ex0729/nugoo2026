create or replace function public.replace_class_assignment(
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
  previous_ids uuid[];
  selected_ids uuid[];
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then raise exception 'administrator_required'; end if;
  select * into class_row from public.classes where id = target_class_id for update;
  if not found then raise exception 'class_not_found'; end if;
  if class_row.status <> 'assigned' then raise exception 'assignment_not_finalized'; end if;
  if coalesce(array_length(assistant_instructor_ids, 1), 0) <> class_row.assistant_count then raise exception 'assistant_count_mismatch'; end if;
  if lead_instructor_id = any(assistant_instructor_ids) then raise exception 'duplicate_instructor_role'; end if;
  if coalesce(array_length(assistant_instructor_ids, 1), 0) <> (select count(distinct value)::int from unnest(assistant_instructor_ids) value) then raise exception 'duplicate_assistant'; end if;
  if not exists (
    select 1 from public.class_recruitment_targets target join public.class_recruitment_responses response on response.target_id = target.id
    where target.class_id = target_class_id and target.instructor_id = lead_instructor_id and response.role = 'lead' and response.status in ('available', 'conditional')
  ) then raise exception 'lead_response_required'; end if;
  foreach assistant_id in array assistant_instructor_ids loop
    if not exists (
      select 1 from public.class_recruitment_targets target join public.class_recruitment_responses response on response.target_id = target.id
      where target.class_id = target_class_id and target.instructor_id = assistant_id and response.role = 'assistant' and response.status in ('available', 'conditional')
    ) then raise exception 'assistant_response_required'; end if;
  end loop;

  select coalesce(array_agg(instructor_id), '{}') into previous_ids from public.class_assignments where class_id = target_class_id;
  selected_ids := array_prepend(lead_instructor_id, assistant_instructor_ids);
  if previous_ids @> selected_ids and selected_ids @> previous_ids then raise exception 'assignment_unchanged'; end if;

  delete from public.class_assignments where class_id = target_class_id;
  insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
  values (target_class_id, lead_instructor_id, 'lead', class_row.lead_fee, (select auth.uid()));
  foreach assistant_id in array assistant_instructor_ids loop
    insert into public.class_assignments (class_id, instructor_id, role, fee_snapshot, assigned_by)
    values (target_class_id, assistant_id, 'assistant', class_row.assistant_fee, (select auth.uid()));
  end loop;

  insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
  select assignment.instructor_id, target_class_id, 'assignment_confirmed', '수업 배정이 변경되었습니다.',
    format('%s · %s / %s / %s · %s원', class_row.institution, class_row.title, to_char(class_row.class_date, 'YYYY-MM-DD'), case assignment.role when 'lead' then '주강사' else '보조강사' end, to_char(assignment.fee_snapshot, 'FM999,999,999')),
    '/instructor/dashboard#schedule', 'assignment-change:' || target_class_id::text || ':' || assignment.instructor_id::text || ':' || txid_current()::text
  from public.class_assignments assignment where assignment.class_id = target_class_id;

  insert into public.internal_notifications (user_id, class_id, type, title, body, action_url, dedupe_key)
  select old_id, target_class_id, 'assignment_result', '수업 배정이 변경되었습니다.',
    format('%s · %s / 기존 배정이 취소되었습니다.', class_row.institution, class_row.title),
    '/instructor/dashboard#request-' || target_class_id::text, 'assignment-removed:' || target_class_id::text || ':' || old_id::text || ':' || txid_current()::text
  from unnest(previous_ids) old_id where not (old_id = any(selected_ids));

  perform public.record_admin_activity('assignment_changed', jsonb_build_object('class_id', target_class_id, 'previous_instructor_ids', previous_ids, 'next_instructor_ids', selected_ids));
end;
$$;

revoke all on function public.replace_class_assignment(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.replace_class_assignment(uuid, uuid, uuid[]) to authenticated;
