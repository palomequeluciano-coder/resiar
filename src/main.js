import { escapeHtml, markdownToHtml } from './utils/sanitize.js';
import { esRespuestaAnulada } from './utils/examAnswers.js';
import { configureExamNav } from './ui/examNav.js';
import { configureRacha } from './ui/racha.js';
import { configureChecklistEspecialidades } from './ui/checklistEspecialidades.js';
import { configureExamBankFilter } from './ui/examBankFilter.js';
import { configureMixedExamFilter } from './ui/mixedExamFilter.js';
import { configureHomeConfigurator } from './ui/homeConfigurator.js';
import { configureExamTimer } from './ui/examTimer.js';
import './ui/whatsappViewState.js';
import { configureHomeSearchBindings } from './ui/homeSearchBindings.js';
import { renderQuestionRepeatedBanner } from './utils/questionRepeats.js';
import {
  getCanonicalOptionEntries,
  hasAnswerValue as canonicalHasAnswerValue,
  normalizeAnswerValue as canonicalNormalizeAnswerValue,
  normalizeQuestionAnswerSchema
} from './utils/answerOptions.js';
import {
  resiarAvatarDisplayName,
  resiarAvatarInitial,
  resiarNormalizeAvatarUrl,
  resiarPickUserAvatarUrl,
  resiarAvatarHtml,
  resiarInstallAvatarFallback
} from './utils/avatar.js';

import {
  formatEsp,
  normEspecialidadKey,
  espRaw,
  temaRaw,
  espLabel,
  normalizarEspValor,
  splitEspecialidades,
  normalizeSearchText
} from './utils/text.js';

import {
  PROVINCIA_VALUE,
  EU_VALUE,
  esProvinciaBsAs,
  esBancoMIR,
  esExamenUnico,
  labelExamen
} from './utils/examFilters.js';

import { mostrarToast, _showRichToast } from './ui/toast.js';
import { readText, writeText, readJson, writeJson, removeStorage } from './utils/storage.js';
import {
  RESIAR_SESSION_ID_KEY,
  LEGACY_SESSION_ID_KEYS
} from './utils/storageKeys.js';
import { configureStudyStreak, mostrarRachaDias } from './utils/studyStreak.js';
import { createExamPdfExporter } from './utils/pdfExport.js';
import { configureViewStateController } from './state/viewState.js';
import {
  configureStats,
  getStats,
  saveStats,
  actualizarBadge,
  guardarSesion,
  resiarResetFinalSaveGuard,
  resiarSaveFinalSessionOnce,
  buildAnswerPayload,
  guardarSesionEnSupabase,
  abrirModalStats,
  cerrarModalStats,
  renderModalStats,
  getStatsStorageInfo
} from './ui/stats.js';

import {
  configureSoundSystem,
  sonOk,
  sonNo,
  sonTimer,
  sonFin,
  _stopActiveSounds,
  toggleSonido,
  abrirSoundPanel,
  cerrarSoundPanel,
  handleMultiUpload,
  eliminarYrenderizar,
  resetYrenderizar,
  previewSlot,
  previewSlotFile,
  installResiarSoundSystemExtension
} from './ui/sound.js';

import { abrirModalLegal, cerrarModalLegal, installLegalModal } from './ui/legalModal.js';
import { installResiarPublicLanding } from './ui/publicLanding.js';
import { installWhatsAppFloatController } from './ui/whatsappFloat.js';
import { installReviews } from './ui/reviews.js';
import { configurePublicCounters } from './ui/publicCounters.js';
import {
  configureSocial,
  socialState,
  cargarSocialSidebar,
  socialStartRealtime,
  socialStopRealtime,
  socialRequestRefresh,
  buscarUsuariosSocial,
  socialScheduleSearch,
  enviarSolicitudSocial,
  responderSolicitudSocial,
  eliminarAmigoSocial,
  socialOpenFriendProfile,
  socialCloseFriendProfile,
  socialNotifyUser
} from './ui/social.js';
import { configureNotes } from './ui/notes.js';
import { configureLoadingScreens } from './ui/loadingScreens.js';
import { configureTrialAccess } from './ui/trialAccess.js';
import { configureQuestionChat } from './ui/questionChat.js';
import { createCloudflareSocialClient } from './services/cloudflareSocialClient.js';
import { configureExplanation } from './ui/explanation.js';
import { configureExamControls } from './ui/examControls.js';
import {
  configureReports,
  abrirModalReporte,
  cerrarModalReporte,
  selMotivo,
  enviarReporte,
  abrirAdminReportes,
  filtrarReportes,
  actualizarEstadoReporte,
  irAReportePregunta,
  checkAdminReportesBtn,
  clearReportesEnviados
} from './ui/reports.js';
import {
  configureBilling,
  cargarPrecios,
  aplicarPreciosDOM as _aplicarPreciosDOM,
  invalidatePricing,
  abrirUpgrade,
  cerrarUpgrade,
  iniciarPago,
  iniciarPagoDesdeTab,
  renderPlanStatus
} from './ui/billing.js';
import {
  configureLeaderboard,
  abrirLeaderboard,
  setLbFilter,
  cargarLeaderboard
} from './ui/leaderboard.js';

import {
  configureBibliografia2026,
  abrirBibliografia2026
} from './ui/bibliografia2026.js';
import {
  configureVacunasPractice,
  abrirVacunasPractice
} from './ui/vacunasPractice.js';

import {
  configureChallenges,
  abrirDesafio as challengeAbrirDesafio,
  switchChallengeTab as challengeSwitchChallengeTab,
  cargarHistorialDesafios as challengeCargarHistorialDesafios,
  crearDesafio as challengeCrearDesafio,
  copiarCodigo as challengeCopiarCodigo,
  copiarLinkDesafio as challengeCopiarLinkDesafio,
  unirseDesafio as challengeUnirseDesafio,
  guardarResultadoDesafio as challengeGuardarResultadoDesafio,
  detenerRealtimeDesafio as challengeDetenerRealtimeDesafio
} from './ui/challenges.js';
import { installArenaCancelSearchPatch } from './ui/arenaCancelSearchPatch.js';
import { installClinicalGuide } from './ui/quickReference.js';
import { installMobileExamUi } from './ui/mobileExamUi.js';
import { installSplitScreenSafety } from './ui/splitScreenSafety.js';
import {
  configureReviewSearch,
  abrirReview as baseAbrirReview,
  cerrarReview as baseCerrarReview,
  setReviewFilter as baseSetReviewFilter,
  renderReviewGrid as baseRenderReviewGrid,
  irAPregunta as baseIrAPregunta,
  exitExamReviewMode as baseExitExamReviewMode,
  abrirBuscador as baseAbrirBuscador,
  cerrarBuscador as baseCerrarBuscador,
  buscarPreguntas as baseBuscarPreguntas,
  irAPreguntaDesde as baseIrAPreguntaDesde,
  iniciarExamenDesdeBusqueda as baseIniciarExamenDesdeBusqueda
} from './ui/reviewSearch.js';
import {
  installSidebarAccordion,
  sbToggle as sidebarToggle,
  sbUpdateSummary as updateSidebarSummary,
  sbUpdateCuentaSummary as updateSidebarCuentaSummary,
  sbUpdateOpcionesSummary as updateSidebarOpcionesSummary
} from './ui/sidebar.js';
import { initTheme, toggleTheme as toggleResiarTheme } from './ui/theme.js';
import { debounce } from './utils/debounce.js';
import { configureTopicSuggestions } from './ui/topicSuggestions.js';
import {
  configureAccess,
  canUseCustomSounds,
  getSoundPlanLabel,
  verificarAccesoServidor
} from './services/access.js';
import { installGlobalActionHandlers } from './ui/actionHandlers.js';
import { configureAuthSession } from './services/authSession.js';
import { installRpcPerformanceCache } from './services/rpcPerformanceCache.js';
import { configureAdminQuestionEditor } from './ui/adminQuestionEditor.js';

import {
  buildQuestionBankCacheKey,
  clearQuestionBankCache,
  loadQuestionBank
} from './services/questionBankLoader.js';

import {
  resiarParseOrderNumber,
  resiarQuestionOriginalOrderValue as defaultResiarQuestionOriginalOrderValue,
  resiarQuestionStableFallback as defaultResiarQuestionStableFallback,
  resiarStableOriginalQuestionCompare as defaultResiarStableOriginalQuestionCompare,
  resiarSortByOriginalExamOrder,
  resiarGetNPregunta
} from './utils/questionOrder.js';

import {
  buildExamQuestionPool
} from './services/examSelection.js';
import {
  startSecureExamSession,
  submitSecureExamAnswer,
  uniqueQuestionIds
} from './services/secureExamSession.js';
import {
  loadReviewErrors,
  saveReviewErrors,
  updateReviewErrorsFromSession,
  hydrateReviewQuestions
} from './services/errorReview.js';
import { buildWeaknessExamPlan } from './services/weaknessExam.js';
import { buildMistakesExamPlan } from './services/mistakesExam.js';
import { buildUserPerformanceModel } from './services/performanceEngine.js';
import {
  buildExamDraftPayload,
  saveExamDraft,
  loadExamDraft,
  clearExamDraft,
  hydrateExamDraft,
  summarizeAnswers
} from './services/examSessionDraft.js';

let resiarQuestionOriginalOrderValue = defaultResiarQuestionOriginalOrderValue;
let resiarQuestionStableFallback = defaultResiarQuestionStableFallback;
let resiarStableOriginalQuestionCompare = defaultResiarStableOriginalQuestionCompare;

import {
  configureGoogleAuth,
  getResiarAuthRedirectTo,
  loginGoogle
} from './services/googleAuth.js';

import {
  getQuestionImageUrlFromPath as resiarGetQuestionImageUrlFromPathBase,
  resiarRefreshQuestionImagesCache
} from './utils/questionImages.js';
import { renderQuestionImage as renderQuestionImageBase, renderQuestionTextWithImageRef } from './ui/questionImages.js';
import { configureMarkedQuestions } from './services/markedQuestions.js';
import {
  resiarOptionTextForSearch,
  resiarQuestionCaseTextForSearch,
  resiarQuestionSearchProxy,
  resiarEnhanceQuestionSearchPool,
  resiarCleanSearchPreviewText,
  resiarSearchPreviewTextFromQuestion,
  resiarQuestionSearchHaystack,
  resiarQuestionMatchesSearchQuery
} from './utils/questionSearchText.js';
import { configureQuestionSearchPreview } from './services/questionSearchPreview.js';

import {
  configureProfile,
  abrirPerfil,
  switchProfileTab,
  guardarUsername,
  cargarPerfil,
  toggleFaq,
  enviarContacto
} from './ui/profile.js';

let abrirReview = baseAbrirReview;
let cerrarReview = baseCerrarReview;
let setReviewFilter = baseSetReviewFilter;
let renderReviewGrid = baseRenderReviewGrid;
let irAPregunta = baseIrAPregunta;
let exitExamReviewMode = baseExitExamReviewMode;
let abrirBuscador = baseAbrirBuscador;
let cerrarBuscador = baseCerrarBuscador;
let buscarPreguntas = baseBuscarPreguntas;
let irAPreguntaDesde = baseIrAPreguntaDesde;
let iniciarExamenDesdeBusqueda = baseIniciarExamenDesdeBusqueda;

let abrirDesafio = challengeAbrirDesafio;
let switchChallengeTab = challengeSwitchChallengeTab;
let cargarHistorialDesafios = challengeCargarHistorialDesafios;
let crearDesafio = challengeCrearDesafio;
let copiarCodigo = challengeCopiarCodigo;
let copiarLinkDesafio = challengeCopiarLinkDesafio;
let unirseDesafio = challengeUnirseDesafio;
let guardarResultadoDesafio = challengeGuardarResultadoDesafio;
let _detenerRealtimeDesafio = challengeDetenerRealtimeDesafio;

configureAccess({
  getSb: () => sb,
  getVerifyUrl: () => EDGE_VERIFY_URL,
  writeText,
  readText,
  removeStorage,
  getCurrentProfile: () => currentProfile,
  getServerAccess: () => _serverAcceso,
  setServerAccess: (value) => { _serverAcceso = value; },
  setServerIsPro: (value) => { _serverEsPro = !!value; }
});

configureSoundSystem({
  mostrarToast,
  canUseCustomSounds: () => canUseCustomSounds()
});

const {
  resiarTrimSearchVisibleOptionSuffix,
  resiarFetchQuestionSearchPreviewsRpc,
  resiarSearchFullQuestionBankRpc,
  resiarFindSearchModal,
  resiarCurrentSearchQueryFromModal,
  resiarSearchPreviewPool,
  resiarVisibleSearchCards,
  resiarInsertSearchPreview,
  resiarSearchPreviewCacheKey,
  resiarApplySearchPreviews,
  resiarApplySearchPreviewTextMap,
  resiarHydrateVisibleSearchPreviews,
  resiarScheduleSearchPreviewHydration
} = configureQuestionSearchPreview({
  getSb: () => sb,
  getPreguntas: () => preguntas,
  uniqueQuestionIds,
  resiarSecureExamEnabled: () => resiarSecureExamEnabled(),
  resiarCreateSecureExamFromCatalog: (...args) => resiarCreateSecureExamFromCatalog(...args)
});

const {
  resiarMarkedQuestionsUserScope,
  resiarMarkedQuestionsStorageKey,
  resiarNormalizeQuestionId,
  resiarQuestionIdAtIndex,
  resiarReadPersistentMarkedIds,
  resiarWritePersistentMarkedIds,
  resiarHydratePersistentMarkedForExam,
  resiarPersistMarkedIndexSet
} = configureMarkedQuestions({
  getCurrentUser: () => currentUser,
  getExamen: () => examen,
  readJson,
  writeJson,
  removeStorage
});

try {
  window.resiarResetAccessCache = async function resiarResetAccessCache() {
    try { removeStorage(RESIAR_SESSION_ID_KEY); } catch (_) {}
    try { LEGACY_SESSION_ID_KEYS.forEach((key) => removeStorage(key)); } catch (_) {}
    _serverAcceso = null;
    _serverEsPro = false;
    try { await sb?.auth?.refreshSession?.(); } catch (_) {}
    const result = await verificarAccesoServidor();
    try { renderUserUI(); } catch (_) {}
    try {
      if (result?.acceso && !['bloqueado', 'expirado', 'sin_acceso'].includes(String(result.acceso))) {
        mostrarToast('Acceso actualizado: ' + String(result.acceso));
      }
    } catch (_) {}
    return result;
  };
} catch (_) {}


configureGoogleAuth({ mostrarToast });

try {
  Object.assign(window, {
    escapeHtml,
    markdownToHtml,
    resiarAvatarDisplayName,
    resiarAvatarInitial,
    resiarNormalizeAvatarUrl,
    resiarPickUserAvatarUrl,
    resiarAvatarHtml,
    resiarInstallAvatarFallback,
    formatEsp,
    _normEsp: normEspecialidadKey,
    normEspecialidadKey,
    espRaw,
    temaRaw,
    espLabel,
    normalizarEspValor,
    splitEspecialidades,
    normalizeSearchText,
    PROVINCIA_VALUE,
    EU_VALUE,
    esProvinciaBsAs,
    esBancoMIR,
    esExamenUnico,
    labelExamen,
    mostrarToast,
    _showRichToast,
    readText,
    writeText,
    readJson,
    writeJson,
    removeStorage,
    getNotas,
    saveNotas,
    toggleNota,
    guardarNota,
    toggleNotaDesdePanel,
    guardarNotaDesdePanel,
    mostrarRachaDias,
    resiarParseOrderNumber,
    resiarQuestionOriginalOrderValue,
    resiarQuestionStableFallback,
    resiarStableOriginalQuestionCompare,
    resiarSortByOriginalExamOrder,
    getResiarAuthRedirectTo,
    loginGoogle,
    sonOk,
    sonNo,
    sonTimer,
    sonFin,
    _stopActiveSounds,
    toggleSonido,
    abrirSoundPanel,
    cerrarSoundPanel,
    handleMultiUpload,
    eliminarYrenderizar,
    resetYrenderizar,
    previewSlot,
    previewSlotFile,
    abrirModalLegal,
    cerrarModalLegal,
    abrirModalReporte,
    cerrarModalReporte,
    selMotivo,
    enviarReporte,
    abrirAdminReportes,
    filtrarReportes,
    actualizarEstadoReporte,
    irAReportePregunta,
    checkAdminReportesBtn,
    cargarPrecios,
    _aplicarPreciosDOM,
    abrirUpgrade,
    cerrarUpgrade,
    iniciarPago,
    iniciarPagoDesdeTab,
    renderPlanStatus,
    abrirLeaderboard,
    setLbFilter,
    cargarLeaderboard,
    abrirBibliografia2026,
    abrirDesafio,
    switchChallengeTab,
    cargarHistorialDesafios,
    crearDesafio,
    copiarCodigo,
    copiarLinkDesafio,
    unirseDesafio,
    guardarResultadoDesafio
  });
} catch (_) {}

/*
 * ResiAR — aplicación principal.
 *
 * Extraído del HTML monolítico para iniciar la migración a Vite.
 * Este archivo conserva la lógica junta a propósito: la modularización real
 * se hará en pasos posteriores.
 */

/* ===== resiar-core-app-script ===== */
// ── AUTO-CIERRE DEL POPUP DE GOOGLE ──
// Si esta ventana es el popup de callback (tiene el fragmento #access_token o ?code=),
// intercambia el token con Supabase y se cierra sola.
(async function checkPopup() {
  const isPopup = window.opener && window.opener !== window;
  const hasAuthParams = window.location.hash.includes('access_token') ||
                        window.location.search.includes('code=');
  if (isPopup && hasAuthParams) {
    // Dejar que el SDK de Supabase procese el token del hash/query
    // onAuthStateChange en la ventana padre lo va a detectar
    setTimeout(() => window.close(), 100);
  }
})();

// ── PREGUNTAS (se cargan desde Supabase tras el login) ──
let preguntas = [];

// ── REFS ──
const correctasSpan   = document.getElementById("correctas");
const incorrectasSpan = document.getElementById("incorrectas");
const porcentajeSpan  = document.getElementById("porcentaje");
const timerSpan       = document.getElementById("timer");
const statsBox        = document.getElementById("statsBox");
const navBox          = document.getElementById("navBox");
const rachaBox        = document.getElementById("rachaBox");
const preguntaBox     = document.getElementById("preguntaBox");
const historial       = document.getElementById("historial");
const rachaEl         = document.getElementById("racha");
const streakTexto     = document.getElementById("streakTexto");
const filtroExamen    = document.getElementById("filtroExamen");
const inputTema       = document.getElementById("buscadorTema");
const sugerenciasBox  = document.getElementById("sugerenciasTemas");
const modalFinal      = document.getElementById("modalFinal");

// ── TEMA / SIDEBAR ──
initTheme({ readText, writeText, themeButtonId: 'themeBtn' });
installSidebarAccordion();

const sbToggle = sidebarToggle;
const sbUpdateSummary = updateSidebarSummary;
function sbUpdateCuentaSummary(nombre) {
  return updateSidebarCuentaSummary(nombre, typeof currentProfile !== 'undefined' ? currentProfile : null);
}
const sbUpdateOpcionesSummary = updateSidebarOpcionesSummary;
function toggleTheme() { return toggleResiarTheme(); }

try {
  Object.assign(window, {
    sbToggle,
    sbUpdateSummary,
    sbUpdateCuentaSummary,
    sbUpdateOpcionesSummary,
    toggleTheme
  });
} catch (_) {}

// ── Sidebar collapse toggle ──
// Gobernado exclusivamente por resiar-view-state-sidebar-controller.

// ── Especialidades / texto normalizado ──
try { window.normalizeSearchText = normalizeSearchText; } catch(_) {}

// ── SUGERENCIAS (ordenadas alfabéticamente) ──
const topicSuggestions = configureTopicSuggestions({
  getQuestions: () => preguntas,
  inputEl: inputTema,
  suggestionsEl: sugerenciasBox,
  escapeHtml,
  normalizeSearchText,
  temaRaw,
  debounce
});
topicSuggestions.install();
const resiarTopicQuestionCount = topicSuggestions.resiarTopicQuestionCount;
const setAllTopics = topicSuggestions.setAllTopics;
const clearAllTopics = topicSuggestions.clearTopics;

// Sistema de sonidos migrado a src/ui/sound.js.
// ── CHECKLIST (especialidades ordenadas y formateadas) ──
function deseleccionarEspecialidades() {
  document.querySelectorAll('.espCheck').forEach(cb => cb.checked = false);
}

