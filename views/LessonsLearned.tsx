import React, { useState } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { LessonLearned, Project } from '../types';
import { supabase } from '../utils/supabase';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/helpers';

interface LessonCardProps {
    lesson: LessonLearned;
    project?: Project;
    onEdit: (lesson: LessonLearned) => void;
    onDelete: (id: string) => void;
    getImpactColor: (impact: string) => string;
}

const LessonCard: React.FC<LessonCardProps> = ({ lesson, project, onEdit, onDelete, getImpactColor }) => (
    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border p-6 flex flex-col hover:shadow-xl transition-all group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125"></div>

        <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest mb-2 inline-block">
                    {lesson.category}
                </span>
                <h4 className="font-bold text-gray-800 dark:text-white line-clamp-1">{project?.name || 'Proyecto Desconocido'}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-medium">{project?.clientName}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                    <span className="text-[10px] font-mono text-purple-400">{project?.opportunityNumber}</span>
                </div>
            </div>
            <div className="flex gap-1">
                <button onClick={() => onEdit(lesson)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="Editar">
                    <i className="fas fa-edit text-sm"></i>
                </button>
                <button onClick={() => onDelete(lesson.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><i className="fas fa-trash text-sm"></i></button>
            </div>
        </div>

        <div className="relative z-10 flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 italic">"{lesson.description}"</p>
        </div>

        <div className="flex justify-between items-center pt-5 mt-5 border-t border-gray-50 dark:border-slate-800 relative z-10">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${getImpactColor(lesson.impact)}`}>
                Impacto: {lesson.impact}
            </span>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                {formatDate(lesson.createdAt)}
            </span>
        </div>
    </div>
);

export const LessonsLearnedView: React.FC = () => {
    const { lessons, setLessons, projects, showToast, currentUserMember } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLesson, setEditingLesson] = useState<LessonLearned | null>(null);
    const [formData, setFormData] = useState<Partial<LessonLearned>>({});

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todas');
    const [selectedProjectId, setSelectedProjectId] = useState('Todos');
    const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

    const handleNew = () => {
        setEditingLesson(null);
        setFormData({
            projectId: projects[0]?.id || '',
            category: 'Técnica',
            impact: 'Medio',
            description: ''
        });
        setIsModalOpen(true);
    };

    const handleEdit = (lesson: LessonLearned) => {
        setEditingLesson(lesson);
        setFormData(lesson);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar esta lección aprendida?')) return;
        try {
            const { error } = await supabase.from('lessons_learned').delete().eq('id', id);
            if (error) throw error;
            setLessons(prev => prev.filter(l => l.id !== id));
            showToast('Lección eliminada', 'success');
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
                category: formData.category,
                impact: formData.impact
            };

            if (editingLesson) {
                const { error } = await supabase.from('lessons_learned').update(payload).eq('id', editingLesson.id);
                if (error) throw error;
                setLessons(prev => prev.map(l => l.id === editingLesson.id ? { ...l, ...formData } as LessonLearned : l));
                showToast('Lección actualizada', 'success');
            } else {
                const { data, error } = await supabase.from('lessons_learned').insert([payload]).select();
                if (error) throw error;
                const l = data[0];
                const newLesson: LessonLearned = {
                    id: l.id, projectId: l.project_id, description: l.description,
                    category: l.category, impact: l.impact, createdAt: l.created_at
                };
                setLessons(prev => [newLesson, ...prev]);
                showToast('Lección registrada', 'success');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            showToast('Error guardando: ' + err.message, 'error');
        }
    };

    const filteredLessons = React.useMemo(() => {
        return lessons.filter(l => {
            const project = projects.find(p => p.id === l.projectId);
            const matchesSearch = (l.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.opportunityNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'Todas' || l.category === filterCategory;
            const matchesProject = selectedProjectId === 'Todos' || l.projectId === selectedProjectId;
            return matchesSearch && matchesCategory && matchesProject;
        });
    }, [lessons, searchTerm, filterCategory, selectedProjectId, projects]);

    const sortedLessons = React.useMemo(() => {
        const statusOrder: Record<string, number> = {
            'En ejecución': 0,
            'Soporte': 1,
            'Intervención temprana': 2,
            'Finalizado': 3
        };

        return [...filteredLessons].sort((a, b) => {
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

            return projA.name.localeCompare(projB.name);
        });
    }, [filteredLessons, projects]);

    const groupedByProject = React.useMemo(() => {
        const groups: Record<string, LessonLearned[]> = {};
        sortedLessons.forEach(l => {
            if (!groups[l.projectId]) groups[l.projectId] = [];
            groups[l.projectId].push(l);
        });
        return groups;
    }, [sortedLessons]);

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'Alto': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'Medio': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'Bajo': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="fade-in space-y-8 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Lecciones Aprendidas</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Capitalizando el conocimiento de cada experiencia</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-gray-100 dark:border-dark-border flex shadow-sm">
                        <button onClick={() => setViewMode('grouped')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'grouped' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                            AGRUPADO
                        </button>
                        <button onClick={() => setViewMode('list')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'list' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                            MURAL
                        </button>
                    </div>
                    <button onClick={handleNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center font-black text-sm tracking-wide">
                        <i className="fas fa-plus mr-2"></i> NUEVA LECCIÓN
                    </button>
                </div>
            </div>

            {/* Panel de Filtros */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Busca conocimiento</label>
                    <div className="relative">
                        <i className="fas fa-lightbulb absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"></i>
                        <input type="text" placeholder="Proyecto, categoría o contenido de la lección..." className="w-full input-field pl-12 h-12 bg-gray-50/50 dark:bg-slate-800/30 border-gray-100 dark:border-slate-700/50 focus:ring-2 focus:ring-indigo-500/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Categoría</label>
                    <select className="w-full input-field h-12 bg-gray-50/50 dark:bg-slate-800/30 border-gray-100 dark:border-slate-700/50 px-4 rounded-xl" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="Todas">Todas las áreas</option>
                        <option value="Técnica">Tecnología / Técnica</option>
                        <option value="Gestión">Gestión de Proyectos</option>
                        <option value="Comercial">Estrategia Comercial</option>
                        <option value="Cliente">Relación con Cliente</option>
                        <option value="Procesos">Procesos Internos</option>
                        <option value="Otros">Otros</option>
                    </select>
                </div>
                <div>
                    <SearchableSelect
                        label="Filtrar por Proyecto"
                        options={[{ id: 'Todos', label: 'Todos los Proyectos' }, ...projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))]}
                        value={selectedProjectId}
                        onChange={(val) => setSelectedProjectId(val)}
                        placeholder="Buscar proyecto..."
                        className="h-12"
                    />
                </div>
            </div>

            {
                viewMode === 'grouped' ? (
                    <div className="space-y-12">
                        {Object.entries(groupedByProject).map(([projId, lessonsRow]) => {
                            const project = projects.find(p => p.id === projId);
                            const projLessons = lessonsRow as LessonLearned[];
                            return (
                                <div key={projId} className="group/project">
                                    <div className="flex items-end gap-4 mb-6 relative">
                                        <div className="w-1.5 h-12 bg-indigo-600 rounded-full"></div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">{project?.opportunityNumber} - {project?.name}</h3>
                                                <span className="text-sm font-bold text-gray-400 mr-2">/ {projLessons.length} lecciones</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-indigo-500 py-0.5 px-2 bg-indigo-50 dark:bg-indigo-900/20 rounded uppercase">{project?.clientName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {projLessons.map(lesson => (
                                            <LessonCard key={lesson.id} lesson={lesson} project={project} onEdit={handleEdit} onDelete={handleDelete} getImpactColor={getImpactColor} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {sortedLessons.map(lesson => (
                            <LessonCard key={lesson.id} lesson={lesson} project={projects.find(p => p.id === lesson.projectId)} onEdit={handleEdit} onDelete={handleDelete} getImpactColor={getImpactColor} />
                        ))}
                    </div>
                )
            }

            {
                filteredLessons.length === 0 && (
                    <div className="text-center py-32 bg-gray-50/50 dark:bg-slate-900/20 rounded-[40px] border-2 border-dashed border-gray-200 dark:border-slate-800/50">
                        <div className="w-24 h-24 bg-white dark:bg-dark-card rounded-full shadow-lg flex items-center justify-center mx-auto mb-8">
                            <i className="fas fa-lightbulb text-gray-200 dark:text-slate-800 fa-3x"></i>
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-3">Sin lecciones a la vista</h3>
                        <p className="text-gray-400 dark:text-gray-400 max-w-sm mx-auto font-medium">Ajusta tus criterios de búsqueda para explorar el conocimiento institucional.</p>
                    </div>
                )
            }

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-4">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                            <i className="fas fa-brain fa-2x"></i>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black dark:text-white leading-none mb-2">{editingLesson ? 'EDITAR LECCIÓN' : 'REGISTRAR APRENDIZAJE'}</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Cada experiencia es una oportunidad de mejora</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <SearchableSelect
                                    label="Proyecto de origen"
                                    options={projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))}
                                    value={formData.projectId}
                                    onChange={(val) => setFormData({ ...formData, projectId: val })}
                                    placeholder="Elige el proyecto..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Categoría</label>
                                <select className="w-full input-field h-14 bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm font-bold rounded-2xl px-6" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    <option value="Técnica">Técnica</option>
                                    <option value="Gestión">Gestión</option>
                                    <option value="Comercial">Comercial</option>
                                    <option value="Cliente">Cliente</option>
                                    <option value="Procesos">Procesos</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Impacto en el futuro</label>
                                <select className="w-full input-field h-14 bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm font-bold rounded-2xl px-6" value={formData.impact} onChange={e => setFormData({ ...formData, impact: e.target.value })}>
                                    <option value="Bajo">Bajo</option>
                                    <option value="Medio">Medio</option>
                                    <option value="Alto">Alto</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Lección Aprendida</label>
                                <textarea className="w-full input-field bg-gray-50 dark:bg-slate-800/50 border-transparent text-sm rounded-2xl px-6 py-4" rows={6} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="¿Qué ocurrió? ¿Qué aprendimos? ¿Qué deberíamos repetir o evitar?"></textarea>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-gray-100 dark:border-slate-800">
                        <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-xs font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors tracking-widest">CANCELAR</button>
                        <button onClick={handleSave} className="px-10 py-3 bg-gray-900 dark:bg-indigo-600 text-white rounded-2xl hover:bg-black dark:hover:bg-indigo-700 font-black text-xs tracking-widest shadow-2xl transition-all">
                            GUARDAR LECCIÓN
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};
