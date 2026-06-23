import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { getDaysInMonth, getWeekKey, getPastWeeksKeys } from '../utils/helpers';
import { CapacityAssignment } from '../types';
import { supabase } from '../utils/supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import SearchableSelect from '../components/SearchableSelect';

const MEMBER_ID_MAP: Record<string, string> = {
    'Delgado': '13',
    'Ayala': '40',
    'Sequeira': '41',
    'Ciffoni': '42',
    'Sifontes': '45',
    'Avila': '47',
    'Indomenico': '48',
    'Zeromski': '50',
    'Useche': '60',
    'Quevedo': '61',
    'JARAGUIONIS': '341',
    'VILLEGAS': '342',
    'OJEDA': '343',
    'Araujo': '361',
    'Le Favi': '368',
    'Moreno': '369'
};

const ARG_HOLIDAYS = [
    // 2025
    '2025-01-01', '2025-03-03', '2025-03-04', '2025-03-24', '2025-04-02', '2025-04-18',
    '2025-05-01', '2025-05-25', '2025-06-16', '2025-06-20', '2025-07-09', '2025-08-17',
    '2025-10-12', '2025-11-20', '2025-12-08', '2025-12-25',
    // 2026
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-24', '2026-04-02', '2026-04-03',
    '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20', '2026-07-09', '2026-08-17',
    '2026-10-12', '2026-11-20', '2026-11-23', '2026-12-08', '2026-12-25'
];

const getMemberDisplayName = (name: string, capacityId?: string) => {
    if (!name) return 'Desconocido';
    if (capacityId) return `${capacityId}-${name}`;
    const entry = Object.entries(MEMBER_ID_MAP).find(([key]) =>
        name.toLowerCase().includes(key.toLowerCase())
    );
    return entry ? `${entry[1]}-${name}` : name;
};