function resiarSelectedMixedExamKeys() {
  try {
    const debug = typeof window.mixedExamFilterDebug === 'function' ? window.mixedExamFilterDebug() : null;
    return debug && Array.isArray(debug.selected) ? debug.selected.map(String).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function resiarSelectedSpecialtyRaws() {
  const selected = new Set();
  document.querySelectorAll('.espCheck:checked').forEach(cb => {
    try { JSON.parse(cb.value).forEach(value => selected.add(value)); }
    catch (_) { selected.add(cb.value); }
  });
  return [...selected];
}

function resiarCurrentTopicFilterText() {
  try { return String(inputTema?.value || ''); }
  catch (_) { return ''; }
}

function resiarCurrentTopicFilterTexts() {
  try {
    if (typeof window.resiarHomeSelectedTopicValues === 'function') {
      const selected = window.resiarHomeSelectedTopicValues();
      if (Array.isArray(selected) && selected.length) return selected.map(String).filter(Boolean);
    }
  } catch (_) {}

  const text = resiarCurrentTopicFilterText();
  return text ? [text] : [];
}

function resiarBuildExamSelection(options = {}) {
  const result = buildExamQuestionPool({
    questions: preguntas,
    examValue: _filtroExamenValue,
    yearValue: _filtroAnioMirValue,
    mixedSelectedKeys: resiarSelectedMixedExamKeys(),
    selectedSpecialtyRaws: options.includeSpecialty === false ? [] : resiarSelectedSpecialtyRaws(),
    topicText: options.includeTopic === false ? '' : resiarCurrentTopicFilterText(),
    topicTexts: options.includeTopic === false ? [] : resiarCurrentTopicFilterTexts(),
    provinceValue: PROVINCIA_VALUE,
    unifiedValue: EU_VALUE,
    isProvinceExam: esProvinciaBsAs,
    isUnifiedExam: esExamenUnico,
    getSpecialty: espLabel,
    getTopic: temaRaw,
    normalizeText: normalizeSearchText,
    sortByOriginalOrder: (items) => resiarSortByOriginalExamOrder(items),
    shuffleWhenUnfiltered: options.shuffleWhenUnfiltered !== false,
    includeSpecialty: options.includeSpecialty !== false,
    includeTopic: options.includeTopic !== false
  });
  try { window.__resiarLastExamSelection = result.diagnostics; } catch (_) {}
  return result;
}


const RESIAR_SECURE_EXAM_DEFAULT_LIMIT = 100;
const RESIAR_RANDOM_EXAM_MAX_LIMIT = 120;
const RESIAR_EXPLICIT_EXAM_MAX_LIMIT = 10000;
const RESIAR_SECURE_EXAM_MAX_LIMIT = RESIAR_EXPLICIT_EXAM_MAX_LIMIT;
const RESIAR_EXPLICIT_FILTER_STEPS = new Set([
  'mixed_bank_year',
  'province_bank',
  'unified_bank',
  'exact_bank',
  'year',
  'specialty',
  'topic',
  'topic_multi'
]);

function resiarSecureExamEnabled() {
  try { if (window.__RESIAR_DISABLE_SECURE_EXAM_SESSION === true) return false; } catch (_) {}
  return true;
}

function resiarCatalogQuestionIds(pool) {
  return uniqueQuestionIds(Array.isArray(pool) ? pool.map(q => q && q.id) : []);
}

function resiarSelectionHasExplicitFilters(selection = null) {
  const diagnostics = selection && typeof selection === 'object'
    ? (selection.diagnostics && typeof selection.diagnostics === 'object' ? selection.diagnostics : selection)
    : {};

  if (diagnostics.isSpecificExam === true) return true;

  const applied = Array.isArray(diagnostics.applied) ? diagnostics.applied : [];
  if (applied.some((step) => RESIAR_EXPLICIT_FILTER_STEPS.has(String(step || '')))) return true;

  try { if (resiarSelectedMixedExamKeys().length) return true; } catch (_) {}
  try { if (_filtroExamenValue && _filtroExamenValue !== 'todos') return true; } catch (_) {}
  try { if (_filtroAnioMirValue && _filtroAnioMirValue !== 'todos') return true; } catch (_) {}
  try { if (resiarSelectedSpecialtyRaws().length) return true; } catch (_) {}
  try { if (resiarCurrentTopicFilterTexts().length) return true; } catch (_) {}

  return false;
}

function resiarSuggestedSecureExamLimit(pool, mode = 'exam', selection = null) {
  const total = Array.isArray(pool) ? pool.length : 0;
  if (!total) return RESIAR_SECURE_EXAM_DEFAULT_LIMIT;

  const normalizedMode = String(mode || 'exam');
  if (normalizedMode === 'weakness' || normalizedMode === 'review_errors') return Math.min(50, total);

  if (normalizedMode !== 'exam') return Math.min(RESIAR_SECURE_EXAM_MAX_LIMIT, total);

  if (resiarSelectionHasExplicitFilters(selection)) {
    return Math.min(RESIAR_SECURE_EXAM_MAX_LIMIT, total);
  }

  return Math.min(RESIAR_RANDOM_EXAM_MAX_LIMIT, total);
}

function resiarSelectionMeta(extra = {}) {
  return {
    examValue: _filtroExamenValue,
    yearValue: _filtroAnioMirValue,
    mixedSelectedKeys: resiarSelectedMixedExamKeys(),
    selectedSpecialtyRaws: resiarSelectedSpecialtyRaws(),
    topicTexts: resiarCurrentTopicFilterTexts(),
    questionBankVersion: _resiarQuestionBankVersion,
    ...extra
  };
}

async function resiarCreateSecureExamFromCatalog(pool, options = {}) {
  if (!resiarSecureExamEnabled()) {
    throw new Error('La sesión segura de examen está desactivada en este cliente.');
  }

  const ids = resiarCatalogQuestionIds(pool);
  if (!ids.length) throw new Error('No hay preguntas disponibles con esos filtros.');

  const mode = String(options.mode || 'exam').trim() || 'exam';
  const requestedLimit = Number(options.limit || 0) || resiarSuggestedSecureExamLimit(pool, mode, options.selection || null);
  const limit = Math.max(1, Math.min(requestedLimit, ids.length, RESIAR_SECURE_EXAM_MAX_LIMIT));

  const session = await startSecureExamSession({
    supabase: sb,
    questionIds: ids,
    mode,
    limit,
    filters: resiarSelectionMeta(options.filters || {})
  });

  try { window.__resiarLastSecureExamSession = session.diagnostics; } catch (_) {}
  return session;
}

async function resiarStartSecureExamFromCatalog(pool, options = {}) {
  const secure = await resiarCreateSecureExamFromCatalog(pool, options);
  const toast = options.toastMessage || `🔐 Examen seguro · ${secure.questions.length} preguntas · respuestas protegidas`;
  return resiarStartExamSession(secure.questions, {
    ...options,
    mode: options.mode || 'exam',
    toastMessage: toast,
    secureSessionId: secure.sessionId
  });
}

// cargarChecklist / buildNumeroMap: extraídas a ui/checklistEspecialidades.js
// siguiendo el patrón configure(). main.js sigue siendo dueño del pool de
// preguntas (resiarBuildExamSelection) y lo inyecta acá vía closure.
const { cargarChecklist, buildNumeroMap } = configureChecklistEspecialidades({
  getUnfilteredPool: () => resiarBuildExamSelection({
    includeSpecialty: false,
    includeTopic: false,
    shuffleWhenUnfiltered: false
  }).questions
});

// getNPregunta: ver src/utils/questionOrder.js (resiarGetNPregunta). Se
// mantiene este nombre corto porque se usa en decenas de templates de
// main.js; antes había además una segunda implementación que la pisaba en
// runtime (ver historial), ya consolidada acá.
function getNPregunta(p) {
  return resiarGetNPregunta(p);
}

// ── ESTADO ──
let examen = [], respuestas = [], actual = 0;
let _resiarLastAnsweredIndex = -1;
let resiarAnswerResults = [];
let correctas = 0, incorrectas = 0;
let respondidasCount = 0;
let tiempo = 120 * 60, tiempoTotal = 120 * 60, timer;
let marcadas = new Set();
let visitadas = new Set(); // preguntas que el usuario navegó
let tiemposPregunta = []; // segundos por pregunta
let timerPregunta = null, segPregunta = 0;
let soloMarcadas = false;
let examSessionMode = 'exam';
let examSessionStartedAt = 0;
let _lastExamDraftSaveAt = 0;
let _resiarCompletionNoticeShown = false;
let ultimosErrores = []; // preguntas falladas del último examen

// Usuario autenticado actual.
// Debe declararse antes de configurar módulos que pueden consultar estadísticas
// durante el arranque; si queda debajo de actualizarBadge(), Vite/ESM dispara
// TDZ: Cannot access 'currentUser' before initialization.
let currentUser = null;
let currentProfile = null;


/* ══════════════════════════════
   MARCADAS PERSISTENTES LOCALES
   - Persisten entre exámenes.
   - Siguen siendo localStorage, no Supabase.
   - Se guardan por usuario y por ID real de pregunta, no por índice.
══════════════════════════════ */

function resiarSetMarkedIndices(value, options = {}) {
  const input = value instanceof Set ? value : new Set();
  const next = new Set();

  for (const rawIdx of input) {
    const idx = Number(rawIdx);
    if (Number.isInteger(idx) && idx >= 0 && idx < examen.length) {
      next.add(idx);
    }
  }

  marcadas = next;

  if (options.persist !== false) {
    try { resiarPersistMarkedIndexSet(marcadas); } catch (_) {}
  }

  return marcadas;
}

try {
  window.resiarMarkedQuestionsLocal = {
    read: () => [...resiarReadPersistentMarkedIds()],
    clear: () => removeStorage(resiarMarkedQuestionsStorageKey()),
    key: () => resiarMarkedQuestionsStorageKey()
  };
} catch (_) {}


import {
  resiarNormalizeAnswerResult,
  resiarEvaluateQuestionAnswer as resiarEvaluateQuestionAnswerPure
} from './utils/answerEvaluation.js';

/* ══════════════════════════════
   RESULTADOS DE RESPUESTAS EN VIVO
   - Mantiene los contadores superiores derivados de respuestas reales.
   - Necesario desde v69: las respuestas correctas pueden venir del backend
     recién al responder y no siempre existen en el catálogo local.
   - resiarNormalizeAnswerResult / resiarQuestionHasKnownCorrectAnswer /
     resiarEvaluateQuestionAnswer viven en utils/answerEvaluation.js como
     funciones puras (testeadas con datos reales); acá solo queda el wrapper
     que las conecta con el estado del examen en curso.
══════════════════════════════ */

function resiarNormalizeAnswerResultsForExam(values) {
  return Array.from({ length: examen.length }, (_, index) => {
    const raw = Array.isArray(values) ? values[index] : null;
    return resiarNormalizeAnswerResult(raw);
  });
}

function resiarApplyRestoredAnswerResultsToQuestions() {
  try {
    if (!Array.isArray(examen) || !Array.isArray(resiarAnswerResults)) return;

    examen.forEach((question, index) => {
      if (!question || typeof question !== 'object') return;

      const answer = respuestas?.[index];
      const result = resiarNormalizeAnswerResult(resiarAnswerResults[index]);

      // En sesiones seguras, las preguntas no respondidas deben seguir sin respuesta.
      if (!answer || !result) {
        if (question._resiarAnswerHidden === true) {
          question.respuesta = null;
          question._resiarAnswerVerified = false;
        }
        return;
      }

      // Las preguntas ya respondidas necesitan recuperar la respuesta correcta
      // desde el resultado seguro guardado en el borrador. Si no, al retomar,
      // el render las interpreta como "sin respuesta cargada".
      if (result.correctAnswer) {
        question.respuesta = result.correctAnswer;
        question._resiarAnswerHidden = false;
        question._resiarAnswerVerified = true;
      }

      if (result.isAnnulled === true) question.anulada = true;
      if (typeof result.isCorrect === 'boolean') question._resiarLastIsCorrect = result.isCorrect;
    });
  } catch (error) {
    console.warn('[ResiAR] No se pudieron rehidratar respuestas correctas del borrador:', error);
  }
}

async function resiarHydrateDraftThroughSecureSession(draft) {
  if (!draft || !Array.isArray(draft.questionIds) || !draft.questionIds.length) return null;

  const ids = uniqueQuestionIds(draft.questionIds);
  if (!ids.length) return null;

  const secure = await startSecureExamSession({
    supabase: sb,
    questionIds: ids,
    mode: String(draft.mode || 'exam'),
    limit: Math.min(ids.length, RESIAR_SECURE_EXAM_MAX_LIMIT),
    filters: {
      restoreDraft: true,
      draftSavedAt: draft.savedAt || null,
      draftMode: draft.mode || 'exam'
    }
  });

  const hydrated = hydrateExamDraft(draft, secure.questions);
  if (!hydrated) return null;

  try {
    window.__resiarLastSecureExamSession = {
      ...(secure.diagnostics || {}),
      restoredFromDraft: true,
      draftQuestionCount: draft.questionIds.length,
      restoredQuestionCount: hydrated.exam.length,
      at: new Date().toISOString()
    };
  } catch (_) {}

  return { hydrated, secure };
}


function resiarNormalizeAnswerValue(value) {
  return canonicalNormalizeAnswerValue(value);
}

function resiarHasAnswerValue(value) {
  return canonicalHasAnswerValue(value);
}

function resiarEvaluateQuestionAnswer(index) {
  const i = Number(index);
  const question = Array.isArray(examen) ? examen[i] : null;
  const rawAnswer = Array.isArray(respuestas) ? respuestas[i] : null;
  const rawResult = Array.isArray(resiarAnswerResults) ? resiarAnswerResults[i] : null;
  return resiarEvaluateQuestionAnswerPure(question, rawAnswer, rawResult, i);
}

function resiarBuildAnswerResultFromCurrentQuestion(index) {
  const evaluation = resiarEvaluateQuestionAnswer(index);
  if (!evaluation.answered) return null;
  return {
    selectedAnswer: evaluation.selectedAnswer,
    correctAnswer: evaluation.correctAnswer || null,
    isAnnulled: evaluation.isAnnulled === true,
    isCorrect: evaluation.evaluable ? evaluation.isCorrect === true : false
  };
}

function resiarSyncAnswerResultAtIndex(index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || !Array.isArray(resiarAnswerResults)) return null;
  const next = resiarBuildAnswerResultFromCurrentQuestion(i);
  if (next) resiarAnswerResults[i] = next;
  return next;
}

function resiarSummarizeLiveAnswers() {
  let correct = 0;
  let incorrect = 0;
  let answered = 0;
  let annulled = 0;
  let pending = 0;
  let evaluated = 0;

  const total = Math.max(
    Array.isArray(examen) ? examen.length : 0,
    Array.isArray(respuestas) ? respuestas.length : 0
  );

  for (let i = 0; i < total; i++) {
    const evaluation = resiarEvaluateQuestionAnswer(i);
    if (!evaluation.answered) continue;
    answered++;

    if (evaluation.isAnnulled) {
      annulled++;
      continue;
    }

    if (!evaluation.evaluable) {
      pending++;
      continue;
    }

    evaluated++;
    if (evaluation.isCorrect) correct++;
    else if (evaluation.isIncorrect) incorrect++;
  }

  return { correct, incorrect, answered, annulled, pending, evaluated };
}

function resiarApplyLiveStatsFromAnswers() {
  const summary = resiarSummarizeLiveAnswers();
  correctas = summary.correct;
  incorrectas = summary.incorrect;
  respondidasCount = summary.answered;
  return summary;
}

try {
  window.resiarDebugExamScoring = function resiarDebugExamScoring() {
    const summary = resiarSummarizeLiveAnswers();
    const rows = (Array.isArray(examen) ? examen : []).map((question, index) => {
      const ev = resiarEvaluateQuestionAnswer(index);
      return {
        n: index + 1,
        id: question?.id || null,
        respuesta_usuario: ev.rawAnswer || null,
        respuesta_correcta: ev.correctAnswer || null,
        status: ev.status,
        evaluable: ev.evaluable,
        anulada: ev.isAnnulled,
        correcta: ev.isCorrect,
        incorrecta: ev.isIncorrect
      };
    });
    return { summary, rows };
  };
} catch (_) {}

/* ══════════════════════════════
   CONTROLES DE EXAMEN
   Modularizado en src/ui/examControls.js
══════════════════════════════ */
const examControls = configureExamControls({
  getExam: () => examen,
  getAnswers: () => respuestas,
  getCurrentIndex: () => actual,
  setCurrentIndex: (idx) => { actual = idx; },
  getMarked: () => marcadas,
  setMarked: (value) => { resiarSetMarkedIndices(value); },
  getOnlyMarked: () => soloMarcadas,
  setOnlyMarked: (value) => { soloMarcadas = !!value; },
  getQuestionTimes: () => tiemposPregunta,
  getQuestionBox: () => preguntaBox,
  renderExam: () => render(),
  onStateChange: (reason) => resiarSaveCurrentExamDraft(reason),
  stopActiveSounds: () => _stopActiveSounds(),
  answerQuestion: (letter) => responder(letter),
  openSearch: () => abrirBuscador(),
  isModalOpen: () => Boolean(
    document.getElementById('modalFinal')?.classList.contains('vis')
    || document.getElementById('modalStats')?.classList.contains('vis')
    || document.getElementById('modalReview')?.classList.contains('vis')
    || document.getElementById('modalSearch')?.classList.contains('vis')
  )
});

let {
  toggleMarcada,
  actualizarBtnMarcadas,
  toggleFiltroMarcadas,
  iniciarTimerPregunta,
  pausarTimerPregunta,
  initNavDrag,
  irDesdeNav,
  next,
  prev,
  installKeyboardShortcuts
} = examControls;

installKeyboardShortcuts();

/* ══════════════════════════════
   NOTAS POR PREGUNTA
   Modularizado en src/ui/notes.js
══════════════════════════════ */
const notesApi = configureNotes({
  readJson,
  writeJson,
  removeStorage,
  getCurrentUser: () => currentUser,
  getExam: () => examen,
  getActual: () => actual
});

const {
  getNotas,
  saveNotas,
  toggleNota,
  guardarNota,
  toggleNotaDesdePanel,
  guardarNotaDesdePanel,
  getNotesStorageInfo
} = notesApi;

try { window.getNotesStorageInfo = getNotesStorageInfo; } catch (_) {}

/* ══════════════════════════════
   REVISIÓN Y BUSCADOR
   Modularizado en src/ui/reviewSearch.js
══════════════════════════════ */

// v82: el buscador debe matchear también contra las opciones.
// reviewSearch.js pondera fuerte el campo `pregunta`, por eso para buscar
// armamos un proxy local con enunciado + opciones. Al abrir el resultado,
// v81 ya rehidrata desde get_exam_session_v69, así que el examen no muestra
// este texto expandido: solo se usa como índice de búsqueda.






async function resiarStartSearchExamAt(pool, idx) {
  const list = Array.isArray(pool) && pool.length ? pool.slice() : (Array.isArray(preguntas) ? preguntas.slice() : []);
  const maxIndex = Math.max(0, list.length - 1);
  const n = Number(idx);
  const startIndex = Math.max(0, Math.min(Number.isFinite(n) ? n : 0, maxIndex));

  if (!list.length) {
    mostrarToast('No hay preguntas para abrir desde la búsqueda.');
    return false;
  }

  const target = list[startIndex] || list[0];
  const targetId = target && target.id != null ? String(target.id) : '';

  // v81: después de proteger el banco local/cache, los objetos usados por Buscar
  // pueden traer solo metadatos. Para que el enunciado/opciones se hidraten bien,
  // la búsqueda también debe abrir una sesión segura con get_exam_session_v69.
  // Ponemos la pregunta seleccionada primera para garantizar que entre en el límite.
  const ordered = targetId
    ? [target, ...list.filter((q, i) => i !== startIndex && String(q?.id ?? '') !== targetId)]
    : list;

  resiarResetFinalSaveGuard();
  resiarActivarModoExamen();

  try {
    if (resiarSecureExamEnabled()) {
      const secure = await resiarCreateSecureExamFromCatalog(ordered, {
        mode: 'search',
        limit: Math.min(ordered.length, RESIAR_SECURE_EXAM_MAX_LIMIT),
        filters: {
          source: 'question_search',
          targetQuestionId: targetId,
          originalSearchIndex: startIndex
        }
      });

      const hydrated = Array.isArray(secure?.questions) ? secure.questions : [];
      if (!hydrated.length) throw new Error('La sesión segura no devolvió preguntas.');

      let secureStartIndex = 0;
      if (targetId) {
        const found = hydrated.findIndex((q) => String(q?.id ?? '') === targetId);
        if (found >= 0) secureStartIndex = found;
      }

      resiarStartExamSession(hydrated, {
        startIndex: secureStartIndex,
        mode: 'search',
        secureSessionId: secure.sessionId,
        toastMessage: ''
      });

      requestAnimationFrame(() => {
        try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam'); } catch (_) {}
        try { resiarForceExamChromeVisible(); } catch (_) {}
        try { renderRightPanel(); } catch (_) {}
        const dot = document.getElementById(`qnavdot_${secureStartIndex}`);
        if (dot) dot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });

      return true;
    }
  } catch (error) {
    console.warn('[ResiAR] No se pudo abrir búsqueda con sesión segura:', error);
    mostrarToast('No se pudo abrir esa pregunta desde el banco seguro. Probá buscarla de nuevo.');
    return false;
  }

  // Fallback solo si la sesión segura fue desactivada explícitamente en desarrollo.
  resiarStartExamSession(list, { startIndex, mode: 'search' });

  requestAnimationFrame(() => {
    try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam'); } catch (_) {}
    try { resiarForceExamChromeVisible(); } catch (_) {}
    try { renderRightPanel(); } catch (_) {}
    const dot = document.getElementById(`qnavdot_${startIndex}`);
    if (dot) dot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  return true;
}

function resiarStartFullBankSearchExamAt(idx) {
  return resiarStartSearchExamAt(preguntas, idx);
}

configureReviewSearch({
  getCurrentUser: () => currentUser,
  requireLogin: () => abrirLoginReq(),
  getExam: () => examen,
  getAllQuestions: () => resiarEnhanceQuestionSearchPool(preguntas),
  getAnswers: () => respuestas,
  getMarked: () => marcadas,
  getCurrentIndex: () => actual,
  setCurrentIndex: (idx) => { actual = idx; },
  getNotas,
  esRespuestaAnulada: (p) => esRespuestaAnulada(p),
  escapeHtml,
  normalizeSearchText,
  temaRaw,
  espLabel,
  stopActiveSounds: () => _stopActiveSounds(),
  renderExam: () => render(),
  ensureExamChrome: () => {
    try { resiarForceExamChromeVisible(); } catch (_) {}
    try { renderRightPanel(); } catch (_) {}
  },
  getSearchPool: () => {
    try {
      if (typeof window.resiarGetCurrentFilteredQuestions === 'function') {
        const scoped = window.resiarGetCurrentFilteredQuestions();
        if (Array.isArray(scoped)) return resiarEnhanceQuestionSearchPool(scoped);
      }
    } catch (_) {}
    return resiarEnhanceQuestionSearchPool(Array.isArray(preguntas) ? preguntas : []);
  },
  getSearchPreviews: (ids) => resiarFetchQuestionSearchPreviewsRpc(ids),
  searchFullBank: (query, limit) => resiarSearchFullQuestionBankRpc(query, limit),
  startSearchExamAt: (pool, idx) => resiarStartSearchExamAt(pool, idx),
  startFullBankExamAt: (idx) => resiarStartFullBankSearchExamAt(idx)
});

try {
  const originalBuscarPreguntasV83 = buscarPreguntas;
  buscarPreguntas = (...args) => {
    const result = originalBuscarPreguntasV83(...args);
    setTimeout(resiarTrimSearchVisibleOptionSuffix, 0);
    setTimeout(() => resiarScheduleSearchPreviewHydration(0), 80);
    setTimeout(() => resiarScheduleSearchPreviewHydration(0), 240);
    return result;
  };
  window.buscarPreguntas = buscarPreguntas;
} catch (_) {}

try {
  const originalAbrirBuscadorV98 = abrirBuscador;
  abrirBuscador = (...args) => {
    const result = originalAbrirBuscadorV98(...args);
    setTimeout(() => resiarScheduleSearchPreviewHydration(120), 250);
    return result;
  };
  window.abrirBuscador = abrirBuscador;
} catch (_) {}


/* ══════════════════════════════
   REPASO DE ERRORES
══════════════════════════════ */
const RESIAR_ERROR_REVIEW_LIMIT = 200;

function resiarRefreshRecentErrors() {
  try {
    if (!currentUser) {
      ultimosErrores = [];
      resiarSyncReviewErrorsButton();
      return ultimosErrores;
    }
    const stored = loadReviewErrors(readJson, currentUser);
    ultimosErrores = hydrateReviewQuestions(stored, preguntas, { limit: RESIAR_ERROR_REVIEW_LIMIT });
    resiarSyncReviewErrorsButton();
  } catch (error) {
    console.warn('[ResiAR] No se pudo cargar repaso de errores:', error);
    ultimosErrores = [];
    resiarSyncReviewErrorsButton();
  }
  return ultimosErrores;
}

function resiarSaveRecentErrorsFromCurrentSession() {
  try {
    if (!currentUser) {
      ultimosErrores = examen.filter((p, i) => respuestas[i] && !esRespuestaAnulada(p) && respuestas[i] !== p.respuesta);
      resiarSyncReviewErrorsButton();
      return ultimosErrores;
    }
    const stored = loadReviewErrors(readJson, currentUser);
    const updated = updateReviewErrorsFromSession(stored, examen, respuestas, esRespuestaAnulada, { limit: RESIAR_ERROR_REVIEW_LIMIT });
    saveReviewErrors(writeJson, currentUser, updated);
    ultimosErrores = hydrateReviewQuestions(updated, preguntas, { limit: RESIAR_ERROR_REVIEW_LIMIT });
    resiarSyncReviewErrorsButton();
  } catch (error) {
    console.warn('[ResiAR] No se pudo guardar repaso de errores:', error);
    ultimosErrores = examen.filter((p, i) => respuestas[i] && !esRespuestaAnulada(p) && respuestas[i] !== p.respuesta);
    resiarSyncReviewErrorsButton();
  }
  return ultimosErrores;
}

function resiarSyncReviewErrorsButton() {
  // El contador histórico local se mantiene solo para compatibilidad interna.
  // El modo nuevo de Errores arma un examen de hasta 50 preguntas desde user_question_performance,
  // por eso no mostramos "Errores (n)" en el home: ese número pertenecía al caché local viejo.
  const count = Array.isArray(ultimosErrores) ? ultimosErrores.length : 0;
  const label = '🔁 Errores';

  const btnRepaso = document.getElementById('btnRepaso');
  if (btnRepaso) {
    btnRepaso.disabled = count === 0 && !currentUser;
    btnRepaso.innerHTML = label;
  }

  const homeBtnRepaso = document.getElementById('homeBtnRepaso');
  if (homeBtnRepaso) {
    const title = homeBtnRepaso.querySelector('b');
    const desc = homeBtnRepaso.querySelector('span');
    if (title) title.textContent = '🔁 Errores';
    if (desc) desc.textContent = 'Arma un examen de 50 preguntas con errores activos, recurrentes, corregidos y refuerzo asociado.';
  }
}


async function iniciarRepaso() {
  if (estaEnTrialLimitado()) {
    mostrarToast('🔒 Repasar errores está disponible en el plan Pro');
    return;
  }

  let remoteMistakes = { rows: [], source: 'none' };
  let remoteError = null;

  if (currentUser) {
    try {
      remoteMistakes = await cargarMistakePerformanceRowsRemotas(currentUser);
    } catch (error) {
      remoteError = error;
      console.warn('[ResiAR] No se pudieron cargar errores remotos:', error);
    }
  }

  const plan = buildMistakesExamPlan({
    questions: preguntas,
    questionRows: remoteMistakes.rows,
    source: remoteMistakes.source,
    splitEspecialidades,
    espLabel,
    topicLabel: temaRaw,
    normalizeSpecialty: normEspecialidadKey,
    limit: 50
  });

  try { window.__resiarLastMistakesPlan = plan; } catch (_) {}

  if (plan.hasMistakes && plan.pool.length) {
    cerrarModal();
    resiarResetFinalSaveGuard();
    resiarActivarModoExamen();

    const principales = plan.topics.slice(0, 3).map((item) => item.tema).filter(Boolean).join(', ');
    const sourceLabels = {
      user_question_performance: 'historial normalizado',
      exam_answers_fallback: 'respuestas guardadas',
      none: 'historial disponible'
    };
    const sourceLabel = sourceLabels[plan.source] || plan.source || 'historial disponible';

    try {
      await resiarStartSecureExamFromCatalog(plan.pool, {
        mode: 'review_errors',
        limit: 50,
        filters: { mistakesSource: plan.source },
        toastMessage: `🔁 Examen seguro por errores · hasta 50 preguntas · ${sourceLabel}${principales ? ` · temas: ${principales}` : ''}`
      });
    } catch (error) {
      mostrarToast('No se pudo iniciar el examen seguro por errores: ' + (error?.message || error));
      console.warn('[ResiAR v69B] Error iniciando errores seguro:', error);
    }
    return;
  }

  // Fallback histórico local: mantiene compatibilidad con sesiones previas o usuarios sin login.
  resiarRefreshRecentErrors();
  if (!ultimosErrores.length) {
    mostrarToast(remoteError
      ? '🔁 No hay errores disponibles y falló la lectura remota: ' + (remoteError.message || 'error Supabase')
      : '🔁 No hay errores suficientes para repasar. Terminá un examen con respuestas incorrectas para activarlo.');
    try {
      const sideBar = document.querySelector('aside');
      const publicLanding = (window.resiarIsPublicLandingVisible && window.resiarIsPublicLandingVisible()) || !!document.getElementById('preguntaBox')?.querySelector('#welcome:not(.home-sim), .lp-nav, .lp-hero');
      if (sideBar && currentUser && !publicLanding) sideBar.classList.add('visible');
    } catch(_) {}
    return;
  }

  cerrarModal();
  resiarResetFinalSaveGuard();
  resiarActivarModoExamen();
  const repasoPool = ultimosErrores.slice().sort(() => Math.random() - 0.5).slice(0, 50);
  try {
    await resiarStartSecureExamFromCatalog(repasoPool, {
      mode: 'review_errors',
      limit: 50,
      filters: { mistakesSource: 'local-fallback' },
      toastMessage: `🔁 Repaso seguro de errores local · hasta 50 pregunta${repasoPool.length>1?'s':''}`
    });
  } catch (error) {
    mostrarToast('No se pudo iniciar el repaso seguro de errores: ' + (error?.message || error));
    console.warn('[ResiAR v69B] Error iniciando errores local seguro:', error);
  }
}

/* ══════════════════════════════
   RACHA DE DÍAS
══════════════════════════════ */
configureStudyStreak({
  readText,
  writeText,
  readJson,
  writeJson,
  getCurrentUser: () => currentUser,
  hasActiveExam: () => {
    try {
      const isHomeOrLanding = !!document.querySelector('#welcome') || !!document.querySelector('.home-sim');
      const hasActiveExam = !!(typeof examen !== 'undefined' && Array.isArray(examen) && examen.length);
      const view = document.body?.dataset?.resiarView || '';
      return hasActiveExam && !isHomeOrLanding && view !== 'config' && view !== 'landing' && window._resiarExamFinished !== true;
    } catch (_) {
      return false;
    }
  }
});

/* ══════════════════════════════
   EXPORTAR PDF
══════════════════════════════ */
const exportarPDF = createExamPdfExporter({
  getExam: () => examen,
  getAnswers: () => respuestas,
  getCorrectas: () => correctas,
  getIncorrectas: () => incorrectas,
  getTiempoTotal: () => tiempoTotal,
  getTiempo: () => tiempo,
  getTiemposPregunta: () => tiemposPregunta,
  esRespuestaAnulada,
  escapeHtml
});
try { window.exportarPDF = exportarPDF; } catch (_) {}

// ── FILTROS ──
let _filtroExamenValue = 'todos';
Object.defineProperty(document, '_filtroProxy', { value: true });

// cargarFiltros / cargarAniosMir / selectAnioMir / toggleAnioMirSelect /
// selectExamen / toggleCustomSelect: extraídas a ui/examBankFilter.js
// siguiendo el patrón configure(). main.js sigue siendo dueño del estado
// (_filtroExamenValue, _filtroAnioMirValue, preguntas) y lo inyecta acá
// vía closure.
let _filtroAnioMirValue = 'todos';
// `cargarFiltros` es `let` (no `const`): más abajo, `installFilterHooks()`
// la envuelve en runtime para integrar el filtro de "exámenes mixtos"
// (ver window.cargarFiltros ~línea 4741). Es un wrapper deliberado, no un
// duplicado divergente (a diferencia del caso de la pasada 4).
let {
  cargarFiltros,
  cargarAniosMir,
  selectAnioMir,
  toggleAnioMirSelect,
  selectExamen,
  toggleCustomSelect
} = configureExamBankFilter({
  getPreguntas: () => preguntas,
  getFiltroExamenValue: () => _filtroExamenValue,
  setFiltroExamenValue: (v) => { _filtroExamenValue = v; },
  getFiltroAnioMirValue: () => _filtroAnioMirValue,
  setFiltroAnioMirValue: (v) => { _filtroAnioMirValue = v; }
});

// Parchear filtroExamen.value para leer de _filtroExamenValue


// ── ORDEN ORIGINAL ESTABLE ──
// Utilidades puras extraídas a src/utils/questionOrder.js.
function resiarIsSpecificFilterActive() {
  try {
    return Boolean(
      (_filtroExamenValue && _filtroExamenValue !== 'todos') ||
      (_filtroAnioMirValue && _filtroAnioMirValue !== 'todos')
    );
  } catch(_) { return false; }
}

// ── INICIAR ──
function abrirLoginReq() { document.getElementById('modalLoginReq').classList.add('vis'); }
function cerrarLoginReq() { document.getElementById('modalLoginReq').classList.remove('vis'); }

function resiarActivarModoExamen() {
  try { if (typeof resiarSetWhatsAppVisible === 'function') resiarSetWhatsAppVisible(false); } catch(_) {}
  try { if (typeof resiarHideStreakToast === 'function') resiarHideStreakToast(); } catch(_) {}
  try {
    window._resiarExamRunning = true;
    window._resiarExamFinished = false;
    if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam');
  } catch(_) {}
  try { statsBox?.classList.add('vis'); } catch(_) {}
  try { document.getElementById('rightPanel')?.classList.add('vis'); } catch(_) {}
  try { navBox?.classList.add('vis'); } catch(_) {}
  try { rachaBox?.classList.add('vis'); } catch(_) {}
  try { actualizarRachaPill(); } catch(_) {}
  try { resiarForceExamChromeVisible(); } catch(_) {}
  requestAnimationFrame(function(){
    try { document.getElementById('rightPanel')?.classList.add('vis'); } catch(_) {}
    try { if (typeof resiarSyncViewState === 'function') resiarSyncViewState(); } catch(_) {}
  });
}


function resiarForceExamChromeVisible() {
  // El chrome lateral debe estar activo para cualquier sesión de examen,
  // incluyendo errores/debilidades. No ocultamos la grilla inline con CSS:
  // garantizamos que el estado DOM canónico sea de examen antes/después del render.
  try {
    if (!Array.isArray(examen) || !examen.length || window._resiarExamFinished === true) return;
    document.body.dataset.resiarView = 'exam';
    document.body.classList.add('resiar-user-authenticated', 'resiar-in-simulator', 'resiar-view-exam');
    document.body.classList.remove('resiar-config-home', 'resiar-view-config', 'resiar-view-landing', 'resiar-exam-ended', 'resiar-view-exam-ended', 'resiar-public-landing', 'resiar-landing-mobile-ui');
    document.documentElement?.classList?.remove?.('resiar-mobile-scroll-root');
  } catch (_) {}
  try { statsBox?.classList.add('vis'); } catch (_) {}
  try { document.getElementById('rightPanel')?.classList.add('vis'); } catch (_) {}
  try { navBox?.classList.add('vis'); } catch (_) {}
  try { rachaBox?.classList.add('vis'); } catch (_) {}
}

function resiarCanPersistExamDraft() {
  try {
    return Boolean(currentUser && examen.length && window._resiarExamRunning && !window._resiarExamFinished);
  } catch (_) {
    return false;
  }
}

function resiarSaveCurrentExamDraft(reason = 'state', options = {}) {
  if (!resiarCanPersistExamDraft()) return false;
  // No persistimos desafíos: su resultado depende de realtime/ranking y conviene reiniciarlos desde el flujo dedicado.
  try { if (window._desafioActivo) return false; } catch (_) {}
  const now = Date.now();
  if (!options.force && now - _lastExamDraftSaveAt < 650) return false;
  const payload = buildExamDraftPayload({
    user: currentUser,
    exam: examen,
    answers: respuestas,
    answerResults: resiarAnswerResults,
    currentIndex: actual,
    marked: marcadas,
    visited: visitadas,
    questionTimes: tiemposPregunta,
    timeRemaining: tiempo,
    timeTotal: tiempoTotal,
    startedAt: examSessionStartedAt || now,
    mode: examSessionMode || 'exam'
  });
  if (!payload) return false;
  payload.reason = String(reason || 'state');
  const ok = saveExamDraft(writeJson, currentUser, payload);
  if (ok) _lastExamDraftSaveAt = now;
  return ok;
}

function resiarClearCurrentExamDraft() {
  try { clearExamDraft(removeStorage, currentUser); } catch (_) {}
}

function resiarRestoreExamSessionFromDraft(hydrated) {
  if (!hydrated || !Array.isArray(hydrated.exam) || !hydrated.exam.length) return false;
  _stopActiveSounds();
  clearInterval(timer);
  pausarTimerPregunta();
  cerrarModal();
  try { cerrarReview(); } catch(_) {}
  try { resiarResetFinalSaveGuard(); } catch(_) {}

  examen = hydrated.exam.map((question) => normalizeQuestionAnswerSchema(question));
  try { buildNumeroMap(examen); } catch(_) {}
  respuestas = hydrated.answers.slice();
  _resiarLastAnsweredIndex = -1;
  for (let i = respuestas.length - 1; i >= 0; i--) {
    if (resiarHasAnswerValue(respuestas[i])) { _resiarLastAnsweredIndex = i; break; }
  }
  resiarAnswerResults = resiarNormalizeAnswerResultsForExam(hydrated.answerResults);
  resiarApplyRestoredAnswerResultsToQuestions();
  actual = hydrated.currentIndex;
  marcadas = resiarHydratePersistentMarkedForExam(hydrated.marked);
  try { resiarPersistMarkedIndexSet(marcadas); } catch(_) {}
  visitadas = hydrated.visited;
  tiemposPregunta = hydrated.questionTimes.slice();
  tiempo = hydrated.timeRemaining || 120 * 60;
  tiempoTotal = hydrated.timeTotal || 120 * 60;
  examSessionStartedAt = hydrated.startedAt || Date.now();
  examSessionMode = hydrated.mode || 'exam';

  resiarApplyLiveStatsFromAnswers();
  soloMarcadas = false;

  resiarActivarModoExamen();
  updateStats();
  iniciarTimer(tiempo, tiempoTotal);
  iniciarTimerPregunta();
  render();
  try { actualizarBtnMarcadas(); } catch(_) {}
  resiarSaveCurrentExamDraft('restore', { force: true });
  mostrarToast('Examen retomado desde el último progreso guardado.');
  return true;
}

async function resiarTryRestoreExamDraft() {
  if (!currentUser) return false;
  if (window._resiarExamRunning && !window._resiarExamFinished) return false;

  let draft = null;
  try {
    draft = loadExamDraft(readJson, currentUser);
  } catch (error) {
    console.warn('[ResiAR] No se pudo leer borrador de examen:', error);
  }

  if (!draft) return false;

  const totalDraft = Array.isArray(draft.questionIds) ? draft.questionIds.length : 0;
  const answered = Array.isArray(draft.answers) ? draft.answers.filter(Boolean).length : 0;
  const savedDate = draft.savedAt ? new Date(draft.savedAt).toLocaleString('es-AR') : 'reciente';

  const shouldRestore = confirm(`Tenés un examen en curso guardado (${answered}/${totalDraft} respondidas, ${savedDate}).

¿Querés retomarlo?`);

  if (!shouldRestore) {
    resiarClearCurrentExamDraft();
    return false;
  }

  try {
    // Desde v69 el banco local/cache ya no contiene enunciado, opciones ni respuesta.
    // Por eso el borrador NO debe hidratarse contra `preguntas`.
    // Se recrea una sesión segura con los IDs del borrador y luego se reinyectan
    // las respuestas ya contestadas desde answerResults.
    const restored = await resiarHydrateDraftThroughSecureSession(draft);
    if (!restored?.hydrated) {
      throw new Error('El servidor no devolvió todas las preguntas del borrador.');
    }

    return resiarRestoreExamSessionFromDraft(restored.hydrated);
  } catch (error) {
    console.warn('[ResiAR] No se pudo retomar el examen seguro:', error);
    resiarClearCurrentExamDraft();
    try {
      mostrarToast('No se pudo retomar el examen guardado. Generá un examen nuevo.');
    } catch (_) {}
    return false;
  }
}

function resiarResetExamSession(questionList, startIndex = 0) {
  try { if (typeof exitExamReviewMode === 'function') exitExamReviewMode(); } catch(_) {}
  try { window._resiarExamReviewMode = false; document.body.classList.remove('resiar-exam-review', 'resiar-view-exam-review'); } catch(_) {}
  const list = Array.isArray(questionList) ? questionList.slice() : [];
  examen = list.map((question) => normalizeQuestionAnswerSchema(question));
  try { buildNumeroMap(examen); } catch(_) {}

  const maxIndex = Math.max(0, examen.length - 1);
  const idx = Number(startIndex);
  actual = examen.length ? Math.max(0, Math.min(Number.isFinite(idx) ? idx : 0, maxIndex)) : 0;

  correctas = 0;
  incorrectas = 0;
  respondidasCount = 0;
  respuestas = new Array(examen.length).fill(null);
  resiarAnswerResults = new Array(examen.length).fill(null);
  _resiarLastAnsweredIndex = -1;
  marcadas = resiarHydratePersistentMarkedForExam();
  visitadas = new Set();
  tiemposPregunta = [];
  soloMarcadas = false;

  try { historial.innerHTML = ''; } catch(_) {}
  try { rachaEl.innerHTML = ''; } catch(_) {}
  try { streakTexto.innerText = ''; } catch(_) {}
  try { correctasSpan.innerText = 0; } catch(_) {}
  try { incorrectasSpan.innerText = 0; } catch(_) {}
  try { porcentajeSpan.innerText = '0%'; } catch(_) {}
  try { if (typeof actualizarBtnMarcadas === 'function') actualizarBtnMarcadas(); } catch(_) {}
  try { const btnMarked = document.getElementById('btnFilterMarked'); if (btnMarked && !marcadas.size) btnMarked.style.display = 'none'; } catch(_) {}
}


function resiarShouldShowExamStartToast(message) {
  if (!message) return false;
  const text = String(message || '').toLowerCase();
  // v69B-bis: no mostrar banners internos de seguridad al usuario final.
  // La sesión sigue siendo segura; solo se elimina el toast visual.
  if (text.includes('examen seguro')) return false;
  if (text.includes('respuestas protegidas')) return false;
  return true;
}

function resiarStartExamSession(questionList, options = {}) {
  const list = Array.isArray(questionList) ? questionList : [];
  if (!list.length) return false;
  examSessionStartedAt = Date.now();
  examSessionMode = String(options.mode || 'exam').trim() || 'exam';
  _lastExamDraftSaveAt = 0;
  _resiarCompletionNoticeShown = false;
  resiarResetExamSession(list, options.startIndex || 0);

  // El inicio de sesión de examen debe ser canónico para todos los modos
  // (normal, errores, debilidades, búsqueda, invitación). Antes algunos flujos
  // especiales llegaban a renderizar sin reactivar el chrome lateral, porque el
  // controlador de vista veía el render a mitad de transición.
  try {
    window._resiarExamRunning = true;
    window._resiarExamFinished = false;
    if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam');
  } catch (_) {}
  try { statsBox?.classList.add('vis'); } catch (_) {}
  try { document.getElementById('rightPanel')?.classList.add('vis'); } catch (_) {}
  try { navBox?.classList.add('vis'); } catch (_) {}
  try { rachaBox?.classList.add('vis'); } catch (_) {}
  try { resiarForceExamChromeVisible(); } catch (_) {}

  iniciarTimer(options.timeRemaining, options.timeTotal);
  iniciarTimerPregunta();
  render();
  try { resiarForceExamChromeVisible(); } catch (_) {}
  try { renderRightPanel(); } catch (_) {}

  requestAnimationFrame(() => {
    try { document.getElementById('rightPanel')?.classList.add('vis'); } catch (_) {}
    try { navBox?.classList.add('vis'); } catch (_) {}
    try { statsBox?.classList.add('vis'); } catch (_) {}
    try { if (typeof window.resiarEnsureExamRuntime === 'function') window.resiarEnsureExamRuntime({ showStreak:false }); } catch (_) {}
    try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam'); } catch (_) {}
    try { renderRightPanel(); } catch (_) {}
  });

  resiarSaveCurrentExamDraft('start', { force: true });
  if (resiarShouldShowExamStartToast(options.toastMessage)) mostrarToast(options.toastMessage);
  return true;
}

async function iniciar() {
  if (!currentUser) { abrirLoginReq(); return; }
  try { if (typeof resiarSetWhatsAppVisible === 'function') resiarSetWhatsAppVisible(false); } catch(_) {}
  try { if (typeof resiarHideStreakToast === 'function') resiarHideStreakToast(); } catch(_) {}

  // ── VERIFICACIÓN SERVER-SIDE en tiempo real ──
  // Se consulta al servidor en cada intento de generar un examen.
  // Cambiar variables en DevTools no tiene efecto: el servidor decide.
  const { acceso } = await verificarAccesoServidor();
  if (acceso === 'bloqueado' || acceso === 'expirado') {
    mostrarPantallaBloqueo(acceso === 'expirado' ? 'pro_expirado' : 'bloqueado');
    mostrarToast(acceso === 'expirado'
      ? '⚠️ Tu plan Pro venció. No podés generar exámenes.'
      : '🔒 Sin acceso activo. Contactá al administrador.');
    return;
  }

  cerrarModal();
  resiarResetFinalSaveGuard();
  try {
    window._resiarExamRunning = true;
    window._resiarExamFinished = false;
    if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam');
  } catch(_) {}
  // Al iniciar un examen normal, cancelar cualquier desafío activo y su suscripción
  window._desafioActivo = null;
  _detenerRealtimeDesafio(true);
  const rankingBox = document.getElementById('desafioRankingFinal');
  if (rankingBox) rankingBox.style.display = 'none';

  resiarActivarModoExamen();

  const examSelection = resiarBuildExamSelection();
  const pool = examSelection.questions;
  if (!pool.length) {
    try { window._resiarExamRunning = false; window._resiarExamFinished = true; if (typeof resiarMarkViewState === 'function') resiarMarkViewState('config'); } catch(_) {}
    alert("No hay preguntas con esos filtros");
    return;
  }

  try {
    await resiarStartSecureExamFromCatalog(pool, {
      mode: 'exam',
      limit: resiarSuggestedSecureExamLimit(pool, 'exam', examSelection),
      selection: examSelection,
      toastMessage: `🔐 Examen seguro · respuestas protegidas · ${resiarSuggestedSecureExamLimit(pool, 'exam', examSelection)} preguntas`
    });
  } catch (error) {
    try { window._resiarExamRunning = false; window._resiarExamFinished = true; if (typeof resiarMarkViewState === 'function') resiarMarkViewState('config'); } catch(_) {}
    mostrarToast('No se pudo iniciar el examen seguro: ' + (error?.message || error));
    console.warn('[ResiAR v69B] Error iniciando examen seguro:', error);
  }
}

// ── RENDER ──
// Navegación de examen (grilla de "puntitos") extraída a ui/examNav.js.
const {
  getQuestionNavClass,
  renderNavDotsOptimized,
  syncNavDotState,
  renderNavGridInto
} = configureExamNav({
  getExamen: () => examen,
  getActual: () => actual,
  getMarcadas: () => marcadas,
  getVisitadas: () => visitadas,
  evaluateQuestionAnswer: (i) => resiarEvaluateQuestionAnswer(i)
});



try { window.resiarRefreshQuestionImagesCache = resiarRefreshQuestionImagesCache; } catch (_) {}

// getQuestionImageUrlFromPath: wrapper delgado sobre la versión canónica y
// testeada de utils/questionImages.js (unificado; antes había una
// reimplementación completa acá con la misma lógica). Solo agrega el
// estado propio de main.js (versión del banco de preguntas) como opciones.
function getQuestionImageUrlFromPath(path) {
  return resiarGetQuestionImageUrlFromPathBase(path, {
    questionBankVersion: _resiarQuestionBankVersion,
    fallbackVersion: RESIAR_QB_VERSION_FALLBACK
  });
}

function renderQuestionImage(p) {
  return renderQuestionImageBase(p, { getQuestionImageUrlFromPath });
}


function resiarUseMobileExamUi() {
  try {
    if (typeof window.resiarShouldUseMobileExamUi === 'function') return !!window.resiarShouldUseMobileExamUi();
  } catch (_) {}
  try { return !!(window.matchMedia && window.matchMedia('(max-width: 1180px)').matches); }
  catch (_) { return false; }
}

function resiarDesktopExamNavHtml(isReviewMode) {
  if (isReviewMode) {
    return `
    <div class="nav-inline nav-review-mode resiar-desktop-exam-nav" data-exam-nav-role="desktop">
      <button class="bnav" data-action="exam-prev" ${actual === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="bfin" data-action="close-review-and-show-final">Volver al resultado</button>
      <button class="bnext" data-action="exam-next" ${actual === examen.length - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>`;
  }

  return `
    <div class="nav-inline resiar-desktop-exam-nav" data-exam-nav-role="desktop">
      <button class="bnav" data-action="exam-prev" ${actual === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="bfin" data-action="exam-finish">Finalizar examen</button>
      <button class="bnext" data-action="exam-next" ${actual === examen.length - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>`;
}

function resiarGetMobileExamState() {
  const total = Array.isArray(examen) ? examen.length : 0;
  const current = total ? actual + 1 : 0;
  const isReviewMode = !!(window._resiarExamReviewMode || document.body.classList.contains('resiar-exam-review'));
  return {
    active: total > 0 && window._resiarExamFinished !== true && (document.body.dataset.resiarView === 'exam' || window._resiarExamRunning || isReviewMode),
    current,
    currentIndex: actual,
    total,
    label: total ? `${current}/${total}` : 'Mapa',
    answered: respondidasCount,
    correct: correctas,
    incorrect: incorrectas,
    canPrev: total > 0 && actual > 0,
    canNext: total > 0 && actual < total - 1,
    canFinish: total > 0,
    finishLabel: isReviewMode ? 'Volver' : 'Fin',
    isReviewMode
  };
}

function resiarInstallMobileExamRuntime() {
  try {
    window.resiarShouldUseMobileExamUi = resiarUseMobileExamUi;
    window.resiarExamMobileRuntime = {
      getState: resiarGetMobileExamState,
      render: () => render(),
      prev: () => prev(),
      next: () => next(),
      goTo(index) {
        const idx = Number(index);
        if (Number.isFinite(idx)) irDesdeNav(Math.max(0, Math.min(idx, Math.max(0, examen.length - 1))));
      },
      finish() {
        const state = resiarGetMobileExamState();
        if (state.isReviewMode) {
          try { cerrarReview(); } catch (_) {}
          try { exitExamReviewMode(); } catch (_) {}
          try { document.getElementById('modalFinal')?.classList.add('vis'); } catch (_) {}
          return;
        }
        confirmarFinalizar();
      }
    };
  } catch (_) {}
}

function render() {
  if (!examen.length) return;
  try {
    document.body.classList.add('resiar-user-authenticated', 'resiar-in-simulator', 'resiar-view-exam', 'resiar-exam-render-active');
    document.body.classList.remove('resiar-config-home', 'resiar-view-config', 'resiar-view-landing', 'resiar-public-landing', 'resiar-landing-mobile-ui');
    document.documentElement?.classList?.remove?.('resiar-mobile-scroll-root');
    document.body.dataset.resiarView = 'exam';
    preguntaBox?.setAttribute('data-resiar-render', 'exam-question');
  } catch (_) {}
  try { if (window._resiarExamRunning && window._resiarExamFinished !== true) resiarForceExamChromeVisible(); } catch (_) {}
  visitadas.add(actual); // marcar como visitada
  const p = examen[actual];
  const resp = !!respuestas[actual];
  const isMarked = marcadas.has(actual);
  const nota = getNotas()[`q_${p.id ?? actual}`] || '';
  const seg = tiemposPregunta[actual] || 0;
  const timerCls = seg > 120 ? 'veryslow' : seg > 60 ? 'slow' : '';
  const timerTxt = seg ? `⏱ ${Math.floor(seg/60).toString().padStart(2,'0')}:${(seg%60).toString().padStart(2,'0')}` : '';
  const isReviewMode = !!(window._resiarExamReviewMode || document.body.classList.contains('resiar-exam-review'));
  const showResolution = resp || isReviewMode;

  let html = `<div class="fade-in resiar-exam-question${isReviewMode ? ' review-question-mode' : ''}">
    <div class="qhdr resiar-question-header">
      <span class="qcount">${actual + 1} / ${examen.length}</span>
      <div class="qhdr-actions">
        ${timerTxt ? `<span class="q-timer ${timerCls}">${timerTxt}</span>` : ''}
        ${adminQuestionEditor.renderQuestionToolbarButton()}
        <button class="btn-bookmark ${isMarked?'marked':''}" data-action="exam-toggle-marked" data-index="${actual}" title="${isMarked?'Quitar marcador':'Marcar para revisar'}">${isMarked?'🔖':'🏷️'}</button>
        <span class="qmeta">${(() => {
    const anio = (p.anio || p.año || p.year);
    const examenNombre = esExamenUnico(p.examen) ? 'Examen Único' : p.examen;
    const examenYaTieneAnio = anio && examenNombre && examenNombre.includes(String(anio));
    const esENARM = (p.examen || '').toUpperCase().includes('ENARM');
    const partes = [examenNombre, (examenYaTieneAnio || esENARM) ? null : anio].filter(Boolean);
    return partes.join(' · ');
  })()}<br>Pregunta ${getNPregunta(p)}</span>
      </div>
    </div>
    <div class="qtext resiar-question-text">${renderQuestionTextWithImageRef(p.pregunta, p)}</div>${renderQuestionImage(p)}
  ${renderQuestionRepeatedBanner(p)}
  ${esRespuestaAnulada(p) ? `
  <div class="banner-anulada">
    ⚠️ <span>${esBancoMIR(p.examen)
      ? `<strong>Pregunta anulada por el MIR</strong> — Esta pregunta fue anulada oficialmente por las autoridades responsables del examen MIR. Tu elección no afecta tu puntaje.`
      : `<strong>Pregunta sin respuesta cargada</strong> — Esta pregunta puede tener un error en la base de datos. Tu elección no afecta tu puntaje. Si podés confirmar la respuesta correcta, usá el botón <em>Reportar pregunta</em> para ayudarnos a corregirla.`
    }</span>
  </div>` : ''}`;

  for (const [rawKey, optionText] of getCanonicalOptionEntries(p)) {
    const optionKey = resiarNormalizeAnswerValue(rawKey);
    let cls = "opcion resiar-option";
    if (showResolution) {
      const evaluation = resiarEvaluateQuestionAnswer(actual);
      if (evaluation.isAnnulled) {
        if (optionKey === evaluation.selectedAnswer) cls += " anulada";
      } else if (evaluation.correctAnswer) {
        if (optionKey === evaluation.correctAnswer) cls += " ok";
        else if (resp && optionKey === evaluation.selectedAnswer) cls += " no";
      } else if (resp && optionKey === evaluation.selectedAnswer) {
        cls += " pendiente";
      }
    }
    const safeKey = escapeHtml(optionKey || rawKey);
    const answerAttrs = showResolution || p._resiarSubmittingAnswer ? 'data-off="1"' : `data-action="exam-answer" data-answer="${safeKey}"`;
    html += `<label class="${cls}" ${answerAttrs}>
      <input type="radio" ${showResolution ? "disabled" : ""}>
      <span class="olbl resiar-option-label">${safeKey}</span>
      <span class="otext resiar-option-text">${escapeHtml(optionText)}</span>
    </label>`;
  }

  // Navegación principal de escritorio. En celular/tablet se renderiza un chrome
  // móvil independiente que llama a las funciones de examen por API, no por clicks
  // sobre botones desktop escondidos.
  if (!resiarUseMobileExamUi()) {
    html += resiarDesktopExamNavHtml(isReviewMode);
  }

  // El editor de notas vive dentro del rightPanel (ver toggleNotaDesdePanel)

  // Botón IA + slot de explicación (solo tras responder)
  if (showResolution) {
    if (estaEnTrialLimitado()) {
      html += `
        <div style="margin-top:14px;padding:11px 16px;background:linear-gradient(135deg,rgba(251,191,36,0.07),rgba(167,139,250,0.07));border:1px solid rgba(251,191,36,0.25);border-radius:11px;font-family:var(--font-ui);font-size:0.78rem;color:var(--text2);text-align:center;line-height:1.6;">
          🔒 <strong style="color:var(--amber)">Explicación con IA</strong> disponible en el plan Pro
        </div>`;
    } else {
      html += `
        <button class="btn-explicar" id="btnExplicar" data-action="exam-request-explanation">
          <span class="ai-spinner"></span>
          <span class="ai-icon">⚙</span>
          <span class="ai-txt">✨ Explicar con IA</span>
        </button>
        <div id="explicacionBox"></div>`;
    }
  }

  // Navegador inline de preguntas.
  // El panel derecho es la navegación canónica del simulador. La grilla inline solo queda
  // como fallback real si el layout no tiene rightPanel/navBox disponibles. Esto evita
  // duplicar navegación en examen normal, repaso por errores, debilidades y revisión.
  const rightPanelEl = document.getElementById('rightPanel');
  const navBoxEl = document.getElementById('navBox');
  const hasSideQuestionNav = !!(rightPanelEl || navBoxEl);
  const shouldRenderInlineNav = !isReviewMode && !hasSideQuestionNav;
  if (shouldRenderInlineNav) {
    html += `
      <div class="qnav-wrap">
        <div class="qnav-grid">${renderNavDotsOptimized('inline')}</div>
      </div>`;
  }

  if (window._resiarExamRunning && !window._resiarExamFinished) {
    html += questionChatDockHtml(p);
  }

  // Auto-scroll al número activo tras render
  requestAnimationFrame(() => {
    if (shouldRenderInlineNav) {
      const dot = document.getElementById(`qnavdot_${actual}`);
      if (dot) dot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    initNavDrag();
  });



  html += `</div>`;
  preguntaBox.innerHTML = html;
  try {
    preguntaBox?.setAttribute('data-resiar-render', 'exam-question');
    document.body.classList.add('resiar-exam-render-active');
    if (window.matchMedia && window.matchMedia('(max-width: 1180px)').matches) {
      preguntaBox?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    }
  } catch (_) {}
  if (window._resiarExamRunning && !window._resiarExamFinished) {
    questionChatAfterRender();
  } else {
    try { if (typeof questionChatClose === 'function') questionChatClose(); } catch(_) {}
    try { if (typeof window.resiarSyncQuestionChat === 'function') window.resiarSyncQuestionChat('config'); } catch(_) {}
  }
  renderHistorial();
  renderRightPanel();
}

// ── PANEL DERECHO ──
function renderRightPanel() {
  const panel = document.getElementById('rightPanel');
  if (!panel || !examen.length) return;

  // En cualquier examen activo o revisión, el panel derecho es la navegación
  // canónica. Los modos especiales (errores/debilidades) no deben quedar sin
  // panel por depender del orden de sincronización del controlador de vista.
  try {
    const chromeActive = !!(window._resiarExamRunning || window._resiarExamReviewMode || document.body.classList.contains('resiar-exam-review')) && window._resiarExamFinished !== true;
    if (chromeActive) {
      panel.classList.add('vis');
      navBox?.classList.add('vis');
      statsBox?.classList.add('vis');
    }
  } catch (_) {}

  // Actualizar texto de progreso
  const respondidas = respondidasCount;
  const rpText = document.getElementById('rpProgressText');
  if (rpText) {
    rpText.innerHTML = `${respondidas} de ${examen.length} &nbsp;·&nbsp; <span style="color:var(--green)">${correctas} correctas</span> · <span style="color:var(--red)">${incorrectas} incorrecta${incorrectas !== 1 ? 's' : ''}</span>`;
  }
  // Actualizar barra de progreso
  const rpFill = document.getElementById('rpProgressFill');
  if (rpFill && examen.length) {
    rpFill.style.width = Math.round(respondidas / examen.length * 100) + '%';
  }

  // Sincronizar estado del botón "Agregar nota" según si la pregunta actual tiene nota
  const pregAct = examen[actual];
  if (pregAct) {
    const notaKey   = `q_${pregAct.id ?? actual}`;
    const notas     = getNotas();
    const tieneNota = !!(notas[notaKey] && notas[notaKey].trim());
    const btnNota   = document.getElementById('rpBtnNota');
    const editor    = document.getElementById('rpNotaEditor');
    if (btnNota) {
      // Resetear: cerrar editor (si quedó abierto de otra pregunta) y actualizar texto/clase
      if (editor) editor.style.display = 'none';
      btnNota.classList.toggle('has-nota', tieneNota);
      btnNota.textContent = tieneNota ? '📝 Ver mi nota' : '📝 Agregar nota';
    }
  }

  // Renderizar grilla optimizada: conserva nodos si la ventana visible no cambió.
  const grid = document.getElementById('rpNavGrid');
  renderNavGridInto(grid, 'right');
}

// Las notas del panel derecho fueron extraídas a src/ui/notes.js.

function abrirReporteActual() {
  const p = examen[actual];
  if (!p) return;
  if (typeof abrirModalReporte === 'function') abrirModalReporte(p.id);
}

// ── RACHA PILL ──
// Extraída a ui/racha.js siguiendo el patrón configure().
const {
  resiarCalcularRachaCorrectas,
  actualizarRachaPill,
  renderRacha
} = configureRacha({
  getExamen: () => examen,
  getRespuestas: () => respuestas,
  getActual: () => actual,
  getLastAnsweredIndex: () => _resiarLastAnsweredIndex,
  evaluateQuestionAnswer: (i) => resiarEvaluateQuestionAnswer(i),
  getCorrectas: () => correctas
});

async function responder(sel) {
  if (respuestas[actual]) return;
  const p = examen[actual];
  if (!p || p._resiarSubmittingAnswer) return;

  try {
    p._resiarSubmittingAnswer = true;

    let answerResult = null;

    if (p._resiarSecureSessionId && p._resiarAnswerHidden === true) {
      const result = await submitSecureExamAnswer({
        supabase: sb,
        sessionId: p._resiarSecureSessionId,
        questionId: p.id,
        selectedAnswer: sel,
        answerRawToDisplayMap: p._resiarAnswerRawToDisplayMap || null,
        answerDisplayToRawMap: p._resiarAnswerDisplayToRawMap || null
      });

      p.respuesta = result.correctAnswer || null;
      p.anulada = result.isAnnulled === true;
      p._resiarAnswerHidden = false;
      p._resiarAnswerVerified = true;
      p._resiarAnswerServer = result;
      answerResult = resiarNormalizeAnswerResult(result);
    }

    if (!answerResult) {
      const anulada = esRespuestaAnulada(p);
      answerResult = {
        selectedAnswer: String(sel || '').trim().toLowerCase(),
        correctAnswer: p?.respuesta == null ? null : String(p.respuesta).trim().toLowerCase(),
        isAnnulled: anulada,
        isCorrect: anulada ? true : String(sel || '').trim().toLowerCase() === String(p?.respuesta || '').trim().toLowerCase()
      };
    }

    if (answerResult?.isAnnulled === true || answerResult?.isCorrect === true) sonOk();
    else sonNo();

    respuestas[actual] = sel;
    _resiarLastAnsweredIndex = actual;
    try { if (typeof window.resiarMarkCompletionAnsweredIds === 'function') window.resiarMarkCompletionAnsweredIds([p.id], { render:false }); } catch (_) {}
    resiarAnswerResults[actual] = answerResult;
    resiarApplyLiveStatsFromAnswers();
    resiarSaveCurrentExamDraft('answer', { force: true });
    updateStats(); renderRacha(); actualizarRachaPill(); render();

    // v101: no finalizar automáticamente al responder la última pregunta.
    // Antes el modal final se abría inmediatamente y tapaba la corrección de la última respuesta.
    // Ahora el usuario puede ver si fue correcta/incorrecta y finalizar manualmente.
    if (respondidasCount >= examen.length && !_resiarCompletionNoticeShown) {
      _resiarCompletionNoticeShown = true;
      try {
        mostrarToast('Examen completo. Revisá la última respuesta y tocá “Finalizar examen” cuando quieras.');
      } catch (_) {}
    }
  } catch (error) {
    mostrarToast('No se pudo corregir la respuesta: ' + (error?.message || error));
    console.warn('[ResiAR v69B] Error corrigiendo respuesta segura:', error);
  } finally {
    try { p._resiarSubmittingAnswer = false; } catch (_) {}
  }
}

// ── EXPLICACIÓN IA ──
// Modularizado en src/ui/explanation.js
const explanation = configureExplanation({
  getSupabase: () => window.sb,
  getSupabaseUrl: () => window.SUPA_URL || (typeof SUPA_URL !== 'undefined' ? SUPA_URL : ''),
  getCurrentQuestion: () => examen[actual],
  getCurrentAnswer: () => respuestas[actual],
  isTrialLimited: () => estaEnTrialLimitado(),
  isRespuestaAnulada: (p) => esRespuestaAnulada(p),
  isBancoMIR: (examenValue) => esBancoMIR(examenValue),
  espLabel,
  escapeHtml,
  markdownToHtml,
  mostrarToast,
  getPreguntaBox: () => preguntaBox
});

async function pedirExplicacion() {
  return explanation.pedirExplicacion();
}

async function votarExplicacion(nuevoVoto, preguntaId, promptVersion) {
  return explanation.votarExplicacion(nuevoVoto, preguntaId, promptVersion);
}

function renderHistorial() {
  // Mostrar las últimas 10 preguntas visitadas (hasta la actual inclusive)
  const hasta = actual + 1; // posiciones 0..actual
  const desde = Math.max(0, hasta - 10);
  let html = '';
  for (let i = desde; i < hasta; i++) {
    const r = respuestas[i];
    const p = examen[i];
    let c;
    const evaluation = resiarEvaluateQuestionAnswer(i);
    if (evaluation.answered) c = evaluation.status === 'pendiente' ? 'mt' : evaluation.status;
    else if (i === actual) c = 'mt-actual'; // en curso, sin responder aún
    else c = 'mt';                          // salteada
    html += `<div class="hdot ${c}" style="animation-delay:${(i - desde) * 0.03}s"></div>`;
  }
  historial.innerHTML = html;
}

// ── STATS LIVE ──
function updateStats() {
  resiarApplyLiveStatsFromAnswers();
  const t = correctas + incorrectas;
  porcentajeSpan.innerText = t ? Math.round(correctas / t * 100) + "%" : "0%";
  correctasSpan.innerText = correctas;
  incorrectasSpan.innerText = incorrectas;
}

// ── CONFIRMAR FINALIZAR ──
function confirmarFinalizar() {
  const sin = examen.length - respondidasCount;
  if (sin > 0 && !confirm(`Tenés ${sin} pregunta${sin > 1 ? 's' : ''} sin responder.\n¿Querés finalizar igual?`)) return;
  finalizar();
}

// ── FINALIZAR ──
function finalizar() {
  try {
    window._resiarExamRunning = false;
    window._resiarExamFinished = true;
    if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam-ended');
   
    if (typeof questionChatClose === 'function') questionChatClose();
    if (typeof window.resiarSyncQuestionChat === 'function') window.resiarSyncQuestionChat('exam-ended');
  } catch(_) {}
  clearInterval(timer);
  pausarTimerPregunta();
  resiarClearCurrentExamDraft();
  sonFin();

  // Guardar errores recientes para repaso.
  // Es persistente por usuario y se actualiza por pregunta: si la responde bien, sale del banco; si la falla, entra/queda arriba.
  resiarSaveRecentErrorsFromCurrentSession();
  sbUpdateOpcionesSummary();
  const tUsado = tiempoTotal - tiempo;
  const stats = {};
  const finalSummary = resiarApplyLiveStatsFromAnswers();
  examen.forEach((p, i) => {
    const esp = espLabel(p);
    if (!stats[esp]) stats[esp] = { c: 0, total: 0, resp: 0, anuladas: 0, pendientes: 0 };
    stats[esp].total++;
    const evaluation = resiarEvaluateQuestionAnswer(i);
    if (!evaluation.answered) return;
    if (evaluation.isAnnulled) { stats[esp].anuladas++; return; }
    if (!evaluation.evaluable) { stats[esp].pendientes++; return; }
    stats[esp].resp++;
    if (evaluation.isCorrect) stats[esp].c++;
  });
  const respondidas = finalSummary.answered;
  const evaluadas = finalSummary.evaluated;
  const sinR = examen.length - respondidas;
  const pct = evaluadas ? Math.round(correctas / evaluadas * 100) : 0;

  const nota  = p => p >= 90 ? 'A' : p >= 70 ? 'B' : p >= 50 ? 'C' : 'D';
  const col   = p => p >= 70 ? 'var(--green)' : p >= 50 ? 'var(--amber)' : 'var(--red)';
  const titulo = pct >= 90 ? '¡Excelente! 🏆' : pct >= 70 ? '¡Muy bien! ⭐' : pct >= 50 ? 'Aprobado 👍' : 'Seguí practicando 💪';

  // Colorear banda superior según rendimiento
  const band = document.getElementById('mresultBand');
  if (band) {
    const bandColor = pct >= 70 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#fb7185';
    band.style.color = bandColor;
    band.style.borderBottom = `1px solid ${bandColor}22`;
    band.style.background = `linear-gradient(135deg, ${bandColor}0d 0%, transparent 60%)`;
  }

  document.getElementById("modalTitulo").innerText = titulo;
  document.getElementById("modalSubtitulo").innerText =
    `${correctas} correctas · ${incorrectas} incorrectas · ${respondidas} respondidas${finalSummary.annulled ? ' · ' + finalSummary.annulled + ' anuladas/no evaluables' : ''}${sinR ? ' · ' + sinR + ' sin responder' : ''}`;

  const arc = document.getElementById("circleArc");
  const circ = 238.8;
  arc.style.stroke = col(pct);
  setTimeout(() => { arc.style.strokeDashoffset = circ - (circ * pct / 100); }, 80);
  const cpct = document.getElementById("circlePct");
  cpct.innerText = pct + "%"; cpct.style.color = col(pct);

  function fmt(s) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  const promSeg = respondidas ? Math.round(tUsado / respondidas) : 0;
  const maxSeg = tiemposPregunta.length ? Math.max(...tiemposPregunta.filter(Boolean)) : 0;
  const maxIdx = tiemposPregunta.indexOf(maxSeg);

  document.getElementById("statsCards").innerHTML = `
    <div class="mc"><div class="mc-n" style="color:var(--green)">${correctas}</div><div class="mc-l">Correctas</div></div>
    <div class="mc"><div class="mc-n" style="color:var(--red)">${incorrectas}</div><div class="mc-l">Incorrectas</div></div>
    <div class="mc"><div class="mc-n" style="color:var(--accent)">${examen.length}</div><div class="mc-l">Total</div></div>
    <div class="mc"><div class="mc-n" style="color:var(--amber);font-size:1.25rem;font-family:'Space Grotesk','DM Mono',monospace;">${fmt(promSeg)}</div><div class="mc-l">Prom/preg</div></div>`;

  // Agregar info de tiempos por pregunta si hay datos
  if (maxSeg > 0) {
    document.getElementById("espStats").insertAdjacentHTML('beforebegin', `
      <div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.18);border-radius:10px;padding:11px 14px;margin-bottom:14px;font-family:'Space Grotesk','DM Mono',monospace;font-size:0.68rem;color:var(--text3);">
        ⏱ Pregunta más lenta: <strong style="color:var(--amber)">N° ${maxIdx+1}</strong> — ${fmt(maxSeg)}
        ${maxIdx >= 0 ? `<span style="cursor:pointer;color:var(--accent);margin-left:8px;" data-action="final-go-question" data-index="${maxIdx}">ver →</span>` : ''}
      </div>`)
  }

  const pctT = Math.min(100, Math.round(tUsado / tiempoTotal * 100));
  document.getElementById("tiempoUsado").innerText = `${fmt(tUsado)} de ${fmt(tiempoTotal)}`;
  setTimeout(() => { document.getElementById("tiempoBar").style.width = pctT + '%'; }, 100);

  document.getElementById("espStats").innerHTML = Object.entries(stats)
    .filter(([, d]) => d.resp > 0)
    .sort((a, b) => (b[1].c / b[1].resp) - (a[1].c / a[1].resp))
    .map(([esp, d], i) => {
      const p2 = Math.round(d.c / d.resp * 100);
      const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const c = col(p2); const n = nota(p2);
      return `<div class="erow">
        <div>
          <div class="ename">${m} ${formatEsp(esp)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:5px;">
            <div class="ebar"><div class="efill" data-w="${p2}" style="width:0%;background:${c};"></div></div>
            <span style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.58rem;color:var(--text3);">${d.resp}/${d.total}</span>
          </div>
        </div>
        <div class="eright">
          <span class="nbadge n${n}">${n}</span>
          <span class="epct" style="color:${c}">${p2}%</span>
        </div>
      </div>`;
    }).join('');

  setTimeout(() => { document.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; }); }, 150);

  const wb = document.getElementById("warnBox");
  if (sinR > 0 || finalSummary.annulled > 0 || finalSummary.pending > 0) {
    const parts = [];
    if (sinR > 0) parts.push(`${sinR} pregunta${sinR > 1 ? 's' : ''} no respondidas`);
    if (finalSummary.annulled > 0) parts.push(`${finalSummary.annulled} anulada${finalSummary.annulled > 1 ? 's' : ''}/no evaluable${finalSummary.annulled > 1 ? 's' : ''}`);
    if (finalSummary.pending > 0) parts.push(`${finalSummary.pending} pendiente${finalSummary.pending > 1 ? 's' : ''} de corrección`);
    document.getElementById("warnTxt").innerText = `⚠ ${parts.join(' · ')} — no se cuentan en el porcentaje.`;
    wb.classList.add("vis");
  } else {
    wb.classList.remove("vis");
  }

  resiarSaveFinalSessionOnce();
  modalFinal.classList.add("vis");
}

function cerrarModal() {
  modalFinal.classList.remove("vis");
  // NO cancelamos realtime aquí — la suscripción sigue activa para recibir notificaciones
  // aunque el modal esté cerrado. Se cancela solo al iniciar un nuevo examen sin desafío.
  const rankingBox = document.getElementById('desafioRankingFinal');
  if (rankingBox) rankingBox.style.display = 'none';
}
modalFinal.addEventListener("click", e => { if (e.target === modalFinal) cerrarModal(); });

// ── NAVEGADOR / NAV
// Modularizado en src/ui/examControls.js.

// ── TIMER ──
// resiarFormatElapsedTimer / iniciarTimer: extraídas a ui/examTimer.js
// siguiendo el patrón configure(). main.js sigue siendo dueño del estado
// (tiempo, tiempoTotal, timer) y lo inyecta acá vía closure.
const { resiarFormatElapsedTimer, iniciarTimer } = configureExamTimer({
  getTiempo: () => tiempo,
  setTiempo: (v) => { tiempo = v; },
  getTiempoTotal: () => tiempoTotal,
  setTiempoTotal: (v) => { tiempoTotal = v; },
  getTimer: () => timer,
  setTimer: (v) => { timer = v; },
  saveDraft: (reason) => resiarSaveCurrentExamDraft(reason),
  playTimerSound: () => sonTimer(),
  onTimeUp: () => finalizar()
});

// ── INIT ──
(function() {
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
})();
cargarFiltros();
filtroExamen.addEventListener("change", cargarChecklist);
cargarChecklist();

/* ════════════════════════════════════════════════
   ESTADÍSTICAS HISTÓRICAS
════════════════════════════════════════════════ */
configureStats({
  readJson,
  writeJson,
  espLabel,
  formatEsp,
  getExam: () => examen,
  getRespuestas: () => respuestas,
  getCorrectas: () => correctas,
  getTiempo: () => tiempo,
  getTiempoTotal: () => tiempoTotal,
  getQuestionTimes: () => tiemposPregunta,
  isRespuestaAnulada: (pregunta) => esRespuestaAnulada(pregunta),
  getExamMode: () => examSessionMode || 'exam',
  getCurrentUser: () => currentUser,
  getSb: () => window.sb,
  getSubmitResultUrl: () => EDGE_SUBMIT_RESULT_URL,
  getModalFinal: () => modalFinal,
  isChallengeActive: () => !!window._desafioActivo,
  guardarResultadoDesafio: () => guardarResultadoDesafio()
});

async function cargarPerformanceRowsRemotas(user) {
  if (!user || !sb || typeof sb.from !== 'function') return { rows: [], source: 'none' };

  let answerRows = [];
  try {
    const { data, error } = await sb.from('exam_answers')
      .select('question_id, especialidad, tema, subtema, is_correct, is_answered, is_annulled, time_ms, created_at')
      .eq('user_id', user.id)
      .eq('is_answered', true)
      .order('created_at', { ascending: false })
      .limit(3000);
    if (error) throw error;
    answerRows = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[ResiAR] No se pudieron cargar exam_answers para performance:', error);
  }

  let legacyRows = [];
  try {
    let query = sb.from('resultados')
      .select('especialidad, correctas, total, pct, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    // Si ya hay respuestas normalizadas, mantener resultados viejos solo como
    // historial anterior al primer registro normalizado. Evita doble conteo
    // porque submit-result mantiene resultados como compatibilidad temporal.
    if (answerRows.length) {
      const oldestNormalized = answerRows.reduce((min, row) => {
        const date = String(row?.created_at || '');
        return !min || (date && date < min) ? date : min;
      }, '');
      if (oldestNormalized) query = query.lt('created_at', oldestNormalized);
    }

    const { data, error } = await query;
    if (error) throw error;
    legacyRows = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[ResiAR] No se pudieron cargar resultados legacy para performance:', error);
  }

  return {
    rows: [...answerRows, ...legacyRows],
    source: answerRows.length ? (legacyRows.length ? 'exam_answers+legacy' : 'exam_answers') : (legacyRows.length ? 'legacy' : 'none')
  };
}

async function cargarMistakePerformanceRowsRemotas(user) {
  if (!user || !sb || typeof sb.from !== 'function') return { rows: [], source: 'none' };

  try {
    const { data, error } = await sb.from('user_question_performance')
      .select('question_id, especialidad, tema, subtema, total_attempts, wrong_attempts, correct_attempts, last_answer_at, last_is_correct, last_selected_answer, correct_answer, avg_time_ms, error_state')
      .eq('user_id', user.id)
      .order('last_answer_at', { ascending: false })
      .limit(1000);

    if (error) throw error;
    return {
      rows: Array.isArray(data) ? data : [],
      source: 'user_question_performance'
    };
  } catch (error) {
    console.warn('[ResiAR] No se pudo cargar user_question_performance; usando exam_answers:', error);
  }

  try {
    const { data, error } = await sb.from('exam_answers')
      .select('question_id, especialidad, tema, subtema, selected_answer, correct_answer, is_correct, is_answered, is_annulled, time_ms, created_at')
      .eq('user_id', user.id)
      .eq('is_answered', true)
      .order('created_at', { ascending: false })
      .limit(3000);

    if (error) throw error;
    return {
      rows: Array.isArray(data) ? data : [],
      source: 'exam_answers_fallback'
    };
  } catch (error) {
    console.warn('[ResiAR] No se pudieron cargar exam_answers para examen por errores:', error);
    return {
      rows: [],
      source: 'none',
      error
    };
  }
}

try {
  Object.assign(window, {
    getStats,
    saveStats,
    actualizarBadge,
    guardarSesion,
    resiarResetFinalSaveGuard,
    resiarSaveFinalSessionOnce,
    buildAnswerPayload,
    guardarSesionEnSupabase,
    abrirModalStats,
    cerrarModalStats,
    renderModalStats,
    getStatsStorageInfo
  });
} catch (_) {}

actualizarBadge();

// ── EXAMEN INTELIGENTE ──
async function iniciarExamenInteligente() {
  if (!currentUser) { abrirLoginReq(); return; }

  // La seguridad sigue siendo server-side: esto solo decide el modo de estudio.
  // El pool base ya viene filtrado por Supabase/RLS según el usuario.
  const { acceso } = await verificarAccesoServidor();
  if (acceso === 'bloqueado' || acceso === 'expirado') {
    mostrarToast(acceso === 'expirado'
      ? '⚠️ Tu plan Pro venció.'
      : '🔒 Sin acceso activo.');
    return;
  }
  if (acceso === 'trial_limitado') {
    mostrarToast('🔒 El examen por debilidades está disponible en el plan Pro');
    return;
  }

  const localStats = getStats();
  let remoteRows = [];
  let remoteError = null;

  try {
    const remotePerformance = await cargarPerformanceRowsRemotas(currentUser);
    remoteRows = Array.isArray(remotePerformance.rows) ? remotePerformance.rows : [];
  } catch (error) {
    remoteError = error;
    console.warn('[ResiAR] No se pudieron cargar estadísticas remotas para debilidades:', error);
  }

  const performance = buildUserPerformanceModel({
    user: currentUser,
    questions: preguntas,
    localStats,
    remoteRows,
    splitEspecialidades,
    espLabel,
    topicLabel: temaRaw,
    normalizeSpecialty: normEspecialidadKey,
    minAnswers: 3,
    threshold: 70,
    maxFallback: 3
  });

  const plan = buildWeaknessExamPlan({
    questions: preguntas,
    performance,
    splitEspecialidades,
    espLabel,
    topicLabel: temaRaw,
    normalizeSpecialty: normEspecialidadKey,
    minAnswers: 3,
    threshold: 70,
    maxFallback: 3,
    limit: 50
  });

  try { window.__resiarLastWeaknessPlan = plan; } catch (_) {}

  if (!plan.hasStats) {
    mostrarToast(remoteError
      ? '🎯 No hay estadísticas suficientes todavía. Además falló la lectura remota: ' + (remoteError.message || 'error Supabase')
      : '🎯 Necesitás responder al menos 3 preguntas por especialidad para generar un examen por debilidades.');
    return;
  }

  if (!plan.pool.length) {
    mostrarToast('🎯 No se encontraron preguntas disponibles para tus especialidades débiles actuales.');
    return;
  }

  cerrarModal();
  resiarResetFinalSaveGuard();
  resiarActivarModoExamen();

  const weakList = plan.activeScope === 'topic' && plan.topics.length ? plan.topics : plan.specialties;
  const nombresDebiles = weakList.map(x => x.topic ? x.label : formatEsp(x.e)).join(', ');
  const sourceLabels = {
    'remote+pending': 'historial sincronizado + pendientes locales',
    remote: 'historial sincronizado',
    pending: 'pendientes locales',
    'local-fallback': 'historial local de respaldo',
    local: 'historial local'
  };
  const sourceLabel = sourceLabels[plan.source] || 'historial disponible';
  const scopeLabel = plan.activeScope === 'topic' ? 'tema' : 'especialidad';
  try {
    await resiarStartSecureExamFromCatalog(plan.pool, {
      mode: 'weakness',
      limit: 50,
      filters: { weaknessSource: plan.source, weaknessScope: plan.activeScope },
      toastMessage: `🎯 Examen seguro de debilidades · hasta 50 preguntas · ${weakList.length} ${scopeLabel}${weakList.length>1?'s':''}: ${nombresDebiles} · ${sourceLabel}`
    });
  } catch (error) {
    mostrarToast('No se pudo iniciar el examen seguro por debilidades: ' + (error?.message || error));
    console.warn('[ResiAR v69B] Error iniciando debilidades seguro:', error);
  }
}
// Toast UI extraído a src/ui/toast.js.


// ── API KEY MANAGEMENT ──
// como secrets en las Edge Functions de Supabase. No se exponen en el frontend.



// ── ATAJOS DE TECLADO ──
// Modularizado en src/ui/examControls.js.

/* ══════════════════════════════════════════════════════════════
   SUPABASE INTEGRATION
   Inicialización externalizada en /public/supabase-global.js.
   Este HTML todavía usa `sb` y `SUPA_URL` como globales para no romper
   las llamadas existentes durante la migración gradual.
══════════════════════════════════════════════════════════════ */
if (!window.RESIAR_SUPABASE_READY) {
  console.warn('[ResiAR] Supabase no quedó inicializado. Revisá VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY y la carga del SDK.');
}

function resiarInstallRpcPerformanceCacheWhenReady(attempt = 0) {
  try {
    const client = window.sb || (typeof sb !== 'undefined' ? sb : null);
    if (client && typeof client.rpc === 'function') {
      installRpcPerformanceCache(client);
      return;
    }

    if (attempt < 20) {
      setTimeout(() => resiarInstallRpcPerformanceCacheWhenReady(attempt + 1), 100);
    }
  } catch (error) {
    console.warn('[ResiAR v68E] No se pudo instalar RPC performance cache:', error);
  }
}
resiarInstallRpcPerformanceCacheWhenReady();

// ── CONTADORES PÚBLICOS + REALTIME DE LANDING ──
const {
  aplicarContadorPreguntas: _aplicarContadorPreguntas,
  aplicarContadorEspecialidades: _aplicarContadorEspecialidades,
  refrescarContadoresLanding,
  initRealtime: initPublicRealtime
} = configurePublicCounters({
  getSupabase: () => window.sb,
  getSafeSupabaseCall: () => window.safeSupabaseCall,
  invalidatePricing: () => invalidatePricing(),
  cargarPrecios: () => cargarPrecios(),
  logger: console
});

refrescarContadoresLanding();

configureLeaderboard({
  getSupabase: () => sb,
  getCurrentUser: () => currentUser,
  abrirAuth: () => abrirAuth(),
  escapeHtml
});

configureBilling({
  getSupabase: () => window.sb,
  getSupabaseUrl: () => SUPA_URL,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  setCurrentProfile: (profile) => { currentProfile = profile; },
  abrirAuth: () => abrirAuth(),
  renderUserUI: () => renderUserUI(),
  sbUpdateOpcionesSummary: () => sbUpdateOpcionesSummary(),
  mostrarToast
});

// ── VERIFICACIÓN SERVER-SIDE DE PLAN ──
// El plan real siempre viene de la Edge Function, nunca del cliente.
let _serverAcceso = null; // 'admin' | 'pro' | 'trial' | 'trial_activo' | 'trial_limitado' | 'expirado' | 'bloqueado'
let _serverEsPro  = false;

// ── SOUND / ACCESS CONTROL ──
// Implementación extraída a src/services/access.js.

const EDGE_VERIFY_URL = SUPA_URL + '/functions/v1/verificar-acceso';
const EDGE_SUBMIT_RESULT_URL = SUPA_URL + '/functions/v1/submit-result';
const EDGE_SUBMIT_CHALLENGE_RESULT_URL = SUPA_URL + '/functions/v1/submit-challenge-result';
const EDGE_REFRESH_QUESTION_BANK_URL = SUPA_URL + '/functions/v1/refresh-question-bank-version';

// RESIAR v71E — Arena Edge endpoints.
// Estos endpoints existen en Supabase, pero main.js no los estaba pasando a challenges.js.
// Sin estos getters, Arena muestra: "Endpoint Arena no configurado: find".
const EDGE_ARENA_CREATE_MATCH_URL = SUPA_URL + '/functions/v1/arena-create-match';
const EDGE_ARENA_ACCEPT_INVITE_URL = SUPA_URL + '/functions/v1/arena-accept-invite';
const EDGE_ARENA_GET_MATCH_URL = SUPA_URL + '/functions/v1/arena-get-match';
const EDGE_ARENA_SUBMIT_ANSWER_URL = SUPA_URL + '/functions/v1/arena-submit-answer';
const EDGE_ARENA_COMPLETE_MATCH_URL = SUPA_URL + '/functions/v1/arena-complete-match';
const EDGE_ARENA_SUMMARY_URL = SUPA_URL + '/functions/v1/arena-list-summary';
const EDGE_ARENA_FIND_MATCH_URL = SUPA_URL + '/functions/v1/arena-find-match';
const EDGE_ARENA_LIVE_TOKEN_URL = SUPA_URL + '/functions/v1/arena-live-token';
const ARENA_LIVE_WS_URL = String(
  window.RESIAR_ARENA_LIVE_WS_URL ||
  import.meta.env.VITE_ARENA_LIVE_WS_URL ||
  ''
).trim();

const loadingScreens = configureLoadingScreens({
  getPreguntaBox: () => preguntaBox,
  markViewState: (view) => {
    if (typeof resiarMarkViewState === 'function') resiarMarkViewState(view);
  }
});

const mostrarPantallaBloqueo = loadingScreens.mostrarPantallaBloqueo;
const mostrarPantallaCargando = loadingScreens.mostrarPantallaCargando;
const _setLoadingProgress = loadingScreens.setLoadingProgress;

function resiarIsLegacyConfigPlaceholder() {
  try {
    const box = document.getElementById('preguntaBox');
    if (!box) return false;
    if (box.querySelector('#welcome.home-sim, .home-hero-card, #homeMixedExamRoot')) return false;
    const legacy = box.querySelector('.welcome-simple');
    if (!legacy) return false;
    const title = legacy.querySelector('.wtitle')?.textContent || '';
    return /Listo para empezar|Configurá los filtros|Configura los filtros/i.test(title + ' ' + legacy.textContent);
  } catch (_) {
    return false;
  }
}

function resiarEnsureModernConfigHome(reason) {
  const delays = [0, 80, 180, 360, 700, 1200, 2000];
  delays.forEach(delay => {
    setTimeout(() => {
      try {
        if (!currentUser) return;
        if (window._resiarExamRunning === true || document.body?.dataset?.resiarView === 'exam') return;
        const box = document.getElementById('preguntaBox');
        if (!box) return;
        if (box.querySelector('#welcome.home-sim, .home-hero-card, #homeMixedExamRoot')) return;
        if (!resiarIsLegacyConfigPlaceholder()) return;
        if (typeof window.resiarRenderHome === 'function') {
          window.resiarRenderHome(false);
          return;
        }
        window.__resiarPendingModernHomeRender = true;
      } catch (error) {
        console.warn('[ResiAR] No se pudo asegurar home moderno:', reason || '', error);
      }
    }, delay);
  });
}
try { window.resiarEnsureModernConfigHome = resiarEnsureModernConfigHome; } catch(_) {}

function mostrarPantallaBienvenida() {
  if (!currentUser) return; // no sobreescribir si ya se cerró sesión

  // La pantalla de configuración válida es el home moderno. Si el renderer
  // todavía no está instalado, se deja una solicitud pendiente y se reintenta;
  // el placeholder legacy ya no se considera una salida estable.
  if (typeof window.resiarRenderHome === 'function') {
    try {
      window.resiarRenderHome(false);
      return;
    } catch (error) {
      console.warn('[ResiAR] resiarRenderHome falló desde mostrarPantallaBienvenida:', error);
    }
  }

  clearInterval(_loadingPhraseTimer);
  window.__resiarPendingModernHomeRender = true;
  preguntaBox.innerHTML = `
    <div class="welcome-simple" data-resiar-legacy-config-placeholder="1">
      <div class="wicon">🧠</div>
      <div class="wtitle">Preparando configuración</div>
      <div class="wsub">Cargando el panel principal…</div>
    </div>`;
  resiarEnsureModernConfigHome('mostrarPantallaBienvenida');
}

// ── CARGAR PREGUNTAS DESDE SUPABASE ──
// Estrategia: calcular cantidad visible por RLS y traer páginas con concurrencia limitada.
// Evita picos de red/CPU al iniciar sesión y mantiene la UI más estable en bancos grandes.
let _resiarQuestionsLoadPromise = null;
const RESIAR_QB_CONFIG_TABLE = 'resiar_app_config';
const RESIAR_QB_CONFIG_KEY = 'question_bank_version';
const RESIAR_QB_VERSION_FALLBACK = 'bootstrap-v1';
const RESIAR_QB_VERSION_CHECK_MS = 60 * 1000;
let _resiarQuestionBankVersion = RESIAR_QB_VERSION_FALLBACK;
let _resiarQuestionBankVersionLoadedAt = 0;
let _resiarQuestionBankVersionPromise = null;
let _resiarQuestionBankVersionMonitorInstalled = false;
let _resiarQuestionBankPendingGlobalRefresh = false;

function resiarNormalizeQuestionBankVersion(row) {
  const value = row && typeof row === 'object' ? row.value : row;
  if (value && typeof value === 'object') {
    return String(value.version || value.updated_at || value.value || '').trim() || RESIAR_QB_VERSION_FALLBACK;
  }
  return String(value || '').trim() || RESIAR_QB_VERSION_FALLBACK;
}

async function resiarFetchQuestionBankVersionFromSupabase() {
  if (!sb) return RESIAR_QB_VERSION_FALLBACK;
  const { data, error } = await sb
    .from(RESIAR_QB_CONFIG_TABLE)
    .select('value,updated_at')
    .eq('key', RESIAR_QB_CONFIG_KEY)
    .maybeSingle();
  if (error) throw error;
  return resiarNormalizeQuestionBankVersion(data);
}

async function resiarEnsureQuestionBankVersion({ force = false, maxAgeMs = RESIAR_QB_VERSION_CHECK_MS } = {}) {
  const age = Date.now() - Number(_resiarQuestionBankVersionLoadedAt || 0);
  if (!force && _resiarQuestionBankVersionLoadedAt && age <= maxAgeMs) return _resiarQuestionBankVersion;
  if (_resiarQuestionBankVersionPromise) return _resiarQuestionBankVersionPromise;

  _resiarQuestionBankVersionPromise = (async () => {
    try {
      const remoteVersion = await resiarFetchQuestionBankVersionFromSupabase();
      if (remoteVersion) _resiarQuestionBankVersion = remoteVersion;
    } catch (error) {
      console.warn('[ResiAR] No se pudo leer versión global del banco:', error?.message || error);
    } finally {
      _resiarQuestionBankVersionLoadedAt = Date.now();
      _resiarQuestionBankVersionPromise = null;
    }
    return _resiarQuestionBankVersion;
  })();

  return _resiarQuestionBankVersionPromise;
}

async function resiarBumpQuestionBankVersion() {
  if (!sb?.auth) throw new Error('Supabase Auth no inicializado');
  if (!EDGE_REFRESH_QUESTION_BANK_URL) throw new Error('Edge Function no configurada');

  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('Sesión no disponible');

  const res = await fetch(EDGE_REFRESH_QUESTION_BANK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token,
    },
    body: JSON.stringify({ reason: 'manual_admin_refresh' }),
  });

  let json = null;
  try { json = await res.json(); } catch (_) {}

  if (!res.ok || json?.error) {
    const message = json?.error || json?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }

  const nextVersion = resiarNormalizeQuestionBankVersion(json?.version || json?.data?.version || json?.data || json);
  _resiarQuestionBankVersion = nextVersion;
  _resiarQuestionBankVersionLoadedAt = Date.now();
  try { window.__resiarQuestionBankVersion = _resiarQuestionBankVersion; } catch (_) {}
  try { resiarRefreshQuestionImagesCache(nextVersion); } catch (_) {}
  return _resiarQuestionBankVersion;
}

function resiarQuestionBankCacheKey() {
  return buildQuestionBankCacheKey({
    userId: currentUser?.id,
    profile: currentProfile,
    serverAccess: _serverAcceso,
    questionBankVersion: _resiarQuestionBankVersion,
  });
}

function resiarUserIsAdmin() {
  try { if (_serverAcceso === 'admin') return true; } catch (_) {}
  try { if (String(currentProfile?.plan || '').trim() === 'admin') return true; } catch (_) {}
  return false;
}
try { window.resiarUserIsAdmin = resiarUserIsAdmin; } catch (_) {}
function resiarFinalizeQuestionBankLoad(todas, meta = {}) {
  preguntas = Array.isArray(todas) ? todas : [];

  if (preguntas.length) {
    _aplicarContadorPreguntas(preguntas.length);
    const nEsp = new Set(preguntas.map(p => espLabel(p)).filter(Boolean)).size;
    if (nEsp > 0) _aplicarContadorEspecialidades(nEsp);
  }

  buildNumeroMap(preguntas);
  resiarRefreshRecentErrors();
  cargarFiltros();
  cargarChecklist();
  setAllTopics([...new Set(preguntas.map(p => temaRaw(p)))]
    .filter(t => t && t !== 'General')
    .sort((a, b) => a.localeCompare(b, 'es')));

  try {
    window.__resiarQuestionBankLoad = {
      source: meta.source || 'unknown',
      count: preguntas.length,
      cacheKey: meta.cacheKey || resiarQuestionBankCacheKey(),
      questionBankVersion: _resiarQuestionBankVersion,
      cacheAgeMs: meta.cacheAgeMs ?? null,
      stale: !!meta.stale,
      loadedAt: new Date().toISOString(),
    };
    window.__resiarQuestionBankVersion = _resiarQuestionBankVersion;
  } catch (_) {}
  try { resiarInstallQuestionBankVersionMonitor(); } catch (_) {}
}
async function resiarEnterAfterQuestionBankLoad() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('desafio');
  let restoredDraft = false;

  if (!code) {
    try {
      restoredDraft = await resiarTryRestoreExamDraft();
    } catch (error) {
      console.warn('[ResiAR] Falló el intento de retomar borrador:', error);
      restoredDraft = false;
    }
  }

  if (!restoredDraft) {
    try {
      if (typeof window.resiarRenderHome === 'function') window.resiarRenderHome(false);
      else mostrarPantallaBienvenida();
    } catch (_) {
      try { mostrarPantallaBienvenida(); } catch (__) {}
    }
    try { resiarEnsureModernConfigHome('cargarPreguntas:complete'); } catch (_) {}
  }

  if (code) {
    setTimeout(() => {
      abrirDesafio();
      switchChallengeTab('unirse');
      const input = document.getElementById('codigoInput');
      if (input) input.value = code.toUpperCase();
    }, 800);
  }
}
async function cargarPreguntas(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const forceRefresh = opts.forceRefresh === true;
  const skipVersionCheck = opts.skipVersionCheck === true;
  if (_resiarQuestionsLoadPromise) return _resiarQuestionsLoadPromise;
  _resiarQuestionsLoadPromise = (async () => {
    mostrarPantallaCargando();
    try {
      const SELECT_COLUMNS = 'id,examen,anio,tipo,especialidad,tema,especialidad_v2,tema_v2,num_original,corregida,anulada,imagen_path,imagenes_paths,imagen_alt,imagen_caption';
      if (!skipVersionCheck) {
        await resiarEnsureQuestionBankVersion({
          force: forceRefresh,
          maxAgeMs: forceRefresh ? 0 : RESIAR_QB_VERSION_CHECK_MS,
        });
      }
      const cacheKey = resiarQuestionBankCacheKey();
      const result = await loadQuestionBank({
        supabase: sb,
        cacheKey,
        selectColumns: SELECT_COLUMNS,
        pageSize: 1000,
        concurrency: 3,
        ttlMs: 4 * 60 * 60 * 1000,
        bypassCache: forceRefresh,
        allowStaleFallback: !forceRefresh,
        onProgress: _setLoadingProgress,
      });

      _setLoadingProgress(96);
      resiarFinalizeQuestionBankLoad(result.questions, {
        ...(result.meta || {}),
        source: result.source,
        cacheKey,
      });

      _setLoadingProgress(100);
      setTimeout(() => {
        Promise.resolve(resiarEnterAfterQuestionBankLoad()).catch((error) => {
          console.warn('[ResiAR] Falló entrada post-carga:', error);
          try {
            if (typeof window.resiarRenderHome === 'function') window.resiarRenderHome(false);
            else mostrarPantallaBienvenida();
          } catch (_) {}
        });
      }, result.source === 'cache' ? 120 : 300);

      return preguntas;
    } catch(e) {
      clearInterval(_loadingPhraseTimer);
      preguntaBox.innerHTML = `
        <div class="welcome-simple">
          <div class="wicon">❌</div>
          <div class="wtitle">Error al cargar</div>
          <div class="wsub">${escapeHtml(e.message)}</div>
        </div>`;
      throw e;
    } finally {
      _resiarQuestionsLoadPromise = null;
    }
  })();
  return _resiarQuestionsLoadPromise;
}


