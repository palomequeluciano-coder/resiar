import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureMixedExamFilter } from '../ui/mixedExamFilter.js';

function makeQuestions() {
  return [
    { id: 'q1', examen: 'CABA', anio: 2020 },
    { id: 'q2', examen: 'CABA', anio: 2020 },
    { id: 'q3', examen: 'CABA', anio: 2021 },
    { id: 'q4', examen: 'EU', anio: 2022 },
  ];
}

function baseDeps(overrides = {}) {
  return {
    getQuestions: () => makeQuestions(),
    getCurrentUser: () => ({ id: 'user-1' }),
    getServerAccess: () => 'pro',
    getCurrentProfile: () => ({ plan: 'pro' }),
    getQuestionBankVersion: () => 'v1',
    getCargarChecklist: () => vi.fn(),
    getCargarFiltros: () => vi.fn(),
    setCargarFiltros: vi.fn(),
    setFiltroExamenValue: vi.fn(),
    setFiltroAnioMirValue: vi.fn(),
    ...overrides
  };
}

function cleanupGlobals() {
  [
    'mixedExamFilterRefresh', 'mixedExamFilterToggle', 'mixedExamFilterToggleBank',
    'mixedExamFilterClear', 'mixedExamFilterDebug', 'resiarMarkCompletionAnsweredIds',
    'resiarExamCompletionStatsForIds', 'resiarRefreshExamCompletionBadges',
    'cargarFiltros', '__resiarQuestionBankVersion'
  ].forEach((k) => { delete window[k]; });
  // sb (cliente de Supabase) es un global real en producción, seteado por
  // /supabase-global.js antes de que corra este código. En test no existe;
  // lo dejamos en null explícito (en vez de undefined) para que el mismo
  // camino defensivo del código original (`!sb`) corte temprano sin tirar
  // el warning de progreso remoto a la consola en cada test.
  window.sb = null;
  window.localStorage.clear();
}

describe('mixedExamFilter', () => {
  beforeEach(() => {
    cleanupGlobals();
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="filtroExamenWrap"><span id="filtroExamenLabel"></span></div>
      <div id="filtroAnioMirWrap"><span id="filtroAnioMirLabel"></span></div>
    `;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanupGlobals();
  });

  it('monta el panel, oculta los selects nativos y expone la API en window', () => {
    configureMixedExamFilter(baseDeps());
    vi.runOnlyPendingTimers();

    expect(document.getElementById('filtroExamenWrap').style.display).toBe('none');
    expect(document.getElementById('filtroAnioMirWrap').style.display).toBe('none');
    expect(document.getElementById('mixedExamFilterRoot')).toBeTruthy();
    expect(typeof window.mixedExamFilterToggle).toBe('function');
    expect(typeof window.mixedExamFilterDebug).toBe('function');
  });

  it('mixedExamFilterDebug agrupa por banco+año y cuenta el total de preguntas', () => {
    configureMixedExamFilter(baseDeps());
    vi.runOnlyPendingTimers();

    const debug = window.mixedExamFilterDebug();
    expect(debug.total).toBe(4);
    const cabaGroup = debug.groups.find(g => g.bank === 'CABA');
    expect(cabaGroup).toBeTruthy();
    expect(cabaGroup.years.map(y => y.year).sort()).toEqual(['2020', '2021']);
  });

  it('mixedExamFilterToggle selecciona/deselecciona un banco+año y persiste en localStorage', () => {
    configureMixedExamFilter(baseDeps());
    vi.runOnlyPendingTimers();

    window.mixedExamFilterToggle('CABA::2020');
    let debug = window.mixedExamFilterDebug();
    expect(debug.selected).toContain('CABA::2020');

    window.mixedExamFilterToggle('CABA::2020');
    debug = window.mixedExamFilterDebug();
    expect(debug.selected).not.toContain('CABA::2020');
  });

  it('mixedExamFilterToggleBank selecciona todos los años de un banco de una vez', () => {
    configureMixedExamFilter(baseDeps());
    vi.runOnlyPendingTimers();

    window.mixedExamFilterToggleBank('CABA');
    const debug = window.mixedExamFilterDebug();
    expect(debug.selected.sort()).toEqual(['CABA::2020', 'CABA::2021']);
  });

  it('mixedExamFilterClear vacía toda la selección', () => {
    configureMixedExamFilter(baseDeps());
    vi.runOnlyPendingTimers();

    window.mixedExamFilterToggle('CABA::2020');
    window.mixedExamFilterClear();
    expect(window.mixedExamFilterDebug().selected).toEqual([]);
  });

  it('al cambiar la selección, resetea los filtros nativos y llama a cargarChecklist (refreshAfterChange)', () => {
    const setFiltroExamenValue = vi.fn();
    const setFiltroAnioMirValue = vi.fn();
    const cargarChecklist = vi.fn();
    configureMixedExamFilter(baseDeps({
      setFiltroExamenValue,
      setFiltroAnioMirValue,
      getCargarChecklist: () => cargarChecklist
    }));
    vi.runOnlyPendingTimers();

    window.mixedExamFilterToggle('CABA::2020');
    expect(setFiltroExamenValue).toHaveBeenCalledWith('todos');
    expect(setFiltroAnioMirValue).toHaveBeenCalledWith('todos');
    expect(cargarChecklist).toHaveBeenCalled();
  });

  it('envuelve cargarFiltros via setCargarFiltros (installFilterHooks) sin perder el original', () => {
    const originalCargarFiltros = vi.fn(() => 'original-return');
    const setCargarFiltros = vi.fn();
    configureMixedExamFilter(baseDeps({
      getCargarFiltros: () => originalCargarFiltros,
      setCargarFiltros
    }));
    vi.runOnlyPendingTimers();

    expect(setCargarFiltros).toHaveBeenCalledTimes(1);
    const wrapped = setCargarFiltros.mock.calls[0][0];
    expect(typeof wrapped).toBe('function');

    const result = wrapped();
    expect(originalCargarFiltros).toHaveBeenCalled();
    expect(result).toBe('original-return');
    // el wrapper también queda expuesto en window para consumidores legacy
    expect(window.cargarFiltros).toBe(wrapped);
  });

  it('no rompe si getQuestions() devuelve vacío al montar (reintenta y luego desiste)', () => {
    configureMixedExamFilter(baseDeps({ getQuestions: () => [] }));
    expect(() => vi.advanceTimersByTime(250 * 81)).not.toThrow();
  });

  it('no rompe si getCurrentUser()/getCurrentProfile() devuelven null', () => {
    configureMixedExamFilter(baseDeps({ getCurrentUser: () => null, getCurrentProfile: () => null, getServerAccess: () => '' }));
    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
    expect(() => window.mixedExamFilterDebug()).not.toThrow();
  });
});
