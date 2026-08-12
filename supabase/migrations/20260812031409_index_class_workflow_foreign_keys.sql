create index if not exists classes_created_by_idx
  on public.classes (created_by);

create index if not exists class_assignments_assigned_by_idx
  on public.class_assignments (assigned_by);
