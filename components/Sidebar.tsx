import React from 'react';
import { useApp } from '../AppContext';
import { ViewName } from '../types';

interface SidebarProps {
  mobileOpen: boolean;
  toggleMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, toggleMobile }) => {
  const { currentView, setCurrentView, darkMode, toggleDarkMode, signOut, user } = useApp();
  const isAdmin = user?.email?.toLowerCase() === 'pedro.sequeira@bghtechpartner.com';
  const [dashboardsOpen, setDashboardsOpen] = React.useState(true);

  const navItemClass = (view: ViewName) => `w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-left ${currentView === view ? 'bg-slate-800 text-white border-l-4 border-blue-500' : 'text-slate-300'
    }`;

  const subNavItemClass = (view: ViewName) => `w-full flex items-center gap-4 pl-12 pr-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left text-sm ${currentView === view ? 'bg-slate-800/50 text-blue-400 font-bold' : 'text-slate-400'
    }`;

  const handleNav = (view: ViewName) => {
    setCurrentView(view);
    if (window.innerWidth < 768) toggleMobile();
  };

  return (
    <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 z-30 flex flex-col shadow-xl transition-transform duration-300 ease-in-out`}>
      <div className="p-6 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <i className="fas fa-cubes fa-2x text-blue-500"></i>
          <span className="text-xl font-bold tracking-wider">PMO BGH TP</span>
        </div>
        <button className="md:hidden text-gray-400 hover:text-white" onClick={toggleMobile}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-4">
          <li>
            <button
              onClick={() => setDashboardsOpen(!dashboardsOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-left ${currentView.startsWith('dashboard') ? 'text-white' : 'text-slate-300'}`}
            >
              <div className="flex items-center gap-4">
                <i className="fas fa-chart-line w-6 text-center text-yellow-500"></i>
                <span>Dashboards</span>
              </div>
              <i className={`fas fa-chevron-${dashboardsOpen ? 'down' : 'right'} text-[10px] text-slate-500`}></i>
            </button>
            {dashboardsOpen && (
              <ul className="mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                <li>
                  <button onClick={() => handleNav('dashboard-pmo')} className={subNavItemClass('dashboard-pmo')}>
                    <span>Dashboard PMO</span>
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNav('dashboard-ejecutivo')} className={subNavItemClass('dashboard-ejecutivo')}>
                    <span>Dashboard Ejecutivo</span>
                  </button>
                </li>
              </ul>
            )}
          </li>
          <li><button onClick={() => handleNav('alta-proyecto')} className={navItemClass('alta-proyecto')}>
            <i className="fas fa-project-diagram w-6 text-center text-indigo-400"></i><span>Proyectos & Kanban</span>
          </button></li>
          <li><button onClick={() => handleNav('gastos')} className={navItemClass('gastos')}>
            <i className="fas fa-wallet w-6 text-center text-emerald-400"></i><span>Control de Costos</span>
          </button></li>
          <li><button onClick={() => handleNav('hitos')} className={navItemClass('hitos')}>
            <i className="fas fa-file-invoice-dollar w-6 text-center text-green-400"></i><span>Hitos Facturables</span>
          </button></li>
          <li><button onClick={() => handleNav('capacity')} className={navItemClass('capacity')}>
            <i className="fas fa-users w-6 text-center text-purple-400"></i><span>Capacity Plan</span>
          </button></li>
          <li><button onClick={() => handleNav('riesgos')} className={navItemClass('riesgos')}>
            <i className="fas fa-exclamation-triangle w-6 text-center text-red-400"></i><span>Gestión Riesgos</span>
          </button></li>
          <li><button onClick={() => handleNav('cambios')} className={navItemClass('cambios')}>
            <i className="fas fa-exchange-alt w-6 text-center text-blue-400"></i><span>Control Cambios</span>
          </button></li>
          <li><button onClick={() => handleNav('lecciones')} className={navItemClass('lecciones')}>
            <i className="fas fa-lightbulb w-6 text-center text-yellow-300"></i><span>Lecciones Aprendidas</span>
          </button></li>
          <li><button onClick={() => handleNav('documentation')} className={navItemClass('documentation')}>
            <i className="fas fa-folder-open w-6 text-center text-blue-400"></i><span>Documentación PMO</span>
          </button></li>
          {isAdmin && (
            <li><button onClick={() => handleNav('team-management')} className={navItemClass('team-management')}>
              <i className="fas fa-users-cog w-6 text-center text-cyan-400"></i><span>Gestión Recursos</span>
            </button></li>
          )}
          <li className="mt-6 pt-6 border-t border-slate-700/50"><button onClick={() => handleNav('perfil')} className={navItemClass('perfil')}>
            <i className="fas fa-user-cog w-6 text-center text-gray-400"></i><span>Ajustes de Perfil</span>
          </button></li>
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-400">Modo Oscuro</span>
          <button onClick={toggleDarkMode} className="w-12 h-6 rounded-full bg-slate-700 flex items-center transition-colors focus:outline-none ring-2 ring-transparent focus:ring-blue-500">
            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`}></div>
          </button>
        </div>
        <button onClick={() => window.location.reload()} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors mb-2" onMouseDown={async (e) => {
          e.preventDefault();
          await signOut();
        }}>
          <i className="fas fa-sign-out-alt mr-2"></i> Cerrar Sesión
        </button>
        <p className="text-xs text-center text-slate-500">PMO BGH TP</p>
      </div>
    </aside>
  );
};

export default Sidebar;
