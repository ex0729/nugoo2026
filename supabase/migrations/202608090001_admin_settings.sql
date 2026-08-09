create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.user_role not null default 'service_admin',
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  invited_by uuid not null,
  accepted_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.admin_invitations enable row level security;
revoke all on table public.admin_invitations from public, anon, authenticated;
grant select on table public.admin_invitations to authenticated;

drop policy if exists admin_invitations_select_super_admin on public.admin_invitations;
create policy admin_invitations_select_super_admin
on public.admin_invitations
for select
to authenticated
using (private.current_user_role() = 'super_admin');

create unique index if not exists admin_invitations_pending_email_unique
  on public.admin_invitations (lower(email))
  where status = 'pending';
create index if not exists admin_invitations_expires_at_idx
  on public.admin_invitations (expires_at)
  where status = 'pending';
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create or replace function public.create_admin_invitation(
  invite_email text,
  invite_token text
)
returns table (
  invitation_id uuid,
  invited_email text,
  invited_role public.user_role,
  invitation_status text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  created_invitation public.admin_invitations;
begin
  if private.current_user_role() <> 'super_admin' then
    raise exception 'only_super_admin_can_invite_admins';
  end if;

  normalized_email := lower(trim(invite_email));
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;
  if length(invite_token) < 32 then
    raise exception 'invalid_invitation_token';
  end if;
  if exists (
    select 1 from public.user_profiles
    where lower(email) = normalized_email
      and role in ('super_admin', 'service_admin')
      and status = 'active'
  ) then
    raise exception 'already_active_admin';
  end if;

  update public.admin_invitations
  set status = 'revoked'
  where lower(email) = normalized_email and status = 'pending';

  insert into public.admin_invitations (
    email, role, token_hash, status, expires_at, invited_by
  ) values (
    normalized_email,
    'service_admin',
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    'pending',
    now() + interval '7 days',
    (select auth.uid())
  ) returning * into created_invitation;

  insert into public.admin_audit_logs (actor_user_id, action, details)
  values (
    (select auth.uid()),
    'admin_invited',
    jsonb_build_object('email', normalized_email, 'role', 'service_admin')
  );

  return query select
    created_invitation.id,
    created_invitation.email,
    created_invitation.role,
    created_invitation.status,
    created_invitation.expires_at;
end;
$$;

revoke all on function public.create_admin_invitation(text, text)
  from public, anon, authenticated;
grant execute on function public.create_admin_invitation(text, text)
  to authenticated;

create or replace function public.record_admin_activity(
  activity_action text,
  activity_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() not in ('super_admin', 'service_admin') then
    raise exception 'insufficient_permissions';
  end if;
  if activity_action not in (
    'admin_login',
    'password_changed',
    'other_sessions_signed_out',
    'class_created',
    'class_updated',
    'class_cancelled',
    'assignment_requested',
    'assignment_reminded',
    'assignment_confirmed',
    'assignment_changed',
    'assignment_cancelled'
  ) then
    raise exception 'invalid_activity_action';
  end if;

  insert into public.admin_audit_logs (actor_user_id, action, details)
  values ((select auth.uid()), activity_action, coalesce(activity_details, '{}'::jsonb));
end;
$$;

revoke all on function public.record_admin_activity(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_admin_activity(text, jsonb)
  to authenticated;

create or replace function public.current_admin_sessions()
returns table (
  session_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip_address text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    session.created_at,
    session.updated_at,
    session.user_agent,
    session.ip::text,
    session.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  from auth.sessions as session
  where session.user_id = (select auth.uid())
    and private.current_user_role() in ('super_admin', 'service_admin')
  order by session.updated_at desc;
$$;

revoke all on function public.current_admin_sessions()
  from public, anon, authenticated;
grant execute on function public.current_admin_sessions()
  to authenticated;

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
  current_target_role text;
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

  select role::text into current_target_role
  from public.user_profiles
  where user_id = target_user_id;

  if current_target_role is null then
    raise exception 'member_not_found';
  end if;
  if current_target_role = 'super_admin' then
    raise exception 'super_admin_cannot_be_modified';
  end if;
  if actor_role <> 'super_admin'
    and (current_target_role = 'service_admin' or next_role = 'service_admin') then
    raise exception 'only_super_admin_can_manage_admins';
  end if;

  update public.user_profiles
  set role = next_role,
      status = next_status,
      updated_at = now()
  where user_id = target_user_id
  returning * into updated_profile;

  insert into public.admin_audit_logs (
    actor_user_id, target_user_id, action, details
  ) values (
    (select auth.uid()),
    target_user_id,
    'member_role_updated',
    jsonb_build_object(
      'previous_role', current_target_role,
      'role', next_role::text,
      'status', next_status
    )
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
  invitation_token text;
  matched_invitation public.admin_invitations;
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
    set claimed_by = new.id, claimed_at = now()
    where email = lower(new.email);
  else
    invitation_token := nullif(new.raw_user_meta_data ->> 'admin_invitation_token', '');

    if invitation_token is not null then
      select * into matched_invitation
      from public.admin_invitations
      where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
        and lower(email) = lower(new.email)
        and status = 'pending'
        and expires_at > now()
      for update;

      if matched_invitation.id is null then
        raise exception 'invalid_or_expired_admin_invitation';
      end if;

      insert into public.user_profiles (user_id, email, full_name, role, status)
      values (
        new.id,
        lower(new.email),
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
        'service_admin',
        'active'
      );

      update public.admin_invitations
      set status = 'accepted', accepted_by = new.id, accepted_at = now()
      where id = matched_invitation.id;

      insert into public.admin_audit_logs (actor_user_id, target_user_id, action, details)
      values (
        matched_invitation.invited_by,
        new.id,
        'admin_invitation_accepted',
        jsonb_build_object('email', lower(new.email), 'role', 'service_admin')
      );
    else
      requested_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'instructor');
      if requested_role not in ('instructor', 'company_member') then
        raise exception 'invalid_product_role';
      end if;

      insert into public.user_profiles (user_id, email, full_name, role, status)
      values (
        new.id,
        lower(new.email),
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
        requested_role::public.user_role,
        'pending'
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
