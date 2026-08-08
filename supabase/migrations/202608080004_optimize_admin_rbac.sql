drop policy if exists "users can read their own profile" on public.user_profiles;

drop policy if exists user_profiles_select_own_or_admin on public.user_profiles;
create policy user_profiles_select_own_or_admin
on public.user_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.current_user_role() in ('super_admin', 'service_admin')
);

drop policy if exists user_profiles_update_own_name on public.user_profiles;
create policy user_profiles_update_own_name
on public.user_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create index if not exists admin_audit_logs_actor_user_id_idx
  on public.admin_audit_logs (actor_user_id);
create index if not exists admin_audit_logs_target_user_id_idx
  on public.admin_audit_logs (target_user_id);
create index if not exists admin_bootstrap_allowlist_claimed_by_idx
  on public.admin_bootstrap_allowlist (claimed_by)
  where claimed_by is not null;
