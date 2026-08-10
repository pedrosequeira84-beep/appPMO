-- Operaciones S&D: el rol Observador (y el resto de la jerarquía Administrador/Responsable/
-- Observador) pasa a exigirse también a nivel de base de datos, no solo en la interfaz.
-- Hasta ahora las policies de escritura sobre las tablas sd_* solo distinguían
-- externo/interno -- cualquier interno (incluido un Observador sin promover) podía escribir
-- vía API directa. A partir de acá:
--   * Crear/editar tareas, checklist, horas, bloqueos, comentarios, adjuntos y reprogramar
--     fechas requiere sd_role = 'administrador' o 'responsable' (o ser el super-admin).
--   * Otorgar/revocar acceso externo (sd_external_access) requiere específicamente
--     sd_role = 'administrador' (antes cualquier interno podía hacerlo).

create or replace function sd_can_manage_current()
returns boolean
language sql stable security definer
as $$
  select
    lower(auth.jwt() ->> 'email') = 'pedro.sequeira@bghtechpartner.com'
    or coalesce(
      (select sd_role in ('administrador', 'responsable') from team_members where lower(email) = lower(auth.jwt() ->> 'email') limit 1),
      false
    );
$$;

create or replace function sd_is_admin_current()
returns boolean
language sql stable security definer
as $$
  select
    lower(auth.jwt() ->> 'email') = 'pedro.sequeira@bghtechpartner.com'
    or coalesce(
      (select sd_role = 'administrador' from team_members where lower(email) = lower(auth.jwt() ->> 'email') limit 1),
      false
    );
$$;

alter policy sd_tasks_insert on sd_tasks with check (sd_can_manage_current());
alter policy sd_tasks_update on sd_tasks using (sd_can_manage_current()) with check (sd_can_manage_current());
alter policy sd_tasks_delete on sd_tasks using (sd_can_manage_current());

alter policy sd_checklist_items_write on sd_task_checklist_items with check (sd_can_manage_current());
alter policy sd_checklist_items_update on sd_task_checklist_items using (sd_can_manage_current()) with check (sd_can_manage_current());
alter policy sd_checklist_items_delete on sd_task_checklist_items using (sd_can_manage_current());

alter policy sd_time_entries_write on sd_task_time_entries with check (sd_can_manage_current());
alter policy sd_time_entries_update on sd_task_time_entries using (sd_can_manage_current()) with check (sd_can_manage_current());
alter policy sd_time_entries_delete on sd_task_time_entries using (sd_can_manage_current());

alter policy sd_date_history_write on sd_task_date_history with check (sd_can_manage_current());

alter policy sd_dependencies_write on sd_task_dependencies with check (sd_can_manage_current());
alter policy sd_dependencies_delete on sd_task_dependencies using (sd_can_manage_current());

alter policy sd_blocks_write on sd_task_blocks with check (sd_can_manage_current());
alter policy sd_blocks_update on sd_task_blocks using (sd_can_manage_current()) with check (sd_can_manage_current());

alter policy sd_comments_write on sd_task_comments with check (sd_can_manage_current());

alter policy sd_attachments_write on sd_task_attachments with check (sd_can_manage_current());
alter policy sd_attachments_delete on sd_task_attachments using (sd_can_manage_current());
alter policy sd_attachments_storage_insert on storage.objects with check (bucket_id = 'sd-attachments' and sd_can_manage_current());
alter policy sd_attachments_storage_delete on storage.objects using (bucket_id = 'sd-attachments' and sd_can_manage_current());

-- Accesos externos: solo Administrador (antes, cualquier interno podía otorgar/revocar).
alter policy sd_external_access_insert on sd_external_access with check (sd_is_admin_current());
alter policy sd_external_access_delete on sd_external_access using (sd_is_admin_current());
