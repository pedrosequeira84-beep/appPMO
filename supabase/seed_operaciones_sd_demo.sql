-- Datos de prueba OPCIONALES para Operaciones S&D.
-- No se aplica junto con las migraciones -- correr a mano solo en un entorno de prueba/demo.
-- Toma el primer proyecto y los primeros dos miembros activos que encuentre; si no hay
-- proyectos o miembros cargados, no inserta nada.

do $$
declare
  v_project_id uuid;
  v_project_opp text;
  v_member1 uuid;
  v_member2 uuid;
  v_task1 uuid;
  v_task2 uuid;
  v_task3 uuid;
begin
  select id, opportunity_number into v_project_id, v_project_opp from projects order by created_at asc limit 1;
  if v_project_id is null then
    raise notice 'No hay proyectos cargados, se omite el seed de Operaciones S&D.';
    return;
  end if;

  select id into v_member1 from team_members where coalesce(is_active, true) order by name asc limit 1;
  select id into v_member2 from team_members where coalesce(is_active, true) order by name asc offset 1 limit 1;

  insert into sd_tasks (code, project_id, work_type, title, description, assignee_member_id, status, planned_date, commitment_date, estimated_hours, priority, severity, tags)
  values (coalesce(v_project_opp, 'DEMO') || '-SD-1', v_project_id, 'incidente', 'Caída intermitente de VPN', 'Usuarios reportan cortes de VPN en horario pico.', v_member1, 'in_progress', current_date - 1, current_date + 1, 4, 'Alta', 'Alta', array['red', 'urgente'])
  returning id into v_task1;
  update sd_tasks set started_at = now() - interval '1 day' where id = v_task1;

  insert into sd_tasks (code, project_id, work_type, title, description, assignee_member_id, status, planned_date, commitment_date, estimated_hours, priority, severity, tags, vendor_support_required, vendor_name, vendor_ticket_number)
  values (coalesce(v_project_opp, 'DEMO') || '-SD-2', v_project_id, 'cambio', 'Actualización de firmware switches core', 'Ventana de mantenimiento programada.', v_member2, 'backlog', current_date + 5, current_date + 6, 6, 'Media', 'Media', array['mantenimiento'], true, 'Cisco', 'TAC-000111')
  returning id into v_task2;

  insert into sd_tasks (code, project_id, work_type, title, description, assignee_member_id, status, planned_date, commitment_date, estimated_hours, priority, severity, progress_percent, completed_at)
  values (coalesce(v_project_opp, 'DEMO') || '-SD-3', v_project_id, 'solicitud', 'Alta de usuario en dominio', 'Solicitud estándar de alta.', v_member1, 'done', current_date - 5, current_date - 4, 1, 'Baja', 'Baja', 100, now() - interval '4 days')
  returning id into v_task3;
  update sd_tasks set started_at = now() - interval '5 days' where id = v_task3;

  insert into sd_task_checklist_items (task_id, label, is_done, sort_order) values
    (v_task1, 'Confirmar impacto y alcance', true, 1),
    (v_task1, 'Aplicar mitigación temporal', false, 2);

  if v_member1 is not null then
    insert into sd_task_time_entries (task_id, member_id, date, hours, comment)
    values (v_task3, v_member1, current_date - 4, 1, 'Alta completada sin observaciones');
  end if;

  raise notice 'Seed de Operaciones S&D cargado sobre el proyecto %', v_project_id;
end $$;
