create or replace function public.delete_class(target_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  class_row public.classes%rowtype;
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then
    raise exception 'insufficient_permissions';
  end if;

  select class_item.*
  into class_row
  from public.classes class_item
  where class_item.id = target_class_id
  for update;

  if class_row.id is null then
    raise exception 'class_not_found';
  end if;

  if class_row.status <> 'registered'
    or exists (select 1 from public.class_recruitment_targets target where target.class_id = target_class_id)
    or exists (select 1 from public.class_assignments assignment where assignment.class_id = target_class_id)
  then
    raise exception 'class_delete_locked';
  end if;

  insert into public.admin_audit_logs (actor_user_id, action, details)
  values (
    (select auth.uid()),
    'class_deleted',
    jsonb_build_object(
      'class_id', class_row.id,
      'institution', class_row.institution,
      'title', class_row.title
    )
  );

  delete from public.classes where id = target_class_id;
  return target_class_id;
end;
$$;

revoke all on function public.delete_class(uuid) from public, anon;
grant execute on function public.delete_class(uuid) to authenticated;
