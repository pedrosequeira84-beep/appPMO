import ExcelJS from 'exceljs';
import { Project, Change } from '../types';
import { formatDate } from './helpers';

// Calcula la diferencia en días robustamente a las 12:00 para evitar desvíos horarias/zona horaria
export const getDaysDiff = (startStr: string | null | undefined, endStr: string | null | undefined): number => {
  if (!startStr || !endStr) return 0;
  const d1 = new Date(startStr.split('T')[0] + 'T12:00:00');
  const d2 = new Date(endStr.split('T')[0] + 'T12:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const exportTimelineToExcel = async (projects: Project[], changes: Change[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Desvíos y Cambios', {
    views: [{ showGridLines: true }]
  });

  const defaultFont = { name: 'Aptos Narrow', size: 10, color: { argb: 'FF000000' } };
  const borderThinBlack = {
    top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }
  };

  // 1. Título General
  worksheet.mergeCells('A2:P2');
  const cellTitle = worksheet.getCell('A2');
  cellTitle.value = 'REPORTE DE DESVÍOS DE CRONOGRAMA Y CONTROL DE CAMBIOS';
  cellTitle.font = { name: 'Aptos Narrow', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
  cellTitle.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.mergeCells('A3:P3');
  const cellSub = worksheet.getCell('A3');
  const todayStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  cellSub.value = `Generado el: ${todayStr} • PMO BGH Tech Partner`;
  cellSub.font = { name: 'Aptos Narrow', size: 9, italic: true, color: { argb: 'FF6B7280' } };
  cellSub.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.getRow(1).height = 10;
  worksheet.getRow(2).height = 25;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 15; // Fila vacía de margen

  // 2. Definición de Columnas
  const colsConfig = [
    { key: 'opp', header: 'Oportunidad', width: 16 },
    { key: 'client', header: 'Cliente', width: 22 },
    { key: 'name', header: 'Proyecto', width: 35 },
    { key: 'pm', header: 'PM', width: 18 },
    { key: 'status', header: 'Estado', width: 15 },
    { key: 'start', header: 'F. Inicio', width: 13 },
    { key: 'theoretical', header: 'Fin Teórico', width: 13 },
    { key: 'real', header: 'Fin Real', width: 13 },
    { key: 'net_diff', header: 'Desvío Neto', width: 15 },
    { key: 'event_idx', header: 'Evento #', width: 10 },
    { key: 'change_date', header: 'Fecha Cambio', width: 14 },
    { key: 'prev_date', header: 'Fecha Prev.', width: 13 },
    { key: 'new_date', header: 'Fecha Nueva', width: 13 },
    { key: 'change_diff', header: 'Impacto (Días)', width: 14 },
    { key: 'change_ref', header: 'Ref. CC', width: 18 },
    { key: 'change_desc', header: 'Justificación / Alcance del Cambio', width: 50 }
  ];

  colsConfig.forEach((cfg, idx) => {
    const colLetter = String.fromCharCode(65 + idx);
    const col = worksheet.getColumn(idx + 1);
    col.width = cfg.width;
  });

  // 3. Escribir Cabecera de la Tabla (Fila 5)
  const headerRow = worksheet.getRow(5);
  headerRow.height = 28;

  colsConfig.forEach((cfg, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = cfg.header;
    cell.font = { name: 'Aptos Narrow', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E1B4B' } // Índigo muy oscuro
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThinBlack;
  });

  // 4. Rellenar Datos con Celdas Combinadas Inteligentes
  let currentRow = 6;
  
  projects.forEach((proj, projIdx) => {
    const history = proj.dateChangeHistory || [];
    const hasHistory = history.length > 0;
    const rowsNeeded = hasHistory ? history.length : 1;
    const endRow = currentRow + rowsNeeded - 1;

    // Alternar fondo del grupo de proyecto (Zebra por proyecto para legibilidad)
    const isEvenProj = projIdx % 2 === 0;
    const bgGroupColor = isEvenProj ? 'FFFFFFFF' : 'FFF8FAFC'; // Blanco vs Gris muy suave
    const groupFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: bgGroupColor }
    };

    // Calcular Desvío Neto
    const netDeviation = proj.realEndDate ? getDaysDiff(proj.theoreticalEndDate, proj.realEndDate) : 0;

    // Escribir datos de metadatos (A a I) para las filas asignadas a este proyecto
    for (let r = currentRow; r <= endRow; r++) {
      const row = worksheet.getRow(r);
      row.height = 20;

      // Col A: Oportunidad
      const cellOpp = row.getCell(1);
      cellOpp.value = proj.opportunityNumber || 'S/N';
      cellOpp.alignment = { horizontal: 'center', vertical: 'middle' };

      // Col B: Cliente
      const cellClient = row.getCell(2);
      cellClient.value = proj.clientName || 'S/D';
      cellClient.alignment = { horizontal: 'left', vertical: 'middle' };

      // Col C: Nombre
      const cellName = row.getCell(3);
      cellName.value = proj.name;
      cellName.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

      // Col D: PM
      const cellPM = row.getCell(4);
      cellPM.value = proj.pm || 'Sin PM';
      cellPM.alignment = { horizontal: 'left', vertical: 'middle' };

      // Col E: Estado
      const cellStatus = row.getCell(5);
      cellStatus.value = proj.status;
      cellStatus.alignment = { horizontal: 'center', vertical: 'middle' };

      // Col F: F. Inicio
      const cellStart = row.getCell(6);
      cellStart.value = proj.startDate ? new Date(proj.startDate + 'T12:00:00') : '';
      cellStart.numFmt = 'dd/mm/yyyy';
      cellStart.alignment = { horizontal: 'center', vertical: 'middle' };

      // Col G: F. Fin Teórica
      const cellTheo = row.getCell(7);
      cellTheo.value = proj.theoreticalEndDate ? new Date(proj.theoreticalEndDate + 'T12:00:00') : '';
      cellTheo.numFmt = 'dd/mm/yyyy';
      cellTheo.alignment = { horizontal: 'center', vertical: 'middle' };

      // Col H: F. Fin Real Actual
      const cellReal = row.getCell(8);
      cellReal.value = proj.realEndDate ? new Date(proj.realEndDate + 'T12:00:00') : (proj.theoreticalEndDate ? new Date(proj.theoreticalEndDate + 'T12:00:00') : '');
      cellReal.numFmt = 'dd/mm/yyyy';
      cellReal.alignment = { horizontal: 'center', vertical: 'middle' };

      // Col I: Desvío Neto (Días)
      const cellNet = row.getCell(9);
      cellNet.value = netDeviation;
      cellNet.numFmt = '#,##0';
      cellNet.alignment = { horizontal: 'right', vertical: 'middle' };
      if (netDeviation > 0) {
        cellNet.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' } // Rojo suave
        };
        cellNet.font = { ...defaultFont, bold: true, color: { argb: 'FF991B1B' } };
      } else {
        cellNet.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDCFCE7' } // Verde suave
        };
        cellNet.font = { ...defaultFont, bold: true, color: { argb: 'FF166534' } };
      }

      // Aplicar estilos comunes (fuente, bordes, fondo de zebra) a las columnas de metadatos
      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        if (c !== 9) { // Mantener fuente estándar excepto en desvío neto
          cell.font = defaultFont;
          cell.fill = groupFill;
        }
        cell.border = borderThinBlack;
      }
    }

    // Combinar las celdas de metadatos si el proyecto tiene múltiples filas
    if (rowsNeeded > 1) {
      for (let colIdx = 1; colIdx <= 9; colIdx++) {
        const colLetter = String.fromCharCode(65 + colIdx - 1);
        worksheet.mergeCells(`${colLetter}${currentRow}:${colLetter}${endRow}`);
      }
    }

    // Escribir los detalles de cambios de fechas (Columnas J a P)
    if (hasHistory) {
      history.forEach((entry, idx) => {
        const activeRow = currentRow + idx;
        const row = worksheet.getRow(activeRow);

        // Col J: Evento #
        const cellEv = row.getCell(10);
        cellEv.value = idx + 1;
        cellEv.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col K: Fecha de Cambio
        const cellChgDate = row.getCell(11);
        cellChgDate.value = entry.changedAt ? new Date(entry.changedAt) : '';
        cellChgDate.numFmt = 'dd/mm/yyyy';
        cellChgDate.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col L: Fecha Anterior
        const cellPrev = row.getCell(12);
        cellPrev.value = entry.previousDate ? new Date(entry.previousDate + 'T12:00:00') : '';
        cellPrev.numFmt = 'dd/mm/yyyy';
        cellPrev.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col M: Fecha Nueva
        const cellNew = row.getCell(13);
        cellNew.value = entry.newDate ? new Date(entry.newDate + 'T12:00:00') : '';
        cellNew.numFmt = 'dd/mm/yyyy';
        cellNew.alignment = { horizontal: 'center', vertical: 'middle' };

        // Col N: Impacto (Días corrido)
        const cellDiff = row.getCell(14);
        const shiftDays = entry.previousDate ? getDaysDiff(entry.previousDate, entry.newDate) : 0;
        cellDiff.value = shiftDays;
        cellDiff.numFmt = '#,##0';
        cellDiff.alignment = { horizontal: 'right', vertical: 'middle' };
        if (shiftDays > 0) {
          cellDiff.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEE2E2' }
          };
          cellDiff.font = { ...defaultFont, bold: true, color: { argb: 'FF991B1B' } };
        } else {
          cellDiff.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDCFCE7' }
          };
          cellDiff.font = { ...defaultFont, bold: true, color: { argb: 'FF166534' } };
        }

        // Buscar controles de cambio asociados
        const associatedChanges = changes.filter(c => entry.changeIds.includes(c.id));
        const refCodes = associatedChanges.map(c => c.registrationNumber || 'S/N').join(', ') || 'N/A';
        const justifications = associatedChanges.map(c => c.description).join(' | ') || 'Sin justificación detallada';

        // Col O: Ref CC
        const cellRef = row.getCell(15);
        cellRef.value = refCodes;
        cellRef.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Col P: Justificación
        const cellDesc = row.getCell(16);
        cellDesc.value = justifications;
        cellDesc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Estilos comunes para columnas J a P
        for (let c = 10; c <= 16; c++) {
          const cell = row.getCell(c);
          if (c !== 14) { // Excepto en Impacto Días que ya tiene fuente bold coloreada
            cell.font = defaultFont;
            cell.fill = groupFill;
          }
          cell.border = borderThinBlack;
        }
      });
    } else {
      // Sin historial registrado
      const row = worksheet.getRow(currentRow);
      
      // Vaciar J a M
      for (let c = 10; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.value = '-';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = defaultFont;
        cell.fill = groupFill;
        cell.border = borderThinBlack;
      }

      // Col N: Impacto = 0
      const cellDiff = row.getCell(14);
      cellDiff.value = 0;
      cellDiff.numFmt = '#,##0';
      cellDiff.alignment = { horizontal: 'right', vertical: 'middle' };
      cellDiff.font = defaultFont;
      cellDiff.fill = groupFill;
      cellDiff.border = borderThinBlack;

      // Col O: Ref CC = Sin desvíos
      const cellRef = row.getCell(15);
      cellRef.value = 'Sin desvíos';
      cellRef.alignment = { horizontal: 'center', vertical: 'middle' };
      cellRef.font = { ...defaultFont, italic: true };
      cellRef.fill = groupFill;
      cellRef.border = borderThinBlack;

      // Col P: Justificación = Al día
      const cellDesc = row.getCell(16);
      cellDesc.value = 'El proyecto se encuentra alineado al cronograma original.';
      cellDesc.alignment = { horizontal: 'left', vertical: 'middle' };
      cellDesc.font = { ...defaultFont, italic: true, color: { argb: 'FF6B7280' } };
      cellDesc.fill = groupFill;
      cellDesc.border = borderThinBlack;
    }

    currentRow = endRow + 1;
  });

  // 5. Generar Archivo y Descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const todayDateStr = new Date().toISOString().split('T')[0];
  a.download = `Reporte_PMO_Desvios_Tiempos_${todayDateStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const downloadTimelineWordReport = (projects: Project[], changes: Change[]) => {
  const todayStr = new Date().toLocaleDateString('es-AR');
  const docName = `Reporte_Sintetico_Desvios_PMO_${new Date().toISOString().split('T')[0]}`;

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
        @page { size: A4; margin: 2cm; }
        body { font-family: 'Calibri', 'Arial', sans-serif; color: #334155; line-height: 1.5; font-size: 11pt; }
        h1 { font-size: 20pt; font-weight: bold; color: #1e3a8a; border-bottom: 2pt solid #1e3a8a; padding-bottom: 6pt; margin-bottom: 12pt; text-transform: uppercase; }
        h2 { font-size: 14pt; font-weight: bold; color: #0f172a; margin-top: 24pt; margin-bottom: 10pt; border-bottom: 0.5pt solid #cbd5e1; padding-bottom: 3pt; }
        p { margin: 0 0 10pt 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15pt; }
        th { background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: left; padding: 6pt 8pt; font-size: 9.5pt; border: 1pt solid #cbd5e1; }
        td { padding: 6pt 8pt; font-size: 9pt; border: 1pt solid #cbd5e1; vertical-align: top; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .badge-red { background-color: #fee2e2; color: #991b1b; padding: 2pt 6pt; border-radius: 4pt; font-weight: bold; }
        .badge-green { background-color: #dcfce7; color: #166534; padding: 2pt 6pt; border-radius: 4pt; font-weight: bold; }
        .timeline-title { font-size: 10pt; font-weight: bold; color: #312e81; margin-top: 5pt; }
        .footer { font-size: 8.5pt; color: #64748b; text-align: center; border-top: 1pt solid #e2e8f0; padding-top: 10pt; margin-top: 30pt; }
        .meta-table { width: 100%; background-color: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 6pt; padding: 10pt; margin-bottom: 12pt; }
        .meta-label { color: #64748b; font-weight: bold; font-size: 9.5pt; }
        .meta-val { font-weight: bold; font-size: 9.5pt; color: #0f172a; }
      </style>
    </head>
    <body>
      <h1>INFORME SEMESTRAL: AUDITORÍA DE CRONOGRAMAS Y CAMBIOS</h1>
      <p><strong>Fecha de Emisión:</strong> ${todayStr}</p>
      <p><strong>Elaborado por:</strong> Oficina de Gestión de Proyectos (PMO) • BGH Tech Partner</p>
      <p>Este informe consolida el estado de la línea de tiempo de los proyectos activos y en ejecución, detallando los desvíos entre la planificación teórica original y el cronograma real estimado actual, respaldados por sus correspondientes Controles de Cambio aprobados y justificados.</p>
  `;

  const htmlContent = projects.map(proj => {
    const history = proj.dateChangeHistory || [];
    const hasHistory = history.length > 0;
    const netDeviation = proj.realEndDate ? getDaysDiff(proj.theoreticalEndDate, proj.realEndDate) : 0;
    const deviationBadge = netDeviation > 0 
      ? `<span class="badge-red">+${netDeviation} DÍAS (DEMORA)</span>` 
      : `<span class="badge-green">EN TIEMPO</span>`;

    // Metadatos del Proyecto
    let projectSection = `
      <h2>${proj.opportunityNumber || 'S/N'} - ${proj.name}</h2>
      <table class="meta-table" cellpadding="6" cellspacing="0">
        <tr>
          <td width="15%" class="meta-label">Cliente:</td>
          <td width="35%" class="meta-val">${proj.clientName || 'S/D'}</td>
          <td width="15%" class="meta-label">PM Lider:</td>
          <td width="35%" class="meta-val">${proj.pm || 'Sin PM'}</td>
        </tr>
        <tr>
          <td class="meta-label">Fecha de Inicio:</td>
          <td class="meta-val">${formatDate(proj.startDate)}</td>
          <td class="meta-label">Estado actual:</td>
          <td class="meta-val">${proj.status} (Avance: ${proj.progress}%)</td>
        </tr>
        <tr>
          <td class="meta-label">Fin Teórico Orig.:</td>
          <td class="meta-val">${formatDate(proj.theoreticalEndDate)}</td>
          <td class="meta-label">Fin Real Actual:</td>
          <td class="meta-val">${proj.realEndDate ? formatDate(proj.realEndDate) : formatDate(proj.theoreticalEndDate)}</td>
        </tr>
        <tr>
          <td class="meta-label">Desvío de Tiempos:</td>
          <td colspan="3" class="meta-val">${deviationBadge}</td>
        </tr>
      </table>
    `;

    // Historial de cambios de fecha
    projectSection += `
      <div class="timeline-title">Historial de Desplazamientos y Justificaciones</div>
      <table cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th width="8%" class="text-center">Ev. #</th>
            <th width="15%" class="text-center">Fecha Cambio</th>
            <th width="30%" class="text-center">Desplazamiento Fechas</th>
            <th width="12%" class="text-center">Impacto</th>
            <th width="15%" class="text-center">Ref. Control Cambio</th>
            <th width="20%">Justificación Detallada</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (hasHistory) {
      history.forEach((entry, idx) => {
        const shiftDays = entry.previousDate ? getDaysDiff(entry.previousDate, entry.newDate) : 0;
        
        // Buscar controles de cambio asociados
        const associatedChanges = changes.filter(c => entry.changeIds.includes(c.id));
        const refCodes = associatedChanges.map(c => c.registrationNumber || 'S/N').join(', ') || 'N/A';
        const justifications = associatedChanges.map(c => c.description).join(' | ') || 'Sin justificación registrada';

        projectSection += `
          <tr>
            <td class="text-center bold">${idx + 1}</td>
            <td class="text-center">${formatDate(entry.changedAt)}</td>
            <td class="text-center">${entry.previousDate ? formatDate(entry.previousDate) : 'Origen'} ➔ <span class="bold">${formatDate(entry.newDate)}</span></td>
            <td class="text-center bold text-red" style="color: #991b1b;">+${shiftDays} días</td>
            <td class="text-center bold" style="color: #1e3a8a;">${refCodes}</td>
            <td>${justifications}</td>
          </tr>
        `;
      });
    } else {
      projectSection += `
        <tr>
          <td colspan="6" style="text-align: center; color: #64748b; font-style: italic; padding: 12pt;">
            El proyecto no registra corrimientos de fecha de finalización. Se encuentra alineado con el cronograma original.
          </td>
        </tr>
      `;
    }

    projectSection += `
        </tbody>
      </table>
    `;

    return projectSection;
  }).join('');

  const htmlFooter = `
      <div class="footer">
        Informe Semestral de Gestión • PMO BGH Tech Partner • Documento de Uso Interno Confidencial
      </div>
    </body>
    </html>
  `;

  const fullHtml = htmlHead + htmlContent + htmlFooter;
  const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${docName}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
