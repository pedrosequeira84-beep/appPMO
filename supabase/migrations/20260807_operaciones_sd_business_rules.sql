-- Operaciones S&D: reglas de negocio e inteligencia.
-- 100% aditivo sobre el esquema de 20260807_operaciones_sd_schema.sql: no borra ni renombra nada.
-- Aplicar DESPUÉS de los dos archivos de la primera entrega (schema + rls).

-- 1. started_at: necesario para calcular Cycle Time / Tiempo en Backlog / Tiempo en WIP con precisión
--    (sin esta marca de tiempo no hay forma de saber cuándo pasó realmente Backlog -> In Progress).
alter table sd_tasks add column if not exists started_at timestamptz;

-- 2. Auditoría completa: registra cada cambio de campo, nunca se borra.
create table if not exists sd_audit_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references sd_tasks(id) on delete cascade,
  member_id uuid references team_members(id),
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_sd_audit_task on sd_audit_log(task_id);

-- 3. Notificaciones.
create table if not exists sd_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references team_members(id) on delete cascade,
  type text not null check (type in (
    'assignment', 'date_change', 'comment', 'block', 'vendor_support', 'due_soon', 'dependency_resolved'
  )),
  task_id uuid references sd_tasks(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_sd_notifications_member on sd_notifications(member_id, is_read);

-- 4. RLS (misma convención que 20260807_operaciones_sd_rls.sql: internos con acceso total,
--    externos sin acceso a auditoría/notificaciones -- son datos operativos internos).
alter table sd_audit_log enable row level security;
create policy sd_audit_log_select on sd_audit_log for select to authenticated
  using (not sd_is_external_current());
create policy sd_audit_log_insert on sd_audit_log for insert to authenticated
  with check (not sd_is_external_current());

alter table sd_notifications enable row level security;
create policy sd_notifications_select on sd_notifications for select to authenticated
  using (not sd_is_external_current() and member_id = sd_current_member_id());
create policy sd_notifications_insert on sd_notifications for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_notifications_update on sd_notifications for update to authenticated
  using (not sd_is_external_current() and member_id = sd_current_member_id())
  with check (not sd_is_external_current() and member_id = sd_current_member_id());
