# Operaciones S&D

Sección de seguimiento operativo del equipo de ingenieros, integrada 100% con Proyectos & Kanban,
Capacity Plan y Gestión de Recursos. Filosofía: **menos campos, más automatización**.

## Módulos

- **Proyectos** (`SDProjectsPanel`) — tarjetas de los proyectos ya existentes en Proyecto & Kanban
  (nombre, código, cliente, responsable, estado) con el conteo de tareas por estado.
- **Kanban** (`SDKanbanBoard`) — tablero de 3 columnas (Backlog / In Progress / Done) por proyecto,
  con drag & drop (`@dnd-kit`).
- **Calendario** (`SDCalendarView`) — Hoy / Semana / 2 Semanas / 3 Semanas / Mes, con drag & drop
  para reprogramar (siempre pide justificación).
- **Dashboard** (`SDDashboardPanel`) — KPIs (Backlog/WIP/Done, horas semana/mes, vencidas, críticas,
  bloqueadas, vendor support, Lead Time, Cycle Time) + gráfico de horas por semana.
- **Mi Espacio** (`SDMiEspacio`) — vista personal, se abre solo por acción explícita del usuario
  (botón "Mi Espacio" en el header, nunca automático). Muestra tareas propias de hoy/semana,
  vencidas y bloqueadas, horas propias (hoy/semana/mes), y permite registrar horas, comentar,
  bloquear/desbloquear, reprogramar y finalizar tareas — **nunca crear tareas nuevas**.

## Modelo de datos (Supabase / Postgres)

Todas las tablas nuevas usan el prefijo `sd_`. Ver los archivos en `supabase/migrations/`:

1. `20260807_operaciones_sd_schema.sql` — tablas base (`sd_tasks`, checklist, horas, dependencias,
   bloqueos, comentarios, adjuntos, acceso externo) + columnas aditivas en `team_members` y
   `capacity_assignments` + bucket de Storage `sd-attachments`.
2. `20260807_operaciones_sd_rls.sql` — Row Level Security: acceso total para internos, solo
   lectura acotada por proyecto/tarea para usuarios externos (`sd_external_access`), y policies
   *restrictive* que blindan tablas ya existentes (`projects`, `capacity_assignments`, `expenses`,
   etc.) contra usuarios externos.
3. `20260807_operaciones_sd_business_rules.sql` — `started_at` (para Cycle Time), `sd_audit_log`
   (auditoría, nunca se borra) y `sd_notifications`.

Aplicar los tres en orden vía Supabase (dashboard SQL editor, CLI o MCP). El archivo 2 trae una
advertencia al inicio: hay que confirmar el estado de RLS en las tablas existentes antes de correrlo.

## Reglas de negocio automáticas (`utils/sdHelpers.ts`)

- Código de tarea: `{opportunityNumber}-SD-{n}`, secuencial por proyecto (mismo criterio que
  Control de Cambios con `-CC-{n}`).
- Backlog → In Progress automático al llegar la Fecha Planificada (evaluado al entrar a la
  sección; no hay jobs en background, sigue el mismo enfoque "todo client-side" del resto de la app).
- Nunca se mueve a Done automáticamente; requiere responsable/administrador y ≥1 hora cargada.
- Reprogramar la Fecha Planificada exige justificación y queda en `sd_task_date_history`; si la
  nueva fecha es futura, la tarea vuelve a Backlog.
- % de checklist automático (editable manualmente, con override persistente).
- Métricas: Lead Time, Cycle Time, Tiempo en Backlog/WIP/Bloqueado, Desviación de Fechas,
  Desviación de Horas, Cumplimiento y Riesgo (compuesto por prioridad + severidad + vendor support
  + bloqueos + dependencias sin resolver + retraso).
- Auditoría (`sd_audit_log`) y notificaciones (`sd_notifications`) descriptas en el código de
  `hooks/useOperacionesSDData.ts`.

## Integración con Capacity Plan

Cargar horas en una tarea (`sd_task_time_entries`) inserta automáticamente una fila espejo en
`capacity_assignments` (`type: 'project'`, `project_id` de la tarea, `source: 'operaciones_sd'`,
`sd_time_entry_id` como link). Capacity Plan la muestra sin cambios de lógica; `Capacity.tsx` solo
bloquea la edición manual de esas filas específicas (hay que editarlas desde la tarea).

## Roles y acceso externo

`team_members.sd_role`: `null` (Observador, default), `'responsable'`, `'administrador'`. El email
super-admin hardcodeado del resto de la app también es administrador de esta sección.
Usuarios externos (`team_members.is_external = true`) solo ven Operaciones S&D (gating en
`App.tsx`/`Sidebar.tsx`), en modo lectura, acotados a lo que se les otorgue en `sd_external_access`
(gestionable desde Gestión de Recursos → "Accesos Externos").

La jerarquía Administrador/Responsable/Observador se exige tanto en el frontend
(`canManageTask`/`canFinishTask` en `utils/sdHelpers.ts`) como en la base de datos: las policies de
escritura sobre las tablas `sd_*` requieren `sd_can_manage_current()` (administrador o responsable),
y otorgar/revocar acceso externo requiere específicamente `sd_is_admin_current()`
(`supabase/migrations/20260809_operaciones_sd_role_enforcement.sql`).

## Decisiones de arquitectura que se mantuvieron a propósito

- **Sin capa de Repository / Clean Architecture formal**: el resto de la app llama a
  `supabase-js` directo desde cada vista/hook (confirmado como patrón deliberado). Introducir una
  capa de repositorios solo para este módulo generaría inconsistencia; no se hizo.
- **Sin backend propio (Express/Prisma/Docker)**: Supabase ya provee Postgres + Auth (JWT) + RLS +
  Storage. Agregar un backend Node paralelo implicaría rearquitecturar toda la app, contradiciendo
  el pedido explícito de no tocar la arquitectura existente.
- **Sin motor de IA**: por pedido explícito, no hay ninguna funcionalidad de "IA" en esta sección
  (ni sugerencias automáticas ni resúmenes generados).

## Pruebas

`utils/sdHelpers.test.ts` cubre las funciones puras de reglas de negocio (roles, generación de
código, checklist, horas, vencimientos, Lead/Cycle Time, cumplimiento, riesgo) con Vitest.

```bash
npm test
```

## Datos de prueba

`supabase/seed_operaciones_sd_demo.sql` (no se aplica solo, es opcional) inserta un proyecto de
ejemplo con un puñado de tareas en distintos estados para probar la sección manualmente.
