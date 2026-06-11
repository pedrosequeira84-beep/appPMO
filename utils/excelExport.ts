import ExcelJS from 'exceljs';
import { Project, Expense, COST_CATEGORIES } from '../types';

// Mapeo detallado de categorías internas de la base de datos a las etiquetas en Excel
const EXCEL_PEP_DETAILS: Record<string, { pep: string, detail: string }> = {
  "1-Costos Comerciales": { pep: "1", detail: "Costos Comerciales" },
  "10-Productos - Materiales (HW/SW) Solución Principal": { pep: "10", detail: "Productos-Materiales Solución Principal" },
  "11-Servicios Propios - Horas de PM": { pep: "11", detail: "Servicios Propios - Horas de PM" },
  "12-Servicios Propios - Horas Ingenieros": { pep: "12", detail: "Servicios Propios - Horas Ingenieros" },
  "13-Servicios Soporte y Mantenimiento (MO Propia)": { pep: "13", detail: "Servicios Soporte y Mantenimiento (MO Propia)" },
  "14-Viáticos": { pep: "14", detail: "Viáticos" },
  "15-Servicios de Terceros": { pep: "15", detail: "Servicios de Terceros" },
  "16-Garantías / Soporte técnico Vendors": { pep: "16", detail: "Garantías / Hi-Care" },
  "17-Productos - Materiales (HW/SW) Solución Complementaria": { pep: "17", detail: "Productos - Materiales (HW/SW) Solución Complementaria" }
};

// Convierte un índice numérico de columna (1-indexed) a letra de Excel (ej: 1 -> A, 3 -> C)
const getColLetter = (colIndex: number): string => {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    let modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
};

