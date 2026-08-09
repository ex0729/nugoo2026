create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  institution text not null check (char_length(trim(institution)) between 2 and 120),
  contact text,
  class_date date not null,
  start_time time not null,
  end_time time not null,
  address text not null check (char_length(trim(address)) between 2 and 240),
  target_group text not null,
  grade text not null,
  participant_count integer not null check (participant_count between 1 and 10000),
  description text not null default '',
  lead_count integer not null default 1 check (lead_count = 1),
  assistant_count integer not null default 0 check (assistant_count between 0 and 2),
  lead_fee integer not null check (lead_fee >= 0),
  assistant_fee integer not null default 0 check (assistant_fee >= 0),
  fee_notes text not null default '',
  response_deadline timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'recruiting', 'assignment_needed', 'assigned', 'cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_time_order check (start_time < end_time),
  constraint classes_assistant_fee check (assistant_count > 0 or assistant_fee = 0)
);

create index if not exists classes_date_status_idx
  on public.classes (class_date, status)
  where status <> 'cancelled';

create index if not exists classes_created_at_idx
  on public.classes (created_at desc);

alter table public.classes enable row level security;

drop policy if exists classes_select_active_admin on public.classes;
create policy classes_select_active_admin
on public.classes
for select
to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'));

drop policy if exists classes_insert_active_admin on public.classes;
create policy classes_insert_active_admin
on public.classes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.current_user_role() in ('super_admin', 'service_admin')
);

drop policy if exists classes_update_active_admin on public.classes;
create policy classes_update_active_admin
on public.classes
for update
to authenticated
using (private.current_user_role() in ('super_admin', 'service_admin'))
with check (private.current_user_role() in ('super_admin', 'service_admin'));

revoke all on table public.classes from public, anon;
grant select, insert, update on table public.classes to authenticated;
