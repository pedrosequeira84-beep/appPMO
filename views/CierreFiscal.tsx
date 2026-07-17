import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Project, COST_CATEGORIES } from '../types';
import { formatDate } from '../utils/helpers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell
} from 'recharts';

// ─── Años Fiscales disponibles ────────────────────────────────────────────────
const FY_OPTIONS = [2022, 2023, 2024, 2025, 2026, 2027].map(y => ({
  value: y,
  label: `FY${String(y).slice(2)}/${String(y + 1).slice(2)}`
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getPeriodDates = (fy: number, half: 'H1' | 'H2') => {
  if (half === 'H1') {
    return {
      start: new Date(fy, 6, 1),              // 01/07/FY
      end: new Date(fy, 11, 31, 23, 59, 59)   // 31/12/FY
    };
  } else {
    return {
      start: new Date(fy + 1, 0, 1),              // 01/01/FY+1
      end: new Date(fy + 1, 5, 30, 23, 59, 59)    // 30/06/FY+1
    };
  }
};

const safeDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
};

const getPepCode = (opp: string, category: string) => {
  const m = category.match(/^(\d+)/);
  if (!m) return opp;
  const n = m[1];
  return `${opp || 'S/D'}-${n.length === 1 ? '0' + n : n}`;
};

const fmtNum = (v: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(v));

const fmtUSD = (v: number) => {
  if (v === 0) return 'USD 0';
  return `${v < 0 ? '-' : ''}USD ${fmtNum(v)}`;
};

const renderCustomLabel = (props: any, formatter?: (v: any) => string) => {
  const { x, y, width, height, value } = props;
  if (value === undefined || value === null) return null;

  const formattedValue = formatter ? formatter(value) : String(value);
  const valNum = Number(value) || 0;
  
  // Ancho absoluto de la barra en píxeles
  const barWidth = Math.abs(width);
  // Si la barra es menor a 75px, dibujamos el texto afuera
  const isTooShort = barWidth < 75;
  const isNegative = valNum < 0;

  let labelX = x + width;
  let anchor = 'end';
  let color = '#ffffff';

  if (isTooShort) {
    labelX = isNegative ? x + width - 6 : x + width + 6;
    anchor = isNegative ? 'end' : 'start';
    color = '#1e293b'; // slate-800 para alto contraste
  } else {
    labelX = isNegative ? x + width + 8 : x + width - 8;
    anchor = isNegative ? 'start' : 'end';
    color = '#ffffff'; // Blanco dentro de la barra
  }

  return (
    <text
      x={labelX}
      y={y + height / 2}
      dy={4.5}
      textAnchor={anchor}
      fill={color}
      fontSize={12}
      fontWeight={900}
      className="select-none"
    >
      {formattedValue}
    </text>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export const CierreFiscalView: React.FC = () => {
  const { projects, expenses, changes, milestones } = useApp();

  const [selectedFY, setSelectedFY] = useState(2025);
  const [selectedHalf, setSelectedHalf] = useState<'H1' | 'H2'>('H2');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(true);

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPeriodDates(selectedFY, selectedHalf),
    [selectedFY, selectedHalf]
  );

  const fyLabel = `FY${String(selectedFY).slice(2)}/${String(selectedFY + 1).slice(2)}`;
  const periodLabel = selectedHalf === 'H1'
    ? `01/07/${selectedFY} — 31/12/${selectedFY}`
    : `01/01/${selectedFY + 1} — 30/06/${selectedFY + 1}`;

  // Filtro base: solo En ejecución y Finalizado (sin Soporte, Intervención temprana, POC, Cancelado)
  const allowedStatuses = ['En ejecución', 'Finalizado'];
  const eligibleProjects = useMemo(
    () => projects.filter(p => allowedStatuses.includes(p.status)),
    [projects]
  );

  // Preselección automática al cambiar período
  useEffect(() => {
    const suggested = eligibleProjects.filter(p => {
      const s = safeDate(p.startDate);
      const e = safeDate(p.realEndDate) || safeDate(p.theoreticalEndDate);
      return s && s <= periodEnd && (!e || e >= periodStart);
    }).map(p => p.id);
    setSelectedIds(suggested);
  }, [selectedFY, selectedHalf]);

  const selectedProjects = useMemo(
    () => eligibleProjects.filter(p => selectedIds.includes(p.id)),
    [eligibleProjects, selectedIds]
  );

  const visibleInSelector = useMemo(() => {
    if (!search) return eligibleProjects;
    const q = search.toLowerCase();
    return eligibleProjects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.clientName || '').toLowerCase().includes(q) ||
      (p.opportunityNumber || '').toLowerCase().includes(q) ||
      (p.pm || '').toLowerCase().includes(q)
    );
  }, [eligibleProjects, search]);

  const toggle = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ─── Desvío temporal ───────────────────────────────────────────────────────
  const getOriginalEnd = (p: Project): Date | null => {
    const hist = p.dateChangeHistory || [];
    if (!hist.length) return safeDate(p.theoreticalEndDate);
    const first = [...hist].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())[0];
    return first.previousDate ? safeDate(first.previousDate) : safeDate(p.theoreticalEndDate);
  };

  const getDevDays = (p: Project): number => {
    const orig = getOriginalEnd(p);
    const curr = safeDate(p.realEndDate) || safeDate(p.theoreticalEndDate);
    if (!orig || !curr) return 0;
    return Math.round((curr.getTime() - orig.getTime()) / 86400000);
  };

  // Label para gráficos: Cliente · Proyecto · TP-AR-xxxxx (truncado)
  const chartLabel = (p: Project) => {
    const client = p.clientName || '';
    const name = p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name;
    const opp = p.opportunityNumber || '';
    const parts = [client, name, opp].filter(Boolean);
    return parts.join(' · ');
  };

  // Label completo para tablas y encabezados (sin truncar)
  const fullLabel = (p: Project) => {
    const parts = [p.clientName, p.name, p.opportunityNumber].filter(Boolean);
    return parts.join(' · ');
  };

  // ─── Datos de los 3 gráficos ───────────────────────────────────────────────
  const desvioTemporalData = useMemo(() =>
    selectedProjects
      .map(p => ({ name: chartLabel(p), fullName: p.name, days: getDevDays(p) }))
      .sort((a, b) => b.days - a.days),
    [selectedProjects]
  );

  const cambiosData = useMemo(() =>
    selectedProjects
      .map(p => ({ name: chartLabel(p), fullName: p.name, count: changes.filter(c => c.projectId === p.id).length }))
      .sort((a, b) => b.count - a.count),
    [selectedProjects, changes]
  );

  // Retorna el presupuesto total, el consumido total saneado (ignorando PEPs con acumulado negativo) y flag de alerta
  const getProjectSaneCosts = (projectId: string, budgetObj: any) => {
    let totalBudget = 0;
    let totalSaneConsumed = 0;
    let hasNegativePep = false;

    COST_CATEGORIES.forEach(cat => {
      const budget = budgetObj?.[cat] || 0;
      totalBudget += budget;

      const con = expenses
        .filter(e => e.projectId === projectId && e.category === cat)
        .reduce((s, e) => s + e.amount, 0);

      if (con < 0) {
        hasNegativePep = true;
      } else {
        totalSaneConsumed += con;
      }
    });

    return {
      budget: totalBudget,
      consumed: totalSaneConsumed,
      deviation: totalSaneConsumed - totalBudget,
      hasNegativePep
    };
  };

  const desvioEconomicoData = useMemo(() =>
    selectedProjects
      .map(p => {
        const sane = getProjectSaneCosts(p.id, p.budget);
        // Agregamos un emoji de advertencia en el label si tiene algún PEP negativo
        const labelName = chartLabel(p) + (sane.hasNegativePep ? ' ⚠️' : '');
        return { 
          name: labelName, 
          fullName: p.name + (sane.hasNegativePep ? ' (Contiene PEP con saldo SAP negativo)' : ''), 
          deviation: sane.deviation 
        };
      })
      .sort((a, b) => b.deviation - a.deviation),
    [selectedProjects, expenses]
  );

  // ─── Clasificación temporal ────────────────────────────────────────────────
  const groups = useMemo(() => {
    const preexistentes: Project[] = [];
    const nuevos: Project[] = [];
    const finalizados: Project[] = [];
    const continuan: Project[] = [];
    selectedProjects.forEach(p => {
      const s = safeDate(p.startDate);
      const e = safeDate(p.realEndDate) || safeDate(p.theoreticalEndDate);
      if (s && s < periodStart) preexistentes.push(p);
      if (s && s >= periodStart && s <= periodEnd) nuevos.push(p);
      if (p.status === 'Finalizado' && e && e >= periodStart && e <= periodEnd) finalizados.push(p);
      if (p.status !== 'Finalizado' || (e && e > periodEnd)) continuan.push(p);
    });
    return { preexistentes, nuevos, finalizados, continuan };
  }, [selectedProjects, periodStart, periodEnd]);

  // ─── Facturación ──────────────────────────────────────────────────────────
  const billing = useMemo(() => {
    const perProject = selectedProjects.map(p => {
      const ms = milestones.filter(m => m.projectId === p.id && !m.parentId);
      
      // Filtrar hitos cuya fecha caiga dentro del semestre en análisis
      const msInPeriod = ms.filter(m => {
        const mDate = safeDate(m.date);
        return !!(mDate && mDate >= periodStart && mDate <= periodEnd);
      });

      const expectedUSD = msInPeriod.filter(m => m.currency === 'USD' || !m.currency).reduce((s, m) => s + (m.amount || 0), 0);
      const receivedUSD = msInPeriod.filter(m => m.currency === 'USD' || !m.currency).reduce((s, m) => s + (m.receivedAmount || 0), 0);
      const pendingUSD = expectedUSD - receivedUSD;
      
      const expectedARS = msInPeriod.filter(m => m.currency === 'ARS').reduce((s, m) => s + (m.amount || 0), 0);
      const receivedARS = msInPeriod.filter(m => m.currency === 'ARS').reduce((s, m) => s + (m.receivedAmount || 0), 0);
      const pendingARS = expectedARS - receivedARS;

      const usdPct = expectedUSD > 0 ? (receivedUSD / expectedUSD) * 100 : 0;
      const arsPct = expectedARS > 0 ? (receivedARS / expectedARS) * 100 : 0;
      const pct = (expectedUSD > 0 && expectedARS > 0) ? (usdPct + arsPct) / 2 : (expectedUSD > 0 ? usdPct : arsPct);

      return { project: p, expectedUSD, receivedUSD, pendingUSD, expectedARS, receivedARS, pendingARS, pct };
    }).sort((a, b) => b.pct - a.pct);

    const totalExpectedUSD = perProject.reduce((s, d) => s + d.expectedUSD, 0);
    const totalReceivedUSD = perProject.reduce((s, d) => s + d.receivedUSD, 0);
    const totalPendingUSD = totalExpectedUSD - totalReceivedUSD;
    const totalPctUSD = totalExpectedUSD > 0 ? (totalReceivedUSD / totalExpectedUSD) * 100 : 0;

    const totalExpectedARS = perProject.reduce((s, d) => s + d.expectedARS, 0);
    const totalReceivedARS = perProject.reduce((s, d) => s + d.receivedARS, 0);
    const totalPendingARS = totalExpectedARS - totalReceivedARS;
    const totalPctARS = totalExpectedARS > 0 ? (totalReceivedARS / totalExpectedARS) * 100 : 0;

    return { 
      perProject, 
      totalExpectedUSD, totalReceivedUSD, totalPendingUSD, totalPctUSD,
      totalExpectedARS, totalReceivedARS, totalPendingARS, totalPctARS
    };
  }, [selectedProjects, milestones, periodStart, periodEnd]);

  // ─── Lógica del Timeline (Gantt) ──────────────────────────────────────────
  const BAR_GRADIENTS = [
    'from-emerald-400 to-teal-500 shadow-emerald-500/10 dark:from-emerald-500 dark:to-teal-600',
    'from-blue-400 to-indigo-500 shadow-blue-500/10 dark:from-blue-500 dark:to-indigo-600',
    'from-violet-400 to-purple-500 shadow-purple-500/10 dark:from-violet-500 dark:to-purple-600',
    'from-amber-400 to-orange-500 shadow-amber-500/10 dark:from-amber-500 dark:to-orange-600',
    'from-pink-400 to-rose-500 shadow-pink-500/10 dark:from-pink-500 dark:to-rose-600',
    'from-sky-400 to-cyan-500 shadow-cyan-500/10 dark:from-sky-500 dark:to-cyan-600',
    'from-lime-400 to-green-500 shadow-green-500/10 dark:from-lime-500 dark:to-green-600',
    'from-indigo-400 to-violet-500 shadow-indigo-500/10 dark:from-indigo-500 dark:to-violet-600',
  ];

  const timelineData = useMemo(() => {
    if (selectedProjects.length === 0) {
      return { periods: [], fyHeaders: [], rows: [] };
    }

    const mapped = selectedProjects.map(p => {
      const start = safeDate(p.startDate) || new Date();
      const end = safeDate(p.realEndDate) || safeDate(p.theoreticalEndDate) || new Date();
      const theo = safeDate(p.theoreticalEndDate);
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

    // Margen de padding (mínimo 7 días)
    const rawDuration = maxTime - minTime;
    const padding = Math.max(7 * 24 * 60 * 60 * 1000, rawDuration * 0.05);
    const timelineStart = minTime - padding;
    const timelineEnd = maxTime + padding;
    const totalDuration = timelineEnd - timelineStart;

    // Determinar semestres
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

    if (periods.length > 0) {
      const diff = 100 - totalCalculatedWidth;
      periods[periods.length - 1].width += diff;
    }

    const fyHeaders: { label: string; width: number }[] = [];
    periods.forEach(p => {
      const lastHeader = fyHeaders[fyHeaders.length - 1];
      if (lastHeader && lastHeader.label === p.label) {
        lastHeader.width += p.width;
      } else {
        fyHeaders.push({ label: p.label, width: p.width });
      }
    });

    const rows = mapped.map(p => {
      const startMs = p.start.getTime();
      const endMs = p.end.getTime();
      const theoMs = p.theo ? p.theo.getTime() : endMs;
      
      const left = Math.max(0, ((startMs - timelineStart) / totalDuration) * 100);
      
      const desvioDays = Math.round((endMs - theoMs) / (24 * 60 * 60 * 1000));
      const hasDesvio = desvioDays > 0;

      let widthPlan = 0;
      let leftDesvio = 0;
      let widthDesvio = 0;

      if (hasDesvio) {
        widthPlan = Math.max(1.5, ((theoMs - startMs) / totalDuration) * 100);
        leftDesvio = ((theoMs - timelineStart) / totalDuration) * 100;
        widthDesvio = Math.max(1.5, ((endMs - theoMs) / totalDuration) * 100);
      } else {
        const rawWidth = ((endMs - startMs) / totalDuration) * 100;
        widthPlan = Math.max(1.5, Math.min(100 - left, rawWidth));
      }

      let relativeTheoLeft: number | null = null;
      if (hasDesvio) {
        relativeTheoLeft = (widthPlan / (widthPlan + widthDesvio)) * 100;
      }

      return {
        ...p,
        left,
        widthPlan,
        hasDesvio,
        leftDesvio,
        widthDesvio,
        desvioDays,
        relativeTheoLeft
      };
    });

    return { periods, fyHeaders, rows };
  }, [selectedProjects, periodStart, periodEnd]);

  // Altura de gráficos: crece dinámicamente para mostrar todos los proyectos
  const chartH = Math.max(280, selectedProjects.length * 52 + 60);

  // ─── Colores de barra condicionales ───────────────────────────────────────
  const getBarColor = (val: number, positiveIsBad = true) =>
    val > 0 ? (positiveIsBad ? '#f43f5e' : '#10b981') : (positiveIsBad ? '#10b981' : '#f43f5e');

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 pb-16">

      {/* ═══════════════════════════════════════════════
          BLOQUE 0 — Controles (oculto en impresión)
      ════════════════════════════════════════════════ */}
      <div className="print:hidden space-y-5">
        {/* Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl border border-indigo-500/10 shadow-xl">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-400/20">
              Sección Administrativa · Solo Administrador
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Reporte de Cierre Fiscal</h1>
            <p className="text-slate-400 text-sm mt-1">Configurá el período y los proyectos incluidos, luego capturá cada sección para tu PPT</p>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0">
            <i className="fas fa-print"></i> Guardar como PDF
          </button>
        </div>

        {/* Selector de período */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="font-black text-sm text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-indigo-500"></i> Período del Informe
          </h3>
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Año Fiscal</label>
              <select
                value={selectedFY}
                onChange={e => setSelectedFY(Number(e.target.value))}
                className="px-4 py-2.5 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white"
              >
                {FY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Semestre</label>
              <div className="flex gap-2">
                {(['H1', 'H2'] as const).map(h => (
                  <button
                    key={h}
                    onClick={() => setSelectedHalf(h)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                      selectedHalf === h ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
              <i className="fas fa-clock text-indigo-500 text-xs"></i>
              <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">{fyLabel} · {selectedHalf}</span>
              <span className="text-xs text-indigo-500 border-l border-indigo-200 dark:border-indigo-700 pl-3 ml-1">{periodLabel}</span>
            </div>
          </div>
        </div>

        {/* Selector de proyectos */}
        <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <i className="fas fa-filter text-sm"></i>
              </div>
              <div>
                <p className="font-black text-sm text-slate-800 dark:text-white">Proyectos en el Informe</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{selectedIds.length} de {projects.length} seleccionados · Incluye finalizados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIds(projects.map(p => p.id))} className="text-xs font-bold text-indigo-500 hover:underline">Todos</button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button onClick={() => setSelectedIds([])} className="text-xs font-bold text-slate-400 hover:underline">Ninguno</button>
              <button onClick={() => setSelectorOpen(!selectorOpen)} className="ml-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-all">
                <i className={`fas fa-chevron-${selectorOpen ? 'up' : 'down'} text-xs`}></i>
              </button>
            </div>
          </div>

          {selectorOpen && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <input
                type="text"
                placeholder="Buscar por proyecto, cliente, oportunidad, PM…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                {visibleInSelector.map(p => {
                  const isSelected = selectedIds.includes(p.id);
                  const ps = safeDate(p.startDate);
                  const pe = safeDate(p.realEndDate) || safeDate(p.theoreticalEndDate);
                  const isSuggested = ps && ps <= periodEnd && (!pe || pe >= periodStart);
                  return (
                    <label key={p.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggle(p.id)} className="mt-0.5 w-4 h-4 text-indigo-600 rounded shrink-0" />
                      <div className="truncate min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.name}</p>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-[10px] text-slate-400 truncate">{p.opportunityNumber || 'S/N'}</span>
                          {p.status === 'Finalizado' && <span className="text-[9px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 rounded shrink-0">FIN</span>}
                          {isSuggested && <span className="text-[9px] font-black bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1 rounded shrink-0">sugerido</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Encabezado visible solo en impresión */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-black text-slate-900">Reporte de Cierre Fiscal · {fyLabel} {selectedHalf}</h1>
        <p className="text-slate-500 text-sm mt-1">Período: {periodLabel} · {selectedIds.length} proyectos incluidos</p>
      </div>

      {/* ─── Estado vacío ─────────────────────────────────────────────────── */}
      {selectedProjects.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
          <i className="fas fa-folder-open fa-3x text-slate-300 dark:text-slate-700 mb-4"></i>
          <p className="font-bold text-slate-500 dark:text-slate-400">Seleccioná proyectos para generar el reporte</p>
          <p className="text-xs text-slate-400 mt-1">Usá el panel de arriba para elegir el período y los proyectos a incluir</p>
        </div>
      ) : (
        <>

          {/* ═══════════════════════════════════════════════
              BLOQUE 1 — Métricas de Resumen
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label={`Resumen del Período · ${fyLabel} ${selectedHalf}`} sub={periodLabel} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Proyectos Evaluados', value: selectedProjects.length, cls: 'text-slate-800 dark:text-white', sub: 'incluidos en el informe' },
                { label: 'Preexistentes', value: groups.preexistentes.length, cls: 'text-indigo-600 dark:text-indigo-400', sub: 'Inicio anterior al período' },
                { label: 'Iniciados en el Período', value: groups.nuevos.length, cls: 'text-emerald-600 dark:text-emerald-400', sub: 'Nuevos durante el semestre' },
                { label: 'Finalizados en el Período', value: groups.finalizados.length, cls: 'text-sky-500 dark:text-sky-400', sub: 'Cerrados al finalizar el sem.' },
                { label: 'Continúan', value: groups.continuan.length, cls: 'text-amber-500 dark:text-amber-400', sub: 'Activos al próximo período' },
              ].map((c, i) => (
                <div key={i} className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 leading-tight">{c.label}</p>
                  <p className={`text-5xl font-black ${c.cls} leading-none`}>{c.value}</p>
                  <p className="text-[10px] text-slate-400 mt-3">{c.sub}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 2 — Hitos de Facturación (Recepción)
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Hitos de Facturación - Recepción" sub="Monto total esperado vs. recepcionado vs. pendiente de recepción" />

            {/* Tarjetas globales + barra */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
                {[
                  { 
                    label: 'Monto Total Esperado', 
                    val: (
                      <div className="flex flex-col">
                        <span>USD {fmtNum(billing.totalExpectedUSD)}</span>
                        {billing.totalExpectedARS > 0 && <span className="text-xs font-bold text-slate-500">ARS {fmtNum(billing.totalExpectedARS)}</span>}
                      </div>
                    ), 
                    cls: 'text-slate-800 dark:text-white' 
                  },
                  { 
                    label: 'Monto Recepcionado', 
                    val: (
                      <div className="flex flex-col">
                        <span>USD {fmtNum(billing.totalReceivedUSD)}</span>
                        {billing.totalExpectedARS > 0 && <span className="text-xs font-bold text-emerald-500/80">ARS {fmtNum(billing.totalReceivedARS)}</span>}
                      </div>
                    ), 
                    cls: 'text-emerald-600 dark:text-emerald-400' 
                  },
                  { 
                    label: 'Pendiente de Recepción', 
                    val: (
                      <div className="flex flex-col">
                        <span>USD {fmtNum(billing.totalPendingUSD)}</span>
                        {billing.totalExpectedARS > 0 && <span className="text-xs font-bold text-amber-500/80">ARS {fmtNum(billing.totalPendingARS)}</span>}
                      </div>
                    ), 
                    cls: 'text-amber-600 dark:text-amber-400' 
                  },
                  { 
                    label: '% Recepcionado Global', 
                    val: (
                      <div className="flex flex-col">
                        <span>{Math.round(billing.totalPctUSD)}% (USD)</span>
                        {billing.totalExpectedARS > 0 && <span className="text-xs font-bold text-slate-500">{Math.round(billing.totalPctARS)}% (ARS)</span>}
                      </div>
                    ), 
                    cls: billing.totalPctUSD >= 80 ? 'text-emerald-600' : billing.totalPctUSD >= 50 ? 'text-amber-600' : 'text-red-500' 
                  },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                    <div className={`text-xl font-black ${item.cls}`}>{item.val}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                  <span>Progreso Global de Recepción (USD)</span>
                  <span>{Math.round(billing.totalPctUSD)}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(2, Math.min(100, billing.totalPctUSD))}%` }}
                  >
                    {billing.totalPctUSD > 10 && <span className="text-[9px] text-white font-black">{Math.round(billing.totalPctUSD)}%</span>}
                  </div>
                </div>
                {billing.totalExpectedARS > 0 && (
                  <>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                      <span>Progreso Global de Recepción (ARS)</span>
                      <span>{Math.round(billing.totalPctARS)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden mb-3">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(2, Math.min(100, billing.totalPctARS))}%` }}
                      >
                        {billing.totalPctARS > 10 && <span className="text-[9px] text-white font-black">{Math.round(billing.totalPctARS)}%</span>}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex flex-col text-[10px] text-slate-400 mt-1.5 gap-1">
                  <div className="flex justify-between">
                    <span className="text-emerald-600 font-bold">✓ USD {fmtNum(billing.totalReceivedUSD)} recepcionados</span>
                    <span className="text-amber-600 font-bold">⏳ USD {fmtNum(billing.totalPendingUSD)} pendientes de recepción</span>
                  </div>
                  {billing.totalExpectedARS > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-600 font-bold">✓ ARS {fmtNum(billing.totalReceivedARS)} recepcionados</span>
                      <span className="text-amber-600 font-bold">⏳ ARS {fmtNum(billing.totalPendingARS)} pendientes de recepción</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla por proyecto */}
            <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-3" colSpan={2}>Proyecto</th>
                    <th className="px-5 py-3 text-right">Monto Esperado</th>
                    <th className="px-5 py-3 text-right">Recepcionado</th>
                    <th className="px-5 py-3 text-right">Pendiente</th>
                    <th className="px-5 py-3 min-w-[160px]">% Recepcionado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {billing.perProject.map(({ project: p, expectedUSD, receivedUSD, pendingUSD, expectedARS, receivedARS, pendingARS, pct }) => (
                    <tr key={p.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-800 dark:text-white" colSpan={2}>{fullLabel(p)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col">
                          {expectedUSD > 0 && <span>USD {fmtNum(expectedUSD)}</span>}
                          {expectedARS > 0 && <span>ARS {fmtNum(expectedARS)}</span>}
                          {expectedUSD === 0 && expectedARS === 0 && <span>USD 0</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        <div className="flex flex-col">
                          {receivedUSD > 0 && <span>USD {fmtNum(receivedUSD)}</span>}
                          {receivedARS > 0 && <span>ARS {fmtNum(receivedARS)}</span>}
                          {receivedUSD === 0 && receivedARS === 0 && <span>USD 0</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                        <div className="flex flex-col">
                          {pendingUSD > 0 && <span>USD {fmtNum(pendingUSD)}</span>}
                          {pendingARS > 0 && <span>ARS {fmtNum(pendingARS)}</span>}
                          {pendingUSD === 0 && pendingARS === 0 && <span>USD 0</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="font-black text-[11px] w-9 text-right shrink-0">{Math.round(pct)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              Cronograma del Portafolio de Proyectos
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Cronograma del Portafolio de Proyectos" sub="Distribución temporal de proyectos incluidos en el informe por Año Fiscal y Semestres" />
            
            {timelineData.rows.length === 0 ? (
              <div className="bg-white dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                <p className="text-xs text-slate-400">Seleccioná proyectos para visualizar su distribución temporal.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 shadow-inner">
                <div className="min-w-[950px] relative font-sans">
                  {/* Nivel 1: Años Fiscales */}
                  <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-black text-slate-800 dark:text-white">
                    <div className="sticky left-0 w-[340px] min-w-[340px] bg-slate-50 dark:bg-slate-900 z-30 border-r-2 border-slate-300 dark:border-slate-700 py-2.5 px-3.5 flex items-center justify-between shrink-0 select-none">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Proyecto</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Fechas</span>
                    </div>
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

                  {/* Nivel 2: Semestres */}
                  <div className="flex border-b border-slate-200 dark:border-slate-850 bg-slate-100/70 dark:bg-slate-900/90 text-[11.5px] font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest">
                    <div className="sticky left-0 w-[340px] min-w-[340px] bg-slate-100/70 dark:bg-slate-900/90 z-30 border-r-2 border-slate-300 dark:border-slate-700 shrink-0" />
                    <div className="flex-1 flex min-w-[630px]">
                      {timelineData.periods.map((period, idx) => {
                        const isActive = period.fy === selectedFY && period.half === selectedHalf;
                        return (
                          <div
                            key={idx}
                            className={`py-1.5 text-center border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0 font-black flex items-center justify-center gap-1.5 transition-colors ${
                              isActive 
                              ? 'text-indigo-750 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/40' 
                              : 'text-slate-755 dark:text-slate-300'
                            }`}
                            style={{ width: `${period.width}%`, flexGrow: 0, flexShrink: 0 }}
                          >
                            <span>{period.half}</span>
                            {isActive && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-indigo-600 text-white dark:bg-indigo-500 shadow-sm border border-indigo-400/20 shrink-0 animate-pulse">
                                Foco Reporte
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="relative min-h-[100px] flex flex-col">
                    {/* Grilla Vertical de Fondo */}
                    <div className="absolute inset-0 flex pointer-events-none z-0">
                      <div className="w-[340px] min-w-[340px] border-r-2 border-slate-300 dark:border-slate-700 shrink-0 bg-transparent" />
                      <div className="flex-1 flex min-w-[630px] relative h-full">
                        {timelineData.periods.map((period, idx) => {
                          const isActive = period.fy === selectedFY && period.half === selectedHalf;
                          return (
                            <div
                              key={idx}
                              className={`h-full border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0 transition-colors ${
                                isActive ? 'bg-indigo-100/30 dark:bg-indigo-900/10' : ''
                              }`}
                              style={{ width: `${period.width}%`, flexGrow: 0, flexShrink: 0 }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Filas */}
                    <div className="relative z-10 flex flex-col divide-y divide-slate-150 dark:divide-slate-850/60 bg-transparent">
                      {timelineData.rows.map((row, idx) => {
                        const startStr = formatDate(row.start.toISOString().split('T')[0]);
                        const endStr = formatDate(row.end.toISOString().split('T')[0]);
                        const labelText = row.clientName ? `${row.clientName} - ${row.name}` : row.name;
                        
                        const timelineBaseWidth = 800;
                        const barPixelWidth = (timelineBaseWidth * row.width) / 100;
                        const textPadding = 24;
                        const estimatedTextWidth = labelText.length * 7.2;
                        const isTooNarrow = estimatedTextWidth > Math.max(0, barPixelWidth - textPadding);
                        const gradient = BAR_GRADIENTS[idx % BAR_GRADIENTS.length];

                        return (
                          <div
                            key={row.id}
                            className="flex items-center hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group relative"
                          >
                            {/* Columna Izquierda Sticky */}
                            <div className="sticky left-0 w-[340px] min-w-[340px] bg-white dark:bg-slate-950 px-3.5 py-2.5 z-20 border-r-2 border-slate-300 dark:border-slate-700 flex flex-col justify-center gap-1 shadow-[4px_0_8px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_8px_rgba(0,0,0,0.5)] shrink-0">
                              <span className="font-black text-[12px] text-slate-950 dark:text-white tracking-wide truncate" title={labelText}>
                                {labelText}
                              </span>
                              <div className="flex flex-nowrap items-center gap-1 text-[9.5px] whitespace-nowrap overflow-x-hidden">
                                <span className="bg-emerald-100/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-250 px-1.5 py-0.5 rounded-md font-black border border-emerald-300/80 dark:border-emerald-800/60 shadow-xs">
                                  Ini: {startStr}
                                </span>
                                <span className="bg-amber-100/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-250 px-1.5 py-0.5 rounded-md font-black border border-amber-300/80 dark:border-amber-800/60 shadow-xs">
                                  Plan: {row.theo ? formatDate(row.theo.toISOString().split('T')[0]) : 'S/D'}
                                </span>
                                <span className="bg-sky-100/90 dark:bg-sky-950/50 text-sky-950 dark:text-sky-250 px-1.5 py-0.5 rounded-md font-black border border-sky-300/80 dark:border-sky-800/60 shadow-xs">
                                  Real: {row.realEndDate ? formatDate(row.realEndDate) : 'En curso'}
                                </span>
                              </div>
                            </div>

                            {/* Columna Derecha: Timeline Bar */}
                            <div className="flex-1 min-w-[630px] relative h-12 flex items-center px-4 z-10">
                              {/* Barra Completa clásica */}
                              <div
                                className={`absolute h-8 rounded-lg bg-gradient-to-r ${gradient} text-white flex items-center justify-center px-3 shadow-sm hover:scale-[1.01] hover:shadow-md transition-all duration-200 select-none cursor-pointer z-10`}
                                style={{ left: `${row.left}%`, width: `${row.widthPlan + row.widthDesvio}%` }}
                                title={`${labelText} (${row.opportunityNumber})\nInicio: ${startStr}\nFin Real/Actual: ${row.realEndDate ? formatDate(row.realEndDate) : 'En curso'}`}
                              >
                                {((timelineBaseWidth * (row.widthPlan + row.widthDesvio)) / 100) > (labelText.length * 7.2 + 24) ? (
                                  <span className="text-[11px] font-black truncate tracking-wide px-1 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)]">
                                    {labelText}
                                  </span>
                                ) : (
                                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 whitespace-nowrap text-[11px] font-black text-slate-950 dark:text-white pointer-events-none z-20 bg-white/98 dark:bg-slate-900/98 px-2.5 py-1 rounded-md shadow-md border border-slate-300 dark:border-slate-700 backdrop-blur-xs tracking-wide">
                                    {labelText}
                                  </span>
                                )}
                                
                                {row.relativeTheoLeft !== null && (
                                  <div
                                    className="absolute top-0 bottom-0 w-0 border-l border-dashed border-white/70 z-15 pointer-events-none"
                                    style={{ left: `${row.relativeTheoLeft}%` }}
                                  >
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-300 rotate-45 border border-white" title={`Fecha Planificada: ${row.theo ? formatDate(row.theo.toISOString().split('T')[0]) : ''}`} />
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
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 3 — Cronograma de Desvíos Temporales
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Cronograma de Desvíos Temporales por Proyecto" sub="Línea de tiempo detallada con desglose de la duración planificada original vs. desvío (atraso) real en rojo" />
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs mb-4">
              <p className="text-[11px] text-slate-400 mb-5 italic">
                Interpretación: La barra de color representa la duración planificada original. La extensión roja a la derecha representa el desvío/retraso real acumulado (+días).
              </p>

              {timelineData.rows.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Seleccioná proyectos para visualizar la línea de desvíos.
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 shadow-inner">
                  <div className="min-w-[950px] relative font-sans">
                    {/* Años Fiscales */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-black text-slate-800 dark:text-white">
                      <div className="sticky left-0 w-[340px] min-w-[340px] bg-slate-50 dark:bg-slate-900 z-30 border-r-2 border-slate-300 dark:border-slate-700 py-2.5 px-3.5 flex items-center justify-between shrink-0 select-none">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Proyecto</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Fechas</span>
                      </div>
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

                    {/* Semestres */}
                    <div className="flex border-b border-slate-200 dark:border-slate-850 bg-slate-100/70 dark:bg-slate-900/90 text-[11.5px] font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest">
                      <div className="sticky left-0 w-[340px] min-w-[340px] bg-slate-100/70 dark:bg-slate-900/90 z-30 border-r-2 border-slate-300 dark:border-slate-700 shrink-0" />
                      <div className="flex-1 flex min-w-[630px]">
                        {timelineData.periods.map((period, idx) => {
                          const isActive = period.fy === selectedFY && period.half === selectedHalf;
                          return (
                            <div
                              key={idx}
                              className={`py-1.5 text-center border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0 font-black flex items-center justify-center gap-1.5 transition-colors ${
                                isActive 
                                ? 'text-indigo-750 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/40' 
                                : 'text-slate-755 dark:text-slate-300'
                              }`}
                              style={{ width: `${period.width}%`, flexGrow: 0, flexShrink: 0 }}
                            >
                              <span>{period.half}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Contenido / Filas */}
                    <div className="relative min-h-[100px] flex flex-col">
                      <div className="absolute inset-0 flex pointer-events-none z-0">
                        <div className="w-[340px] min-w-[340px] border-r-2 border-slate-300 dark:border-slate-700 shrink-0 bg-transparent" />
                        <div className="flex-1 flex min-w-[630px] relative h-full">
                          {timelineData.periods.map((period, idx) => (
                            <div
                              key={idx}
                              className="h-full border-r-2 border-slate-300 dark:border-slate-700 last:border-r-0"
                              style={{ width: `${period.width}%`, flexGrow: 0, flexShrink: 0 }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-col divide-y divide-slate-150 dark:divide-slate-850/60 bg-transparent">
                        {timelineData.rows.map((row, idx) => {
                          const startStr = formatDate(row.start.toISOString().split('T')[0]);
                          const labelText = row.clientName ? `${row.clientName} - ${row.name}` : row.name;
                          const gradient = BAR_GRADIENTS[idx % BAR_GRADIENTS.length];
                          const timelineBaseWidth = 800;
                          
                          return (
                            <div
                              key={row.id}
                              className="flex items-center hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group relative"
                            >
                              {/* Izquierda Sticky */}
                              <div className="sticky left-0 w-[340px] min-w-[340px] bg-white dark:bg-slate-950 px-3.5 py-2.5 z-20 border-r-2 border-slate-300 dark:border-slate-700 flex flex-col justify-center gap-1 shadow-[4px_0_8px_rgba(0,0,0,0.03)] dark:shadow-[4px_0_8px_rgba(0,0,0,0.5)] shrink-0">
                                <span className="font-black text-[12px] text-slate-950 dark:text-white tracking-wide truncate" title={labelText}>
                                  {labelText}
                                </span>
                                <div className="flex flex-nowrap items-center gap-1 text-[9.5px] whitespace-nowrap overflow-x-hidden">
                                  <span className="bg-emerald-100/90 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-250 px-1.5 py-0.5 rounded-md font-black border border-emerald-300/80 dark:border-emerald-800/60 shadow-xs">
                                    Ini: {startStr}
                                  </span>
                                  <span className="bg-amber-100/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-250 px-1.5 py-0.5 rounded-md font-black border border-amber-300/80 dark:border-amber-800/60 shadow-xs">
                                    Plan: {row.theo ? formatDate(row.theo.toISOString().split('T')[0]) : 'S/D'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-md font-black shadow-xs ${row.hasDesvio ? 'bg-red-100 dark:bg-red-950 text-red-750 dark:text-red-300 border border-red-300 dark:border-red-800' : 'bg-sky-100/90 dark:bg-sky-950/50 text-sky-950 dark:text-sky-250 border border-sky-300/80'}`}>
                                    {row.hasDesvio ? `Fin: ${row.realEndDate ? formatDate(row.realEndDate) : 'En curso'} (+${row.desvioDays}d)` : `Fin: ${row.realEndDate ? formatDate(row.realEndDate) : 'En curso'}`}
                                  </span>
                                </div>
                              </div>
                              {/* Derecha: Barra Planificada + Barra de Desvío */}
                              <div className="flex-1 min-w-[630px] relative h-12 flex items-center px-4 z-10">
                                {/* Barra Planificada */}
                                <div
                                  className={`absolute h-8 rounded-lg bg-gradient-to-r ${gradient} text-white flex items-center justify-center px-2.5 shadow-sm hover:scale-[1.01] hover:shadow-md transition-all duration-200 select-none cursor-pointer z-10`}
                                  style={{ left: `${row.left}%`, width: `${row.widthPlan}%` }}
                                  title={`${labelText}\nInicio: ${startStr}\nFin Planificado: ${row.theo ? formatDate(row.theo.toISOString().split('T')[0]) : ''}`}
                                >
                                  <span className="text-[11px] font-black truncate tracking-wide drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)] w-full text-center">
                                    {labelText}
                                  </span>
                                </div>

                                {/* Barra de Desvío (si aplica) */}
                                {row.hasDesvio && (
                                  <div
                                    className="absolute h-8 rounded-lg bg-gradient-to-r from-red-500/80 to-rose-600/90 text-white flex items-center justify-center border border-red-500/40 shadow-xs z-9 cursor-pointer select-none"
                                    style={{ left: `${row.leftDesvio}%`, width: `${row.widthDesvio}%` }}
                                    title={`Desvío Temporal: +${row.desvioDays} días`}
                                  >
                                    <span className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md border border-rose-500 shadow-sm whitespace-nowrap z-25">
                                      +{row.desvioDays}d
                                    </span>
                                  </div>
                                )}
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
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 4 — Gráfico: Controles de Cambio
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Controles de Cambio por Proyecto" sub="Cantidad total de solicitudes de cambio registradas · Ordenado de mayor a menor" />
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div style={{ height: chartH }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={cambiosData} margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={250} tick={{ fontSize: 10, fontWeight: 700 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                      formatter={(v: any, _: any, p: any) => [`${v} cambios`, p.payload.fullName]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 5, 5, 0]} maxBarSize={36}>
                      <LabelList
                        dataKey="count"
                        content={props => renderCustomLabel(props)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 5 — Gráfico: Desvío Económico (USD)
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Desvío Económico por Proyecto (USD)" sub="Costo Real − Presupuesto · Rojo = sobrecosto · Verde = remanente · Ordenado de mayor a menor" />
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div style={{ height: chartH }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={desvioEconomicoData} margin={{ top: 0, right: 130, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v >= 0 ? '' : '-'}${fmtNum(v)}`} />
                    <YAxis type="category" dataKey="name" width={250} tick={{ fontSize: 10, fontWeight: 700 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                      formatter={(v: any, _: any, p: any) => [fmtUSD(v), p.payload.fullName]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Bar dataKey="deviation" radius={[0, 5, 5, 0]} maxBarSize={36}>
                      {desvioEconomicoData.map((e, i) => (
                        <Cell key={i} fill={e.deviation > 0 ? '#f43f5e' : '#10b981'} />
                      ))}
                      <LabelList
                        dataKey="deviation"
                        content={props => renderCustomLabel(props, fmtUSD)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 6 — Clasificación Temporal
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Clasificación Temporal de Proyectos" sub={`Análisis respecto al período ${fyLabel} ${selectedHalf} (${periodLabel})`} />
            <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              {[
                { label: 'Preexistentes', sub: 'Inicio anterior al período', color: 'indigo' as const, items: groups.preexistentes, endField: 'fin teórico o real' },
                { label: 'Iniciados en el Período', sub: `Nuevos entre ${periodLabel}`, color: 'emerald' as const, items: groups.nuevos, endField: 'fin teórico o real' },
                { label: 'Finalizados en el Período', sub: 'Cerrados dentro del semestre', color: 'sky' as const, items: groups.finalizados, endField: 'fin real' },
                { label: 'Continúan al Siguiente Período', sub: 'Activos al finalizar el semestre', color: 'amber' as const, items: groups.continuan, endField: 'próxima fecha de cierre' },
              ].map((g, gi) => g.items.length > 0 && (
                <div key={gi}>
                  <h4 className={`text-xs font-black uppercase tracking-widest mb-2.5 flex items-center gap-2 text-${g.color}-600 dark:text-${g.color}-400`}>
                    <span className={`w-2.5 h-2.5 rounded-full bg-${g.color}-500 shrink-0`}></span>
                    {g.label}
                    <span className="font-black text-[10px] text-slate-400 normal-case tracking-normal ml-1">({g.items.length} proyecto{g.items.length !== 1 ? 's' : ''})</span>
                  </h4>
                  <div className={`pl-4 border-l-2 border-${g.color}-200 dark:border-${g.color}-900 grid grid-cols-1 md:grid-cols-2 gap-2`}>
                    {g.items.map(p => {
                      const endDate = p.realEndDate ? formatDate(p.realEndDate) : (p.theoreticalEndDate ? formatDate(p.theoreticalEndDate) : 'S/D');
                      const endLabel = p.realEndDate ? 'Fin Real' : 'Fin Plan';
                      return (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-xs gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-white truncate">{fullLabel(p)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Ini: {formatDate(p.startDate)} | {endLabel}: {endDate}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 7 — Control de Costos por PEP
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Control de Costos por PEP" sub="Presupuesto vs. consumido real vs. disponible · Sin paginación — todos los proyectos y categorías visibles" />
            <div className="space-y-5">
              {selectedProjects.map(p => {
                const pe = expenses.filter(e => e.projectId === p.id);
                const sane = getProjectSaneCosts(p.id, p.budget);
                return (
                  <div key={p.id} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-white">
                          {fullLabel(p)} {sane.hasNegativePep && <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/40 px-2 py-0.5 rounded ml-1.5 font-black uppercase tracking-wider animate-pulse">⚠️ ALERTA SALDO NEGATIVO</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PM: {p.pm || 'S/D'}</p>
                      </div>
                      <div className="flex gap-5 text-right shrink-0">
                        {[
                          { l: 'Presupuesto', v: `USD ${fmtNum(sane.budget)}`, cls: '' },
                          { l: 'Consumido (Saneado)', v: `USD ${fmtNum(sane.consumed)}`, cls: '' },
                          { l: 'Disponible', v: `${sane.deviation < 0 ? '-' : ''}USD ${fmtNum(Math.abs(sane.budget - sane.consumed))}`, cls: (sane.budget - sane.consumed) < 0 ? 'text-red-600' : 'text-emerald-600' },
                        ].map((x, i) => (
                          <div key={i}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{x.l}</p>
                            <p className={`text-sm font-black ${x.cls || 'text-slate-700 dark:text-white'}`}>{x.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-950/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-850">
                          <th className="px-5 py-2.5">Código PEP</th>
                          <th className="px-5 py-2.5">Categoría</th>
                          <th className="px-5 py-2.5 text-right">Presupuesto</th>
                          <th className="px-5 py-2.5 text-right">Consumido SAP</th>
                          <th className="px-5 py-2.5 text-right">Disponible</th>
                          <th className="px-5 py-2.5 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                        {COST_CATEGORIES.map(cat => {
                          const bud = p.budget?.[cat] || 0;
                          // Valor neto real acumulado de SAP
                          const con = pe.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
                          const isNegativePep = con < 0;
                          
                          // Si es negativo, el disponible es el presupuesto completo (no resta nada)
                          const avail = isNegativePep ? bud : (bud - con);
                          const over = avail < 0;
                          return (
                            <tr key={cat} className={`hover:bg-slate-50/30 dark:hover:bg-slate-900/20 ${isNegativePep ? 'bg-red-50/20 dark:bg-red-950/5' : ''}`}>
                              <td className="px-5 py-2.5 font-mono font-bold text-slate-500 dark:text-slate-400">{getPepCode(p.opportunityNumber, cat)}</td>
                              <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{cat.replace(/^\d+-\s*/, '')}</td>
                              <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-400">USD {fmtNum(bud)}</td>
                              <td className={`px-5 py-2.5 text-right font-bold ${isNegativePep ? 'text-red-650' : 'text-slate-600 dark:text-slate-400'}`}>
                                {isNegativePep ? `-USD ${fmtNum(Math.abs(con))} ⚠️` : `USD ${fmtNum(con)}`}
                              </td>
                              <td className={`px-5 py-2.5 text-right font-bold ${over ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {over ? '-' : ''}USD {fmtNum(Math.abs(avail))}
                              </td>
                              <td className="px-5 py-2.5 text-center">
                                {isNegativePep ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-450 uppercase tracking-wider">
                                    ⚠️ SALDO NEGATIVO
                                  </span>
                                ) : over ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 uppercase tracking-wider">
                                    <i className="fas fa-exclamation-triangle"></i> Desvío
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 uppercase tracking-wider">
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════
              BLOQUE 8 — Historial de Desvíos y Justificaciones
          ════════════════════════════════════════════════ */}
          <section>
            <SectionTitle label="Historial de Desvíos y Justificaciones" sub="Corrimientos de fecha de cierre con controles de cambio asociados como justificación formal" />
            <div className="space-y-5">
              {selectedProjects.filter(p => (p.dateChangeHistory || []).length > 0).length === 0
                ? (
                  <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-400">
                    Ningún proyecto seleccionado registra historial de corrimientos de fecha.
                  </div>
                )
                : selectedProjects.filter(p => (p.dateChangeHistory || []).length > 0).map(p => (
                  <div key={p.id} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="font-black text-sm text-slate-800 dark:text-white">{fullLabel(p)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PM: {p.pm || 'S/D'}</p>
                      </div>
                      <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md shrink-0">
                        {p.dateChangeHistory?.length} corrimiento{(p.dateChangeHistory?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-900">
                      {p.dateChangeHistory
                        ?.slice()
                        .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
                        .map((entry, idx) => {
                          const related = changes.filter(c => entry.changeIds.includes(c.id));
                          const devDays = entry.previousDate
                            ? Math.round((new Date(entry.newDate).getTime() - new Date(entry.previousDate).getTime()) / 86400000)
                            : null;
                          return (
                            <div key={entry.id} className="px-5 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">#{idx + 1}</span>
                                  <span className="text-[11px] font-mono bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded border border-red-200/60 dark:border-red-900/30">
                                    {entry.previousDate ? formatDate(entry.previousDate) : 'Fecha original'}
                                  </span>
                                  <i className="fas fa-long-arrow-alt-right text-slate-400 text-xs"></i>
                                  <span className="text-[11px] font-mono bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-900/30">
                                    {formatDate(entry.newDate)}
                                  </span>
                                  {devDays !== null && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${devDays > 0 ? 'text-red-600 bg-red-50 dark:bg-red-950/20' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'}`}>
                                      {devDays > 0 ? `+${devDays}` : devDays} días
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">Registrado: {formatDate(entry.changedAt)}</span>
                              </div>

                              <div className="ml-7">
                                {related.length > 0 ? (
                                  <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Controles de Cambio Justificativos:</p>
                                    <div className="space-y-2">
                                      {related.map(c => (
                                        <div key={c.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                                          <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">Reg: {c.registrationNumber || 'S/N'}</span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${c.type === 'Facturable' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                              {c.type}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">"{c.description}"</p>
                                          <p className="text-[9px] text-slate-400 mt-1">Fecha del control: {formatDate(c.date)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/10 border border-amber-200/60 dark:border-amber-900/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                    <i className="fas fa-exclamation-circle shrink-0"></i>
                                    <span>Sin control de cambio formal asociado a esta reprogramación de fecha.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))
              }
            </div>
          </section>

        </>
      )}
    </div>
  );
};

// ─── Componente auxiliar SectionTitle ─────────────────────────────────────────
const SectionTitle: React.FC<{ label: string; sub: string }> = ({ label, sub }) => (
  <div className="mb-3">
    <h2 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{label}</h2>
    <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
  </div>
);
