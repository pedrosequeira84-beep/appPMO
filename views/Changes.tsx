import React, { useState } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { Change, Project } from '../types';
import { supabase } from '../utils/supabase';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/helpers';

interface ChangeRowProps {
    change: Change;
    project?: Project;
    onEdit: (change: Change) => void;
    onDelete: (id: string) => void;
}

const ChangeRow: React.FC<ChangeRowProps> = ({ change, project, onEdit, onDelete }) => (
    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
        <td className="p-4">
            <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800 dark:text-white">{formatDate(change.date)}</span>
                <span className="text-[10px] text-gray-400 font-mono italic">Reg: {change.registrationNumber || 'N/A'}</span>
            </div>
        </td>
        <td className="p-4">
            <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{project?.name || 'N/A'}</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">{project?.clientName}</span>
                    <span className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded uppercase">{project?.opportunityNumber}</span>
                </div>
            </div>
        </td>
        <td className="p-4">
            <span className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                {change.type}
            </span>
        </td>
        <td className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xl line-clamp-2" title={change.description}>{change.description}</p>
        </td>
        <td className="p-4 text-right">
            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(change)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="Editar">
                    <i className="fas fa-edit text-sm"></i>
                </button>
                <button onClick={() => onDelete(change.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                    <i className="fas fa-trash text-sm"></i>
                </button>
            </div>
        </td>
    </tr>
);

export const ChangesView: React.FC = () => {
    const { changes, setChanges, projects, showToast, currentUserMember } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChange, setEditingChange] = useState<Change | null>(null);
    const [formData, setFormData] = useState<Partial<Change>>({});

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('Todos');
    const [selectedProjectId, setSelectedProjectId] = useState('Todos');
    const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

    const handleNew = () => {
        setEditingChange(null);
        setFormData({
            projectId: projects[0]?.id || '',
            type: 'Scope' as any,
            description: '',
            date: new Date().toISOString(),
            registrationNumber: ''
        });
        setIsModalOpen(true);
    };

    const handleEdit = (change: Change) => {
        setEditingChange(change);
        setFormData(change);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este registro de cambio?')) return;
        try {
            const { error } = await supabase.from('changes').delete().eq('id', id);
            if (error) throw error;
            setChanges(prev => prev.filter(c => c.id !== id));
            showToast('Cambio eliminado', 'success');
        } catch (err: any) {
            showToast('Error eliminando: ' + err.message, 'error');
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
                type: formData.type,
                date: formData.date || new Date().toISOString(),
                registration_number: formData.registrationNumber
            };

            if (editingChange) {
                const { error } = await supabase.from('changes').update(payload).eq('id', editingChange.id);
                if (error) throw error;
                setChanges(prev => prev.map(c => c.id === editingChange.id ? { ...c, ...formData } as Change : c));
                showToast('Cambio actualizado', 'success');
            } else {
                // Generar registrationNumber automáticamente SIEMPRE
                const project = projects.find(p => p.id === formData.projectId);
                const oppNumber = project?.opportunityNumber || 'S/N';
                const count = changes.filter(c => c.projectId === formData.projectId).length;
                const finalRegNumber = `${oppNumber}-CC-${count + 1}`;

                const payloadWithReg = { ...payload, registration_number: finalRegNumber };
                const { data, error } = await supabase.from('changes').insert([payloadWithReg]).select();
                if (error) throw error;
                const c = data[0];
                const newChange: Change = {
                    id: c.id, projectId: c.project_id, description: c.description,
                    type: c.type, date: c.date, createdAt: c.created_at,
                    registrationNumber: c.registration_number
                };
                setChanges(prev => [newChange, ...prev]);
                showToast('Cambio registrado', 'success');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            showToast('Error guardando: ' + err.message, 'error');
        }
    };

    const filteredChanges = React.useMemo(() => {
        return changes.filter(c => {
            const project = projects.find(p => p.id === c.projectId);
            const matchesSearch = (c.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.opportunityNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'Todos' || c.type === filterType;
            const matchesProject = selectedProjectId === 'Todos' || c.projectId === selectedProjectId;
            return matchesSearch && matchesType && matchesProject;
        });
    }, [changes, searchTerm, filterType, selectedProjectId, projects]);

    const sortedChanges = React.useMemo(() => {
        const statusOrder: Record<string, number> = {
            'En ejecución': 0,
            'Soporte': 1,
            'Intervención temprana': 2,
            'POC': 3,
            'Finalizado': 4
        };

        return [...filteredChanges].sort((a, b) => {
            const projA = projects.find(p => p.id === a.projectId);
            const projB = projects.find(p => p.id === b.projectId);
            if (!projA) return 1;
            if (!projB) return -1;

            const orderA = statusOrder[projA.status] ?? 99;
            const orderB = statusOrder[projB.status] ?? 99;
            if (orderA !== orderB) return orderA - orderB;

            if (projA.status === 'En ejecución') {
                const dateA = new Date(projA.createdAt || 0).getTime();
                const dateB = new Date(projB.createdAt || 0).getTime();
                if (dateA !== dateB) return dateB - dateA;
            }

            const nameComp = projA.name.localeCompare(projB.name);
            if (nameComp !== 0) return nameComp;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [filteredChanges, projects]);

    const groupedByProject = React.useMemo(() => {
        const groups: Record<string, Change[]> = {};
        sortedChanges.forEach(c => {
            if (!groups[c.projectId]) groups[c.projectId] = [];
            groups[c.projectId].push(c);
        });
        return groups;
    }, [sortedChanges]);

    return (
        <div className="fade-in space-y-10 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full uppercase tracking-[0.3em] mb-3 inline-block">Audit Trail</span>
                    <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">Control de Cambios</h2>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white dark:bg-dark-card p-1 rounded-2xl border border-gray-100 dark:border-dark-border flex shadow-xl shadow-gray-200/20">
                        <button onClick={() => setViewMode('grouped')} className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${viewMode === 'grouped' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-gray-600'}`}>
                            PROYECTOS
                        </button>
                        <button onClick={() => setViewMode('list')} className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-gray-600'}`}>
                            HISTORIAL
                        </button>
                    </div>
                    <button onClick={handleNew} className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-8 py-4 rounded-2xl shadow-2xl transition-all flex items-center font-black text-sm tracking-widest hover:scale-105 active:scale-95">
                        <i className="fas fa-plus mr-3"></i> REGISTRAR CAMBIO
                    </button>
                </div>
            </div>

            {/* Filtros Modernos */}
            <div className="bg-white dark:bg-dark-card p-8 rounded-[32px] border border-gray-50 dark:border-dark-border shadow-2xl shadow-gray-200/10 grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">Búsqueda Global</label>
                    <div className="relative group">
                        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors"></i>
                        <input type="text" placeholder="Proyecto, descripción o ID de oportunidad..." className="w-full h-14 pl-14 pr-6 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-blue-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">Tipo de Variación</label>
                    <select className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-blue-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none text-sm font-bold" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="Todos">Todos los tipos</option>
                        <option value="Scope">Alcance</option>
                        <option value="Timeline">Cronograma</option>
                        <option value="Budget">Presupuesto</option>
                        <option value="Resource">Recursos</option>
                        <option value="Other">Otros</option>
                    </select>
                </div>
                <div>
                    <SearchableSelect
                        label="Proyecto Específico"
                        options={[{ id: 'Todos', label: 'Todos los Proyectos' }, ...projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))]}
                        value={selectedProjectId}
                        onChange={(val) => setSelectedProjectId(val)}
                        placeholder="Buscar proyecto..."
                    />
                </div>
            </div>

            {viewMode === 'grouped' ? (
                <div className="space-y-16">
                    {Object.entries(groupedByProject).map(([projId, changes]) => {
                        const project = projects.find(p => p.id === projId);
                        const projChanges = changes as Change[];
                        return (
                            <div key={projId} className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="text-5xl font-black text-gray-100 dark:text-slate-800 pointer-events-none select-none">
                                        {projChanges.length < 10 ? `0${projChanges.length}` : projChanges.length}
                                    </div>
                                    <div className="flex-1 h-px bg-gray-100 dark:bg-slate-800"></div>
                                    <div className="text-right">
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-none">
                                            {project?.opportunityNumber} - {project?.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-2">{project?.clientName}</p>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-dark-card rounded-[32px] shadow-sm overflow-hidden border border-gray-100 dark:border-dark-border">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                                            <tr>
                                                <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                                <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Proyecto</th>
                                                <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                                <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</th>
                                                <th className="p-5"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                            {projChanges.map((c: Change) => (
                                                <ChangeRow key={c.id} change={c} project={project} onEdit={handleEdit} onDelete={handleDelete} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-card rounded-[40px] shadow-2xl shadow-gray-200/5 overflow-hidden border border-gray-100 dark:border-dark-border">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 dark:bg-slate-800/50">
                            <tr>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Proyecto</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</th>
                                <th className="p-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {sortedChanges.map(c => (
                                <ChangeRow key={c.id} change={c} project={projects.find(p => p.id === c.projectId)} onEdit={handleEdit} onDelete={handleDelete} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filteredChanges.length === 0 && (
                <div className="text-center py-40">
                    <div className="w-24 h-24 bg-gray-50 dark:bg-slate-800 rounded-[32px] flex items-center justify-center mx-auto mb-10 transform rotate-12">
                        <i className="fas fa-history text-gray-200 dark:text-slate-700 fa-3x -rotate-12"></i>
                    </div>
                    <h3 className="text-3xl font-black text-gray-800 dark:text-white mb-4">Registro impecable</h3>
                    <p className="text-gray-400 dark:text-gray-500 max-w-xs mx-auto text-sm font-medium">No se han encontrado cambios registrados que coincidan con tu búsqueda actual.</p>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-6">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="w-16 h-16 rounded-[24px] bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                            <i className="fas fa-exchange-alt fa-2x"></i>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black dark:text-white uppercase tracking-tighter leading-none mb-2">{editingChange ? 'Orden de Cambio' : 'Registrar Cambio'}</h3>
                            <p className="text-gray-500 font-medium tracking-tight">Registro oficial de desviación o ajuste</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="md:col-span-2">
                                <SearchableSelect
                                    label="Proyecto"
                                    options={projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))}
                                    value={formData.projectId}
                                    onChange={(val) => setFormData({ ...formData, projectId: val })}
                                    placeholder="Seleccionar proyecto..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 ml-1">Tipo de Variación</label>
                                <select className="w-full h-16 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 transition-all font-bold" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                                    <option value="Scope">Alcance</option>
                                    <option value="Timeline">Cronograma</option>
                                    <option value="Budget">Presupuesto</option>
                                    <option value="Resource">Recursos</option>
                                    <option value="Other">Otros</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 ml-1">Fecha Efectiva</label>
                                <input type="date" className="w-full h-16 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 transition-all font-bold" value={formData.date?.split('T')[0]} onChange={e => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 ml-1">Nro de Registro (Automático)</label>
                                <input type="text" className="w-full h-16 px-6 rounded-2xl bg-gray-100 dark:bg-slate-900 border-2 border-transparent font-bold cursor-not-allowed text-gray-400" value={formData.registrationNumber || 'Se generará al guardar'} readOnly />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 ml-1">Justificación y Descripción</label>
                                <textarea className="w-full p-8 rounded-[32px] bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 transition-all font-medium text-sm leading-relaxed" rows={12} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Describe detalladamente el cambio y su motivo..."></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-6 mt-16">
                        <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-xs font-black text-gray-400 hover:text-gray-600 tracking-widest uppercase">DESCARTAR</button>
                        <button onClick={handleSave} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all">
                            {editingChange ? 'ACTUALIZAR REGISTRO' : 'CONFIRMAR CAMBIO'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
