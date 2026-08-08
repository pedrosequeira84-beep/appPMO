-- Operaciones S&D: Row Level Security.
--
-- ANTES DE APLICAR ESTE ARCHIVO: hay que confirmar con `list_tables` (verbose) o el dashboard
-- de Supabase si projects/milestones/ocs/risks/changes/lessons_learned/expenses/
-- documentation_sections/documentation_links ya tienen RLS habilitado con una policy
-- permisiva para "authenticated". El bloque 3 de este archivo agrega policies RESTRICTIVE
-- (que se combinan con AND sobre las permisivas existentes) para que un usuario externo
-- nunca pueda leer esas tablas via API directa, aunque la UI ya lo restrinja.
-- Si alguna de esas tablas NO tiene RLS habilitado hoy, agregar una policy restrictive ahí
-- no hace nada (RLS deshabilitado = las policies se ignoran) -- en ese caso hay que además
-- ejecutar `alter table <tabla> enable row level security` Y crear una policy permisiva
-- para "authenticated: true" ANTES de agregar la restrictive, o se bloquea el acceso a
-- todo el mundo (RLS habilitado sin ninguna policy permisiva = nadie puede leer nada).
-- Verificar esto tabla por tabla antes de correr el bloque 3.

-- 1. Helpers -------------------------------------------------------------------

create or replace function sd_is_external_current()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select is_external from team_members where lower(email) = lower(auth.jwt() ->> 'email') limit 1),
    false
  );
$$;

create or replace function sd_current_member_id()
returns uuid
language sql stable security definer
as $$
  select id from team_members where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
$$;

create or replace function sd_has_task_access(p_project_id uuid, p_task_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from sd_external_access ea
    where ea.member_id = sd_current_member_id()
      and ea.project_id = p_project_id
      and (ea.task_id is null or ea.task_id = p_task_id)
  );
$$;

-- 2. RLS sobre las tablas nuevas de Operaciones S&D -----------------------------
-- Regla general: usuarios internos (is_external = false) tienen acceso total.
-- Usuarios externos: solo SELECT, y solo sobre proyectos/tareas que tengan otorgados
-- en sd_external_access.

alter table sd_tasks enable row level security;
create policy sd_tasks_select on sd_tasks for select to authenticated
  using (not sd_is_external_current() or sd_has_task_access(project_id, id));
create policy sd_tasks_insert on sd_tasks for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_tasks_update on sd_tasks for update to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_tasks_delete on sd_tasks for delete to authenticated
  using (not sd_is_external_current());

alter table sd_checklist_templates enable row level security;
create policy sd_checklist_templates_all on sd_checklist_templates for all to authenticated
  using (true) with check (true);

alter table sd_task_checklist_items enable row level security;
create policy sd_checklist_items_select on sd_task_checklist_items for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_checklist_items_write on sd_task_checklist_items for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_checklist_items_update on sd_task_checklist_items for update to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_checklist_items_delete on sd_task_checklist_items for delete to authenticated
  using (not sd_is_external_current());

alter table sd_task_time_entries enable row level security;
create policy sd_time_entries_select on sd_task_time_entries for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_time_entries_write on sd_task_time_entries for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_time_entries_update on sd_task_time_entries for update to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_time_entries_delete on sd_task_time_entries for delete to authenticated
  using (not sd_is_external_current());

alter table sd_task_date_history enable row level security;
create policy sd_date_history_select on sd_task_date_history for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_date_history_write on sd_task_date_history for insert to authenticated
  with check (not sd_is_external_current());

alter table sd_task_dependencies enable row level security;
create policy sd_dependencies_select on sd_task_dependencies for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_dependencies_write on sd_task_dependencies for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_dependencies_delete on sd_task_dependencies for delete to authenticated
  using (not sd_is_external_current());

alter table sd_task_blocks enable row level security;
create policy sd_blocks_select on sd_task_blocks for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_blocks_write on sd_task_blocks for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_blocks_update on sd_task_blocks for update to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());

alter table sd_task_comments enable row level security;
create policy sd_comments_select on sd_task_comments for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_comments_write on sd_task_comments for insert to authenticated
  with check (not sd_is_external_current());

alter table sd_task_attachments enable row level security;
create policy sd_attachments_select on sd_task_attachments for select to authenticated
  using (not sd_is_external_current() or exists (
    select 1 from sd_tasks t where t.id = task_id and sd_has_task_access(t.project_id, t.id)
  ));
create policy sd_attachments_write on sd_task_attachments for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_attachments_delete on sd_task_attachments for delete to authenticated
  using (not sd_is_external_current());

alter table sd_external_access enable row level security;
create policy sd_external_access_select on sd_external_access for select to authenticated
  using (not sd_is_external_current() or member_id = sd_current_member_id());
create policy sd_external_access_insert on sd_external_access for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_external_access_delete on sd_external_access for delete to authenticated
  using (not sd_is_external_current());

-- 3. Policies RESTRICTIVE para blindar tablas EXISTENTES contra usuarios externos ----
-- Ver advertencia al inicio del archivo antes de correr este bloque.

create policy sd_restrict_projects_external as restrictive on projects for select to authenticated
  using (
    not sd_is_external_current()
    or id in (select project_id from sd_external_access where member_id = sd_current_member_id())
  );
create policy sd_restrict_projects_external_w as restrictive on projects for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_restrict_projects_external_u as restrictive on projects for update to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_projects_external_d as restrictive on projects for delete to authenticated
  using (not sd_is_external_current());

create policy sd_restrict_milestones_external as restrictive on milestones for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_ocs_external as restrictive on ocs for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_risks_external as restrictive on risks for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_changes_external as restrictive on changes for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_lessons_external as restrictive on lessons_learned for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_expenses_external as restrictive on expenses for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_capacity_external as restrictive on capacity_assignments for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_docsections_external as restrictive on documentation_sections for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_doclinks_external as restrictive on documentation_links for all to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());

-- Storage: bucket "sd-attachments" es público para lectura (URLs públicas), pero solo
-- usuarios internos pueden subir/borrar adjuntos.
create policy sd_attachments_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sd-attachments' and not sd_is_external_current());
create policy sd_attachments_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sd-attachments' and not sd_is_external_current());

-- team_members: los externos necesitan poder leer nombres (para mostrar "Responsable: X"),
-- pero nunca deben poder escribir.
create policy sd_restrict_teammembers_external_w as restrictive on team_members for insert to authenticated
  with check (not sd_is_external_current());
create policy sd_restrict_teammembers_external_u as restrictive on team_members for update to authenticated
  using (not sd_is_external_current()) with check (not sd_is_external_current());
create policy sd_restrict_teammembers_external_d as restrictive on team_members for delete to authenticated
  using (not sd_is_external_current());
