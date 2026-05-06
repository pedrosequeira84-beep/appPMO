import React, { useMemo } from 'react';
import { useApp } from '../AppContext';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const DashboardEjecutivoView: React.FC = () => {
    const { projects, executiveFilters, setExecutiveFilters } = useApp();

    // Global filters from context
    const activeFilters = executiveFilters;

    const resetFilters = () => {
        setExecutiveFilters({
            status: null,
            vendor: null,
            vertical: null,
            segment: null
        });
    };

    // Filter projects based on selection
    const filteredProjects = useMemo(() => {
        const allowedStatuses = ['En ejecución', 'Soporte'];
        return projects.filter(p => {
            // Initial filter: only Execution and Support
            if (!allowedStatuses.includes(p.status)) return false;

            if (activeFilters.status && p.status !== activeFilters.status) return false;

            if (activeFilters.vertical) {
                const projectVertical = p.vertical || 'Sin Vertical';
                if (projectVertical !== activeFilters.vertical) return false;
            }

            if (activeFilters.segment) {
                const projectSegment = p.segment || 'Sin Segmento';
                if (projectSegment !== activeFilters.segment) return false;
            }

            if (activeFilters.vendor) {
                if (activeFilters.vendor === 'Sin Vendor') {
                    if (p.vendors && p.vendors.length > 0) return false;
                } else {
                    if (!p.vendors || !p.vendors.includes(activeFilters.vendor)) return false;
                }
            }
            return true;
        });
    }, [projects, activeFilters]);

    // --- Chart Data Calculations ---

    // 1. Status Data
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        // Use all projects to calculate base distribution?
        // Actually cross-filtering usually means the other charts update.
        // If I use filteredProjects, clicking one chart filters others. That's what was requested.
        filteredProjects.forEach(p => {
            counts[p.status] = (counts[p.status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredProjects]);

    // 2. Vendor Data
    const vendorData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredProjects.forEach(p => {
            const vendors = p.vendors && p.vendors.length > 0 ? p.vendors : ['Sin Vendor'];
            vendors.forEach(v => {
                counts[v] = (counts[v] || 0) + 1;
            });
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredProjects]);

    // 3. Vertical Data
    const verticalData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredProjects.forEach(p => {
            const v = p.vertical || 'Sin Vertical';
            counts[v] = (counts[v] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredProjects]);

    // 4. Segment Data
    const segmentData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredProjects.forEach(p => {
            const s = p.segment || 'Sin Segmento';
            counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredProjects]);

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#475569'];

    const handlePieClick = (type: keyof typeof activeFilters, data: any) => {
        const value = data.name;
        // Toggle logic
        setExecutiveFilters(prev => ({
            ...prev,
            [type]: prev[type] === value ? null : value
        }));
    };

    const FilterBadge = ({ label, type, value }: { label: string, type: keyof typeof activeFilters, value: string }) => (
        <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-indigo-200 dark:border-indigo-800 animate-in zoom-in-50 duration-200">
            <span>{label}: <strong>{value}</strong></span>
            <button onClick={() => setExecutiveFilters(prev => ({ ...prev, [type]: null }))} className="hover:text-indigo-900 dark:hover:text-white transition-colors">
                <i className="fas fa-times-circle"></i>
            </button>
        </div>
    );

    return (
        <div className="fade-in pb-10">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard Ejecutivo</h2>
                    <p className="text-gray-500 dark:text-gray-400">Vista consolidada de proyectos en estado <strong>En ejecución</strong> y <strong>Soporte</strong></p>
                </div>
                {Object.values(activeFilters).some(v => v !== null) && (
                    <button
                        onClick={resetFilters}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm hover:bg-slate-300 transition-colors flex items-center gap-2"
                    >
                        <i className="fas fa-filter-slash"></i> Limpiar Filtros
                    </button>
                )}
            </div>

            {/* Active Filters Display */}
            <div className="flex flex-wrap gap-2 mb-6 min-h-[32px]">
                {activeFilters.status && <FilterBadge label="Estado" type="status" value={activeFilters.status} />}
                {activeFilters.vendor && <FilterBadge label="Vendor" type="vendor" value={activeFilters.vendor} />}
                {activeFilters.vertical && <FilterBadge label="Vertical" type="vertical" value={activeFilters.vertical} />}
                {activeFilters.segment && <FilterBadge label="Segmento" type="segment" value={activeFilters.segment} />}
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Proyectos Filtrados</p>
                    <p className="text-3xl font-bold dark:text-white">{filteredProjects.length}</p>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Venta Total (Filtrada)</p>
                    <p className="text-3xl font-bold dark:text-white">
                        USD {(filteredProjects.reduce((sum, p) => sum + (p.hwValue || 0) + (p.servicesValue || 0), 0)).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
                    <p className="text-sm text-gray-500 dark:text-gray-400">CM Promedio (Filtrado)</p>
                    <p className="text-3xl font-bold dark:text-white">
                        {filteredProjects.length > 0
                            ? (filteredProjects.reduce((sum, p) => sum + (p.cm || 0), 0) / filteredProjects.length).toFixed(1)
                            : 0}%
                    </p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 1. Project Status Chart */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-[350px]">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Distribución por Estado</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={80}
                                paddingAngle={5} dataKey="value"
                                onClick={(data) => handlePieClick('status', data)}
                                cursor="pointer"
                            >
                                {statusData.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke={activeFilters.status === _entry.name ? '#000' : 'none'}
                                        strokeWidth={activeFilters.status === _entry.name ? 3 : 1}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Vendor Chart */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-[350px]">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Distribución por Vendor</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie
                                data={vendorData}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={80}
                                paddingAngle={5} dataKey="value"
                                onClick={(data) => handlePieClick('vendor', data)}
                                cursor="pointer"
                            >
                                {vendorData.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke={activeFilters.vendor === _entry.name ? '#000' : 'none'}
                                        strokeWidth={activeFilters.vendor === _entry.name ? 3 : 1}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 3. Vertical Chart */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-[350px]">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Distribución por Vertical</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie
                                data={verticalData}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={80}
                                paddingAngle={5} dataKey="value"
                                onClick={(data) => handlePieClick('vertical', data)}
                                cursor="pointer"
                            >
                                {verticalData.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke={activeFilters.vertical === _entry.name ? '#000' : 'none'}
                                        strokeWidth={activeFilters.vertical === _entry.name ? 3 : 1}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 4. Segment Chart */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-[350px]">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Distribución por Segmento</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie
                                data={segmentData}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={80}
                                paddingAngle={5} dataKey="value"
                                onClick={(data) => handlePieClick('segment', data)}
                                cursor="pointer"
                            >
                                {segmentData.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke={activeFilters.segment === _entry.name ? '#000' : 'none'}
                                        strokeWidth={activeFilters.segment === _entry.name ? 3 : 1}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Projects List Table */}
            <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
                    <h3 className="text-lg font-bold dark:text-white">Listado de Proyectos Filtrados</h3>
                    <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg text-xs font-bold">
                        {filteredProjects.length} proyectos encontrados
                    </span>
                </div>
                <div className="overflow-x-auto min-h-[200px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/50">
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Proyecto</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Vertical</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Vendors</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Venta (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                            {filteredProjects.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-sm dark:text-white">{p.name}</p>
                                        <p className="text-[10px] text-gray-400 font-mono">{p.opportunityNumber}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm dark:text-gray-300">{p.clientName}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded-full text-[10px] whitespace-nowrap inline-flex items-center justify-center font-bold ${p.status === 'En ejecución' ? 'bg-green-100 text-green-700' :
                                            p.status === 'Intervención temprana' ? 'bg-blue-100 text-blue-700' :
                                                p.status === 'Soporte' ? 'bg-amber-100 text-amber-700' :
                                                    p.status === 'POC' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-gray-100 text-gray-700'
                                            }`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm dark:text-gray-300">{p.vertical || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {p.vendors?.map(v => (
                                                <span key={v} className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] dark:text-gray-300">
                                                    {v}
                                                </span>
                                            )) || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono font-bold dark:text-indigo-400">
                                        ${((p.hwValue || 0) + (p.servicesValue || 0)).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {filteredProjects.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic">
                                        No hay proyectos que coincidan con los filtros seleccionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
