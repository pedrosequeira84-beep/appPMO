import React, { useState } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { Change, Project } from '../types';
import { supabase } from '../utils/supabase';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/helpers';
import { exportTimelineToExcel, downloadTimelineWordReport, getDaysDiff } from '../utils/timelineExport';


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
    const [selectedProjectId, setSelectedProjectId] = useState(() => {
        const saved = localStorage.getItem('changes_selected_project_id');
        if (saved) {
            localStorage.removeItem('changes_selected_project_id');
            return saved;
        }
        return 'Todos';
    });
    const [preselectedProjectIds, setPreselectedProjectIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('changes_selected_project_ids');
        if (saved) {
            localStorage.removeItem('changes_selected_project_ids');
            try {
                return JSON.parse(saved);
            } catch {
                return [];
            }
        }
        return [];
    });
    const [viewMode, setViewMode] = useState<'grouped' | 'list' | 'timeline'>(() => {
        const saved = localStorage.getItem('changes_view_mode');
        if (saved === 'timeline' || saved === 'grouped' || saved === 'list') {
            localStorage.removeItem('changes_view_mode');
            return saved as any;
        }
        return 'grouped';
    });

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

    const matchingProjects = React.useMemo(() => {
        return projects.filter(p => {
            if (preselectedProjectIds.length > 0 && !preselectedProjectIds.includes(p.id)) return false;
            if (selectedProjectId !== 'Todos' && p.id !== selectedProjectId) return false;
            
            const searchLower = searchTerm.toLowerCase().trim();
            if (!searchLower) return true;
            
            return (p.name || '').toLowerCase().includes(searchLower) ||
                (p.clientName || '').toLowerCase().includes(searchLower) ||
                (p.pm || '').toLowerCase().includes(searchLower) ||
                (p.opportunityNumber || '').toLowerCase().includes(searchLower);
        }).sort((a, b) => {
            const devA = a.realEndDate ? getDaysDiff(a.theoreticalEndDate, a.realEndDate) : 0;
            const devB = b.realEndDate ? getDaysDiff(b.theoreticalEndDate, b.realEndDate) : 0;
            if (devA !== devB) return devB - devA;
            return a.name.localeCompare(b.name);
        });
    }, [projects, selectedProjectId, searchTerm, preselectedProjectIds]);

    const metrics = React.useMemo(() => {
        let totalDays = 0;
        let delayedCount = 0;
        const typeTally: Record<string, number> = {};

        matchingProjects.forEach(p => {
            const dev = p.realEndDate ? getDaysDiff(p.theoreticalEndDate, p.realEndDate) : 0;
            if (dev > 0) {
                totalDays += dev;
                delayedCount++;
            }

            const history = p.dateChangeHistory || [];
            history.forEach(entry => {
                const shift = entry.previousDate ? getDaysDiff(entry.previousDate, entry.newDate) : 0;
                if (shift > 0) {
                    const associatedChanges = changes.filter(c => entry.changeIds.includes(c.id));
                    associatedChanges.forEach(c => {
                        const typeLabel = c.type === 'Scope' ? 'Alcance' :
                                        c.type === 'Timeline' ? 'Cronograma' :
                                        c.type === 'Budget' ? 'Presupuesto' :
                                        c.type === 'Resource' ? 'Recursos' : 'Otros';
                        typeTally[typeLabel] = (typeTally[typeLabel] || 0) + shift;
                    });
                }
            });
        });

        let topDriver = 'Ninguno';
        let maxDays = 0;
        Object.entries(typeTally).forEach(([type, days]) => {
            if (days > maxDays) {
                maxDays = days;
                topDriver = type;
            }
        });

        const avgDev = matchingProjects.length > 0 ? Math.round(totalDays / matchingProjects.length) : 0;

        return {
            totalDays,
            delayedCount,
            totalCount: matchingProjects.length,
            avgDev,
            topDriver,
            topDriverDays: maxDays
        };
    }, [matchingProjects, changes]);

    const copyPPTResumen = () => {
        let text = "REPORTE DE DESVÍOS Y CONTROL DE CAMBIOS - PMO BGH TECH PARTNER\n";
        text += `Generado el: ${new Date().toLocaleDateString('es-AR')}\n`;
        text += "========================================================================\n\n";

        matchingProjects.forEach(p => {
            const netDev = p.realEndDate ? getDaysDiff(p.theoreticalEndDate, p.realEndDate) : 0;
            text += `PROYECTO: ${p.opportunityNumber} - ${p.name}\n`;
            text += `Cliente: ${p.clientName} | PM: ${p.pm}\n`;
            text += `Cronograma: ${formatDate(p.startDate)} al ${formatDate(p.theoreticalEndDate)} (Original) ➔ ${p.realEndDate ? formatDate(p.realEndDate) : formatDate(p.theoreticalEndDate)} (Real actual)\n`;
            text += `Desvío Total: ${netDev > 0 ? `+${netDev} días` : 'En Cronograma'}\n`;
            text += "Historial de Cambios:\n";
            
            const history = p.dateChangeHistory || [];
            if (history.length > 0) {
                history.forEach((entry, idx) => {
                    const shift = entry.previousDate ? getDaysDiff(entry.previousDate, entry.newDate) : 0;
                    const associated = changes.filter(c => entry.changeIds.includes(c.id));
                    const ref = associated.map(c => c.registrationNumber).join(', ') || 'N/A';
                    const desc = associated.map(c => c.description).join(' | ') || 'Sin justificación';
                    text += `  [${idx + 1}] ${formatDate(entry.changedAt)}: ${entry.previousDate ? formatDate(entry.previousDate) : 'Inicio'} ➔ ${formatDate(entry.newDate)} (+${shift}d) | Ref: ${ref} | Motivo: ${desc}\n`;
                });
            } else {
                text += "  (Sin desvíos de cronograma registrados)\n";
            }
            text += "------------------------------------------------------------------------\n\n";
        });

        navigator.clipboard.writeText(text);
        showToast("Resumen copiado al portapapeles", "success");
    };

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
                        <button onClick={() => setViewMode('timeline')} className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:text-gray-600'}`}>
                            DESVÍOS DE TIEMPO
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

            {preselectedProjectIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-4 bg-indigo-50/50 dark:bg-slate-800/50 rounded-2xl border border-indigo-100 dark:border-slate-800/60 animate-in fade-in">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mr-2">Filtro Activo de Proyectos:</span>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm border dark:border-slate-600">
                        <span className="text-gray-500 dark:text-gray-400">Proyectos Seleccionados:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{preselectedProjectIds.length} ítems</span>
                        <button onClick={() => setPreselectedProjectIds([])} className="text-gray-400 hover:text-red-500 transition-colors ml-1" title="Limpiar filtro de selección">
                            <i className="fas fa-times-circle"></i>
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'timeline' ? (
                <div className="space-y-12 animate-in fade-in duration-300">
                    {/* Metapanel Ejecutivo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white dark:bg-dark-card p-6 rounded-[24px] border border-gray-100 dark:border-dark-border shadow-lg shadow-gray-200/5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Desvío Acumulado</p>
                            <h4 className="text-3xl font-black text-red-500 flex items-baseline gap-1">
                                {metrics.totalDays} <span className="text-xs font-bold text-gray-400">días</span>
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Suma de desplazamientos de fecha</p>
                        </div>
                        <div className="bg-white dark:bg-dark-card p-6 rounded-[24px] border border-gray-100 dark:border-dark-border shadow-lg shadow-gray-200/5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Proyectos Desviados</p>
                            <h4 className="text-3xl font-black text-indigo-600 flex items-baseline gap-1">
                                {metrics.delayedCount} <span className="text-xs font-bold text-gray-400">/ {metrics.totalCount}</span>
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Proyectos activos con demoras</p>
                        </div>
                        <div className="bg-white dark:bg-dark-card p-6 rounded-[24px] border border-gray-100 dark:border-dark-border shadow-lg shadow-gray-200/5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Promedio Desvío</p>
                            <h4 className="text-3xl font-black text-amber-500 flex items-baseline gap-1">
                                {metrics.avgDev} <span className="text-xs font-bold text-gray-400">días</span>
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Retraso medio por proyecto</p>
                        </div>
                        <div className="bg-white dark:bg-dark-card p-6 rounded-[24px] border border-gray-100 dark:border-dark-border shadow-lg shadow-gray-200/5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Principal Causa</p>
                            <h4 className="text-base font-black text-purple-600 truncate mt-1.5" title={metrics.topDriver}>
                                {metrics.topDriver}
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">Driver con más impacto ({metrics.topDriverDays}d)</p>
                        </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-100 dark:bg-slate-800/40 p-5 rounded-[24px] border dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <i className="fas fa-info-circle text-indigo-500"></i>
                            Exporta el informe consolidado filtrado actualmente
                        </span>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={() => exportTimelineToExcel(matchingProjects, changes)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all tracking-wider shadow-lg shadow-emerald-500/10 hover:scale-105 active:scale-95">
                                <i className="fas fa-file-excel"></i> EXPORTAR EXCEL
                            </button>
                            <button onClick={() => downloadTimelineWordReport(matchingProjects, changes)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs transition-all tracking-wider shadow-lg shadow-blue-500/10 hover:scale-105 active:scale-95">
                                <i className="fas fa-file-word"></i> DESCARGAR WORD (.DOC)
                            </button>
                            <button onClick={copyPPTResumen} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all tracking-wider shadow-lg shadow-indigo-500/10 hover:scale-105 active:scale-95">
                                <i className="fas fa-copy"></i> COPIAR PARA PPT
                            </button>
                        </div>
                    </div>

                    {/* Listado de Tarjetas */}
                    <div className="space-y-8">
                        {matchingProjects.length > 0 ? (
                            matchingProjects.map(p => {
                                const duration = getDaysDiff(p.startDate, p.theoreticalEndDate) || 1;
                                const dev = p.realEndDate ? getDaysDiff(p.theoreticalEndDate, p.realEndDate) : 0;
                                const isDelayed = dev > 0;
                                const timelineHistory = p.dateChangeHistory || [];

                                return (
                                    <div key={p.id} className="bg-white dark:bg-dark-card p-8 rounded-[32px] border border-gray-100 dark:border-dark-border shadow-2xl shadow-gray-200/5 space-y-8">
                                        {/* Cabecera Tarjeta */}
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-50 dark:border-slate-800/80 pb-6">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2.5 flex-wrap">
                                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest">{p.opportunityNumber || 'S/N'}</span>
                                                    <span className="text-[9px] font-black text-gray-500 bg-gray-50 dark:bg-slate-800 px-3 py-1 rounded-full uppercase">{p.clientName || 'Sin Cliente'}</span>
                                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${p.status === 'Finalizado' ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400' : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'}`}>{p.status}</span>
                                                </div>
                                                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{p.name}</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3 flex items-center gap-1.5">
                                                    <i className="fas fa-user-tie text-indigo-500"></i> PM: <span className="text-gray-700 dark:text-gray-300">{p.pm || 'Sin PM'}</span>
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Desvío de Cronograma</span>
                                                    {isDelayed ? (
                                                        <span className={`px-4 py-2 rounded-2xl text-xs font-black tracking-wider flex items-center gap-2 border shadow-sm ${dev > 15 ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'}`}>
                                                            <i className="fas fa-exclamation-triangle"></i>
                                                            +{dev} DÍAS ({dev > 15 ? 'CRÍTICO' : 'MODERADO'})
                                                        </span>
                                                    ) : (
                                                        <span className="px-4 py-2 bg-green-50 text-green-700 border border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30 rounded-2xl text-xs font-black tracking-wider flex items-center gap-2 shadow-sm">
                                                            <i className="fas fa-check-circle"></i>
                                                            AL DÍA / SIN DESVÍOS
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resumen de Fechas Hito */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-gray-50 dark:bg-slate-800/10 p-5 rounded-2xl border border-gray-100/50 dark:border-slate-800/40">
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Fecha Inicio Original</span>
                                                <span className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                    <i className="fas fa-calendar-alt text-indigo-500"></i> {formatDate(p.startDate)}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-slate-800/10 p-5 rounded-2xl border border-gray-100/50 dark:border-slate-800/40">
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Fin Teórico Planificado</span>
                                                <span className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                    <i className="fas fa-calendar-alt text-indigo-500"></i> {formatDate(p.theoreticalEndDate)}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-slate-800/10 p-5 rounded-2xl border border-gray-100/50 dark:border-slate-800/40">
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Fin Estimado Real</span>
                                                <span className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                    <i className="fas fa-calendar-check text-indigo-500"></i> {p.realEndDate ? formatDate(p.realEndDate) : formatDate(p.theoreticalEndDate)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Proporción Gráfica */}
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                <span>Planificación Original ({duration} días)</span>
                                                {isDelayed && <span className="text-red-500 font-bold">Desplazamiento (+{dev} días)</span>}
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800/60 rounded-full h-6 overflow-hidden flex shadow-inner border dark:border-slate-800">
                                                <div className="bg-indigo-600 h-full text-[9px] font-black text-white flex items-center justify-center transition-all border-r border-indigo-700/20" style={{ width: `${Math.round((duration / (duration + dev)) * 100)}%` }}>
                                                    Teórico Original ({duration}d)
                                                </div>
                                                {isDelayed && (
                                                    <div className="bg-red-500 h-full text-[9px] font-black text-white flex items-center justify-center" style={{ width: `${Math.round((dev / (duration + dev)) * 100)}%` }}>
                                                        +{dev}d ({Math.round((dev / duration) * 100)}%)
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Historial Timeline Vertical */}
                                        <div className="pt-6 border-t border-gray-50 dark:border-slate-800/80">
                                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <i className="fas fa-history"></i> Historial de Variaciones y Justificaciones
                                            </h4>

                                            {timelineHistory.length > 0 ? (
                                                <div className="relative border-l-2 border-dashed border-indigo-200 dark:border-slate-700 pl-8 ml-4 space-y-8">
                                                    {timelineHistory
                                                        .slice()
                                                        .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                                                        .map((entry, idx) => {
                                                            const shiftDays = entry.previousDate ? getDaysDiff(entry.previousDate, entry.newDate) : 0;
                                                            const associated = changes.filter(c => entry.changeIds.includes(c.id));

                                                            return (
                                                                <div key={entry.id} className="relative group/node">
                                                                    <div className="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-4 border-indigo-500 shadow-md flex items-center justify-center transition-all group-hover/node:scale-110">
                                                                        <span className="text-[8px] font-black text-indigo-500">{idx + 1}</span>
                                                                    </div>
                                                                    <div className="bg-slate-50/50 dark:bg-slate-800/10 p-5 rounded-2xl border border-gray-50 dark:border-slate-800/40 space-y-3">
                                                                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                                                                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                                                                <span className="font-bold text-gray-400 font-mono">{formatDate(entry.changedAt)}</span>
                                                                                <span className="text-gray-400">➔</span>
                                                                                <span className="font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded font-mono">
                                                                                    {entry.previousDate ? formatDate(entry.previousDate) : 'Origen'}
                                                                                </span>
                                                                                <i className="fas fa-arrow-right text-[10px] text-gray-400"></i>
                                                                                <span className="font-bold bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-2.5 py-0.5 rounded font-mono">
                                                                                    {formatDate(entry.newDate)}
                                                                                </span>
                                                                            </div>
                                                                            <span className="px-3.5 py-1 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-full text-[9px] font-black uppercase tracking-wider text-right self-start md:self-auto shadow-sm">
                                                                                +{shiftDays} DÍAS CORRIDOS
                                                                            </span>
                                                                        </div>
                                                                        
                                                                        <div className="pt-2 border-t border-gray-100 dark:border-slate-800/30">
                                                                            <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Control de Cambio Aprobado</p>
                                                                            {associated.length > 0 ? (
                                                                                <div className="space-y-2">
                                                                                    {associated.map(c => (
                                                                                        <div key={c.id} className="text-xs leading-relaxed">
                                                                                            <span className="font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded font-mono text-[9px] mr-2">{c.registrationNumber || 'CC-S/N'}</span>
                                                                                            <span className="font-semibold text-slate-600 dark:text-slate-300">[{c.type === 'Scope' ? 'Alcance' : c.type === 'Timeline' ? 'Cronograma' : c.type === 'Budget' ? 'Presupuesto' : c.type === 'Resource' ? 'Recursos' : 'Otros'}]</span>
                                                                                            <p className="text-gray-500 dark:text-gray-400 mt-1 italic pl-4 border-l-2 border-slate-200 dark:border-slate-700">"{c.description}"</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <p className="text-xs text-gray-400 italic">No hay un control de cambio detallado registrado para esta variación histórica.</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50/50 dark:bg-slate-800/10 p-6 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 text-center">
                                                    <p className="text-xs text-gray-400 italic">El proyecto no registra corrimientos de fecha de finalización. Se encuentra alineado al cronograma original.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-24 bg-white dark:bg-dark-card rounded-[32px] border border-gray-100 dark:border-dark-border shadow-sm">
                                <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 transform rotate-12">
                                    <i className="fas fa-search text-gray-300 dark:text-slate-700 fa-2x -rotate-12"></i>
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">No se encontraron proyectos</h3>
                                <p className="text-gray-400 max-w-xs mx-auto text-xs font-semibold">Prueba ajustando tu término de búsqueda o seleccionando otro filtro específico.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : viewMode === 'grouped' ? (
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

            {viewMode !== 'timeline' && filteredChanges.length === 0 && (
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
