import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureHomeConfigurator } from '../ui/homeConfigurator.js';

function makeQuestions() {
  return [
    { id: 'q1', examen: 'CABA', anio: 2020, especialidad: 'Cardiologia', tema: 'Arritmias' },
    { id: 'q2', examen: 'CABA', anio: 2020, especialidad: 'Cardiologia', tema: 'Arritmias' },
    { id: 'q3', examen: 'CABA', anio: 2021, especialidad: 'Neurologia', tema: 'ACV' },
  ];
}

function baseDeps(overrides = {}) {
  return {
    getQuestions: () => makeQuestions(),
    getCurrentUser: () => ({ id: 'user-1' }),
    getServerAccess: () => 'pro',
    getCurrentProfile: () => ({ plan: 'pro' }),
    getQuestionBankVersion: () => 'v1',
    getFiltroExamenValue: () => 'todos',
    getFiltroAnioMirValue: () => 'todos',
    getQuestionChatState: () => ({ open: true, unread: 3, inviteOpen: true, status: 'x' }),
    getQuestionChatClose: () => vi.fn(),
    getQuestionChatDisconnect: () => vi.fn(),
    getCerrarModal: () => vi.fn(),
    getCerrarReview: () => vi.fn(),
    getResiarIsLegacyConfigPlaceholder: () => () => false,
    getResiarSyncReviewErrorsButton: () => vi.fn(),
    getDeseleccionarEspecialidades: () => vi.fn(),
    setMostrarPantallaBienvenida: vi.fn(),
    ...overrides
  };
}

function cleanupGlobals() {
  [
    'resiarRenderHome', 'mostrarPantallaBienvenida', 'irAConfigurarNuevoExamen',
    'resiarHomeRefresh', 'resiarHomeRefreshSpecialties', 'resiarHomeRefreshTopic',
    'resiarHomeHideExamChrome', 'resiarDisableQuestionChat', 'resiarGetCurrentFilteredQuestions',
    'resiarHomeSelectedTopicValues', 'resiarHomeMixedToggle', 'resiarHomeMixedToggleBank',
    'resiarHomeMixedClear', 'resiarHomeToggleSpecialty', 'resiarHomeClearSpecialties',
    'resiarHomeSetTopic', 'resiarHomeClearTopic', 'mixedExamFilterDebug',
    'mixedExamFilterToggle', 'mixedExamFilterRefresh', '__resiarPendingModernHomeRender',
    '_resiarExamRunning', '_resiarExamFinished', 'resiarUserIsAdmin',
    'resiarEnsureModernConfigHome', 'resiarMarkViewState', 'resiarSetWhatsAppVisible',
    'resiarSyncReviewErrorsButton'
  ].forEach((k) => { delete window[k]; });
}

describe('homeConfigurator', () => {
  beforeEach(() => {
    cleanupGlobals();
    document.body.innerHTML = '<div id="preguntaBox"></div>';
  });

  afterEach(() => {
    cleanupGlobals();
  });

  it('resiarRenderHome pinta el markup de la home y expone la API en window', () => {
    configureHomeConfigurator(baseDeps());
    window.resiarRenderHome(false);

    expect(document.getElementById('welcome')).toBeTruthy();
    expect(document.getElementById('homeMixedExamRoot')).toBeTruthy();
    expect(typeof window.resiarHomeRefresh).toBe('function');
    expect(typeof window.resiarHomeMixedToggle).toBe('function');
  });

  it('resiarRenderHome no rompe si no existe #preguntaBox', () => {
    document.body.innerHTML = '';
    configureHomeConfigurator(baseDeps());
    expect(() => window.resiarRenderHome(false)).not.toThrow();
  });

  it('mostrarPantallaBienvenida renderiza la home solo si hay usuario, y se registra via setMostrarPantallaBienvenida', () => {
    const setMostrarPantallaBienvenida = vi.fn();
    configureHomeConfigurator(baseDeps({ setMostrarPantallaBienvenida, getCurrentUser: () => null }));

    expect(setMostrarPantallaBienvenida).toHaveBeenCalledTimes(1);
    expect(typeof setMostrarPantallaBienvenida.mock.calls[0][0]).toBe('function');

    // sin usuario, no debería pintar la home
    window.mostrarPantallaBienvenida();
    expect(document.getElementById('welcome')).toBeFalsy();
  });

  it('irAConfigurarNuevoExamen limpia flags de examen y llama a cerrarReview/cerrarModal', () => {
    const cerrarReview = vi.fn();
    const cerrarModal = vi.fn();
    configureHomeConfigurator(baseDeps({
      getCerrarReview: () => cerrarReview,
      getCerrarModal: () => cerrarModal
    }));

    window._resiarExamRunning = true;
    window._resiarExamFinished = false;
    window.irAConfigurarNuevoExamen();

    expect(window._resiarExamRunning).toBe(false);
    expect(window._resiarExamFinished).toBe(true);
    expect(cerrarReview).toHaveBeenCalled();
    expect(cerrarModal).toHaveBeenCalled();
    expect(document.getElementById('welcome')).toBeTruthy();
  });

  it('resiarDisableQuestionChat cierra/desconecta el chat y resetea questionChatState', () => {
    const questionChatClose = vi.fn();
    const questionChatDisconnect = vi.fn();
    const state = { open: true, unread: 5, inviteOpen: true, status: 'ringing' };
    configureHomeConfigurator(baseDeps({
      getQuestionChatClose: () => questionChatClose,
      getQuestionChatDisconnect: () => questionChatDisconnect,
      getQuestionChatState: () => state
    }));

    window.resiarDisableQuestionChat();

    expect(questionChatClose).toHaveBeenCalled();
    expect(questionChatDisconnect).toHaveBeenCalledWith(true);
    expect(state.open).toBe(false);
    expect(state.unread).toBe(0);
    expect(state.inviteOpen).toBe(false);
  });

  it('resiarHomeClearSpecialties llama a deseleccionarEspecialidades inyectada', () => {
    const deseleccionar = vi.fn();
    configureHomeConfigurator(baseDeps({ getDeseleccionarEspecialidades: () => deseleccionar }));
    window.resiarRenderHome(false);

    window.resiarHomeClearSpecialties();
    expect(deseleccionar).toHaveBeenCalled();
  });

  it('resiarGetCurrentFilteredQuestions respeta _filtroExamenValue/_filtroAnioMirValue inyectados', () => {
    configureHomeConfigurator(baseDeps({
      getFiltroExamenValue: () => 'CABA',
      getFiltroAnioMirValue: () => '2020'
    }));

    const filtered = window.resiarGetCurrentFilteredQuestions();
    expect(filtered.map(q => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('resiarGetCurrentFilteredQuestions no rompe si getQuestions() devuelve vacío', () => {
    configureHomeConfigurator(baseDeps({ getQuestions: () => [] }));
    expect(() => window.resiarGetCurrentFilteredQuestions()).not.toThrow();
    expect(window.resiarGetCurrentFilteredQuestions()).toEqual([]);
  });

  it('resiarHomeSetTopic/resiarHomeClearTopic actualizan la selección de temas', () => {
    configureHomeConfigurator(baseDeps());
    window.resiarRenderHome(false);

    window.resiarHomeSetTopic('Arritmias', true);
    expect(window.resiarHomeSelectedTopicValues()).toEqual(['Arritmias']);

    window.resiarHomeClearTopic();
    expect(window.resiarHomeSelectedTopicValues()).toEqual([]);
  });
});
