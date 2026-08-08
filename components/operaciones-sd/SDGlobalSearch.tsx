import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Project, SDComment, SDTask, TeamMember } from '../../types';

interface Props {
  projects: Project[];
  tasks: SDTask[];
  team: TeamMember[];
  comments: SDComment[];
  onSelectProject: (projectId: string) => void;
  onOpenTask: (task: SDTask) => void;
}

const SDGlobalSearch: React.FC<Props> = ({ projects, tasks, team, comments, onSelectProject, onOpenTask }) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = term.toLowerCase().trim();

  const matchedProjects = useMemo(() => {
    if (!q) return [];
    return projects.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.clientName || '').toLowerCase().includes(q) ||
      (p.pm || '').toLowerCase().includes(q) ||
      (p.opportunityNumber || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }, [projects, q]);

  const matchedTasks = useMemo(() => {
    if (!q) return [];
    return tasks.filter(t => {
      const assignee = team.find(m => m.id === t.assigneeMemberId);
      return (t.title || '').toLowerCase().includes(q) ||
        (t.code || '').toLowerCase().includes(q) ||
        (t.vendorName || '').toLowerCase().includes(q) ||
        (assignee?.name || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q));
    }).slice(0, 6);
  }, [tasks, team, q]);

  const matchedComments = useMemo(() => {
    if (!q) return [];
    return comments.filter(c => (c.body || '').toLowerCase().includes(q)).slice(0, 4);
  }, [comments, q]);

  const hasResults = matchedProjects.length + matchedTasks.length + matchedComments.length > 0;

  return (
    <div className="relative w-full max-w-sm" ref={wrapperRef}>
      <div className="relative">
        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
        <input
          aria-label="Búsqueda global en Operaciones S&D"
          className="w-full h-11 pl-11 pr-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-blue-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm font-medium"
          placeholder="Buscar proyecto, tarea, responsable, vendor, etiqueta..."
          value={term}
          onChange={e => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && q && (
        <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-96 overflow-y-auto">
          {!hasResults && <p className="p-4 text-xs text-gray-400 italic text-center">Sin resultados para "{term}"</p>}

          {matchedProjects.length > 0 && (
            <div className="p-2">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2 py-1">Proyectos</p>
              {matchedProjects.map(p => (
                <button key={p.id} onClick={() => { onSelectProject(p.id); setOpen(false); setTerm(''); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 flex flex-col">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{p.opportunityNumber} — {p.name}</span>
                  <span className="text-[10px] text-gray-400">{p.clientName} · {p.pm}</span>
                </button>
              ))}
            </div>
          )}

          {matchedTasks.length > 0 && (
            <div className="p-2 border-t border-gray-50 dark:border-slate-700">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2 py-1">Tareas</p>
              {matchedTasks.map(t => (
                <button key={t.id} onClick={() => { onOpenTask(t); setOpen(false); setTerm(''); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 flex flex-col">
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{t.code} — {t.title}</span>
                  <span className="text-[10px] text-gray-400">{team.find(m => m.id === t.assigneeMemberId)?.name || 'Sin asignar'}{t.vendorName ? ` · ${t.vendorName}` : ''}</span>
                </button>
              ))}
            </div>
          )}

          {matchedComments.length > 0 && (
            <div className="p-2 border-t border-gray-50 dark:border-slate-700">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2 py-1">Comentarios</p>
              {matchedComments.map(c => {
                const task = tasks.find(t => t.id === c.taskId);
                if (!task) return null;
                return (
                  <button key={c.id} onClick={() => { onOpenTask(task); setOpen(false); setTerm(''); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 flex flex-col">
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{task.code}</span>
                    <span className="text-[10px] text-gray-400 truncate">"{c.body}"</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SDGlobalSearch;
