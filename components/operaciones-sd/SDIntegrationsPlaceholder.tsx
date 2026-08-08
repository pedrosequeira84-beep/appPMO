import React from 'react';

const INTEGRATIONS: { name: string; icon: string }[] = [
  { name: 'Microsoft Teams', icon: 'fa-brands fa-microsoft' },
  { name: 'Outlook', icon: 'fa-regular fa-envelope' },
  { name: 'Slack', icon: 'fa-brands fa-slack' },
  { name: 'GitHub', icon: 'fa-brands fa-github' },
  { name: 'GitLab', icon: 'fa-brands fa-gitlab' },
  { name: 'Jira', icon: 'fa-brands fa-jira' },
];

/**
 * Placeholder deshabilitado: deja el espacio y el punto de extensión listos para el día que se
 * implementen estas integraciones (notificaciones/tareas/commits), sin construir nada funcional todavía.
 */
const SDIntegrationsPlaceholder: React.FC = () => (
  <div className="mt-8 bg-white dark:bg-dark-card rounded-xl shadow border border-gray-200 dark:border-dark-border p-6">
    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Integraciones — Operaciones S&D</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
      Preparado para conectarse a estas herramientas más adelante. Todavía no están implementadas.
    </p>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {INTEGRATIONS.map(i => (
        <div
          key={i.name}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-gray-500 cursor-not-allowed select-none"
          title={`${i.name} — Próximamente`}
        >
          <i className={`${i.icon} text-xl`}></i>
          <span className="text-[10px] font-bold text-center">{i.name}</span>
          <span className="text-[8px] font-black uppercase tracking-wider bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">Próximamente</span>
        </div>
      ))}
    </div>
  </div>
);

export default SDIntegrationsPlaceholder;