function resiarQuestionBankRefreshBlockedByActiveExam() {
  try {
    const view = document.body?.dataset?.resiarView || '';
    return (view === 'exam' || window._resiarExamRunning === true) && window._resiarExamFinished !== true;
  } catch (_) {
    return false;
  }
}

async function resiarApplyRemoteQuestionBankVersionChange(previousVersion, nextVersion, reason = '') {
  if (!previousVersion || !nextVersion || previousVersion === nextVersion) return false;

  try { resiarRefreshQuestionImagesCache(nextVersion); } catch (_) {}
  await clearQuestionBankCache();
  if (resiarQuestionBankRefreshBlockedByActiveExam()) {
    if (!_resiarQuestionBankPendingGlobalRefresh) {
      _resiarQuestionBankPendingGlobalRefresh = true;
      try { mostrarToast('Hay una actualización del banco disponible. Se aplicará al cerrar el examen.'); } catch (_) {}
    }
    return false;
  }

  _resiarQuestionBankPendingGlobalRefresh = false;
  try { mostrarToast('Actualizando banco por cambios del administrador...'); } catch (_) {}
  try {
    await cargarPreguntas({ forceRefresh: true, skipVersionCheck: true });
    return true;
  } catch (error) {
    try { mostrarToast('No se pudo aplicar la actualización global: ' + (error?.message || String(error))); } catch (_) {}
    console.warn('[ResiAR] Falló actualización global del banco:', reason, error);
    return false;
  }
}

