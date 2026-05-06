import React, { useRef, useState } from 'react';
import { Project, Risk, Change, LessonLearned, Milestone, Expense } from '../types';
import { calculateProjectHealth, formatDate } from '../utils/helpers';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ProjectReportProps {
    projects: Project[];
    risks: Risk[];
    changes: Change[];
    lessons: LessonLearned[];
    expenses: Expense[];
    onClose: () => void;
}

export const ProjectReport: React.FC<ProjectReportProps> = ({
    projects, risks, changes, lessons, expenses, onClose
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const generatePDF = async () => {
        if (!containerRef.current || isGenerating) return;
        setIsGenerating(true);

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pages = containerRef.current.querySelectorAll('.report-page');

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                const canvas = await html2canvas(page, {
                    scale: 3, // High scale for crisp text
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    windowWidth: 1200, // Fixed width for consistent layout calculation
                    onclone: (clonedDoc) => {
                        const style = clonedDoc.createElement('style');
                        style.innerHTML = `
                            .report-page { 
                                transform: none !important; 
                                -webkit-font-smoothing: antialiased;
                                -moz-osx-font-smoothing: grayscale;
                            }
                            .truncate { overflow: visible !important; white-space: normal !important; }
                        `;
                        clonedDoc.head.appendChild(style);
                    }
                });

                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            }

            const fileName = projects.length === 1
                ? `Reporte_Ejecutivo_${projects[0].opportunityNumber || 'S-N'}_${projects[0].name.replace(/\s+/g, '_')}.pdf`
                : `Reporte_Consolidado_PMO_${new Date().toISOString().split('T')[0]}.pdf`;

            pdf.save(fileName);
            onClose();
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-black text-gray-800 dark:text-white">
                            {projects.length > 1 ? `Consolidando ${projects.length} Proyectos` : 'Vista Previa de Reporte Ejecutivo'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isGenerating ? 'Generando documento... por favor espere.' : 'Se generará un documento PDF consolidado.'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold" disabled={isGenerating}>Cancelar</button>
                        <button
                            onClick={async () => {
                                const projectName = projects.length === 1 ? projects[0].name : "Consolidado_PMO";

                                const htmlHead = `
                                    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                                    <head>
                                        <meta charset='utf-8'>
                                        <!--[if gte mso 9]>
                                        <xml>
                                            <w:WordDocument>
                                                <w:View>Print</w:View>
                                                <w:Zoom>100</w:Zoom>
                                                <w:DoNotOptimizeForBrowser/>
                                            </w:WordDocument>
                                        </xml>
                                        <![endif]-->
                                        <style>
                                            @page { size: A4; margin: 1.5cm; }
                                            body { font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif; color: #1e293b; line-height: 1.4; font-size: 10.5pt; }
                                            .report-page { mso-element:header; page-break-after: always; padding-bottom: 30pt; }
                                            .header-table { width: 100%; border-bottom: 6pt solid #4f46e5; margin-bottom: 20pt; }
                                            .project-title { font-size: 24pt; font-weight: bold; color: #0f172a; margin: 0; text-transform: uppercase; }
                                            .sub-header { font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 5pt; }
                                            .badge { background-color: #4f46e5; color: #ffffff; padding: 6pt 12pt; border-radius: 5pt; font-weight: bold; font-size: 11pt; }
                                            .kpi-table { width: 100%; border-collapse: separate; border-spacing: 10pt; margin: 10pt -10pt; }
                                            .kpi-box { background-color: #f8fafc; border: 1pt solid #e2e8f0; padding: 12pt; text-align: center; border-bottom: 3pt solid #cbd5e1; }
                                            .kpi-label { font-size: 7.5pt; font-weight: bold; color: #64748b; text-transform: uppercase; }
                                            .kpi-value { font-size: 16pt; font-weight: bold; color: #4f46e5; }
                                            .section-title { font-size: 10.5pt; font-weight: bold; color: #4338ca; text-transform: uppercase; margin-bottom: 10pt; border-bottom: 1pt solid #e2e8f0; padding-bottom: 4pt; margin-top: 15pt; }
                                            .main-layout { width: 100%; border-collapse: collapse; }
                                            .col-left { width: 35%; vertical-align: top; padding-right: 20pt; }
                                            .col-right { width: 65%; vertical-align: top; }
                                            .card { background-color: #ffffff; border: 1pt solid #f1f5f9; padding: 12pt; border-left: 2pt solid #6366f1; margin-bottom: 15pt; }
                                            .ai-summary { background-color: #f5f3ff; border: 1pt solid #ddd6fe; border-left: 5pt solid #8b5cf6; padding: 15pt; color: #4338ca; font-style: italic; margin-bottom: 20pt; }
                                            .timeline-table { width: 100%; background-color: #0f172a; color: #ffffff; border-radius: 8pt; padding: 10pt; }
                                            .footer { font-size: 8pt; color: #94a3b8; border-top: 1pt solid #f1f5f9; padding-top: 10pt; text-align: center; margin-top: 30pt; }
                                            .data-label { color: #64748b; font-size: 9pt; }
                                            .data-value { font-weight: bold; font-size: 9.5pt; text-align: right; }
                                        </style>
                                    </head>
                                    <body>
                                `;

                                const htmlContent = projects.map(project => {
                                    const projectRisks = risks.filter(r => r.projectId === project.id);
                                    const projectChanges = changes.filter(c => c.projectId === project.id);
                                    const projectMilestones = (project.milestones || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                    const isDelayed = project.realEndDate && new Date(project.realEndDate) > new Date(project.theoreticalEndDate);
                                    const health = project.healthStatus === 'Auto' ? calculateProjectHealth(project, expenses) : project.healthStatus;
                                    const healthEmoji = health === 'Verde' ? '🟢' : health === 'Amarillo' ? '🟡' : '🔴';
                                    const ventaTotal = (project.hwValue || 0) + (project.servicesValue || 0);

                                    return `
                                        <div class="report-page">
                                            <!-- CABECERA -->
                                            <table class="header-table" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                <tr>
                                                    <td width="70%" style="padding-bottom: 15pt;">
                                                        <div class="project-title">${project.name}</div>
                                                        <div class="sub-header">CLIENTE: ${project.clientName} | OPP: ${project.opportunityNumber} | PM: ${project.pm}</div>
                                                        <div style="font-size: 9pt; font-weight: bold; color: #6366f1;">
                                                            ${project.vertical ? 'VERTICAL: ' + project.vertical : ''} 
                                                            ${project.segment ? ' | SEGMENTO: ' + project.segment : ''}
                                                        </div>
                                                    </td>
                                                    <td width="30%" align="right" valign="top">
                                                        <div class="badge">${project.status.toUpperCase()}</div>
                                                        <div style="font-size: 10pt; font-weight: bold; margin-top: 10pt;">SALUD: ${healthEmoji} ${health}</div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <!-- KPIs -->
                                            <table class="kpi-table" width="100%" cellspacing="10" cellpadding="0" border="0">
                                                <tr>
                                                    <td width="25%" align="center"><div class="kpi-box"><div class="kpi-label">Avance Real</div><div class="kpi-value">${project.progress}%</div></div></td>
                                                    <td width="25%" align="center"><div class="kpi-box"><div class="kpi-label">Margen CM%</div><div class="kpi-value" style="color: #059669">${project.cm}%</div></div></td>
                                                    <td width="25%" align="center"><div class="kpi-box"><div class="kpi-label">Días Desvío</div><div class="kpi-value" style="color: ${isDelayed ? '#ef4444' : '#059669'}">${project.realEndDate ? Math.max(0, Math.ceil((new Date(project.realEndDate).getTime() - new Date(project.theoreticalEndDate).getTime()) / (1000 * 3600 * 24))) : 0}</div></div></td>
                                                    <td width="25%" align="center"><div class="kpi-box"><div class="kpi-label">Hitos Cobrados</div><div class="kpi-value">${projectMilestones.filter(m => m.isReceived).length}/${projectMilestones.length}</div></div></td>
                                                </tr>
                                            </table>

                                            <!-- CONTENIDO PRINCIPAL -->
                                            <table class="main-layout" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                <tr>
                                                    <td class="col-left">
                                                        <div class="section-title">📊 Datos Financieros</div>
                                                        <div class="card">
                                                            <table width="100%" cellspacing="0" cellpadding="2">
                                                                <tr><td class="data-label">Venta HW</td><td class="data-value">USD ${(project.hwValue || 0).toLocaleString()}</td></tr>
                                                                <tr><td class="data-label">Venta Servicios</td><td class="data-value">USD ${(project.servicesValue || 0).toLocaleString()}</td></tr>
                                                                <tr style="color: #4f46e5;"><td style="font-weight: bold; padding-top: 5pt; border-top: 1pt solid #e2e8f0;">TOTAL VENTA</td><td style="font-weight: bold; text-align: right; padding-top: 5pt; border-top: 1pt solid #e2e8f0;">USD ${ventaTotal.toLocaleString()}</td></tr>
                                                                <tr><td class="data-label" style="padding-top: 8pt;">Costo HW</td><td class="data-value" style="padding-top: 8pt;">USD ${(project.hwCost || 0).toLocaleString()}</td></tr>
                                                                <tr><td class="data-label">Costo Servicios</td><td class="data-value">USD ${(project.servicesCost || 0).toLocaleString()}</td></tr>
                                                                ${project.ocValue ? `<tr style="background-color: #f0fdf4;"><td style="color: #166534; font-weight: bold; font-size: 8pt;">VALOR OC</td><td style="color: #166534; font-weight: bold; font-size: 9pt; text-align: right;">USD ${project.ocValue.toLocaleString()}</td></tr>` : ''}
                                                            </table>
                                                        </div>

                                                        <div class="section-title">📜 Control de Cambios</div>
                                                        <div class="card" style="border-left-color: #f59e0b;">
                                                            ${projectChanges.length > 0 ? projectChanges.slice(0, 3).map(c => `
                                                                <div style="font-size: 8.5pt; margin-bottom: 8pt; border-bottom: 0.5pt solid #f1f5f9; padding-bottom: 4pt;">
                                                                    <div style="font-weight: bold; color: #b45309;">${c.registrationNumber || 'TP-CR'} (${formatDate(c.date)})</div>
                                                                    <div style="color: #475569;">${c.description}</div>
                                                                </div>
                                                            `).join('') : '<div style="font-size: 9pt; color: #94a3b8; font-style: italic;">Sin cambios relevantes</div>'}
                                                        </div>
                                                    </td>
                                                    <td class="col-right">
                                                        <div class="section-title">📅 Línea de Tiempo</div>
                                                        <table class="timeline-table" width="100%" cellspacing="0" cellpadding="5">
                                                            <tr>
                                                                <td width="33%"><div style="font-size: 7.5pt; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Inicio</div><div style="font-weight: bold;">${formatDate(project.startDate)}</div></td>
                                                                <td width="33%"><div style="font-size: 7.5pt; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Fin Teórico</div><div style="font-weight: bold;">${formatDate(project.theoreticalEndDate)}</div></td>
                                                                <td width="33%"><div style="font-size: 7.5pt; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Estado Real</div><div style="font-weight: bold; color: ${isDelayed ? '#fda4af' : '#6ee7b7'};">${project.realEndDate ? formatDate(project.realEndDate) : 'En Cronograma'}</div></td>
                                                            </tr>
                                                        </table>

                                                        <div class="section-title">✨ Resumen Ejecutivo Consolidado</div>
                                                        <div class="ai-summary">
                                                            ${project.aiSummary || '<i>No se ha generado un resumen ejecutivo para este proyecto aún. Por favor, utilice la función "Generar Resumen" en la plataforma para consolidar los comentarios del historial.</i>'}
                                                            
                                                            ${(project.statusHistory || []).length > 0 ? `
                                                            <div style="margin-top: 15pt; border-top: 1pt solid #ddd6fe; padding-top: 10pt; font-size: 8.5pt; color: #4338ca; font-style: normal;">
                                                                <b>Nota de Gestión:</b> Este resumen sintetiza un historial de ${(project.statusHistory || []).length} actualizaciones de status registradas desde el inicio del proyecto hasta la fecha.
                                                            </div>
                                                            ` : ''}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>

                                            <div class="footer">
                                                Reporte Ejecutivo de Gestión • BGH Tech Partner • Documento Generado el ${new Date().toLocaleDateString('es-AR')}
                                            </div>
                                        </div>
                                    `;
                                }).join('');

                                const htmlFooter = `</body></html>`;
                                const fullHtml = htmlHead + htmlContent + htmlFooter;

                                const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `Reporte_Ejecutivo_${projectName.replace(/\s+/g, '_')}.doc`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                            }}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all transform flex items-center gap-2 hover:scale-105"
                        >
                            <i className="fas fa-file-word"></i>
                            Descargar editable (Word)
                        </button>
                        <button
                            onClick={generatePDF}
                            disabled={isGenerating}
                            className={`px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all transform flex items-center gap-2 ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-pdf"></i>}
                            {isGenerating ? 'Generando...' : 'Descargar PDF'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-200 dark:bg-slate-950">
                    <div ref={containerRef} className="space-y-8 flex flex-col items-center">
                        {projects.map((project, idx) => {
                            const projectRisks = risks.filter(r => r.projectId === project.id);
                            const projectChanges = changes.filter(c => c.projectId === project.id);
                            const projectLessons = lessons.filter(l => l.projectId === project.id);
                            const projectExpenses = expenses.filter(e => e.projectId === project.id);
                            const projectMilestones = (project.milestones || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            const totalExpenses = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
                            const isDelayed = project.realEndDate && new Date(project.realEndDate) > new Date(project.theoreticalEndDate);

                            return (
                                <div
                                    key={project.id}
                                    className="report-page bg-white text-slate-900 p-12 shadow-sm w-[794px] min-h-[1123px] font-sans relative text-[12px] shrink-0"
                                    style={{ color: '#1e293b', lineHeight: '1.4' }}
                                >
                                    {/* Header */}
                                    <div className="flex justify-between items-start border-b-4 border-indigo-600 pb-6 mb-6">
                                        <div>
                                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-1">{project.name}</h1>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                                                <span>Cliente: {project.clientName}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>OPP: {project.opportunityNumber}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>PM: {project.pm}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[9px] font-black uppercase text-indigo-500">
                                                {project.vertical && (
                                                    <span className="bg-indigo-50 px-2 py-0.5 rounded">Vertical: {project.vertical}</span>
                                                )}
                                                {project.segment && (
                                                    <span className="bg-indigo-50 px-2 py-0.5 rounded">Segmento: {project.segment}</span>
                                                )}
                                                {project.vendors && project.vendors.length > 0 && (
                                                    <span className="bg-indigo-50 px-2 py-0.5 rounded">Vendors: {project.vendors.join(', ')}</span>
                                                )}
                                            </div>
                                            {project.documentationLink && (
                                                <p className="text-[9px] text-indigo-400 font-bold mt-2 flex items-center gap-1">
                                                    <i className="fas fa-folder-open"></i> Link:
                                                    <span className="text-slate-400 font-medium truncate max-w-[400px]">{project.documentationLink}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-sm mb-1 inline-block">
                                                {project.status.toUpperCase()}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold">Salud: {project.healthStatus === 'Auto' ? calculateProjectHealth(project, expenses) : project.healthStatus}</p>
                                        </div>
                                    </div>

                                    {/* Top KPIs */}
                                    <div className="grid grid-cols-4 gap-4 mb-6">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Avance Real</p>
                                            <p className="text-xl font-black text-indigo-600">{project.progress}%</p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Margen (CM%)</p>
                                            <p className="text-xl font-black text-emerald-600">{project.cm}%</p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Días de Desvío</p>
                                            <p className={`text-xl font-black ${isDelayed ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {project.realEndDate ? (
                                                    Math.max(0, Math.ceil((new Date(project.realEndDate).getTime() - new Date(project.theoreticalEndDate).getTime()) / (1000 * 3600 * 24)))
                                                ) : 0}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Hitos Cobrados</p>
                                            <p className="text-xl font-black text-slate-700">
                                                {projectMilestones.filter(m => m.isReceived).length} / {projectMilestones.length}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Content Grid */}
                                    <div className="grid grid-cols-12 gap-6 mb-6">
                                        {/* Left Column - 5 cols */}
                                        <div className="col-span-5 space-y-6">
                                            <section className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                                <h4 className="text-[10px] font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                                                    <i className="fas fa-hand-holding-usd"></i> Datos Financieros
                                                </h4>
                                                <div className="space-y-2 text-[10px]">
                                                    <div className="flex justify-between py-1 border-b border-slate-200/50"><span>Venta HW</span><span className="font-bold">USD {(project.hwValue || 0).toLocaleString()}</span></div>
                                                    <div className="flex justify-between py-1 border-b border-slate-200/50"><span>Venta Serv.</span><span className="font-bold">USD {(project.servicesValue || 0).toLocaleString()}</span></div>
                                                    <div className="flex justify-between py-1 border-b border-indigo-200 text-indigo-700 font-extrabold"><span>Total Venta</span><span>USD {((project.hwValue || 0) + (project.servicesValue || 0)).toLocaleString()}</span></div>
                                                    <div className="flex justify-between py-1 border-b border-slate-200/50 mt-1"><span>Costo HW</span><span className="font-bold">USD {(project.hwCost || 0).toLocaleString()}</span></div>
                                                    <div className="flex justify-between py-1 border-b border-slate-200/50"><span>Costo Serv.</span><span className="font-bold">USD {(project.servicesCost || 0).toLocaleString()}</span></div>
                                                    <div className="flex justify-between py-1 border-b border-slate-200 text-slate-700 font-bold"><span>Total Costo Est.</span><span>USD {((project.hwCost || 0) + (project.servicesCost || 0)).toLocaleString()}</span></div>
                                                    {project.ocValue && (
                                                        <div className="flex justify-between py-1 mt-1 bg-emerald-50 -mx-2 px-2 rounded font-black text-emerald-700">
                                                            <span>Valor OC</span>
                                                            <span>USD {project.ocValue.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>

                                            <section className="p-4 bg-white rounded-2xl border border-slate-100">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 px-1">Control de Cambios</h4>
                                                {projectChanges.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {projectChanges.slice(0, 3).map(c => (
                                                            <div key={c.id} className="text-[9px] border-l-2 border-indigo-400 pl-2 py-1">
                                                                <p className="font-black text-slate-700">{c.registrationNumber || 'DOC-S/N'}</p>
                                                                <p className="text-slate-500 leading-tight italic truncate">{c.description}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-[9px] text-slate-300 italic px-1">Sin cambios registrados</p>}
                                            </section>

                                            <section className="p-4 bg-white rounded-2xl border border-slate-100">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 px-1">Lecciones Aprendidas</h4>
                                                {projectLessons.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {projectLessons.slice(0, 2).map(l => (
                                                            <div key={l.id} className="text-[9px] bg-emerald-50/50 p-2 rounded leading-tight border border-emerald-100/50">
                                                                <span className="font-bold text-emerald-700">{l.category}: </span>
                                                                <span className="text-slate-600 italic">"{l.description}"</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-[9px] text-slate-300 italic px-1">Sin lecciones cargadas</p>}
                                            </section>
                                        </div>

                                        {/* Right Column - 7 cols */}
                                        <div className="col-span-7 space-y-6">
                                            <section className="bg-slate-900 text-white p-5 rounded-2xl shadow-indigo-500/10 shadow-lg">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-[11px] font-black uppercase flex items-center gap-2">
                                                        <i className="fas fa-history text-indigo-400"></i> Línea de Tiempo
                                                    </h4>
                                                    {project.thirdPartyServices && (
                                                        <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded font-black">
                                                            P. Terceros: {project.thirdPartyProvider || 'Si'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-3 gap-6 mb-4">
                                                    <div>
                                                        <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Inicio</p>
                                                        <p className="text-sm font-bold">{formatDate(project.startDate)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Fin Teórico</p>
                                                        <p className="text-sm font-bold">{formatDate(project.theoreticalEndDate)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Estimado Real</p>
                                                        <p className={`text-sm font-bold ${isDelayed ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {project.realEndDate ? formatDate(project.realEndDate) : 'En curso'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="bg-indigo-500 h-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${project.progress}%` }}></div>
                                                </div>
                                            </section>

                                            <section className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-5">
                                                    <i className="fas fa-brain fa-4x text-indigo-600"></i>
                                                </div>
                                                <h4 className="text-[10px] font-black text-indigo-600 uppercase mb-3 flex items-center gap-2">
                                                    <i className="fas fa-magic"></i> Resumen Ejecutivo Consolidado
                                                </h4>
                                                <div className="text-[10px] text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                                                    {project.aiSummary || (
                                                        <div className="bg-white/80 p-4 rounded-xl border border-dashed border-indigo-200 text-center text-slate-400">
                                                            No se ha generado el resumen ejecutivo para este reporte.<br />
                                                            <span className="text-[8px] font-bold">Por favor, utilice "GENERAR RESUMEN" en la edición del proyecto.</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {project.aiSummary && project.statusHistory && (
                                                    <div className="mt-4 pt-4 border-t border-indigo-100 flex justify-between items-center">
                                                        <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider">
                                                            Analizadas {project.statusHistory.length} actualizaciones de status
                                                        </span>
                                                        <span className="text-[8px] text-slate-300 font-medium">BGH Tech Partner • AI Engine</span>
                                                    </div>
                                                )}
                                            </section>

                                            <section className="p-4 bg-slate-50/30 rounded-2xl border border-slate-100">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3">Principales Riesgos</h4>
                                                {projectRisks.length > 0 ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {projectRisks.slice(0, 4).map(r => (
                                                            <div key={r.id} className={`p-2 rounded text-[8px] border shrink-0 ${r.isProblem ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                                                <p className="font-black mb-1">{r.isProblem ? 'PROBLEMA' : 'RIESGO'}</p>
                                                                <p className="line-clamp-2 leading-tight">{r.description}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-[9px] text-slate-300 italic">Sin riesgos críticos</p>}
                                            </section>
                                        </div>
                                    </div>

                                    {/* Footer Info */}
                                    {project.valuesComments && (
                                        <div className="mt-2 p-3 bg-amber-50/30 border border-amber-100 rounded-xl">
                                            <p className="text-[8px] font-black text-amber-600 uppercase mb-1">Observaciones Financieras/Generales:</p>
                                            <p className="text-[9px] text-slate-600 italic whitespace-pre-wrap">"{project.valuesComments}"</p>
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div className="absolute bottom-8 left-12 right-12 flex justify-between items-center text-[8px] text-slate-300 font-bold border-t pt-4">
                                        <div className="flex items-center gap-2">
                                            <i className="fas fa-cubes text-slate-200"></i>
                                            <span className="uppercase tracking-widest">Reporte Ejecutivo • PMO BGH Tech Partner</span>
                                        </div>
                                        <span>Documento generado el {new Date().toLocaleDateString()} a las {new Date().toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
