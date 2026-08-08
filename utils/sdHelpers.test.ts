import { describe, it, expect } from 'vitest';
import { SDBlock, SDDateHistoryEntry, SDDependency, SDTask, SDTimeEntry, TeamMember } from '../types';
import {
  getEffectiveSdRole, canManageTask, generateSDTaskCode, computeChecklistProgress,
  sumTaskHours, hoursDeviation, isTaskOverdue, shouldAutoStartTask, canFinishTask,
  computeLeadTimeDays, computeCycleTimeDays, computeBacklogTimeDays, computeWipTimeDays,
  computeBlockedTimeDays, computeDateDeviationDays, computeCompliance, computeTaskRisk,
  SD_ADMIN_EMAIL
} from './sdHelpers';

const baseTask = (overrides: Partial<SDTask> = {}): SDTask => ({
  id: 't1', code: 'TP-AR-1-SD-1', projectId: 'p1', parentTaskId: null, workType: 'incidente',
  title: 'Tarea de prueba', description: '', assigneeMemberId: 'm1', status: 'backlog',
  plannedDate: null, commitmentDate: null, estimatedHours: null, priority: 'Media', severity: 'Media',
  tags: [], vendorSupportRequired: false, progressPercent: 0, progressManualOverride: false,
  blocked: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

describe('getEffectiveSdRole', () => {
  it('otorga administrador al super-admin hardcodeado sin importar el rol guardado', () => {
    expect(getEffectiveSdRole(null, SD_ADMIN_EMAIL)).toBe('administrador');
  });
  it('respeta el sd_role del team_member', () => {
    const member = { sdRole: 'responsable' } as TeamMember;
    expect(getEffectiveSdRole(member, 'otro@bgh.com')).toBe('responsable');
  });
  it('default es observador si no hay sd_role', () => {
    expect(getEffectiveSdRole({} as TeamMember, 'otro@bgh.com')).toBe('observador');
  });
});

describe('canManageTask', () => {
  it('administrador y responsable pueden gestionar, observador no', () => {
    expect(canManageTask('administrador')).toBe(true);
    expect(canManageTask('responsable')).toBe(true);
    expect(canManageTask('observador')).toBe(false);
  });
});

describe('generateSDTaskCode', () => {
  it('genera código secuencial por proyecto con el formato {opportunityNumber}-SD-{n}', () => {
    expect(generateSDTaskCode('TP-AR-1234', [])).toBe('TP-AR-1234-SD-1');
    expect(generateSDTaskCode('TP-AR-1234', [baseTask(), baseTask()])).toBe('TP-AR-1234-SD-3');
  });
  it('usa S/N si el proyecto no tiene código de oportunidad', () => {
    expect(generateSDTaskCode(undefined, [])).toBe('S/N-SD-1');
  });
});

describe('computeChecklistProgress', () => {
  it('devuelve 0 sin ítems', () => {
    expect(computeChecklistProgress([])).toBe(0);
  });
  it('calcula el porcentaje redondeado de ítems completados', () => {
    const items = [
      { id: '1', taskId: 't1', label: 'a', isDone: true, sortOrder: 0, createdAt: '' },
      { id: '2', taskId: 't1', label: 'b', isDone: false, sortOrder: 1, createdAt: '' },
      { id: '3', taskId: 't1', label: 'c', isDone: true, sortOrder: 2, createdAt: '' },
    ];
    expect(computeChecklistProgress(items)).toBe(67);
  });
});

describe('sumTaskHours / hoursDeviation', () => {
  const entries: SDTimeEntry[] = [
    { id: 'e1', taskId: 't1', memberId: 'm1', date: '2026-01-01', hours: 3, createdAt: '' },
    { id: 'e2', taskId: 't1', memberId: 'm1', date: '2026-01-02', hours: 2, createdAt: '' },
    { id: 'e3', taskId: 'otra', memberId: 'm1', date: '2026-01-02', hours: 10, createdAt: '' },
  ];
  it('suma solo las horas de la tarea indicada', () => {
    expect(sumTaskHours(entries, 't1')).toBe(5);
  });
  it('calcula la desviación real vs estimada', () => {
    expect(hoursDeviation(4, 5)).toBe(1);
    expect(hoursDeviation(null, 5)).toBe(0);
  });
});

describe('isTaskOverdue / shouldAutoStartTask', () => {
  it('una tarea Done nunca está vencida', () => {
    expect(isTaskOverdue(baseTask({ status: 'done', plannedDate: '2000-01-01' }))).toBe(false);
  });
  it('está vencida si la fecha planificada ya pasó y no está Done', () => {
    expect(isTaskOverdue(baseTask({ status: 'in_progress', plannedDate: '2000-01-01' }))).toBe(true);
  });
  it('pasa a In Progress automáticamente solo desde Backlog al llegar la fecha', () => {
    expect(shouldAutoStartTask(baseTask({ status: 'backlog', plannedDate: '2000-01-01' }))).toBe(true);
    expect(shouldAutoStartTask(baseTask({ status: 'in_progress', plannedDate: '2000-01-01' }))).toBe(false);
    const future = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
    expect(shouldAutoStartTask(baseTask({ status: 'backlog', plannedDate: future }))).toBe(false);
  });
});

describe('canFinishTask', () => {
  it('bloquea si no hay horas cargadas', () => {
    const task = baseTask({ assigneeMemberId: 'm1' });
    const result = canFinishTask(task, [], 'responsable', 'm1');
    expect(result.allowed).toBe(false);
  });
  it('bloquea si quien intenta finalizar no es el responsable ni administrador', () => {
    const task = baseTask({ assigneeMemberId: 'm1' });
    const entries: SDTimeEntry[] = [{ id: 'e1', taskId: 't1', memberId: 'm1', date: '2026-01-01', hours: 1, createdAt: '' }];
    const result = canFinishTask(task, entries, 'responsable', 'otro-usuario');
    expect(result.allowed).toBe(false);
  });
  it('permite finalizar al responsable con al menos una hora cargada', () => {
    const task = baseTask({ assigneeMemberId: 'm1' });
    const entries: SDTimeEntry[] = [{ id: 'e1', taskId: 't1', memberId: 'm1', date: '2026-01-01', hours: 1, createdAt: '' }];
    expect(canFinishTask(task, entries, 'responsable', 'm1').allowed).toBe(true);
  });
  it('un administrador puede finalizar aunque no sea el responsable, si hay horas', () => {
    const task = baseTask({ assigneeMemberId: 'm1' });
    const entries: SDTimeEntry[] = [{ id: 'e1', taskId: 't1', memberId: 'm1', date: '2026-01-01', hours: 1, createdAt: '' }];
    expect(canFinishTask(task, entries, 'administrador', 'admin-id').allowed).toBe(true);
  });
});

describe('Lead Time / Cycle Time / Backlog / WIP', () => {
  it('Lead Time es null si la tarea no está Done', () => {
    expect(computeLeadTimeDays(baseTask())).toBeNull();
  });
  it('Lead Time es la distancia entre creación y finalización', () => {
    const task = baseTask({ createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-06T00:00:00.000Z' });
    expect(computeLeadTimeDays(task)).toBe(5);
  });
  it('Cycle Time requiere startedAt y completedAt', () => {
    expect(computeCycleTimeDays(baseTask({ completedAt: '2026-01-06T00:00:00.000Z' }))).toBeNull();
    const task = baseTask({ startedAt: '2026-01-02T00:00:00.000Z', completedAt: '2026-01-06T00:00:00.000Z' });
    expect(computeCycleTimeDays(task)).toBe(4);
  });
  it('Tiempo en Backlog es hasta que arranca (o hasta hoy si nunca arrancó)', () => {
    const task = baseTask({ createdAt: '2026-01-01T00:00:00.000Z', startedAt: '2026-01-04T00:00:00.000Z' });
    expect(computeBacklogTimeDays(task)).toBe(3);
  });
  it('Tiempo en WIP es null si nunca arrancó', () => {
    expect(computeWipTimeDays(baseTask())).toBeNull();
  });
});

describe('computeBlockedTimeDays', () => {
  it('suma la duración de cada bloqueo de la tarea', () => {
    const blocks: SDBlock[] = [
      { id: 'b1', taskId: 't1', description: 'x', createdAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-03T00:00:00.000Z' },
      { id: 'b2', taskId: 't1', description: 'y', createdAt: '2026-01-05T00:00:00.000Z', resolvedAt: '2026-01-06T00:00:00.000Z' },
      { id: 'b3', taskId: 'otra', description: 'z', createdAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-10T00:00:00.000Z' },
    ];
    expect(computeBlockedTimeDays('t1', blocks)).toBe(3);
  });
});

describe('computeDateDeviationDays', () => {
  it('suma solo los corrimientos positivos de fecha de la tarea', () => {
    const history: SDDateHistoryEntry[] = [
      { id: 'h1', taskId: 't1', previousDate: '2026-01-01', newDate: '2026-01-05', reason: 'r', changedAt: '' },
      { id: 'h2', taskId: 't1', previousDate: '2026-01-05', newDate: '2026-01-03', reason: 'r', changedAt: '' },
    ];
    expect(computeDateDeviationDays('t1', history)).toBe(4);
  });
});

describe('computeCompliance', () => {
  it('sin Fecha Compromiso es Sin Compromiso', () => {
    expect(computeCompliance(baseTask())).toBe('Sin Compromiso');
  });
  it('Done a tiempo es Cumplida, Done tarde es Incumplida', () => {
    const onTime = baseTask({ status: 'done', commitmentDate: '2026-01-10', completedAt: '2026-01-05T00:00:00.000Z' });
    expect(computeCompliance(onTime)).toBe('Cumplida');
    const late = baseTask({ status: 'done', commitmentDate: '2026-01-01', completedAt: '2026-01-05T00:00:00.000Z' });
    expect(computeCompliance(late)).toBe('Incumplida');
  });
  it('no Done y ya pasó la Fecha Compromiso es Incumplida', () => {
    expect(computeCompliance(baseTask({ commitmentDate: '2000-01-01' }))).toBe('Incumplida');
  });
});

describe('computeTaskRisk', () => {
  it('una tarea simple sin factores de riesgo es Bajo', () => {
    const task = baseTask({ priority: 'Baja', severity: 'Baja' });
    expect(computeTaskRisk(task, [], {}).level).toBe('Bajo');
  });
  it('prioridad y severidad Crítica sin resolver eleva el riesgo', () => {
    const task = baseTask({ priority: 'Crítica', severity: 'Crítica', blocked: true, vendorSupportRequired: true });
    const risk = computeTaskRisk(task, [], {});
    expect(risk.level).toBe('Crítico');
  });
  it('las dependencias sin resolver suman riesgo', () => {
    const dep = baseTask({ id: 'dep1', status: 'in_progress' });
    const task = baseTask({ id: 't2' });
    const deps: SDDependency[] = [{ id: 'd1', taskId: 't2', dependsOnTaskId: 'dep1', createdAt: '' }];
    const withoutDeps = computeTaskRisk(task, [], { [task.id]: task });
    const withDeps = computeTaskRisk(task, deps, { [task.id]: task, dep1: dep });
    expect(withDeps.score).toBeGreaterThan(withoutDeps.score);
  });
});