async function resiarCheckQuestionBankVersion(reason = '') {
  const previousVersion = _resiarQuestionBankVersion;
  await resiarEnsureQuestionBankVersion({ force: true, maxAgeMs: 0 });
  const nextVersion = _resiarQuestionBankVersion;
  return resiarApplyRemoteQuestionBankVersionChange(previousVersion, nextVersion, reason);
}

function resiarInstallQuestionBankVersionMonitor() {
  if (_resiarQuestionBankVersionMonitorInstalled) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  _resiarQuestionBankVersionMonitorInstalled = true;

  const run = (reason) => {
    if (!currentUser || _resiarQuestionsLoadPromise) return;
    resiarCheckQuestionBankVersion(reason).catch((error) => {
      console.warn('[ResiAR] No se pudo verificar versión global del banco:', error?.message || error);
    });
  };

  window.addEventListener('focus', () => run('focus'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) run('visibility');
  });
  window.setInterval(() => {
    if (!document.hidden) run('interval');
  }, RESIAR_QB_VERSION_CHECK_MS);
}

try { window.resiarCheckQuestionBankVersion = resiarCheckQuestionBankVersion; } catch (_) {}

async function resiarRefreshQuestionBank() {
  if (!resiarUserIsAdmin()) {
    try { mostrarToast('Acción disponible solo para administrador.'); } catch (_) {}
    return false;
  }

  if (resiarQuestionBankRefreshBlockedByActiveExam()) {
    try { mostrarToast('Terminá o cerrá el examen actual antes de actualizar el banco de preguntas.'); } catch (_) {}
    return false;
  }

  if (_resiarQuestionsLoadPromise) {
    try { mostrarToast('El banco de preguntas ya se está actualizando.'); } catch (_) {}
    return _resiarQuestionsLoadPromise;
  }

  const previousQuestions = Array.isArray(preguntas) ? preguntas.slice() : [];
  const previousCount = previousQuestions.length;
  let nextVersion = null;

  try {
    nextVersion = await resiarBumpQuestionBankVersion();
  } catch (error) {
    try { mostrarToast('No se pudo publicar la actualización global: ' + (error?.message || String(error))); } catch (_) {}
    return false;
  }

  let nextCount = previousCount;
  let localRefreshOk = false;

  try {
    try { resiarRefreshQuestionImagesCache(nextVersion); } catch (_) {}
    await clearQuestionBankCache();
    const updated = await cargarPreguntas({ forceRefresh: true, skipVersionCheck: true });
    nextCount = Array.isArray(updated) ? updated.length : 0;
    localRefreshOk = true;
  } catch (error) {
    preguntas = previousQuestions;
    try {
      if (previousQuestions.length) {
        resiarFinalizeQuestionBankLoad(previousQuestions, { source: 'memory-after-global-refresh-local-error' });
      }
      if (typeof window.resiarRenderHome === 'function') window.resiarRenderHome(false);
    } catch (_) {}
    console.warn('[ResiAR] La versión global se publicó, pero falló el refresco local:', error?.message || error);
  }

  const delta = localRefreshOk && previousCount !== nextCount ? ` (${previousCount} → ${nextCount})` : '';
  const localNote = localRefreshOk ? '' : ' Recargá esta pestaña para verlo también acá.';
  try { mostrarToast(`Banco e imágenes actualizados globalmente${localRefreshOk ? `: ${nextCount} preguntas${delta}` : ''}.${localNote}`); } catch (_) {}
  try { console.info('[ResiAR] Nueva versión global del banco:', nextVersion); } catch (_) {}
  return true;
}

