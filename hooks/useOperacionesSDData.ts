import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { supabase } from '../utils/supabase';
import {
  SDTask, SDChecklistItem, SDChecklistTemplateItem, SDTimeEntry, SDDateHistoryEntry,
  SDDependency, SDBlock, SDComment, SDAttachment, SDExternalAccess, SDWorkType,
  SDAuditEntry, SDNotification, SDNotificationType,
  DBSDTask, DBSDChecklistItem, DBSDChecklistTemplateItem, DBSDTimeEntry, DBSDDateHistoryEntry,
  DBSDDependency, DBSDBlock, DBSDComment, DBSDAttachment, DBSDExternalAccess,
  DBSDAuditEntry, DBSDNotification
} from '../types';
import {
  generateSDTaskCode, generateSDSubtaskCode, shouldAutoStartTask, getEffectiveSdRole, canFinishTask,
  computeChecklistProgress
} from '../utils/sdHelpers';

const mapTask = (t: DBSDTask): SDTask => ({
  id: t.id, code: t.code, projectId: t.project_id, parentTaskId: t.parent_task_id || null, workType: t.work_type as SDWorkType,
  title: t.title, description: t.description || '', assigneeMemberId: t.assignee_member_id,
  status: t.status as any, plannedDate: t.planned_date, commitmentDate: t.commitment_date,
  estimatedHours: t.estimated_hours, priority: t.priority as any, severity: t.severity as any,
  tags: t.tags || [], vendorSupportRequired: t.vendor_support_required, vendorName: t.vendor_name,
  vendorTicketNumber: t.vendor_ticket_number, progressPercent: t.progress_percent,
  progressManualOverride: t.progress_manual_override, blocked: t.blocked, blockedReason: t.blocked_reason,
  createdBy: t.created_by, createdAt: t.created_at, updatedAt: t.updated_at, completedAt: t.completed_at
});
const mapChecklistItem = (i: DBSDChecklistItem): SDChecklistItem => ({
  id: i.id, taskId: i.task_id, label: i.label, isDone: i.is_done, sortOrder: i.sort_order, createdAt: i.created_at
});
const mapTemplate = (t: DBSDChecklistTemplateItem): SDChecklistTemplateItem => ({
  id: t.id, workType: t.work_type as SDWorkType, label: t.label, sortOrder: t.sort_order
});
const mapTimeEntry = (e: DBSDTimeEntry): SDTimeEntry => ({
  id: e.id, taskId: e.task_id, memberId: e.member_id, date: e.date, hours: e.hours,
  comment: e.comment, capacityAssignmentId: e.capacity_assignment_id, createdAt: e.created_at
});
const mapDateHistory = (h: DBSDDateHistoryEntry): SDDateHistoryEntry => ({
  id: h.id, taskId: h.task_id, previousDate: h.previous_date, newDate: h.new_date,
  memberId: h.member_id, reason: h.reason, changedAt: h.changed_at
});
const mapDependency = (d: DBSDDependency): SDDependency => ({
  id: d.id, taskId: d.task_id, dependsOnTaskId: d.depends_on_task_id, createdAt: d.created_at
});
const mapBlock = (b: DBSDBlock): SDBlock => ({
  id: b.id, taskId: b.task_id, description: b.description, createdBy: b.created_by,
  createdAt: b.created_at, resolvedAt: b.resolved_at, resolvedBy: b.resolved_by
});
const mapComment = (c: DBSDComment): SDComment => ({
  id: c.id, taskId: c.task_id, memberId: c.member_id, body: c.body, createdAt: c.created_at
});
const mapAttachment = (a: DBSDAttachment): SDAttachment => ({
  id: a.id, taskId: a.task_id, fileName: a.file_name, fileUrl: a.file_url,
  uploadedBy: a.uploaded_by, uploadedAt: a.uploaded_at
});
const mapExternalAccess = (a: DBSDExternalAccess): SDExternalAccess => ({
  id: a.id, memberId: a.member_id, projectId: a.project_id, taskId: a.task_id,
  grantedBy: a.granted_by, grantedAt: a.granted_at
});
const mapAuditEntry = (a: DBSDAuditEntry): SDAuditEntry => ({
  id: a.id, taskId: a.task_id, memberId: a.member_id, fieldName: a.field_name,
  oldValue: a.old_value, newValue: a.new_value, changedAt: a.changed_at
});
const mapNotification = (n: DBSDNotification): SDNotification => ({
  id: n.id, memberId: n.member_id, type: n.type as SDNotificationType, taskId: n.task_id,
  message: n.message, isRead: n.is_read, createdAt: n.created_at
});

