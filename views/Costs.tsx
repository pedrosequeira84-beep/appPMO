import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { generateUUID, formatDate } from '../utils/helpers';
import { COST_CATEGORIES, Project } from '../types';
import { supabase } from '../utils/supabase';
import { exportCostsToExcel } from '../utils/excelExport';

export const CostsView: React.FC = () => {
    const { projects, expenses, setExpenses, setProjects, showToast, user, currentUserMember, capacityData } = useApp();
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBudgetMode, setIsBudgetMode] = useState(false);
    const [isInitialRealMode, setIsInitialRealMode] = useState(false);
    const [tempBudget, setTempBudget] = useState<Record<string, number>>({});
    const [tempInitialReal, setTempInitialReal] = useState<Record<string, number>>({});
    const [showReport, setShowReport] = useState(false);
    const COST_PER_HOUR = 24;

    // New/Edit Expense State
    const [newExpense, setNewExpense] = useState({ date: new Date().toISOString().split('T')[0], category: COST_CATEGORIES[0], amount: '', desc: '' });
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

    // SAP Import
    const sapFileRef = useRef<HTMLInputElement>(null);
    const [showSAPImport, setShowSAPImport] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const SAP_IMPORT_DESC = '[SAP Import]';
    const SAP_SUFFIX_MAP: Record<string, string> = {
        '1':  '1-Costos Comerciales',
        '10': '10-Productos - Materiales (HW/SW) Solución Principal',
        '11': '11-Servicios Propios - Horas de PM',
        '12': '12-Servicios Propios - Horas Ingenieros',
        '13': '13-Servicios Soporte y Mantenimiento (MO Propia)',
        '14': '14-Viáticos',
        '15': '15-Servicios de Terceros',
        '16': '16-Garantías / Soporte técnico Vendors',
        '17': '17-Productos - Materiales (HW/SW) Solución Complementaria',
    };
    interface SAPEntry { projectId: string; projectName: string; oppNum: string; category: string; pepCode: string; amount: number; prevAmount: number; }
    const [sapImportData, setSAPImportData] = useState<SAPEntry[]>([]);

    const handleSAPFile = async (file: File) => {
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            // Read SAP subtotal rows (rows where Clase de objeto is EMPTY = yellow summary rows SAP generates)
            // These rows have: empty col B, PEP code in col C, total USD in col E, "USD" in col F
            const pepTotals: Record<string, number> = {};
            for (const row of rows) {
                if (!row || row.length < 6) continue;
                const claseObj = String(row[1] || '').trim();
                const objeto = String(row[2] || '').trim();
                const valRaw = row[4];
                const moneda = String(row[5] || '').trim();
                
                // Ignorar filas de subtotales de SAP (Clase Obj vacía) para evitar errores o basura de SAP
                // Solo sumamos los items/transacciones reales
                if (claseObj === '') continue; 
                if (moneda !== 'USD') continue;
                if (!objeto.match(/^TP-AR-\d+-\d+$/i)) continue;
                
                const parts = objeto.split('-');
                const suffix = parseInt(parts[parts.length - 1], 10).toString();
                if (!SAP_SUFFIX_MAP[suffix]) continue;
                
                let amount = typeof valRaw === 'number' ? valRaw : parseFloat(String(valRaw || '0').replace(/\./g, '').replace(',', '.'));
                if (isNaN(amount)) continue;
                
                // Acumulamos el valor de cada transacción individual
                pepTotals[objeto.toUpperCase()] = (pepTotals[objeto.toUpperCase()] || 0) + amount;
            }

            // Match PEPs to app projects
            const entries: SAPEntry[] = [];
            for (const [pepCode, amount] of Object.entries(pepTotals)) {
                const parts = pepCode.split('-');
                const suffix = parseInt(parts[parts.length - 1], 10).toString();
                const basePep = parts.slice(0, -1).join('-'); // e.g. TP-AR-19673
                const category = SAP_SUFFIX_MAP[suffix];
                const project = projects.find(p =>
                    p.opportunityNumber &&
                    p.opportunityNumber.toUpperCase().replace(/\s/g, '') === basePep.replace(/\s/g, '')
                );
                if (!project) continue;
                const prevAmount = expenses
                    .filter(e => e.projectId === project.id && e.category === category && e.description === SAP_IMPORT_DESC)
                    .reduce((s, e) => s + e.amount, 0);
                entries.push({ projectId: project.id, projectName: project.name, oppNum: project.opportunityNumber || '', category, pepCode, amount: Math.round(amount * 100) / 100, prevAmount });
            }

            if (entries.length === 0) {
                showToast('No se encontraron PEPs que coincidan con proyectos de la app', 'error');
                return;
            }
            setSAPImportData(entries);
            setShowSAPImport(true);
        } catch (err: any) {
            showToast('Error leyendo el Excel: ' + err.message, 'error');
        }
    };

    const confirmSAPImport = async () => {
        setIsImporting(true);
        try {
            let updatedExpenses = [...expenses];
            
            // 1. Borrar ABSOLUTAMENTE TODOS los gastos (importados o manuales) de los proyectos que se están importando
            const importedProjectIds = [...new Set(sapImportData.map(e => e.projectId))];
            
            for (const pId of importedProjectIds) {
                const toDelete = updatedExpenses.filter(e => e.projectId === pId);
                for (const exp of toDelete) {
                    await supabase.from('expenses').delete().eq('id', exp.id);
                }
                const deletedIds = toDelete.map(e => e.id);
                updatedExpenses = updatedExpenses.filter(e => !deletedIds.includes(e.id));
            }

            // 2. Insertar únicamente los registros limpios del nuevo Excel
            for (const entry of sapImportData) {
                const { data, error } = await supabase.from('expenses').insert([{
                    project_id: entry.projectId,
                    date: new Date().toISOString().split('T')[0],
                    category: entry.category,
                    amount: entry.amount,
                    description: SAP_IMPORT_DESC,
                    owner_id: user?.id
                }]).select();
                if (error) throw error;
                const newExp = { id: data[0].id, projectId: entry.projectId, date: data[0].date, category: data[0].category, amount: data[0].amount, description: data[0].description, createdAt: data[0].created_at };
                updatedExpenses.push(newExp);
            }
            setExpenses(updatedExpenses);
            showToast(`✅ ${sapImportData.length} categorías actualizadas desde SAP`, 'success');
            setShowSAPImport(false);
            setSAPImportData([]);
        } catch (err: any) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            setIsImporting(false);
        }
    };

    const manageCosts = (p: Project) => {
        setSelectedProject(p);
        setIsBudgetMode(false);
        setIsInitialRealMode(false);
        setTempBudget(p.budget || {});
        setTempInitialReal(p.initialRealValues || {});
        setIsModalOpen(true);
    };

    const addCost = async () => {
        if (!newExpense.amount || !newExpense.desc || !selectedProject) return showToast('Ingrese datos', 'error');

        try {
            const expenseData = {
                project_id: selectedProject.id,
                date: newExpense.date,
                category: newExpense.category,
                amount: parseFloat(newExpense.amount),
                description: newExpense.desc,
                owner_id: user?.id
            };

            if (editingExpenseId) {
                const { error } = await supabase.from('expenses')
                    .update(expenseData)
                    .eq('id', editingExpenseId);
                if (error) throw error;

                setExpenses(prev => prev.map(e => e.id === editingExpenseId ? { ...e, ...expenseData, amount: expenseData.amount } : e));
                showToast('Gasto SAP actualizado', 'success');
            } else {
                const { data, error } = await supabase.from('expenses').insert([expenseData]).select();
                if (error) throw error;

                const newExp = {
                    id: data[0].id,
                    projectId: selectedProject.id,
                    date: data[0].date,
                    category: data[0].category,
                    amount: data[0].amount,
                    description: data[0].description,
                    createdAt: data[0].created_at
                };

                setExpenses(prev => [...prev, newExp]);
                showToast('Gasto SAP registrado', 'success');
            }

            setNewExpense({ date: new Date().toISOString().split('T')[0], category: COST_CATEGORIES[0], amount: '', desc: '' });
            setEditingExpenseId(null);
        } catch (err: any) {
            showToast('Error: ' + err.message, 'error');
        }
    };

    const deleteCost = async (id: string) => {
        if (window.confirm('¿Borrar?')) {
            try {
                const { error } = await supabase.from('expenses').delete().eq('id', id);
                if (error) throw error;
                setExpenses(prev => prev.filter(e => e.id !== id));
            } catch (err: any) {
                showToast('Error: ' + err.message, 'error');
            }
        }
    };

    const handleEditExpense = (e: any) => {
        setEditingExpenseId(e.id);
        setNewExpense({
            date: e.date,
            category: e.category,
            amount: e.amount.toString(),
            desc: e.description
        });
    };

    const cancelEditExpense = () => {
        setEditingExpenseId(null);
        setNewExpense({ date: new Date().toISOString().split('T')[0], category: COST_CATEGORIES[0], amount: '', desc: '' });
    };

    const saveBudget = async () => {
        try {
            const { error } = await supabase.from('projects')
                .update({ budget: tempBudget })
                .eq('id', selectedProject!.id);

            if (error) throw error;

            const updatedProject = { ...selectedProject!, budget: tempBudget };
            setProjects(prev => prev.map(p => p.id === selectedProject!.id ? updatedProject : p));
            setSelectedProject(updatedProject);
            showToast('Presupuesto actualizado', 'success');
            setIsBudgetMode(false);
        } catch (err: any) {
            showToast('Error: ' + err.message, 'error');
        }
    };

    const saveInitialReal = async () => {
        try {
            const { error } = await supabase.from('projects')
                .update({ initial_real_values: tempInitialReal })
                .eq('id', selectedProject!.id);

            if (error) throw error;

            const updatedProject = { ...selectedProject!, initialRealValues: tempInitialReal };
            setProjects(prev => prev.map(p => p.id === selectedProject!.id ? updatedProject : p));
            setSelectedProject(updatedProject);
            showToast('Referencia real actualizada', 'success');
            setIsInitialRealMode(false);
        } catch (err: any) {
            showToast('Error: ' + err.message, 'error');
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredProjects = React.useMemo(() => {
        const statusOrder: Record<string, number> = {
            'En ejecución': 0,
            'Soporte': 1,
            'Intervención temprana': 2,
            'Finalizado': 3,
            'POC': 4,
        };

        return projects
            .filter(p =>
                (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.pm || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.opportunityNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                const orderA = statusOrder[a.status] ?? 99;
                const orderB = statusOrder[b.status] ?? 99;

                if (orderA !== orderB) return orderA - orderB;

                // Secondary sort: alphabetically by client name
                const clientA = (a.clientName || '').toLowerCase();
                const clientB = (b.clientName || '').toLowerCase();
                if (clientA !== clientB) return clientA.localeCompare(clientB);

                // Tertiary sort: alphabetically by project name
                return a.name.localeCompare(b.name);
            });
    }, [projects, searchTerm]);

    return (
        <div className="fade-in">
            {/* Hidden file input for SAP import */}
            <input ref={sapFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleSAPFile(e.target.files[0]); e.target.value = ''; }} />

            {/* SAP Import Preview Modal */}
            {showSAPImport && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b dark:border-slate-700">
                            <h3 className="text-lg font-black dark:text-white flex items-center gap-3">
                                <i className="fas fa-file-excel text-green-500"></i>
                                Vista previa — Importación SAP
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">{sapImportData.length} categorías a actualizar. Revisá antes de confirmar.</p>
                        </div>
                        <div className="overflow-y-auto flex-1 p-4">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-gray-500 uppercase">
                                    <tr>
                                        <th className="p-3 text-left">Proyecto</th>
                                        <th className="p-3 text-left">PEP</th>
                                        <th className="p-3 text-left">Categoría</th>
                                        <th className="p-3 text-right">SAP Anterior</th>
                                        <th className="p-3 text-right">SAP Nuevo</th>
                                        <th className="p-3 text-center">Δ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {sapImportData.map((e, i) => {
                                        const diff = e.amount - e.prevAmount;
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <td className="p-3">
                                                    <div className="font-bold dark:text-white">{e.projectName}</div>
                                                    <div className="text-[10px] text-indigo-500 font-mono">{e.oppNum}</div>
                                                </td>
                                                <td className="p-3 font-mono text-gray-500">{e.pepCode}</td>
                                                <td className="p-3 text-gray-600 dark:text-gray-300">{e.category}</td>
                                                <td className="p-3 text-right font-mono text-gray-400">${e.prevAmount.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                                                <td className="p-3 text-right font-mono font-bold text-green-600 dark:text-green-400">${e.amount.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diff > 0 ? 'bg-amber-100 text-amber-700' : diff < 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {diff > 0 ? '+' : ''}{diff.toLocaleString('es-AR', {minimumFractionDigits:2})}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => { setShowSAPImport(false); setSAPImportData([]); }} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors">Cancelar</button>
                            <button onClick={confirmSAPImport} disabled={isImporting} className="px-8 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl font-black text-sm transition-all flex items-center gap-2 shadow-lg">
                                {isImporting ? <><i className="fas fa-circle-notch fa-spin"></i> Importando...</> : <><i className="fas fa-check"></i> Confirmar importación</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Control de Costos</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-500/20">
                        <i className="fas fa-chart-bar"></i>
                        Informe de Costos
                    </button>
                    <button onClick={() => sapFileRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-500/20">
                        <i className="fas fa-file-import"></i>
                        Importar desde SAP
                    </button>
                    <button onClick={() => exportCostsToExcel(filteredProjects, expenses)} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-700/20">
                        <i className="fas fa-file-excel"></i>
                        Exportar Excel
                    </button>
                </div>
                <div className="flex-1 max-w-md w-full relative">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        placeholder="Buscar por TP-AR, PM, nombre o cliente..."
                        className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-dark-border">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-sm uppercase">
                        <tr>
                            <th className="p-4">Proyecto</th>
                            <th className="p-4 text-right">Presupuesto</th>
                            <th className="p-4 text-right">SAP (Manual)</th>
                            <th className="p-4 text-right">Real (Horas)</th>
                            <th className="p-4 text-center">PEPs en Alerta</th>
                            <th className="p-4 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {filteredProjects.map(p => {
                            const budgetValues = Object.values(p.budget || {}) as number[];
                            const totalBudget: number = budgetValues.reduce((a, b) => a + (Number(b) || 0), 0);

                            const projExpenses = expenses.filter(e => e.projectId === p.id);
                            const totalSAP = projExpenses.reduce((s, e) => s + e.amount, 0);

                            const projHours = capacityData.assignments.filter(a => a.projectId === p.id);
                            const hoursCost = projHours.reduce((s, a) => s + (a.hours * COST_PER_HOUR), 0);
                            const initialReal = Object.values((p.initialRealValues || {}) as Record<string, number>).reduce((s, v) => s + (Number(v) || 0), 0);
                            const totalReal = initialReal + hoursCost;

                            const alertCategories = COST_CATEGORIES.filter(cat => {
                                const b = p.budget?.[cat] || 0;
                                const s = projExpenses.filter(e => e.category === cat).reduce((acc, e) => acc + e.amount, 0);
                                return s > b || s < 0;
                            });
                            const alertSuffixes = alertCategories.map(c => c.split('-')[0]);
                            const hasAlert = alertSuffixes.length > 0;

                            return (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs">
                                    <td className="p-4">
                                        <div className="font-bold dark:text-white text-sm flex items-center gap-2">
                                            {p.name}
                                            {hasAlert && (
                                                <span className="text-red-500 text-xs" title="Atención: Una o más categorías tienen conflictos (presupuesto excedido o valores negativos)">
                                                    <i className="fas fa-exclamation-triangle"></i>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase">{p.opportunityNumber}</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{p.clientName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-mono dark:text-gray-300">${totalBudget.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono dark:text-gray-300">${totalSAP.toLocaleString()}</td>
                                    <td className="p-4 text-right font-mono font-bold dark:text-white">${totalReal.toLocaleString()}</td>
                                    <td className="p-4 text-center">
                                        {alertSuffixes.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 justify-center max-w-[120px] mx-auto">
                                                {alertSuffixes.map(s => {
                                                    const catName = COST_CATEGORIES.find(c => c.startsWith(s + '-'));
                                                    const catSap = projExpenses.filter(e => e.category === catName).reduce((acc, e) => acc + e.amount, 0);
                                                    const catBudget = p.budget?.[catName!] || 0;
                                                    const isNegative = catSap < 0;
                                                    const isExceeded = catSap > catBudget;

                                                    return (
                                                        <span 
                                                            key={s} 
                                                            className={`px-1.5 py-0.5 border rounded text-[9px] font-black shadow-sm ${isNegative ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-red-100 text-red-800 border-red-200'}`} 
                                                            title={isNegative ? `El PEP -${s} tiene valores negativos en SAP` : `El PEP -${s} ha excedido el presupuesto`}
                                                        >
                                                            PEP-{s}{isNegative ? ' (!)' : ''}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 font-bold text-xs"><i className="fas fa-check text-green-500 mr-1"></i> OK</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => manageCosts(p)} className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 shadow-sm px-3 py-1.5 rounded-lg text-xs transition-all hover:shadow-md dark:bg-slate-800 dark:border-slate-600 dark:text-indigo-400">
                                            <i className="fas fa-list-ul mr-2"></i>Gestionar
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                {selectedProject && !isBudgetMode && !isInitialRealMode && (
                    <>
                        <div className="flex justify-between items-center mb-10 pr-12">
                            <div className="flex flex-col">
                                <h3 className="text-2xl font-black dark:text-white flex items-center gap-3">
                                    <i className="fas fa-wallet text-emerald-500"></i> {selectedProject.name}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setTempInitialReal(selectedProject.initialRealValues || {}); setIsInitialRealMode(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/30 transition-all active:scale-95 uppercase tracking-widest"><i className="fas fa-history mr-2"></i> Referencia Real</button>
                                <button onClick={() => { setTempBudget(selectedProject.budget || {}); setIsBudgetMode(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-indigo-500/30 transition-all active:scale-95 uppercase tracking-widest"><i className="fas fa-edit mr-2"></i> Presupuesto</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {COST_CATEGORIES.map(category => {
                                const budgeted = selectedProject.budget[category] || 0;

                                // SAP: Manual Expenses
                                const sap = expenses.filter(e => e.projectId === selectedProject.id && e.category === category).reduce((s, x) => s + x.amount, 0);

                                // Real: Reference + Hours
                                const { capacityData, team } = useApp();
                                const pmRoles = ['PM', 'Project Manager', 'Gerente'];
                                const projHours = capacityData.assignments.filter(a => a.projectId === selectedProject.id);
                                let hoursAmt = 0;
                                if (category === "11-Servicios Propios - Horas de PM") {
                                    hoursAmt = projHours.filter(a => pmRoles.includes(team.find(t => t.id === a.memberId)?.role || '')).reduce((s, a) => s + (a.hours * COST_PER_HOUR), 0);
                                } else if (category === "12-Servicios Propios - Horas Ingenieros") {
                                    hoursAmt = projHours.filter(a => !pmRoles.includes(team.find(t => t.id === a.memberId)?.role || '')).reduce((s, a) => s + (a.hours * COST_PER_HOUR), 0);
                                }

                                const ref = (selectedProject.initialRealValues || {})[category] || 0;
                                const executed = ref + hoursAmt;

                                const hasAlertCard = sap > budgeted || sap < 0;
                                const pct = budgeted > 0 ? (sap / budgeted) * 100 : 0;
                                let color = (pct > 100 || sap < 0) ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';
                                return (
                                    <div key={category} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${hasAlertCard ? 'bg-red-50/50 dark:bg-red-900/10 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-slate-50 dark:bg-slate-800 border-transparent dark:border-slate-700'}`}>
                                        <div className="flex justify-between items-start mb-2 h-8">
                                            <span className={`text-[10px] font-black uppercase tracking-widest leading-tight ${hasAlertCard ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {category}
                                            </span>
                                            {sap < 0 && <span className="text-[8px] bg-red-600 text-white px-2 py-1.5 rounded-lg font-black text-center leading-none flex items-center justify-center min-w-[80px]">VALOR NEGATIVO</span>}
                                            {sap > budgeted && <span className="text-[8px] bg-red-600 text-white px-2 py-1.5 rounded-lg font-black text-center leading-none flex items-center justify-center min-w-[80px]">EXCEDIDO</span>}
                                        </div>
                                        <div className="flex flex-col gap-1 mb-3">
                                            <div className="flex justify-between text-xs font-mono">
                                                <span className="text-gray-400">SAP:</span>
                                                <span className="text-gray-600 dark:text-gray-300 font-bold">${sap.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-mono">
                                                <span className="text-emerald-500 font-black">REAL:</span>
                                                <span className="text-gray-900 dark:text-white font-black">${executed.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1 border-t dark:border-slate-700 pt-1">
                                                <span>Pres: ${budgeted.toLocaleString()}</span>
                                                <span className={pct > 100 ? 'text-red-500 font-bold' : ''}>{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }}></div></div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1 bg-white dark:bg-slate-900 border dark:border-slate-700 p-6 rounded-2xl shadow-sm">
                                <h4 className="text-xs font-black mb-6 dark:text-white text-indigo-600 flex items-center uppercase tracking-[0.2em]">
                                    <i className={`fas ${editingExpenseId ? 'fa-edit' : 'fa-plus-circle'} mr-2 text-lg`}></i>
                                    {editingExpenseId ? 'Editar Gasto SAP' : 'Nuevo Gasto SAP'}
                                </h4>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fecha</label>
                                        <input type="date" className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all outline-none text-xs dark:text-white" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Categoría</label>
                                        <select className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all outline-none text-xs dark:text-white" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}>
                                            {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Monto (USD)</label>
                                        <input type="number" placeholder="0.00" className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all outline-none text-xs dark:text-white font-mono" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Descripción</label>
                                        <input type="text" placeholder="Ej: Licencias, Hardware..." className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 transition-all outline-none text-xs dark:text-white" value={newExpense.desc} onChange={e => setNewExpense({ ...newExpense, desc: e.target.value })} />
                                    </div>

                                    <div className="flex gap-2 font-black">
                                        <button onClick={addCost} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl shadow-xl shadow-indigo-500/20 text-[10px] uppercase tracking-[0.15em] transition-all active:scale-95">
                                            {editingExpenseId ? 'Guardar Cambios' : 'Registrar en SAP'}
                                        </button>
                                        {editingExpenseId && (
                                            <button onClick={cancelEditExpense} className="px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 rounded-xl transition-all" title="Cancelar edición">
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-2 overflow-y-auto max-h-[600px] border dark:border-slate-800 rounded-2xl">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-400 font-black uppercase tracking-widest sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4">Fecha</th>
                                            <th className="p-4">Origen</th>
                                            <th className="p-4">Categoría</th>
                                            <th className="p-4">Descripción / Recurso</th>
                                            <th className="p-4 text-right">Monto</th>
                                            <th className="p-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-50 dark:divide-slate-800">
                                        {(() => {
                                            const { capacityData, team } = useApp();
                                            const pmRoles = ['PM', 'Project Manager', 'Gerente'];

                                            const sapEntries = expenses
                                                .filter(e => e.projectId === selectedProject.id)
                                                .map(e => ({ ...e, origin: 'SAP', isReal: false }));

                                            const capacityEntries = capacityData.assignments
                                                .filter(a => a.projectId === selectedProject.id)
                                                .map(a => {
                                                    const member = team.find(t => t.id === a.memberId);
                                                    const isPM = pmRoles.includes(member?.role || '');
                                                    return {
                                                        id: a.id,
                                                        date: a.date,
                                                        origin: 'REAL',
                                                        isReal: true,
                                                        category: isPM ? "11-Servicios Propios - Horas de PM" : "12-Servicios Propios - Horas Ingenieros",
                                                        description: `Hs: ${a.hours} - ${member?.name || 'S/N'}`,
                                                        amount: a.hours * COST_PER_HOUR
                                                    };
                                                });

                                            return [...sapEntries, ...capacityEntries]
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map(e => (
                                                    <tr key={e.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${e.isReal ? 'bg-emerald-50/20 dark:bg-emerald-900/10' : ''}`}>
                                                        <td className="p-4 text-gray-400 font-mono text-[10px]">{formatDate(e.date)}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${e.isReal ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                                {e.origin}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-gray-500 dark:text-gray-400 font-medium max-w-[150px] truncate" title={e.category}>{e.category}</td>
                                                        <td className="p-4 dark:text-gray-200 font-bold">{e.description}</td>
                                                        <td className="p-4 text-right font-mono font-bold dark:text-white">${e.amount.toLocaleString()}</td>
                                                        <td className="p-4 text-right">
                                                            {!e.isReal && (
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => handleEditExpense(e)} className={`text-gray-300 hover:text-indigo-500 transition-colors ${editingExpenseId === e.id ? 'text-indigo-500' : ''}`} title="Editar">
                                                                        <i className="fas fa-edit text-xs"></i>
                                                                    </button>
                                                                    <button onClick={() => deleteCost(e.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Borrar">
                                                                        <i className="fas fa-trash text-xs"></i>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
                {selectedProject && isBudgetMode && (
                    <>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <i className="fas fa-edit fa-lg"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter">Presupuesto (Manual)</h3>
                                <p className="text-xs text-gray-500 font-medium">Asignación de costos planificados por categoría</p>
                            </div>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                            <div className="grid grid-cols-1 gap-2">
                                {COST_CATEGORIES.map((cat, idx) => (
                                    <div key={idx} className="flex items-center gap-6 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                                        <label className="text-xs dark:text-gray-300 w-2/3 font-black uppercase tracking-widest text-gray-500 group-hover:text-indigo-600 transition-colors">{cat}</label>
                                        <div className="w-1/3 relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                                            <input
                                                type="number"
                                                value={tempBudget[cat] || ''}
                                                onChange={e => setTempBudget({ ...tempBudget, [cat]: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-12 pl-8 pr-4 rounded-xl bg-gray-50 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none text-right font-mono font-bold"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-10 flex justify-end gap-4">
                            <button onClick={() => setIsBudgetMode(false)} className="px-8 py-3 text-xs font-black text-gray-400 hover:text-gray-600 tracking-widest uppercase">DESCARTAR</button>
                            <button onClick={saveBudget} className="bg-indigo-600 text-white px-10 py-3 rounded-xl hover:bg-indigo-700 font-black text-xs tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">GUARDAR PLAN</button>
                        </div>
                    </>
                )}
                {selectedProject && isInitialRealMode && (
                    <>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <i className="fas fa-history fa-lg"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter">Referencia Real (Fija)</h3>
                                <p className="text-xs text-gray-500 font-medium">Carga histórica de costos reales ya consumidos</p>
                            </div>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                            <div className="grid grid-cols-1 gap-2">
                                {COST_CATEGORIES.map((cat, idx) => (
                                    <div key={idx} className="flex items-center gap-6 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                                        <label className="text-xs dark:text-gray-300 w-2/3 font-black uppercase tracking-widest text-gray-500 group-hover:text-emerald-600 transition-colors">{cat}</label>
                                        <div className="w-1/3 relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                                            <input
                                                type="number"
                                                value={tempInitialReal[cat] || ''}
                                                onChange={e => setTempInitialReal({ ...tempInitialReal, [cat]: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-12 pl-8 pr-4 rounded-xl bg-gray-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 focus:bg-white transition-all outline-none text-right font-mono font-bold"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-10 flex justify-end gap-4">
                            <button onClick={() => setIsInitialRealMode(false)} className="px-8 py-3 text-xs font-black text-gray-400 hover:text-gray-600 tracking-widest uppercase">DESCARTAR</button>
                            <button onClick={saveInitialReal} className="bg-emerald-600 text-white px-10 py-3 rounded-xl hover:bg-emerald-700 font-black text-xs tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">ESTABLECER REFERENCIA</button>
                        </div>
                    </>
                )}
            </Modal>

            {/* Costs Report Modal */}
            {showReport && createPortal(
                <div className="fixed inset-0 z-[300] bg-white dark:bg-slate-950 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 report-print-container">
                    <style>{`
                        @media print {
                            /* Hide EVERYTHING except the report portal */
                            body > *:not(.report-print-container) {
                                display: none !important;
                            }

                            html, body {
                                height: auto !important;
                                min-height: 100vh !important;
                                overflow: visible !important;
                                background: white !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }

                            .report-print-container {
                                position: static !important;
                                display: block !important;
                                width: 100% !important;
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }

                            .report-header {
                                display: flex !important;
                                justify-content: space-between !important;
                                align-items: center !important;
                                border-bottom: 2px solid #f1f5f9 !important;
                                padding-bottom: 20px !important;
                                margin-bottom: 40px !important;
                            }

                            .report-inner {
                                max-width: 1100px !important;
                                margin: 0 auto !important;
                                padding: 30px !important;
                            }

                            .report-card { 
                                break-inside: avoid !important; 
                                page-break-inside: avoid !important;
                                border: 1px solid #f1f5f9 !important; 
                                margin-bottom: 2rem !important; 
                                display: block !important;
                                border-radius: 1.5rem !important;
                            }

                            .no-print { display: none !important; }
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        }
                    `}</style>
                    <div className="max-w-6xl mx-auto p-8 report-inner">
                        <div className="flex justify-between items-center mb-12 py-4 border-b dark:border-slate-800 report-header">
                            <div>
                                <h1 className="text-3xl font-black dark:text-white">Informe Ejecutivo de Desvíos de Costos</h1>
                                <p className="text-gray-500 font-medium">Análisis de desvíos presupuestarios y anomalías en SAP</p>
                            </div>
                            <div className="flex gap-4 no-print">
                                <button onClick={() => window.print()} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-transform hover:scale-105">
                                    <i className="fas fa-print"></i> Imprimir / Guardar PDF
                                </button>
                                <button onClick={() => setShowReport(false)} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                            {(() => {
                                let totalB = 0;
                                let totalS = 0;
                                let totalR = 0;
                                let totalA = 0;
                                const { capacityData } = useApp();

                                projects.forEach(p => {
                                    totalB += Object.values(p.budget || {}).reduce<number>((s, v) => s + (Number(v) || 0), 0);
                                    const projExp = expenses.filter(e => e.projectId === p.id);
                                    totalS += projExp.reduce((s, e) => s + e.amount, 0);
                                    
                                    // Calculate Real
                                    const projHours = capacityData.assignments.filter(a => a.projectId === p.id);
                                    const hoursCost = projHours.reduce((s, a) => s + (a.hours * COST_PER_HOUR), 0);
                                    const initialReal = Object.values((p.initialRealValues || {}) as Record<string, number>).reduce((s, v) => s + (Number(v) || 0), 0);
                                    totalR += initialReal + hoursCost;

                                    COST_CATEGORIES.forEach(cat => {
                                        const sap = projExp.filter(e => e.category === cat).reduce((s, x) => s + x.amount, 0);
                                        const b = p.budget?.[cat] || 0;
                                        if (sap > b || sap < 0) totalA++;
                                    });
                                });

                                return (
                                    <>
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Presupuesto Total</span>
                                            <div className="text-3xl font-black text-indigo-900 dark:text-indigo-100 mt-1">${totalB.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800">
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Consumido SAP Total</span>
                                            <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">${totalS.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Real (Horas/Manual)</span>
                                            <div className="text-3xl font-black text-blue-900 dark:text-blue-100 mt-1">${totalR.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-3xl border border-red-100 dark:border-red-800">
                                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">PEPs con Alerta</span>
                                            <div className="text-3xl font-black text-red-900 dark:text-red-100 mt-1">{totalA}</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Project Breakdown */}
                        <div className="space-y-12">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Desglose por Proyecto (Ordenado por criticidad)</h2>
                            {projects.map(p => {
                                const projExp = expenses.filter(e => e.projectId === p.id);
                                const projHours = capacityData.assignments.filter(a => a.projectId === p.id);
                                const initialRealValues = (p.initialRealValues || {}) as Record<string, number>;

                                let negativeCount = 0;
                                let exceededCount = 0;
                                let totalDev = 0;
                                
                                const catsData = COST_CATEGORIES.map(cat => {
                                    const sap = projExp.filter(e => e.category === cat).reduce((s, x) => s + x.amount, 0);
                                    const b = p.budget?.[cat] || 0;
                                    
                                    // Calculate Real per category
                                    const suffix = cat.split('-')[0];
                                    const catHours = projHours.filter(a => {
                                        if (suffix === '11') return a.role?.toLowerCase().includes('pm');
                                        if (suffix === '12') return !a.role?.toLowerCase().includes('pm');
                                        return false;
                                    }).reduce((s, a) => s + (a.hours * COST_PER_HOUR), 0);
                                    
                                    const real = (initialRealValues[cat] || 0) + catHours;

                                    if (sap < 0) negativeCount++;
                                    if (sap > b) {
                                        exceededCount++;
                                        totalDev += (sap - b);
                                    }
                                    return { cat, sap, b, real, diff: sap - b, suffix };
                                });

                                return { ...p, negativeCount, exceededCount, totalDev, catsData, totalAlerts: negativeCount + exceededCount };
                            })
                            .sort((a, b) => {
                                if (b.totalAlerts !== a.totalAlerts) return b.totalAlerts - a.totalAlerts;
                                return b.totalDev - a.totalDev;
                            })
                            .map(p => {
                                // Chart scaling logic
                                const allVals = p.catsData.flatMap(c => [c.sap, c.b]);
                                const minV = Math.min(0, ...allVals);
                                const maxV = Math.max(1000, ...allVals);
                                const range = maxV - minV;
                                const h = 200;
                                const w = 800;
                                const pad = 40;
                                const chartH = h - (pad * 2);
                                const chartW = w - (pad * 2);
                                const scale = chartH / range;
                                const zeroY = pad + (maxV * scale);
                                const getY = (v: number) => zeroY - (v * scale);

                                return (
                                    <div key={p.id} className={`report-card p-8 rounded-3xl border-2 transition-all ${p.totalAlerts > 0 ? 'bg-white dark:bg-slate-900 border-red-100 dark:border-red-900/30 shadow-lg shadow-red-500/5' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent dark:border-slate-800'}`}>
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-black dark:text-white">{p.name}</h3>
                                                    {p.totalAlerts > 0 && <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter">ALERTA CRÍTICA</span>}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{p.opportunityNumber}</span>
                                                    <span className="text-xs text-gray-400 font-medium">{p.clientName}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Desvío Total</div>
                                                <div className={`text-xl font-mono font-black ${p.totalDev > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {p.totalDev > 0 ? `+$${p.totalDev.toLocaleString()}` : '$0'}
                                                </div>
                                            </div>
                                        </div>

                                        {p.aiSummary && (
                                            <div className="mb-8 p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                                <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                                                    <i className="fas fa-magic"></i> Resumen Ejecutivo de Gestión
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                                    {p.aiSummary}
                                                </p>
                                            </div>
                                        )}

                                        {/* SVG Chart */}
                                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 mb-8 border dark:border-slate-800">
                                            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
                                                {/* Grid Lines */}
                                                <line x1={pad} y1={zeroY} x2={w-pad} y2={zeroY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
                                                <text x={pad-5} y={zeroY} textAnchor="end" dominantBaseline="middle" className="text-[10px] fill-slate-400 font-bold">0</text>
                                                <text x={pad-5} y={getY(maxV)} textAnchor="end" dominantBaseline="middle" className="text-[10px] fill-slate-400 font-bold">${Math.round(maxV).toLocaleString()}</text>
                                                {minV < 0 && <text x={pad-5} y={getY(minV)} textAnchor="end" dominantBaseline="middle" className="text-[10px] fill-slate-400 font-bold">${Math.round(minV).toLocaleString()}</text>}

                                                {/* Bars */}
                                                {p.catsData.map((c, i) => {
                                                    const barW = (chartW / p.catsData.length) * 0.8;
                                                    const spacing = chartW / p.catsData.length;
                                                    const xBase = pad + (i * spacing) + (spacing * 0.1);
                                                    
                                                    const budgetY = getY(c.b);
                                                    const budgetH = Math.abs(zeroY - budgetY);
                                                    
                                                    const sapY = getY(c.sap);
                                                    const sapH = Math.abs(zeroY - sapY);
                                                    const isNegative = c.sap < 0;
                                                    const isExceeded = c.sap > c.b;

                                                    return (
                                                        <g key={c.cat}>
                                                            {/* Budget Bar (Left) */}
                                                            <rect 
                                                                x={xBase} 
                                                                y={c.b >= 0 ? budgetY : zeroY} 
                                                                width={barW/2.2} 
                                                                height={budgetH || 1} 
                                                                fill="#cbd5e1" 
                                                                className="opacity-50"
                                                                rx="2"
                                                            />
                                                            {/* SAP Bar (Right) */}
                                                            <rect 
                                                                x={xBase + barW/2} 
                                                                y={c.sap >= 0 ? sapY : zeroY} 
                                                                width={barW/2.2} 
                                                                height={sapH || 1} 
                                                                fill={isNegative ? "#a855f7" : isExceeded ? "#ef4444" : "#10b981"}
                                                                rx="2"
                                                            />
                                                            {/* Label */}
                                                            <text 
                                                                x={xBase + barW/2} 
                                                                y={h - pad + 15} 
                                                                textAnchor="middle" 
                                                                className="text-[9px] font-black fill-slate-400 uppercase"
                                                            >
                                                                PEP-{c.suffix}
                                                            </text>
                                                        </g>
                                                    );
                                                })}
                                            </svg>
                                            <div className="flex justify-center gap-6 mt-4 text-[9px] font-bold uppercase tracking-widest no-print">
                                                <div className="flex items-center gap-2 text-slate-400"><div className="w-3 h-3 bg-slate-300 rounded-sm"></div> Presupuesto</div>
                                                <div className="flex items-center gap-2 text-emerald-500"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Consumo OK</div>
                                                <div className="flex items-center gap-2 text-red-500"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Excedido</div>
                                                <div className="flex items-center gap-2 text-purple-500"><div className="w-3 h-3 bg-purple-500 rounded-sm"></div> Negativo</div>
                                            </div>
                                        </div>

                                        {/* Status Table Summary */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                                            {p.catsData.map(c => {
                                                const hasConflict = c.sap > c.b || c.sap < 0;
                                                if (!hasConflict && c.sap === 0) return null;
                                                return (
                                                    <div key={c.cat} className="flex justify-between items-center py-2 border-b dark:border-slate-800 text-[10px]">
                                                        <span className={`font-bold uppercase ${hasConflict ? 'text-red-500' : 'text-slate-500'}`}>{c.cat}</span>
                                                        <div className="flex gap-4 font-mono">
                                                            <span className="text-slate-400" title="Presupuesto">P: ${c.b.toLocaleString()}</span>
                                                            <span className={`font-black ${c.sap < 0 ? 'text-purple-500' : c.sap > c.b ? 'text-red-500' : 'text-emerald-500'}`} title="Consumo SAP">S: ${c.sap.toLocaleString()}</span>
                                                            {c.real > 0 && <span className="text-blue-500 font-bold" title="Costo Real (Horas/Manual)">R: ${c.real.toLocaleString()}</span>}
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
                </div>,
                document.body
            )}
        </div>
    );
};