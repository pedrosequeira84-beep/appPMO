import React, { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { Project, SDTask, TeamMember } from '../../types';
import { priorityBadgeClass, isTaskOverdue, canManageTask, SDEffectiveRole } from '../../utils/sdHelpers';
import { formatDate } from '../../utils/helpers';

interface Props {
  tasks: SDTask[];
  projects: Project[];
  team: TeamMember[];
  role: SDEffectiveRole;
  onOpenTask: (task: SDTask) => void;
  onChangeDate: (taskId: string, newDate: string, reason: string) => void;
}

type RangeKey = 'today' | 'week' | '2weeks' | '3weeks' | 'month';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: 'Hoy', days: 0 },
  { key: 'week', label: 'Semana', days: 7 },
  { key: '2weeks', label: '2 Semanas', days: 14 },
  { key: '3weeks', label: '3 Semanas', days: 21 },
  { key: 'month', label: 'Mes', days: 30 }
];

const toIso = (d: Date) => d.toISOString().split('T')[0];

const DraggableTaskCard: React.FC<{ task: SDTask; project?: Project; assignee?: TeamMember; onClick: () => void; canDrag: boolean }> = ({ task, project, assignee, onClick, canDrag }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canDrag });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const overdue = isTaskOverdue(task);

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      onClick={onClick}
      className={`text-left bg-white dark:bg-slate-800/60 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all w-full ${overdue ? 'border-red-200 dark:border-red-900/40' : 'border-gray-100 dark:border-slate-700'} ${isDragging ? 'opacity-40' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">{task.code}</span>
        {task.priority && <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${priorityBadgeClass(task.priority)}`}>{task.priority}</span>}
      </div>
      <p className="text-sm font-bold text-gray-800 dark:text-white line-clamp-2">{task.title}</p>
      <p className="text-[10px] text-gray-400 mt-1">{project?.name} · {assignee?.name || 'Sin asignar'}</p>
    </button>
  );
};

const DayDropZone: React.FC<{ date: string; children: React.ReactNode }> = ({ date, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  return (
    <div ref={setNodeRef} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 rounded-2xl transition-colors p-2 -m-2 ${isOver ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}>
      {children}
    </div>
  );
};

const SDCalendarView: React.FC<Props> = ({ tasks, projects, team, role, onOpenTask, onChangeDate }) => {
  const [range, setRange] = useState<RangeKey>('week');
  const [pendingMove, setPendingMove] = useState<{ taskId: string; newDate: string } | null>(null);
  const [reason, setReason] = useState('');
  const canDrag = canManageTask(role);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const days = useMemo(() => {
    const count = RANGES.find(r => r.key === range)?.days ?? 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: string[] = [];
    for (let i = 0; i <= count; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      list.push(toIso(d));
    }
    return list;
  }, [range]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, SDTask[]> = {};
    tasks.filter(t => t.plannedDate && days.includes(t.plannedDate)).forEach(t => {
      const key = t.plannedDate!;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks, days]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newDate = over.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.plannedDate === newDate) return;
    setPendingMove({ taskId, newDate });
    setReason('');
  };

  const confirmMove = () => {
    if (!pendingMove || !reason.trim()) return;
    onChangeDate(pendingMove.taskId, pendingMove.newDate, reason);
    setPendingMove(null);
  };

  const movingTask = pendingMove ? tasks.find(t => t.id === pendingMove.taskId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-white dark:bg-dark-card p-1 rounded-2xl border border-gray-100 dark:border-dark-border flex shadow-sm w-fit">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${range === r.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {r.label.toUpperCase()}
            </button>
          ))}
        </div>
        {canDrag && <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide"><i className="fas fa-arrows-alt mr-1.5"></i>Arrastrá una tarea a otro día para reprogramarla</p>}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {days.map(date => {
            const dayTasks = tasksByDate[date] || [];
            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase">{formatDate(date)}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800"></div>
                  <span className="text-[10px] font-bold text-gray-400">{dayTasks.length} tareas</span>
                </div>
                <DayDropZone date={date}>
                  {dayTasks.map(task => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      project={projects.find(p => p.id === task.projectId)}
                      assignee={team.find(m => m.id === task.assigneeMemberId)}
                      onClick={() => onOpenTask(task)}
                      canDrag={canDrag}
                    />
                  ))}
                  {dayTasks.length === 0 && (
                    <div className="col-span-full text-center py-4 text-[11px] text-gray-300 dark:text-slate-700 italic border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-2xl">
                      Sin tareas
                    </div>
                  )}
                </DayDropZone>
              </div>
            );
          })}
        </div>
      </DndContext>

      {pendingMove && movingTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-dark-card rounded-3xl p-8 w-full max-w-md space-y-5">
            <h4 className="text-lg font-black dark:text-white">Reprogramar {movingTask.code}</h4>
            <p className="text-sm text-gray-500">Nueva Fecha Planificada: <span className="font-bold text-gray-700 dark:text-gray-200">{formatDate(pendingMove.newDate)}</span></p>
            <div>
              <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 ml-1">Justificación (obligatoria)</label>
              <textarea autoFocus className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm outline-none border-2 border-transparent focus:border-blue-500" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo del cambio de fecha..." />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingMove(null)} className="px-5 py-2.5 text-xs font-black text-gray-400 uppercase">Cancelar</button>
              <button onClick={confirmMove} disabled={!reason.trim()} className="px-6 py-2.5 bg-blue-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SDCalendarView;