try { window.resiarRefreshQuestionBank = resiarRefreshQuestionBank; } catch (_) {}

try {
  window.resiarClearQuestionCache = async function resiarClearQuestionCache() {
    const ok = await clearQuestionBankCache();
    try { resiarRefreshQuestionImagesCache(`${Date.now()}`); } catch (_) {}
    try { mostrarToast(ok ? 'Cache local de preguntas e imágenes limpiado.' : 'No se pudo limpiar el cache local de preguntas.'); } catch (_) {}
    return ok;
  };
} catch (_) {}

// ── INIT AUTH ──
// TRIAL / ACCESS UI
const trialAccess = configureTrialAccess({
  getPreguntas: () => preguntas,
  setPreguntas: (items) => { preguntas = Array.isArray(items) ? items : []; },
  buildNumeroMap: (items) => buildNumeroMap(items),
  cargarFiltros: () => cargarFiltros(),
  cargarChecklist: () => cargarChecklist(),
  getServerAccess: () => _serverAcceso,
  setServerAccess: (value) => { _serverAcceso = value; },
  getCurrentProfile: () => currentProfile,
  setCurrentProfile: (profile) => { currentProfile = profile; },
  getCurrentUser: () => currentUser,
  getSupabase: () => sb,
  renderUserUI: () => renderUserUI(),
  renderPlanStatus: () => { if (typeof renderPlanStatus === 'function') renderPlanStatus(); },
  cargarPreguntas: () => cargarPreguntas(),
  mostrarToast
});

