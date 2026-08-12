drop policy if exists push_subscriptions_owner_select on public.web_push_subscriptions;

create policy push_subscriptions_owner_or_admin_select
on public.web_push_subscriptions for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.current_user_role()) in ('super_admin', 'service_admin')
);

alter function public.get_push_subscriptions_for_users(uuid[]) security invoker;
