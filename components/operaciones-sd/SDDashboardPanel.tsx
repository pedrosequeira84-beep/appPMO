import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SDDependency, SDTask, SDTimeEntry } from '../../types';
import { isTaskOverdue, computeTaskRisk, computeLeadTimeDays, computeCycleTimeDays, average } from '../../utils/sdHelpers';
import { getWeekKey, getPastWeeksKeys } from '../../utils/helpers';

interface Props {
  tasks: SDTask[];
  timeEntries: SDTimeEntry[];
  dependencies: SDDependency[];
}

const KpiCard: React.FC<{ label: string; value: React.ReactNode; accent: string; icon: string }> = ({ label, value, accent, icon }) => (
  <div className="bg-white dark:bg-dark-card p-6 rounded-[24px] border border-gray-100 dark:border-dark-border shadow-lg shadow-gray-200/5">
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <i className={`fas ${icon} text-sm ${accent}`}></i>
    </div>
    <h4 className={`text-3xl font-black ${accent}`}>{value}</h4>
  </div>
);

const SDDashboardPanel: React.FC<Props> = ({ tasks, timeEntries, dependencies }) => {
  const stats = useMemo(() => {
    const backlog = tasks.filter(t => t.status === 'backlog').length;
    const wip = tasks.filter(t => t.status === 'in_progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(isTaskOverdue).length;
    const blocked = tasks.filter(t => t.blocked).length;
    const vendor = tasks.filter(t => t.vendorSupportRequired).length;

    const tasksById = Object.fromEntries(tasks.map(t => [t.id, t]));
    const critical = tasks.filter(t => t.status !== 'done' && computeTaskRisk(t, dependencies, tasksById).level === 'Crítico').length;

    const leadTimes = tasks.map(computeLeadTimeDays).filter((v): v is number => v !== null);
    const cycleTimes = tasks.map(computeCycleTimeDays).filter((v): v is number => v !== null);

    const today = new Date();
    const weekKey = getWeekKey(today);
    const monthKey = `${today.getFullYear()}-${today.getMonth()}`;

    const hoursWeek = timeEntries
      .filter(e => getWeekKey(new Date(e.date + 'T00:00:00')) === weekKey)
      .reduce((s, e) => s + Number(e.hours), 0);
    const hoursMonth = timeEntries
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
      })
      .reduce((s, e) => s + Number(e.hours), 0);

    return {
      backlog, wip, done, overdue, blocked, vendor, critical, hoursWeek, hoursMonth,
      leadTime: average(leadTimes), cycleTime: average(cycleTimes)
    };
  }, [tasks, timeEntries, dependencies]);

  const weeklyChartData = useMemo(() => {
    const weeks = getPastWeeksKeys(8);
    return weeks.map(wk => ({
      week: wk.split('-W')[1] ? `S${wk.split('-W')[1]}` : wk,
      horas: timeEntries.filter(e => getWeekKey(new Date(e.date + 'T00:00:00')) === wk).reduce((s, e) => s + Number(e.hours), 0)
    }));
  }, [timeEntries]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard label="Backlog" value={stats.backlog} accent="text-gray-500" icon="fa-inbox" />
        <KpiCard label="WIP" value={stats.wip} accent="text-blue-600" icon="fa-spinner" />
        <KpiCard label="Done" value={stats.done} accent="text-emerald-600" icon="fa-check-circle" />
        <KpiCard label="Hs. Semana" value={stats.hoursWeek} accent="text-indigo-600" icon="fa-clock" />
        <KpiCard label="Hs. Mes" value={stats.hoursMonth} accent="text-indigo-600" icon="fa-calendar" />
        <KpiCard label="Vencidas" value={stats.overdue} accent="text-red-500" icon="fa-exclamation-triangle" />
        <KpiCard label="Críticas" value={stats.critical} accent="text-red-600" icon="fa-fire" />
        <KpiCard label="Bloqueadas" value={stats.blocked} accent="text-amber-500" icon="fa-lock" />
        <KpiCard label="Vendor Support" value={stats.vendor} accent="text-purple-600" icon="fa-headset" />
        <KpiCard label="Lead Time" value={`${stats.leadTime}d`} accent="text-cyan-600" icon="fa-hourglass-half" />
        <KpiCard label="Cycle Time" value={`${stats.cycleTime}d`} accent="text-cyan-600" icon="fa-stopwatch" />
      </div>

      <div className="bg-white dark:bg-dark-card p-8 rounded-[32px] border border-gray-100 dark:border-dark-border shadow-lg shadow-gray-200/5">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Horas Cargadas por Semana</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weeklyChartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="horas" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SDDashboardPanel;