const filtrarPreguntasParaTrial = trialAccess.filtrarPreguntasParaTrial;
const estaEnTrialLimitado = trialAccess.estaEnTrialLimitado;
const activarModoTrialLimitado = trialAccess.activarModoTrialLimitado;
const activarPublicidadTrial = trialAccess.activarPublicidadTrial;
const activarTrialPremium = trialAccess.activarTrialPremium;



// Question chat extraído a src/ui/questionChat.js.
async function resiarStartInviteSessionFromChat(list, idx, openChat) {
  if (!Array.isArray(list) || !list.length) return false;
  _stopActiveSounds();
  clearInterval(timer);
  pausarTimerPregunta();

  // Una invitación también inicia un examen real, pero no debe hidratar preguntas
  // consultando public.preguntas desde el cliente. Desde v72 usa la misma sesión
  // segura que el examen normal: el catálogo local aporta IDs/metadatos y el RPC
  // entrega enunciado/opciones sin respuesta correcta.
  const startQuestionId = String(list[Math.max(0, Math.min(Number(idx) || 0, list.length - 1))]?.id || '').trim();
  let secure = null;
  try {
    secure = await resiarCreateSecureExamFromCatalog(list, {
      mode: 'invite',
      limit: Math.min(list.length, RESIAR_SECURE_EXAM_MAX_LIMIT),
      filters: { source: 'question_invite' }
    });
  } catch (error) {
    console.warn('[ResiAR] No se pudo abrir invitación con sesión segura:', error);
    mostrarToast('No se pudo abrir la invitación segura: ' + (error?.message || error));
    return false;
  }

  const hydrated = Array.isArray(secure?.questions) ? secure.questions : [];
  if (!hydrated.length) {
    mostrarToast('No se pudo abrir la invitación: el servidor no devolvió preguntas disponibles.');
    return false;
  }

  const startIndex = startQuestionId
    ? Math.max(0, hydrated.findIndex((question) => String(question?.id || '') === startQuestionId))
    : Math.max(0, Math.min(Number(idx) || 0, hydrated.length - 1));

  // Una invitación también inicia un examen real. Debe activar el mismo estado
  // visual/runtime que generar un examen propio, antes de renderizar, para que
  // render() incluya el dock del chat y el sync posterior conecte el canal.
  resiarActivarModoExamen();
  resiarStartExamSession(hydrated, {
    startIndex: startIndex >= 0 ? startIndex : 0,
    mode: 'invite',
    secureSessionId: secure.sessionId
  });
  try { if (typeof window.resiarSyncQuestionChat === 'function') window.resiarSyncQuestionChat('exam'); } catch (_) {}
  if (typeof openChat === 'function') openChat();
  return true;
}

