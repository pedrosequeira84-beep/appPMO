import React from 'react';
import { useApp } from '../AppContext';
import { ViewName } from '../types';

interface SidebarProps {
  mobileOpen: boolean;
  toggleMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, toggleMobile }) => {
  const { currentView, setCurrentView, darkMode, toggleDarkMode, signOut, user, currentUserMember } = useApp();
  const isAdmin = user?.email?.toLowerCase() === 'pedro.sequeira@bghtechpartner.com';
  const isExternal = !!currentUserMember?.isExternal;
  const [dashboardsOpen, setDashboardsOpen] = React.useState(true);

  const navItemClass = (view: ViewName) => `w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all text-left text-sm ${currentView === view ? 'bg-gradient-to-r from-brand-cyan to-brand-blue text-white font-semibold shadow-lg shadow-brand-cyan/10' : 'text-slate-300 hover:bg-brand-navy-light/60 hover:text-white'
    }`;

  const subNavItemClass = (view: ViewName) => `w-full flex items-center gap-4 pl-12 pr-4 py-2 transition-all text-left text-xs ${currentView === view ? 'text-brand-cyan font-bold' : 'text-slate-400 hover:text-white hover:pl-14'
    }`;

  const handleNav = (view: ViewName) => {
    setCurrentView(view);
    if (window.innerWidth < 768) toggleMobile();
  };

  return (
    <aside className={`fixed inset-y-0 left-0 w-64 bg-brand-navy text-white transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 z-30 flex flex-col shadow-xl transition-transform duration-300 ease-in-out border-r border-brand-navy-light/20`}>
      <div className="p-5 flex items-center justify-between border-b border-brand-navy-light/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-brand-cyan to-brand-blue rounded-xl text-white shadow-md shadow-brand-cyan/20">
            <i className="fas fa-cubes text-md"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest text-brand-cyan uppercase leading-none mb-1">PMO</span>
            <span className="text-[13px] font-black tracking-tight text-white leading-none">BGH Tech Partner</span>
          </div>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white" onClick={toggleMobile}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1.5 px-3">
          {isExternal ? (
            <>
              <div className="px-4 pt-2 pb-1.5 text-[9px] uppercase font-bold text-slate-500 tracking-widest">Servicio</div>
              <li><button onClick={() => handleNav('operaciones-sd')} className={navItemClass('operaciones-sd')}>
                <i className="fas fa-headset w-5 text-center text-brand-cyan"></i><span>Operaciones S&D</span>
              </button></li>
              
              <div className="px-4 pt-6 pb-1.5 text-[9px] uppercase font-bold text-slate-500 tracking-widest">OTHERS</div>
              <li><button onClick={() => handleNav('perfil')} className={navItemClass('perfil')}>
                <i className="fas fa-user-cog w-5 text-center text-slate-400"></i><span>Ajustes de Perfil</span>
              </button></li>
            </>
          ) : (
          <>
          {/* Categoría Reportes */}
          <div className="px-4 pt-2 pb-1.5 text-[9px] uppercase font-bold text-slate-500 tracking-widest">Dashboards</div>
          <li>
            <button
              onClick={() => setDashboardsOpen(!dashboardsOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-brand-navy-light/60 transition-colors text-left text-sm ${currentView.startsWith('dashboard') ? 'text-white' : 'text-slate-300'}`}
            >
              <div className="flex items-center gap-3.5">
                <i className="fas fa-chart-line w-5 text-center text-amber-500"></i>
                <span>Dashboards</span>
              </div>
              <i className={`fas fa-chevron-${dashboardsOpen ? 'down' : 'right'} text-[8px] text-slate-500`}></i>
            </button>
            {dashboardsOpen && (
              <ul className="mt-1 space-y-1">
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
                {isAdmin && (
                  <li>
                    <button onClick={() => handleNav('cierre-fiscal')} className={subNavItemClass('cierre-fiscal')}>
                      <span>Reportes Cierre Fiscal</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </li>

          {/* Categoría Operaciones */}
          <div className="px-4 pt-5 pb-1.5 text-[9px] uppercase font-bold text-slate-500 tracking-widest">Operaciones & Proyectos</div>
          <li><button onClick={() => handleNav('alta-proyecto')} className={navItemClass('alta-proyecto')}>
            <i className="fas fa-project-diagram w-5 text-center text-indigo-400"></i><span>Proyectos & Kanban</span>
          </button></li>
          <li><button onClick={() => handleNav('gastos')} className={navItemClass('gastos')}>
            <i className="fas fa-wallet w-5 text-center text-emerald-400"></i><span>Control de Costos</span>
          </button></li>
          <li><button onClick={() => handleNav('hitos')} className={navItemClass('hitos')}>
            <i className="fas fa-file-invoice-dollar w-5 text-center text-green-400"></i><span>Hitos Facturables</span>
          </button></li>
          <li><button onClick={() => handleNav('capacity')} className={navItemClass('capacity')}>
            <i className="fas fa-users w-5 text-center text-purple-400"></i><span>Capacity Plan</span>
          </button></li>
          <li><button onClick={() => handleNav('riesgos')} className={navItemClass('riesgos')}>
            <i className="fas fa-exclamation-triangle w-5 text-center text-rose-500"></i><span>Gestión Riesgos</span>
          </button></li>
          <li><button onClick={() => handleNav('cambios')} className={navItemClass('cambios')}>
            <i className="fas fa-exchange-alt w-5 text-center text-brand-cyan"></i><span>Control Cambios</span>
          </button></li>
          <li><button onClick={() => handleNav('operaciones-sd')} className={navItemClass('operaciones-sd')}>
            <i className="fas fa-headset w-5 text-center text-sky-400"></i><span>Operaciones S&D</span>
          </button></li>
          <li><button onClick={() => handleNav('lecciones')} className={navItemClass('lecciones')}>
            <i className="fas fa-lightbulb w-5 text-center text-yellow-300"></i><span>Lecciones Aprendidas</span>
          </button></li>
          <li><button onClick={() => handleNav('documentation')} className={navItemClass('documentation')}>
            <i className="fas fa-folder-open w-5 text-center text-cyan-400"></i><span>Documentación PMO</span>
          </button></li>

          {/* Categoría Others */}
          <div className="px-4 pt-5 pb-1.5 text-[9px] uppercase font-bold text-slate-500 tracking-widest">OTHERS</div>
          {isAdmin && (
            <li><button onClick={() => handleNav('team-management')} className={navItemClass('team-management')}>
              <i className="fas fa-users-cog w-5 text-center text-teal-400"></i><span>Gestión Recursos</span>
            </button></li>
          )}
          <li><button onClick={() => handleNav('perfil')} className={navItemClass('perfil')}>
            <i className="fas fa-user-cog w-5 text-center text-slate-400"></i><span>Ajustes de Perfil</span>
          </button></li>
          </>
          )}
        </ul>
      </nav>

      <div className="p-4 border-t border-brand-navy-light/40 bg-brand-navy">
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-xs text-slate-400">Modo Oscuro</span>
          <button onClick={toggleDarkMode} className="w-10 h-5.5 rounded-full bg-slate-700 flex items-center transition-colors focus:outline-none ring-2 ring-transparent focus:ring-brand-cyan">
            <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform ${darkMode ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
          </button>
        </div>
        <button onClick={() => window.location.reload()} className="w-full py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs transition-colors mb-2 font-medium" onMouseDown={async (e) => {
          e.preventDefault();
          await signOut();
        }}>
          <i className="fas fa-sign-out-alt mr-2"></i> Cerrar Sesión
        </button>
        <p className="text-[10px] text-center text-slate-500">PMO BGH TP v3.9.5</p>
      </div>
    </aside>
  );
};

export default Sidebar;
