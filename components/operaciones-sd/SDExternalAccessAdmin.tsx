import React, { useEffect, useState } from 'react';
import { useApp } from '../../AppContext';
import { supabase } from '../../utils/supabase';
import { SDExternalAccess, DBSDExternalAccess, DBSDTask } from '../../types';

const mapAccess = (a: DBSDExternalAccess): SDExternalAccess => ({
  id: a.id, memberId: a.member_id, projectId: a.project_id, taskId: a.task_id,
  grantedBy: a.granted_by, grantedAt: a.granted_at
});

const SDExternalAccessAdmin: React.FC = () => {
  const { team, projects, user, showToast } = useApp();
  const externalMembers = team.filter(m => m.isExternal);

  const [grants, setGrants] = useState<SDExternalAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [projectTasks, setProjectTasks] = useState<DBSDTask[]>([]);

  const loadGrants = async () => {
    const { data } = await supabase.from('sd_external_access').select('*');
    if (data) setGrants(data.map(mapAccess));
  };

  useEffect(() => { loadGrants(); }, []);

  useEffect(() => {
    if (!projectId) { setProjectTasks([]); return; }
    supabase.from('sd_tasks').select('*').eq('project_id', projectId).then(({ data }) => {
      if (data) setProjectTasks(data as DBSDTask[]);
    });
  }, [projectId]);

  if (externalMembers.length === 0) return null;

  const handleGrant = async () => {
    if (!memberId || !projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('sd_external_access').insert([{
        member_id: memberId, project_id: projectId, task_id: taskId || null, granted_by: user?.email || null
      }]).select();
      if (error) throw error;
      setGrants(prev => [...prev, mapAccess(data[0])]);
      setTaskId('');
      showToast('Acceso otorgado', 'success');
    } catch (err: any) {
      showToast('Error otorgando acceso: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('¿Revocar este acceso externo?')) return;
    try {
      const { error } = await supabase.from('sd_external_access').delete().eq('id', id);
      if (error) throw error;
      setGrants(prev => prev.filter(g => g.id !== id));
      showToast('Acceso revocado', 'info');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="mt-8 bg-white dark:bg-dark-card rounded-xl shadow border border-gray-200 dark:border-dark-border p-6">
      <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Accesos Externos — Operaciones S&D</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Los usuarios marcados como "Externo" solo pueden ver Operaciones S&D, y únicamente los proyectos/tareas que se les habiliten acá (sin seleccionar tarea = todo el proyecto).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <select value={memberId} onChange={e => setMemberId(e.target.value)} className="border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white text-sm">
          <option value="">Usuario externo...</option>
          {externalMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={projectId} onChange={e => { setProjectId(e.target.value); setTaskId(''); }} className="border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white text-sm">
          <option value="">Proyecto...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.opportunityNumber} - {p.name}</option>)}
        </select>
        <select value={taskId} onChange={e => setTaskId(e.target.value)} disabled={!projectId} className="border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 dark:bg-slate-700 dark:text-white text-sm disabled:opacity-50">
          <option value="">Todo el proyecto</option>
          {projectTasks.map(t => <option key={t.id} value={t.id}>{t.code} — {t.title}</option>)}
        </select>
        <button onClick={handleGrant} disabled={loading || !memberId || !projectId} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium">
          <i className="fas fa-plus mr-1"></i> Otorgar Acceso
        </button>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {grants.map(g => {
          const member = team.find(m => m.id === g.memberId);
          const project = projects.find(p => p.id === g.projectId);
          return (
            <div key={g.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span className="font-bold text-gray-700 dark:text-gray-200">{member?.name || '—'}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="text-gray-600 dark:text-gray-300">{project?.name || '—'}</span>
                {g.taskId && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">solo 1 tarea</span>}
              </div>
              <button onClick={() => handleRevoke(g.id)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase">Revocar</button>
            </div>
          );
        })}
        {grants.length === 0 && <p className="text-sm text-gray-400 italic py-4">Sin accesos externos otorgados todavía.</p>}
      </div>
    </div>
  );
};

export default SDExternalAccessAdmin;
