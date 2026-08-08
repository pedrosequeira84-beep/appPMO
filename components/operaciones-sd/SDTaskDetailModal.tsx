import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import SearchableSelect from '../SearchableSelect';
import { Project, SDTask, TeamMember, SD_WORK_TYPES, SD_WORK_TYPE_LABELS, SDWorkType } from '../../types';
import { SDDataApi } from '../../hooks/useOperacionesSDData';
import {
  SD_PRIORITIES, SD_SEVERITIES, canManageTask, SDEffectiveRole,
  sumTaskHours, hoursDeviation, priorityBadgeClass,
  computeTaskRisk, computeCompliance, computeLeadTimeDays, computeCycleTimeDays,
  computeBacklogTimeDays, computeWipTimeDays, computeBlockedTimeDays, computeDateDeviationDays,
  riskBadgeClass, complianceBadgeClass
} from '../../utils/sdHelpers';
import { formatDate } from '../../utils/helpers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: SDTask | null;
  defaultProjectId?: string;
  projects: Project[];
  team: TeamMember[];
  role: SDEffectiveRole;
  currentMemberId?: string | null;
  api: SDDataApi;
  onOpenTask?: (task: SDTask) => void;
}

interface FormState {
  projectId: string;
  workType: SDWorkType;
  title: string;
  description: string;
  assigneeMemberId: string | null;
  plannedDate: string;
  commitmentDate: string;
  estimatedHours: string;
  priority: string;
  severity: string;
  tagsInput: string;
  vendorSupportRequired: boolean;
  vendorName: string;
  vendorTicketNumber: string;
}

const emptyForm = (projectId: string): FormState => ({
  projectId, workType: 'incidente', title: '', description: '',
  assigneeMemberId: null, plannedDate: '', commitmentDate: '',
  estimatedHours: '', priority: 'Media', severity: 'Media', tagsInput: '',
  vendorSupportRequired: false, vendorName: '', vendorTicketNumber: ''
});

const fieldLabel = 'block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 ml-1';
const fieldInput = 'w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 transition-all font-semibold text-sm outline-none dark:text-white';

