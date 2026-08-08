-- Operaciones S&D: subtareas reales (reemplaza el uso de "Dependencias" en el modal de tarea).
-- Aditivo: una subtarea es una fila más de sd_tasks, con su propio checklist/horas/estado,
-- enlazada a su tarea padre por parent_task_id. No requiere cambios de RLS: las policies
-- existentes sobre sd_tasks ya cubren cualquier fila sin importar si tiene parent_task_id o no.

alter table sd_tasks add column if not exists parent_task_id uuid references sd_tasks(id) on delete cascade;
create index if not exists idx_sd_tasks_parent on sd_tasks(parent_task_id);
