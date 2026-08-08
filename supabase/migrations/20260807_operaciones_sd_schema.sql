-- Operaciones S&D: nuevas tablas + columnas aditivas en tablas existentes.
-- 100% aditivo: no borra ni renombra nada, no debería romper ninguna vista existente.
-- No aplicar sin antes revisar el bloque de RLS en 20260807_operaciones_sd_rls.sql (requiere
-- confirmar el estado actual de RLS en projects/milestones/ocs/risks/changes/lessons_learned/
-- expenses/documentation_* antes de tocarlas -- ver comentario al inicio de ese archivo).

-- 1. Columnas nuevas en tablas existentes -----------------------------------

alter table team_members
  add column if not exists is_external boolean not null default false,
  add column if not exists sd_role text check (sd_role in ('administrador', 'responsable'));

alter table capacity_assignments
  add column if not exists source text not null default 'manual',
  add column if not exists sd_time_entry_id uuid;

-- 2. Tablas nuevas ------------------------------------------------------------

create table if not exists sd_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  project_id uuid not null references projects(id) on delete cascade,
  work_type text not null check (work_type in (
    'proyecto', 'cambio', 'incidente', 'problema', 'solicitud',
    'mantenimiento', 'implementacion', 'mejora', 'documentacion'
  )),
  title text not null,
  description text,
  assignee_member_id uuid references team_members(id),
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'done')),
  planned_date date,
  commitment_date date,
  estimated_hours numeric,
  priority text,
  severity text,
  tags text[] not null default '{}',
  vendor_support_required boolean not null default false,
  vendor_name text,
  vendor_ticket_number text,
  progress_percent integer not null default 0,
  progress_manual_override boolean not null default false,
  blocked boolean not null default false,
  blocked_reason text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_sd_tasks_project on sd_tasks(project_id);
create index if not exists idx_sd_tasks_assignee on sd_tasks(assignee_member_id);
create index if not exists idx_sd_tasks_status on sd_tasks(status);

create table if not exists sd_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  work_type text not null,
  label text not null,
  sort_order integer not null default 0
);

create table if not exists sd_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  label text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_checklist_task on sd_task_checklist_items(task_id);

create table if not exists sd_task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  member_id uuid not null references team_members(id),
  date date not null,
  hours numeric not null check (hours > 0),
  comment text,
  capacity_assignment_id uuid references capacity_assignments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_time_entries_task on sd_task_time_entries(task_id);

do $$ begin
  alter table capacity_assignments
    add constraint fk_capacity_sd_time_entry
    foreign key (sd_time_entry_id) references sd_task_time_entries(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists sd_task_date_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  previous_date date,
  new_date date not null,
  member_id uuid references team_members(id),
  reason text not null,
  changed_at timestamptz not null default now()
);
create index if not exists idx_sd_date_history_task on sd_task_date_history(task_id);

create table if not exists sd_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references sd_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id)
);

create table if not exists sd_task_blocks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  description text not null,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references team_members(id)
);
create index if not exists idx_sd_blocks_task on sd_task_blocks(task_id);

create table if not exists sd_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  member_id uuid references team_members(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_comments_task on sd_task_comments(task_id);

create table if not exists sd_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  uploaded_by uuid references team_members(id),
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_sd_attachments_task on sd_task_attachments(task_id);

create table if not exists sd_external_access (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references team_members(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references sd_tasks(id) on delete cascade,
  granted_by text,
  granted_at timestamptz not null default now()
);
create unique index if not exists uq_sd_external_access_task
  on sd_external_access(member_id, project_id, task_id) where task_id is not null;
create unique index if not exists uq_sd_external_access_project
  on sd_external_access(member_id, project_id) where task_id is null;

-- 3. Storage bucket para adjuntos de tareas ----------------------------------

insert into storage.buckets (id, name, public)
select 'sd-attachments', 'sd-attachments', true
where not exists (select 1 from storage.buckets where id = 'sd-attachments');

-- 4. Seed: checklist sugerido por tipo de trabajo (editable luego desde la app) --

insert into sd_checklist_templates (work_type, label, sort_order)
select * from (values
  ('incidente', 'Confirmar impacto y alcance', 1),
  ('incidente', 'Aplicar mitigación temporal', 2),
  ('incidente', 'Resolver causa raíz', 3),
  ('incidente', 'Confirmar restablecimiento con el cliente', 4),
  ('problema', 'Analizar causa raíz', 1),
  ('problema', 'Documentar hallazgos', 2),
  ('problema', 'Definir plan de acción', 3),
  ('cambio', 'Evaluar impacto', 1),
  ('cambio', 'Plan de rollback definido', 2),
  ('cambio', 'Ejecutar en ventana acordada', 3),
  ('cambio', 'Validar post-cambio', 4),
  ('mantenimiento', 'Coordinar ventana de mantenimiento', 1),
  ('mantenimiento', 'Ejecutar tareas programadas', 2),
  ('mantenimiento', 'Validar servicios post-mantenimiento', 3),
  ('implementacion', 'Preparar entorno', 1),
  ('implementacion', 'Ejecutar implementación', 2),
  ('implementacion', 'Pruebas funcionales', 3),
  ('implementacion', 'Pase a producción', 4),
  ('solicitud', 'Confirmar requerimiento con el solicitante', 1),
  ('solicitud', 'Ejecutar solicitud', 2),
  ('solicitud', 'Confirmar cierre con el solicitante', 3),
  ('mejora', 'Definir alcance de la mejora', 1),
  ('mejora', 'Implementar', 2),
  ('mejora', 'Validar resultado', 3),
  ('documentacion', 'Relevar información', 1),
  ('documentacion', 'Redactar documento', 2),
  ('documentacion', 'Revisión y publicación', 3)
) as seed(work_type, label, sort_order)
where not exists (select 1 from sd_checklist_templates);
