import React, { useState } from 'react';
import { Project, SDTask } from '../../types';

interface Props {
  projects: Project[];
  tasks: SDTask[];
  onSelectProject: (projectId: string) => void;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'En ejecución': return 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400';
    case 'Finalizado': return 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400';
    case 'Soporte': return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';
    default: return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
  }
};

const SDProjectsPanel: React.FC<Props> = ({ projects, tasks, onSelectProject }) => {
  const [search, setSearch] = useState('');

  const filtered = projects.filter(p => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (p.name || '').toLowerCase().includes(s) || (p.clientName || '').toLowerCase().includes(s) || (p.opportunityNumber || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
        <input
          className="w-full h-12 pl-11 pr-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-blue-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm font-medium"
          placeholder="Buscar proyecto, cliente o código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(p => {
          const projectTasks = tasks.filter(t => t.projectId === p.id);
          const backlog = projectTasks.filter(t => t.status === 'backlog').length;
          const wip = projectTasks.filter(t => t.status === 'in_progress').length;
          const done = projectTasks.filter(t => t.status === 'done').length;
          return (
            <button
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className="text-left bg-white dark:bg-dark-card rounded-[24px] border border-gray-100 dark:border-dark-border p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider">{p.opportunityNumber}</span>
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${statusBadge(p.status)}`}>{p.status}</span>
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight mb-1 line-clamp-2">{p.name}</h3>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{p.clientName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                <i className="fas fa-user-tie text-indigo-400 mr-1.5"></i>{p.pm}
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-gray-50 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider">
                <span className="text-gray-400">{backlog} Backlog</span>
                <span className="text-blue-500">{wip} WIP</span>
                <span className="text-emerald-500">{done} Done</span>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-400 italic text-sm">No se encontraron proyectos.</div>
        )}
      </div>
    </div>
  );
};

export default SDProjectsPanel;
