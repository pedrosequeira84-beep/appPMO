import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { useOperacionesSDData } from '../hooks/useOperacionesSDData';
import SDProjectsPanel from '../components/operaciones-sd/SDProjectsPanel';
import SDKanbanBoard from '../components/operaciones-sd/SDKanbanBoard';
import SDCalendarView from '../components/operaciones-sd/SDCalendarView';
import SDDashboardPanel from '../components/operaciones-sd/SDDashboardPanel';
import SDTaskDetailModal from '../components/operaciones-sd/SDTaskDetailModal';
import SDGlobalSearch from '../components/operaciones-sd/SDGlobalSearch';
import SDNotificationBell from '../components/operaciones-sd/SDNotificationBell';
import SDMiEspacio from '../components/operaciones-sd/SDMiEspacio';
import { SDTask } from '../types';
import { canManageTask } from '../utils/sdHelpers';

type TabKey = 'proyectos' | 'kanban' | 'calendario' | 'dashboard';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'proyectos', label: 'Proyectos', icon: 'fa-diagram-project' },
  { key: 'kanban', label: 'Kanban', icon: 'fa-table-columns' },
  { key: 'calendario', label: 'Calendario', icon: 'fa-calendar-days' },
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-chart-simple' }
];

export const OperacionesSDView: React.FC = () => {
  const { projects, team, currentUserMember, user } = useApp();
  const api = useOperacionesSDData();

  const [activeTab, setActiveTab] = useState<TabKey>('proyectos');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SDTask | null>(null);
  // Mi Espacio: nunca se abre solo, el usuario decide cuándo entrar.
  const [showMiEspacio, setShowMiEspacio] = useState(false);

  const canCreate = canManageTask(api.effectiveRole);

  const openNewTask = () => {
    setEditingTask(null);
    setModalOpen(true);
  };
  const openTask = (task: SDTask) => {
    setEditingTask(task);
    setModalOpen(true);
  };
  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTab('kanban');
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  // Las subtareas viven dentro del detalle de su tarea padre; no ensucian Kanban/Calendario/Dashboard/Proyectos.
  const topLevelTasks = api.tasks.filter(t => !t.parentTaskId);

  if (api.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-circle-notch fa-spin text-2xl text-blue-500"></i>
      </div>
    );
  }

  if (showMiEspacio) {
    return (
      <>
        <SDMiEspacio
          api={api}
          projects={projects}
          role={api.effectiveRole}
          currentMember={currentUserMember}
          onOpenTask={openTask}
          onClose={() => setShowMiEspacio(false)}
        />
        <SDTaskDetailModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          task={editingTask}
          defaultProjectId={selectedProject?.id}
          projects={projects}
          team={team}
          role={api.effectiveRole}
          currentMemberId={currentUserMember?.id}
          api={api}
          onOpenTask={openTask}
        />
      </>
    );
  }

  return (
    <div className="fade-in space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">Operaciones S&D</h2>
          {api.effectiveRole === 'observador' && (
            <p className="text-xs text-gray-400 mt-3 font-semibold uppercase tracking-wide">
              <i className="fas fa-eye mr-1.5"></i>Modo solo lectura ({currentUserMember?.isExternal ? 'acceso externo' : 'observador'})
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <SDGlobalSearch
            projects={projects}
            tasks={api.tasks}
            team={team}
            comments={api.comments}
            onSelectProject={selectProject}
            onOpenTask={openTask}
          />
          <SDNotificationBell
            notifications={api.notifications}
            tasks={api.tasks}
            onOpenTask={openTask}
            onMarkRead={api.markNotificationRead}
            onMarkAllRead={api.markAllNotificationsRead}
          />
          {!currentUserMember?.isExternal && (
            <button onClick={() => setShowMiEspacio(true)} className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black tracking-widest uppercase transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20" aria-label="Ir a Mi Espacio">
              <i className="fas fa-user"></i> Mi Espacio
            </button>
          )}
          <div className="bg-white dark:bg-dark-card p-1 rounded-2xl border border-gray-100 dark:border-dark-border flex shadow-xl shadow-gray-200/20">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <i className={`fas ${tab.icon}`}></i> {tab.label.toUpperCase()}
              </button>
            ))}
          </div>
          {canCreate && (
            <button onClick={openNewTask} className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl transition-all flex items-center font-black text-sm tracking-widest hover:scale-105 active:scale-95">
              <i className="fas fa-plus mr-3"></i> NUEVA TAREA
            </button>
          )}
        </div>
      </div>

      {activeTab === 'proyectos' && (
        <SDProjectsPanel projects={projects} tasks={topLevelTasks} onSelectProject={selectProject} />
      )}

      {activeTab === 'kanban' && (
        selectedProject ? (
          <div className="space-y-4">
            <select
              aria-label="Seleccionar proyecto"
              className="h-11 px-4 rounded-xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border text-sm font-bold outline-none"
              value={selectedProject.id}
              onChange={e => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.opportunityNumber} — {p.name}</option>)}
            </select>
            <SDKanbanBoard
              project={selectedProject}
              tasks={topLevelTasks.filter(t => t.projectId === selectedProject.id)}
              team={team}
              role={api.effectiveRole}
              onOpenTask={openTask}
              onMoveStatus={api.moveTaskStatus}
              onFinishAttempt={(taskId) => {
                const task = api.tasks.find(t => t.id === taskId);
                if (task) openTask(task);
              }}
            />
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400 italic text-sm">No hay proyectos disponibles.</div>
        )
      )}

      {activeTab === 'calendario' && (
        <SDCalendarView
          tasks={topLevelTasks}
          projects={projects}
          team={team}
          role={api.effectiveRole}
          onOpenTask={openTask}
          onChangeDate={api.changePlannedDate}
        />
      )}

      {activeTab === 'dashboard' && (
        <SDDashboardPanel tasks={topLevelTasks} timeEntries={api.timeEntries} dependencies={api.dependencies} />
      )}

      <SDTaskDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        defaultProjectId={selectedProject?.id}
        projects={projects}
        team={team}
        role={api.effectiveRole}
        currentMemberId={currentUserMember?.id}
        api={api}
        onOpenTask={openTask}
      />
    </div>
  );
};