const SDTaskDetailModal: React.FC<Props> = ({ isOpen, onClose, task, defaultProjectId, projects, team, role, currentMemberId, api, onOpenTask }) => {
  const isNew = !task;
  const readOnly = !canManageTask(role);

  const [form, setForm] = useState<FormState>(emptyForm(defaultProjectId || projects[0]?.id || ''));
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [newPlannedDate, setNewPlannedDate] = useState('');
  const [dateReason, setDateReason] = useState('');
  const [hoursDate, setHoursDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursValue, setHoursValue] = useState('');
  const [hoursComment, setHoursComment] = useState('');
  const [hoursMember, setHoursMember] = useState(currentMemberId || '');
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newBlockDesc, setNewBlockDesc] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (task) {
      setForm({
        projectId: task.projectId, workType: task.workType, title: task.title,
        description: task.description || '', assigneeMemberId: task.assigneeMemberId,
        plannedDate: task.plannedDate || '', commitmentDate: task.commitmentDate || '',
        estimatedHours: task.estimatedHours?.toString() || '', priority: task.priority || 'Media',
        severity: task.severity || 'Media', tagsInput: (task.tags || []).join(', '),
        vendorSupportRequired: task.vendorSupportRequired, vendorName: task.vendorName || '',
        vendorTicketNumber: task.vendorTicketNumber || ''
      });
      setHoursMember(currentMemberId || task.assigneeMemberId || '');
    } else {
      setForm(emptyForm(defaultProjectId || projects[0]?.id || ''));
      setHoursMember(currentMemberId || '');
    }
  }, [task, isOpen, defaultProjectId]);

  const tasksById = React.useMemo(() => Object.fromEntries(api.tasks.map(t => [t.id, t])), [api.tasks]);

  if (!isOpen) return null;

  const project = projects.find(p => p.id === form.projectId);
  const taskChecklist = task ? api.checklistItems.filter(i => i.taskId === task.id) : [];
  const taskHours = task ? api.timeEntries.filter(e => e.taskId === task.id) : [];
  const taskComments = task ? api.comments.filter(c => c.taskId === task.id) : [];
  const taskAttachments = task ? api.attachments.filter(a => a.taskId === task.id) : [];
  const subtasks = task ? api.tasks.filter(t => t.parentTaskId === task.id) : [];
  const taskBlocks = task ? api.blocks.filter(b => b.taskId === task.id) : [];
  const taskDateHistory = task ? api.dateHistory.filter(h => h.taskId === task.id).sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()) : [];
  const taskAudit = task ? api.auditLog.filter(a => a.taskId === task.id).sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()) : [];
  const actualHours = sumTaskHours(api.timeEntries, task?.id || '');
  const deviation = task ? hoursDeviation(task.estimatedHours, actualHours) : 0;
  const dateDeviationDays = task ? computeDateDeviationDays(task.id, api.dateHistory) : 0;

  const risk = task ? computeTaskRisk(task, api.dependencies, tasksById) : { score: 0, level: 'Bajo' as const };
  const compliance = task ? computeCompliance(task) : 'Sin Compromiso' as const;
  const leadTime = task ? computeLeadTimeDays(task) : null;
  const cycleTime = task ? computeCycleTimeDays(task) : null;
  const backlogTime = task ? computeBacklogTimeDays(task) : 0;
  const wipTime = task ? computeWipTimeDays(task) : null;
  const blockedTime = task ? computeBlockedTimeDays(task.id, api.blocks) : 0;

  const canFinish = task ? api.tasks.find(t => t.id === task.id) && (role === 'administrador' || task.assigneeMemberId === currentMemberId) : false;

  const handleSave = async () => {
    if (!form.title.trim() || !form.projectId) return;
    const tags = form.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (isNew) {
      const newTask = await api.createTask({
        projectId: form.projectId, workType: form.workType, title: form.title,
        description: form.description, assigneeMemberId: form.assigneeMemberId,
        plannedDate: form.plannedDate || null, commitmentDate: form.commitmentDate || null,
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        priority: form.priority, severity: form.severity, tags,
        vendorSupportRequired: form.vendorSupportRequired, vendorName: form.vendorName, vendorTicketNumber: form.vendorTicketNumber
      });
      if (newTask) onClose();
    } else {
      await api.updateTaskFields(task!.id, {
        title: form.title, description: form.description, workType: form.workType,
        assigneeMemberId: form.assigneeMemberId, commitmentDate: form.commitmentDate || null,
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        priority: form.priority, severity: form.severity, tags,
        vendorSupportRequired: form.vendorSupportRequired,
        vendorName: form.vendorSupportRequired ? form.vendorName : null,
        vendorTicketNumber: form.vendorSupportRequired ? form.vendorTicketNumber : null
      });
    }
  };

  const openDateChangeModal = () => {
    setNewPlannedDate(form.plannedDate || '');
    setDateReason('');
    setDateModalOpen(true);
  };

  const confirmDateChange = async () => {
    if (!task || !newPlannedDate || !dateReason.trim()) return;
    await api.changePlannedDate(task.id, newPlannedDate, dateReason);
    setForm(prev => ({ ...prev, plannedDate: newPlannedDate }));
    setDateModalOpen(false);
  };

  const handleLogHours = async () => {
    if (!task || !hoursMember || !hoursValue) return;
    await api.logHours(task.id, hoursMember, hoursDate, parseFloat(hoursValue), hoursComment);
    setHoursValue('');
    setHoursComment('');
  };

  const handleAddSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return;
    await api.createSubtask(task, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-4 space-y-10">
        {/* Header */}
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[24px] bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <i className="fas fa-tasks fa-2x"></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {task && <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">{task.code}</span>}
              {task && <span className="text-[10px] font-black text-gray-400 uppercase">{task.status === 'backlog' ? 'Backlog' : task.status === 'in_progress' ? 'In Progress' : 'Done'}</span>}
            </div>
            <h3 className="text-2xl font-black dark:text-white tracking-tight leading-none">{isNew ? 'Nueva Tarea' : task!.title}</h3>
            <p className="text-gray-500 font-medium text-sm mt-1">{project ? `${project.opportunityNumber} — ${project.name}` : ''}</p>
          </div>
        </div>

        {/* Métricas automáticas */}
        {!isNew && task && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`rounded-2xl p-4 text-center border ${riskBadgeClass(risk.level)}`}>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Riesgo</p>
              <p className="text-lg font-black">{risk.level}</p>
            </div>
            <div className={`rounded-2xl p-4 text-center border ${complianceBadgeClass(compliance)}`}>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Cumplimiento</p>
              <p className="text-lg font-black">{compliance}</p>
            </div>
            <div className="rounded-2xl p-4 text-center border bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Lead / Cycle Time</p>
              <p className="text-lg font-black text-gray-700 dark:text-gray-200">{leadTime ?? '—'}d / {cycleTime ?? '—'}d</p>
            </div>
            <div className="rounded-2xl p-4 text-center border bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Backlog / WIP / Bloqueado</p>
              <p className="text-lg font-black text-gray-700 dark:text-gray-200">{backlogTime}d / {wipTime ?? 0}d / {blockedTime}d</p>
            </div>
          </div>
        )}

        {/* Campos base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <SearchableSelect
              label="Proyecto"
              options={projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))}
              value={form.projectId}
              onChange={(val) => setForm({ ...form, projectId: val })}
              placeholder="Seleccionar proyecto..."
            />
          </div>
          <div>
            <label className={fieldLabel}>Tipo de Trabajo</label>
            <select disabled={readOnly} className={fieldInput} value={form.workType} onChange={e => setForm({ ...form, workType: e.target.value as SDWorkType })}>
              {SD_WORK_TYPES.map(wt => <option key={wt} value={wt}>{SD_WORK_TYPE_LABELS[wt]}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Responsable</label>
            <SearchableSelect
              options={team.filter(m => m.is_active !== false && !m.isExternal).map(m => ({ id: m.id, label: m.name }))}
              value={form.assigneeMemberId}
              onChange={(val) => setForm({ ...form, assigneeMemberId: val })}
              placeholder="Sin asignar"
            />
          </div>
          <div className="md:col-span-2">
            <label className={fieldLabel}>Título</label>
            <input disabled={readOnly} className={fieldInput} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Resumen breve de la tarea" />
          </div>
          <div className="md:col-span-2">
            <label className={fieldLabel}>Descripción</label>
            <textarea disabled={readOnly} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 transition-all font-medium text-sm outline-none dark:text-white" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalle de la tarea..." />
          </div>

          <div>
            <label className={fieldLabel}>Fecha Planificada</label>
            {isNew ? (
              <input type="date" className={fieldInput} value={form.plannedDate} onChange={e => setForm({ ...form, plannedDate: e.target.value })} />
            ) : (
              <button disabled={readOnly} onClick={openDateChangeModal} className={`${fieldInput} flex items-center justify-between text-left`}>
                <span>{form.plannedDate ? formatDate(form.plannedDate) : 'Sin definir'}</span>
                {!readOnly && <i className="fas fa-pen text-[10px] text-blue-500"></i>}
              </button>
            )}
          </div>
          <div>
            <label className={fieldLabel}>Fecha Compromiso</label>
            <input disabled={readOnly} type="date" className={fieldInput} value={form.commitmentDate} onChange={e => setForm({ ...form, commitmentDate: e.target.value })} />
          </div>
          <div>
            <label className={fieldLabel}>Horas Estimadas</label>
            <input disabled={readOnly} type="number" min="0" step="0.5" className={fieldInput} value={form.estimatedHours} onChange={e => setForm({ ...form, estimatedHours: e.target.value })} placeholder="0" />
          </div>
          <div>
            <label className={fieldLabel}>Prioridad</label>
            <select disabled={readOnly} className={fieldInput} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {SD_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Severidad</label>
            <select disabled={readOnly} className={fieldInput} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
              {SD_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={fieldLabel}>Etiquetas (separadas por coma)</label>
            <input disabled={readOnly} className={fieldInput} value={form.tagsInput} onChange={e => setForm({ ...form, tagsInput: e.target.value })} placeholder="red, cliente-vip, urgente" />
          </div>

          <div className="md:col-span-2 flex items-center gap-3 bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30">
            <input disabled={readOnly} type="checkbox" id="vendorSupport" className="w-5 h-5 accent-purple-600" checked={form.vendorSupportRequired} onChange={e => setForm({ ...form, vendorSupportRequired: e.target.checked })} />
            <label htmlFor="vendorSupport" className="text-sm font-bold text-purple-700 dark:text-purple-400 cursor-pointer">Vendor Support Required</label>
          </div>
          {form.vendorSupportRequired && (
            <>
              <div>
                <label className={fieldLabel}>Fabricante</label>
                <input disabled={readOnly} className={fieldInput} value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} placeholder="Ej: Cisco" />
              </div>
              <div>
                <label className={fieldLabel}>Número de Ticket</label>
                <input disabled={readOnly} className={fieldInput} value={form.vendorTicketNumber} onChange={e => setForm({ ...form, vendorTicketNumber: e.target.value })} placeholder="Ej: TAC-123456" />
              </div>
            </>
          )}
        </div>

        {!readOnly && (
          <div className="flex justify-end gap-4">
            <button onClick={onClose} className="px-6 py-3 text-xs font-black text-gray-400 hover:text-gray-600 tracking-widest uppercase">Cancelar</button>
            <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all">
              {isNew ? 'CREAR TAREA' : 'GUARDAR CAMBIOS'}
            </button>
          </div>
        )}

        {!isNew && task && (
          <>
            {/* Checklist */}
            <section className="border-t border-gray-100 dark:border-slate-800 pt-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Checklist</h4>
                <span className="text-[10px] font-black text-blue-600">{task.progressPercent}% completado{task.progressManualOverride ? ' (manual)' : ''}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
                <div className="bg-blue-500 h-full transition-all" style={{ width: `${task.progressPercent}%` }}></div>
              </div>
              <div className="space-y-2">
                {taskChecklist.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5">
                    <input disabled={readOnly} type="checkbox" className="w-4 h-4 accent-blue-600" checked={item.isDone} onChange={() => api.toggleChecklistItem(item.id)} />
                    <span className={`flex-1 text-sm font-medium ${item.isDone ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{item.label}</span>
                    {!readOnly && (
                      <button onClick={() => api.removeChecklistItem(item.id)} className="text-gray-300 hover:text-red-500" aria-label={`Quitar ítem "${item.label}"`}><i className="fas fa-times"></i></button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <div className="flex gap-2 mt-3">
                  <input className="flex-1 h-10 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm outline-none border-2 border-transparent focus:border-blue-500" placeholder="Agregar ítem..." value={newChecklistLabel} onChange={e => setNewChecklistLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newChecklistLabel.trim()) { api.addChecklistItem(task.id, newChecklistLabel); setNewChecklistLabel(''); } }} />
                  <button onClick={() => { if (newChecklistLabel.trim()) { api.addChecklistItem(task.id, newChecklistLabel); setNewChecklistLabel(''); } }} disabled={!newChecklistLabel.trim()} className="px-4 h-10 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed">AGREGAR</button>
                </div>
              )}
              {!readOnly && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Ajustar % manualmente:</span>
                  <input type="range" min="0" max="100" value={task.progressPercent} onChange={e => api.setManualProgress(task.id, parseInt(e.target.value))} className="flex-1" />
                </div>
              )}
            </section>

            {/* Registro de horas */}
            <section className="border-t border-gray-100 dark:border-slate-800 pt-8">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Registro de Horas</h4>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Estimadas</p>
                  <p className="text-xl font-black text-gray-700 dark:text-gray-200">{task.estimatedHours ?? '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Reales</p>
                  <p className="text-xl font-black text-blue-600">{actualHours}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Desviación</p>
                  <p className={`text-xl font-black ${deviation > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{deviation > 0 ? '+' : ''}{deviation}</p>
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {taskHours.map(h => {
                  const m = team.find(t => t.id === h.memberId);
                  return (
                    <div key={h.id} className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2">
                      <span className="font-mono text-gray-400">{formatDate(h.date)}</span>
                      <span className="font-bold text-gray-700 dark:text-gray-200">{m?.name || '—'}</span>
                      <span className="font-black text-blue-600 ml-auto">{h.hours} hs</span>
                      <span className="text-gray-400 italic truncate max-w-[140px]">{h.comment}</span>
                      {!readOnly && <button onClick={() => api.deleteTimeEntry(h.id)} className="text-gray-300 hover:text-red-500" aria-label="Eliminar registro de horas"><i className="fas fa-trash"></i></button>}
                    </div>
                  );
                })}
              </div>
              {!readOnly && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <input type="date" className="h-10 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" value={hoursDate} onChange={e => setHoursDate(e.target.value)} />
                  <input type="number" min="0" step="0.5" placeholder="Horas" className="h-10 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" value={hoursValue} onChange={e => setHoursValue(e.target.value)} />
                  <input placeholder="Comentario" className="h-10 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" value={hoursComment} onChange={e => setHoursComment(e.target.value)} />
                  <button onClick={handleLogHours} className="h-10 bg-blue-600 text-white rounded-xl text-xs font-black">CARGAR</button>
                </div>
              )}
              {!readOnly && (
                <button
                  onClick={() => api.finishTask(task.id)}
                  disabled={!canFinish || task.status === 'done'}
                  className="mt-4 w-full h-12 rounded-2xl bg-emerald-600 disabled:bg-gray-200 disabled:dark:bg-slate-800 disabled:text-gray-400 text-white font-black text-xs tracking-widest uppercase transition-all"
                  title={taskHours.length === 0 ? 'Necesita al menos un registro de horas' : ''}
                >
                  {task.status === 'done' ? 'Tarea Finalizada' : 'Finalizar Tarea (Done)'}
                </button>
              )}
            </section>

            {/* Comentarios */}
            <section className="border-t border-gray-100 dark:border-slate-800 pt-8">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Comentarios</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {taskComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(c => {
                  const m = team.find(t => t.id === c.memberId);
                  return (
                    <div key={c.id} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-gray-700 dark:text-gray-200">{m?.name || 'Usuario'}</span>
                        <span className="text-[10px] text-gray-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{c.body}</p>
                    </div>
                  );
                })}
                {taskComments.length === 0 && <p className="text-xs text-gray-400 italic">Sin comentarios aún.</p>}
              </div>
              <div className="flex gap-2 mt-3">
                <input className="flex-1 h-10 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm outline-none border-2 border-transparent focus:border-blue-500" placeholder="Escribir un comentario..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newComment.trim()) { api.addComment(task.id, newComment); setNewComment(''); } }} />
                <button onClick={() => { if (newComment.trim()) { api.addComment(task.id, newComment); setNewComment(''); } }} disabled={!newComment.trim()} className="px-4 h-10 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed">ENVIAR</button>
              </div>
            </section>

            {/* Adjuntos */}
            <section className="border-t border-gray-100 dark:border-slate-800 pt-8">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Adjuntos</h4>
              <div className="space-y-2">
                {taskAttachments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5">
                    <i className="fas fa-paperclip text-gray-400"></i>
                    <button
                      onClick={async () => {
                        const win = window.open('', '_blank');
                        const url = await api.getAttachmentUrl(a.fileUrl);
                        if (url && win) win.location.href = url;
                        else win?.close();
                      }}
                      className="flex-1 text-sm font-medium text-blue-600 hover:underline truncate text-left"
                    >
                      {a.fileName}
                    </button>
                    {!readOnly && <button onClick={() => api.removeAttachment(a.id)} className="text-gray-300 hover:text-red-500" aria-label={`Eliminar adjunto ${a.fileName}`}><i className="fas fa-trash"></i></button>}
                  </div>
                ))}
                {taskAttachments.length === 0 && <p className="text-xs text-gray-400 italic">Sin adjuntos.</p>}
              </div>
              {!readOnly && (
                <label className="mt-3 inline-flex items-center gap-2 px-4 h-10 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-black text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700">
                  <i className="fas fa-upload"></i> SUBIR ARCHIVO
                  <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) api.addAttachment(task.id, f); }} />
                </label>
              )}
            </section>

            {/* Subtareas y bloqueos */}
            <section className="border-t border-gray-100 dark:border-slate-800 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Subtareas</h4>
                <div className="space-y-2">
                  {subtasks.map(st => (
                    <button
                      key={st.id}
                      onClick={() => onOpenTask?.(st)}
                      className="w-full flex items-center gap-2 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl px-3 py-2 text-xs text-left transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${st.status === 'done' ? 'bg-emerald-500' : st.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                      <span className="font-bold text-gray-600 dark:text-gray-300 shrink-0">{st.code}</span>
                      <span className="text-gray-500 dark:text-gray-400 truncate flex-1">{st.title}</span>
                      <span className="text-gray-400 shrink-0">{st.progressPercent}%</span>
                    </button>
                  ))}
                  {subtasks.length === 0 && <p className="text-xs text-gray-400 italic">Sin subtareas.</p>}
                </div>
                {!readOnly && (
                  <div className="flex gap-2 mt-3">
                    <input className="flex-1 h-10 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" placeholder="Título de la subtarea..." value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }} />
                    <button onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="px-3 h-10 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Bloqueos</h4>
                <div className="space-y-2">
                  {taskBlocks.map(b => (
                    <div key={b.id} className={`rounded-xl px-3 py-2 text-xs ${b.resolvedAt ? 'bg-gray-50 dark:bg-slate-800/50 text-gray-400 line-through' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{b.description}</span>
                        {!readOnly && !b.resolvedAt && <button onClick={() => api.resolveBlock(b.id)} className="font-black text-emerald-600 shrink-0">RESOLVER</button>}
                      </div>
                    </div>
                  ))}
                  {taskBlocks.length === 0 && <p className="text-xs text-gray-400 italic">Sin bloqueos registrados.</p>}
                </div>
                {!readOnly && (
                  <div className="flex gap-2 mt-3">
                    <input className="flex-1 h-10 px-3 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" placeholder="Describir bloqueo..." value={newBlockDesc} onChange={e => setNewBlockDesc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newBlockDesc.trim()) { api.addBlock(task.id, newBlockDesc); setNewBlockDesc(''); } }} />
                    <button onClick={() => { if (newBlockDesc.trim()) { api.addBlock(task.id, newBlockDesc); setNewBlockDesc(''); } }} disabled={!newBlockDesc.trim()} className="px-3 h-10 bg-red-600 text-white rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                  </div>
                )}
              </div>
            </section>

            {/* Historial de reprogramaciones */}
            {taskDateHistory.length > 0 && (
              <section className="border-t border-gray-100 dark:border-slate-800 pt-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Historial de Reprogramaciones</h4>
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full uppercase">Desviación total: +{dateDeviationDays}d</span>
                </div>
                <div className="space-y-2">
                  {taskDateHistory.map(h => (
                    <div key={h.id} className="text-xs bg-gray-50 dark:bg-slate-800/50 rounded-xl px-4 py-2.5">
                      <span className="font-mono text-gray-400">{formatDate(h.changedAt)}</span>{' '}
                      <span className="font-bold text-gray-600 dark:text-gray-300">{h.previousDate ? formatDate(h.previousDate) : 'Sin fecha'} → {formatDate(h.newDate)}</span>
                      <p className="text-gray-500 dark:text-gray-400 italic mt-1">"{h.reason}"</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Auditoría completa */}
            {taskAudit.length > 0 && (
              <section className="border-t border-gray-100 dark:border-slate-800 pt-8">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Auditoría</h4>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {taskAudit.map(a => {
                    const m = team.find(t => t.id === a.memberId);
                    return (
                      <div key={a.id} className="text-[11px] flex items-center gap-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                        <span className="font-mono text-gray-400 shrink-0">{new Date(a.changedAt).toLocaleString('es-AR')}</span>
                        <span className="font-bold text-gray-600 dark:text-gray-300 shrink-0">{m?.name || 'Sistema'}</span>
                        <span className="text-gray-400 shrink-0">{a.fieldName}:</span>
                        <span className="text-red-400 line-through truncate">{a.oldValue ?? '—'}</span>
                        <i className="fas fa-arrow-right text-gray-300 text-[9px] shrink-0"></i>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate">{a.newValue ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Sub-modal: justificación de reprogramación */}
      {dateModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-dark-card rounded-3xl p-8 w-full max-w-md space-y-5">
            <h4 className="text-lg font-black dark:text-white">Reprogramar Fecha Planificada</h4>
            <div>
              <label className={fieldLabel}>Nueva Fecha</label>
              <input type="date" className={fieldInput} value={newPlannedDate} onChange={e => setNewPlannedDate(e.target.value)} />
            </div>
            <div>
              <label className={fieldLabel}>Justificación (obligatoria)</label>
              <textarea className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm outline-none border-2 border-transparent focus:border-blue-500" rows={3} value={dateReason} onChange={e => setDateReason(e.target.value)} placeholder="Motivo del cambio de fecha..." />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDateModalOpen(false)} className="px-5 py-2.5 text-xs font-black text-gray-400 uppercase">Cancelar</button>
              <button onClick={confirmDateChange} disabled={!newPlannedDate || !dateReason.trim()} className="px-6 py-2.5 bg-blue-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default SDTaskDetailModal;
