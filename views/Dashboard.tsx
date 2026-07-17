import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { getPastWeeksKeys, getWeekKey, generateUUID, calculateProjectHealth, parseExcelNumber, formatDate } from '../utils/helpers';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';
import { Project, SEGMENTS, VERTICALS, VENDORS, ProjectStatusUpdate, COST_CATEGORIES } from '../types';

export const DashboardView: React.FC = () => {
    const { projects, risks, milestones, capacityData, team, expenses, lessons, changes, setProjects, setRisks, setMilestones, setChanges, setLessons, setCapacityData, setTeam, setExpenses, showToast, user } = useApp();



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
        const usdMilestones = milestones.filter(m => m.currency === 'USD' || !m.currency);
        const invoicedAmount = usdMilestones.filter(m => m.isReceived).reduce((s, m) => s + (m.amount || 0), 0);
        const pendingAmount = usdMilestones.filter(m => !m.isReceived).reduce((s, m) => s + (m.amount || 0), 0);
        return [
            { name: 'Facturado (USD)', value: invoicedAmount },
            { name: 'Pendiente (USD)', value: pendingAmount }
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