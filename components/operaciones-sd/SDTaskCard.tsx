import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { SDTask, TeamMember, SD_WORK_TYPE_LABELS } from '../../types';
import { priorityBadgeClass, isTaskOverdue } from '../../utils/sdHelpers';

interface SDTaskCardProps {
  task: SDTask;
  assignee?: TeamMember | null;
  onClick: () => void;
  dragDisabled?: boolean;
}

const SDTaskCard: React.FC<SDTaskCardProps> = ({ task, assignee, onClick, dragDisabled }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: dragDisabled
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50
  } : undefined;

  const overdue = isTaskOverdue(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(dragDisabled ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      className={`bg-white dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 space-y-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${isDragging ? 'opacity-40' : ''} ${!dragDisabled ? 'active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">{task.code}</span>
        {task.blocked && (
          <span className="text-[9px] font-black text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full uppercase" title={task.blockedReason || 'Bloqueada'}>
            <i className="fas fa-lock"></i>
          </span>
        )}
      </div>

      <h4 className="text-sm font-bold text-gray-800 dark:text-white leading-snug line-clamp-2">{task.title}</h4>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-gray-300 px-2 py-0.5 rounded uppercase">{SD_WORK_TYPE_LABELS[task.workType]}</span>
        {task.priority && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${priorityBadgeClass(task.priority)}`}>{task.priority}</span>
        )}
        {task.vendorSupportRequired && (
          <span className="text-[9px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded uppercase">
            <i className="fas fa-headset mr-1"></i>Vendor
          </span>
        )}
      </div>

      {task.progressPercent > 0 && (
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-500 h-full transition-all" style={{ width: `${task.progressPercent}%` }}></div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[9px] uppercase">
            {assignee?.name?.charAt(0) || '?'}
          </div>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate max-w-[90px]">{assignee?.name || 'Sin asignar'}</span>
        </div>
        {task.plannedDate && (
          <span className={`text-[9px] font-bold ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
            {overdue && <i className="fas fa-exclamation-circle mr-1"></i>}
            {new Date(task.plannedDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
};

export default SDTaskCard;
