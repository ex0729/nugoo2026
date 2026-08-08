create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text
  from public.user_profiles
  where user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;

drop policy if exists user_profiles_select_own_or_admin on public.user_profiles;
create policy user_profiles_select_own_or_admin
on public.user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or private.current_user_role() in ('super_admin', 'service_admin')
);

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin
on public.admin_audit_logs
for select
to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'));

revoke insert, delete, update on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant update (full_name) on table public.user_profiles to authenticated;

create or replace function public.manage_member(
  target_user_id uuid,
  next_role public.user_role,
  next_status text
)
returns public.user_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  updated_profile public.user_profiles;
begin
  actor_role := private.current_user_role();

  if actor_role not in ('super_admin', 'service_admin') then
    raise exception 'insufficient_permissions';
  end if;

  if next_status not in ('pending', 'active', 'suspended') then
    raise exception 'invalid_status';
  end if;

  if next_role = 'super_admin' then
    raise exception 'super_admin_transfer_requires_manual_review';
  end if;

  if actor_role = 'service_admin' and next_role = 'service_admin' then
    raise exception 'only_super_admin_can_assign_admin';
  end if;

  if exists (
    select 1 from public.user_profiles
    where user_id = target_user_id and role = 'super_admin'
  ) then
    raise exception 'super_admin_cannot_be_modified';
  end if;

  update public.user_profiles
  set role = next_role,
      status = next_status,
      updated_at = now()
  where user_id = target_user_id
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'member_not_found';
  end if;

  insert into public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    details
  ) values (
    auth.uid(),
    target_user_id,
    'member_role_updated',
    jsonb_build_object('role', next_role::text, 'status', next_status)
  );

  return updated_profile;
end;
$$;

revoke all on function public.manage_member(uuid, public.user_role, text)
  from public, anon, authenticated;
grant execute on function public.manage_member(uuid, public.user_role, text)
  to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  bootstrap_name text;
begin
  select display_name into bootstrap_name
  from public.admin_bootstrap_allowlist
  where email = lower(new.email)
    and claimed_by is null
  for update;

  if bootstrap_name is not null then
    insert into public.user_profiles (user_id, email, full_name, role, status)
    values (new.id, lower(new.email), bootstrap_name, 'super_admin', 'active');

    update public.admin_bootstrap_allowlist
    set claimed_by = new.id,
        claimed_at = now()
    where email = lower(new.email);
  else
    requested_role := coalesce(
      nullif(new.raw_user_meta_data ->> 'role', ''),
      'instructor'
    );

    if requested_role not in ('instructor', 'company_member') then
      raise exception 'invalid_product_role';
    end if;

    insert into public.user_profiles (user_id, email, full_name, role, status)
    values (
      new.id,
      lower(new.email),
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(new.email, '@', 1)
      ),
      requested_role::public.user_role,
      'pending'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

drop function if exists public.handle_new_user();
drop function if exists public.current_user_role();
