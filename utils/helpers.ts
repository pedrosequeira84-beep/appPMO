export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

export function parseExcelNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let clean = val.replace(/[^\d.,-]/g, '').trim();
    if (clean === '') return 0;
    if (clean.indexOf(',') > -1 && clean.indexOf('.') > -1) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.indexOf(',') > -1) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(clean) || 0;
  }
  return 0;
}

export function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeekKey(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const weekYear = target.getFullYear();
  return `${weekYear}-W${getWeekNumber(d).toString().padStart(2, '0')}`;
}

export function getPastWeeksKeys(count: number): string[] {
  const keys = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    keys.push(getWeekKey(d));
  }
  return keys;
}

export function calculateProjectHealth(p: any, expenses: any[]): 'Verde' | 'Amarillo' | 'Rojo' {
  if (!p) return 'Verde';
  if (p.healthStatus && p.healthStatus !== 'Auto') return p.healthStatus;

  // Calculo automático
  const theoretical = p.theoreticalEndDate ? new Date(p.theoreticalEndDate) : null;
  const currentEnd = p.realEndDate ? new Date(p.realEndDate) : new Date();

  let delayDays = 0;
  if (theoretical && !isNaN(theoretical.getTime())) {
    const diffTime = currentEnd.getTime() - theoretical.getTime();
    delayDays = Math.max(0, Math.ceil(diffTime / (1000 * 3600 * 24)));
  }

  const budgetRecord = p.budget && typeof p.budget === 'object' ? p.budget : {};
  const totalBudget: number = (Object.values(budgetRecord) as any[]).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const actualExpenses = safeExpenses.filter(e => e && e.projectId === p.id).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const burnRate = totalBudget > 0 ? (actualExpenses / totalBudget) * 100 : 0;

  if (delayDays > 30 || burnRate > 100) return 'Rojo';
  if (delayDays > 15 || burnRate > 90) return 'Amarillo';
  return 'Verde';
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function isArgentinaHoliday(date: Date): boolean {
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // Feriados Inamovibles (Standard Argentina)
  if (month === 0 && day === 1) return true; // Año Nuevo
  if (month === 2 && day === 24) return true; // Memoria
  if (month === 3 && day === 2) return true; // Malvinas
  if (month === 4 && day === 1) return true; // Trabajador
  if (month === 4 && day === 25) return true; // Revolución
  if (month === 5 && day === 20) return true; // Bandera
  if (month === 6 && day === 9) return true; // Independencia
  if (month === 11 && day === 8) return true; // Inmaculada
  if (month === 11 && day === 25) return true; // Navidad

  // Feriados variables y puentes turísticos
  const d = `${month + 1}-${day}`;

  // 2026
  if (year === 2026 && ['2-16', '2-17', '4-2', '4-3', '6-15', '8-17', '10-12', '11-23', '12-7'].includes(d)) return true;

  // 2025 (Carnaval 3-4 Mar, Jue/Vie Santo 17-18 Abr, Guemes Lunes 16 Jun, Soberania Lunes 24 Nov)
  // Nota: 24 Marzo, 2 Abril, 1 Mayo, 25 Mayo, 20 Junio, 9 Julio, 8 Dic, 25 Dic son fijos y ya cubiertos arriba.
  if (year === 2025 && ['3-3', '3-4', '4-17', '4-18', '6-16', '11-24'].includes(d)) return true;

  // 2024 (Historico)
  if (year === 2024 && ['2-12', '2-13', '3-28', '3-29', '6-17', '6-21', '10-11'].includes(d)) return true;

  return false;
}
