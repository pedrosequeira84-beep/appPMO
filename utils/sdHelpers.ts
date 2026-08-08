import { SDBlock, SDChecklistItem, SDCompliance, SDDateHistoryEntry, SDDependency, SDRiskLevel, SDTask, SDTimeEntry, TeamMember } from '../types';
import { getDaysDiff } from './timelineExport';

export const SD_ADMIN_EMAIL = 'pedro.sequeira@bghtechpartner.com';

export type SDEffectiveRole = 'administrador' | 'responsable' | 'observador';

export function getEffectiveSdRole(member: TeamMember | null, userEmail?: string | null): SDEffectiveRole {
  if (userEmail && userEmail.toLowerCase() === SD_ADMIN_EMAIL.toLowerCase()) return 'administrador';
  if (member?.sdRole === 'administrador') return 'administrador';
  if (member?.sdRole === 'responsable') return 'responsable';
  return 'observador';
}

export function canManageTask(role: SDEffectiveRole): boolean {
  return role === 'administrador' || role === 'responsable';
}

export function generateSDTaskCode(opportunityNumber: string | undefined, existingTasksForProject: SDTask[]): string {
  const base = opportunityNumber || 'S/N';
  const count = existingTasksForProject.length;
  return `${base}-SD-${count + 1}`;
}

export function generateSDSubtaskCode(parentCode: string, existingSubtasksForParent: SDTask[]): string {
  return `${parentCode}.${existingSubtasksForParent.length + 1}`;
}

export function computeChecklistProgress(items: SDChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter(i => i.isDone).length;
  return Math.round((done / items.length) * 100);
}

export function sumTaskHours(entries: SDTimeEntry[], taskId: string): number {
  return entries.filter(e => e.taskId === taskId).reduce((s, e) => s + (Number(e.hours) || 0), 0);
}

export function hoursDeviation(estimatedHours: number | null, actualHours: number): number {
  if (estimatedHours === null || estimatedHours === undefined) return 0;
  return actualHours - estimatedHours;
}

