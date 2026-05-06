import React, { useState } from 'react';
import { useApp } from '../AppContext';
import Modal from '../components/Modal';
import { Project, SEGMENTS, VERTICALS, VENDORS, ProjectStatusUpdate } from '../types';
import { generateUUID, formatDate, calculateProjectHealth } from '../utils/helpers';
import { supabase } from '../utils/supabase';
import { ProjectReport } from '../components/ProjectReport';
import SearchableSelect from '../components/SearchableSelect';
import * as XLSX from 'xlsx';



export const ProjectsView: React.FC = () => {
  const {
    projects, setProjects, changes, showToast, user, risks, lessons,
    expenses, executiveFilters, setExecutiveFilters, capacityData, team
  } = useApp();

  const renderTextWithLinks = (text: string) => {
    if (!text) return text;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z]:\\[^\n]+?(?=\s*(?:\n|$|\.\s|\.$|, )))/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.match(/^(https?:\/\/|www\.)/)) {
        return (
          <span key={i} className="inline-flex items-center gap-1 group/link">
            <a
              href={part.startsWith('http') ? part : `https://${part}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(part);
                showToast('Link copiado', 'success');
              }}
              className="opacity-0 group-hover/link:opacity-100 text-gray-400 hover:text-indigo-600 p-1 transition-opacity"
              title="Copiar link"
            >
              <i className="fas fa-copy text-[10px]"></i>
            </button>
          </span>
        );
      } else if (part.match(/^[a-zA-Z]:\\/)) {
        return (
          <span key={i} className="inline-flex items-center gap-1 group/link">
            <a
              href={`file:///${part.replace(/\\/g, '/')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
              onClick={(e) => e.stopPropagation()}
              title="Ruta local (el navegador suele bloquear el acceso directo por seguridad)"
            >
              {part}
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(part);
                showToast('Ruta copiada al portapapeles', 'success');
              }}
              className="opacity-0 group-hover/link:opacity-100 text-gray-400 hover:text-indigo-600 p-1 transition-opacity"
              title="Copiar ruta"
            >
              <i className="fas fa-copy text-[10px]"></i>
            </button>
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [formData, setFormData] = useState<Partial<Project>>({});
  const [showJustification, setShowJustification] = useState(false);
  const [justificationData, setJustificationData] = useState<{ changeIds: string[], reason: string }>({ changeIds: [], reason: '' });

  const [reportProject, setReportProject] = useState<Project | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showBulkReport, setShowBulkReport] = useState(false);
  const [newStatusText, setNewStatusText] = useState('');
  const [newStatusType, setNewStatusType] = useState<'Técnico' | 'PMO'>('PMO');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Técnico' | 'PMO'>('Todos');

  // Retroactive date change history form
  const [showRetroForm, setShowRetroForm] = useState(false);
  const [retroEntry, setRetroEntry] = useState<{
    previousDate: string;
    newDate: string;
    changedAt: string;
    changeIds: string[];
  }>({
    previousDate: '',
    newDate: '',
    changedAt: new Date().toISOString().split('T')[0],
    changeIds: []
  });

  const handleEdit = (p: Project) => {
    setEditingProject(p);
    setFormData(p);
    setShowJustification(false);
    setJustificationData({ changeIds: [], reason: '' });
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingProject(null);
    setFormData({
      status: 'En ejecución',
      progress: 0,
      startDate: new Date().toISOString().split('T')[0],
      theoreticalEndDate: new Date().toISOString().split('T')[0],
      priority: 3
    });
    setShowJustification(false);
    setJustificationData({ changeIds: [], reason: '' });
    setIsModalOpen(true);
  };

  const handleAddStatusUpdate = async () => {
    if (!editingProject || !newStatusText.trim()) {
      return showToast('Debe ingresar un status', 'error');
    }

    try {
      const newUpdate: ProjectStatusUpdate = {
        id: generateUUID(),
        status: newStatusText.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.email || 'Usuario',
        type: newStatusType
      };

      const currentHistory = editingProject.statusHistory || [];
      const newHistory = [...currentHistory, newUpdate];

      await supabase
        .from('projects')
        .update({ status_history: newHistory })
        .eq('id', editingProject.id);

      const updatedProject = { ...editingProject, statusHistory: newHistory };
      setEditingProject(updatedProject);
      setFormData({ ...formData, statusHistory: newHistory });
      setProjects(prev => prev.map(p =>
        p.id === editingProject.id ? updatedProject : p
      ));

      setNewStatusText('');
      showToast('Status agregado correctamente', 'success');
    } catch (err: unknown) {
      showToast('Error guardando status: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar proyecto y todos sus datos asociados?')) {
      try {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
        setProjects(prev => prev.filter(p => p.id !== id));
        showToast('Proyecto eliminado', 'error');
      } catch (err: unknown) {
        showToast('Error eliminando proyecto: ' + (err instanceof Error ? err.message : String(err)), 'error');
      }
    }
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateAISummary = async () => {
    setIsGeneratingAI(true);
    
    // Simular retraso de procesamiento para dar sensación de IA
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const projRisks = risks.filter(r => r.projectId === formData.id);
      const highRisks = projRisks.filter(r => r.impact === 'Alto');
      const projChanges = changes.filter(c => c.projectId === formData.id);
      const projExpenses = expenses.filter(e => e.projectId === formData.id);
      
      const totalBudget = Object.values(formData.budget || {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);
      const totalSAP = projExpenses.reduce((s, e) => s + e.amount, 0);

      const pmoComments = (formData.statusHistory || []).filter(h => (h.type || 'PMO') === 'PMO').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const techComments = (formData.statusHistory || []).filter(h => h.type === 'Técnico').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      let generatedSummary = "";

      // 1. Intro
      if (formData.progress > 80) {
        generatedSummary += `El proyecto ${formData.name} se encuentra en fase de cierre con un ${formData.progress}% de avance. `;
      } else if (formData.progress > 0) {
        generatedSummary += `El proyecto ${formData.name} avanza en etapa de ejecución al ${formData.progress}%. `;
      } else {
        generatedSummary += `El proyecto ${formData.name} se encuentra en etapa inicial de planificación. `;
      }

      // 2. Costos
      let healthScore = 0; // 0: Good, 1: Warning, 2: Critical
      const pct = totalBudget > 0 ? ((totalSAP as number) / totalBudget) * 100 : 0;
      const hasNegative = projExpenses.some(e => e.amount < 0);

      if (totalBudget > 0) {
        if (hasNegative || totalSAP < 0) {
          generatedSummary += `Situación financiera anómala con registros negativos en SAP ($${totalSAP.toLocaleString()}). `;
          healthScore = 2;
        } else if (pct > 100) {
          generatedSummary += `Desvío presupuestario detectado: el consumo del ${pct.toFixed(0)}% ($${totalSAP.toLocaleString()}) ha excedido el presupuesto total de $${totalBudget.toLocaleString()}. `;
          healthScore = 2;
        } else if (pct > 80) {
          generatedSummary += `Consumo presupuestario en nivel de alerta (${pct.toFixed(0)}%), con $${(totalBudget - totalSAP).toLocaleString()} de margen restante. `;
          if (healthScore < 1) healthScore = 1;
        } else {
          generatedSummary += `Finanzas estables con un consumo del ${pct.toFixed(0)}% respecto al total planificado. `;
        }
      }

      // 3. Riesgos y Cambios
      if (projRisks.length > 0 || projChanges.length > 0) {
        generatedSummary += `En la gestión de control, se registran ${projRisks.length} riesgos activos (${highRisks.length} de impacto alto) y ${projChanges.length} controles de cambio. `;
        if (highRisks.length > 0) {
          const mainRisk = highRisks[0].description;
          generatedSummary += `Riesgo crítico detectado: "${mainRisk.length > 120 ? mainRisk.substring(0, 120) + '...' : mainRisk}". `;
          healthScore = 2;
        }
        else if (projRisks.length > 2 && healthScore < 1) healthScore = 1;
      }

      // 4. Comentarios (Análisis de tendencias)
      if (pmoComments.length > 0 || techComments.length > 0) {
        const latestPmo = pmoComments[0];
        const latestTech = techComments[0];
        const alertWords = ['retraso', 'demora', 'problema', 'bloqueado', 'falta', 'riesgo', 'crítico', 'urgente', 'desvío', 'falla', 'traba'];
        const positiveWords = ['completado', 'finalizado', 'entregado', 'aprobado', 'éxito', 'listo', 'avanza', 'ok', 'cerrado', 'solucionado', 'aprobación'];
        
        if (latestPmo) {
          generatedSummary += `Última actualización PMO: "${latestPmo.status}". `;
        }
        if (latestTech) {
          generatedSummary += `Estado técnico reportado: "${latestTech.status}". `;
        }

        const textCorpus = (formData.statusHistory || []).map(h => h.status.toLowerCase()).join(' ');
        let alertCount = 0;
        let positiveCount = 0;
        alertWords.forEach(w => { if (textCorpus.includes(w)) alertCount++; });
        positiveWords.forEach(w => { if (textCorpus.includes(w)) positiveCount++; });

        if (alertCount > positiveCount && healthScore < 1) healthScore = 1;
      }

      // 5. Gestión de Salud (Solo si está en Automático)
      let finalHealth = formData.healthStatus;
      if (formData.healthStatus === 'Auto') {
        const healthMap: Record<number, 'Verde' | 'Amarillo' | 'Rojo'> = { 0: 'Verde', 1: 'Amarillo', 2: 'Rojo' };
        finalHealth = healthMap[healthScore];
      }

      // Persistencia inmediata (para evitar que se pierda al salir del modal)
      await supabase.from('projects').update({ 
        ai_summary: generatedSummary,
        health_status: finalHealth 
      }).eq('id', formData.id);

      setFormData(prev => ({ ...prev, aiSummary: generatedSummary, healthStatus: finalHealth }));
      
      // Update local projects list to reflect changes immediately
      setProjects(prev => prev.map(p => p.id === formData.id ? { ...p, aiSummary: generatedSummary, healthStatus: finalHealth } : p));
      
      showToast('Resumen y Salud actualizados correctamente', 'success');

    } catch (err: unknown) {
      console.error('Local Summary Error:', err);
      showToast('Error al procesar el resumen: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return showToast('El nombre es obligatorio', 'error');

    if (editingProject && editingProject.realEndDate && formData.realEndDate && editingProject.realEndDate !== formData.realEndDate) {
      if (justificationData.changeIds.length === 0) {
        return showToast('Debe asociar al menos un Control de Cambio', 'error');
      }
    }

    try {
      if (editingProject) {
        let historyToSave = formData.statusHistory || editingProject.statusHistory || [];
        if (newStatusText.trim()) {
          const newUpdate: ProjectStatusUpdate = {
            id: generateUUID(),
            status: newStatusText.trim(),
            createdAt: new Date().toISOString(),
            createdBy: user?.email || 'Usuario',
            type: newStatusType
          };
          historyToSave = [...historyToSave, newUpdate];
        }

        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            client_name: formData.clientName,
            pm: formData.pm,
            opportunity_number: formData.opportunityNumber,
            status: formData.status,
            start_date: formData.startDate,
            theoretical_end_date: formData.theoreticalEndDate,
            real_end_date: formData.realEndDate,
            progress: formData.progress,
            budget: formData.budget,
            hw_value: formData.hwValue,
            services_value: formData.servicesValue,
            oc_value: formData.ocValue,
            hw_cost: formData.hwCost,
            services_cost: formData.servicesCost,
            cm: formData.cm,
            values_comments: formData.valuesComments,
            documentation_link: formData.documentationLink,
            health_status: formData.healthStatus,
            vendors: formData.vendors,
            third_party_services: formData.thirdPartyServices,
            third_party_provider: formData.thirdPartyProvider,
            vertical: formData.vertical,
            segment: formData.segment,
            ai_summary: formData.aiSummary,
            priority: formData.status === 'Finalizado' ? null : formData.priority,
            status_history: historyToSave
          })
          .eq('id', editingProject.id);

        if (error) throw error;

        // If real end date changed, save to history
        let updatedProject = { ...formData, statusHistory: historyToSave } as Project;
        if (editingProject.realEndDate && formData.realEndDate && editingProject.realEndDate !== formData.realEndDate && justificationData.changeIds.length > 0) {
          const historyEntry = {
            id: generateUUID(),
            previousDate: editingProject.realEndDate,
            newDate: formData.realEndDate,
            changeIds: justificationData.changeIds,
            changedAt: new Date().toISOString()
          };

          const currentHistory = editingProject.dateChangeHistory || [];
          const newHistory = [...currentHistory, historyEntry];

          // Update the history in the database
          await supabase
            .from('projects')
            .update({ date_change_history: newHistory })
            .eq('id', editingProject.id);

          updatedProject.dateChangeHistory = newHistory;
        }

        setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...updatedProject } as Project : p));
        setNewStatusText(''); // Limpiar si hubo texto
        showToast('Proyecto actualizado', 'success');
      } else {
        const pData = {
          name: formData.name,
          client_name: formData.clientName,
          pm: formData.pm,
          opportunity_number: formData.opportunityNumber,
          status: formData.status,
          start_date: formData.startDate,
          theoretical_end_date: formData.theoreticalEndDate,
          progress: formData.progress,
          budget: formData.budget || {},
          hw_value: formData.hwValue,
          services_value: formData.servicesValue,
          oc_value: formData.ocValue,
          hw_cost: formData.hwCost,
          services_cost: formData.servicesCost,
          cm: formData.cm,
          values_comments: formData.valuesComments,
          documentation_link: formData.documentationLink,
          health_status: formData.healthStatus || 'Verde',
          owner_id: user?.id,
          vendors: formData.vendors,
          third_party_services: formData.thirdPartyServices,
          third_party_provider: formData.thirdPartyProvider,
          vertical: formData.vertical,
          segment: formData.segment,
          ai_summary: formData.aiSummary,
          priority: formData.status === 'Finalizado' ? null : formData.priority
        };

        const { data, error } = await supabase.from('projects').insert([pData]).select();
        if (error) throw error;

        const newProject: Project = {
          ...formData as Project,
          id: data[0].id,
          milestones: [],
          ocs: [],
          createdAt: data[0].created_at
        };
        setProjects(prev => [...prev, newProject]);
        showToast('Proyecto creado', 'success');
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      showToast('Error guardando: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'En ejecución': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Soporte': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Intervención temprana': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Finalizado': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = React.useMemo(() => {
    const searchLower = (searchTerm || '').toLowerCase().trim();
    const statusOrder: Record<string, number> = {
      'En ejecución': 0,
      'Soporte': 1,
      'Intervención temprana': 2,
      'Finalizado': 3
    };

    return (projects || [])
      .filter(p => {
        if (!p) return false;

        // AppContext Filters (from Executive Dashboard)
        if (executiveFilters.status && p.status !== executiveFilters.status) return false;

        if (executiveFilters.vertical) {
          const projectVertical = p.vertical || 'Sin Vertical';
          if (projectVertical !== executiveFilters.vertical) return false;
        }

        if (executiveFilters.segment) {
          const projectSegment = p.segment || 'Sin Segmento';
          if (projectSegment !== executiveFilters.segment) return false;
        }

        if (executiveFilters.vendor) {
          const vendors = p.vendors || [];
          if (executiveFilters.vendor === 'Sin Vendor') {
            if (vendors.length > 0) return false;
          } else {
            if (!vendors.includes(executiveFilters.vendor)) return false;
          }
        }

        // Local Search Filter
        if (!searchLower) return true;

        const name = String(p.name || '').toLowerCase();
        const client = String(p.clientName || '').toLowerCase();
        const pm = String(p.pm || '').toLowerCase();
        const opp = String(p.opportunityNumber || '').toLowerCase();

        return name.includes(searchLower) ||
          client.includes(searchLower) ||
          pm.includes(searchLower) ||
          opp.includes(searchLower);
      })
      .sort((a, b) => {
        if (!a || !b) return 0;
        const orderA = statusOrder[a.status] ?? 99;
        const orderB = statusOrder[b.status] ?? 99;

        if (orderA !== orderB) return orderA - orderB;

        // Secondary sort for 'En ejecución': Newest first
        if (a.status === 'En ejecución') {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }

        return 0;
      });
  }, [projects, searchTerm, executiveFilters]);

  const uniqueClients = React.useMemo(() => Array.from(new Set(projects.map(p => p.clientName))).filter(Boolean), [projects]);
  const uniquePMs = React.useMemo(() => Array.from(new Set(projects.map(p => p.pm))).filter(Boolean), [projects]);

  const handleExportExcel = () => {
    try {
      const pmRoles = ['PM', 'Project Manager', 'Gerente'];

      const exportData = filteredProjects.map(p => {
        // Find engineers from capacity plan
        const projAssignments = capacityData.assignments.filter(a => a.projectId === p.id);
        const engineeerNames = Array.from(new Set(
          projAssignments
            .filter(a => {
              const member = team.find(t => t.id === a.memberId);
              return member && !pmRoles.includes(member.role);
            })
            .map(a => team.find(t => t.id === a.memberId)?.name)
            .filter(Boolean)
        ));

        const ventaTotal = (p.hwValue || 0) + (p.servicesValue || 0);

        return {
          "Nombre Proyecto": p.name,
          "Cliente": p.clientName,
          "Nro Oportunidad": p.opportunityNumber,
          "Prioridad": p.status === 'Finalizado' ? '' : (p.priority || ''),
          "Ingeniero": engineeerNames.join(' '),
          "PM": p.pm,
          "Fecha Inicio": formatDate(p.startDate),
          "Fecha Fin Teoric": formatDate(p.theoreticalEndDate),
          "Fecha Fin Real": p.realEndDate ? formatDate(p.realEndDate) : '',
          "Estado": p.status,
          "Ava": `${p.progress}%`,
          "Venta Total": `USD ${ventaTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "Valor Venta HW": `USD ${(p.hwValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "Valor Venta Servic": `USD ${(p.servicesValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "Costo HW": `USD ${(p.hwCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "Costo Servicios": `USD ${(p.servicesCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          "CM %": `${(p.cm || 0).toFixed(1)}%`
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Proyectos");

      // Auto-size columns (basic attempt)
      const maxWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: key.length + 5 }));
      ws['!cols'] = maxWidths;

      XLSX.writeFile(wb, `Reporte_Proyectos_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Excel exportado correctamente', 'success');
    } catch (err: unknown) {
      showToast('Error exportando Excel: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  };

  return (
    <div className="fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold dark:text-white">Gestión de Proyectos</h2>

        <div className="flex-1 max-w-md w-full relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Buscar por TP-AR, PM, nombre o cliente..."
            className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 shadow-sm">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
            <i className="fas fa-list mr-2"></i>Lista
          </button>
          <button onClick={() => setViewMode('kanban')} className={`px-4 py-2 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
            <i className="fas fa-columns mr-2"></i>Kanban
          </button>
        </div>
      </div>

      {Object.values(executiveFilters).some(v => v !== null) && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-indigo-50/50 dark:bg-slate-800/50 rounded-xl border border-indigo-100 dark:border-slate-700">
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mr-2">Filtros Dashboard:</span>
          {Object.entries(executiveFilters).map(([key, value]) => value && (
            <div key={key} className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1 rounded-full text-xs shadow-sm border dark:border-slate-600">
              <span className="text-gray-500 dark:text-gray-400 capitalize">{key}:</span>
              <span className="font-bold dark:text-white">{value}</span>
              <button onClick={() => setExecutiveFilters(prev => ({ ...prev, [key]: null }))} className="text-gray-400 hover:text-red-500">
                <i className="fas fa-times-circle"></i>
              </button>
            </div>
          ))}
          <button
            onClick={() => setExecutiveFilters({ status: null, vendor: null, vertical: null, segment: null })}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline ml-auto font-bold"
          >
            Limpiar todo
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <button onClick={handleNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg transition-transform transform hover:scale-105 flex items-center justify-center font-medium">
          <i className="fas fa-plus mr-2"></i> Crear Nuevo Proyecto
        </button>
        <button onClick={handleExportExcel} className="bg-white hover:bg-gray-50 text-emerald-600 border border-emerald-200 px-6 py-3 rounded-xl shadow-sm transition-transform transform hover:scale-105 flex items-center justify-center font-medium">
          <i className="fas fa-file-excel mr-2"></i> Exportar a Excel
        </button>
        {selectedProjectIds.length > 0 && (
          <button
            onClick={() => setShowBulkReport(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center justify-center font-medium animate-fade-in"
          >
            <i className="fas fa-file-pdf mr-2"></i> Generar Reporte Consolidado ({selectedProjectIds.length})
          </button>
        )}
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-dark-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-sm uppercase">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      checked={selectedProjectIds.length === filteredProjects.length && filteredProjects.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProjectIds(filteredProjects.map(p => p.id));
                        else setSelectedProjectIds([]);
                      }}
                    />
                  </th>
                  <th className="p-4">Proyecto</th>
                  <th className="p-4">PM / Cliente</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Avance</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredProjects.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${selectedProjectIds.includes(p.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={selectedProjectIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProjectIds(prev => [...prev, p.id]);
                          else setSelectedProjectIds(prev => prev.filter(id => id !== p.id));
                        }}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {(() => {
                          if (p.status === 'Finalizado') return null;
                          const health = calculateProjectHealth(p, expenses);
                          return (
                            <div className={`w-3 h-3 rounded-full ${health === 'Rojo' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : health === 'Amarillo' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} title={`Salud: ${p.healthStatus === 'Auto' ? 'Auto (' + health + ')' : p.healthStatus}`}></div>
                          );
                        })()}
                        <p
                          onClick={() => handleEdit(p)}
                          className="font-bold text-gray-800 dark:text-white text-base leading-tight break-words hover:text-indigo-600 cursor-pointer transition-colors"
                          title="Click para editar proyecto"
                        >
                          {p.priority && p.status !== 'Finalizado' && (
                            <span className="mr-2 inline-flex items-center justify-center w-6 h-6 rounded bg-indigo-50 text-indigo-600 text-[10px] font-black border border-indigo-100" title="Prioridad">
                              P{p.priority}
                            </span>
                          )}
                          {p.name}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {p.opportunityNumber && <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 font-mono border border-blue-200 dark:border-blue-800">{p.opportunityNumber}</span>}
                        <span className="text-xs text-gray-500 dark:text-gray-400">Fin Teórico: {formatDate(p.theoreticalEndDate)}</span>
                        {p.realEndDate && <span className="text-xs text-indigo-500 font-bold dark:text-indigo-400">Fin Real: {formatDate(p.realEndDate)}</span>}
                        {p.documentationLink && (
                          <a
                            href={p.documentationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 ml-2"
                            title="Ver documentación"
                          >
                            <i className="fas fa-folder-open"></i>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm dark:text-gray-300">
                      <div className="font-medium text-gray-700 dark:text-gray-300">{p.pm}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 break-words">{p.clientName}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-[10px] rounded-full whitespace-nowrap inline-flex items-center justify-center font-bold ${getStatusBadgeColor(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="p-4">
                      <div className="w-24 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${p.progress}%` }}></div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{p.progress}%</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setReportProject(p)}
                          className="p-2.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title='Generar Reporte PDF'
                        >
                          <i className="fas fa-file-pdf"></i>
                        </button>
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-6">
          {['Intervención temprana', 'POC', 'En ejecución', 'Soporte', 'Finalizado'].map(status => {
            const colProjects = filteredProjects.filter(p => (p.status || 'En ejecución') === status);
            const borderColor = status === 'En ejecución' ? 'border-green-500' : status === 'Soporte' ? 'border-yellow-500' : status === 'Intervención temprana' ? 'border-blue-500' : status === 'POC' ? 'border-purple-500' : 'border-gray-400';

            return (
              <div key={status} className="kanban-col min-w-[300px] w-80 bg-gray-100 dark:bg-slate-900 rounded-xl p-4 flex flex-col border dark:border-slate-700">
                <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-4 flex justify-between items-center sticky top-0 bg-gray-100 dark:bg-slate-900 z-10 py-2">
                  {status}
                  <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded text-xs shadow-sm font-mono">{colProjects.length}</span>
                </h3>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] scrollbar-thin px-1">
                  {colProjects.map(p => (
                    <div key={p.id} className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border-l-4 ${borderColor} cursor-pointer hover:shadow-md transition-all relative group transform hover:-translate-y-1`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {(() => {
                            if (p.status === 'Finalizado') return null;
                            const health = calculateProjectHealth(p, expenses);
                            return (
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${health === 'Rojo' ? 'bg-red-500' : health === 'Amarillo' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                            );
                          })()}
                          <h4
                            onClick={() => handleEdit(p)}
                            className="font-bold text-sm text-gray-800 dark:text-white leading-snug break-words hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Click para editar proyecto"
                          >
                            {p.priority && p.status !== 'Finalizado' && (
                              <span className="mr-2 inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-black border border-indigo-100 shrink-0" title={`Prioridad ${p.priority}`}>
                                P{p.priority}
                              </span>
                            )}
                            {p.name}
                          </h4>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setReportProject(p)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1.5 rounded" title="Generar PDF"><i className="fas fa-file-pdf"></i></button>
                          <button onClick={() => handleEdit(p)} className="text-gray-400 hover:text-indigo-600 p-1.5 rounded" title="Editar"><i className="fas fa-pencil-alt"></i></button>
                        </div>
                      </div>
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 break-words font-medium"><i className="fas fa-building mr-1"></i>{p.clientName}</p>
                        {p.opportunityNumber && <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-mono border border-blue-100 dark:border-blue-800">{p.opportunityNumber}</span>}
                        {p.documentationLink && (
                          <a
                            href={p.documentationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block ml-2 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
                            title="Documentación"
                          >
                            <i className="fas fa-folder-open"></i>
                          </a>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-xs mt-3 border-t dark:border-slate-700 pt-2">
                        <div className="flex items-center text-gray-600 dark:text-gray-400"><i className="fas fa-chart-pie mr-1 text-indigo-400"></i> {p.progress}%</div>
                        <div className="flex items-center text-gray-600 dark:text-gray-400"><i className="fas fa-user-circle mr-1 text-green-400"></i> {(p.pm || '').split(' ')[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h3 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2">
          <i className={`fas ${editingProject ? 'fa-edit' : 'fa-plus-circle'} text-indigo-500`}></i>
          {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 border-b dark:border-slate-700 pb-2 mb-2 flex justify-between items-center">
            <h4 className="text-sm font-black dark:text-gray-200 uppercase tracking-wider text-indigo-500">Información General</h4>
            {formData.status !== 'Finalizado' && (
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Prioridad:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(p => (
                    <button
                      key={p}
                      onClick={() => setFormData({ ...formData, priority: p as any })}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${formData.priority === p
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                        : 'bg-white dark:bg-slate-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre del Proyecto</label>
            <input
              type="text"
              placeholder="Nombre del Proyecto"
              className="input-field w-full text-lg font-bold py-3"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cliente</label>
            <input type="text" placeholder="Cliente" className="input-field w-full" list="clients-list" value={formData.clientName || ''} onChange={e => setFormData({ ...formData, clientName: e.target.value })} />
            <datalist id="clients-list">
              {uniqueClients.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Project Manager</label>
            <input type="text" placeholder="Project Manager" className="input-field w-full" list="pms-list" value={formData.pm || ''} onChange={e => setFormData({ ...formData, pm: e.target.value })} />
            <datalist id="pms-list">
              {uniquePMs.map(pm => <option key={pm} value={pm} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nro Oportunidad</label>
            <input type="text" placeholder="Nro Oportunidad" className="input-field w-full border-l-4 border-l-indigo-500" value={formData.opportunityNumber || ''} onChange={e => setFormData({ ...formData, opportunityNumber: e.target.value })} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Estado</label>
            <select className="input-field w-full" value={formData.status || 'En ejecución'} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
              <option value="En ejecución">En ejecución</option>
              <option value="Intervención temprana">Intervención temprana</option>
              <option value="POC">POC</option>
              <option value="Soporte">Soporte</option>
              <option value="Finalizado">Finalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Salud del Proyecto</label>
            <select
              className={`input-field w-full font-bold ${formData.healthStatus === 'Rojo' ? 'text-red-600' : formData.healthStatus === 'Amarillo' ? 'text-amber-600' : formData.healthStatus === 'Verde' ? 'text-emerald-600' : 'text-indigo-600'}`}
              value={formData.healthStatus || 'Auto'}
              onChange={e => setFormData({ ...formData, healthStatus: e.target.value as any })}
            >
              <option value="Auto">✨ Automática</option>
              <option value="Verde">🟢 Forzar Verde</option>
              <option value="Amarillo">🟡 Forzar Amarillo</option>
              <option value="Rojo">🔴 Forzar Rojo</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Link Documentación</label>
            <input
              type="url"
              placeholder="https://..."
              className="input-field w-full"
              value={formData.documentationLink || ''}
              onChange={e => setFormData({ ...formData, documentationLink: e.target.value })}
            />
          </div>

          <div className="col-span-2 border-t dark:border-slate-700 pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <SearchableSelect
                label="Vendors"
                options={VENDORS}
                multiple={true}
                value={formData.vendors}
                onChange={(vals) => setFormData({ ...formData, vendors: vals })}
                placeholder="Seleccionar vendors..."
              />
            </div>

            <div>
              <SearchableSelect
                label="Vertical"
                options={VERTICALS}
                value={formData.vertical}
                onChange={(val) => setFormData({ ...formData, vertical: val })}
                placeholder="Seleccionar vertical..."
              />
            </div>

            <div>
              <SearchableSelect
                label="Segmento"
                options={SEGMENTS}
                value={formData.segment}
                onChange={(val) => setFormData({ ...formData, segment: val })}
                placeholder="Seleccionar segmento..."
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Servicios de tercero</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="thirdParty"
                      checked={formData.thirdPartyServices === true}
                      onChange={() => setFormData({ ...formData, thirdPartyServices: true })}
                    />
                    <span className="text-sm dark:text-gray-300">Si</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="thirdParty"
                      checked={formData.thirdPartyServices === false}
                      onChange={() => setFormData({ ...formData, thirdPartyServices: false, thirdPartyProvider: '' })}
                    />
                    <span className="text-sm dark:text-gray-300">No</span>
                  </label>
                </div>
              </div>

              {formData.thirdPartyServices && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 text-indigo-500">¿Cuál es el proveedor?</label>
                  <input
                    type="text"
                    placeholder="Nombre del proveedor"
                    className="input-field w-full border-indigo-200 dark:border-indigo-800"
                    value={formData.thirdPartyProvider || ''}
                    onChange={e => setFormData({ ...formData, thirdPartyProvider: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="col-span-2 border-t dark:border-slate-700 pt-6 mt-4">
            <h4 className="text-sm font-black dark:text-gray-200 mb-4 uppercase tracking-wider text-indigo-500 border-b pb-2 border-indigo-100 dark:border-slate-700">Valores del Proyecto (USD)</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Venta HW */}
              <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Valor Venta HW</label>
                <input type="number" placeholder="0.00" className="input-field font-mono text-lg" value={formData.hwValue || ''} onChange={e => setFormData({ ...formData, hwValue: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Venta Servicio */}
              <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Valor Venta Servicio</label>
                <input type="number" placeholder="0.00" className="input-field font-mono text-lg" value={formData.servicesValue || ''} onChange={e => setFormData({ ...formData, servicesValue: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Valor OC */}
              <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <label className="block text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase mb-2">Valor de la OC</label>
                <input type="number" placeholder="0.00" className="input-field font-mono text-lg bg-white dark:bg-slate-800 border-emerald-200 focus:ring-emerald-500" value={formData.ocValue || ''} onChange={e => setFormData({ ...formData, ocValue: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* CM */}
              <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">CM %</label>
                <input type="number" placeholder="0.00" className="input-field font-mono text-lg" value={formData.cm || ''} onChange={e => setFormData({ ...formData, cm: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Costo HW */}
              <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Costo HW</label>
                <input type="number" placeholder="0.00" className="input-field font-mono text-lg" value={formData.hwCost || ''} onChange={e => setFormData({ ...formData, hwCost: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Costo Servicio */}
              <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Costo Servicio</label>
                <input type="number" placeholder="0.00" className="input-field font-mono text-lg" value={formData.servicesCost || ''} onChange={e => setFormData({ ...formData, servicesCost: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Comentarios */}
              <div className="col-span-full mt-2">
                <label className="block text-xs font-bold text-indigo-500 uppercase mb-2 ml-1">Comentarios de Valores</label>
                <textarea
                  placeholder="Observaciones sobre la OC, variaciones de venta, etc..."
                  className="input-field w-full bg-white dark:bg-slate-800/50 min-h-[150px] resize-y py-3 text-sm leading-relaxed"
                  value={formData.valuesComments || ''}
                  onChange={e => setFormData({ ...formData, valuesComments: e.target.value })}
                />
              </div>

              {/* Resumen IA */}
              <div className="col-span-full mt-4 bg-indigo-50/30 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-magic"></i> Resumen Ejecutivo (IA)
                  </label>
                  <button
                    onClick={handleGenerateAISummary}
                    disabled={isGeneratingAI}
                    className={`text-[10px] font-black px-4 py-1.5 rounded-full transition-all shadow-md flex items-center gap-2 ${isGeneratingAI
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'
                      }`}
                  >
                    {isGeneratingAI ? (
                      <><i className="fas fa-spinner fa-spin"></i> GENERANDO...</>
                    ) : (
                      <><i className="fas fa-sparkles"></i> GENERAR RESUMEN AUTOMÁTICO</>
                    )}
                  </button>
                </div>
                <textarea
                  placeholder="El resumen se generará automáticamente basándose en el historial de status..."
                  className={`input-field w-full bg-white dark:bg-slate-800/50 min-h-[250px] resize-y py-3 text-sm leading-relaxed border-dashed ${isGeneratingAI ? 'opacity-50' : 'border-indigo-300'}`}
                  value={formData.aiSummary || ''}
                  onChange={e => setFormData({ ...formData, aiSummary: e.target.value })}
                />
                <p className="text-[9px] text-slate-400 mt-2 italic">Este resumen aparecerá en la carátula del Reporte Ejecutivo.</p>
              </div>
            </div>
          </div>

          <div className="col-span-2 border-t dark:border-slate-700 pt-6 mt-4">
            <h4 className="text-sm font-medium dark:text-gray-300 mb-4 uppercase tracking-wider text-gray-500">Fechas y Avance</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Inicio</label>
                <input type="date" className="input-field" value={formData.startDate || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fin Teórico</label>
                <input type="date" className="input-field" value={formData.theoreticalEndDate || ''} onChange={e => setFormData({ ...formData, theoreticalEndDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fin Real</label>
                <input
                  type="date"
                  className={`input-field ${(editingProject?.realEndDate && formData.realEndDate && editingProject.realEndDate !== formData.realEndDate) ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}
                  value={formData.realEndDate || ''}
                  onChange={e => {
                    const newDate = e.target.value;
                    setFormData({ ...formData, realEndDate: newDate });
                    if (editingProject?.realEndDate && editingProject.realEndDate !== newDate) {
                      setShowJustification(true);
                    } else {
                      setShowJustification(false);
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Avance Real (%)</label>
                <div className="relative">
                  <input type="number" min="0" max="100" className="input-field pr-8" value={formData.progress || 0} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                </div>
              </div>
            </div>
            {(showJustification || (editingProject?.realEndDate && formData.realEndDate && editingProject.realEndDate !== formData.realEndDate)) && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i> Justificación de cambio de fecha (Selección Múltiple)
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-2 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                  {changes.filter(c => c.projectId === editingProject?.id).length > 0 ? (
                    changes.filter(c => c.projectId === editingProject?.id).map(c => (
                      <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          checked={justificationData.changeIds.includes(c.id)}
                          onChange={(e) => {
                            const ids = e.target.checked
                              ? [...justificationData.changeIds, c.id]
                              : justificationData.changeIds.filter(id => id !== c.id);
                            setJustificationData({ ...justificationData, changeIds: ids });
                          }}
                        />
                        <div className="text-xs">
                          <span className="font-bold text-gray-700 dark:text-gray-200">Reg: {c.registrationNumber || 'S/N'}</span>
                          <span className="text-gray-400 ml-2 italic">{formatDate(c.date)}</span>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-center py-4 text-gray-500">No hay controles de cambio para este proyecto.</p>
                  )}
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic text-right">Debe seleccionar al menos un cambio registrado previamente.</p>
              </div>
            )}

            {/* Date Change History - always visible when editing */}
            {editingProject && (
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <i className="fas fa-history text-indigo-500"></i>
                    Historial de Cambios de Fecha Real
                    {editingProject.dateChangeHistory && editingProject.dateChangeHistory.length > 0 && (
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black">
                        {editingProject.dateChangeHistory.length} registro{editingProject.dateChangeHistory.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </h5>
                  <button
                    onClick={() => {
                      setShowRetroForm(v => !v);
                      setRetroEntry({ previousDate: '', newDate: '', changedAt: new Date().toISOString().split('T')[0], changeIds: [] });
                    }}
                    className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all"
                  >
                    <i className={`fas ${showRetroForm ? 'fa-times' : 'fa-plus'}`}></i>
                    {showRetroForm ? 'Cancelar' : 'Agregar entrada retroactiva'}
                  </button>
                </div>

                {/* Retroactive Entry Form */}
                {showRetroForm && (
                  <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl space-y-4 animate-in fade-in">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <i className="fas fa-clock-rotate-left"></i>
                      Registrar cambio de fecha histórico (retroactivo)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Fecha anterior</label>
                        <input
                          type="date"
                          className="input-field w-full text-sm"
                          value={retroEntry.previousDate}
                          onChange={e => setRetroEntry(prev => ({ ...prev, previousDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Nueva fecha</label>
                        <input
                          type="date"
                          className="input-field w-full text-sm border-green-300 focus:ring-green-500"
                          value={retroEntry.newDate}
                          onChange={e => setRetroEntry(prev => ({ ...prev, newDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Fecha del cambio</label>
                        <input
                          type="date"
                          className="input-field w-full text-sm"
                          value={retroEntry.changedAt}
                          onChange={e => setRetroEntry(prev => ({ ...prev, changedAt: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Control de Cambio asociado (opcional)</label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                        {changes.filter(c => c.projectId === editingProject.id).length > 0 ? (
                          changes.filter(c => c.projectId === editingProject.id).map(c => (
                            <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-amber-600 rounded"
                                checked={retroEntry.changeIds.includes(c.id)}
                                onChange={e => {
                                  const ids = e.target.checked
                                    ? [...retroEntry.changeIds, c.id]
                                    : retroEntry.changeIds.filter(id => id !== c.id);
                                  setRetroEntry(prev => ({ ...prev, changeIds: ids }));
                                }}
                              />
                              <div className="text-xs">
                                <span className="font-bold text-gray-700 dark:text-gray-200">Reg: {c.registrationNumber || 'S/N'}</span>
                                <span className="text-gray-400 ml-2 italic">{formatDate(c.date)}</span>
                                <span className="text-gray-500 ml-2 truncate block max-w-[300px]">{c.description}</span>
                              </div>
                            </label>
                          ))
                        ) : (
                          <p className="text-xs text-center py-3 text-gray-500">No hay controles de cambio para este proyecto.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={async () => {
                          if (!retroEntry.newDate) return showToast('La nueva fecha es obligatoria', 'error');
                          const entry = {
                            id: generateUUID(),
                            previousDate: retroEntry.previousDate || null,
                            newDate: retroEntry.newDate,
                            changeIds: retroEntry.changeIds,
                            changedAt: retroEntry.changedAt ? new Date(retroEntry.changedAt + 'T12:00:00').toISOString() : new Date().toISOString()
                          };
                          const currentHistory = editingProject.dateChangeHistory || [];
                          const newHistory = [...currentHistory, entry];
                          await supabase.from('projects').update({ date_change_history: newHistory }).eq('id', editingProject.id);
                          const updatedProject = { ...editingProject, dateChangeHistory: newHistory };
                          setEditingProject(updatedProject);
                          setFormData(prev => ({ ...prev, dateChangeHistory: newHistory }));
                          setProjects(prev => prev.map(p => p.id === editingProject.id ? updatedProject : p));
                          setShowRetroForm(false);
                          showToast('Entrada retroactiva guardada', 'success');
                        }}
                        className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-md"
                      >
                        <i className="fas fa-save"></i>
                        Guardar entrada
                      </button>
                    </div>
                  </div>
                )}

                {/* History list */}
                {editingProject.dateChangeHistory && editingProject.dateChangeHistory.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                    {editingProject.dateChangeHistory
                      .slice()
                      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                      .map((entry) => {
                        const associatedChanges = changes.filter(c => entry.changeIds.includes(c.id));
                        return (
                          <div key={entry.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-600 group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors relative">
                            <button
                              onClick={async () => {
                                if (window.confirm('¿Eliminar este registro del historial?')) {
                                  const newHistory = editingProject.dateChangeHistory?.filter(e => e.id !== entry.id) || [];
                                  await supabase.from('projects').update({ date_change_history: newHistory }).eq('id', editingProject.id);
                                  const updatedProject = { ...editingProject, dateChangeHistory: newHistory };
                                  setEditingProject(updatedProject);
                                  setFormData({ ...formData, dateChangeHistory: newHistory });
                                  setProjects(prev => prev.map(p => p.id === editingProject.id ? updatedProject : p));
                                  showToast('Registro eliminado del historial', 'success');
                                }
                              }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Eliminar registro"
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                                  {entry.previousDate ? formatDate(entry.previousDate) : 'Sin fecha previa'}
                                </span>
                                <i className="fas fa-arrow-right text-gray-400 text-xs"></i>
                                <span className="text-xs font-mono bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                                  {formatDate(entry.newDate)}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                                Cambiado: {formatDate(entry.changedAt)}
                              </span>
                            </div>
                            {associatedChanges.length > 0 ? (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 uppercase font-bold">Controles de Cambio asociados:</p>
                                <ul className="space-y-1">
                                  {associatedChanges.map(c => (
                                    <li key={c.id} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                                      <i className="fas fa-chevron-right text-[8px] text-indigo-400 mt-1 shrink-0"></i>
                                      <span><strong>Reg {c.registrationNumber || 'S/N'}:</strong> {c.description}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-400 italic mt-1">Sin control de cambio asociado</p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-600">
                    <i className="fas fa-history text-2xl mb-2 block opacity-30"></i>
                    <p className="text-xs">No hay cambios de fecha registrados.</p>
                    <p className="text-[10px] italic mt-1">Usá el botón de arriba para agregar entradas retroactivas.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Project Status Updates Section */}
          {editingProject && (
            <div className="col-span-2 border-t dark:border-slate-700 pt-6 mt-4">
              <h4 className="text-sm font-black dark:text-gray-200 mb-4 uppercase tracking-wider text-indigo-500 flex items-center gap-2 border-b pb-2 border-indigo-100 dark:border-slate-700">
                <i className="fas fa-clipboard-list"></i>
                Último Status del Proyecto
              </h4>

              {/* Add New Status */}
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 mb-6 group focus-within:border-indigo-400 transition-all">
                <label className="block text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-3 tracking-widest">
                  Nuevo Progress Update
                </label>
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    {(() => {
                      const lastCommentOfSelectedType = editingProject?.statusHistory
                        ? [...editingProject.statusHistory]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .find(u => (u.type || 'PMO') === newStatusType)?.status || ''
                        : '';

                      const handleStatusKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === 'Tab' && newStatusText === '' && lastCommentOfSelectedType) {
                          e.preventDefault();
                          setNewStatusText(lastCommentOfSelectedType);
                        }
                      };

                      return (
                        <textarea
                          placeholder={lastCommentOfSelectedType ? `[Presioná TAB para traer el último status de tipo ${newStatusType}]\n\n${lastCommentOfSelectedType}` : "Describa el estado actual de forma detallada..."}
                          className="w-full p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl resize-y bg-white dark:bg-slate-800 dark:text-white focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none min-h-[400px] text-sm leading-relaxed transition-all shadow-inner overflow-y-auto scrollbar-thin placeholder-slate-400/60 dark:placeholder-slate-500/50"
                          value={newStatusText}
                          onChange={(e) => setNewStatusText(e.target.value)}
                          onKeyDown={handleStatusKeyDown}
                        />
                      );
                    })()}
                    <div className="absolute bottom-3 right-4 flex gap-3 items-center pointer-events-none">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${newStatusText.length > 15000 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'} dark:bg-slate-700/50`}>
                        {newStatusText.length.toLocaleString()} caracteres
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
                        {newStatusText.trim() ? newStatusText.trim().split(/\s+/).length : 0} palabras
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] text-slate-400 italic mb-2">
                        <i className="fas fa-info-circle mr-1"></i>
                        Se recomienda un máximo de ~15.000 caracteres (aprox. 2-3 carillas).
                      </p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" value="PMO" checked={newStatusType === 'PMO'} onChange={(e) => setNewStatusType(e.target.value as 'PMO')} className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"/>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Seguimiento PMO</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" value="Técnico" checked={newStatusType === 'Técnico'} onChange={(e) => setNewStatusType(e.target.value as 'Técnico')} className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"/>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Seguimiento Técnico</span>
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={handleAddStatusUpdate}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-sm shadow-md hover:shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                      disabled={!newStatusText.trim()}
                    >
                      <i className="fas fa-save"></i>
                      Registrar Status
                    </button>
                  </div>
                </div>
              </div>

              {/* Status History Timeline */}
              {editingProject.statusHistory && editingProject.statusHistory.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                      <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Historial de Trazabilidad</span>
                      <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                    </div>
                    <div className="flex gap-2">
                      {['Todos', 'PMO', 'Técnico'].map(f => (
                        <button 
                          key={f}
                          onClick={() => setStatusFilter(f as any)}
                          className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${statusFilter === f ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 scrollbar-thin">
                    {editingProject.statusHistory
                      .filter(u => statusFilter === 'Todos' || (u.type || 'PMO') === statusFilter)
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((update) => (
                        <div key={update.id} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 pb-2 last:pb-0 group">
                          {/* Dot on timeline */}
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 bg-indigo-500 group-hover:scale-125 transition-transform shadow-sm"></div>

                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 shadow-sm transition-all">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${(update.type || 'PMO') === 'Técnico' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40' : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40'}`}>
                                  {update.type || 'PMO'}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400">
                                  {formatDate(update.createdAt)}
                                </span>
                              </div>
                              <button
                                onClick={async () => {
                                  if (window.confirm('¿Eliminar este status del historial?')) {
                                    const newHistory = editingProject.statusHistory?.filter(s => s.id !== update.id) || [];
                                    await supabase
                                      .from('projects')
                                      .update({ status_history: newHistory })
                                      .eq('id', editingProject.id);

                                    const updatedProject = { ...editingProject, statusHistory: newHistory };
                                    setEditingProject(updatedProject);
                                    setFormData({ ...formData, statusHistory: newHistory });
                                    setProjects(prev => prev.map(p =>
                                      p.id === editingProject.id ? updatedProject : p
                                    ));
                                    showToast('Status eliminado del historial', 'success');
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar status"
                              >
                                <i className="fas fa-trash text-xs"></i>
                              </button>
                            </div>

                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap break-words">
                              {renderTextWithLinks(update.status)}
                            </p>

                            <div className="mt-3 pt-2 border-t border-slate-50 dark:border-slate-800 flex justify-end">
                              <span className="text-[9px] text-slate-400 italic">
                                Cargado por: {update.createdBy || 'Desconocido'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="col-span-2 bg-blue-50 dark:bg-slate-800 p-3 rounded text-sm text-blue-800 dark:text-blue-300 flex items-center border border-blue-100 dark:border-slate-600">
            <i className="fas fa-info-circle mr-2"></i> Para gestionar el presupuesto detallado (Hardware, Servicios, Viáticos, etc.), utilice el módulo "Control de Costos" tras crear el proyecto.
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-slate-700">
          <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg font-medium transition-transform hover:scale-105">Guardar Proyecto</button>
        </div>
      </Modal >

      {
        reportProject && (
          <ProjectReport
            projects={[reportProject]}
            risks={risks}
            changes={changes}
            lessons={lessons}
            expenses={expenses}
            onClose={() => setReportProject(null)}
          />
        )
      }

      {
        showBulkReport && (
          <ProjectReport
            projects={projects.filter(p => selectedProjectIds.includes(p.id))}
            risks={risks}
            changes={changes}
            lessons={lessons}
            expenses={expenses}
            onClose={() => setShowBulkReport(false)}
          />
        )
      }
    </div >
  );
};