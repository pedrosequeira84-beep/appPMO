
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

const MainLayout: React.FC = () => {
    const { currentView, user } = useApp();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (!user) {
        return <AuthView />;
    }

    const renderView = () => {
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
            default: return <DashboardView />;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar mobileOpen={mobileOpen} toggleMobile={() => setMobileOpen(!mobileOpen)} />
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-dark-bg transition-colors duration-200">
                <header className="md:hidden bg-white dark:bg-dark-card border-b dark:border-dark-border p-4 flex justify-between items-center z-20">
                    <span className="font-bold text-lg dark:text-white">PMO BGH TP</span>
                    <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-600 dark:text-gray-300"><i className="fas fa-bars fa-lg"></i></button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
                    {renderView()}
                </div>
            </main>
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