export function isTaskOverdue(task: SDTask): boolean {
  if (task.status === 'done' || !task.plannedDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return task.plannedDate < today;
}

/** Backlog -> In Progress automático al llegar la Fecha Planificada. Nunca mueve a Done. */
export function shouldAutoStartTask(task: SDTask): boolean {
  if (task.status !== 'backlog' || !task.plannedDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return task.plannedDate <= today;
}

export function canFinishTask(task: SDTask, entries: SDTimeEntry[], role: SDEffectiveRole, currentMemberId?: string | null): { allowed: boolean; reason?: string } {
  if (role !== 'administrador' && task.assigneeMemberId !== currentMemberId) {
    return { allowed: false, reason: 'Solo el responsable de la tarea (o un Administrador) puede finalizarla.' };
  }
  const hasHours = entries.some(e => e.taskId === task.id);
  if (!hasHours) {
    return { allowed: false, reason: 'No se puede finalizar sin al menos un registro de horas cargado.' };
  }
  return { allowed: true };
}

export const SD_PRIORITIES = ['Baja', 'Media', 'Alta', 'Crítica'] as const;
export const SD_SEVERITIES = ['Baja', 'Media', 'Alta', 'Crítica'] as const;

export function priorityBadgeClass(priority?: string | null): string {
  switch (priority) {
    case 'Crítica': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'Alta': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    case 'Media': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    default: return 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 border-gray-200 dark:border-slate-700';
  }
}

export function severityBadgeClass(severity?: string | null): string {
  switch (severity) {
    case 'Crítica': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    case 'Alta': return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30';
    case 'Media': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30';
    default: return 'bg-gray-50 text-gray-500 dark:bg-slate-800/50 dark:text-gray-500 border-gray-100 dark:border-slate-700';
  }
}

// ---------------------------------------------------------------------------
// Reglas de Negocio e Inteligencia: métricas automáticas
// ---------------------------------------------------------------------------

export function daysOverdue(task: SDTask): number {
  if (!isTaskOverdue(task)) return 0;
  return getDaysDiff(task.plannedDate, new Date().toISOString());
}

/** Lead Time: desde que se crea la tarea hasta que se finaliza. null si aún no está Done. */
export function computeLeadTimeDays(task: SDTask): number | null {
  if (!task.completedAt) return null;
  return getDaysDiff(task.createdAt, task.completedAt);
}

/** Cycle Time: desde que pasa a In Progress hasta que se finaliza (trabajo activo real). */
export function computeCycleTimeDays(task: SDTask): number | null {
  if (!task.completedAt || !task.startedAt) return null;
  return getDaysDiff(task.startedAt, task.completedAt);
}

/** Tiempo en Backlog: desde que se crea hasta que arranca (o hasta hoy si nunca arrancó). */
export function computeBacklogTimeDays(task: SDTask): number {
  const end = task.startedAt || task.completedAt || new Date().toISOString();
  return getDaysDiff(task.createdAt, end);
}

/** Tiempo en WIP: desde que arranca hasta que finaliza (o hasta hoy si sigue en curso). null si nunca arrancó. */
export function computeWipTimeDays(task: SDTask): number | null {
  if (!task.startedAt) return null;
  const end = task.completedAt || new Date().toISOString();
  return getDaysDiff(task.startedAt, end);
}

/** Tiempo bloqueado acumulado: suma de la duración de cada bloqueo (resuelto o vigente) de la tarea. */
export function computeBlockedTimeDays(taskId: string, blocks: SDBlock[]): number {
  return blocks
    .filter(b => b.taskId === taskId)
    .reduce((sum, b) => sum + Math.max(0, getDaysDiff(b.createdAt, b.resolvedAt || new Date().toISOString())), 0);
}

/** Desviación de fechas: suma de corrimientos (en días) de la Fecha Planificada a lo largo de la vida de la tarea. */
export function computeDateDeviationDays(taskId: string, dateHistory: SDDateHistoryEntry[]): number {
  return dateHistory
    .filter(h => h.taskId === taskId)
    .reduce((sum, h) => sum + Math.max(0, getDaysDiff(h.previousDate, h.newDate)), 0);
}

/** Cumplimiento respecto de la Fecha Compromiso. */
export function computeCompliance(task: SDTask): SDCompliance {
  if (!task.commitmentDate) return 'Sin Compromiso';
  const today = new Date().toISOString().split('T')[0];
  if (task.status === 'done') {
    const doneDate = (task.completedAt || '').split('T')[0];
    return doneDate && doneDate <= task.commitmentDate ? 'Cumplida' : 'Incumplida';
  }
  if (today > task.commitmentDate) return 'Incumplida';
  return getDaysDiff(today, task.commitmentDate) <= 2 ? 'En Riesgo' : 'Cumplida';
}

const priorityScore = (p?: string | null) => p === 'Crítica' ? 3 : p === 'Alta' ? 2 : p === 'Media' ? 1 : 0;
const severityScore = (s?: string | null) => s === 'Crítica' ? 3 : s === 'Alta' ? 2 : s === 'Media' ? 1 : 0;

/** Riesgo compuesto: prioridad + severidad + vendor support + bloqueos + dependencias sin resolver + retraso. */
export function computeTaskRisk(task: SDTask, dependencies: SDDependency[], tasksById: Record<string, SDTask>): { score: number; level: SDRiskLevel } {
  let score = priorityScore(task.priority) + severityScore(task.severity);
  if (task.vendorSupportRequired) score += 1;
  if (task.blocked) score += 3;

  const unresolvedDeps = dependencies.filter(d => d.taskId === task.id && tasksById[d.dependsOnTaskId]?.status !== 'done');
  score += Math.min(unresolvedDeps.length, 2);

  if (task.status !== 'done' && isTaskOverdue(task)) {
    score += daysOverdue(task) > 7 ? 3 : 2;
  }

  let level: SDRiskLevel = 'Bajo';
  if (score >= 8) level = 'Crítico';
  else if (score >= 5) level = 'Alto';
  else if (score >= 3) level = 'Medio';
  return { score, level };
}

export function riskBadgeClass(level: SDRiskLevel): string {
  switch (level) {
    case 'Crítico': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
    case 'Alto': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
    case 'Medio': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    default: return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30';
  }
}

export function complianceBadgeClass(c: SDCompliance): string {
  switch (c) {
    case 'Cumplida': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30';
    case 'En Riesgo': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30';
    case 'Incumplida': return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30';
    default: return 'bg-gray-50 text-gray-500 dark:bg-slate-800/50 dark:text-gray-500 border-gray-100 dark:border-slate-700';
  }
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}