const cloudflareLiveClient = createCloudflareSocialClient({
  getSb: () => sb,
  getCurrentUser: () => currentUser
});

const questionChat = configureQuestionChat({
  cloudflareLiveClient,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  getServerAccess: () => _serverAcceso,
  getExam: () => examen,
  getActual: () => actual,
  getPreguntas: () => preguntas,
  getSupabase: () => sb,
  getSocialState: () => socialState,
  cargarSocialSidebar: (...args) => cargarSocialSidebar(...args),
  socialNotifyUser: (...args) => socialNotifyUser(...args),
  mostrarToast,
  abrirAuth,
  irDesdeNav: (idx) => irDesdeNav(idx),
  buildNumeroMap: (items) => buildNumeroMap(items),
  startInviteSession: (list, idx, openChat) => resiarStartInviteSessionFromChat(list, idx, openChat),
  getNPregunta: (p) => getNPregunta(p),
  esExamenUnico: (v) => esExamenUnico(v)
});


configureBibliografia2026({
  getSupabase: () => window.sb,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  openAuth: () => abrirAuth(),
  escapeHtml,
  mostrarToast,
  hideExamChrome: () => {
    try { if (typeof resiarHomeHideExamChrome === 'function') resiarHomeHideExamChrome(); } catch (_) {}
    try { if (typeof questionChatClose === 'function') questionChatClose(); } catch (_) {}
    try { if (typeof questionChatDisconnect === 'function') questionChatDisconnect(true); } catch (_) {}
    try { window._resiarExamRunning = false; window._resiarExamFinished = true; } catch (_) {}
    try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('config'); } catch (_) {}
  },
  getQuestionBox: () => preguntaBox
});
try { window.abrirBibliografia2026 = abrirBibliografia2026; } catch (_) {}

configureVacunasPractice({
  getQuestionBox: () => preguntaBox,
  getSupabase: () => window.sb,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  getServerAccess: () => _serverAcceso,
  openAuth: () => abrirAuth(),
  markViewState: (state) => {
    if (typeof resiarMarkViewState === 'function') resiarMarkViewState(state);
  },
  renderHome: (forcePublic) => {
    if (typeof resiarRenderHome === 'function') resiarRenderHome(forcePublic);
  },
  mostrarToast,
  hideExamChrome: () => {
    try { if (typeof resiarHomeHideExamChrome === 'function') resiarHomeHideExamChrome(); } catch (_) {}
    try { if (typeof questionChatClose === 'function') questionChatClose(); } catch (_) {}
    try { if (typeof questionChatDisconnect === 'function') questionChatDisconnect(true); } catch (_) {}
    try { window._resiarExamRunning = false; window._resiarExamFinished = true; } catch (_) {}
  }
});
try { window.abrirVacunasPractice = abrirVacunasPractice; } catch (_) {}

const QUESTION_CHAT_WORKER_URL = questionChat.QUESTION_CHAT_WORKER_URL;
const QUESTION_CHAT_CLIENT_ID = questionChat.QUESTION_CHAT_CLIENT_ID;
const QUESTION_CHAT_LIMITS = questionChat.QUESTION_CHAT_LIMITS;
const questionChatState = questionChat.state;
const questionChatWorkerConfigured = questionChat.questionChatWorkerConfigured;
const questionChatQuestionKey = questionChat.questionChatQuestionKey;
const questionChatQuestionLabel = questionChat.questionChatQuestionLabel;
const questionChatDockHtml = questionChat.questionChatDockHtml;


// v54 — Integración mínima del editor de corrección admin.
function resiarAdminQuestionId(question) {
  return String(question?.id || question?.pregunta_id || question?.question_id || question?.questionId || question?.uuid || '').trim();
}

function resiarMergeUpdatedQuestionLocal(oldQuestion, updatedQuestion) {
  if (!oldQuestion) return updatedQuestion;
  const merged = { ...oldQuestion, ...updatedQuestion, _resiarLoadIndex: oldQuestion._resiarLoadIndex };

  // v70B: si el admin acaba de persistir una respuesta correcta, la pregunta local
  // no debe seguir marcada como “respuesta oculta” de v69. Esto evita que el panel
  // parezca no actualizarse después de usar “Cargar respuesta correcta”.
  if (Object.prototype.hasOwnProperty.call(updatedQuestion || {}, 'respuesta') && String(updatedQuestion?.respuesta || '').trim()) {
    merged._resiarAnswerHidden = false;
    merged._resiarAnswerVerified = true;
  }

  return merged;
}

function resiarReplaceQuestionInList(list, updatedQuestion) {
  const id = resiarAdminQuestionId(updatedQuestion);
  if (!Array.isArray(list) || !id) return list;
  return list.map((question) => resiarAdminQuestionId(question) === id
    ? resiarMergeUpdatedQuestionLocal(question, updatedQuestion)
    : question);
}

function resiarRemoveDeletedQuestionFromList(list, questionId) {
  const id = String(questionId || '').trim();
  if (!Array.isArray(list) || !id) return list;
  return list.filter((question) => resiarAdminQuestionId(question) !== id);
}

function resiarApplyAdminUpdatedQuestion(updatedQuestion, meta = {}) {
  const id = resiarAdminQuestionId(updatedQuestion);
  if (!id) return;
  const normalized = { ...updatedQuestion, id };
  preguntas = resiarReplaceQuestionInList(preguntas, normalized);
  examen = resiarReplaceQuestionInList(examen, normalized);
  try {
    const updatedIndex = examen.findIndex((question) => resiarAdminQuestionId(question) === id);
    if (updatedIndex >= 0) resiarSyncAnswerResultAtIndex(updatedIndex);
    resiarApplyLiveStatsFromAnswers();
    updateStats();
  } catch (_) {}
  try { buildNumeroMap(preguntas); } catch (_) {}

  const nextVersion = meta.questionBankVersion ? resiarNormalizeQuestionBankVersion(meta.questionBankVersion) : null;
  if (nextVersion) {
    try { _resiarQuestionBankVersion = nextVersion; _resiarQuestionBankVersionLoadedAt = Date.now(); } catch (_) {}
    try { window.__resiarQuestionBankVersion = nextVersion; } catch (_) {}
    try { resiarRefreshQuestionImagesCache(nextVersion); } catch (_) {}
    try { clearQuestionBankCache().catch?.(() => {}); } catch (_) {}
  }

  try { render(); } catch (_) {}
}

async function resiarApplyAdminUpdatedExplanation(questionId, explanationPayload = {}) {
  const id = String(questionId || '').trim();
  const currentId = resiarAdminQuestionId(examen?.[actual]);
  if (!id || !currentId || id !== currentId) return;

  const texto = String(explanationPayload?.texto || '').trim();
  if (!texto) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    await explanation.renderExplicacion({
      texto,
      modelo: 'manual',
      fromCache: true,
      preguntaId: id,
      session,
      promptVersion: Number(explanationPayload?.prompt_version || 5) || 5
    });
  } catch (_) {
    // No bloquear el guardado si la UI de explicación no está visible.
  }
}

async function resiarApplyAdminDeletedExplanation(questionId) {
  const id = String(questionId || '').trim();
  const currentId = resiarAdminQuestionId(examen?.[actual]);
  if (!id || !currentId || id !== currentId) return;

  try {
    const box = document.getElementById('explicacionBox');
    if (box) box.innerHTML = '';
    const btn = document.getElementById('btnExplicar');
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.style.opacity = '';
      btn.style.cursor = '';
      const txt = btn.querySelector('.ai-txt');
      if (txt) txt.textContent = '✨ Explicar con IA';
    }
  } catch (_) {}
}

function resiarApplyAdminDeletedQuestion(questionId, meta = {}) {
  const id = String(questionId || '').trim();
  if (!id) return;
  preguntas = resiarRemoveDeletedQuestionFromList(preguntas, id);
  const prevExamLength = Array.isArray(examen) ? examen.length : 0;
  const deletedIndex = Array.isArray(examen) ? examen.findIndex((question) => resiarAdminQuestionId(question) === id) : -1;
  examen = resiarRemoveDeletedQuestionFromList(examen, id);
  if (prevExamLength !== examen.length && deletedIndex >= 0) {
    try { respuestas.splice(deletedIndex, 1); } catch (_) {}
    try { tiemposPregunta.splice(deletedIndex, 1); } catch (_) {}
    try { visitadas.delete(deletedIndex); marcadas.delete(deletedIndex); } catch (_) {}
    try { visitadas = new Set([...visitadas].map((idx) => idx > deletedIndex ? idx - 1 : idx).filter((idx) => idx >= 0)); } catch (_) {}
    try { marcadas = new Set([...marcadas].map((idx) => idx > deletedIndex ? idx - 1 : idx).filter((idx) => idx >= 0)); } catch (_) {}
    if (actual > deletedIndex) actual -= 1;
    if (actual >= examen.length) actual = Math.max(0, examen.length - 1);
  }
  try { buildNumeroMap(preguntas); } catch (_) {}

  const nextVersion = meta.questionBankVersion ? resiarNormalizeQuestionBankVersion(meta.questionBankVersion) : null;
  if (nextVersion) {
    try { _resiarQuestionBankVersion = nextVersion; _resiarQuestionBankVersionLoadedAt = Date.now(); } catch (_) {}
    try { window.__resiarQuestionBankVersion = nextVersion; } catch (_) {}
    try { resiarRefreshQuestionImagesCache(nextVersion); } catch (_) {}
    try { clearQuestionBankCache().catch?.(() => {}); } catch (_) {}
  }

  try { render(); } catch (_) {}
}

const adminQuestionEditor = configureAdminQuestionEditor({
  getSupabase: () => window.sb,
  getSupabaseUrl: () => SUPA_URL,
  getCurrentProfile: () => currentProfile,
  isAdmin: () => resiarUserIsAdmin(),
  getCurrentExam: () => examen,
  getCurrentIndex: () => actual,
  setCurrentIndex: (index) => { actual = index; },
  getAllQuestions: () => preguntas,
  renderExam: () => render(),
  applyUpdatedQuestion: resiarApplyAdminUpdatedQuestion,
  applyUpdatedExplanation: resiarApplyAdminUpdatedExplanation,
  applyDeletedExplanation: resiarApplyAdminDeletedExplanation,
  applyDeletedQuestion: resiarApplyAdminDeletedQuestion,
  mostrarToast,
});

const questionInviteRegister = questionChat.questionInviteRegister;
const questionInviteReceive = questionChat.questionInviteReceive;
const questionInviteOpenPayload = questionChat.questionInviteOpenPayload;
let questionChatAfterRender = questionChat.questionChatAfterRender;
let questionChatUpdateOffsets = questionChat.questionChatUpdateOffsets;
let questionChatDisconnect = questionChat.questionChatDisconnect;
let questionChatPaint = questionChat.questionChatPaint;
let questionChatAppendMessage = questionChat.questionChatAppendMessage;
let questionChatOpen = questionChat.questionChatOpen;
let questionChatClose = questionChat.questionChatClose;
let questionChatToggle = questionChat.questionChatToggle;
let questionChatSetScope = questionChat.questionChatSetScope;
let questionChatMaybeSend = questionChat.questionChatMaybeSend;
let questionChatSend = questionChat.questionChatSend;
let questionChatHandleTypingInput = questionChat.questionChatHandleTypingInput;
let questionInviteToggle = questionChat.questionInviteToggle;
let questionInviteClose = questionChat.questionInviteClose;
let questionInviteSendToFriend = questionChat.questionInviteSendToFriend;



configureSocial({
  getSb: () => sb,
  getCurrentUser: () => currentUser,
  cloudflareLiveClient,
  abrirAuth,
  mostrarToast,
  escapeHtml,
  resiarAvatarHtml,
  resiarInstallAvatarFallback,
  getQuestionChatWorkerConfigured: () => questionChatWorkerConfigured,
  getQuestionChatWorkerUrl: () => QUESTION_CHAT_WORKER_URL,
  getQuestionChatClientId: () => QUESTION_CHAT_CLIENT_ID,
  getQuestionInviteReceive: () => questionInviteReceive,
  getQuestionInviteRegister: () => questionInviteRegister,
  getQuestionChatState: () => questionChatState
});



// ── AUTH / SESIÓN ──
// Modularizado en src/services/authSession.js.

const authSession = configureAuthSession({
  getSb: () => sb,
  getEdgeVerifyUrl: () => EDGE_VERIFY_URL,
  getCurrentUser: () => currentUser,
  setCurrentUser: (value) => { currentUser = value; },
  getCurrentProfile: () => currentProfile,
  setCurrentProfile: (value) => { currentProfile = value; },
  setServerAccess: (value) => { _serverAcceso = value; },
  setServerIsPro: (value) => { _serverEsPro = !!value; },
  resetServerAccess: () => { _serverAcceso = null; _serverEsPro = false; },
  writeText,
  readText,
  removeStorage,
  resiarPickUserAvatarUrl,
  resiarAvatarHtml,
  mostrarToast,
  cargarPreguntas,
  verificarAccesoServidor,
  activarPublicidadTrial,
  filtrarPreguntasParaTrial,
  activarModoTrialLimitado,
  mostrarPantallaBloqueo,
  cerrarLoginReq,
  checkAdminReportesBtn,
  clearReportesEnviados,
  socialStartRealtime,
  socialStopRealtime,
  socialState,
  cargarSocialSidebar,
  questionChatDisconnect,
  clearAllTopics,
  cargarFiltros,
  cargarChecklist,
  sbUpdateCuentaSummary,
  resiarEnsureModernConfigHome,
  renderUserUIAfterSync: () => {
    try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}
  },
  resetExamStateAfterLogout: () => {
    clearInterval(timer);
    clearInterval(timerPregunta);
    timer = null;
    timerPregunta = null;

    examen = [];
    respuestas = [];
    actual = 0;
    _resiarLastAnsweredIndex = -1;
    correctas = 0;
    incorrectas = 0;
    respondidasCount = 0;
    tiempo = 120 * 60;
    tiempoTotal = 120 * 60;
    marcadas = new Set();
    visitadas = new Set();
    tiemposPregunta = [];
    segPregunta = 0;
    soloMarcadas = false;
    examSessionMode = 'exam';
    preguntas = [];
    clearAllTopics();
    ultimosErrores = [];

    try { statsBox.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('rightPanel')?.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('rachaPill')?.classList.remove('vis'); } catch (_) {}
    try { navBox.classList.remove('vis'); } catch (_) {}
    try { rachaBox.classList.remove('vis'); } catch (_) {}
    try { navBox.innerHTML = ''; } catch (_) {}
    try { historial.innerHTML = ''; } catch (_) {}
    try { rachaEl.innerHTML = ''; } catch (_) {}
    try { streakTexto.innerText = ''; } catch (_) {}
    try { correctasSpan.innerText = '0'; } catch (_) {}
    try { incorrectasSpan.innerText = '0'; } catch (_) {}
    try { porcentajeSpan.innerText = '0%'; } catch (_) {}
    try { timerSpan.innerText = '120:00'; } catch (_) {}
    try { document.getElementById('btnFilterMarked').style.display = 'none'; } catch (_) {}
    try { document.getElementById('btnRepaso').disabled = true; } catch (_) {}
    try { document.getElementById('btnSmartExam').disabled = true; } catch (_) {}
    try { document.getElementById('upgradeBanner')?.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('adSidebar')?.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('adInterstitial')?.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('btnRepaso')?.classList.remove('btn-pro-locked'); } catch (_) {}
    try { document.getElementById('btnSmartExam')?.classList.remove('btn-pro-locked'); } catch (_) {}
    try { modalFinal.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('modalReview')?.classList.remove('vis'); } catch (_) {}
    try { document.getElementById('modalSearch')?.classList.remove('vis'); } catch (_) {}

    try { cargarFiltros(); } catch (_) {}
    try { cargarChecklist(); } catch (_) {}
  },
  restorePublicLandingAfterLogout: ({ fallbackHtml }) => {
    try { if (typeof resiarHomeHideExamChrome === 'function') resiarHomeHideExamChrome(); } catch(_) {}
    try { if (typeof resiarHideStreakToast === 'function') resiarHideStreakToast(); } catch(_) {}
    try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('landing'); else resiarForcePublicLandingStateFallback(); } catch(_) {}
    try {
      const box = document.getElementById('preguntaBox');
      if (box && fallbackHtml) {
        box.innerHTML = fallbackHtml;
        box.scrollTop = 0;
        setTimeout(function(){ try { if (typeof resiarInitPublicLandingRestored === 'function') resiarInitPublicLandingRestored(); } catch(_) {} }, 0);
      }
    } catch(_) {}
    try { if (typeof resiarSetWhatsAppVisible === 'function') resiarSetWhatsAppVisible(true); } catch(_) {}
    try { if (typeof loadReviews === 'function') loadReviews(); } catch(_) {}
  },
  forcePublicLandingFallback: () => {
    try {
      if (!document.body) return;
      document.body.dataset.resiarView = 'landing';
      document.body.classList.add('resiar-public-landing', 'sb-collapsed');
      document.body.classList.remove('resiar-user-authenticated', 'resiar-in-simulator', 'resiar-config-home', 'resiar-exam-ended');
    } catch(_) {}
  }
});

