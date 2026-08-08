-- Operaciones S&D: los adjuntos de tareas dejan de ser públicos.
-- A partir de ahora solo se pueden ver/descargar estando logueado en la app y con acceso
-- a la tarea (internos: acceso total; externos: solo si tienen sd_external_access sobre
-- el proyecto/tarea del adjunto).

update storage.buckets set public = false where id = 'sd-attachments';

-- Lectura: el path de cada objeto es "{task_id}/{archivo}", así que el primer segmento
-- de la ruta (storage.foldername) es el id de la tarea.
create policy sd_attachments_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'sd-attachments'
    and (
      not sd_is_external_current()
      or exists (
        select 1 from sd_tasks t
        where t.id::text = (storage.foldername(name))[1]
          and sd_has_task_access(t.project_id, t.id)
      )
    )
  );
