import React, { useState } from 'react';
import { Project, SDTask } from '../../types';
import { priorityBadgeClass, isTaskOverdue, canFinishTask, canManageTask, SDEffectiveRole } from '../../utils/sdHelpers';
import { SDDataApi } from '../../hooks/useOperacionesSDData';

type ActionKey = 'hours' | 'comment' | 'date' | 'block' | null;

interface Props {
  task: SDTask;
  project?: Project;
  api: SDDataApi;
  role: SDEffectiveRole;
  currentMemberId?: string | null;
  onOpen: () => void;
}

const iconBtn = 'w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors';

const SDMyTaskRow: React.FC<Props> = ({ task, project, api, role, currentMemberId, onOpen }) => {
  const [action, setAction] = useState<ActionKey>(null);
  const [hours, setHours] = useState('');
  const [hoursComment, setHoursComment] = useState('');
  const [commentText, setCommentText] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [newDate, setNewDate] = useState(task.plannedDate || '');
  const [dateReason, setDateReason] = useState('');

  const overdue = isTaskOverdue(task);
  const canEdit = canManageTask(role);
  const finishCheck = canFinishTask(task, api.timeEntries, role, currentMemberId);
  const toggle = (key: ActionKey) => setAction(prev => prev === key ? null : key);

  const submitHours = async () => {
    if (!hours || !currentMemberId) return;
    await api.logHours(task.id, currentMemberId, new Date().toISOString().split('T')[0], parseFloat(hours), hoursComment);
    setHours(''); setHoursComment(''); setAction(null);
  };
  const submitComment = async () => {
    if (!commentText.trim()) return;
    await api.addComment(task.id, commentText);
    setCommentText(''); setAction(null);
  };
  const submitBlock = async () => {
    if (!blockReason.trim()) return;
    await api.addBlock(task.id, blockReason);
    setBlockReason(''); setAction(null);
  };
  const submitDateChange = async () => {
    if (!newDate || !dateReason.trim()) return;
    await api.changePlannedDate(task.id, newDate, dateReason);
    setDateReason(''); setAction(null);
  };
  const handleUnblock = async () => {
    const activeBlocks = api.blocks.filter(b => b.taskId === task.id && !b.resolvedAt);
    for (const b of activeBlocks) await api.resolveBlock(b.id);
  };

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-2xl border ${overdue ? 'border-red-200 dark:border-red-900/40' : 'border-gray-100 dark:border-slate-700'} p-4`}>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onOpen} className="flex-1 min-w-[200px] text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">{task.code}</span>
            {task.priority && <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${priorityBadgeClass(task.priority)}`}>{task.priority}</span>}
            {task.blocked && <span className="text-[9px] font-black text-red-600"><i className="fas fa-lock"></i></span>}
          </div>
          <p className="text-sm font-bold text-gray-800 dark:text-white">{task.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{project?.name}{task.plannedDate ? ` · ${task.plannedDate}` : ''}</p>
        </button>

        <div className="flex items-center gap-0.5">
          {canEdit && (
            <>
              <button onClick={() => toggle('hours')} className={iconBtn} title="Registrar horas" aria-label="Registrar horas"><i className="fas fa-clock"></i></button>
              <button onClick={() => toggle('comment')} className={iconBtn} title="Agregar comentario" aria-label="Agregar comentario"><i className="fas fa-comment"></i></button>
              {task.blocked ? (
                <button onClick={handleUnblock} className={iconBtn} title="Desbloquear" aria-label="Desbloquear"><i className="fas fa-unlock"></i></button>
              ) : (
                <button onClick={() => toggle('block')} className={iconBtn} title="Bloquear" aria-label="Bloquear"><i className="fas fa-lock"></i></button>
              )}
              <button onClick={() => toggle('date')} className={iconBtn} title="Cambiar Fecha Planificada" aria-label="Cambiar Fecha Planificada"><i className="fas fa-calendar-day"></i></button>
              <button
                onClick={() => api.finishTask(task.id)}
                disabled={!finishCheck.allowed || task.status === 'done'}
                className={`${iconBtn} disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400`}
                title={task.status === 'done' ? 'Ya finalizada' : (finishCheck.reason || 'Finalizar tarea')}
                aria-label="Finalizar tarea"
              >
                <i className="fas fa-check-circle"></i>
              </button>
            </>
          )}
          <button onClick={onOpen} className={iconBtn} title="Abrir tarea" aria-label="Abrir tarea"><i className="fas fa-expand"></i></button>
        </div>
      </div>

      {canEdit && action === 'hours' && (
        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-700 flex flex-wrap gap-2">
          <input type="number" min="0" step="0.5" autoFocus placeholder="Horas" value={hours} onChange={e => setHours(e.target.value)} className="w-24 h-9 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" />
          <input placeholder="Comentario (opcional)" value={hoursComment} onChange={e => setHoursComment(e.target.value)} className="flex-1 min-w-[140px] h-9 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" />
          <button onClick={submitHours} className="h-9 px-4 bg-blue-600 text-white rounded-lg text-xs font-black">CARGAR</button>
        </div>
      )}
      {canEdit && action === 'comment' && (
        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-700 flex gap-2">
          <input autoFocus placeholder="Escribir comentario..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()} className="flex-1 h-9 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" />
          <button onClick={submitComment} className="h-9 px-4 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-lg text-xs font-black">ENVIAR</button>
        </div>
      )}
      {canEdit && action === 'block' && (
        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-700 flex gap-2">
          <input autoFocus placeholder="Motivo del bloqueo..." value={blockReason} onChange={e => setBlockReason(e.target.value)} className="flex-1 h-9 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-red-500" />
          <button onClick={submitBlock} className="h-9 px-4 bg-red-600 text-white rounded-lg text-xs font-black">BLOQUEAR</button>
        </div>
      )}
      {canEdit && action === 'date' && (
        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-700 flex flex-wrap gap-2">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-9 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" />
          <input placeholder="Justificación (obligatoria)" value={dateReason} onChange={e => setDateReason(e.target.value)} className="flex-1 min-w-[140px] h-9 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs outline-none border-2 border-transparent focus:border-blue-500" />
          <button onClick={submitDateChange} disabled={!newDate || !dateReason.trim()} className="h-9 px-4 bg-blue-600 disabled:opacity-40 text-white rounded-lg text-xs font-black">CONFIRMAR</button>
        </div>
      )}
    </div>
  );
};

export default SDMyTaskRow;
