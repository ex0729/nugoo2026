alter table public.user_profiles
  add column if not exists email text,
  add column if not exists status text not null default 'active'
    check (status in ('pending', 'active', 'suspended'));

update public.user_profiles as profile
set email = auth_user.email
from auth.users as auth_user
where auth_user.id = profile.user_id
  and profile.email is null;

create unique index if not exists user_profiles_email_unique
  on public.user_profiles (lower(email));

create unique index if not exists user_profiles_single_super_admin
  on public.user_profiles ((1))
  where role = 'super_admin';

create table if not exists public.admin_bootstrap_allowlist (
  email text primary key check (email = lower(email)),
  display_name text not null check (char_length(display_name) between 2 and 50),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_bootstrap_allowlist enable row level security;

insert into public.admin_bootstrap_allowlist (email, display_name)
values ('nugoona2021@naver.com', '누구나코딩교육')
on conflict (email) do update
set display_name = excluded.display_name;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

create or replace function public.current_user_role()
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

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

drop policy if exists user_profiles_select_own_or_admin on public.user_profiles;
create policy user_profiles_select_own_or_admin
on public.user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('super_admin', 'service_admin')
);

drop policy if exists user_profiles_update_own_name on public.user_profiles;
create policy user_profiles_update_own_name
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin
on public.admin_audit_logs
for select
to authenticated
using (public.current_user_role() in ('super_admin', 'service_admin'));

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
  actor_role := public.current_user_role();

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

revoke all on function public.manage_member(uuid, public.user_role, text) from public;
grant execute on function public.manage_member(uuid, public.user_role, text) to authenticated;

create or replace function public.handle_new_user()
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
