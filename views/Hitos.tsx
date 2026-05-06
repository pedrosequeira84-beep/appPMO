import React, { useState } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { Milestone, Project } from '../types';
import { supabase } from '../utils/supabase';
import SearchableSelect from '../components/SearchableSelect';
import { formatDate } from '../utils/helpers';

interface MilestoneCardProps {
    milestone: Milestone;
    project?: Project;
    onEdit: (milestone: Milestone) => void;
    onDelete: (id: string) => void;
    onCopy: (milestone: Milestone) => void;
    onAddSub?: (milestone: Milestone) => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, project, onEdit, onDelete, onCopy, onAddSub, subMilestones }) => {
    const pct = milestone.amount > 0 ? (milestone.receivedAmount / milestone.amount) * 100 : 0;
    const hasSubs = subMilestones && subMilestones.length > 0;
    const subTotalReceived = hasSubs ? subMilestones.reduce((acc, s) => acc + s.receivedAmount, 0) : milestone.receivedAmount;
    const subTotalAmount = hasSubs ? subMilestones.reduce((acc, s) => acc + s.amount, 0) : milestone.amount;
    const combinedPct = subTotalAmount > 0 ? (subTotalReceived / subTotalAmount) * 100 : 0;

    return (
        <div className={`flex flex-col gap-4 ${milestone.parentId ? 'ml-8' : ''}`}>
            <div className={`bg-white dark:bg-dark-card rounded-2xl shadow-sm border ${milestone.parentId ? 'border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/30' : 'border-gray-100 dark:border-dark-border'} p-6 flex flex-col hover:shadow-xl transition-all group relative`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`w-3 h-3 rounded-full ${milestone.receivedAmount >= milestone.amount && milestone.amount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : milestone.receivedAmount > 0 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {milestone.receivedAmount >= milestone.amount && milestone.amount > 0 ? 'Cobrado' : milestone.receivedAmount > 0 ? 'Parcial' : 'Pendiente'} {milestone.parentId && '(Sub-hito)'}
                            </span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">{project?.name || 'Proyecto Desconocido'}</h4>
                        <p className="text-[10px] text-gray-400 font-medium">{project?.clientName} • {project?.opportunityNumber}</p>
                    </div>
                    <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!milestone.parentId && onAddSub && (
                            <button onClick={() => onAddSub(milestone)} title="Crear Sub-hito" className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all">
                                <i className="fas fa-plus-circle text-sm"></i>
                            </button>
                        )}
                        <button onClick={() => onEdit(milestone)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="Editar">
                            <i className="fas fa-edit text-sm"></i>
                        </button>
                        <button onClick={() => onCopy(milestone)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="Duplicar Hito">
                            <i className="fas fa-copy text-sm"></i>
                        </button>
                        <button onClick={() => onDelete(milestone.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Eliminar">
                            <i className="fas fa-trash text-sm"></i>
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mb-2 line-clamp-2" title={milestone.description}>
                        {milestone.description}
                    </p>
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{hasSubs ? 'Progreso consolidado subs' : 'Progreso de Cobro'}</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{Math.round(hasSubs ? combinedPct : pct)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${milestone.receivedAmount >= milestone.amount && milestone.amount > 0 ? 'bg-emerald-500' : milestone.receivedAmount > 0 ? 'bg-blue-500' : 'bg-amber-400/50'}`}
                            style={{ width: `${hasSubs ? combinedPct : pct}%` }}
                        ></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-slate-800">
                    <div>
                        <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{hasSubs ? 'Total Subs' : 'Monto Hito'}</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-none">
                            {milestone.currency} {(hasSubs ? subTotalAmount : milestone.amount).toLocaleString()}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha Est.</span>
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-400 leading-none italic">
                            {formatDate(milestone.date)}
                        </span>
                    </div>
                </div>
            </div>

            {hasSubs && (
                <div className="space-y-3 border-l-2 border-emerald-100 dark:border-emerald-900/30 pl-4 py-2">
                    {subMilestones.map(sm => (
                        <MilestoneCard key={sm.id} milestone={sm} project={project} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Fiscal-year helpers (Jul=Q1 … Jun=Q4) ───────────────────────────────────
const FISCAL_MONTHS = [
    { month: 6, label: 'Jul', q: 'Q1' },
    { month: 7, label: 'Ago', q: 'Q1' },
    { month: 8, label: 'Sep', q: 'Q1' },
    { month: 9, label: 'Oct', q: 'Q2' },
    { month: 10, label: 'Nov', q: 'Q2' },
    { month: 11, label: 'Dic', q: 'Q2' },
    { month: 0, label: 'Ene', q: 'Q3' },
    { month: 1, label: 'Feb', q: 'Q3' },
    { month: 2, label: 'Mar', q: 'Q3' },
    { month: 3, label: 'Abr', q: 'Q4' },
    { month: 4, label: 'May', q: 'Q4' },
    { month: 5, label: 'Jun', q: 'Q4' },
];

const QUARTER_COLORS: Record<string, { bg: string; border: string; text: string; pill: string }> = {
    Q1: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', pill: 'bg-indigo-600' },
    Q2: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', pill: 'bg-violet-600' },
    Q3: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-300', pill: 'bg-sky-600' },
    Q4: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', pill: 'bg-emerald-600' },
};

interface TimelineProps { milestones: Milestone[]; projects: Project[]; }

const MilestoneTimeline: React.FC<TimelineProps> = ({ milestones, projects }) => {
    const [tooltip, setTooltip] = React.useState<{ m: Milestone; proj?: Project } | null>(null);

    // Determine fiscal years present in milestones
    const fiscalYears = React.useMemo(() => {
        const fySet = new Set<number>();
        milestones.forEach(m => {
            const d = new Date(m.date);
            const fy = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
            fySet.add(fy);
        });
        return Array.from(fySet).sort();
    }, [milestones]);

    if (fiscalYears.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400 dark:text-gray-600 font-bold">
                Sin hitos para mostrar en el cronograma.
            </div>
        );
    }

    // Per month totals: key = "YYYY-MM" (calendar month)
    const monthStats = React.useMemo(() => {
        const map: Record<string, { total: number; received: number; items: Milestone[] }> = {};
        milestones.forEach(m => {
            const d = new Date(m.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!map[key]) map[key] = { total: 0, received: 0, items: [] };
            map[key].total += m.amount;
            map[key].received += m.receivedAmount;
            map[key].items.push(m);
        });
        return map;
    }, [milestones]);

    const today = new Date();

    return (
        <div className="space-y-10 overflow-x-auto pb-4">
            {fiscalYears.map(fy => {
                const fyLabel = `${fy}/${String(fy + 1).slice(2)}`;

                // Quarter totals for this FY
                const quarterStats: Record<string, { total: number; received: number }> = { Q1: { total: 0, received: 0 }, Q2: { total: 0, received: 0 }, Q3: { total: 0, received: 0 }, Q4: { total: 0, received: 0 } };
                FISCAL_MONTHS.forEach(fm => {
                    const calYear = fm.month >= 6 ? fy : fy + 1;
                    const key = `${calYear}-${fm.month}`;
                    if (monthStats[key]) {
                        quarterStats[fm.q].total += monthStats[key].total;
                        quarterStats[fm.q].received += monthStats[key].received;
                    }
                });

                return (
                    <div key={fy} className="bg-white dark:bg-dark-card rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden">
                        {/* FY Header */}
                        <div className="px-8 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <i className="fas fa-calendar-alt text-emerald-600 dark:text-emerald-400"></i>
                            </div>
                            <div>
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Año Fiscal</span>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-none">FY {fyLabel}</h3>
                            </div>
                        </div>

                        {/* Quarter bands */}
                        <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-slate-800 min-w-[900px]">
                            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
                                const qc = QUARTER_COLORS[q];
                                const qStats = quarterStats[q];
                                const qPct = qStats.total > 0 ? (qStats.received / qStats.total) * 100 : 0;
                                const qMonths = FISCAL_MONTHS.filter(fm => fm.q === q);

                                return (
                                    <div key={q} className={`flex flex-col ${qc.bg}`}>
                                        {/* Quarter label + totals */}
                                        <div className={`px-4 pt-4 pb-3 border-b ${qc.border} flex items-start justify-between gap-2`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-7 h-7 rounded-xl ${qc.pill} text-white text-[10px] font-black flex items-center justify-center shadow-sm`}>{q}</span>
                                                <div>
                                                    <div className={`text-[9px] font-black uppercase tracking-widest ${qc.text}`}>
                                                        {q === 'Q1' ? 'Jul–Sep' : q === 'Q2' ? 'Oct–Dic' : q === 'Q3' ? 'Ene–Mar' : 'Abr–Jun'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[9px] font-black text-gray-400 uppercase">Total</div>
                                                <div className={`text-xs font-black ${qc.text}`}>${qStats.total.toLocaleString()}</div>
                                                <div className="text-[9px] text-emerald-600 font-bold">✓ ${qStats.received.toLocaleString()}</div>
                                                {qStats.total > 0 && (
                                                    <div className="mt-1 w-16 bg-gray-200 dark:bg-slate-700 rounded-full h-1 ml-auto">
                                                        <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${Math.min(qPct, 100)}%` }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Months columns */}
                                        <div className="grid grid-cols-3 divide-x divide-gray-100/60 dark:divide-slate-800/60 flex-1">
                                            {qMonths.map(fm => {
                                                const calYear = fm.month >= 6 ? fy : fy + 1;
                                                const key = `${calYear}-${fm.month}`;
                                                const mStat = monthStats[key] || { total: 0, received: 0, items: [] };
                                                const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === fm.month;

                                                return (
                                                    <div key={fm.month} className={`flex flex-col min-h-[200px] ${isCurrentMonth ? 'ring-2 ring-inset ring-emerald-400' : ''}`}>
                                                        {/* Month header */}
                                                        <div className={`px-2 py-2 border-b ${qc.border} ${isCurrentMonth ? 'bg-emerald-500/10' : ''}`}>
                                                            <div className={`text-[10px] font-black text-center uppercase tracking-wider ${isCurrentMonth ? 'text-emerald-600' : 'text-gray-500 dark:text-gray-400'}`}>
                                                                {fm.label}
                                                                {isCurrentMonth && <span className="ml-1 text-[8px] bg-emerald-500 text-white px-1 rounded-full">HOY</span>}
                                                            </div>
                                                            {mStat.total > 0 && (
                                                                <div className="mt-1 text-center">
                                                                    <div className="text-[9px] font-black text-gray-700 dark:text-gray-300">${(mStat.total / 1000).toFixed(0)}K</div>
                                                                    <div className="text-[8px] text-emerald-600 font-bold">✓${(mStat.received / 1000).toFixed(0)}K</div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Milestone markers */}
                                                        <div className="flex-1 px-2 py-3 flex flex-col gap-2 relative">
                                                            {/* Vertical timeline line */}
                                                            {mStat.items.length > 0 && (
                                                                <div className="absolute left-1/2 top-3 bottom-3 w-px bg-gray-200 dark:bg-slate-700 -translate-x-1/2 z-0"></div>
                                                            )}
                                                            {mStat.items.map(m => {
                                                                const proj = projects.find(p => p.id === m.projectId);
                                                                const isCobrado = m.receivedAmount >= m.amount && m.amount > 0;
                                                                const isParcial = m.receivedAmount > 0 && m.receivedAmount < m.amount;
                                                                const isPending = m.receivedAmount === 0;

                                                                return (
                                                                    <div
                                                                        key={m.id}
                                                                        className="relative z-10 flex items-start gap-1.5 group cursor-pointer"
                                                                        onMouseEnter={() => setTooltip({ m, proj })}
                                                                        onMouseLeave={() => setTooltip(null)}
                                                                    >
                                                                        {/* Arrow/marker */}
                                                                        <div className="flex flex-col items-center shrink-0 mt-0.5">
                                                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform group-hover:scale-125 ${isCobrado ? 'bg-emerald-500 border-emerald-600' :
                                                                                    isParcial ? 'bg-blue-400 border-blue-500' :
                                                                                        'bg-amber-400 border-amber-500'
                                                                                }`}>
                                                                                <i className={`text-[6px] text-white fas ${isCobrado ? 'fa-check' : isParcial ? 'fa-adjust' : 'fa-clock'}`}></i>
                                                                            </div>
                                                                            <div className={`w-px h-2 ${isCobrado ? 'bg-emerald-400' : isParcial ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
                                                                        </div>
                                                                        {/* Mini label */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={`text-[8px] font-black leading-tight truncate ${isCobrado ? 'text-emerald-700 dark:text-emerald-400' : isParcial ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                                                                ${(m.amount / 1000).toFixed(0)}K
                                                                            </div>
                                                                            <div className="text-[7px] text-gray-400 truncate leading-tight">{m.description.slice(0, 20)}</div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {mStat.items.length === 0 && (
                                                                <div className="flex-1 flex items-center justify-center">
                                                                    <div className="w-px h-full bg-gray-100 dark:bg-slate-800 mx-auto"></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Legend */}
            <div className="flex items-center gap-6 px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Referencias:</span>
                {[
                    { color: 'bg-emerald-500', label: 'Cobrado (100%)' },
                    { color: 'bg-blue-400', label: 'Cobro Parcial' },
                    { color: 'bg-amber-400', label: 'Pendiente' },
                ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`}></div>
                        <span className="text-[10px] font-bold text-gray-500">{label}</span>
                    </div>
                ))}
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-2xl px-6 py-4 shadow-2xl text-xs max-w-sm pointer-events-none animate-fade-in">
                    <div className="font-black text-sm mb-1 truncate">{tooltip.m.description}</div>
                    <div className="text-gray-300 mb-2">{tooltip.proj?.name} · {tooltip.proj?.clientName}</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <span className="text-gray-400">Monto:</span>
                        <span className="font-bold text-emerald-400">${tooltip.m.amount.toLocaleString()} {tooltip.m.currency}</span>
                        <span className="text-gray-400">Recepcionado:</span>
                        <span className="font-bold text-emerald-300">${tooltip.m.receivedAmount.toLocaleString()}</span>
                        <span className="text-gray-400">Fecha:</span>
                        <span className="font-bold">{new Date(tooltip.m.date).toLocaleDateString('es-AR')}</span>
                        <span className="text-gray-400">Estado:</span>
                        <span className={`font-bold ${tooltip.m.receivedAmount >= tooltip.m.amount && tooltip.m.amount > 0 ? 'text-emerald-400' : tooltip.m.receivedAmount > 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                            {tooltip.m.receivedAmount >= tooltip.m.amount && tooltip.m.amount > 0 ? '✓ Cobrado' : tooltip.m.receivedAmount > 0 ? '◑ Parcial' : '◷ Pendiente'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export const HitosView: React.FC = () => {
    const { milestones, setMilestones, projects, setProjects, showToast, currentUserMember } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
    const [formData, setFormData] = useState<Partial<Milestone>>({});

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'Todos' | 'Cobrado' | 'Parcial' | 'Pendiente'>('Todos');
    const [selectedProjectId, setSelectedProjectId] = useState('Todos');
    const [selectedQuarter, setSelectedQuarter] = useState<'Todos' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('Todos');
    const [selectedYear, setSelectedYear] = useState<string>('Todos');
    const [viewMode, setViewMode] = useState<'grouped' | 'list' | 'timeline'>('grouped');
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

    const handleNew = () => {
        setEditingMilestone(null);
        setFormData({
            projectId: projects[0]?.id || '',
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            receivedAmount: 0,
            isReceived: false,
            currency: 'USD',
            ocId: '',
            ocPosition: '',
            parentId: undefined,
            comments: ''
        });
        setIsModalOpen(true);
    };

    const handleAddSub = (parent: Milestone) => {
        setEditingMilestone(null);
        setFormData({
            projectId: parent.projectId,
            description: `[Sub] ${parent.description}`,
            amount: 0,
            date: parent.date.split('T')[0],
            receivedAmount: 0,
            isReceived: false,
            currency: parent.currency,
            ocId: parent.ocId,
            ocPosition: parent.ocPosition,
            parentId: parent.id,
            comments: ''
        });
        setIsModalOpen(true);
    };

    const handleCopy = (m: Milestone) => {
        setEditingMilestone(null); // Explicitly null to create new
        setFormData({
            ...m,
            description: `${m.description} (Copia)`,
            date: m.date.split('T')[0],
            receivedAmount: 0, // Reset received amount for copy usually? Or copy it? Assuming new milestone starts fresh payment wise.
            isReceived: false,
            receivedPercentage: 0,
            id: undefined, // Ensure new ID
            createdAt: undefined, // Ensure new date
            comments: m.comments || ''
        });
        setIsModalOpen(true);
    };

    const handleEdit = (m: Milestone) => {
        setEditingMilestone(m);
        setFormData({
            ...m,
            date: m.date.split('T')[0] // Format for date input
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este hito?')) return;
        try {
            const { error } = await supabase.from('milestones').delete().eq('id', id);
            if (error) throw error;

            // Update global state
            setMilestones(prev => prev.filter(m => m.id !== id));

            // Sync with projects state (to keep nested data consistent if needed)
            setProjects(prev => prev.map(p => ({
                ...p,
                milestones: p.milestones.filter(m => m.id !== id)
            })));

            showToast('Hito eliminado correctamente', 'success');
        } catch (err: any) {
            showToast('Error al eliminar: ' + err.message, 'error');
        }
    };

    const handleSave = async () => {
        if (!formData.description || !formData.projectId || formData.amount === undefined) {
            return showToast('Complete los campos obligatorios', 'error');
        }

        try {
            const payload = {
                project_id: formData.projectId,
                description: formData.description,
                amount: Number(formData.amount),
                date: formData.date,
                received_amount: Number(formData.receivedAmount || 0),
                is_received: formData.isReceived,
                currency: formData.currency || 'USD',
                oc_id: formData.ocId,
                oc_position: formData.ocPosition,
                parent_id: formData.parentId,
                received_percentage: formData.amount && formData.amount > 0 ? (Number(formData.receivedAmount || 0) / Number(formData.amount)) * 100 : 0,
                comments: formData.comments
            };

            if (editingMilestone) {
                const { error } = await supabase.from('milestones').update(payload).eq('id', editingMilestone.id);
                if (error) throw error;

                const updatedM: Milestone = { ...editingMilestone, ...payload, projectId: payload.project_id, isReceived: payload.is_received, receivedAmount: payload.received_amount, ocId: payload.oc_id, ocPosition: payload.oc_position, receivedPercentage: payload.received_percentage, comments: payload.comments };

                setMilestones(prev => prev.map(m => m.id === editingMilestone.id ? updatedM : m));
                setProjects(prev => prev.map(p => ({
                    ...p,
                    milestones: p.milestones.map(m => m.id === editingMilestone.id ? updatedM : m)
                })));

                showToast('Hito actualizado', 'success');
            } else {
                const { data, error } = await supabase.from('milestones').insert([payload]).select();
                if (error) throw error;

                if (!data || data.length === 0) throw new Error('No se pudo crear el hito');
                const r = data[0];
                const newM: Milestone = {
                    id: r.id,
                    projectId: r.project_id,
                    description: r.description,
                    amount: r.amount,
                    date: r.date,
                    receivedAmount: r.received_amount,
                    isReceived: r.is_received,
                    currency: r.currency,
                    ocId: r.oc_id,
                    ocPosition: r.oc_position,
                    receivedPercentage: r.received_percentage,
                    parentId: r.parent_id,
                    createdAt: r.created_at,
                    comments: r.comments
                };

                setMilestones(prev => [newM, ...prev]);
                setProjects(prev => prev.map(p => p.id === newM.projectId ? { ...p, milestones: [...p.milestones, newM] } : p));

                showToast('Hito creado exitosamente', 'success');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            showToast('Error al guardar: ' + err.message, 'error');
        }
    };

    const filteredMilestones = React.useMemo(() => {
        return milestones.filter(m => {
            const project = projects.find(p => p.id === m.projectId);
            const matchesSearch = (m.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (project?.opportunityNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'Todos' || (
                filterStatus === 'Cobrado' ? m.receivedAmount >= m.amount && m.amount > 0 :
                    filterStatus === 'Parcial' ? m.receivedAmount > 0 && m.receivedAmount < m.amount :
                        m.receivedAmount === 0
            );
            const matchesProject = selectedProjectId === 'Todos' || m.projectId === selectedProjectId;

            let matchesQuarter = true;
            if (selectedQuarter !== 'Todos') {
                const date = new Date(m.date);
                const month = date.getMonth(); // 0-11
                let q = '';
                if (month >= 6 && month <= 8) q = 'Q1';
                else if (month >= 9 && month <= 11) q = 'Q2';
                else if (month >= 0 && month <= 2) q = 'Q3';
                else if (month >= 3 && month <= 5) q = 'Q4';
                matchesQuarter = q === selectedQuarter;
            }

            let matchesYear = true;
            if (selectedYear !== 'Todos') {
                const date = new Date(m.date);
                const month = date.getMonth();
                const year = date.getFullYear();
                // Fiscal year starts July 1st.
                // If Jul-Dec of 2025, it's FY 2026? Or usually users refer to the calendar year or the starting year.
                // The user said "el año fiscal empieza el 1 de Julio".
                // Let's assume they want to filter by the Starting Year or the Fiscal Year period.
                // For simplicity, let's filter by calendar year first, or ask.
                // But usually, if they say "Fiscal Year", Q1-Q4 belong to one FY.
                // Let's calculate the FY. If Jul 2025 -> FY 25/26.
                // Let's just use the year of the date for now as a simple 'Year' filter unless they specify FY.
                matchesYear = year.toString() === selectedYear;
            }

            return matchesSearch && matchesStatus && matchesProject && matchesQuarter && matchesYear;
        });
    }, [milestones, searchTerm, filterStatus, selectedProjectId, selectedQuarter, selectedYear, projects]);

    const years = React.useMemo(() => {
        const y = new Set<string>();
        milestones.forEach(m => y.add(new Date(m.date).getFullYear().toString()));
        return Array.from(y).sort().reverse();
    }, [milestones]);

    const sortedMilestones = React.useMemo(() => {
        return [...filteredMilestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredMilestones]);

    const sortedProjectsWithMilestones = React.useMemo(() => {
        const statusOrder: Record<string, number> = {
            'En ejecución': 0,
            'Soporte': 1,
            'Intervención temprana': 2,
            'Finalizado': 3
        };

        // Get unique project IDs from filtered milestones
        const projectIds = Array.from(new Set(filteredMilestones.map(m => m.projectId)));

        // Get project objects and sort them
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
    }, [projects, filteredMilestones]);

    const milestonesByProject = React.useMemo(() => {
        const groups: Record<string, Milestone[]> = {};
        filteredMilestones.forEach(m => {
            if (!groups[m.projectId]) groups[m.projectId] = [];
            groups[m.projectId].push(m);
        });
        // Sort milestones within project by date
        Object.keys(groups).forEach(pid => {
            groups[pid].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });
        return groups;
    }, [filteredMilestones]);

    // Resumen General
    const stats = React.useMemo(() => {
        const total = filteredMilestones.reduce((acc, m) => acc + m.amount, 0);
        const cobrado = filteredMilestones.reduce((acc, m) => acc + m.receivedAmount, 0);
        return { total, cobrado, pendiente: total - cobrado };
    }, [filteredMilestones]);

    return (
        <div className="fade-in space-y-8 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">Hitos Facturables</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Control financiero y seguimiento de facturación</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white dark:bg-dark-card p-1.5 rounded-2xl border border-gray-100 dark:border-dark-border flex shadow-sm">
                        <button onClick={() => setViewMode('grouped')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'grouped' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'text-gray-400 hover:text-gray-600'}`}>
                            PROYECTOS
                        </button>
                        <button onClick={() => setViewMode('timeline')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'timeline' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'text-gray-400 hover:text-gray-600'}`}>
                            CRONOGRAMA
                        </button>
                        <button onClick={() => setViewMode('list')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'text-gray-400 hover:text-gray-600'}`}>
                            LISTA
                        </button>
                    </div>
                    <button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center font-black text-sm tracking-wide">
                        <i className="fas fa-plus mr-2"></i> NUEVO HITO
                    </button>
                </div>
            </div>

            {/* Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Monto Total Estimado</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-gray-900 dark:text-white">USD {stats.total.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3 block">Monto Cobrado</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-600">USD {stats.cobrado.toLocaleString()}</span>
                        <span className="text-xs font-bold text-emerald-500/70">({stats.total > 0 ? Math.round((stats.cobrado / stats.total) * 100) : 0}%)</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3 block">Monto Pendiente</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-600">USD {stats.pendiente.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-[32px] border border-gray-50 dark:border-dark-border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Buscar Hito o Proyecto</label>
                    <div className="relative group">
                        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-emerald-500 transition-all"></i>
                        <input type="text" placeholder="Ej: Entrega final, HW, Licencias..." className="w-full h-12 pl-14 pr-6 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-transparent focus:bg-white dark:focus:bg-slate-800 border-2 focus:border-emerald-500/20 transition-all outline-none text-sm font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Estado de Cobro</label>
                    <select className="w-full h-12 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-emerald-500/20 transition-all font-bold text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                        <option value="Todos">Todos los estados</option>
                        <option value="Cobrado">Cobrados (100%)</option>
                        <option value="Parcial">Cobros Parciales</option>
                        <option value="Pendiente">Pendientes (0%)</option>
                    </select>
                </div>
                <div>
                    <SearchableSelect
                        label="Filtrar Proyecto"
                        options={[{ id: 'Todos', label: 'Todos los Proyectos' }, ...projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))]}
                        value={selectedProjectId}
                        onChange={(val) => setSelectedProjectId(val)}
                        placeholder="Buscar proyecto..."
                        className="h-12"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Trimestre (FY Jul-Jun)</label>
                    <select className="w-full h-12 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-emerald-500/20 transition-all font-bold text-sm" value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value as any)}>
                        <option value="Todos">Todos los Quarters</option>
                        <option value="Q1">Q1 (Jul-Sep)</option>
                        <option value="Q2">Q2 (Oct-Dic)</option>
                        <option value="Q3">Q3 (Ene-Mar)</option>
                        <option value="Q4">Q4 (Abr-Jun)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Año</label>
                    <select className="w-full h-12 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800/40 border-2 border-transparent focus:border-emerald-500/20 transition-all font-bold text-sm" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                        <option value="Todos">Todos los años</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {viewMode === 'grouped' ? (
                <div className="space-y-14">
                    {sortedProjectsWithMilestones.map((project) => {
                        const projHitos = milestonesByProject[project.id] || [];
                        const projTotal = projHitos.reduce((s, h) => s + h.amount, 0);
                        const projReceived = projHitos.reduce((s, h) => s + h.receivedAmount, 0);
                        const projPct = projTotal > 0 ? (projReceived / projTotal) * 100 : 0;

                        return (
                            <div key={project.id} className="space-y-6 bg-white dark:bg-dark-card rounded-3xl p-6 border border-gray-100 dark:border-dark-border shadow-sm transition-all hover:shadow-md">
                                <div
                                    onClick={() => setExpandedProjects(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(project.id)) newSet.delete(project.id);
                                        else newSet.add(project.id);
                                        return newSet;
                                    })}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group select-none"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${expandedProjects.has(project.id) ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500'}`}>
                                            <i className={`fas fa-chevron-right transition-transform duration-300 ${expandedProjects.has(project.id) ? 'rotate-90' : ''}`}></i>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xl font-black shrink-0">
                                            {projHitos.length}
                                        </div>
                                        <div>
                                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-none mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{project?.opportunityNumber} - {project?.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">{project?.clientName}</span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                <span className="text-[10px] font-mono text-emerald-500 font-bold">{project?.opportunityNumber}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 pl-16 md:pl-0">
                                        <div className="text-right hidden md:block">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Cobro del Proyecto</p>
                                            <div className="flex items-center gap-3 justify-end">
                                                <div className="w-24 bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${projPct}%` }}></div>
                                                </div>
                                                <span className="text-lg font-black text-emerald-600">{Math.round(projPct)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-right border-l pl-6 dark:border-slate-800">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Presupuesto</p>
                                            <p className="text-lg font-black dark:text-white">USD {projTotal.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {expandedProjects.has(project.id) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 border-t border-gray-100 dark:border-slate-800 pt-6 animate-fade-in-down">
                                        {projHitos.filter(m => !m.parentId).map(m => (
                                            <MilestoneCard
                                                key={m.id}
                                                milestone={m}
                                                project={project}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                onCopy={handleCopy}
                                                onAddSub={handleAddSub}
                                                subMilestones={projHitos.filter(sm => sm.parentId === m.id).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : viewMode === 'timeline' ? (
                <MilestoneTimeline milestones={filteredMilestones} projects={projects} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedMilestones.map(m => (
                        <MilestoneCard key={m.id} milestone={m} project={projects.find(p => p.id === m.projectId)} onEdit={handleEdit} onDelete={handleDelete} onCopy={handleCopy} />
                    ))}
                </div>
            )
            }

            {
                filteredMilestones.length === 0 && (
                    <div className="text-center py-40 bg-gray-50/50 dark:bg-slate-900/20 rounded-[40px] border-4 border-dashed border-gray-100 dark:border-slate-800/50">
                        <div className="w-24 h-24 bg-white dark:bg-dark-card rounded-full shadow-2xl flex items-center justify-center mx-auto mb-8 transform rotate-12 group-hover:rotate-0 transition-transform">
                            <i className="fas fa-calendar-times text-gray-200 dark:text-slate-800 fa-3x"></i>
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-3 tracking-tight">Sin hitos para mostrar</h3>
                        <p className="text-gray-400 dark:text-gray-500 max-w-xs mx-auto text-sm font-medium">No se encontraron hitos facturables con los filtros seleccionados.</p>
                    </div>
                )
            }

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-4">
                    <div className="flex items-center gap-5 mb-10">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-500/10">
                            <i className="fas fa-hand-holding-usd fa-2x"></i>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black dark:text-white uppercase tracking-tighter leading-none mb-1">{editingMilestone ? 'Editar Hito' : 'Nuevo Hito'}</h3>
                            <p className="text-gray-500 font-medium">
                                {formData.parentId ? 'Registrando monto parcial dentro de un hito principal' : 'Información financiera y seguimiento de cobro'}
                            </p>
                        </div>
                    </div>

                    {formData.parentId && (
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
                            <i className="fas fa-info-circle text-amber-500"></i>
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-tight">
                                Este es un Sub-hito vinculado a: <span className="underline">{milestones.find(m => m.id === formData.parentId)?.description}</span>
                            </p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="md:col-span-2">
                                <SearchableSelect
                                    label="Vincular Proyecto *"
                                    options={projects.map(p => ({ id: p.id, label: `${p.opportunityNumber} - ${p.name}` }))}
                                    value={formData.projectId}
                                    onChange={(val) => setFormData({ ...formData, projectId: val })}
                                    placeholder="Elige un proyecto..."
                                    disabled={!!formData.parentId}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Descripción del Hito *</label>
                                <input type="text" className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 transition-all font-medium text-sm" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ej: Pago Inicial, Entrega de HW, Hito 1..." />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Monto Total *</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">{formData.currency || 'USD'}</span>
                                    <input type="number" className="w-full h-14 pl-16 pr-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 transition-all font-black text-sm" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Fecha Estimada de Recepción</label>
                                <input type="date" className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 transition-all font-bold text-sm" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[28px] md:col-span-2 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black dark:text-white">Estado de Facturación/Cobro</p>
                                        <p className="text-xs text-gray-500">¿Ya se ha recibido el pago?</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${formData.receivedAmount >= (formData.amount || 0) && (formData.amount || 0) > 0 ? 'text-emerald-500' : (formData.receivedAmount || 0) > 0 ? 'text-blue-500' : 'text-amber-500'}`}>
                                            {formData.receivedAmount >= (formData.amount || 0) && (formData.amount || 0) > 0 ? 'Completado' : (formData.receivedAmount || 0) > 0 ? 'Parcial' : 'Pendiente'}
                                        </span>
                                        <button
                                            onClick={() => {
                                                const isMovingToReceived = !formData.isReceived;
                                                setFormData({
                                                    ...formData,
                                                    isReceived: isMovingToReceived,
                                                    receivedAmount: isMovingToReceived ? (formData.amount || 0) : 0
                                                });
                                            }}
                                            className={`w-14 h-8 rounded-full relative transition-all duration-300 ${formData.receivedAmount >= (formData.amount || 0) && (formData.amount || 0) > 0 ? 'bg-emerald-500' : (formData.receivedAmount || 0) > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${formData.receivedAmount >= (formData.amount || 0) && (formData.amount || 0) > 0 ? 'left-7' : (formData.receivedAmount || 0) > 0 ? 'left-4' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 fade-in">
                                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Monto Cobrado (Efectivo)</label>
                                    <div className="relative">
                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">{formData.currency || 'USD'}</span>
                                        <input
                                            type="number"
                                            className="w-full h-14 pl-16 pr-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-500/20 focus:border-emerald-500 transition-all font-black text-sm"
                                            value={formData.receivedAmount || ''}
                                            onChange={e => {
                                                const val = Number(e.target.value);
                                                setFormData({
                                                    ...formData,
                                                    receivedAmount: val,
                                                    isReceived: val >= (formData.amount || 0) && (formData.amount || 0) > 0
                                                });
                                            }}
                                        />
                                    </div>
                                    {formData.receivedAmount > 0 && formData.receivedAmount < (formData.amount || 0) && (
                                        <p className="text-[10px] text-blue-500 font-bold mt-2 ml-1 uppercase tracking-tight italic">Cobro parcial detectado</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Nro OC (Referencia)</label>
                                <input type="text" className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 transition-all font-bold text-sm" value={formData.ocId} onChange={e => setFormData({ ...formData, ocId: e.target.value })} placeholder="Ej: OC-9872" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Posición OC</label>
                                <input type="text" className="w-full h-14 px-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 transition-all font-mono text-sm" value={formData.ocPosition} onChange={e => setFormData({ ...formData, ocPosition: e.target.value })} placeholder="Ej: 10, 20..." />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Comentarios</label>
                                <textarea
                                    className="w-full min-h-[100px] p-6 rounded-2xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 transition-all font-medium text-sm resize-y"
                                    value={formData.comments || ''}
                                    onChange={e => setFormData({ ...formData, comments: e.target.value })}
                                    placeholder="Información adicional, estado de la gestión, etc..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-5 mt-12 pt-8 border-t border-gray-100 dark:border-slate-800">
                        <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-xs font-black text-gray-400 hover:text-gray-600 tracking-widest uppercase transition-colors">DESCARTAR</button>
                        <button onClick={handleSave} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] shadow-2xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all">
                            {editingMilestone ? 'ACTUALIZAR HITO' : 'CONFIRMAR REGISTRO'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};
