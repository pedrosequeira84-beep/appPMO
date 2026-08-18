
import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import Sidebar from './components/Sidebar';
import { DashboardView } from './views/Dashboard';
import { DashboardEjecutivoView } from './views/DashboardEjecutivo';
import { ProjectsView } from './views/Projects';
import { CostsView } from './views/Costs';
import { CapacityView } from './views/Capacity';
import { AuthView } from './views/Auth';
import { LessonsLearnedView } from './views/LessonsLearned';
import { RisksView } from './views/Risks';
import { ChangesView } from './views/Changes';
import { HitosView } from './views/Hitos';
import { ProfileView } from './views/Profile';
import { DocumentationView } from './views/Documentation';
import { TeamManagementView } from './views/TeamManagement';
import { CierreFiscalView } from './views/CierreFiscal';
import { OperacionesSDView } from './views/OperacionesSD';
import AIChatBot from './components/AIChatBot';
import { formatDate } from './utils/helpers';

const MainLayout: React.FC = () => {
    const { currentView, setCurrentView, user, currentUserMember, projects, risks, changes } = useApp();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [lastCheckedNotif, setLastCheckedNotif] = useState<string>(() => {
        return localStorage.getItem('pmo_last_checked_notif') || new Date(0).toISOString();
    });
    const notifWrapperRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (notifWrapperRef.current && !notifWrapperRef.current.contains(e.target as Node)) {
                setNotificationsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Generar feeds de cambios recientes. Declarado antes del `if (!user)` para no violar
    // las Rules of Hooks (un hook no puede quedar detrás de un return condicional).
    const systemNotifications = React.useMemo(() => {
        const list: Array<{ id: string; type: 'change' | 'risk' | 'comment'; message: string; date: string; title: string; linkView: string }> = [];

        // 1. Changes
        changes.forEach(c => {
            const proj = projects.find(p => p.id === c.projectId);
            list.push({
                id: `change-${c.id}`,
                type: 'change',
                title: 'Control de Cambio',
                message: `Proyecto "${proj?.name || 'Desconocido'}": ${c.description} (Reg: ${c.registrationNumber || 'S/N'})`,
                date: c.date || c.createdAt || '',
                linkView: 'cambios'
            });
        });

        // 2. Risks
        risks.forEach(r => {
            const proj = projects.find(p => p.id === r.projectId);
            list.push({
                id: `risk-${r.id}`,
                type: 'risk',
                title: `Alerta de Riesgo [${r.impact}]`,
                message: `Proyecto "${proj?.name || 'Desconocido'}": ${r.description}`,
                date: r.date || r.createdAt || '',
                linkView: 'riesgos'
            });
        });

        // 3. Status History Updates (PMO y Técnicos)
        projects.forEach(p => {
            if (p.statusHistory) {
                p.statusHistory.forEach(h => {
                    list.push({
                        id: `comment-${h.id}`,
                        type: 'comment',
                        title: `Update ${h.type || 'PMO'}`,
                        message: `Proyecto "${p.name}": "${h.status}"`,
                        date: h.createdAt || '',
                        linkView: 'alta-proyecto'
                    });
                });
            }
        });

        // Ordenar del más reciente al más antiguo
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [projects, risks, changes]);

    if (!user) {
        return <AuthView />;
    }

    const isAdmin = user?.email?.toLowerCase() === 'pedro.sequeira@bghtechpartner.com';
    const isExternal = !!currentUserMember?.isExternal;

    const renderView = () => {
        // Los usuarios externos (clientes) solo pueden ver Operaciones S&D y su perfil.
        if (isExternal) {
            return currentView === 'perfil' ? <ProfileView /> : <OperacionesSDView />;
        }
        switch (currentView) {
            case 'dashboard-pmo': return <DashboardView />;
            case 'dashboard-ejecutivo': return <DashboardEjecutivoView />;
            case 'alta-proyecto': return <ProjectsView />;
            case 'gastos': return <CostsView />;
            case 'hitos': return <HitosView />;
            case 'capacity': return <CapacityView />;
            case 'riesgos': return <RisksView />;
            case 'cambios': return <ChangesView />;
            case 'lecciones': return <LessonsLearnedView />;
            case 'documentation': return <DocumentationView />;
            case 'perfil': return <ProfileView />;
            case 'team-management': return <TeamManagementView />;
            case 'cierre-fiscal': return isAdmin ? <CierreFiscalView /> : <DashboardView />;
            case 'operaciones-sd': return <OperacionesSDView />;
            default: return <DashboardView />;
        }
    };

    const viewMeta = (() => {
        switch (currentView) {
            case 'dashboard-pmo': return { title: 'Dashboard PMO', category: 'Dashboards' };
            case 'dashboard-ejecutivo': return { title: 'Dashboard Ejecutivo', category: 'Dashboards' };
            case 'alta-proyecto': return { title: 'Proyectos & Kanban', category: 'Proyectos' };
            case 'gastos': return { title: 'Control de Costos', category: 'Proyectos' };
            case 'hitos': return { title: 'Hitos Facturables', category: 'Proyectos' };
            case 'capacity': return { title: 'Capacity Plan', category: 'Recursos' };
            case 'riesgos': return { title: 'Gestión Riesgos', category: 'Proyectos' };
            case 'cambios': return { title: 'Control Cambios', category: 'Proyectos' };
            case 'lecciones': return { title: 'Lecciones Aprendidas', category: 'Proyectos' };
            case 'documentation': return { title: 'Documentación PMO', category: 'General' };
            case 'perfil': return { title: 'Mi Perfil', category: 'Ajustes' };
            case 'team-management': return { title: 'Gestión Recursos', category: 'Admin' };
            case 'cierre-fiscal': return { title: 'Cierre Fiscal', category: 'Admin' };
            case 'operaciones-sd': return { title: 'Operaciones S&D', category: 'Soporte' };
            default: return { title: 'PMO System', category: 'Portal' };
        }
    })();

    const unreadCount = systemNotifications.filter(n => new Date(n.date).getTime() > new Date(lastCheckedNotif).getTime()).length;

    const toggleNotifications = () => {
        setNotificationsOpen(!notificationsOpen);
        if (!notificationsOpen) {
            const nowStr = new Date().toISOString();
            localStorage.setItem('pmo_last_checked_notif', nowStr);
            setLastCheckedNotif(nowStr);
        }
    };

    const handleNotificationClick = (linkView: string) => {
        setCurrentView(linkView as any);
        setNotificationsOpen(false);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-dark-bg font-sans">
            <Sidebar mobileOpen={mobileOpen} toggleMobile={() => setMobileOpen(!mobileOpen)} />
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-dark-bg transition-colors duration-200">
                {/* Global Header Bar */}
                <header className="bg-white dark:bg-dark-card border-b border-slate-100 dark:border-dark-border px-6 py-4 flex justify-between items-center z-20 h-16 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-gray-600 dark:text-gray-300 hover:text-gray-900 mr-2">
                            <i className="fas fa-bars fa-lg"></i>
                        </button>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:block">
                            BGH Tech Partner PMO <span className="mx-1 text-slate-300">/</span> {viewMeta.category} <span className="mx-1 text-slate-300">/</span> <span className="text-brand-cyan font-semibold">{viewMeta.title}</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800 dark:text-white sm:hidden">
                            {viewMeta.title}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {/* Search Mockup */}
                        <div className="relative hidden md:block">
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                className="w-48 bg-slate-50 dark:bg-slate-800/80 border-0 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-cyan/50 dark:text-slate-300"
                            />
                            <i className="fas fa-search absolute left-3.5 top-2.5 text-[10px] text-slate-400"></i>
                        </div>

                        {/* Notifications */}
                        <div className="relative" ref={notifWrapperRef}>
                            <button 
                                onClick={toggleNotifications}
                                className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <i className="far fa-bell text-md"></i>
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
                                )}
                            </button>

                            {notificationsOpen && (
                                <div className="absolute right-0 z-50 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-h-96 overflow-y-auto">
                                    <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
                                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                            Últimos Cambios y Alertas
                                        </span>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] bg-rose-50 dark:bg-rose-950/20 text-rose-500 px-2 py-0.5 rounded-full font-bold">
                                                {unreadCount} nuevos
                                            </span>
                                        )}
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                        {systemNotifications.length === 0 ? (
                                            <p className="p-6 text-xs text-gray-400 italic text-center">Sin actualizaciones registradas.</p>
                                        ) : (
                                            systemNotifications.slice(0, 15).map(n => {
                                                const isUnread = new Date(n.date).getTime() > new Date(lastCheckedNotif).getTime();
                                                let iconClass = 'fa-info-circle text-blue-500';
                                                if (n.type === 'change') iconClass = 'fa-file-signature text-emerald-500';
                                                if (n.type === 'risk') iconClass = 'fa-exclamation-triangle text-amber-500';
                                                if (n.type === 'comment') iconClass = 'fa-comment-alt text-indigo-500';

                                                return (
                                                    <button
                                                        key={n.id}
                                                        onClick={() => handleNotificationClick(n.linkView)}
                                                        className={`w-full text-left flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all ${isUnread ? 'bg-indigo-50/10 dark:bg-indigo-950/10' : ''}`}
                                                    >
                                                        <div className="mt-0.5 w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                                                            <i className={`fas ${iconClass} text-xs`}></i>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate uppercase">
                                                                    {n.title}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                                                                    {formatDate(n.date)}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-normal break-words" title={n.message}>
                                                                {n.message.length > 100 ? n.message.substring(0, 100) + '...' : n.message}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>

                        {/* User Avatar */}
                        <div className="flex items-center gap-2.5">
                            <div className="flex flex-col text-right hidden sm:flex">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                                    {user?.email?.split('@')[0]}
                                </span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                    {isAdmin ? 'PMO Admin' : 'PMO Integrante'}
                                </span>
                            </div>
                            <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-tr from-brand-cyan to-brand-blue flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-dark-card shadow-md">
                                {user?.email?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>
                
                <div className="flex-1 overflow-y-auto p-5 md:p-8 scroll-smooth relative">
                    {renderView()}
                </div>
            </main>
            <AIChatBot />
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <MainLayout />
        </AppProvider>
    );
};

export default App;
