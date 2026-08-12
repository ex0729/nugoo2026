update public.user_profiles
set full_name = 'NGN-X',
    updated_at = now()
where lower(email) = 'nugoona2021@naver.com'
  and role = 'super_admin';

update public.admin_bootstrap_allowlist
set display_name = 'NGN-X'
where email = 'nugoona2021@naver.com';
