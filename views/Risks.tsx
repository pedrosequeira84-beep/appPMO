import React, { useState } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { Risk, Project } from '../types';
import { supabase } from '../utils/supabase';
import SearchableSelect from '../components/SearchableSelect';

interface RiskCardProps {
    risk: Risk;
    project?: Project;
    onEdit: (risk: Risk) => void;
    onDelete: (id: string) => void;
    getImpactColor: (impact: string) => string;
}

const RiskCard: React.FC<RiskCardProps> = ({ risk, project, onEdit, onDelete, getImpactColor }) => (
    <div className={`bg-white dark:bg-dark-card rounded-xl shadow-sm border-l-4 ${getImpactColor(risk.impact)} p-5 flex flex-col hover:shadow-md transition-all ${risk.isMitigated ? 'opacity-60 grayscale-[0.3]' : ''}`}>
        <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-800 dark:text-white line-clamp-1">{project?.name || 'Proyecto Desconocido'}</h4>
                    {risk.isMitigated && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Mitigado</span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium"><i className="fas fa-building mr-1"></i>{project?.clientName}</span>
                    <span className="text-[10px] text-indigo-500 font-mono">{project?.opportunityNumber}</span>
                </div>
            </div>
            <div className="flex gap-1 ml-2">
                <button onClick={() => onEdit(risk)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Editar">
                    <i className="fas fa-edit text-sm"></i>
                </button>
                <button onClick={() => onDelete(risk.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><i className="fas fa-trash text-sm"></i></button>
            </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 line-clamp-3" title={risk.description}>{risk.description}</p>

        {risk.plan && (
            <div className="mb-4 p-2 bg-gray-50 dark:bg-slate-800/50 rounded text-xs border border-gray-100 dark:border-slate-700">
                <span className="font-bold block mb-1 text-gray-700 dark:text-gray-300">Plan de Mitigación:</span>
                <span className="text-gray-500 dark:text-gray-400 line-clamp-2">{risk.plan}</span>
            </div>
        )}

        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider pt-3 border-t dark:border-slate-800">
            <div className="flex gap-3">
                <span className="flex items-center"><i className="fas fa-dice mr-1 text-gray-300"></i>P: {risk.probability}</span>
                <span className="flex items-center"><i className="fas fa-impact mr-1 text-gray-300"></i>I: {risk.impact}</span>
            </div>
            {risk.isProblem && (
                <span className="text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded flex items-center gap-1">
                    <i className="fas fa-exclamation-circle text-[8px]"></i> PROBLEMA
                </span>
            )}
        </div>
    </div>
);

export const RisksView: React.FC = () => {
    const { risks, setRisks, projects, showToast } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [formData, setFormData] = useState<Partial<Risk>>({});

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterImpact, setFilterImpact] = useState('Todos');
    const [filterStatus, setFilterStatus] = useState<'Activos' | 'Mitigados' | 'Todos'>('Activos');
    const [selectedProjectId, setSelectedProjectId] = useState('Todos');
    const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

    const handleNew = () => {
        setEditingRisk(null);
        setFormData({
            projectId: projects[0]?.id || '',
            probability: 'Media',
            impact: 'Medio',
            description: '',
            plan: '',
            isProblem: false,
            isMitigated: false,
            date: new Date().toISOString()
        });
        setIsModalOpen(true);
    };

    const handleEdit = (risk: Risk) => {
        setEditingRisk(risk);
        setFormData(risk);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este riesgo?')) return;
        try {
            const { error } = await supabase.from('risks').delete().eq('id', id);
            if (error) throw error;
            setRisks(prev => prev.filter(r => r.id !== id));
            showToast('Riesgo eliminado', 'success');
        } catch (err: unknown) {
            showToast('Error eliminando: ' + (err instanceof Error ? err.message : String(err)), 'error');
        }
    };

    const handleSave = async () => {
        if (!formData.description || !formData.projectId) {
            return showToast('Complete la descripción y seleccione un proyecto', 'error');
        }

        try {
            const payload = {
                project_id: formData.projectId,
                description: formData.description,
                probability: formData.probability,
                impact: formData.impact,
                is_problem: formData.isProblem,
                is_mitigated: formData.isMitigated,
                plan: formData.plan,
                date: formData.date || new Date().toISOString()
            };

            if (editingRisk) {
                const { error } = await supabase.from('risks').update(payload).eq('id', editingRisk.id);
                if (error) throw error;
                setRisks(prev => prev.map(r => r.id === editingRisk.id ? { ...r, ...payload as any, projectId: payload.project_id, isProblem: payload.is_problem, isMitigated: payload.is_mitigated } as Risk : r));
                showToast('Riesgo actualizado', 'success');
            } else {
                const { data, error } = await supabase.from('risks').insert([payload]).select();
                if (error) throw error;
                const r = data[0];
                const newRisk: Risk = {
                    id: r.id, projectId: r.project_id, description: r.description,
                    probability: r.probability, impact: r.impact, isProblem: r.is_problem,
                    isMitigated: r.is_mitigated,
                    plan: r.plan, date: r.date, createdAt: r.created_at
                };
                setRisks(prev => [newRisk, ...prev]);
                showToast('Riesgo registrado', 'success');
            }
            setIsModalOpen(false);
        } catch (err: unknown) {
            showToast('Error guardando: ' + (err instanceof Error ? err.message : String(err)), 'error');
        }
    };

    const filteredRisks = React.useMemo(() => {
        return risks.filter(r => {
            const project = projects.find(p => p.id === r.projectId);
            const matchesSearch = String(r.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(project?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(project?.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(project?.opportunityNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesImpact = filterImpact === 'Todos' || r.impact === filterImpact;
            const matchesProject = selectedProjectId === 'Todos' || r.projectId === selectedProjectId;
            const matchesStatus = filterStatus === 'Todos' || (filterStatus === 'Activos' ? !r.isMitigated : r.isMitigated);
            return matchesSearch && matchesImpact && matchesProject && matchesStatus;
        });
    }, [risks, searchTerm, filterImpact, selectedProjectId, filterStatus, projects]);

    const sortedProjectsWithRisks = React.useMemo(() => {
        const statusOrder: Record<string, number> = {
            'En ejecución': 0,
            'Soporte': 1,
            'Intervención temprana': 2,
            'Finalizado': 3
        };

        const projectIds = Array.from(new Set(filteredRisks.map(r => r.projectId)));

        return projects
            .filter(p => projectIds.includes(p.id))
            .sort((a, b) => {
                const orderA = statusOrder[a.status] ?? 99;
                const orderB = statusOrder[b.status] ?? 99;
                if (orderA !== orderB) return orderA - orderB;
                if (a.status === 'En ejecución') {
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                }
                return a.name.localeCompare(b.name);
            });
    }, [projects, filteredRisks]);

    const risksByProject = React.useMemo(() => {
        const groups: Record<string, Risk[]> = {};
        filteredRisks.forEach(r => {
            if (!groups[r.projectId]) groups[r.projectId] = [];
            groups[r.projectId].push(r);
        });
        return groups;
    }, [filteredRisks]);

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'Alto': return 'border-red-500';
            case 'Medio': return 'border-yellow-500';
            case 'Bajo': return 'border-green-500';
            default: return 'border-gray-300';
        }
    };

    return (
        <div className="fade-in space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold dark:text-white">Matriz de Riesgos</h2>
                    <p className="text-gray-500 dark:text-gray-400">Garantizando la continuidad de los proyectos</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white dark:bg-dark-card p-1 rounded-lg border border-gray-200 dark:border-dark-border flex shadow-sm">
                        <button onClick={() => setViewMode('grouped')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'grouped' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            <i className="fas fa-layer-group mr-2"></i>Por Proyecto
                        </button>
                        <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            <i className="fas fa-list mr-2"></i>Vista General
                        </button>
                    </div>
                    <button onClick={handleNew} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg shadow-md transition-all flex items-center font-bold">
                        <i className="fas fa-exclamation-triangle mr-2"></i> IDENTIFICAR RIESGO
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Buscador Inteligente</label>
                    <div className="relative">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" placeholder="Busca por proyecto, descripción o palabras clave..." className="input-field pl-12 h-11 bg-gray-50 dark:bg-slate-800/50 border-transparent focus:bg-white dark:focus:bg-slate-800" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Impacto</label>
                    <select className="input-field h-11 bg-gray-50 dark:bg-slate-800/50 border-transparent" value={filterImpact} onChange={e => setFilterImpact(e.target.value)}>
                        <option value="Todos">Cualquier Impacto</option>
                        <option value="Bajo">Bajo</option>
                        <option value="Medio">Medio</option>
                        <option value="Alto">Alto</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Estado</label>
                    <select className="input-field h-11 bg-gray-50 dark:bg-slate-800/50 border-transparent" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                        <option value="Activos">Riesgos Activos</option>
                        <option value="Mitigados">Mitigados</option>
                        <option value="Todos">Ver Todos</option>
                    </select>
                </div>
                <div>
                    <SearchableSelect
                        label="Filtrar Proyecto"
                        options={[{ id: 'Todos', label: 'Todos los Proyectos' }, ...projects.map(p => ({ id: p.id, label: p.name }))]}
                        value={selectedProjectId}
                        onChange={(val) => setSelectedProjectId(val)}
                        placeholder="Buscar proyecto..."
                        className="h-11"
                    />
                </div>
            </div>

            {viewMode === 'grouped' ? (
                <div className="space-y-10">
                    {sortedProjectsWithRisks.map((project) => {
                        const projRisks = risksByProject[project.id] || [];
                        return (
                            <div key={project.id} className="space-y-4">
                                <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-100 dark:border-slate-800">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                        {projRisks.length}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-gray-800 dark:text-white leading-tight">
                                            {project?.opportunityNumber} - {project?.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{project?.clientName}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 rounded">{project?.opportunityNumber}</span>
                                        </div>
                                    </div>
                                    <div className="ml-auto flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Riesgos Activos</p>
                                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-none">{projRisks.length}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {projRisks.map((risk: Risk) => (
                                        <RiskCard key={risk.id} risk={risk} project={project} onEdit={handleEdit} onDelete={handleDelete} getImpactColor={getImpactColor} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredRisks.map(risk => (
                        <RiskCard key={risk.id} risk={risk} project={projects.find(p => p.id === risk.projectId)} onEdit={handleEdit} onDelete={handleDelete} getImpactColor={getImpactColor} />
                    ))}
                </div>
            )}

            {filteredRisks.length === 0 && (
                <div className="text-center py-32 bg-white dark:bg-dark-card rounded-2xl border-4 border-dashed border-gray-50 dark:border-slate-800/50">
                    <div className="bg-gray-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-search text-gray-300 dark:text-slate-600 fa-2x"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No se encontraron resultados</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm">Prueba ajustando los filtros o el buscador para encontrar lo que necesitas.</p>
                    <button onClick={() => { setSearchTerm(''); setFilterImpact('Todos'); setSelectedProjectId('Todos'); }} className="mt-6 text-indigo-600 font-bold hover:underline">Restablecer filtros</button>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-2">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                            <i className="fas fa-shield-alt fa-lg"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">{editingRisk ? 'Editar Riesgo' : 'Identificar Riesgo'}</h3>
                            <p className="text-sm text-gray-500">Mantenemos el control sobre las incertidumbres</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <SearchableSelect
                                    label="Seleccionar Proyecto"
                                    options={projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))}
                                    value={formData.projectId}
                                    onChange={(val) => setFormData({ ...formData, projectId: val })}
                                    placeholder="Elige un proyecto..."
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Descripción del Riesgo</label>
                                <textarea className="w-full input-field bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm p-4 rounded-xl" rows={10} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="¿Qué evento incierto podría impactar negativamente?"></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Probabilidad</label>
                                <select className="w-full input-field h-12 bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm font-bold px-4 rounded-xl" value={formData.probability} onChange={e => setFormData({ ...formData, probability: e.target.value as any })}>
                                    <option value="Baja">Baja</option>
                                    <option value="Media">Media</option>
                                    <option value="Alta">Alta</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Impacto</label>
                                <select className="w-full input-field h-12 bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm font-bold px-4 rounded-xl" value={formData.impact} onChange={e => setFormData({ ...formData, impact: e.target.value as any })}>
                                    <option value="Bajo">Bajo</option>
                                    <option value="Medio">Medio</option>
                                    <option value="Alto">Alto</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Plan de Mitigación / Contingencia</label>
                                <textarea className="w-full input-field bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm p-4 rounded-xl" rows={8} value={formData.plan} onChange={e => setFormData({ ...formData, plan: e.target.value })} placeholder="Acciones preventivas o reactivas..."></textarea>
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                                    <div className="flex items-center h-5">
                                        <input type="checkbox" id="isProblem" checked={formData.isProblem} onChange={e => setFormData({ ...formData, isProblem: e.target.checked })} className="w-5 h-5 text-red-600 rounded-lg border-red-300 focus:ring-red-500 cursor-pointer" />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="isProblem" className="font-bold text-red-800 dark:text-red-300 cursor-pointer">¿Es un Problema?</label>
                                        <p className="text-red-600/70 dark:text-red-400/60 text-[10px]">Materializado</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                                    <div className="flex items-center h-5">
                                        <input type="checkbox" id="isMitigated" checked={formData.isMitigated} onChange={e => setFormData({ ...formData, isMitigated: e.target.checked })} className="w-5 h-5 text-emerald-600 rounded-lg border-emerald-300 focus:ring-emerald-500 cursor-pointer" />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="isMitigated" className="font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer">¿Riesgo Mitigado?</label>
                                        <p className="text-emerald-600/70 dark:text-emerald-400/60 text-[10px]">Ya no es activo</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-10 pt-6 border-t dark:border-slate-800">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors">CANCELAR</button>
                        <button onClick={handleSave} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20 transition-all">
                            {editingRisk ? 'ACTUALIZAR RIESGO' : 'IDENTIFICAR RIESGO'}
                        </button>
                    </div>
                </div>
            </Modal >
        </div >
    );
};