export const CapacityView: React.FC = () => {
    const { capacityData, setCapacityData, team, projects, showToast, user, fetchCapacityOnly } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{ memberId: string, date: string, type?: string, projectId?: string | null, assignmentId?: string, activityKey?: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [replicateOption, setReplicateOption] = useState('none');

    // Assignment Form State
    const [assignType, setAssignType] = useState('project');
    const [assignProject, setAssignProject] = useState(projects[0]?.id || '');
    const [assignHours, setAssignHours] = useState('');
    const [assignObs, setAssignObs] = useState('');
    const [assignIsExtra, setAssignIsExtra] = useState(false);

    const [inlineCell, setInlineCell] = useState<{ memberId: string, date: string, activityKey: string, assignmentId?: string } | null>(null);
    const [inlineHours, setInlineHours] = useState('');

    const [activeTab, setActiveTab] = useState<'grid' | 'project'>('grid');
    const [selectedQueryProjectId, setSelectedQueryProjectId] = useState<string>('');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
    const dayISOs = useMemo(
        () => days.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`),
        [days]
    );
    const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    // Historial completo de asignaciones para el proyecto seleccionado (sin filtrar por mes)
    const [projectAssignments, setProjectAssignments] = useState<CapacityAssignment[]>([]);
    const [isLoadingProjectDetail, setIsLoadingProjectDetail] = useState(false);

    const loadProjectAssignments = async (projectId: string) => {
        if (!projectId) {
            setProjectAssignments([]);
            return;
        }
        setIsLoadingProjectDetail(true);
        try {
            const { data, error } = await supabase
                .from('capacity_assignments')
                .select('*')
                .eq('project_id', projectId)
                .order('date', { ascending: false });

            if (error) throw error;

            const mapped: CapacityAssignment[] = (data || []).map((a: any) => {
                const rawObs = a.observations || '';
                const isExtra = rawObs.startsWith('[IS_EXTRA] ');
                return {
                    id: a.id,
                    memberId: a.member_id,
                    type: a.type,
                    projectId: a.project_id,
                    date: a.date,
                    hours: a.hours,
                    observations: isExtra ? rawObs.replace('[IS_EXTRA] ', '') : rawObs,
                    isExtra
                };
            });
            setProjectAssignments(mapped);
        } catch (err: any) {
            console.error('Error loading project assignments:', err);
            showToast('Error al cargar detalle del proyecto: ' + err.message, 'error');
        } finally {
            setIsLoadingProjectDetail(false);
        }
    };

    useEffect(() => {
        if (selectedQueryProjectId) {
            loadProjectAssignments(selectedQueryProjectId);
        } else {
            setProjectAssignments([]);
        }
    }, [selectedQueryProjectId]);

    // Estadísticas del proyecto en el mes (Horas totales, extras, recursos únicos)
    const projectStats = useMemo(() => {
        const pmRoles = ['PM', 'Project Manager', 'Gerente'];
        let totalHours = 0;
        let totalExtra = 0;
        let pmHours = 0;
        let engHours = 0;
        const uniqueMembers = new Set<string>();

        projectAssignments.forEach(a => {
            const hrs = Number(a.hours) || 0;
            totalHours += hrs;
            if (a.isExtra) {
                totalExtra += hrs;
            }
            uniqueMembers.add(a.memberId);

            const member = team.find(t => t.id === a.memberId);
            const isPM = member ? pmRoles.includes(member.role || '') : false;
            if (isPM) {
                pmHours += hrs;
            } else {
                engHours += hrs;
            }
        });

        return {
            totalHours,
            totalExtra,
            pmHours,
            engHours,
            collaboratorCount: uniqueMembers.size
        };
    }, [projectAssignments, team]);

    // Datos del gráfico: Horas imputadas por colaborador
    const projectCollaboratorHoursData = useMemo(() => {
        const counts: Record<string, { regular: number, extra: number, total: number }> = {};
        projectAssignments.forEach(a => {
            const member = team.find(t => t.id === a.memberId);
            const displayName = member ? getMemberDisplayName(member.name, member.capacity_id) : 'Desconocido';
            if (!counts[displayName]) counts[displayName] = { regular: 0, extra: 0, total: 0 };
            if (a.isExtra) {
                counts[displayName].extra += Number(a.hours);
            } else {
                counts[displayName].regular += Number(a.hours);
            }
            counts[displayName].total += Number(a.hours);
        });
        return Object.entries(counts)
            .map(([name, val]) => ({
                name: name.length > 20 ? name.substring(0, 20) + '...' : name,
                fullName: name,
                regular: val.regular,
                extra: val.extra,
                total: val.total
            }))
            .sort((a, b) => b.total - a.total);
    }, [projectAssignments, team]);

    // Auto-fetch data when month changes
    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
        const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
        fetchCapacityOnly(firstDay, lastDay);
    }, [currentDate]);

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, Record<string, CapacityAssignment[]>>> = {};

        capacityData.assignments.forEach(a => {
            if (!a.date) return;
            const parts = a.date.split('T')[0].split('-');
            const yStr = parts[0];
            const mStr = parts[1];
            const dStr = parts[2];

            const aYear = parseInt(yStr);
            const aMonth = parseInt(mStr) - 1;

            if (aYear === year && aMonth === month) {
                if (!groups[a.memberId]) groups[a.memberId] = {};

                const activityKey = a.projectId ? `project-${a.projectId}` : `type-${a.type}`;
                if (!groups[a.memberId][activityKey]) groups[a.memberId][activityKey] = {};

                const isoDate = `${aYear}-${String(aMonth + 1).padStart(2, '0')}-${String(parseInt(dStr)).padStart(2, '0')}`;

                if (!groups[a.memberId][activityKey][isoDate]) groups[a.memberId][activityKey][isoDate] = [];
                
                groups[a.memberId][activityKey][isoDate].push({
                    ...a,
                    hours: Number(a.hours) || 0
                });
            }
        });

        return groups;
    }, [capacityData.assignments, year, month]);

    // --- Chart Data Calculations ---

    const weeklyTrendData = useMemo(() => {
        const weeks = getPastWeeksKeys(12).sort();
        return weeks.map(wk => {
            const wkAssignments = capacityData.assignments.filter(a => {
                try {
                    return getWeekKey(new Date(a.date + 'T00:00:00')) === wk;
                } catch { return false; }
            });
            const totalHours = wkAssignments.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
            const availability = team.length * 40;
            return {
                name: wk,
                horas: totalHours,
                capacidad: availability,
                uso: availability > 0 ? Math.round((totalHours / availability) * 100) : 0
            };
        });
    }, [capacityData.assignments, team]);

    const projectEffortData = useMemo(() => {
        const counts: Record<string, number> = {};
        capacityData.assignments.forEach(a => {
            if (!a.projectId) return;
            const p = projects.find(px => px.id === a.projectId);
            const name = p ? p.name : 'Desconocido';
            counts[name] = (counts[name] || 0) + (Number(a.hours) || 0);
        });
        return Object.entries(counts)
            .map(([name, hours]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, hours }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 8);
    }, [capacityData.assignments, projects]);

    const resourceLoadData = useMemo(() => {
        const currentWk = getWeekKey(new Date());
        return team.map(m => {
            const mAssigns = capacityData.assignments.filter(a => a.memberId === m.id && getWeekKey(new Date(a.date + 'T00:00:00')) === currentWk);
            const total = mAssigns.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
            return {
                name: m.name.split(' ')[0],
                hours: total,
                status: total > 45 ? 'Sobrecarga' : total < 30 ? 'Disponible' : 'Óptimo'
            };
        }).sort((a, b) => b.hours - a.hours);
    }, [capacityData.assignments, team]);

    const handleCellClick = (memberId: string, date: string, activityKey?: string, existingAssignment?: CapacityAssignment) => {
        const d = new Date(date + 'T00:00:00');

        if (!existingAssignment && (d.getDay() === 0 || d.getDay() === 6)) {
            return;
        }

        if (activityKey) {
            setInlineCell({ memberId, date, activityKey, assignmentId: existingAssignment?.id });
            setInlineHours(existingAssignment ? existingAssignment.hours.toString() : '');
        } else {
            let aType = 'project';
            let aProj = projects[0]?.id || '';

            if (existingAssignment) {
                aType = existingAssignment.type;
                aProj = existingAssignment.projectId || projects[0]?.id || '';
                setAssignHours(existingAssignment.hours.toString());
                setAssignObs(existingAssignment.observations || '');
                setAssignIsExtra(existingAssignment.isExtra || false);
            } else {
                setAssignHours('');
                setAssignObs('');
                setAssignIsExtra(false);
            }

            setAssignType(aType);
            setAssignProject(aProj);
            setSelectedCell({ memberId, date, type: aType, projectId: aProj, assignmentId: existingAssignment?.id });
            setIsModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCell(null);
        setInlineCell(null);
        setAssignType('project');
        setAssignProject(projects[0]?.id || '');
        setAssignHours('');
        setAssignObs('');
        setAssignIsExtra(false);
    };

    const saveAssignment = async (h?: string, c?: any) => {
        const cell = c || selectedCell;
        if (!cell || isSaving) return;

        const isInline = h !== undefined;
        const hoursStr = isInline ? h : assignHours;

        if (isInline && (hoursStr === '' || hoursStr.trim() === '')) {
            setInlineCell(null);
            return;
        }

        const hours = parseFloat(hoursStr);
        const existing = cell.assignmentId ? capacityData.assignments.find(a => a.id === cell.assignmentId) : null;
        const obs = isInline ? (existing?.observations || '') : assignObs;
        const type = isInline ? (cell.activityKey?.startsWith('project-') ? 'project' : cell.activityKey?.replace('type-', '')) : assignType;
        const projectId = isInline ? (cell.activityKey?.startsWith('project-') ? cell.activityKey.replace('project-', '') : null) : (type === 'project' ? assignProject : null);
        const isExtraVal = isInline ? (existing?.isExtra || false) : assignIsExtra;
        const finalObs = isExtraVal ? `[IS_EXTRA] ${obs}` : obs;

        if (isNaN(hours) || hours < 0) {
            if (isInline) setInlineCell(null);
            return showToast('Horas inválidas', 'error');
        }

        setIsSaving(true);
        try {
            const datesToSave = [cell.date];
            
            if (!h && replicateOption !== 'none') {
                const baseDate = new Date(cell.date + 'T00:00:00');
                const year = baseDate.getFullYear();
                const month = baseDate.getMonth();
                
                if (replicateOption === 'week') {
                    const dayOfWeek = baseDate.getDay(); 
                    for (let i = dayOfWeek + 1; i <= 5; i++) {
                        const d = new Date(baseDate);
                        d.setDate(baseDate.getDate() + (i - dayOfWeek));
                        if (d.getMonth() === baseDate.getMonth()) {
                            const iso = d.toISOString().split('T')[0];
                            if (!ARG_HOLIDAYS.includes(iso)) datesToSave.push(iso);
                        }
                    }
                } else if (replicateOption === 'month') {
                    const lastDay = new Date(year, month + 1, 0).getDate();
                    for (let day = baseDate.getDate() + 1; day <= lastDay; day++) {
                        const d = new Date(year, month, day);
                        const dw = d.getDay();
                        const iso = d.toISOString().split('T')[0];
                        if (dw !== 0 && dw !== 6 && !ARG_HOLIDAYS.includes(iso)) {
                            datesToSave.push(iso);
                        }
                    }
                } else if (replicateOption === 'dayOfWeek') {
                    const dayOfWeek = baseDate.getDay();
                    const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
                    for (let day = baseDate.getDate() + 7; day <= lastDay; day += 7) {
                        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
                        if (d.getMonth() === baseDate.getMonth()) {
                            const iso = d.toISOString().split('T')[0];
                            if (!ARG_HOLIDAYS.includes(iso)) {
                                datesToSave.push(iso);
                            }
                        }
                    }
                }
            }

            const results: CapacityAssignment[] = [];
            
            for (const date of datesToSave) {
                const member = team.find(m => m.id === cell.memberId);
                const payload = {
                    member_id: cell.memberId,
                    user_email: member?.email || user.email,
                    date: date,
                    week_start: date,
                    type,
                    project_id: projectId,
                    hours,
                    observations: finalObs || 'EMPTY',
                    week_key: null
                };

                let res;
                const existingForDate = date !== cell.date 
                    ? capacityData.assignments.find(a => a.memberId === cell.memberId && a.date === date && a.projectId === projectId && a.type === type)
                    : (cell.assignmentId ? capacityData.assignments.find(a => a.id === cell.assignmentId) : null);

                if (existingForDate) {
                    const { data, error } = await supabase.from('capacity_assignments').update(payload).eq('id', existingForDate.id).select();
                    if (error) throw error;
                    if (data && data.length > 0) res = data[0];
                } else {
                    const { data, error } = await supabase.from('capacity_assignments').insert([payload]).select();
                    if (error) throw error;
                    if (data && data.length > 0) res = data[0];
                }

                if (res) {
                    const rawObs = res.observations || '';
                    const isEx = rawObs.startsWith('[IS_EXTRA] ');
                    results.push({
                        id: res.id,
                        memberId: res.member_id,
                        date: res.date,
                        type: res.type as any,
                        projectId: res.project_id,
                        hours: res.hours,
                        observations: isEx ? rawObs.replace('[IS_EXTRA] ', '') : rawObs,
                        isExtra: isEx
                    });
                }
            }

            if (results.length > 0) {
                setCapacityData(prev => {
                    const newAssignments = [...prev.assignments];
                    results.forEach(res => {
                        const idx = newAssignments.findIndex(a => a.id === res.id);
                        if (idx >= 0) newAssignments[idx] = res;
                        else newAssignments.push(res);
                    });
                    return { ...prev, assignments: newAssignments };
                });

                showToast(results.length > 1 ? `✅ ${results.length} registros guardados` : 'Registro guardado', 'success');
                handleCloseModal();
                setReplicateOption('none');
                if (selectedQueryProjectId) {
                    loadProjectAssignments(selectedQueryProjectId);
                }
            } else {
                throw new Error('No se pudo confirmar el guardado en la base de datos');
            }
        } catch (err: any) {
            console.error('Save failed:', err);
            showToast('Error: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const copyFromPreviousMonth = async (memberId: string) => {
        if (isSaving) return;
        
        const prevMonth = new Date(currentDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        const prevYear = prevMonth.getFullYear();
        const prevM = prevMonth.getMonth();
        const firstDayPrev = new Date(prevYear, prevM, 1).toISOString().split('T')[0];
        const lastDayPrev = new Date(prevYear, prevM + 1, 0).toISOString().split('T')[0];

        const { data: prevAssignments, error } = await supabase
            .from('capacity_assignments')
            .select('*')
            .eq('member_id', memberId)
            .gte('date', firstDayPrev)
            .lte('date', lastDayPrev);

        if (error) return showToast('Error: ' + error.message, 'error');
        if (!prevAssignments || prevAssignments.length === 0) return showToast('No hay datos en el mes anterior', 'info');

        if (!window.confirm(`¿Copiar ${prevAssignments.length} registros del mes anterior? Se omitirán feriados y fines de semana.`)) return;

        setIsSaving(true);
        try {
            const currentYear = currentDate.getFullYear();
            const currentM = currentDate.getMonth();
            const toInsert: any[] = [];

            for (const a of prevAssignments) {
                const d = new Date(a.date + 'T00:00:00');
                const dayNum = d.getDate();
                const newDate = new Date(currentYear, currentM, dayNum);
                const iso = newDate.toISOString().split('T')[0];
                const dw = newDate.getDay();

                if (dw !== 0 && dw !== 6 && !ARG_HOLIDAYS.includes(iso)) {
                    // Evitar duplicados exactos
                    const exists = capacityData.assignments.some(curr => 
                        curr.memberId === memberId && curr.date === iso && curr.projectId === a.project_id && curr.type === a.type
                    );
                    if (!exists) {
                        const member = team.find(m => m.id === memberId);
                        toInsert.push({
                            member_id: memberId,
                            user_email: member?.email || null,
                            date: iso,
                            week_start: iso,
                            type: a.type,
                            project_id: a.project_id,
                            hours: a.hours,
                            observations: a.isExtra ? `[IS_EXTRA] ${a.observations}` : (a.observations || 'EMPTY'),
                            week_key: null
                        });
                    }
                }
            }

            if (toInsert.length === 0) {
                showToast('No hay nuevos registros para copiar', 'info');
                return;
            }

            const { data, error: iError } = await supabase.from('capacity_assignments').insert(toInsert).select();
            if (iError) throw iError;

            const mapped = data.map((a: any) => {
                const rawObs = a.observations || '';
                const isExtra = rawObs.startsWith('[IS_EXTRA] ');
                return {
                    id: a.id,
                    memberId: a.member_id,
                    type: a.type,
                    projectId: a.project_id,
                    date: a.date,
                    hours: a.hours,
                    observations: isExtra ? rawObs.replace('[IS_EXTRA] ', '') : rawObs,
                    isExtra
                };
            });

            setCapacityData(prev => ({
                ...prev,
                assignments: [...prev.assignments, ...mapped]
            }));

            showToast(`✅ ${mapped.length} registros copiados con éxito`, 'success');
            if (selectedQueryProjectId) {
                loadProjectAssignments(selectedQueryProjectId);
            }
        } catch (err: any) {
            showToast('Error al copiar: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteAssignment = async () => {
        if (!selectedCell?.assignmentId) return;
        if (!window.confirm('¿Eliminar este registro?')) return;

        try {
            const { error } = await supabase.from('capacity_assignments').delete().eq('id', selectedCell.assignmentId);
            if (error) throw error;

            setCapacityData(prev => ({
                assignments: prev.assignments.filter(a => a.id !== selectedCell.assignmentId)
            }));
            handleCloseModal();
            showToast('Registro eliminado', 'info');
            if (selectedQueryProjectId) {
                loadProjectAssignments(selectedQueryProjectId);
            }
        } catch (err: any) {
            showToast('Error: ' + err.message, 'error');
        }
    };

    const deleteActivityRow = async (memberId: string, activityKey: string) => {
        if (!window.confirm('¿Estás seguro de eliminar TODA esta fila para el mes?')) return;

        let type = 'project';
        let projectId: string | null = null;
        if (activityKey.startsWith('project-')) {
            type = 'project';
            projectId = activityKey.replace('project-', '');
        } else {
            type = activityKey.replace('type-', '');
        }

        const toDelete = capacityData.assignments.filter(a => {
            const parts = a.date.split('-');
            return a.memberId === memberId &&
                parseInt(parts[0]) === year &&
                parseInt(parts[1]) - 1 === month &&
                (projectId ? a.projectId === projectId : (a.type === type && !a.projectId));
        });

        if (toDelete.length === 0) return;

        try {
            const ids = toDelete.map(a => a.id);
            const { error } = await supabase.from('capacity_assignments').delete().in('id', ids);
            if (error) throw error;

            setCapacityData(prev => ({
                assignments: prev.assignments.filter(a => !ids.includes(a.id))
            }));
            showToast('Fila eliminada', 'info');
            if (selectedQueryProjectId) {
                loadProjectAssignments(selectedQueryProjectId);
            }
        } catch (err: any) {
            showToast('Error: ' + err.message, 'error');
        }
    };

    const formatDateShort = (date: Date) => {
        return {
            day: date.getDate(),
            name: date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '')
        };
    };

    const getActivityLabel = (key: string) => {
        if (key.startsWith('project-')) {
            const id = key.replace('project-', '');
            const p = projects.find(p => p.id === id);
            return p ? (p.opportunityNumber ? `${p.opportunityNumber} - ${p.name}` : p.name) : 'Proyecto Desconocido';
        }
        const type = key.replace('type-', '');
        const map: Record<string, string> = {
            'internal_bau': 'TP-AR-99140-INTERNO SP DATAC & CONECT BAU',
            'tableros': 'TP-AR-99140-11-Creación de tableros, reportes y procesos',
            'gestion': 'TP-AR-99140-12-Gestión de proyectos generales',
            'reuniones': 'TP-AR-99140-13-Reuniones internas',
            'capacitacion': 'TP-AR-99140-14-Capacitaciones y certificaciones requeridas',
            'licencias': 'TP-AR-99140-15-Licencias (cumpleaños, estudio, enfermedad)',
            'poc': 'TP-AR-99140-16-Preventiva y POC',
            'consultoria': 'TP-AR-99140-17-Consultoría interna',
            'logistica': 'TP-AR-99140-18-Logística de proyectos',
            'facturacion': 'TP-AR-99140-19-Facturación de proyectos'
        };
        return map[type] || type.toUpperCase();
    };

    const exportToExcel = () => {
        const rows: Record<string, any>[] = [];

        team.forEach(member => {
            const memberActivities = groupedData[member.id] || {};
            Object.entries(memberActivities).forEach(([activityKey, dateMap]) => {
                const activityLabel = getActivityLabel(activityKey);
                Object.entries(dateMap).forEach(([date, assignments]) => {
                    assignments.forEach((a: CapacityAssignment) => {
                        rows.push({
                            'Recurso': getMemberDisplayName(member.name, member?.capacity_id),
                            'Actividad / Proyecto': activityLabel,
                            'Fecha': date,
                            'Horas': a.hours,
                            'Observaciones': a.observations && a.observations !== 'EMPTY' ? a.observations : ''
                        });
                    });
                });
            });
        });

        if (rows.length === 0) {
            showToast('No hay datos para exportar en este mes', 'info');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Capacity Plan');

        const monthLabel = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
            .replace(' de ', '-').toUpperCase();
        XLSX.writeFile(wb, `Capacity_${monthLabel}.xlsx`);
        showToast('Excel exportado correctamente', 'success');
    };

    const workingDaysCount = useMemo(() => {
        return days.filter((d, idx) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return !isWeekend && !ARG_HOLIDAYS.includes(dayISOs[idx]);
        }).length;
    }, [days, dayISOs]);

    const totalMonthHours = useMemo(() => {
        let total = 0;
        team.forEach(m => {
            const mActivities = groupedData[m.id] || {};
            Object.keys(mActivities).forEach(key => {
                dayISOs.forEach(iso => {
                    total += (mActivities[key][iso] || []).filter(a => !a.isExtra).reduce((s, a) => s + a.hours, 0);
                });
            });
        });
        return total;
    }, [groupedData, team, dayISOs]);

    const totalExtraMonthHours = useMemo(() => {
        let total = 0;
        team.forEach(m => {
            const mActivities = groupedData[m.id] || {};
            Object.keys(mActivities).forEach(key => {
                dayISOs.forEach(iso => {
                    total += (mActivities[key][iso] || []).filter(a => a.isExtra).reduce((s, a) => s + a.hours, 0);
                });
            });
        });
        return total;
    }, [groupedData, team, dayISOs]);

    const theoreticalCapacity = workingDaysCount * team.length * 8;
    const occupancyRate = theoreticalCapacity > 0 ? (totalMonthHours / theoreticalCapacity) * 100 : 0;

    const projectHoursData = useMemo(() => {
        const projectHours: Record<string, { regular: number, extra: number }> = {};
        capacityData.assignments.forEach(a => {
            const d = new Date(a.date + 'T00:00:00');
            if (d.getFullYear() === year && d.getMonth() === month) {
                const p = projects.find(px => px.id === a.projectId);
                const name = p ? p.name : 'Otras Tareas';
                if (!projectHours[name]) projectHours[name] = { regular: 0, extra: 0 };
                
                if (a.isExtra) {
                    projectHours[name].extra += Number(a.hours);
                } else {
                    projectHours[name].regular += Number(a.hours);
                }
            }
        });
        return Object.entries(projectHours)
            .map(([name, hours]) => ({ name: name.length > 25 ? name.substring(0, 25) + '...' : name, full: name, regular: hours.regular, extra: hours.extra, total: hours.regular + hours.extra }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);
    }, [capacityData.assignments, year, month, projects]);

    const topMembersData = useMemo(() => {
        return team.map(m => {
            let regular = 0;
            let extra = 0;
            const mActivities = groupedData[m.id] || {};
            Object.keys(mActivities).forEach(key => {
                dayISOs.forEach(iso => {
                    const assigns = mActivities[key][iso] || [];
                    regular += assigns.filter(a => !a.isExtra).reduce((s, a) => s + a.hours, 0);
                    extra += assigns.filter(a => a.isExtra).reduce((s, a) => s + a.hours, 0);
                });
            });
            return { name: getMemberDisplayName(m.name, m.capacity_id), regular, extra, total: regular + extra };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
    }, [team, groupedData, dayISOs]);

    const dailyTeamTotals = useMemo(() => {
        const result: Record<string, number> = {};
        dayISOs.forEach(iso => {
            result[iso] = team.reduce((sum, m) => {
                const acts = groupedData[m.id] || {};
                return sum + Object.values(acts).reduce((s, dateMap) =>
                    s + (dateMap[iso] || []).filter(a => !a.isExtra).reduce((h, a) => h + a.hours, 0), 0);
            }, 0);
        });
        return result;
    }, [groupedData, dayISOs, team]);

    return (
        <div className="fade-in max-w-[100vw] flex flex-col p-2 pb-20 relative">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md p-4 rounded-3xl border border-white/20 dark:border-dark-border shadow-xl shrink-0">
                <div className="flex items-center gap-2 bg-gray-100/50 dark:bg-slate-900/50 p-2 rounded-2xl border border-gray-200/50 dark:border-slate-800">
                    <button onClick={handlePrevMonth} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 shadow-sm rounded-xl transition-all text-gray-600 dark:text-gray-400">
                        <i className="fas fa-chevron-left"></i>
                    </button>
                    <div className="px-6 py-2 text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 min-w-[160px] text-center uppercase tracking-widest">
                        {monthName.split(' de ')[0].toUpperCase()} {monthName.split(' de ')[1]}
                    </div>
                    <button onClick={handleNextMonth} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 shadow-sm rounded-xl transition-all text-gray-600 dark:text-gray-400">
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={exportToExcel} className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white px-6 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2">
                        <div className="absolute inset-0 w-full h-full bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full skew-x-12"></div>
                        <i className="fas fa-file-excel"></i> Exportar
                    </button>
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex gap-2 mb-6 bg-gray-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl w-fit border border-gray-200/50 dark:border-slate-800 shrink-0">
                <button 
                    onClick={() => setActiveTab('grid')} 
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'grid' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <i className="fas fa-th"></i> Vista General (Grilla)
                </button>
                <button 
                    onClick={() => setActiveTab('project')} 
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'project' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <i className="fas fa-briefcase"></i> Detalle por Proyecto
                </button>
            </div>

            {activeTab === 'grid' && (
                <>
                    {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shadow-inner">
                        <i className="fas fa-clock"></i>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horas Registradas</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white leading-none">
                            {totalMonthHours.toFixed(0)} <span className="text-sm font-medium text-gray-400">hs</span>
                        </p>
                        {totalExtraMonthHours > 0 && (
                            <p className="text-[9px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded flex items-center gap-1 w-fit mt-1 border border-amber-100 dark:border-amber-800">
                                <i className="fas fa-bolt"></i> +{totalExtraMonthHours.toFixed(1)} hs extras
                            </p>
                        )}
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shadow-inner">
                        <i className="fas fa-bullseye"></i>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capacidad Teórica</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white">{theoreticalCapacity} <span className="text-sm font-medium text-gray-400">hs</span></p>
                    </div>
                </div>
                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl shadow-inner">
                        <i className="fas fa-percentage"></i>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ocupación Global</p>
                        <p className={`text-2xl font-black ${occupancyRate > 90 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>{occupancyRate.toFixed(1)}%</p>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-400 to-indigo-500" style={{ width: `${Math.min(100, occupancyRate)}%` }}></div>
                </div>
                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shadow-inner">
                        <i className="fas fa-calendar-day"></i>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Días Hábiles</p>
                        <p className="text-2xl font-black text-gray-800 dark:text-white">{workingDaysCount} <span className="text-sm font-medium text-gray-400">días</span></p>
                    </div>
                </div>
            </div>

            {/* Main Table Section */}
            <div className="bg-white dark:bg-dark-card rounded-3xl shadow-xl border border-gray-100 dark:border-dark-border overflow-hidden flex flex-col min-h-0 mb-8">
                <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                    <table className="w-full border-collapse table-fixed min-w-[1200px]">
                        <thead>
                            <tr>
                                <th className="sticky left-0 top-0 z-40 bg-gray-50 dark:bg-slate-900 border-b dark:border-slate-700 w-[280px] p-4 text-left text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                    USUARIO / ACTIVIDAD
                                </th>
                                <th className="sticky top-0 z-30 border-b dark:border-slate-700 w-[70px] p-2 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50/50 dark:bg-slate-900/50">
                                    TOTAL
                                </th>
                                {days.map((d, idx) => {
                                    const { day, name } = formatDateShort(d);
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                    const iso = dayISOs[idx];
                                    return (
                                        <th key={iso} className={`sticky top-0 z-30 border-b dark:border-slate-700 w-[50px] p-3 text-center ${isWeekend ? 'bg-gray-100/50 dark:bg-slate-900/50' : 'bg-white dark:bg-dark-card'}`}>
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">{name}</div>
                                            <div className={`text-[15px] font-black ${isWeekend ? 'text-gray-300' : 'text-gray-800 dark:text-white'}`}>{day}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {team.map(member => {
                                const memberActivities = groupedData[member.id] || {};
                                const activityKeys = Object.keys(memberActivities);
                                const dayRegularTotals: Record<string, number> = {};
                                const dayExtraTotals: Record<string, number> = {};
                                let memberRegularTotal = 0;
                                let memberExtraTotal = 0;

                                dayISOs.forEach(iso => {
                                    let regSum = 0;
                                    let extSum = 0;
                                    activityKeys.forEach(key => {
                                        const assignments = memberActivities[key][iso] || [];
                                        regSum += assignments.filter(a => !a.isExtra).reduce((s, a) => s + a.hours, 0);
                                        extSum += assignments.filter(a => a.isExtra).reduce((s, a) => s + a.hours, 0);
                                    });
                                    dayRegularTotals[iso] = regSum;
                                    dayExtraTotals[iso] = extSum;
                                    memberRegularTotal += regSum;
                                    memberExtraTotal += extSum;
                                });

                                return (
                                    <React.Fragment key={member.id}>
                                        <tr className="bg-white dark:bg-dark-card transition-all">
                                            <td className="sticky left-0 z-20 bg-white dark:bg-dark-card p-5 border-r dark:border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs uppercase shadow-lg shadow-indigo-100 dark:shadow-none">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="font-black text-gray-800 dark:text-white text-sm truncate tracking-tight">{getMemberDisplayName(member.name, member.capacity_id)}</div>
                                                            <i 
                                                                className={`fas fa-copy text-[10px] text-blue-500 cursor-pointer hover:text-blue-600 transition-all ${isSaving ? 'opacity-20 cursor-not-allowed' : 'opacity-40'}`}
                                                                title="Copiar registros del mes anterior"
                                                                onClick={() => !isSaving && copyFromPreviousMonth(member.id)}
                                                            ></i>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{member.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="bg-gray-100/50 dark:bg-slate-800/60 text-center font-black text-sm text-gray-700 dark:text-gray-300 border-r dark:border-slate-700">
                                                {memberRegularTotal > 0 ? memberRegularTotal.toFixed(1) : '-'}
                                                {memberExtraTotal > 0 && <span className="text-[10px] text-amber-500 block leading-none pb-1">+{memberExtraTotal.toFixed(1)}</span>}
                                            </td>
                                            {days.map((d, idx) => {
                                                const iso = dayISOs[idx];
                                                const regTotal = dayRegularTotals[iso];
                                                const extTotal = dayExtraTotals[iso];
                                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                const isHoliday = ARG_HOLIDAYS.includes(iso);
                                                const isDisabled = isWeekend || isHoliday;
                                                return (
                                                    <td key={iso}
                                                        className={`text-center font-black text-xs p-0 h-14 group/cell relative ${isDisabled ? 'bg-gray-50 dark:bg-slate-900 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50/30'}`}
                                                        onClick={() => !isDisabled && handleCellClick(member.id, iso)}
                                                    >
                                                        {(regTotal > 0 || extTotal > 0) ? (
                                                            <div className="flex flex-col items-center justify-center leading-none">
                                                                {regTotal > 0 && <span className={`${regTotal >= 8 ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'} text-sm`}>
                                                                    {regTotal.toFixed(0)}
                                                                </span>}
                                                                {extTotal > 0 && <span className="text-[9px] text-amber-500 mt-0.5 font-bold">+{extTotal}</span>}
                                                            </div>
                                                        ) : isDisabled ? (
                                                            <span className="text-gray-200 dark:text-slate-800 text-[10px]">
                                                                <i className="fas fa-ban opacity-40"></i>
                                                            </span>
                                                        ) : (
                                                            <div className="opacity-0 group-hover/cell:opacity-100 transition-all scale-75 group-hover/cell:scale-110 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300">
                                                                <i className="fas fa-plus-circle text-lg drop-shadow-md"></i>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {activityKeys.map(key => {
                                            const activityTotal = days.reduce((sum, d) => {
                                                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                return sum + (memberActivities[key][iso] || []).filter(a => !a.isExtra).reduce((s, a) => s + a.hours, 0);
                                            }, 0);
                                            const activityExtraTotal = days.reduce((sum, d) => {
                                                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                return sum + (memberActivities[key][iso] || []).filter(a => a.isExtra).reduce((s, a) => s + a.hours, 0);
                                            }, 0);

                                            return (
                                                <tr key={key} className="hover:bg-gray-50/30 dark:hover:bg-indigo-900/5 transition-colors group">
                                                    <td className="sticky left-0 z-20 bg-white dark:bg-dark-card p-4 pl-16 border-r dark:border-slate-700 border-t border-gray-50 dark:border-slate-800/50">
                                                        <div className="flex items-center justify-between group/label">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className={`w-2 h-2 rounded-full shrink-0 ${key.startsWith('project') ? 'bg-indigo-400' : 'bg-amber-400'} shadow-sm shadow-indigo-100`}></div>
                                                                <div
                                                                    className="text-[11px] font-bold text-gray-500 dark:text-gray-400 truncate max-w-[200px] tracking-tight cursor-help"
                                                                    title={getActivityLabel(key)}
                                                                >
                                                                    {getActivityLabel(key)}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => deleteActivityRow(member.id, key)}
                                                                className="opacity-0 group-hover/label:opacity-100 p-1.5 text-gray-300 hover:text-red-500 transition-all"
                                                            >
                                                                <i className="fas fa-trash-alt text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="text-center text-[10px] font-bold text-gray-400 bg-gray-50/20 dark:bg-slate-800/20 border-r dark:border-slate-700 border-t border-gray-50 dark:border-slate-800/50">
                                                        {activityTotal > 0 ? activityTotal.toFixed(1) : '-'}
                                                        {activityExtraTotal > 0 && <span className="text-[9px] text-amber-500 block pb-1">+{activityExtraTotal.toFixed(1)}</span>}
                                                    </td>
                                                    {days.map((d, idx) => {
                                                        const iso = dayISOs[idx];
                                                        const dAssigns = memberActivities[key][iso] || [];
                                                        const regSum = dAssigns.filter(a => !a.isExtra).reduce((s, a) => s + a.hours, 0);
                                                        const extSum = dAssigns.filter(a => a.isExtra).reduce((s, a) => s + a.hours, 0);
                                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                        const isHoliday = ARG_HOLIDAYS.includes(iso);
                                                        const isDisabled = isWeekend || isHoliday;

                                                        return (
                                                            <td key={iso}
                                                                className={`text-center border-l dark:border-slate-800 border-t border-gray-50 dark:border-slate-800/50 p-0 h-12 group/cell relative ${isDisabled ? 'bg-gray-50/30 dark:bg-slate-900/30' : 'cursor-pointer hover:bg-indigo-50/20'}`}
                                                                onClick={() => !isDisabled && handleCellClick(member.id, iso, key, dAssigns[0])}
                                                            >
                                                                {inlineCell?.memberId === member.id && inlineCell?.date === iso && inlineCell?.activityKey === key ? (
                                                                    <input
                                                                        autoFocus
                                                                        type="number"
                                                                        disabled={isSaving}
                                                                        className="w-full h-full text-center bg-indigo-50 dark:bg-indigo-900/20 text-xs font-black outline-none border-none text-indigo-600 disabled:opacity-50"
                                                                        value={inlineHours}
                                                                        onChange={e => setInlineHours(e.target.value)}
                                                                        onBlur={() => saveAssignment(inlineHours, inlineCell)}
                                                                        onKeyDown={e => e.key === 'Enter' && saveAssignment(inlineHours, inlineCell)}
                                                                    />
                                                                ) : (
                                                                    (regSum > 0 || extSum > 0) ? (
                                                                        <div className="flex flex-col items-center justify-center leading-none">
                                                                            {regSum > 0 && <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{regSum}</span>}
                                                                            {extSum > 0 && <span className="text-[9px] font-black text-amber-500 mt-0.5">+{extSum}</span>}
                                                                            {isSaving && inlineCell?.date === iso && <i className="fas fa-circle-notch fa-spin text-[8px] text-indigo-400 absolute top-1 right-1"></i>}
                                                                        </div>
                                                                    ) : isDisabled ? (
                                                                        <span className="text-gray-200 dark:text-slate-800 text-[8px] opacity-40">
                                                                            <i className="fas fa-ban"></i>
                                                                        </span>
                                                                    ) : (
                                                                        <div className="opacity-0 group-hover/cell:opacity-100 transition-all scale-75 group-hover/cell:scale-110 text-indigo-300 hover:text-indigo-500">
                                                                            <i className="fas fa-plus-circle text-sm drop-shadow-sm"></i>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50/50 dark:bg-slate-900/50 border-t-2 dark:border-slate-700">
                                <td className="sticky left-0 z-20 bg-gray-50 dark:bg-slate-900 p-5 border-r dark:border-slate-700 font-black text-[11px] text-gray-500 uppercase tracking-widest">
                                    TOTAL EQUIPO DIARIO
                                </td>
                                <td className="text-center font-black text-sm text-indigo-600 dark:text-indigo-400 border-r dark:border-slate-700">
                                    {totalMonthHours.toFixed(1)}
                                </td>
                                {days.map((d, idx) => {
                                    const iso = dayISOs[idx];
                                    const dailySum = dailyTeamTotals[iso] || 0;
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                    const isDisabled = isWeekend || ARG_HOLIDAYS.includes(iso);
                                    return (
                                        <td key={iso} className={`text-center font-black text-[11px] text-gray-700 dark:text-gray-300 border-l dark:border-slate-800 ${isDisabled ? 'bg-gray-100/30 dark:bg-slate-800/20' : ''}`}>
                                            {dailySum > 0 ? dailySum.toFixed(1) : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Graphics Section - Improved with Recharts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* 1. TOP CARGA MENSUAL (RECHARTS) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500">
                            <i className="fas fa-trophy"></i>
                        </div>
                        TOP CARGA MENSUAL (HS)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topMembersData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" fontSize={10} tick={{fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" fontSize={10} width={100} tick={{fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'rgba(99, 102, 241, 0.05)'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} iconType="circle" />
                                <Bar dataKey="regular" name="Hs Regulares" stackId="a" fill="#6366f1" barSize={20} />
                                <Bar dataKey="extra" name="Hs Extras" stackId="a" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. MAYOR CARGA SEMANAL (PICO) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                            <i className="fas fa-chart-line"></i>
                        </div>
                        MAYOR CARGA SEMANAL (PICO)
                    </h3>
                    <div className="space-y-4">
                        {team.map(m => {
                            const weeklyHours: Record<string, number> = {};
                            capacityData.assignments.filter(a => a.memberId === m.id).forEach(a => {
                                const wk = getWeekKey(new Date(a.date + 'T00:00:00'));
                                weeklyHours[wk] = (weeklyHours[wk] || 0) + Number(a.hours);
                            });
                            const maxWeek = Object.entries(weeklyHours).sort((a, b) => b[1] - a[1])[0];
                            return { id: m.id, name: m.name, capacity_id: m.capacity_id, week: maxWeek ? maxWeek[0] : '-', hours: maxWeek ? maxWeek[1] : 0 };
                        })
                        .sort((a, b) => b.hours - a.hours)
                        .slice(0, 5)
                        .map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-transparent hover:border-emerald-100 dark:hover:border-slate-700 transition-all hover:shadow-md">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                                        <i className="fas fa-bolt text-sm"></i>
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{getMemberDisplayName(item.name, item.capacity_id)}</div>
                                        <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">{item.week}</div>
                                    </div>
                                </div>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{item.hours.toFixed(1)} hs</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. DISTRIBUCIÓN DE CARGA (MES) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-500">
                            <i className="fas fa-poll"></i>
                        </div>
                        DISTRIBUCIÓN DE CARGA (MES)
                    </h3>
                    <div className="space-y-6">
                        {team.map(m => {
                            let total = 0;
                            const mActivities = groupedData[m.id] || {};
                            Object.keys(mActivities).forEach(key => {
                                days.forEach(d => {
                                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                    total += (mActivities[key][iso] || []).reduce((s, a) => s + a.hours, 0);
                                });
                            });
                            return { id: m.id, name: m.name, capacity_id: m.capacity_id, hours: total };
                        })
                        .sort((a, b) => b.hours - a.hours)
                        .slice(0, 5)
                        .map(item => {
                            const maxPossible = theoreticalCapacity / team.length; // Approximate individual capacity
                            const pct = Math.min(100, (item.hours / (maxPossible || 160)) * 100);
                            return (
                                <div key={item.id} className="space-y-2 group">
                                    <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        <span>{getMemberDisplayName(item.name, item.capacity_id)}</span>
                                        <span className="text-gray-800 dark:text-white font-black">{item.hours.toFixed(1)}H <span className="text-gray-400 font-normal">/ {pct.toFixed(0)}%</span></span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-purple-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out group-hover:shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                                            style={{ width: `${pct}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 4. CARGA POR PROYECTO (RECHARTS) */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500">
                            <i className="fas fa-briefcase"></i>
                        </div>
                        CARGA POR PROYECTO (MES)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectHoursData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" fontSize={9} tick={{fill: '#94a3b8'}} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={50} />
                                <YAxis fontSize={10} tick={{fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'rgba(245, 158, 11, 0.05)'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} iconType="circle" />
                                <Bar dataKey="regular" name="Hs Regulares" stackId="a" fill="#f59e0b" barSize={30} />
                                <Bar dataKey="extra" name="Hs Extras" stackId="a" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
                </>
            )}

            {activeTab === 'project' && (
                <div className="flex flex-col gap-6">
                    {/* Project Selector Panel */}
                    <div className="bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Proyecto para Consultar</label>
                            <SearchableSelect
                                options={projects.map(p => ({ 
                                    id: p.id, 
                                    label: p.opportunityNumber ? `${p.opportunityNumber} - ${p.name}` : p.name 
                                }))}
                                value={selectedQueryProjectId}
                                onChange={setSelectedQueryProjectId}
                                placeholder="Seleccionar un proyecto..."
                            />
                        </div>
                    </div>

                    {!selectedQueryProjectId ? (
                        <div className="bg-white dark:bg-dark-card p-12 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 mb-4 shadow-inner">
                                <i className="fas fa-briefcase text-2xl"></i>
                            </div>
                            <h3 className="text-base font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">Consulta de Imputaciones</h3>
                            <p className="text-xs text-gray-400 max-w-sm">Seleccioná un proyecto del buscador de arriba para ver las horas imputadas, los colaboradores que trabajaron y el detalle de tareas.</p>
                        </div>
                    ) : isLoadingProjectDetail ? (
                        <div className="bg-white dark:bg-dark-card p-12 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 mb-4 shadow-inner">
                                <i className="fas fa-circle-notch fa-spin text-2xl"></i>
                            </div>
                            <h3 className="text-base font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">Cargando Historial...</h3>
                            <p className="text-xs text-gray-400 max-w-sm">Buscando todas las imputaciones históricas del proyecto en la base de datos.</p>
                        </div>
                    ) : (
                        <>
                            {/* Project Query KPIs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shadow-inner">
                                        <i className="fas fa-clock"></i>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horas Imputadas (Histórico)</p>
                                        <p className="text-2xl font-black text-gray-800 dark:text-white leading-none">
                                            {projectStats.totalHours.toFixed(0)} <span className="text-sm font-medium text-gray-400">hs</span>
                                        </p>
                                        {projectStats.totalExtra > 0 && (
                                            <p className="text-[9px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded flex items-center gap-1 w-fit mt-1 border border-amber-100 dark:border-amber-800">
                                                <i className="fas fa-bolt"></i> +{projectStats.totalExtra.toFixed(1)} hs extras
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shadow-inner">
                                        <i className="fas fa-users"></i>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Colaboradores Únicos</p>
                                        <p className="text-2xl font-black text-gray-800 dark:text-white">
                                            {projectStats.collaboratorCount} <span className="text-sm font-medium text-gray-400">personas</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-dark-card p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shadow-inner shrink-0 mt-1">
                                        <i className="fas fa-dollar-sign"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Costo Estimado (MO)</p>
                                        <div className="grid grid-cols-2 gap-4 divide-x divide-gray-100 dark:divide-dark-border">
                                            <div>
                                                <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <i className="fas fa-user-tie text-[8px]"></i> PMs
                                                </p>
                                                <p className="text-xl font-black text-gray-800 dark:text-white leading-none">
                                                    ${(projectStats.pmHours * 24).toLocaleString()} <span className="text-[9px] font-normal text-gray-400">USD</span>
                                                </p>
                                                <p className="text-[10px] font-medium text-gray-400 mt-1.5 bg-gray-50 dark:bg-dark-bg px-1.5 py-0.5 rounded w-fit">
                                                    {projectStats.pmHours.toFixed(1)} hs
                                                </p>
                                            </div>
                                            <div className="pl-4">
                                                <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <i className="fas fa-laptop-code text-[8px]"></i> Ingenieros
                                                </p>
                                                <p className="text-xl font-black text-gray-800 dark:text-white leading-none">
                                                    ${(projectStats.engHours * 24).toLocaleString()} <span className="text-[9px] font-normal text-gray-400">USD</span>
                                                </p>
                                                <p className="text-[10px] font-medium text-gray-400 mt-1.5 bg-gray-50 dark:bg-dark-bg px-1.5 py-0.5 rounded w-fit">
                                                    {projectStats.engHours.toFixed(1)} hs
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Details and Graph Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Collaborator Breakdown Chart */}
                                <div className="lg:col-span-1 bg-white dark:bg-dark-card p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col">
                                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500">
                                            <i className="fas fa-chart-pie"></i>
                                        </div>
                                        Participación
                                    </h3>
                                    {projectCollaboratorHoursData.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic">Sin datos de gráficos</div>
                                    ) : (
                                        <div className="h-64 w-full flex-1">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={projectCollaboratorHoursData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                                    <XAxis type="number" fontSize={9} tick={{fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                                    <YAxis dataKey="name" type="category" fontSize={9} width={90} tick={{fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{fill: 'rgba(99, 102, 241, 0.05)'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} />
                                                    <Bar dataKey="regular" name="Hs Regulares" stackId="a" fill="#6366f1" barSize={14} />
                                                    <Bar dataKey="extra" name="Hs Extras" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>

                                {/* Detailed Allocations Table */}
                                <div className="lg:col-span-2 bg-white dark:bg-dark-card rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden flex flex-col">
                                    <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                                        <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                                                <i className="fas fa-list-ol"></i>
                                            </div>
                                            Detalle de Imputaciones
                                        </h3>
                                        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full uppercase tracking-wider">
                                            {projectAssignments.length} Registros
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto max-h-[450px]">
                                        <table className="w-full border-collapse text-xs text-left">
                                            <thead className="bg-gray-50/50 dark:bg-slate-900/50 text-gray-400 font-black uppercase tracking-widest sticky top-0 z-10 border-b dark:border-slate-700">
                                                <tr>
                                                    <th className="p-4 w-[160px]">Fecha</th>
                                                    <th className="p-4 w-[180px]">Colaborador</th>
                                                    <th className="p-4 text-center w-[90px]">Horas</th>
                                                    <th className="p-4">Tarea / Observaciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-800 bg-white dark:bg-slate-900">
                                                {projectAssignments.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="p-12 text-center text-gray-400 italic">No se registraron imputaciones de horas para este proyecto.</td>
                                                    </tr>
                                                ) : (
                                                    projectAssignments
                                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                        .map(a => {
                                                            const member = team.find(t => t.id === a.memberId);
                                                            const memberName = member ? getMemberDisplayName(member.name, member.capacity_id) : 'Desconocido';
                                                            const formattedDate = new Date(a.date + 'T00:00:00')
                                                                .toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
                                                                .toUpperCase().replace('.', '');
                                                            return (
                                                                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                                    <td className="p-4 font-mono font-bold text-gray-400 text-[10px]">{formattedDate}</td>
                                                                    <td className="p-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[9px] uppercase">
                                                                                {memberName.charAt(0)}
                                                                            </div>
                                                                            <span className="font-bold text-gray-700 dark:text-gray-300">{memberName}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 text-center">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${a.isExtra ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
                                                                            {a.hours} hs
                                                                            {a.isExtra && <i className="fas fa-bolt text-[8px]"></i>}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">
                                                                        {a.observations && a.observations !== 'EMPTY' ? a.observations : <span className="text-gray-400 italic">Sin observaciones</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={null}>
                <div className="p-2">
                    {/* Modal Header from Screenshot 3 */}
                    <div className="flex items-center gap-3 mb-1">
                        <i className="fas fa-clock text-indigo-600 text-xl"></i>
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Registrar Horas</h2>
                    </div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">
                        {(() => {
                            if (!selectedCell?.date) return '';
                            const d = new Date(selectedCell.date + 'T00:00:00');
                            return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
                        })()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoría</label>
                            <select 
                                value={assignType === 'project' ? 'project' : assignType} 
                                onChange={e => setAssignType(e.target.value)} 
                                className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-slate-800 dark:bg-slate-900 text-sm font-bold focus:border-indigo-600 outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center]"
                                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236366f1\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundSize: '1.2em' }}
                            >
                                <option value="project">Proyecto Cliente</option>
                                <option value="internal_bau">TP-AR-99140-INTERNO SP DATAC & CONECT BAU</option>
                                <option value="tableros">TP-AR-99140-11-Creación de tableros, reportes y procesos</option>
                                <option value="gestion">TP-AR-99140-12-Gestión de proyectos generales</option>
                                <option value="reuniones">TP-AR-99140-13-Reuniones internas</option>
                                <option value="capacitacion">TP-AR-99140-14-Capacitaciones y certificaciones requeridas</option>
                                <option value="licencias">TP-AR-99140-15-Licencias (cumpleaños, estudio, enfermedad)</option>
                                <option value="poc">TP-AR-99140-16-Preventiva y POC</option>
                                <option value="consultoria">TP-AR-99140-17-Consultoría interna</option>
                                <option value="logistica">TP-AR-99140-18-Logística de proyectos</option>
                                <option value="facturacion">TP-AR-99140-19-Facturación de proyectos</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cantidad HS</label>
                            <input 
                                type="number" 
                                value={assignHours} 
                                onChange={e => setAssignHours(e.target.value)} 
                                className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-slate-800 dark:bg-slate-900 text-sm font-black focus:border-indigo-600 outline-none transition-all" 
                                placeholder="Ej: 8" 
                                min="0" 
                                max="24" 
                                step="0.5" 
                            />
                        </div>
                    </div>

                    <div className="mb-6 flex items-center justify-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={assignIsExtra} 
                                onChange={e => setAssignIsExtra(e.target.checked)}
                                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                            />
                            <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full">
                                <i className="fas fa-bolt mr-1"></i> Son Horas Extras
                            </span>
                        </label>
                    </div>

                    {assignType === 'project' && (
                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Proyecto Seleccionado</label>
                            <SearchableSelect
                                options={projects.map(p => ({ 
                                    id: p.id, 
                                    label: p.opportunityNumber ? `${p.opportunityNumber} - ${p.name}` : p.name 
                                }))}
                                value={assignProject}
                                onChange={setAssignProject}
                                placeholder="Seleccionar proyecto..."
                            />
                        </div>
                    )}

                    <div className="mb-8">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descripción / Tarea</label>
                        <textarea 
                            value={assignObs} 
                            onChange={e => setAssignObs(e.target.value)} 
                            className="w-full p-4 rounded-xl border-2 border-gray-100 dark:border-slate-800 dark:bg-slate-900 text-sm font-medium focus:border-indigo-600 outline-none transition-all min-h-[120px] resize-none" 
                            placeholder="¿En qué estuviste trabajando?" 
                        />
                    </div>

                    {/* Replication Section from Screenshot 3 */}
                    <div className="bg-gray-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border-2 border-gray-50 dark:border-slate-800 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <i className="fas fa-sync-alt text-indigo-400 text-sm"></i>
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Replicar esta carga</span>
                        </div>
                        <select 
                            value={replicateOption} 
                            onChange={e => setReplicateOption(e.target.value)}
                            className="w-full p-3 rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                        >
                            <option value="none">No replicar (Solo hoy)</option>
                            <option value="week">Replicar toda la semana (L a V)</option>
                            <option value="month">Replicar todo el mes (L a V)</option>
                            {selectedCell?.date && (
                                <option value="dayOfWeek">
                                    Replicar todos los {new Date(selectedCell.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' })} hasta fin de mes
                                </option>
                            )}
                        </select>
                        <p className="text-[9px] text-gray-400 font-bold mt-2 italic">Se omitirán automáticamente fines de semana y feriados.</p>
                    </div>

                    <div className="sticky bottom-0 bg-white dark:bg-dark-card pt-4 pb-2 border-t dark:border-slate-800 flex items-center justify-end gap-4 z-20 -mx-8 px-8">
                        <button 
                            onClick={handleCloseModal}
                            className="px-6 py-3 text-sm font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-all"
                        >
                            CANCELAR
                        </button>
                        {selectedCell?.assignmentId && (
                            <button onClick={deleteAssignment} className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                                <i className="fas fa-trash-alt"></i>
                            </button>
                        )}
                        <button 
                            onClick={() => saveAssignment()} 
                            disabled={isSaving}
                            className={`px-10 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : null}
                            {isSaving ? 'GUARDANDO...' : (selectedCell?.assignmentId ? 'ACTUALIZAR' : 'GUARDAR')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