export interface NewSDTaskInput {
  projectId: string;
  parentTaskId?: string | null;
  workType: SDWorkType;
  title: string;
  description?: string;
  assigneeMemberId: string | null;
  plannedDate: string | null;
  commitmentDate: string | null;
  estimatedHours: number | null;
  priority: string | null;
  severity: string | null;
  tags: string[];
  vendorSupportRequired: boolean;
  vendorName?: string;
  vendorTicketNumber?: string;
}

export function useOperacionesSDData() {
  const { user, team, projects, currentUserMember, showToast, setCapacityData } = useApp();

  const [tasks, setTasks] = useState<SDTask[]>([]);
  const [checklistItems, setChecklistItems] = useState<SDChecklistItem[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<SDChecklistTemplateItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<SDTimeEntry[]>([]);
  const [dateHistory, setDateHistory] = useState<SDDateHistoryEntry[]>([]);
  const [dependencies, setDependencies] = useState<SDDependency[]>([]);
  const [blocks, setBlocks] = useState<SDBlock[]>([]);
  const [comments, setComments] = useState<SDComment[]>([]);
  const [attachments, setAttachments] = useState<SDAttachment[]>([]);
  const [externalAccess, setExternalAccess] = useState<SDExternalAccess[]>([]);
  const [auditLog, setAuditLog] = useState<SDAuditEntry[]>([]);
  const [notifications, setNotifications] = useState<SDNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole = getEffectiveSdRole(currentUserMember, user?.email);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tasksRes, itemsRes, templatesRes, entriesRes, historyRes, depsRes, blocksRes, commentsRes, attachmentsRes, accessRes, auditRes, notifRes] = await Promise.all([
        supabase.from('sd_tasks').select('*'),
        supabase.from('sd_task_checklist_items').select('*'),
        supabase.from('sd_checklist_templates').select('*'),
        supabase.from('sd_task_time_entries').select('*'),
        supabase.from('sd_task_date_history').select('*'),
        supabase.from('sd_task_dependencies').select('*'),
        supabase.from('sd_task_blocks').select('*'),
        supabase.from('sd_task_comments').select('*'),
        supabase.from('sd_task_attachments').select('*'),
        supabase.from('sd_external_access').select('*'),
        supabase.from('sd_audit_log').select('*'),
        supabase.from('sd_notifications').select('*').order('created_at', { ascending: false }),
      ]);
      if (tasksRes.data) setTasks(tasksRes.data.map(mapTask));
      if (itemsRes.data) setChecklistItems(itemsRes.data.map(mapChecklistItem));
      if (templatesRes.data) setChecklistTemplates(templatesRes.data.map(mapTemplate));
      if (entriesRes.data) setTimeEntries(entriesRes.data.map(mapTimeEntry));
      if (historyRes.data) setDateHistory(historyRes.data.map(mapDateHistory));
      if (depsRes.data) setDependencies(depsRes.data.map(mapDependency));
      if (blocksRes.data) setBlocks(blocksRes.data.map(mapBlock));
      if (commentsRes.data) setComments(commentsRes.data.map(mapComment));
      if (attachmentsRes.data) setAttachments(attachmentsRes.data.map(mapAttachment));
      if (accessRes.data) setExternalAccess(accessRes.data.map(mapExternalAccess));
      if (auditRes.data) setAuditLog(auditRes.data.map(mapAuditEntry));
      if (notifRes.data) setNotifications(notifRes.data.map(mapNotification));
    } catch (err: any) {
      showToast('Error cargando Operaciones S&D: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Backlog -> In Progress automático al llegar la Fecha Planificada (nunca a Done).
  useEffect(() => {
    if (loading) return;
    const toStart = tasks.filter(shouldAutoStartTask);
    if (toStart.length === 0) return;
    const ids = toStart.map(t => t.id);
    const nowIso = new Date().toISOString();
    supabase.from('sd_tasks').update({ status: 'in_progress', started_at: nowIso }).in('id', ids).then(({ error }) => {
      if (!error) setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'in_progress', startedAt: nowIso } : t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Auditoría: registra Usuario/Fecha/Valor anterior/Valor nuevo. Nunca se borra.
  const logAudit = useCallback(async (taskId: string, fieldName: string, oldValue: unknown, newValue: unknown) => {
    const oldStr = oldValue === null || oldValue === undefined ? null : String(oldValue);
    const newStr = newValue === null || newValue === undefined ? null : String(newValue);
    if (oldStr === newStr) return;
    try {
      const { data, error } = await supabase.from('sd_audit_log').insert([{
        task_id: taskId, member_id: currentUserMember?.id || null, field_name: fieldName,
        old_value: oldStr, new_value: newStr
      }]).select();
      if (!error && data) setAuditLog(prev => [mapAuditEntry(data[0]), ...prev]);
    } catch {
      // La auditoría nunca debe bloquear la operación principal.
    }
  }, [currentUserMember]);

  // Notificaciones: Asignación, Cambio de fecha, Comentario, Bloqueo, Vendor Support, Próxima a vencer, Dependencia resuelta.
  const notify = useCallback(async (memberId: string | null | undefined, type: SDNotificationType, taskId: string | null, message: string) => {
    if (!memberId || memberId === currentUserMember?.id) return; // no autonotificarse
    try {
      // Se notifica a OTRO usuario: no se agrega al estado local (esa lista es solo la del usuario actual).
      await supabase.from('sd_notifications').insert([{ member_id: memberId, type, task_id: taskId, message }]);
    } catch {
      // Las notificaciones nunca deben bloquear la operación principal.
    }
  }, [currentUserMember]);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await supabase.from('sd_notifications').update({ is_read: true }).eq('id', id);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await supabase.from('sd_notifications').update({ is_read: true }).in('id', unreadIds);
  }, [notifications]);

  // Tarea próxima a vencer (dentro de los próximos 2 días): se evalúa para las tareas propias al entrar a la sección.
  useEffect(() => {
    if (loading || !currentUserMember) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 2);
    const soonStr = soon.toISOString().split('T')[0];

    const dueSoon = tasks.filter(t =>
      t.assigneeMemberId === currentUserMember.id && t.status !== 'done' && t.plannedDate &&
      t.plannedDate >= todayStr && t.plannedDate <= soonStr
    );
    const alreadyNotifiedToday = new Set(
      notifications.filter(n => n.type === 'due_soon' && n.createdAt.split('T')[0] === todayStr).map(n => n.taskId)
    );
    const toNotify = dueSoon.filter(t => !alreadyNotifiedToday.has(t.id));
    toNotify.forEach(async t => {
      try {
        const { data, error } = await supabase.from('sd_notifications').insert([{
          member_id: currentUserMember.id, type: 'due_soon', task_id: t.id,
          message: `La tarea ${t.code} — "${t.title}" vence pronto (${t.plannedDate}).`
        }]).select();
        if (!error && data) setNotifications(prev => [mapNotification(data[0]), ...prev]);
      } catch { /* no bloqueante */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tasks, currentUserMember]);

  const createTask = useCallback(async (input: NewSDTaskInput): Promise<SDTask | null> => {
    const parentTask = input.parentTaskId ? tasks.find(t => t.id === input.parentTaskId) : null;
    let code: string;
    if (parentTask) {
      const existingSubtasks = tasks.filter(t => t.parentTaskId === parentTask.id);
      code = generateSDSubtaskCode(parentTask.code, existingSubtasks);
    } else {
      const project = projects.find(p => p.id === input.projectId);
      const existingForProject = tasks.filter(t => t.projectId === input.projectId && !t.parentTaskId);
      code = generateSDTaskCode(project?.opportunityNumber, existingForProject);
    }
    try {
      const { data, error } = await supabase.from('sd_tasks').insert([{
        code, project_id: input.projectId, parent_task_id: input.parentTaskId || null,
        work_type: input.workType, title: input.title,
        description: input.description || null, assignee_member_id: input.assigneeMemberId,
        status: 'backlog', planned_date: input.plannedDate, commitment_date: input.commitmentDate,
        estimated_hours: input.estimatedHours, priority: input.priority, severity: input.severity,
        tags: input.tags, vendor_support_required: input.vendorSupportRequired,
        vendor_name: input.vendorSupportRequired ? (input.vendorName || null) : null,
        vendor_ticket_number: input.vendorSupportRequired ? (input.vendorTicketNumber || null) : null,
        created_by: currentUserMember?.id || user?.email || null
      }]).select();
      if (error) throw error;
      const newTask = mapTask(data[0]);
      setTasks(prev => [newTask, ...prev]);

      const templateRows = checklistTemplates.filter(ct => ct.workType === input.workType);
      if (templateRows.length > 0) {
        const rows = templateRows.map(ti => ({ task_id: newTask.id, label: ti.label, sort_order: ti.sortOrder }));
        const { data: itemsData } = await supabase.from('sd_task_checklist_items').insert(rows).select();
        if (itemsData) setChecklistItems(prev => [...prev, ...itemsData.map(mapChecklistItem)]);
      }
      if (input.assigneeMemberId) {
        notify(input.assigneeMemberId, 'assignment', newTask.id, `Te asignaron la tarea ${code} — "${newTask.title}".`);
      }
      if (input.vendorSupportRequired && input.assigneeMemberId) {
        notify(input.assigneeMemberId, 'vendor_support', newTask.id, `La tarea ${code} requiere Vendor Support (${input.vendorName || 'fabricante sin especificar'}).`);
      }
      showToast(`Tarea creada: ${code}`, 'success');
      return newTask;
    } catch (err: any) {
      showToast('Error creando tarea: ' + err.message, 'error');
      return null;
    }
  }, [projects, tasks, checklistTemplates, currentUserMember, user, notify]);

  /** Subtarea rápida: hereda proyecto y tipo de trabajo de la tarea padre, solo pide título. */
  const createSubtask = useCallback(async (parentTask: SDTask, title: string): Promise<SDTask | null> => {
    return createTask({
      projectId: parentTask.projectId, parentTaskId: parentTask.id, workType: parentTask.workType,
      title, assigneeMemberId: parentTask.assigneeMemberId, plannedDate: null, commitmentDate: null,
      estimatedHours: null, priority: parentTask.priority, severity: parentTask.severity,
      tags: [], vendorSupportRequired: false
    });
  }, [createTask]);

  const updateTaskFields = useCallback(async (taskId: string, patch: Partial<{
    title: string; description: string; workType: SDWorkType; assigneeMemberId: string | null;
    commitmentDate: string | null; estimatedHours: number | null; priority: string | null;
    severity: string | null; tags: string[]; vendorSupportRequired: boolean; vendorName: string | null;
    vendorTicketNumber: string | null;
  }>) => {
    const dbPatch: Record<string, any> = { updated_at: new Date().toISOString() };
    if ('title' in patch) dbPatch.title = patch.title;
    if ('description' in patch) dbPatch.description = patch.description;
    if ('workType' in patch) dbPatch.work_type = patch.workType;
    if ('assigneeMemberId' in patch) dbPatch.assignee_member_id = patch.assigneeMemberId;
    if ('commitmentDate' in patch) dbPatch.commitment_date = patch.commitmentDate;
    if ('estimatedHours' in patch) dbPatch.estimated_hours = patch.estimatedHours;
    if ('priority' in patch) dbPatch.priority = patch.priority;
    if ('severity' in patch) dbPatch.severity = patch.severity;
    if ('tags' in patch) dbPatch.tags = patch.tags;
    if ('vendorSupportRequired' in patch) dbPatch.vendor_support_required = patch.vendorSupportRequired;
    if ('vendorName' in patch) dbPatch.vendor_name = patch.vendorName;
    if ('vendorTicketNumber' in patch) dbPatch.vendor_ticket_number = patch.vendorTicketNumber;
    const task = tasks.find(t => t.id === taskId);
    try {
      const { error } = await supabase.from('sd_tasks').update(dbPatch).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } as SDTask : t));

      if (task) {
        (Object.keys(patch) as (keyof typeof patch)[]).forEach(key => {
          logAudit(taskId, key, (task as any)[key], (patch as any)[key]);
        });
        if ('assigneeMemberId' in patch && patch.assigneeMemberId && patch.assigneeMemberId !== task.assigneeMemberId) {
          notify(patch.assigneeMemberId, 'assignment', taskId, `Te asignaron la tarea ${task.code} — "${task.title}".`);
        }
        if ('vendorSupportRequired' in patch && patch.vendorSupportRequired && !task.vendorSupportRequired) {
          notify(task.assigneeMemberId, 'vendor_support', taskId, `La tarea ${task.code} ahora requiere Vendor Support.`);
        }
      }
      showToast('Tarea actualizada', 'success');
    } catch (err: any) {
      showToast('Error actualizando tarea: ' + err.message, 'error');
    }
  }, [tasks, logAudit, notify]);

  const moveTaskStatus = useCallback(async (taskId: string, status: 'backlog' | 'in_progress') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    const willStart = status === 'in_progress' && !task.startedAt;
    if (willStart) patch.started_at = new Date().toISOString();
    try {
      const { error } = await supabase.from('sd_tasks').update(patch).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, startedAt: willStart ? patch.started_at : t.startedAt } : t));
      logAudit(taskId, 'status', task.status, status);
    } catch (err: any) {
      showToast('Error moviendo tarea: ' + err.message, 'error');
    }
  }, [tasks, logAudit]);

  const finishTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const check = canFinishTask(task, timeEntries, effectiveRole, currentUserMember?.id);
    if (!check.allowed) { showToast(check.reason || 'No se puede finalizar la tarea', 'error'); return; }
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('sd_tasks').update({ status: 'done', completed_at: nowIso, updated_at: nowIso }).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done', completedAt: nowIso } : t));
      logAudit(taskId, 'status', task.status, 'done');

      // Dependencia resuelta: avisar a los responsables de las tareas que dependían de ésta.
      const dependents = dependencies.filter(d => d.dependsOnTaskId === taskId);
      dependents.forEach(dep => {
        const dependentTask = tasks.find(t => t.id === dep.taskId);
        if (dependentTask) {
          notify(dependentTask.assigneeMemberId, 'dependency_resolved', dependentTask.id, `Se resolvió la dependencia "${task.code}" de tu tarea ${dependentTask.code}.`);
        }
      });
      showToast('Tarea finalizada', 'success');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, [tasks, timeEntries, effectiveRole, currentUserMember, dependencies, logAudit, notify]);

  const changePlannedDate = useCallback(async (taskId: string, newDate: string, reason: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!reason || !reason.trim()) { showToast('La justificación es obligatoria para reprogramar la fecha', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];
    const isFuture = newDate > today;
    const newStatus = isFuture ? 'backlog' : task.status;
    try {
      const { error: updErr } = await supabase.from('sd_tasks').update({
        planned_date: newDate, status: newStatus, updated_at: new Date().toISOString()
      }).eq('id', taskId);
      if (updErr) throw updErr;
      const { data: histData, error: histErr } = await supabase.from('sd_task_date_history').insert([{
        task_id: taskId, previous_date: task.plannedDate, new_date: newDate,
        member_id: currentUserMember?.id || null, reason
      }]).select();
      if (histErr) throw histErr;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, plannedDate: newDate, status: newStatus } : t));
      if (histData) setDateHistory(prev => [mapDateHistory(histData[0]), ...prev]);
      notify(task.assigneeMemberId, 'date_change', taskId, `Se reprogramó la Fecha Planificada de ${task.code} a ${newDate}. Motivo: ${reason}`);
      showToast('Fecha planificada actualizada' + (isFuture ? ' — la tarea volvió a Backlog' : ''), 'success');
    } catch (err: any) {
      showToast('Error reprogramando: ' + err.message, 'error');
    }
  }, [tasks, currentUserMember, notify]);

  const logHours = useCallback(async (taskId: string, memberId: string, date: string, hours: number, comment: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!hours || hours <= 0) { showToast('Las horas deben ser mayores a cero', 'error'); return; }
    const member = team.find(t => t.id === memberId);
    try {
      const { data: entryData, error: entryErr } = await supabase.from('sd_task_time_entries').insert([{
        task_id: taskId, member_id: memberId, date, hours, comment: comment || null
      }]).select();
      if (entryErr) throw entryErr;
      const entryRow = entryData[0] as DBSDTimeEntry;

      const observations = `[S&D ${task.code}] ${comment || ''}`.trim();
      const capacityPayload = {
        member_id: memberId, user_email: member?.email || user?.email, date, week_start: date,
        type: 'project', project_id: task.projectId, hours, observations,
        week_key: null, source: 'operaciones_sd', sd_time_entry_id: entryRow.id
      };
      const { data: capData, error: capErr } = await supabase.from('capacity_assignments').insert([capacityPayload]).select();
      if (capErr) throw capErr;

      await supabase.from('sd_task_time_entries').update({ capacity_assignment_id: capData[0].id }).eq('id', entryRow.id);

      setTimeEntries(prev => [mapTimeEntry({ ...entryRow, capacity_assignment_id: capData[0].id }), ...prev]);
      setCapacityData(prev => ({
        assignments: [{
          id: capData[0].id, memberId, type: 'project', projectId: task.projectId, date,
          hours, observations, isExtra: false, source: 'operaciones_sd', sdTimeEntryId: entryRow.id
        }, ...prev.assignments]
      }));
      showToast('Horas registradas — reflejadas en Capacity Plan', 'success');
    } catch (err: any) {
      showToast('Error registrando horas: ' + err.message, 'error');
    }
  }, [tasks, team, user, setCapacityData]);

  const deleteTimeEntry = useCallback(async (entryId: string) => {
    const entry = timeEntries.find(e => e.id === entryId);
    if (!entry) return;
    try {
      const { error } = await supabase.from('sd_task_time_entries').delete().eq('id', entryId);
      if (error) throw error;
      if (entry.capacityAssignmentId) {
        await supabase.from('capacity_assignments').delete().eq('id', entry.capacityAssignmentId);
        setCapacityData(prev => ({ assignments: prev.assignments.filter(a => a.id !== entry.capacityAssignmentId) }));
      }
      setTimeEntries(prev => prev.filter(e => e.id !== entryId));
      showToast('Registro de horas eliminado', 'info');
    } catch (err: any) {
      showToast('Error eliminando horas: ' + err.message, 'error');
    }
  }, [timeEntries, setCapacityData]);

  const recomputeAutoProgress = useCallback(async (taskId: string, items: SDChecklistItem[]) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.progressManualOverride) return;
    const itemsForTask = items.filter(i => i.taskId === taskId);
    const pct = computeChecklistProgress(itemsForTask);
    await supabase.from('sd_tasks').update({ progress_percent: pct }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, progressPercent: pct } : t));
  }, [tasks]);

  const toggleChecklistItem = useCallback(async (itemId: string) => {
    const item = checklistItems.find(i => i.id === itemId);
    if (!item) return;
    const newDone = !item.isDone;
    try {
      const { error } = await supabase.from('sd_task_checklist_items').update({ is_done: newDone }).eq('id', itemId);
      if (error) throw error;
      const updated = checklistItems.map(i => i.id === itemId ? { ...i, isDone: newDone } : i);
      setChecklistItems(updated);
      await recomputeAutoProgress(item.taskId, updated);
      logAudit(item.taskId, `checklist:${item.label}`, item.isDone, newDone);
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, [checklistItems, recomputeAutoProgress, logAudit]);

  const addChecklistItem = useCallback(async (taskId: string, label: string) => {
    if (!label.trim()) return;
    try {
      const sortOrder = checklistItems.filter(i => i.taskId === taskId).length;
      const { data, error } = await supabase.from('sd_task_checklist_items').insert([{ task_id: taskId, label, sort_order: sortOrder }]).select();
      if (error) throw error;
      const updated = [...checklistItems, mapChecklistItem(data[0])];
      setChecklistItems(updated);
      await recomputeAutoProgress(taskId, updated);
    } catch (err: any) {
      showToast('Error agregando ítem: ' + err.message, 'error');
    }
  }, [checklistItems, recomputeAutoProgress]);

  const removeChecklistItem = useCallback(async (itemId: string) => {
    const item = checklistItems.find(i => i.id === itemId);
    if (!item) return;
    try {
      const { error } = await supabase.from('sd_task_checklist_items').delete().eq('id', itemId);
      if (error) throw error;
      const updated = checklistItems.filter(i => i.id !== itemId);
      setChecklistItems(updated);
      await recomputeAutoProgress(item.taskId, updated);
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, [checklistItems, recomputeAutoProgress]);

  const setManualProgress = useCallback(async (taskId: string, percent: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const task = tasks.find(t => t.id === taskId);
    try {
      const { error } = await supabase.from('sd_tasks').update({ progress_percent: clamped, progress_manual_override: true }).eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, progressPercent: clamped, progressManualOverride: true } : t));
      logAudit(taskId, 'progress_percent', task?.progressPercent, clamped);
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, [tasks, logAudit]);

  const addComment = useCallback(async (taskId: string, body: string) => {
    if (!body.trim()) return;
    try {
      const { data, error } = await supabase.from('sd_task_comments').insert([{ task_id: taskId, member_id: currentUserMember?.id || null, body }]).select();
      if (error) throw error;
      setComments(prev => [...prev, mapComment(data[0])]);
      const task = tasks.find(t => t.id === taskId);
      if (task) notify(task.assigneeMemberId, 'comment', taskId, `Nuevo comentario en ${task.code}: "${body.slice(0, 80)}"`);
    } catch (err: any) {
      showToast('Error agregando comentario: ' + err.message, 'error');
    }
  }, [currentUserMember, tasks, notify]);

  const addAttachment = useCallback(async (taskId: string, file: File) => {
    try {
      const path = `${taskId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('sd-attachments').upload(path, file);
      if (upErr) throw upErr;
      // El bucket es privado: se guarda el path de storage, no una URL pública fija.
      const { data, error } = await supabase.from('sd_task_attachments').insert([{
        task_id: taskId, file_name: file.name, file_url: path, uploaded_by: currentUserMember?.id || null
      }]).select();
      if (error) throw error;
      setAttachments(prev => [mapAttachment(data[0]), ...prev]);
      showToast('Adjunto subido', 'success');
    } catch (err: any) {
      showToast('Error subiendo adjunto: ' + err.message, 'error');
    }
  }, [currentUserMember]);

  /** Bucket privado: genera un link temporal válido por 60s, solo para el usuario logueado. */
  const getAttachmentUrl = useCallback(async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('sd-attachments').createSignedUrl(path, 60);
    if (error || !data) {
      showToast('Error abriendo adjunto: ' + (error?.message || ''), 'error');
      return null;
    }
    return data.signedUrl;
  }, []);

  const removeAttachment = useCallback(async (attachmentId: string) => {
    try {
      const { error } = await supabase.from('sd_task_attachments').delete().eq('id', attachmentId);
      if (error) throw error;
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, []);

  const addDependency = useCallback(async (taskId: string, dependsOnTaskId: string) => {
    if (taskId === dependsOnTaskId) return;
    try {
      const { data, error } = await supabase.from('sd_task_dependencies').insert([{ task_id: taskId, depends_on_task_id: dependsOnTaskId }]).select();
      if (error) throw error;
      setDependencies(prev => [...prev, mapDependency(data[0])]);
    } catch (err: any) {
      showToast('Error agregando dependencia: ' + err.message, 'error');
    }
  }, []);

  const removeDependency = useCallback(async (dependencyId: string) => {
    try {
      const { error } = await supabase.from('sd_task_dependencies').delete().eq('id', dependencyId);
      if (error) throw error;
      setDependencies(prev => prev.filter(d => d.id !== dependencyId));
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, []);

  const addBlock = useCallback(async (taskId: string, description: string) => {
    if (!description.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    try {
      const { data, error } = await supabase.from('sd_task_blocks').insert([{ task_id: taskId, description, created_by: currentUserMember?.id || null }]).select();
      if (error) throw error;
      setBlocks(prev => [mapBlock(data[0]), ...prev]);
      await supabase.from('sd_tasks').update({ blocked: true, blocked_reason: description }).eq('id', taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, blocked: true, blockedReason: description } : t));
      logAudit(taskId, 'blocked', task?.blocked ?? false, true);
      if (task) notify(task.assigneeMemberId, 'block', taskId, `Se bloqueó la tarea ${task.code}: "${description}"`);
    } catch (err: any) {
      showToast('Error registrando bloqueo: ' + err.message, 'error');
    }
  }, [currentUserMember, tasks, logAudit, notify]);

  const resolveBlock = useCallback(async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('sd_task_blocks').update({ resolved_at: nowIso, resolved_by: currentUserMember?.id || null }).eq('id', blockId);
      if (error) throw error;
      const updatedBlocks = blocks.map(b => b.id === blockId ? { ...b, resolvedAt: nowIso, resolvedBy: currentUserMember?.id || null } : b);
      setBlocks(updatedBlocks);
      const stillBlocked = updatedBlocks.some(b => b.taskId === block.taskId && !b.resolvedAt);
      if (!stillBlocked) {
        await supabase.from('sd_tasks').update({ blocked: false, blocked_reason: null }).eq('id', block.taskId);
        setTasks(prev => prev.map(t => t.id === block.taskId ? { ...t, blocked: false, blockedReason: null } : t));
        logAudit(block.taskId, 'blocked', true, false);
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  }, [blocks, currentUserMember, logAudit]);

  return {
    loading, effectiveRole,
    tasks, checklistItems, checklistTemplates, timeEntries, dateHistory,
    dependencies, blocks, comments, attachments, externalAccess, auditLog, notifications,
    reload: loadAll,
    createTask, createSubtask, updateTaskFields, moveTaskStatus, finishTask, changePlannedDate,
    logHours, deleteTimeEntry,
    toggleChecklistItem, addChecklistItem, removeChecklistItem, setManualProgress,
    addComment, addAttachment, removeAttachment, getAttachmentUrl,
    addDependency, removeDependency, addBlock, resolveBlock,
    markNotificationRead, markAllNotificationsRead,
  };
}

export type SDDataApi = ReturnType<typeof useOperacionesSDData>;