export const exportCostsToExcel = async (projects: Project[], expenses: Expense[]) => {
  // 1. Crear nuevo libro de trabajo y pestaña
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Detalle costos proyectos', {
    views: [{ showGridLines: true }] // Forzar visualización de cuadrículas nativas de Excel
  });

  // 2. Definir fuente general y bordes
  const defaultFont = { name: 'Aptos Narrow', size: 11, color: { argb: 'FF000000' } };
  const borderThinBlack = {
    top: { style: 'thin' as const, color: { argb: 'FF000000' } },
    left: { style: 'thin' as const, color: { argb: 'FF000000' } },
    bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
    right: { style: 'thin' as const, color: { argb: 'FF000000' } }
  };

  // 3. Configurar columnas estáticas A y B
  worksheet.getColumn(1).width = 8;   // PEP
  worksheet.getColumn(2).width = 45;  // Detalle PEP

  // Escribir cabecera de las columnas A y B
  const cellA5 = worksheet.getCell('A5');
  cellA5.value = 'PEP';
  cellA5.font = { ...defaultFont, bold: true };
  cellA5.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA5.border = borderThinBlack;

  const cellB5 = worksheet.getCell('B5');
  cellB5.value = 'Detalle PEP';
  cellB5.font = { ...defaultFont, bold: true };
  cellB5.alignment = { horizontal: 'center', vertical: 'middle' };
  cellB5.border = borderThinBlack;

  // Rellenar filas estáticas A y B con las categorías PEP
  const pepCategoriesList = Object.keys(EXCEL_PEP_DETAILS);
  pepCategoriesList.forEach((catKey, idx) => {
    const rowNum = 6 + idx;
    const pepInfo = EXCEL_PEP_DETAILS[catKey];

    // Columna A (PEP)
    const cellA = worksheet.getCell(`A${rowNum}`);
    cellA.value = parseInt(pepInfo.pep, 10);
    cellA.font = { ...defaultFont, bold: true };
    cellA.alignment = { horizontal: 'center', vertical: 'middle' };
    cellA.border = borderThinBlack;

    // Columna B (Detalle PEP)
    const cellB = worksheet.getCell(`B${rowNum}`);
    cellB.value = pepInfo.detail;
    cellB.font = { ...defaultFont, bold: true };
    cellB.alignment = { horizontal: 'left', vertical: 'middle' };
    cellB.border = borderThinBlack;
  });

  // Ajustar la altura de las filas
  worksheet.getRow(1).height = 15; // Vacío superior
  worksheet.getRow(2).height = 24; // Cliente
  worksheet.getRow(3).height = 20; // Oportunidad (TP-AR)
  worksheet.getRow(4).height = 36; // Nombre del proyecto (wrapped)
  worksheet.getRow(5).height = 24; // Subcabeceras
  for (let r = 6; r <= 14; r++) {
    worksheet.getRow(r).height = 20; // Filas de PEP
  }

  // 4. Agregar cada proyecto en columnas contiguas
  projects.forEach((proj, projIdx) => {
    const startColIdx = 3 + projIdx * 3; // 3 -> C, 6 -> F, 9 -> I
    const presColLetter = getColLetter(startColIdx);
    const realColLetter = getColLetter(startColIdx + 1);
    const dispColLetter = getColLetter(startColIdx + 2);

    // Ajustar anchos de columnas
    worksheet.getColumn(startColIdx).width = 16;
    worksheet.getColumn(startColIdx + 1).width = 16;
    worksheet.getColumn(startColIdx + 2).width = 16;

    // Filtrar gastos asociados al proyecto
    const projExpenses = expenses.filter(e => e.projectId === proj.id);

    // Determinar si el proyecto tiene alertas (Disponible < 0 en alguna categoría)
    let hasAlerts = false;
    pepCategoriesList.forEach(catKey => {
      const budgetVal = proj.budget?.[catKey] || 0;
      const sapValRaw = projExpenses.filter(e => e.category === catKey).reduce((s, x) => s + x.amount, 0);
      const sapVal = Math.abs(sapValRaw);
      if (budgetVal - sapVal < 0) {
        hasAlerts = true;
      }
    });

    // Colores de Cabecera
    const headerBgColor = hasAlerts ? 'FFFF0000' : 'FFA2D189'; // Rojo sólido o Verde claro según alertas
    const headerFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: headerBgColor }
    };

    // Fila 2: Nombre de Cliente (Combinado C2:E2, F2:H2, etc.)
    worksheet.mergeCells(`${presColLetter}2:${dispColLetter}2`);
    const cellClient = worksheet.getCell(`${presColLetter}2`);
    cellClient.value = proj.clientName || 'S/D';
    cellClient.font = { ...defaultFont, bold: true };
    cellClient.alignment = { horizontal: 'center', vertical: 'middle' };
    cellClient.fill = headerFill;
    // Aplicar bordes individuales a las celdas combinadas de la fila 2
    for (let c = 0; c < 3; c++) {
      worksheet.getCell(2, startColIdx + c).border = borderThinBlack;
    }

    // Fila 3: Código de Oportunidad TP-AR (Combinado C3:E3, F3:H3, etc.)
    worksheet.mergeCells(`${presColLetter}3:${dispColLetter}3`);
    const cellOpp = worksheet.getCell(`${presColLetter}3`);
    cellOpp.value = proj.opportunityNumber || 'S/N';
    cellOpp.font = { ...defaultFont, bold: true };
    cellOpp.alignment = { horizontal: 'center', vertical: 'middle' };
    cellOpp.fill = headerFill;
    // Aplicar bordes individuales a las celdas combinadas de la fila 3
    for (let c = 0; c < 3; c++) {
      worksheet.getCell(3, startColIdx + c).border = borderThinBlack;
    }

    // Fila 4: Nombre completo de Proyecto (Combinado C4:E4, F4:H4, etc.)
    worksheet.mergeCells(`${presColLetter}4:${dispColLetter}4`);
    const cellProjName = worksheet.getCell(`${presColLetter}4`);
    cellProjName.value = proj.name;
    cellProjName.font = { ...defaultFont, bold: false };
    cellProjName.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    // Aplicar bordes individuales a las celdas combinadas de la fila 4
    for (let c = 0; c < 3; c++) {
      worksheet.getCell(4, startColIdx + c).border = borderThinBlack;
    }

    // Fila 5: Cabeceras de columnas (Presupuesto, Costo Real, Disponible)
    const cellPresLabel = worksheet.getCell(`${presColLetter}5`);
    cellPresLabel.value = 'Presupuesto';
    cellPresLabel.font = { ...defaultFont, bold: true };
    cellPresLabel.alignment = { horizontal: 'center', vertical: 'middle' };
    cellPresLabel.border = borderThinBlack;

    const cellRealLabel = worksheet.getCell(`${realColLetter}5`);
    cellRealLabel.value = 'Costo Real';
    cellRealLabel.font = { ...defaultFont, bold: true };
    cellRealLabel.alignment = { horizontal: 'center', vertical: 'middle' };
    cellRealLabel.border = borderThinBlack;

    const cellDispLabel = worksheet.getCell(`${dispColLetter}5`);
    cellDispLabel.value = 'Disponible';
    cellDispLabel.font = { ...defaultFont, bold: true };
    cellDispLabel.alignment = { horizontal: 'center', vertical: 'middle' };
    cellDispLabel.border = borderThinBlack;

    // Formato de moneda contable personalizado:
    // Muestra "USD" / "-USD" a la izquierda y el número a la derecha. Si es cero, muestra "USD  -".
    const currencyFormat = '"USD"* #,##0.00;[Red]"-USD"* #,##0.00;"USD"* "-"';

    // Rellenar datos de PEP para el proyecto (Filas 6 a 14)
    pepCategoriesList.forEach((catKey, idx) => {
      const rowNum = 6 + idx;

      // Presupuesto
      const budgetVal = proj.budget?.[catKey] || 0;
      const cellPres = worksheet.getCell(`${presColLetter}${rowNum}`);
      cellPres.value = budgetVal;
      cellPres.numFmt = currencyFormat;
      cellPres.font = defaultFont;
      cellPres.alignment = { horizontal: 'right', vertical: 'middle' };
      cellPres.border = borderThinBlack;

      // Costo Real (SAP expenses) - forzar valor positivo
      const sapValRaw = projExpenses.filter(e => e.category === catKey).reduce((s, x) => s + x.amount, 0);
      const sapVal = Math.abs(sapValRaw);
      const cellReal = worksheet.getCell(`${realColLetter}${rowNum}`);
      cellReal.value = sapVal;
      cellReal.numFmt = currencyFormat;
      cellReal.font = defaultFont;
      cellReal.alignment = { horizontal: 'right', vertical: 'middle' };
      cellReal.border = borderThinBlack;

      // Disponible (Fórmula: Presupuesto - Costo Real)
      const cellDisp = worksheet.getCell(`${dispColLetter}${rowNum}`);
      const dispValue = budgetVal - sapVal;
      cellDisp.value = {
        formula: `${presColLetter}${rowNum}-${realColLetter}${rowNum}`,
        result: dispValue
      };
      cellDisp.numFmt = currencyFormat;
      cellDisp.alignment = { horizontal: 'right', vertical: 'middle' };
      cellDisp.border = borderThinBlack;

      // Estilos Condicionales para la celda Disponible
      if (dispValue > 0) {
        // Verde claro si hay saldo disponible positivo
        cellDisp.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' }
        };
        cellDisp.font = { ...defaultFont, bold: true, color: { argb: 'FF006100' } };
      } else if (dispValue < 0) {
        // Rojo claro si el presupuesto está excedido
        cellDisp.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC7CE' }
        };
        cellDisp.font = { ...defaultFont, bold: true, color: { argb: 'FF9C0006' } };
      } else {
        // Normal sin color si es cero
        cellDisp.font = defaultFont;
      }
    });
  });

  // 5. Generar archivo y disparar descarga en el navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  
  // Nombre de archivo con fecha actual formateada
  const todayStr = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
  a.download = `Detalle costos proyectos - ${todayStr}.xlsx`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