function resiarForcePublicLandingStateFallback() { return authSession.resiarForcePublicLandingStateFallback(); }
function resiarShowPublicLandingAfterLogout() { return authSession.resiarShowPublicLandingAfterLogout(); }
function onLogin(user) { return authSession.onLogin(user); }
function onLogout() { return authSession.onLogout(); }
function renderUserUI() { return authSession.renderUserUI(); }
function iniciarVerificacionSesion() { return authSession.iniciarVerificacionSesion(); }
function abrirAuth() { return authSession.abrirAuth(); }
function cerrarAuth() { return authSession.cerrarAuth(); }
function showAuthErr(msg) { return authSession.showAuthErr(msg); }
async function logout() { return authSession.logout(); }

window.resiarShowPublicLandingAfterLogout = resiarShowPublicLandingAfterLogout;
window.getResiarAuthRedirectTo = getResiarAuthRedirectTo;
window.loginGoogle = loginGoogle;

function resiarDeferredAction(name) {
  return function resiarDeferredActionInvoker() {
    const fn = window && window[name];
    if (typeof fn !== 'function') {
      console.warn('[ResiAR] Acción no disponible todavía:', name);
      return false;
    }
    return fn.apply(this, arguments);
  };
}

function initResiarAuthActionHandlers() {
  return installGlobalActionHandlers({
    loginGoogle,
    cerrarLoginReq,
    toggleFaq,
    enviarContacto,
    abrirModalLegal,
    cerrarModalLegal,
    abrirSoundPanel,
    cerrarSoundPanel,
    toggleTheme,
    sbToggle,
    cargarSocialSidebar,
    abrirPerfil,
    abrirLeaderboard,
    abrirDesafio,
    abrirAdminReportes,
    filtrarReportes,
    selMotivo,
    cerrarModalReporte,
    enviarReporte,
    logout,
    toggleFiltroMarcadas,
    toggleSidebar: function () {
      return typeof window.toggleSidebar === 'function' ? window.toggleSidebar() : false;
    },
    toggleNotaDesdePanel,
    abrirReporteActual,
    cerrarModal,
    abrirReview,
    exportarPDF,
    irAConfigurarNuevoExamen: resiarDeferredAction('irAConfigurarNuevoExamen'),
    cerrarModalStats,
    cerrarUpgrade,
    iniciarPago,
    cerrarReview,
    exitExamReviewMode,
    setReviewFilter,
    cerrarBuscador,
    cerrarAuth,
    setLbFilter,
    switchChallengeTab,
    crearDesafio,
    copiarCodigo,
    copiarLinkDesafio,
    unirseDesafio,
    switchProfileTab,
    guardarUsername,
    iniciarExamenInteligente,
    iniciarRepaso,
    iniciar,
    abrirBuscador,
    resiarRefreshQuestionBank: resiarDeferredAction('resiarRefreshQuestionBank'),
    resiarHomeMixedClear: resiarDeferredAction('resiarHomeMixedClear'),
    resiarHomeClearSpecialties: resiarDeferredAction('resiarHomeClearSpecialties'),
    resiarHomeClearTopic: resiarDeferredAction('resiarHomeClearTopic'),
    resiarHomeMixedToggleBank: resiarDeferredAction('resiarHomeMixedToggleBank'),
    resiarHomeMixedToggle: resiarDeferredAction('resiarHomeMixedToggle'),
    resiarHomeToggleSpecialty: resiarDeferredAction('resiarHomeToggleSpecialty'),
    resiarHomeSetTopic: resiarDeferredAction('resiarHomeSetTopic'),
    activarTrialPremium,
    previewSlotFile,
    eliminarYrenderizar,
    previewSlot,
    resetYrenderizar,
    goReview: typeof goReview === 'function' ? goReview : undefined,
    mixedExamFilterClear: resiarDeferredAction('mixedExamFilterClear'),
    mixedExamFilterToggleBank: resiarDeferredAction('mixedExamFilterToggleBank'),
    mixedExamFilterToggle: resiarDeferredAction('mixedExamFilterToggle'),
    selectExamen,
    selectAnioMir,
    irAReportePregunta,
    iniciarPagoDesdeTab,
    socialCloseFriendProfile,
    responderSolicitudSocial,
    socialOpenFriendProfile,
    eliminarAmigoSocial,
    enviarSolicitudSocial,
    irAPregunta,
    irAPreguntaDesde,
    iniciarExamenDesdeBusqueda,
    irDesdeNav,
    toggleMarcada,
    responder,
    prev,
    next,
    confirmarFinalizar,
    pedirExplicacion,
    votarExplicacion,
    questionChatToggle,
    questionChatClose,
    questionChatSetScope,
    questionInviteToggle,
    questionInviteClose,
    questionInviteSendToFriend,
    questionInviteOpenPayload,
    questionChatSend,
    questionChatMaybeSend,
    socialScheduleSearch,
    guardarNotaDesdePanel,
    buscarPreguntas,
    questionChatHandleTypingInput,
    resiarHomeRefreshSpecialties: resiarDeferredAction('resiarHomeRefreshSpecialties'),
    toggleSonido,
    actualizarEstadoReporte,
    handleMultiUpload,
    buscarUsuariosSocial,
    setActual: (value) => { actual = value; },
    render
  });
}
window.initResiarAuthActionHandlers = initResiarAuthActionHandlers;
initResiarAuthActionHandlers();
authSession.initAuth();

/* ════════════════════════════════════════════════
   LEADERBOARD
   Modularizado en src/ui/leaderboard.js
════════════════════════════════════════════════ */

// ── DESAFÍOS ──
// Modularizado en src/ui/challenges.js


function resiarStartChallengeExam(questionList, toastMessage) {
  const list = Array.isArray(questionList) ? questionList.slice() : [];
  if (!list.length) return;

  try { document.getElementById('modalDesafio')?.classList.remove('vis'); } catch(_) {}
  try { cerrarModal(); } catch(_) {}
  try { resiarResetFinalSaveGuard(); } catch(_) {}
  try { window._resiarExamRunning = true; window._resiarExamFinished = false; } catch(_) {}
  try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('exam'); } catch(_) {}

  resiarActivarModoExamen();
  resiarStartExamSession(list, { mode: 'challenge', toastMessage });
}

configureChallenges({
  getSupabase: () => window.sb,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  getAllQuestions: () => preguntas,
  getCurrentExam: () => examen,
  getRespuestas: () => respuestas,
  getTiempo: () => tiempo,
  getTiempoTotal: () => tiempoTotal,
  mostrarToast,
  showRichToast: _showRichToast,
  escapeHtml,
  openAuth: () => abrirAuth(),
  verificarAccesoServidor: () => verificarAccesoServidor(),
  isSpecificFilterActive: () => resiarIsSpecificFilterActive(),
  sortByOriginalExamOrder: (items) => resiarSortByOriginalExamOrder(items),
  startChallengeExam: resiarStartChallengeExam,
  buildAnswerPayload: () => buildAnswerPayload(),
  getSubmitChallengeResultUrl: () => EDGE_SUBMIT_CHALLENGE_RESULT_URL,
  getArenaCreateMatchUrl: () => EDGE_ARENA_CREATE_MATCH_URL,
  getArenaAcceptInviteUrl: () => EDGE_ARENA_ACCEPT_INVITE_URL,
  getArenaGetMatchUrl: () => EDGE_ARENA_GET_MATCH_URL,
  getArenaSubmitAnswerUrl: () => EDGE_ARENA_SUBMIT_ANSWER_URL,
  getArenaCompleteMatchUrl: () => EDGE_ARENA_COMPLETE_MATCH_URL,
  getArenaSummaryUrl: () => EDGE_ARENA_SUMMARY_URL,
  getArenaFindMatchUrl: () => EDGE_ARENA_FIND_MATCH_URL,
  getArenaLiveTicketUrl: () => EDGE_ARENA_LIVE_TOKEN_URL,
  getArenaLiveWsUrl: () => ARENA_LIVE_WS_URL
});
installArenaCancelSearchPatch();
installClinicalGuide({ showToast: mostrarToast });
resiarInstallMobileExamRuntime();
installMobileExamUi();
installSplitScreenSafety();


/* ════════════════════════════════════════════════
   PRECIOS DINÁMICOS
   Modularizado en src/ui/billing.js
════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   SUPABASE REALTIME — contadores públicos y precios
   Modularizado en src/ui/publicCounters.js
═══════════════════════════════════════════════════════════ */
initPublicRealtime();



/* ════════════════════════════════════════════════
   MERCADO PAGO — MODAL UPGRADE + PAGO
   Modularizado en src/ui/billing.js
════════════════════════════════════════════════ */

// ── PERFIL / FAQ / CONTACTO ──
configureProfile({
  getSupabase: () => window.sb,
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  setCurrentProfile: (profile) => { currentProfile = profile; },
  openAuth: () => abrirAuth(),
  renderUserUI: () => renderUserUI(),
  renderPlanStatus: () => renderPlanStatus(),
  applyPricingDom: () => _aplicarPreciosDOM(),
  splitEspecialidades,
  formatEsp
});


// ══════════════════════════════
//  SISTEMA DE REPORTES
// ══════════════════════════════

configureReports({
  getSupabase: () => window.sb,
  getCurrentProfile: () => currentProfile,
  getExam: () => examen,
  renderExam: () => render(),
  setCurrentQuestion: (idx) => {
    actual = idx;
    render();
  },
  espLabel,
  escapeHtml,
  showRichToast: _showRichToast
});



/* ===== resiar-whatsapp-float-controller ===== */
installWhatsAppFloatController({
  isLogged: () => !!currentUser
});


/* ===== resiar-legal-modal-script ===== */
installLegalModal();



/* ===== resiar-reviews-script ===== */
installReviews({
  getSupabase: () => window.sb,
  escapeHtml
});


/* ===== resiar-mixed-exam-filter-script ===== */
// Extraído a ui/mixedExamFilter.js. main.js sigue siendo dueño del
// estado mutable (preguntas, currentUser, currentProfile, _serverAcceso,
// _resiarQuestionBankVersion, cargarChecklist, cargarFiltros,
// _filtroExamenValue, _filtroAnioMirValue) y lo inyecta acá vía closure.
configureMixedExamFilter({
  getQuestions: () => preguntas,
  getCurrentUser: () => currentUser,
  getServerAccess: () => _serverAcceso,
  getCurrentProfile: () => currentProfile,
  getQuestionBankVersion: () => _resiarQuestionBankVersion,
  getCargarChecklist: () => cargarChecklist,
  getCargarFiltros: () => cargarFiltros,
  setCargarFiltros: (fn) => { cargarFiltros = fn; },
  setFiltroExamenValue: (v) => { _filtroExamenValue = v; },
  setFiltroAnioMirValue: (v) => { _filtroAnioMirValue = v; }
});


/* ===== resiarHomeConfiguratorScript ===== */
// Extraído a ui/homeConfigurator.js. main.js sigue siendo dueño del
// estado mutable (preguntas, currentUser, currentProfile, _serverAcceso,
// _resiarQuestionBankVersion, _filtroExamenValue, _filtroAnioMirValue,
// questionChatState/Close/Disconnect, cerrarModal, cerrarReview,
// resiarIsLegacyConfigPlaceholder, resiarSyncReviewErrorsButton,
// deseleccionarEspecialidades, mostrarPantallaBienvenida) y lo inyecta
// acá vía closure.
configureHomeConfigurator({
  getQuestions: () => preguntas,
  getCurrentUser: () => currentUser,
  getServerAccess: () => _serverAcceso,
  getCurrentProfile: () => currentProfile,
  getQuestionBankVersion: () => _resiarQuestionBankVersion,
  getFiltroExamenValue: () => _filtroExamenValue,
  getFiltroAnioMirValue: () => _filtroAnioMirValue,
  getQuestionChatState: () => questionChatState,
  getQuestionChatClose: () => questionChatClose,
  getQuestionChatDisconnect: () => questionChatDisconnect,
  getCerrarModal: () => cerrarModal,
  getCerrarReview: () => cerrarReview,
  getResiarIsLegacyConfigPlaceholder: () => resiarIsLegacyConfigPlaceholder,
  getResiarSyncReviewErrorsButton: () => resiarSyncReviewErrorsButton,
  getDeseleccionarEspecialidades: () => deseleccionarEspecialidades,
  setMostrarPantallaBienvenida: (fn) => { mostrarPantallaBienvenida = fn; }
});


/* ===== resiar-view-state-compat-bridge ===== */


/* ===== resiar-public-carousel-script ===== */
installResiarPublicLanding({
  getCurrentUser: () => currentUser,
  markViewState: (state) => {
    if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState(state);
    else if (typeof resiarForcePublicLandingStateFallback === 'function') resiarForcePublicLandingStateFallback();
  },
  forcePublicLandingStateFallback: () => {
    if (typeof resiarForcePublicLandingStateFallback === 'function') resiarForcePublicLandingStateFallback();
  },
  applyPricesDom: () => {
    if (typeof _aplicarPreciosDOM === 'function') _aplicarPreciosDOM();
  },
  loadPrices: () => {
    if (typeof cargarPrecios === 'function') return cargarPrecios();
  },
  loadReviews: () => {
    if (typeof window.loadReviews === 'function') return window.loadReviews();
  },
  hideStreakToast: () => {
    if (typeof window.resiarHideStreakToast === 'function') window.resiarHideStreakToast();
  },
  setWhatsAppVisible: (visible) => {
    if (typeof window.resiarSetWhatsAppVisible === 'function') window.resiarSetWhatsAppVisible(visible);
  }
});


/* Runtime de examen centralizado en src/state/viewState.js. */


/* ===== resiar-sound-system-extension ===== */
installResiarSoundSystemExtension({
  getFunction(name) {
    switch (name) {
      case 'iniciar': return iniciar;
      case 'iniciarRepaso': return iniciarRepaso;
      case 'iniciarExamenInteligente': return iniciarExamenInteligente;
      case 'next': return next;
      case 'prev': return prev;
      case 'irDesdeNav': return irDesdeNav;
      case 'toggleMarcada': return toggleMarcada;
      case 'abrirBuscador': return abrirBuscador;
      case 'questionChatAppendMessage': return questionChatAppendMessage;
      case 'questionChatOpen': return questionChatOpen;
      case 'questionChatClose': return questionChatClose;
      default: return null;
    }
  },
  setFunction(name, value) {
    switch (name) {
      case 'iniciar': iniciar = value; break;
      case 'iniciarRepaso': iniciarRepaso = value; break;
      case 'iniciarExamenInteligente': iniciarExamenInteligente = value; break;
      case 'next': next = value; break;
      case 'prev': prev = value; break;
      case 'irDesdeNav': irDesdeNav = value; break;
      case 'toggleMarcada': toggleMarcada = value; break;
      case 'abrirBuscador': abrirBuscador = value; break;
      case 'questionChatAppendMessage': questionChatAppendMessage = value; break;
      case 'questionChatOpen': questionChatOpen = value; break;
      case 'questionChatClose': questionChatClose = value; break;
    }
  },
  getExamLength() {
    try { return Array.isArray(examen) ? examen.length : 0; } catch (_) { return 0; }
  },
  getCurrentIndex() {
    try { return Number(actual) || 0; } catch (_) { return 0; }
  },
  isExamActive() {
    try { return Array.isArray(examen) && examen.length > 0 && document.body.dataset.resiarView === 'exam' && window._resiarExamFinished !== true; } catch (_) {}
    try { return Array.isArray(examen) && examen.length > 0 && window._resiarExamFinished !== true; } catch (_) { return false; }
  },
  getQuestionChatState() {
    try { return questionChatState; } catch (_) { return null; }
  }
});

/* Limpieza de chrome de examen centralizada en src/state/viewState.js. */

/* ===== resiar-specific-filter-active-patch =====
   Nota: hasta 2026-08-06 esto vivía en el mismo IIFE que
   "resiar-question-order-stability-script" (orden de preguntas), que ya
   se consolidó en src/utils/questionOrder.js. Este patch de
   resiarIsSpecificFilterActive es un tema aparte, se deja intacto. */
(function(){
  const previousSpecific = window.resiarIsSpecificFilterActive;
  window.resiarIsSpecificFilterActive = function(){
    try {
      const d = typeof window.mixedExamFilterDebug === 'function' ? window.mixedExamFilterDebug() : null;
      if (d && Array.isArray(d.selected) && d.selected.length) return true;
    } catch(_) {}
    try { return previousSpecific ? !!previousSpecific() : Boolean((_filtroExamenValue && _filtroExamenValue !== 'todos') || (_filtroAnioMirValue && _filtroAnioMirValue !== 'todos')); }
    catch(_) { return false; }
  };
  try { resiarIsSpecificFilterActive = window.resiarIsSpecificFilterActive; } catch(_) {}
})();


/* ===== resiar-home-search-bindings ===== */
/* ===== resiar-home-search-bindings ===== */
// Extraído a ui/homeSearchBindings.js. main.js sigue siendo dueño de los
// bindings reasignables (resiarRenderHome, mostrarPantallaBienvenida,
// irAConfigurarNuevoExamen) y los sincroniza acá vía setFunction.
configureHomeSearchBindings({
  setFunction: (name, fn) => {
    window[name] = fn;
    try {
      if (name === 'resiarRenderHome') resiarRenderHome = fn;
      else if (name === 'mostrarPantallaBienvenida') mostrarPantallaBienvenida = fn;
      else if (name === 'irAConfigurarNuevoExamen') irAConfigurarNuevoExamen = fn;
    } catch (_) {}
  }
});


/* ===== resiar-view-state-controller ===== */
configureViewStateController({
  getCurrentUser: () => currentUser,
  getCurrentProfile: () => currentProfile,
  getServerAccess: () => _serverAcceso,
  getExam: () => examen,
  getCurrentIndex: () => actual,
  getQuestionChatFunction(name) {
    switch (name) {
      case 'questionChatClose': return questionChatClose;
      case 'questionChatDisconnect': return questionChatDisconnect;
      case 'questionChatDockHtml': return questionChatDockHtml;
      case 'questionChatQuestionKey': return questionChatQuestionKey;
      case 'questionChatAfterRender': return questionChatAfterRender;
      case 'questionChatUpdateOffsets': return questionChatUpdateOffsets;
      case 'questionChatPaint': return questionChatPaint;
      default: return window[name];
    }
  },
  getFunction(name) {
    switch (name) {
      case 'renderUserUI': return renderUserUI;
      case 'onLogin': return onLogin;
      case 'onLogout': return onLogout;
      case 'resiarShowPublicLandingAfterLogout': return resiarShowPublicLandingAfterLogout;
      case 'resiarRenderHome': return typeof resiarRenderHome === 'function' ? resiarRenderHome : window.resiarRenderHome;
      case 'mostrarPantallaBienvenida': return typeof mostrarPantallaBienvenida === 'function' ? mostrarPantallaBienvenida : window.mostrarPantallaBienvenida;
      case 'mostrarPantallaBloqueo': return mostrarPantallaBloqueo;
      case 'mostrarRachaDias': return mostrarRachaDias;
      case 'irAConfigurarNuevoExamen': return typeof irAConfigurarNuevoExamen === 'function' ? irAConfigurarNuevoExamen : window.irAConfigurarNuevoExamen;
      case 'render': return render;
      case 'iniciar': return iniciar;
      case 'iniciarExamenInteligente': return iniciarExamenInteligente;
      case 'iniciarRepaso': return iniciarRepaso;
      case 'crearDesafio': return crearDesafio;
      case 'unirseDesafio': return unirseDesafio;
      case 'finalizar': return finalizar;
      case 'next': return next;
      case 'prev': return prev;
      case 'irDesdeNav': return irDesdeNav;
      case 'responder': return responder;
      default: return window[name];
    }
  },
  setFunction(name, value) {
    window[name] = value;
    switch (name) {
      case 'renderUserUI': renderUserUI = value; break;
      case 'onLogin': onLogin = value; break;
      case 'onLogout': onLogout = value; break;
      case 'resiarShowPublicLandingAfterLogout': resiarShowPublicLandingAfterLogout = value; break;
      case 'resiarRenderHome': try { resiarRenderHome = value; } catch(_) {} break;
      case 'mostrarPantallaBienvenida': mostrarPantallaBienvenida = value; break;
      case 'mostrarPantallaBloqueo': break; // const alias from loadingScreens; expose wrapper only on window.
      case 'irAConfigurarNuevoExamen': irAConfigurarNuevoExamen = value; break;
      case 'render': render = value; break;
      case 'iniciar': iniciar = value; break;
      case 'iniciarExamenInteligente': iniciarExamenInteligente = value; break;
      case 'iniciarRepaso': iniciarRepaso = value; break;
      case 'crearDesafio': crearDesafio = value; break;
      case 'unirseDesafio': unirseDesafio = value; break;
      case 'finalizar': finalizar = value; break;
      case 'next': next = value; break;
      case 'prev': prev = value; break;
      case 'irDesdeNav': irDesdeNav = value; break;
      case 'responder': responder = value; break;
    }
  }
});


