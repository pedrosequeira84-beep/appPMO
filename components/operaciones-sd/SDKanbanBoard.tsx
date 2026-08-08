import React from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { Project, SDTask, SDTaskStatus, TeamMember } from '../../types';
import SDTaskCard from './SDTaskCard';
import { canManageTask, SDEffectiveRole } from '../../utils/sdHelpers';

interface SDKanbanBoardProps {
  project: Project;
  tasks: SDTask[];
  team: TeamMember[];
  role: SDEffectiveRole;
  onOpenTask: (task: SDTask) => void;
  onMoveStatus: (taskId: string, status: 'backlog' | 'in_progress') => void;
  onFinishAttempt: (taskId: string) => void;
}

const COLUMNS: { key: SDTaskStatus; label: string; accent: string }[] = [
  { key: 'backlog', label: 'Backlog', accent: 'bg-gray-400' },
  { key: 'in_progress', label: 'In Progress', accent: 'bg-blue-500' },
  { key: 'done', label: 'Done', accent: 'bg-emerald-500' }
];

const Column: React.FC<{
  status: SDTaskStatus; label: string; accent: string; tasks: SDTask[]; team: TeamMember[];
  onOpenTask: (t: SDTask) => void; dragDisabled: boolean;
}> = ({ status, label, accent, tasks, team, onOpenTask, dragDisabled }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] rounded-[24px] p-4 space-y-3 transition-colors ${isOver ? 'bg-blue-50/60 dark:bg-blue-900/10' : 'bg-gray-50 dark:bg-slate-900/40'}`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={`w-2 h-2 rounded-full ${accent}`}></span>
        <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</h3>
        <span className="text-[10px] font-bold text-gray-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full ml-auto">{tasks.length}</span>
      </div>
      <div className="space-y-3 min-h-[120px]">
        {tasks.map(task => (
          <SDTaskCard
            key={task.id}
            task={task}
            assignee={team.find(m => m.id === task.assigneeMemberId)}
            onClick={() => onOpenTask(task)}
            dragDisabled={dragDisabled}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-[11px] text-gray-300 dark:text-slate-700 italic">Sin tareas</div>
        )}
      </div>
    </div>
  );
};

const SDKanbanBoard: React.FC<SDKanbanBoardProps> = ({ project, tasks, team, role, onOpenTask, onMoveStatus, onFinishAttempt }) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const canDrag = canManageTask(role);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const targetStatus = over.id as SDTaskStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    if (targetStatus === 'done') {
      onFinishAttempt(taskId);
    } else {
      onMoveStatus(taskId, targetStatus);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-black text-gray-800 dark:text-white">{project.opportunityNumber} — {project.name}</h2>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{project.clientName}</span>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <Column
              key={col.key}
              status={col.key}
              label={col.label}
              accent={col.accent}
              tasks={tasks.filter(t => t.status === col.key)}
              team={team}
              onOpenTask={onOpenTask}
              dragDisabled={!canDrag}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
};

export default SDKanbanBoard;
