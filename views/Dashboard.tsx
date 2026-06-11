import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { getPastWeeksKeys, getWeekKey, generateUUID, calculateProjectHealth, parseExcelNumber, formatDate } from '../utils/helpers';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';
import { Project, SEGMENTS, VERTICALS, VENDORS, ProjectStatusUpdate, COST_CATEGORIES } from '../types';

export const DashboardView: React.FC = () => {
    const { projects, risks, milestones, capacityData, team, expenses, lessons, changes, setProjects, setRisks, setMilestones, setChanges, setLessons, setCapacityData, setTeam, setExpenses, showToast, user } = useApp();

    // --- State y Cálculo para el Cronograma de Proyectos (Gantt H1/H2) ---
    const activeProjects = useMemo(() => {
        return projects.filter(p => p.status === 'En ejecución');
    }, [projects]);

    const [visibleProjectIds, setVisibleProjectIds] = useState<string[]>([]);
    const [cleanView, setCleanView] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Inicializar los proyectos visibles con todos los activos al cargar
    useEffect(() => {
        if (activeProjects.length > 0 && !initialized) {
            setVisibleProjectIds(activeProjects.map(p => p.id));
            setInitialized(true);
        }
    }, [activeProjects, initialized]);

    const getBarGradient = (index: number) => {
        const gradients = [
            'from-emerald-400 to-teal-500 shadow-emerald-500/10 dark:from-emerald-500 dark:to-teal-600',
            'from-blue-400 to-indigo-500 shadow-blue-500/10 dark:from-blue-500 dark:to-indigo-600',
            'from-violet-400 to-purple-500 shadow-purple-500/10 dark:from-violet-500 dark:to-purple-600',
            'from-amber-400 to-orange-500 shadow-amber-500/10 dark:from-amber-500 dark:to-orange-600',
            'from-pink-400 to-rose-500 shadow-pink-500/10 dark:from-pink-500 dark:to-rose-600',
            'from-sky-400 to-cyan-500 shadow-cyan-500/10 dark:from-sky-500 dark:to-cyan-600',
            'from-lime-400 to-green-500 shadow-green-500/10 dark:from-lime-500 dark:to-green-600',
            'from-indigo-400 to-violet-500 shadow-indigo-500/10 dark:from-indigo-500 dark:to-violet-600',
        ];
        return gradients[index % gradients.length];
    };

    const getPillBg = (index: number, active: boolean) => {
        if (!active) return 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-500 dark:border-slate-700 dark:hover:bg-slate-700/80';
        const colors = [
            'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/40',
            'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-950/40',
            'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-950/40',
            'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/40',
            'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 dark:bg-pink-950/20 dark:text-pink-300 dark:border-pink-800 dark:hover:bg-pink-950/40',
            'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-800 dark:hover:bg-sky-950/40',
            'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100 dark:bg-lime-950/20 dark:text-lime-300 dark:border-lime-800 dark:hover:bg-lime-950/40',
            'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-950/40',
        ];
        return colors[index % colors.length];
    };

    const timelineData = useMemo(() => {
        const selectedProjects = activeProjects.filter(p => visibleProjectIds.includes(p.id));
        
        if (selectedProjects.length === 0) {
            return { periods: [], fyHeaders: [], rows: [] };
        }

        const safeParseDate = (dateString?: string) => {
            if (!dateString) return null;
            const d = new Date(dateString + 'T00:00:00');
            return isNaN(d.getTime()) ? null : d;
        };

        const mapped = selectedProjects.map(p => {
            const start = safeParseDate(p.startDate) || new Date();
            const end = safeParseDate(p.realEndDate) || safeParseDate(p.theoreticalEndDate) || new Date();
            const theo = safeParseDate(p.theoreticalEndDate);
            return {
                id: p.id,
                name: p.name,
                clientName: p.clientName || '',
                opportunityNumber: p.opportunityNumber || 'S/N',
                start,
                end,
                theo,
                realEndDate: p.realEndDate || null
            };
        });

        // Ordenar en cascada por fecha de inicio
        mapped.sort((a, b) => a.start.getTime() - b.start.getTime());

        // 1. Encontrar el inicio mínimo y fin máximo de los proyectos seleccionados
        let minTime = Infinity;
        let maxTime = -Infinity;

        mapped.forEach(p => {
            if (p.start.getTime() < minTime) minTime = p.start.getTime();
            if (p.end.getTime() > maxTime) maxTime = p.end.getTime();
        });

        if (minTime === Infinity || maxTime === -Infinity) {
            minTime = new Date().getTime();
            maxTime = new Date().getTime();
        }

        // Agregar un margen de padding (ej. 5% de la duración total o mínimo 7 días)
        const rawDuration = maxTime - minTime;
        const padding = Math.max(7 * 24 * 60 * 60 * 1000, rawDuration * 0.05);
        const timelineStart = minTime - padding;
        const timelineEnd = maxTime + padding;
        const totalDuration = timelineEnd - timelineStart;

        // 2. Determinar semestres que se solapan con el timeline
        const getSemesterVal = (date: Date) => {
            const fy = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
            const isH2 = date.getMonth() < 6;
            return { fy, isH2, val: fy * 2 + (isH2 ? 1 : 0) };
        };

        const startSem = getSemesterVal(new Date(timelineStart));
        const endSem = getSemesterVal(new Date(timelineEnd));

        const periods: { fy: number; label: string; half: 'H1' | 'H2'; start: Date; end: Date; width: number }[] = [];
        let totalCalculatedWidth = 0;

        for (let val = startSem.val; val <= endSem.val; val++) {
            const fy = Math.floor(val / 2);
            const isH2 = val % 2 === 1;
            
            let semStart: Date;
            let semEnd: Date;
            let label = `FY ${fy}/${String(fy + 1).slice(2)}`;
            let half: 'H1' | 'H2';

            if (!isH2) {
                semStart = new Date(fy, 6, 1);
                semEnd = new Date(fy, 11, 31, 23, 59, 59);
                half = 'H1';
            } else {
                semStart = new Date(fy + 1, 0, 1);
                semEnd = new Date(fy + 1, 5, 30, 23, 59, 59);
                half = 'H2';
            }

            // Intersección con el timeline
            const intersectStart = Math.max(semStart.getTime(), timelineStart);
            const intersectEnd = Math.min(semEnd.getTime(), timelineEnd);

            if (intersectStart < intersectEnd) {
                const width = ((intersectEnd - intersectStart) / totalDuration) * 100;
                periods.push({
                    fy,
                    label,
                    half,
                    start: semStart,
                    end: semEnd,
                    width
                });
                totalCalculatedWidth += width;
            }
        }

        // Ajustar el último período para asegurar que la suma sea exactamente 100% (evita problemas de redondeo)
        if (periods.length > 0) {
            const diff = 100 - totalCalculatedWidth;
            periods[periods.length - 1].width += diff;
        }

        // 3. Agrupar períodos consecutivas por FY para cabeceras dinámicas con anchos calculados
        const fyHeaders: { label: string; width: number }[] = [];
        periods.forEach(p => {
            const lastHeader = fyHeaders[fyHeaders.length - 1];
            if (lastHeader && lastHeader.label === p.label) {
                lastHeader.width += p.width;
            } else {
                fyHeaders.push({ label: p.label, width: p.width });
            }
        });

        // 4. Calcular left y width para cada fila de proyecto en base al timeline exacto
        const rows = mapped.map(p => {
            const startMs = p.start.getTime();
            const endMs = p.end.getTime();
            
            const left = Math.max(0, ((startMs - timelineStart) / totalDuration) * 100);
            const rawWidth = ((endMs - startMs) / totalDuration) * 100;
            const width = Math.max(1.5, Math.min(100 - left, rawWidth));

            let relativeTheoLeft: number | null = null;
            if (p.theo && p.theo.getTime() !== endMs) {
                const theoMs = p.theo.getTime();
                if (theoMs >= startMs && theoMs <= endMs) {
                    relativeTheoLeft = ((theoMs - startMs) / (endMs - startMs)) * 100;
                }
            }

            return {
                ...p,
                left,
                width,
                relativeTheoLeft
            };
        });

        return { periods, fyHeaders, rows };
    }, [activeProjects, visibleProjectIds]);

    // --- KPIs de Alto Nivel ---
    const activeProjectsCount = projects.filter(p => p.status === 'En ejecución' || p.status === 'Intervención temprana' || p.status === 'POC').length;
    const totalRevenuePortafolio = projects.reduce((sum, p) => sum + (p.hwValue || 0) + (p.servicesValue || 0), 0);
    const criticalRisksCount = risks.filter(r => r.impact === 'Alto' || r.isProblem).length;
    const healthStatusCounts = projects.reduce((acc, p) => {
        const health = calculateProjectHealth(p, expenses);
        acc[health] = (acc[health] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const projectsInRed = healthStatusCounts['Rojo'] || 0;

    // --- Rankings de Proyectos ---
    const scheduleRanking = useMemo(() => {
        return projects
            .filter(p => p.status === 'En ejecución' || p.status === 'Intervención temprana' || p.status === 'POC')
            .map(p => {
                const theoretical = new Date(p.theoreticalEndDate);
                const currentEnd = p.realEndDate ? new Date(p.realEndDate) : new Date();
                const diffTime = currentEnd.getTime() - theoretical.getTime();
                return {
                    name: p.name,
                    delay: diffTime > 0 ? Math.ceil(diffTime / (1000 * 3600 * 24)) : 0
                };
            })
            .filter(d => d.delay > 0)
            .sort((a, b) => b.delay - a.delay)
            .slice(0, 8);
    }, [projects]);

    const budgetBurnRanking = useMemo(() => {
        return projects.map(p => {
            // Use ONLY the detailed/categorized budget from the Costs tab
            const totalBudget = Object.values(p.budget || {}).reduce<number>((s, v) => s + (Number(v) || 0), 0);

            const actualExpenses = expenses.filter(e => e.projectId === p.id).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const burnRate = totalBudget > 0 ? (actualExpenses / totalBudget) * 100 : 0;

            return {
                name: p.name,
                burnRate: Math.round(burnRate),
                hasBudget: totalBudget > 0
            };
        })
            .filter(d => d.hasBudget)
            .sort((a, b) => b.burnRate - a.burnRate)
            .slice(0, 8);
    }, [projects, expenses]);

    // --- Chart Data Preparation ---

    // 1. Status Donut
    const statusData = useMemo(() => {
        const statuses = ['En ejecución', 'Soporte', 'Intervención temprana', 'POC', 'Finalizado'];
        return statuses.map(status => ({
            name: status,
            value: projects.filter(p => p.status === status).length
        }));
    }, [projects]);
    const STATUS_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#9ca3af'];

    // 2. Revenue vs Cost (Top 5 Projects)
    const revenueCostData = useMemo(() => {
        return [...projects]
            .sort((a, b) => ((b.hwValue || 0) + (b.servicesValue || 0)) - ((a.hwValue || 0) + (a.servicesValue || 0)))
            .slice(0, 5)
            .map(p => ({
                name: `${p.name.substring(0, 15)}... (${p.clientName.substring(0, 10)})`,
                fullName: `${p.name} - ${p.clientName}`,
                venta: (p.hwValue || 0) + (p.servicesValue || 0),
                costo: (p.hwCost || 0) + (p.servicesCost || 0)
            }));
    }, [projects]);

    // 3. Margin % Top Projects
    const marginData = useMemo(() => {
        return [...projects]
            .filter(p => p.cm !== undefined)
            .sort((a, b) => (b.cm || 0) - (a.cm || 0))
            .slice(0, 5)
            .map(p => ({
                name: `${p.name.substring(0, 15)}... (${p.clientName.substring(0, 10)})`,
                fullName: `${p.name} - ${p.clientName}`,
                cm: p.cm || 0
            }));
    }, [projects]);

    // 4. Milestone Status
    const milestoneStatusData = useMemo(() => {
        const invoicedAmount = milestones.filter(m => m.isReceived).reduce((s, m) => s + (m.amount || 0), 0);
        const pendingAmount = milestones.filter(m => !m.isReceived).reduce((s, m) => s + (m.amount || 0), 0);
        return [
            { name: 'Facturado', value: invoicedAmount },
            { name: 'Pendiente', value: pendingAmount }
        ];
    }, [milestones]);
    const MILESTONE_COLORS = ['#10b981', '#f59e0b'];

    // 5. Schedule Delay (Days)
    const scheduleDelayData = useMemo(() => {
        return projects
            .filter(p => p.status === 'En ejecución' || p.status === 'Intervención temprana' || p.status === 'POC')
            .map(p => {
                const theoretical = new Date(p.theoreticalEndDate);
                const currentEnd = p.realEndDate ? new Date(p.realEndDate) : new Date();

                // Only calculate delay if it's actually past theoretical end or real end says so
                const diffTime = currentEnd.getTime() - theoretical.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return {
                    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
                    delay: diffDays > 0 ? diffDays : 0,
                    fullName: p.name
                };
            })
            .filter(d => d.delay > 0)
            .sort((a, b) => b.delay - a.delay)
            .slice(0, 6);
    }, [projects]);

    // 6. Weekly Capacity Load (%) - Updated for daily assignments structure
    const capacityWeeklyData = useMemo(() => {
        const weeks = getPastWeeksKeys(8).sort();
        const assignments = capacityData.assignments || [];

        return weeks.map(wk => {
            // Filter assignments that belong to this week
            // Note: We need a way to filter by week. A simple approach is using getWeekKey on the assignment date.
            const wkAssignments = assignments.filter(a => {
                try {
                    return getWeekKey(new Date(a.date + 'T00:00:00')) === wk;
                } catch {
                    return false;
                }
            });

            const totalHours = wkAssignments.reduce((sum, a) => sum + (a.hours || 0), 0);
            const availability = team.length * 40;
            const loadPercent = availability > 0 ? (totalHours / availability) * 100 : 0;

            return {
                name: wk,
                load: Math.round(loadPercent),
                limit: 100
            };
        });
    }, [capacityData, team]);

    // 7. Margin Leakage Tracker
    const marginComparisonData = useMemo(() => {
        return projects
            .filter(p => ((p.hwValue || 0) + (p.servicesValue || 0)) > 0)
            .map(p => {
                const totalRevenue = (p.hwValue || 0) + (p.servicesValue || 0);
                const estimatedCost = (p.hwCost || 0) + (p.servicesCost || 0);
                const actualExpenses = expenses.filter(e => e.projectId === p.id).reduce((sum, e) => sum + e.amount, 0);

                const targetMargin = p.cm || 0;
                const currentMargin = ((totalRevenue - (estimatedCost + actualExpenses)) / totalRevenue) * 100;

                return {
                    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
                    estimado: Math.round(targetMargin),
                    real: Math.round(currentMargin),
                    fullName: p.name
                };
            })
            .sort((a, b) => (a.estimado - a.real) - (b.estimado - b.real)) // Sort by biggest leakage
            .slice(0, 5);
    }, [projects, expenses]);

    // 8. Top Projects by Effort (Total hours)
    const recentEffortData = useMemo(() => {
        const counts: Record<string, { hours: number; fullLabel: string }> = {};
        capacityData.assignments.forEach(a => {
            if (!a.projectId) return;
            const p = projects.find(px => px.id === a.projectId);
            if (!p) return;
            const key = p.id;
            if (!counts[key]) {
                counts[key] = {
                    hours: 0,
                    fullLabel: `${p.opportunityNumber ? p.opportunityNumber + ' - ' : ''}${p.name}`
                };
            }
            counts[key].hours += (Number(a.hours) || 0);
        });
        return Object.values(counts)
            .map(({ hours, fullLabel }) => ({
                name: fullLabel.length > 18 ? fullLabel.substring(0, 18) + '...' : fullLabel,
                fullLabel,
                hours
            }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 6);
    }, [capacityData, projects]);

    // 9. Resource Load (Current Week)
    const resourceLoadData = useMemo(() => {
        const currentWk = getWeekKey(new Date());
        return team.map(m => {
            const mAssigns = capacityData.assignments.filter(a => a.memberId === m.id && getWeekKey(new Date(a.date + 'T00:00:00')) === currentWk);
            const total = mAssigns.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
            return {
                name: m.name.split(' ')[0],
                hours: total
            };
        }).sort((a, b) => b.hours - a.hours);
    }, [capacityData, team]);

    // --- Export/Import Logic ---

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // 1. Proyectos
        const projectsSheet = XLSX.utils.json_to_sheet(projects.map(p => ({
            Nombre: p.name,
            Cliente: p.clientName,
            PM: p.pm,
            'Nro Oportunidad': p.opportunityNumber,
            Estado: p.status,
            Prioridad: p.status === 'Finalizado' ? '' : (p.priority || ''),
            'Avance Real': p.progress,
            'Fecha Inicio': p.startDate,
            'Fecha Fin Teórica': p.theoreticalEndDate,
            'Valor Venta HW': p.hwValue || 0,
            'Valor Venta Servicio': p.servicesValue || 0,
            'Costo HW': p.hwCost || 0,
            'Costo Servicio': p.servicesCost || 0,
            'CM %': p.cm || 0
        })));
        XLSX.utils.book_append_sheet(wb, projectsSheet, 'Proyectos');

        // 2. Riesgos
        const risksSheet = XLSX.utils.json_to_sheet(risks.map(r => {
            const p = projects.find(px => px.id === r.projectId);
            return {
                Proyecto: p ? `${p.opportunityNumber} - ${p.name}` : 'N/A',
                Prioridad: p ? (p.status === 'Finalizado' ? '' : (p.priority || '')) : '',
                Riesgo: r.description,
                Probabilidad: r.probability,
                Impacto: r.impact,
                'Es Problema': r.isProblem ? 'Sí' : 'No',
                'Plan de Mitigación': r.plan,
                Fecha: r.date
            };
        }));
        XLSX.utils.book_append_sheet(wb, risksSheet, 'Riesgos');

        // 3. Lecciones Aprendidas
        const lessonsSheet = XLSX.utils.json_to_sheet(lessons.map(l => {
            const p = projects.find(px => px.id === l.projectId);
            return {
                Proyecto: p ? `${p.opportunityNumber} - ${p.name}` : 'N/A',
                Prioridad: p ? (p.status === 'Finalizado' ? '' : (p.priority || '')) : '',
                Lección: l.description,
                Categoría: l.category,
                Impacto: l.impact,
                Fecha: l.createdAt
            };
        }));
        XLSX.utils.book_append_sheet(wb, lessonsSheet, 'Lecciones Aprendidas');

        // 4. Control de Cambios
        const lessonsData = lessons.map(l => {
            const p = projects.find(px => px.id === l.projectId);
            return {
                Proyecto: p ? `${p.opportunityNumber} - ${p.name}` : 'N/A',
                Prioridad: p ? (p.status === 'Finalizado' ? '' : (p.priority || '')) : '',
                Lección: l.description,
                Categoría: l.category,
                Impacto: l.impact,
                Fecha: l.createdAt
            };
        });
        const changesSheet = XLSX.utils.json_to_sheet(changes.map(c => {
            const p = projects.find(px => px.id === c.projectId);
            return {
                Proyecto: p ? `${p.opportunityNumber} - ${p.name}` : 'N/A',
                Prioridad: p ? (p.status === 'Finalizado' ? '' : (p.priority || '')) : '',
                Descripción: c.description,
                Tipo: c.type,
                Fecha: c.date
            };
        }));
        XLSX.utils.book_append_sheet(wb, changesSheet, 'Control de Cambios');

        // 5. Hitos
        const hitosSheet = XLSX.utils.json_to_sheet(milestones.map(m => {
            const p = projects.find(px => px.id === m.projectId);
            return {
                Proyecto: p ? `${p.opportunityNumber} - ${p.name}` : 'N/A',
                Prioridad: p ? (p.status === 'Finalizado' ? '' : (p.priority || '')) : '',
                Descripción: m.description,
                Monto: m.amount,
                Fecha: m.date,
                'Monto Cobrado': m.receivedAmount,
                Cobrado: m.isReceived ? 'Sí' : 'No',
                Moneda: m.currency,
                'ID OC': m.ocId,
                'Posición OC': m.ocPosition
            };
        }));
        XLSX.utils.book_append_sheet(wb, hitosSheet, 'Hitos');

        // 6. Control Presupuestario (Budget vs Actual)
        const budgetRows: any[] = [];
        projects.forEach(p => {
            COST_CATEGORIES.forEach(cat => {
                const budget = p.budget ? (p.budget[cat] || 0) : 0;
                const projectExpenses = expenses.filter(e => e.projectId === p.id && e.category === cat);
                const actual = projectExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                if (budget > 0 || actual > 0) {
                    budgetRows.push({
                        Proyecto: `${p.opportunityNumber} - ${p.name}`,
                        Prioridad: p.status === 'Finalizado' ? '' : (p.priority || ''),
                        Categoría: cat,
                        'Presupuesto (USD)': budget,
                        'Gasto Real (USD)': actual,
                        'Desvío (USD)': budget - actual,
                        '% Consumido': budget > 0 ? Number(((actual / budget) * 100).toFixed(2)) : (actual > 0 ? 'Excedido' : 0)
                    });
                }
            });
        });
        const budgetSheet = XLSX.utils.json_to_sheet(budgetRows);
        XLSX.utils.book_append_sheet(wb, budgetSheet, 'Control Presupuestario');

        // 7. Detalle de Gastos
        const expensesSheet = XLSX.utils.json_to_sheet(expenses.map(e => {
            const p = projects.find(px => px.id === e.projectId);
            return {
                Proyecto: p ? `${p.opportunityNumber} - ${p.name}` : 'N/A',
                Prioridad: p ? (p.status === 'Finalizado' ? '' : (p.priority || '')) : '',
                Categoría: e.category,
                Descripción: e.description,
                Tipo: e.type,
                Monto: e.amount,
                Fecha: e.date,
                'Nro Factura': e.invoiceNumber || '-',
                'Proveedor': e.supplier || '-'
            };
        }));
        XLSX.utils.book_append_sheet(wb, expensesSheet, 'Detalle de Gastos');

        // 7. Capacity Plan
        const capacitySheet = XLSX.utils.json_to_sheet((capacityData.assignments || []).map(a => {
            const member = team.find(t => t.id === a.memberId);
            const p = projects.find(px => px.id === a.projectId);

            let typeLabel = a.type;
            const typeMap: Record<string, string> = {
                project: 'Proyecto',
                poc: 'Preventa / POC',
                early_intervention: 'Intervención Temprana',
                vacation: 'Licencia / Vacaciones',
                training: 'Capacitación',
                meetings: 'Reuniones / Admin'
            };
            if (typeMap[a.type]) typeLabel = typeMap[a.type];

            return {
                Recurso: member ? member.name : 'Unknown',
                Rol: member ? member.role : '-',
                Fecha: a.date,
                Horas: a.hours,
                Tipo: typeLabel,
                'Proyecto Asignado': p ? `${p.opportunityNumber} - ${p.name}` : '-',
                Observaciones: a.observations || ''
            };
        }));
        XLSX.utils.book_append_sheet(wb, capacitySheet, 'Capacity Plan');

        // Export
        XLSX.writeFile(wb, `Reporte_PMO_Full_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Reporte Excel generado', 'success');
    };



    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const dataRaw = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(dataRaw, { type: 'array' });

                let updatedProjects = [...projects];

                // 1. Proyectos
                if (workbook.Sheets['Proyectos']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Proyectos']);

                    const normalizeKey = (k: string) => (k || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                    const normalizeMatch = (s: string) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, "");

                    const findVal = (rowObj: any, searchTerms: string[]) => {
                        const rowKeys = Object.keys(rowObj);
                        for (const term of searchTerms) { if (rowObj[term] !== undefined) return rowObj[term]; }
                        const normTerms = searchTerms.map(normalizeKey);
                        const foundKey = rowKeys.find(k => {
                            const nk = normalizeKey(k);
                            return normTerms.some(nt => nk === nt || nk.includes(nt) || nt.includes(nk));
                        });
                        return foundKey ? rowObj[foundKey] : undefined;
                    };

                    const parseExcelDate = (val: any) => {
                        if (!val) return null;
                        if (val instanceof Date) return val.toISOString().split('T')[0];
                        if (typeof val === 'number') {
                            // Handle Excel date numbers
                            const date = new Date((val - 25569) * 86400 * 1000);
                            return date.toISOString().split('T')[0];
                        }
                        if (typeof val === 'string') {
                            const d = new Date(val);
                            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                        }
                        return null;
                    };

                    for (const row of rows as any[]) {
                        const rowName = (findVal(row, ['Nombre', 'Proyecto', 'Project Name']) || '').toString().trim();
                        const rowCode = (findVal(row, ['Nro Oportunidad', 'Nro Oportun', 'Opportunity Number', 'TP-AR', 'Codigo']) || '').toString().trim();
                        const clientName = findVal(row, ['Cliente', 'Client Name']);
                        const pmName = findVal(row, ['PM', 'Project Manager']);
                        const status = findVal(row, ['Estado', 'Status']);
                        const progress = findVal(row, ['Avance Real', 'Avance', 'Progress']);
                        const startDate = findVal(row, ['Fecha Inicio', 'Inicio', 'Start Date']);
                        const endDate = findVal(row, ['Fecha Fin Teórica', 'Fin Teórica', 'Theoretical End Date', 'Fecha Fin']);

                        // Fuzzy matching for existing projects
                        const existing = projects.find(p => {
                            const rCodeNorm = normalizeMatch(rowCode);
                            const pCodeNorm = normalizeMatch(p.opportunityNumber);
                            if (rCodeNorm && pCodeNorm && rCodeNorm === pCodeNorm) return true;

                            const rNameNorm = normalizeMatch(rowName);
                            const pNameNorm = normalizeMatch(p.name);
                            if (rNameNorm && pNameNorm && rNameNorm === pNameNorm) return true;

                            return false;
                        });

                        const payload: any = {
                            name: rowName || (existing ? existing.name : ''),
                            client_name: clientName !== undefined ? clientName : (existing ? existing.clientName : ''),
                            pm: pmName !== undefined ? pmName : (existing ? existing.pm : ''),
                            opportunity_number: rowCode || (existing ? existing.opportunityNumber : ''),
                            status: status !== undefined ? status : (existing ? existing.status : 'En ejecución'),
                            progress: progress !== undefined ? parseExcelNumber(progress) : (existing ? existing.progress : 0),
                            start_date: parseExcelDate(startDate) || (existing ? existing.startDate : new Date().toISOString().split('T')[0]),
                            theoretical_end_date: parseExcelDate(endDate) || (existing ? existing.theoreticalEndDate : new Date().toISOString().split('T')[0]),
                            hw_value: findVal(row, ['Valor Venta HW', 'Venta HW']) !== undefined ? parseExcelNumber(findVal(row, ['Valor Venta HW', 'Venta HW'])) : (existing ? existing.hwValue : null),
                            services_value: findVal(row, ['Valor Venta Servicio', 'Venta Servicio', 'Valor Venta Servicios']) !== undefined ? parseExcelNumber(findVal(row, ['Valor Venta Servicio', 'Venta Servicio', 'Valor Venta Servicios'])) : (existing ? existing.servicesValue : null),
                            hw_cost: findVal(row, ['Costo HW']) !== undefined ? parseExcelNumber(findVal(row, ['Costo HW'])) : (existing ? existing.hwCost : null),
                            services_cost: findVal(row, ['Costo Servicio', 'Costo Servicios']) !== undefined ? parseExcelNumber(findVal(row, ['Costo Servicio', 'Costo Servicios'])) : (existing ? existing.servicesCost : null),
                            cm: findVal(row, ['CM %', 'CM']) !== undefined ? parseExcelNumber(findVal(row, ['CM %', 'CM'])) : (existing ? existing.cm : null),
                            priority: findVal(row, ['Prioridad', 'Priority']) !== undefined ? parseInt(findVal(row, ['Prioridad', 'Priority'])) : (existing ? existing.priority : null),
                            owner_id: user?.id
                        };

                        if (existing) {
                            payload.id = existing.id;
                            const { error: updErr } = await supabase.from('projects').update(payload).eq('id', existing.id);
                            if (updErr) console.error('Error updating project:', updErr);
                        } else {
                            payload.id = generateUUID();
                            const { error: insErr } = await supabase.from('projects').insert(payload);
                            if (insErr) console.error('Error inserting project:', insErr);
                        }
                    }
                    const { data: refreshed } = await supabase.from('projects').select('*');
                    if (refreshed) {
                        updatedProjects = refreshed.map((p: any) => ({
                            id: p.id, name: p.name, clientName: p.client_name, pm: p.pm,
                            opportunityNumber: p.opportunity_number, status: p.status,
                            startDate: p.start_date, theoreticalEndDate: p.theoretical_end_date,
                            progress: p.progress, budget: p.budget || {},
                            hwValue: p.hw_value, servicesValue: p.services_value,
                            hwCost: p.hw_cost, servicesCost: p.services_cost,
                            cm: p.cm,
                            priority: p.priority,
                            milestones: [], ocs: []
                        }));
                        setProjects(updatedProjects);
                    }
                }

                // 2. Riesgos
                if (workbook.Sheets['Riesgos']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Riesgos']);
                    const toInsert = rows.map((row: any) => {
                        const p = updatedProjects.find(px => px.name.trim().toLowerCase() === (row['Proyecto'] || '').toString().trim().toLowerCase());
                        if (!p) return null;
                        return {
                            project_id: p.id,
                            description: row['Descripción'] || row['Riesgo'] || 'Sin descripción',
                            probability: row['Probabilidad'] || 'Media',
                            impact: row['Impacto'] || 'Medio',
                            is_problem: ['si', 'sí', 'yes', 'true'].includes((row['Es Problema'] || '').toString().toLowerCase()),
                            plan: row['Plan de Mitigación'] || '',
                            date: row['Fecha'] || new Date().toISOString()
                        };
                    }).filter(Boolean);
                    if (toInsert.length > 0) {
                        await supabase.from('risks').insert(toInsert);
                        const { data: rs } = await supabase.from('risks').select('*');
                        if (rs) setRisks(rs.map(r => ({
                            id: r.id, projectId: r.project_id, description: r.description,
                            probability: r.probability, impact: r.impact, isProblem: r.is_problem,
                            plan: r.plan, date: r.date, createdAt: r.created_at
                        } as any)));
                    }
                }

                // 3. Process Capacity
                if (workbook.Sheets['Capacity Plan']) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Capacity Plan']);
                    if (rows.length > 0) {
                        const uniqueNames = new Set<string>();
                        const memberRoles: Record<string, string> = {};
                        rows.forEach((row: any) => {
                            const rName = row['Recurso'];
                            if (rName) {
                                const nameTrimmed = rName.toString().trim();
                                uniqueNames.add(nameTrimmed);
                                if (row['Rol'] && !memberRoles[nameTrimmed]) memberRoles[nameTrimmed] = row['Rol'].toString().trim();
                            }
                        });

                        let currentTeam = [...team];
                        const missing = Array.from(uniqueNames).filter(n => !currentTeam.some(t => t.name.toLowerCase() === n.toLowerCase()));
                        if (missing.length > 0) {
                            const { data: newPeeps } = await supabase.from('team_members').insert(missing.map(name => ({ name, role: memberRoles[name] || 'Consultor', owner_id: user?.id }))).select();
                            if (newPeeps) {
                                const mapped = newPeeps.map((x: any) => ({ id: x.id, name: x.name, role: x.role, email: '' }));
                                currentTeam = [...currentTeam, ...mapped];
                                setTeam(currentTeam);
                            }
                        }

                        const assignmentsPayload: any[] = [];
                        rows.forEach((row: any) => {
                            const member = currentTeam.find(t => t.name.toLowerCase() === (row['Recurso'] || '').toString().trim().toLowerCase());
                            if (!member) return;

                            const normalizeKey = (k: string) => (k || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
                            const findVal = (rowObj: any, searchTerms: string[]) => {
                                const rowKeys = Object.keys(rowObj);
                                for (const term of searchTerms) { if (rowObj[term] !== undefined) return rowObj[term]; }
                                const normTerms = searchTerms.map(normalizeKey);
                                const foundKey = rowKeys.find(k => normTerms.some(nt => normalizeKey(k) === nt || normalizeKey(k).includes(nt)));
                                return foundKey ? rowObj[foundKey] : undefined;
                            };

                            const projName = findVal(row, ['Asignación', 'Proyecto', 'Project', 'Nombre Proyecto']) || '';
                            const project = updatedProjects.find(p => p.name.trim().toLowerCase() === projName.toString().trim().toLowerCase());
                            const rawType = (findVal(row, ['Tipo Asignación', 'Tipo de asignación', 'Tipo']) || '').toString().toLowerCase();

                            let type: any = 'project';
                            if (rawType.includes('reuniones') || rawType.includes('meeting')) type = 'reuniones';
                            else if (rawType.includes('capacitac') || rawType.includes('training')) type = 'capacitaciones';
                            else if (rawType.includes('vacaciones') || rawType.includes('vacation')) type = 'licencias';
                            else if (rawType.includes('poc')) type = 'preventiva-poc';
                            else if (rawType.includes('tableros')) type = 'tableros-reportes';
                            else if (rawType.includes('consultoria')) type = 'consultoria';
                            else if (rawType.includes('logistica')) type = 'logistica';
                            else if (rawType.includes('facturacion')) type = 'facturacion';
                            else if (!project && !rawType) type = 'gestion-general';

                            const obs = findVal(row, ['Observaciones', 'Comments', 'Detalle']) || '';

                            Object.keys(row).forEach(key => {
                                if (/^20\d{2}-W\d{2}$/.test(key.trim())) {
                                    const val = parseFloat(row[key]);
                                    if (val > 0) assignmentsPayload.push({ member_id: member.id, week_key: key.trim(), type, project_id: project ? project.id : null, hours: val, observations: obs });
                                }
                            });
                        });

                        if (assignmentsPayload.length > 0) {
                            const weeks = [...new Set(assignmentsPayload.map(a => a.week_key))];
                            const members = [...new Set(assignmentsPayload.map(a => a.member_id))];
                            await supabase.from('capacity_assignments').delete().in('week_key', weeks).in('member_id', members);
                            await supabase.from('capacity_assignments').insert(assignmentsPayload);
                            const { data: allAssigns } = await supabase.from('capacity_assignments').select('*');
                            if (allAssigns) {
                                setCapacityData({
                                    assignments: allAssigns.map((a: any) => ({
                                        id: a.id,
                                        memberId: a.member_id,
                                        type: a.type,
                                        projectId: a.project_id,
                                        date: a.date,
                                        hours: a.hours,
                                        observations: a.observations
                                    }))
                                });
                            }
                        }
                    }
                }

                // 4. Lessons
                const lessonsName = workbook.SheetNames.find(n => n.includes('Lecciones'));
                if (lessonsName) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[lessonsName]);
                    const toInsert = rows.map((row: any) => {
                        const p = updatedProjects.find(px => px.name.trim().toLowerCase() === (row['Proyecto'] || '').toString().trim().toLowerCase());
                        if (!p) return null;
                        return { project_id: p.id, description: row['Descripción'] || row['Lección'], category: row['Categoría'] || 'General', impact: row['Impacto'] || 'Medio' };
                    }).filter(Boolean);
                    if (toInsert.length > 0) {
                        await supabase.from('lessons_learned').insert(toInsert);
                        const { data: ls } = await supabase.from('lessons_learned').select('*');
                        if (ls) setLessons(ls.map(l => ({ id: l.id, projectId: l.project_id, description: l.description, category: l.category, impact: l.impact, createdAt: l.created_at } as any)));
                    }
                }

                // 5. Changes
                const changesName = workbook.SheetNames.find(n => n.includes('Cambio'));
                if (changesName) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[changesName]);
                    const toInsert = rows.map((row: any) => {
                        const p = updatedProjects.find(px => px.name.trim().toLowerCase() === (row['Proyecto'] || '').toString().trim().toLowerCase());
                        if (!p) return null;
                        return { project_id: p.id, description: row['Descripción'] || row['Detalle'], type: row['Tipo'] || 'Scope', date: row['Fecha'] || new Date().toISOString() };
                    }).filter(Boolean);
                    if (toInsert.length > 0) {
                        await supabase.from('changes').insert(toInsert);
                        const { data: cs } = await supabase.from('changes').select('*');
                        if (cs) setChanges(cs.map(c => ({ id: c.id, projectId: c.project_id, description: c.description, type: c.type, date: c.date, createdAt: c.created_at } as any)));
                    }
                }

                // 6. Hitos
                const hitosName = workbook.SheetNames.find(n => n.includes('Hito') || n.includes('Milestone'));
                if (hitosName) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[hitosName]);
                    const toInsert = rows.map((row: any) => {
                        const p = updatedProjects.find(px => px.name.trim().toLowerCase() === (row['Proyecto'] || '').toString().trim().toLowerCase());
                        if (!p) return null;
                        const amt = Number(row['Monto'] || row['Importe'] || 0);
                        const recv = Number(row['Monto Cobrado'] || row['Importe Cobrado'] || 0);
                        return {
                            project_id: p.id, description: row['Descripción'] || row['Detalle'] || 'Hito', amount: amt, date: row['Fecha'] || new Date().toISOString(),
                            received_amount: recv, is_received: ['si', 'sí', 'yes', 'true', '1'].includes((row['Cobrado'] || '').toString().toLowerCase()),
                            currency: row['Moneda'] || 'USD', oc_id: (row['ID OC'] || row['OC'] || '').toString(), oc_position: (row['Posición OC'] || row['Pos'] || '').toString(),
                            received_percentage: amt > 0 ? (recv / amt) * 100 : 0
                        };
                    }).filter(Boolean);
                    if (toInsert.length > 0) {
                        const pids = [...new Set(toInsert.map((h: any) => h.project_id))];
                        await supabase.from('milestones').delete().in('project_id', pids);
                        await supabase.from('milestones').insert(toInsert);
                        const { data: ms } = await supabase.from('milestones').select('*');
                        if (ms) {
                            const mapped = ms.map((m: any) => ({
                                id: m.id, projectId: m.project_id, description: m.description, amount: m.amount, date: m.date, receivedAmount: m.received_amount,
                                isReceived: m.is_received, currency: m.currency, ocId: m.oc_id, ocPosition: m.oc_position, receivedPercentage: m.received_percentage
                            }));
                            setMilestones(mapped);
                            setProjects(prev => prev.map(px => ({ ...px, milestones: mapped.filter(mx => mx.projectId === px.id) })));
                        }
                    }
                }

                showToast('Importación exitosa', 'success');
            } catch (err) {
                console.error('Excel Import Error:', err);
                showToast('Error procesando el archivo Excel', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const Card = ({ title, value, icon, color, sub }: any) => (
        <div className={`bg-white dark:bg-dark-card dark:border-dark-border p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-${color}-500 hover:shadow-md transition-shadow h-full flex flex-col justify-center`}>
            <div className="flex items-center">
                <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600 dark:bg-${color}-900 dark:text-${color}-300`}><i className={`fas ${icon} fa-2x`}></i></div>
                <div className="ml-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                    <p className="text-2xl font-bold dark:text-white">{value}</p>
                    {sub}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fade-in pb-10">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard PMO</h2>
                    <p className="text-gray-500 dark:text-gray-400">Análisis temporal y financiero</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportToExcel} className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm transition-colors shadow-sm hover:shadow-md"><i className="fas fa-file-excel mr-2"></i>Reporte Full</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card
                    title="Proyectos Activos"
                    value={activeProjectsCount}
                    icon="fa-project-diagram"
                    color="blue"
                />
                <Card
                    title="Venta Total (USD)"
                    value={`$ ${totalRevenuePortafolio.toLocaleString()}`}
                    icon="fa-hand-holding-usd"
                    color="indigo"
                />
                <Card
                    title="Riesgos Críticos"
                    value={criticalRisksCount}
                    icon="fa-biohazard"
                    color={criticalRisksCount > 0 ? 'red' : 'green'}
                />
                <Card
                    title="Proyectos en Rojo"
                    value={projectsInRed}
                    icon="fa-traffic-light"
                    color={projectsInRed > 0 ? 'red' : 'green'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border min-h-[400px]">
                    <h3 className="text-lg font-bold mb-1 dark:text-white flex items-center gap-2">
                        <i className="fas fa-sort-amount-up text-red-500"></i>
                        Ranking: Mayores Atrasos (Días)
                    </h3>
                    <p className="text-xs text-gray-400 mb-6">Proyectos con mayor diferencia entre Fin Teórico y Fecha Actual/Real</p>
                    <div className="space-y-4">
                        {scheduleRanking.map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-1">
                                <div className="flex justify-between items-end text-xs uppercase font-black text-gray-500 dark:text-gray-400">
                                    <span className="truncate pr-4 font-bold">{item.name}</span>
                                    <span className="text-red-600 dark:text-red-400 font-mono text-sm">{item.delay} días</span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                        style={{ width: `${Math.min(100, (item.delay / (scheduleRanking[0]?.delay || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {scheduleRanking.length === 0 && <p className="text-center py-10 text-gray-400 italic">No hay proyectos con atraso</p>}
                    </div>
                </div>

                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border min-h-[400px]">
                    <h3 className="text-lg font-bold mb-1 dark:text-white flex items-center gap-2">
                        <i className="fas fa-fire text-amber-500"></i>
                        Ranking: Consumo de Presupuesto (%)
                    </h3>
                    <p className="text-xs text-gray-400 mb-6">Gasto Real vs Presupuesto de Costos Estimado</p>
                    <div className="space-y-4">
                        {budgetBurnRanking.map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-1">
                                <div className="flex justify-between items-end text-xs uppercase font-black text-gray-500 dark:text-gray-400">
                                    <span className="truncate pr-4 font-bold">{item.name}</span>
                                    <span className={`font-mono text-sm ${item.burnRate > 100 ? 'text-red-600' : 'text-amber-600'}`}>{item.burnRate}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${item.burnRate > 100 ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`}
                                        style={{ width: `${Math.min(100, item.burnRate)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {budgetBurnRanking.length === 0 && <p className="text-center py-10 text-gray-400 italic">No hay datos de consumo</p>}
                    </div>
                </div>
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* 1. Status Donut */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-80">
                    <h3 className="text-lg font-bold mb-1 dark:text-white">Estado de Proyectos</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {statusData.map((_entry: any, index: number) => (<Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Revenue vs Cost (Top 5) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-80">
                    <h3 className="text-lg font-bold mb-1 dark:text-white">Ventas vs Costos (Top 5)</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={revenueCostData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={10} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="venta" name="Venta" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="costo" name="Costo" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* 3. Top Projects Effort */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-80">
                    <h3 className="text-lg font-bold mb-1 dark:text-white">Foco del Mes: Proyectos con más horas</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={recentEffortData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" fontSize={10} width={110} />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                <p style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 4, maxWidth: 260 }}>{d.fullLabel}</p>
                                                <p style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>Horas : {d.hours}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="hours" name="Horas" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 4. Weekly Capacity Load */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-80">
                    <h3 className="text-lg font-bold mb-1 dark:text-white flex items-center gap-2">
                        Carga del Equipo (%)
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Ocupación semanal vs Disponibilidad (40h)</p>
                    <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={capacityWeeklyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis unit="%" />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="load" name="% Ocupación" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="step" dataKey="limit" name="Límite" stroke="#f43f5e" strokeDasharray="5 5" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* 5. Resource Individual Load */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-80">
                    <h3 className="text-lg font-bold mb-1 dark:text-white">Carga Individual (Esta Semana)</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={resourceLoadData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={10} />
                            <Tooltip />
                            <Bar dataKey="hours" name="Horas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 6. Margin Track (Current vs Target) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-80">
                    <h3 className="text-lg font-bold mb-1 dark:text-white">Margin Leakage Tracker (%)</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <ComposedChart data={marginComparisonData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={10} unit="%" />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="estimado" name="Target CM" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="real" name="Current CM" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- Cronograma del Portafolio de Proyectos (Gantt H1/H2) --- */}
            <div className={`bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border mb-8 relative transition-all duration-300 ${cleanView ? 'p-8 ring-2 ring-indigo-500/20' : 'p-6'}`}>
                {cleanView && (
                    <button
                        onClick={() => setCleanView(false)}
                        className="absolute top-4 right-4 z-40 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5 animate-pulse"
                        title="Haga clic para volver a mostrar los controles de selección"
                    >
                        <i className="fas fa-eye text-white"></i>
                        <span>Restaurar Controles</span>
                    </button>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                            <i className="fas fa-calendar-alt text-indigo-500"></i>
                            Cronograma del Portafolio de Proyectos
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Distribución temporal de proyectos activos por Año Fiscal y Semestres (H1/H2)
                        </p>
                    </div>

                    {!cleanView && (
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => setVisibleProjectIds(activeProjects.map(p => p.id))}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-950/20 px-2.5 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900"
                            >
                                <i className="fas fa-check-double mr-1"></i> Seleccionar Todos
                            </button>
                            <button
                                onClick={() => setVisibleProjectIds([])}
                                className="text-xs font-semibold text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700"
                            >
                                <i className="fas fa-times mr-1"></i> Limpiar Selección
                            </button>
                            <button
                                onClick={() => setCleanView(true)}
                                className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"
                                title="Ocultar controles para tomar captura de pantalla limpia"
                            >
                                <i className="fas fa-camera"></i>
                                <span>Vista de Captura</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Filtro de proyectos */}
                {!cleanView && (
                    <div className="mb-6">
                        <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Filtrar Proyectos en Ejecución ({activeProjects.length})
                        </span>
                        {activeProjects.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No hay proyectos activos en ejecución para mostrar.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1.5 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-850">
                                {activeProjects.map((p, idx) => {
                                    const isVisible = visibleProjectIds.includes(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                if (isVisible) {
                                                    setVisibleProjectIds(visibleProjectIds.filter(id => id !== p.id));
                                                } else {
                                                    setVisibleProjectIds([...visibleProjectIds, p.id]);
                                                }
                                            }}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-sm ${getPillBg(idx, isVisible)}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${isVisible ? 'bg-current animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                                            <span className="font-mono text-[10px] font-semibold">{p.opportunityNumber || 'S/N'}</span>
                                            <span className="truncate max-w-[150px]">{p.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Gráfica Gantt */}
                {visibleProjectIds.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-slate-900/20 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500 mb-3">
                            <i className="fas fa-calendar-alt text-lg"></i>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No hay proyectos seleccionados</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Selecciona proyectos de la lista superior para visualizar la distribución temporal de sus cronogramas.
                        </p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-inner">
                        <div className="min-w-[950px] relative font-sans">
                            {/* Nivel 1: Años Fiscales */}
                            <div className="flex border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-sm font-black text-slate-850 dark:text-slate-150">
                                {/* Espaciador Izquierdo para la lista de proyectos */}
                                <div className="sticky left-0 w-[340px] min-w-[340px] bg-gray-50 dark:bg-slate-900 z-30 border-r-2 border-slate-300 dark:border-slate-700 py-2.5 px-3.5 flex items-center justify-between shrink-0 select-none">
                                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Proyecto</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Código y Fechas</span>
                                </div>
                                
                                {/* Años Fiscales Dinámicos */}
                                <div className="flex-1 flex min-w-[630px]">
                                    {timelineData.fyHeaders.map((header, idx) => (
                                        <div
                                            key={idx}
                                            className="py-2.5 text-center border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0 tracking-wide font-black text-slate-900 dark:text-slate-100 text-[13px]"
                                            style={{ width: `${header.width}%`, flexGrow: 0, flexShrink: 0 }}
                                        >
                                            <i className="far fa-clock mr-1 text-indigo-600 dark:text-indigo-400 font-bold"></i>
                                            {header.label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Nivel 2: Semestres H1 / H2 */}
                            <div className="flex border-b border-gray-200 dark:border-slate-850 bg-gray-100/70 dark:bg-slate-900/90 text-[11.5px] font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest">
                                {/* Espaciador Izquierdo */}
                                <div className="sticky left-0 w-[340px] min-w-[340px] bg-gray-100/70 dark:bg-slate-900/90 z-30 border-r-2 border-slate-300 dark:border-slate-700 shrink-0" />
                                
                                {/* Semestres */}
                                <div className="flex-1 flex min-w-[630px]">
                                    {timelineData.periods.map((period, idx) => {
                                        const isActive = period.fy === 2025 && period.half === 'H2';
                                        return (
                                            <div
                                                key={idx}
                                                className={`py-1.5 text-center border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0 font-black flex items-center justify-center gap-1.5 transition-colors ${
                                                    isActive 
                                                    ? 'text-indigo-750 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/40' 
                                                    : 'text-slate-750 dark:text-slate-300'
                                                }`}
                                                style={{ width: `${period.width}%`, flexGrow: 0, flexShrink: 0 }}
                                            >
                                                <span>{period.half}</span>
                                                {isActive && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-indigo-600 text-white dark:bg-indigo-500 shadow-sm border border-indigo-400/20 shrink-0">
                                                        Foco Análisis
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Contenido / Filas */}
                            <div className="relative min-h-[100px] flex flex-col">
                                {/* Grilla Vertical de Fondo en todo el alto del contenedor */}
                                <div className="absolute inset-0 flex pointer-events-none z-0">
                                    {/* Espacio en blanco correspondiente a la columna de proyectos */}
                                    <div className="w-[340px] min-w-[340px] border-r-2 border-slate-300 dark:border-slate-700 shrink-0 bg-transparent" />
                                    
                                    {/* Columnas del Timeline */}
                                    <div className="flex-1 flex min-w-[630px] relative h-full">
                                        {timelineData.periods.map((period, idx) => {
                                            const isActive = period.fy === 2025 && period.half === 'H2';
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`h-full border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0 transition-colors ${
                                                        isActive ? 'bg-indigo-100/45 dark:bg-indigo-900/30' : ''
                                                    }`}
                                                    style={{ width: `${period.width}%`, flexGrow: 0, flexShrink: 0 }}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Filas del Gantt */}
                                <div className="relative z-10 flex flex-col divide-y divide-gray-100 dark:divide-slate-850/60 bg-transparent">
                                    {timelineData.rows.map((row, idx) => {
                                        const startStr = formatDate(row.start.toISOString().split('T')[0]);
                                        const endStr = formatDate(row.end.toISOString().split('T')[0]);
                                        const labelText = row.clientName ? `${row.clientName} - ${row.name}` : row.name;
                                        // Calculamos dinámicamente si el nombre entra completo dentro de la barra en base a una estimación conservadora
                                        const timelineBaseWidth = 800; // Ancho base de referencia para el timeline en píxeles
                                        const barPixelWidth = (timelineBaseWidth * row.width) / 100;
                                        const textPadding = 24; // Padding horizontal total (px-3 = 12px de cada lado)
                                        const estimatedTextWidth = labelText.length * 7.2; // ~7.2px por carácter (fuente sans text-[12px] font-black)
                                        const isTooNarrow = estimatedTextWidth > Math.max(0, barPixelWidth - textPadding);
                                        return (
                                            <div
                                                key={row.id}
                                                className="flex items-center hover:bg-gray-50/50 dark:hover:bg-slate-900/30 transition-colors group relative"
                                            >
                                                {/* Columna Izquierda Sticky: Info de Proyecto & Fechas */}
                                                <div className="sticky left-0 w-[340px] min-w-[340px] bg-white dark:bg-slate-950 px-3.5 py-1.5 z-20 border-r-2 border-slate-300 dark:border-slate-700 flex flex-col justify-center gap-1 shadow-[4px_0_8px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_8px_rgba(0,0,0,0.5)] shrink-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-100 px-2 py-0.5 rounded-md text-[10.5px] font-black border border-indigo-300 dark:border-indigo-700/60 shadow-xs shrink-0" title="Código de oportunidad">
                                                            {row.opportunityNumber}
                                                        </span>
                                                        <span className="font-black text-[12.5px] text-slate-950 dark:text-white tracking-wide truncate" title={`${row.clientName ? `${row.clientName} - ` : ''}${row.name}`}>
                                                            {row.clientName ? `${row.clientName} - ` : ''}{row.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-nowrap items-center gap-1 text-[10.5px] whitespace-nowrap overflow-x-hidden">
                                                        <span className="bg-emerald-100/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-250 px-1.5 py-0.5 rounded-md font-black border border-emerald-300/80 dark:border-emerald-800/60 shadow-xs">
                                                            Ini: {startStr}
                                                        </span>
                                                        <span className="bg-amber-100/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-250 px-1.5 py-0.5 rounded-md font-black border border-amber-300/80 dark:border-amber-800/60 shadow-xs" title="Fecha fin planificada (Teórica)">
                                                            Plan: {row.theo ? formatDate(row.theo.toISOString().split('T')[0]) : 'S/D'}
                                                        </span>
                                                        <span className="bg-sky-100/90 dark:bg-sky-950/50 text-sky-950 dark:text-sky-250 px-1.5 py-0.5 rounded-md font-black border border-sky-300/80 dark:border-sky-800/60 shadow-xs" title="Fecha fin real">
                                                            Real: {row.realEndDate ? formatDate(row.realEndDate) : 'En curso'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Columna Derecha: Contenedor de la Barra del Timeline */}
                                                <div className="flex-1 min-w-[630px] relative h-11 flex items-center px-4 z-10">
                                                    {/* Barra de Proyecto */}
                                                    <div
                                                        className={`absolute h-8 rounded-lg bg-gradient-to-r ${getBarGradient(idx)} text-white flex items-center justify-center px-3 shadow-sm hover:scale-[1.01] hover:shadow-md transition-all duration-200 select-none cursor-pointer z-10`}
                                                        style={{ left: `${row.left}%`, width: `${row.width}%` }}
                                                        title={`${row.clientName ? `${row.clientName} - ` : ''}${row.name} (${row.opportunityNumber})\nInicio: ${startStr}\nFin: ${row.realEndDate ? formatDate(row.realEndDate) : 'En curso'}${row.theo ? `\nPlanificado: ${formatDate(row.theo.toISOString().split('T')[0])}` : ''}`}
                                                    >
                                                        {!isTooNarrow ? (
                                                            <span className="text-[12px] font-black truncate tracking-wide px-1 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]">
                                                                {labelText}
                                                            </span>
                                                        ) : (
                                                            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 whitespace-nowrap text-[11.5px] font-black text-slate-950 dark:text-white pointer-events-none z-20 bg-white/98 dark:bg-slate-900/98 px-2.5 py-1 rounded-md shadow-[0_3px_10px_rgba(0,0,0,0.16)] dark:shadow-[0_3px_10px_rgba(0,0,0,0.6)] border border-slate-350 dark:border-slate-600 backdrop-blur-xs tracking-wide">
                                                                {labelText}
                                                            </span>
                                                        )}
                                                        
                                                        {/* Línea vertical para Fecha Planificada (Teórica) - Restringida exactamente dentro de la barra */}
                                                        {row.relativeTheoLeft !== null && (
                                                            <div
                                                                className="absolute top-0 bottom-0 w-0 border-l border-dashed border-white/70 z-15 pointer-events-none"
                                                                style={{ left: `${row.relativeTheoLeft}%` }}
                                                            >
                                                                {/* Hito visual: Diamante amarillo en el centro de la barra */}
                                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-300 rotate-45 border border-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-indigo-50 dark:bg-slate-800 p-6 rounded-xl border border-indigo-100 dark:border-slate-700 mb-8">
                <h3 className="text-lg font-bold mb-4 text-indigo-900 dark:text-indigo-200">Gestión de Datos</h3>
                <div className="flex flex-wrap gap-4 items-center">
                    <label className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors shadow cursor-pointer flex items-center">
                        <i className="fas fa-file-import mr-2"></i> Importar Excel
                        <input type="file" className="hidden" accept=".xlsx" onChange={handleExcelImport} />
                    </label>

                </div>
            </div>
        </div >
    );
};