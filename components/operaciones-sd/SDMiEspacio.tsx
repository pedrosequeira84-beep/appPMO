import React, { useMemo } from 'react';
import { Project, SDTask, TeamMember } from '../../types';
import { SDDataApi } from '../../hooks/useOperacionesSDData';
import { isTaskOverdue, SDEffectiveRole } from '../../utils/sdHelpers';
import { getWeekKey } from '../../utils/helpers';
import SDMyTaskRow from './SDMyTaskRow';

interface Props {
  api: SDDataApi;
  projects: Project[];
  role: SDEffectiveRole;
  currentMember: TeamMember | null;
  onOpenTask: (task: SDTask) => void;
  onClose: () => void;
}

const StatCard: React.FC<{ label: string; value: React.ReactNode; accent: string }> = ({ label, value, accent }) => (
  <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5">
    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-2xl font-black ${accent}`}>{value}</p>
  </div>
);

const TaskGroup: React.FC<{ title: string; icon: string; tasks: SDTask[]; projects: Project[]; api: SDDataApi; role: SDEffectiveRole; currentMemberId?: string | null; onOpenTask: (t: SDTask) => void; emptyText: string }> =
  ({ title, icon, tasks, projects, api, role, currentMemberId, onOpenTask, emptyText }) => (
    <section>
      <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <i className={`fas ${icon} text-gray-400`}></i> {title} <span className="text-gray-300 dark:text-slate-600">({tasks.length})</span>
      </h3>
      <div className="space-y-2">
        {tasks.map(t => (
          <SDMyTaskRow
            key={t.id}
            task={t}
            project={projects.find(p => p.id === t.projectId)}
            api={api}
            role={role}
            currentMemberId={currentMemberId}
            onOpen={() => onOpenTask(t)}
          />
        ))}
        {tasks.length === 0 && <p className="text-xs text-gray-400 italic py-2">{emptyText}</p>}
      </div>
    </section>
  );

const SDMiEspacio: React.FC<Props> = ({ api, projects, role, currentMember, onOpenTask, onClose }) => {
  const myId = currentMember?.id;

  const myTasks = useMemo(() => api.tasks.filter(t => t.assigneeMemberId === myId && t.status !== 'done'), [api.tasks, myId]);

  const todayStr = new Date().toISOString().split('T')[0];
  const weekAheadStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  const todayTasks = myTasks.filter(t => t.plannedDate === todayStr);
  const weekTasks = myTasks.filter(t => t.plannedDate && t.plannedDate > todayStr && t.plannedDate <= weekAheadStr);
  const overdueTasks = myTasks.filter(isTaskOverdue);
  const blockedTasks = myTasks.filter(t => t.blocked);

  const weekKey = getWeekKey(new Date());
  const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;

  const myEntries = useMemo(() => api.timeEntries.filter(e => e.memberId === myId), [api.timeEntries, myId]);
  const hoursToday = myEntries.filter(e => e.date === todayStr).reduce((s, e) => s + Number(e.hours), 0);
  const hoursWeek = myEntries.filter(e => getWeekKey(new Date(e.date + 'T00:00:00')) === weekKey).reduce((s, e) => s + Number(e.hours), 0);
  const hoursMonth = myEntries.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
  }).reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="fade-in space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full uppercase tracking-[0.3em] mb-3 inline-block">Tu vista personal</span>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">Mi Espacio</h2>
        </div>
        <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border text-xs font-black text-gray-500 hover:text-gray-800 dark:hover:text-white uppercase tracking-widest" aria-label="Volver a Operaciones S&D">
          <i className="fas fa-arrow-left mr-2"></i>Volver
        </button>
      </div>

      {/* Resumen personal */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard label="Hoy" value={todayTasks.length} accent="text-blue-600" />
        <StatCard label="Esta semana" value={weekTasks.length} accent="text-blue-600" />
        <StatCard label="Vencidas" value={overdueTasks.length} accent="text-red-500" />
        <StatCard label="Bloqueadas" value={blockedTasks.length} accent="text-amber-500" />
        <StatCard label="Hs. Hoy" value={hoursToday} accent="text-emerald-600" />
        <StatCard label="Hs. Semana" value={hoursWeek} accent="text-emerald-600" />
        <StatCard label="Hs. Mes" value={hoursMonth} accent="text-emerald-600" />
      </div>

      <TaskGroup title="Mis Tareas de Hoy" icon="fa-sun" tasks={todayTasks} projects={projects} api={api} role={role} currentMemberId={myId} onOpenTask={onOpenTask} emptyText="No tenés tareas planificadas para hoy." />
      <TaskGroup title="Mis Tareas de la Semana" icon="fa-calendar-week" tasks={weekTasks} projects={projects} api={api} role={role} currentMemberId={myId} onOpenTask={onOpenTask} emptyText="No tenés tareas planificadas el resto de la semana." />
      <TaskGroup title="Tareas Vencidas" icon="fa-exclamation-triangle" tasks={overdueTasks} projects={projects} api={api} role={role} currentMemberId={myId} onOpenTask={onOpenTask} emptyText="Sin tareas vencidas." />
      <TaskGroup title="Tareas Bloqueadas" icon="fa-lock" tasks={blockedTasks} projects={projects} api={api} role={role} currentMemberId={myId} onOpenTask={onOpenTask} emptyText="Sin tareas bloqueadas." />
    </div>
  );
};

export default SDMiEspacio;
