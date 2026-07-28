import { readText, writeText } from '../utils/storage.js';
import { RESIAR_SIDEBAR_COLLAPSED_KEY, LEGACY_SIDEBAR_COLLAPSED_KEYS } from '../utils/storageKeys.js';

/* ResiAR — canonical visual state controller.
 * Keeps landing/config/exam/exam-ended as the single source of truth for
 * sidebar, exam chrome, WhatsApp and question chat visibility.
 */

export function configureViewStateController(deps = {}) {
  if (window.__resiarViewStateSidebarControllerInstalled) return window.__resiarViewStateControllerApi || null;
  window.__resiarViewStateSidebarControllerInstalled = true;

  const getCurrentUser = typeof deps.getCurrentUser === 'function' ? deps.getCurrentUser : () => null;
  const getCurrentProfile = typeof deps.getCurrentProfile === 'function' ? deps.getCurrentProfile : () => null;
  const getServerAccess = typeof deps.getServerAccess === 'function' ? deps.getServerAccess : () => '';
  const getExam = typeof deps.getExam === 'function' ? deps.getExam : () => [];
  const getCurrentIndex = typeof deps.getCurrentIndex === 'function' ? deps.getCurrentIndex : () => 0;
  const getFunction = typeof deps.getFunction === 'function' ? deps.getFunction : (name) => window[name];
  const setFunction = typeof deps.setFunction === 'function' ? deps.setFunction : (name, fn) => { window[name] = fn; };
  const getQuestionChatFunction = typeof deps.getQuestionChatFunction === 'function' ? deps.getQuestionChatFunction : (name) => window[name];

  let applying = false;
  let scheduled = false;
  let movingTimer = null;
  let layoutReady = false;
  let lastChatKey = '';
  let lastChatSyncAt = 0;
  let chatHidden = false;
  let lastAppliedState = '';
  let lastSidebarAllowed = null;
  let lastSidebarAriaExpanded = null;
  let lastSidebarAriaHidden = null;
  let lastBodyCollapsed = null;
  let delayedSyncTimer = null;
  let sidebarCollapsed = readSidebarCollapsedPreference();

  function readSidebarCollapsedPreference() {
    const current = readText(RESIAR_SIDEBAR_COLLAPSED_KEY, null);
    if (current === '1' || current === '0') return current === '1';
    for (const key of LEGACY_SIDEBAR_COLLAPSED_KEYS) {
      const legacy = readText(key, null);
      if (legacy === '1' || legacy === '0') {
        writeText(RESIAR_SIDEBAR_COLLAPSED_KEY, legacy);
        return legacy === '1';
      }
    }
    return false;
  }

  function q(id){ return document.getElementById(id); }
  function body(){ return document.body; }
  function isLogged(){ try { return !!getCurrentUser(); } catch(_) { return false; } }

  function normalizeState(kind){
    kind = String(kind || '').toLowerCase().replace(/_/g,'-').trim();
    if (kind === 'public' || kind === 'landing' || kind === 'welcome') return 'landing';
    if (kind === 'bibliografia2026-practice' || kind === 'bibliografia-2026-practice' || kind === 'biblio-practice' || kind === 'bibliografia-practice') return 'bibliografia2026-practice';
    if (kind === 'vaccines-practice' || kind === 'vacunas-practice' || kind === 'vaccines' || kind === 'vacunas') return 'vaccines-practice';
    if (kind === 'bibliografia2026' || kind === 'bibliografia-2026' || kind === 'biblio' || kind === 'bibliografia') return 'bibliografia2026';
    if (kind === 'home' || kind === 'config' || kind === 'configuration' || kind === 'blocked') return 'config';
    if (kind === 'exam' || kind === 'simulator' || kind === 'simulador') return 'exam';
    if (kind === 'review' || kind === 'exam-review' || kind === 'revision' || kind === 'revisión') return 'exam-review';
    if (kind === 'ended' || kind === 'exam-ended' || kind === 'final') return 'exam-ended';
    return '';
  }

  function domLooksPublicLanding(){
    try {
      const box = q('preguntaBox');
      if (!box) return !isLogged();
      return !!box.querySelector('#welcome:not(.home-sim), .lp-nav, .lp-hero');
    } catch(_) { return !isLogged(); }
  }

  function modalFinalOpen(){ try { return !!q('modalFinal')?.classList.contains('vis'); } catch(_) { return false; } }

  function readExam(){
    try {
      const exam = getExam();
      if (Array.isArray(exam)) return exam;
    } catch(_) {}
    try { if (Array.isArray(window.examen)) return window.examen; } catch(_) {}
    return [];
  }

  function questionRendered(){
    try { return !!q('preguntaBox')?.querySelector('.qhdr,.qtext,.opcion'); }
    catch(_) { return false; }
  }

  function renderedExamActive(){
    try {
      if (window._resiarExamFinished === true || modalFinalOpen() || domLooksPublicLanding()) return false;
      const arr = readExam();
      return Array.isArray(arr) && arr.length > 0 && questionRendered();
    } catch(_) { return false; }
  }

  function currentQuestion(){
    try {
      const arr = readExam();
      const idx = Number(getCurrentIndex()) || 0;
      return arr[idx] || arr[0] || null;
    } catch(_) { return null; }
  }

  function deriveState(){
    if (!isLogged()) return 'landing';
    try {
      const view = normalizeState(body().dataset.resiarView || '');
      if (body().classList.contains('biblio-practice-active') || view === 'bibliografia2026-practice' || q('preguntaBox')?.querySelector('.biblio-official-question')) return 'bibliografia2026-practice';
      if (view === 'vaccines-practice' || body().classList.contains('resiar-vaccines-practice') || q('preguntaBox')?.querySelector('.vaccines-practice-page,#vaccinesPracticeRoot')) return 'vaccines-practice';
      if (view === 'bibliografia2026' || body().classList.contains('resiar-biblio-home') || q('preguntaBox')?.querySelector('.biblio-page.home-sim')) return 'bibliografia2026';
    } catch(_) {}
    if ((body().classList.contains('resiar-exam-review') || window._resiarExamReviewMode === true) && questionRendered()) return 'exam-review';
    if (body().classList.contains('resiar-exam-ended') || window._resiarExamFinished === true || modalFinalOpen()) return 'exam-ended';
    if (domLooksPublicLanding()) return 'landing';
    try {
      if (renderedExamActive()) return 'exam';
      const canonical = normalizeState(body().dataset.resiarView || '');
      if (canonical && canonical !== 'landing') {
        if (canonical === 'exam' && window._resiarExamFinished === true) return 'exam-ended';
        return canonical;
      }
      if (body().classList.contains('resiar-in-simulator') && window._resiarExamFinished !== true) return 'exam';
      if (body().classList.contains('resiar-config-home')) return 'config';
      if (q('preguntaBox') && q('preguntaBox').querySelector('.home-sim')) return 'config';
    } catch(_) {}
    return 'config';
  }

  function setMoving(){
    try { body().classList.add('resiar-sidebar-moving'); } catch(_) {}
    clearTimeout(movingTimer);
    movingTimer = setTimeout(() => { try { body().classList.remove('resiar-sidebar-moving'); } catch(_) {} }, 320);
  }

  function sidebarAllowed(state){
    state = normalizeState(state) || deriveState();
    return isLogged() && state !== 'landing';
  }

  function setAttrIfChanged(el, attr, value){
    if (!el) return;
    value = String(value);
    try { if (el.getAttribute(attr) !== value) el.setAttribute(attr, value); } catch(_) {}
  }

  function syncSidebarDom(state){
    const allowed = sidebarAllowed(state);
    const aside = document.querySelector('#app > aside');
    const toggle = document.querySelector('#app > .sb-toggle-edge');
    const collapsedClass = !allowed || sidebarCollapsed;
    const canonicalCollapsed = allowed && sidebarCollapsed;
    const canonicalOpen = allowed && !sidebarCollapsed;

    try {
      const b = body();

      if (aside) {
        aside.classList.toggle('visible', allowed);
        setAttrIfChanged(aside, 'aria-hidden', allowed ? 'false' : 'true');
      }

      b.classList.toggle('sb-collapsed', collapsedClass);
      b.classList.toggle('resiar-sidebar-open', canonicalOpen);
      b.classList.toggle('resiar-sidebar-collapsed', canonicalCollapsed);
      b.classList.toggle('resiar-sidebar-unavailable', !allowed);
      b.dataset.sidebarCollapsed = String(canonicalCollapsed);
      b.dataset.sidebarAllowed = String(allowed);

      if (toggle) {
        setAttrIfChanged(toggle, 'aria-expanded', String(canonicalOpen));
        setAttrIfChanged(toggle, 'aria-hidden', allowed ? 'false' : 'true');
      }

      lastSidebarAllowed = allowed;
      lastSidebarAriaHidden = String(!allowed);
      lastSidebarAriaExpanded = String(canonicalOpen);
      lastBodyCollapsed = collapsedClass;
    } catch(_) {}
  }

  function setVisibleClass(id, visible){
    const el = q(id);
    if (!el) return;
    try { el.classList.toggle('vis', !!visible); } catch(_) {}
  }

  function syncExamChromeDom(state){
    const inExam = state === 'exam';
    const inReview = state === 'exam-review';
    const inBiblioPractice = state === 'bibliografia2026-practice';
    const inVaccinesPractice = state === 'vaccines-practice';
    const inExamChrome = inExam || inReview || inBiblioPractice;
    const examEnded = state === 'exam-ended';
    const landing = state === 'landing';

    // El right panel y los stats son chrome de examen/revisión, no chrome de config ni landing.
    setVisibleClass('rightPanel', inExamChrome);
    setVisibleClass('statsBox', inExamChrome);
    setVisibleClass('navBox', inExamChrome);
    // El rachaBox flotante es chrome exclusivo del examen oficial: en Bibliografía 2026
    // la racha ya se muestra dentro de statsBox, así que acá no debe activarse (evita duplicado).
    setVisibleClass('rachaBox', inExam && !inVaccinesPractice && !examEnded && !landing);

    try {
      const filterMarked = q('btnFilterMarked');
      if (filterMarked && !inExamChrome) filterMarked.style.display = 'none';
    } catch(_) {}
  }

  function setSidebarCollapsed(collapsed, persist){
    const next = !!collapsed;
    if (next === sidebarCollapsed && lastBodyCollapsed === (!sidebarAllowed() || next)) return sidebarCollapsed;
    sidebarCollapsed = next;
    if (sidebarAllowed()) {
      setMoving();
      lastBodyCollapsed = null;
      lastSidebarAriaExpanded = null;
      syncSidebarDom(deriveState());
      if (persist) writeText(RESIAR_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } else {
      syncSidebarDom('landing');
    }
    return sidebarCollapsed;
  }

  function hasAuthenticatedAppContext(){
    try { if (getCurrentUser()) return true; } catch(_) {}
    try { if (getCurrentProfile()) return true; } catch(_) {}
    try { if (body().classList.contains('resiar-user-authenticated')) return true; } catch(_) {}
    return false;
  }

  function chatAccessAllowedForCurrentAccount(){
    let acceso = '';
    try { acceso = String(getServerAccess() || '').toLowerCase(); } catch(_) {}
    if (!acceso) {
      try { acceso = String(getCurrentProfile()?.plan || '').toLowerCase(); } catch(_) {}
    }
    if (!acceso) return true;
    return !['bloqueado','expirado','pro_expirado','sin_acceso','sin acceso'].includes(acceso);
  }

  function chatAllowed(state){
    state = normalizeState(state) || deriveState();
    if (!hasAuthenticatedAppContext() || state !== 'exam') return false;
    if (!chatAccessAllowedForCurrentAccount()) return false;
    if (window._resiarExamFinished === true) return false;
    if (window._resiarExamRunning === false && !questionRendered()) return false;
    if (modalFinalOpen() || domLooksPublicLanding()) return false;
    const arr = readExam();
    return Array.isArray(arr) && arr.length > 0 && questionRendered();
  }

  function removeLegacyChatControls(){
    try { body().classList.remove('resiar-exam-chat-stable','resiar-use-stable-chat-fab','resiar-chat-fab-visible'); } catch(_) {}
    ['qchatRescueFab','resiarStableChatFab'].forEach((id) => { try { q(id)?.remove(); } catch(_) {} });
  }

  function hideQuestionChat(){
    let hasChat = false;
    try { hasChat = !!document.querySelector('#qchatRoot,.qchat-root,.qinvite-toast,.qinvite-toast-wrap,#qchatRescueFab,#resiarStableChatFab'); } catch(_) {}
    if (chatHidden && !hasChat) return;
    removeLegacyChatControls();
    try { const fn = getQuestionChatFunction('questionChatClose'); if (typeof fn === 'function') fn(); } catch(_) {}
    try { const fn = getQuestionChatFunction('questionChatDisconnect'); if (typeof fn === 'function') fn(); } catch(_) {}
    try { document.querySelectorAll('#qchatRoot,.qchat-root,.qinvite-toast,.qinvite-toast-wrap').forEach((el) => el.remove()); } catch(_) {}
    lastChatKey = '';
    chatHidden = true;
  }

  function ensureQuestionChat(state){
    if (!chatAllowed(state)) { hideQuestionChat(); return false; }
    chatHidden = false;
    removeLegacyChatControls();
    const p = currentQuestion();
    if (!p) { hideQuestionChat(); return false; }
    try {
      const dockHtml = getQuestionChatFunction('questionChatDockHtml');
      if (!q('qchatRoot') && typeof dockHtml === 'function') {
        document.body.insertAdjacentHTML('beforeend', dockHtml(p));
      }
      const roots = Array.from(document.querySelectorAll('#qchatRoot,.qchat-root'));
      const keep = roots[roots.length - 1] || null;
      roots.forEach((r) => { if (r !== keep) r.remove(); });
      if (keep && keep.parentElement !== document.body) document.body.appendChild(keep);
      let key = '';
      try { const keyFn = getQuestionChatFunction('questionChatQuestionKey'); key = typeof keyFn === 'function' ? keyFn(p) : String(p.id || ''); } catch(_) {}
      const now = Date.now();
      const mustSync = key !== lastChatKey || (now - lastChatSyncAt > 2500);
      const afterRender = getQuestionChatFunction('questionChatAfterRender');
      if (mustSync && typeof afterRender === 'function') {
        lastChatKey = key;
        lastChatSyncAt = now;
        afterRender();
      } else {
        try { const fn = getQuestionChatFunction('questionChatUpdateOffsets'); if (typeof fn === 'function') fn(); } catch(_) {}
        try { const fn = getQuestionChatFunction('questionChatPaint'); if (typeof fn === 'function') fn(); } catch(_) {}
      }
      [q('qchatRoot'), q('qchatFab'), q('qchatWindow')].forEach((el) => {
        if (!el) return;
        try {
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
          el.style.removeProperty('opacity');
          el.style.removeProperty('pointer-events');
          el.style.removeProperty('transform');
          el.style.removeProperty('animation');
        } catch(_) {}
      });
      return true;
    } catch(e) {
      console.warn('resiar question chat sync:', e);
      return false;
    }
  }


  function hasRunningExam(){
    try {
      const arr = readExam();
      if (!Array.isArray(arr) || arr.length === 0) return false;
      if (window._resiarExamFinished === true) return false;
      if (modalFinalOpen() || domLooksPublicLanding()) return false;
      return window._resiarExamRunning === true || questionRendered();
    } catch(_) { return false; }
  }

  function markExamRuntime(options = {}){
    try {
      if (!hasRunningExam()) return false;
      window._resiarExamRunning = true;
      window._resiarExamFinished = false;
      applyState('exam', { chat: options.chat !== false });
      return true;
    } catch(_) { return false; }
  }

  function showStudyStreak(){
    try {
      const fn = getFunction('mostrarRachaDias');
      if (typeof fn === 'function') fn({ source: 'exam-start' });
    } catch(e) { console.warn('resiar exam runtime streak:', e); }
  }

  function ensureExamRuntime(options = {}){
    const active = markExamRuntime({ chat: false });
    if (active) {
      try { ensureQuestionChat('exam'); } catch(_) {}
      if (options.showStreak !== false) showStudyStreak();
    } else {
      try { syncState(); } catch(_) {}
    }
    return active;
  }

  function cleanExamChromeIfNoRenderedExam(){
    try {
      const arr = readExam();
      if (Array.isArray(arr) && arr.length > 0 && questionRendered() && window._resiarExamFinished !== true) {
        applyState('exam');
        return false;
      }
    } catch(_) {}
    try { window._resiarExamRunning = false; window._resiarExamFinished = true; } catch(_) {}
    applyState('config');
    hideQuestionChat();
    return true;
  }

  function markLayoutReady(){
    if (layoutReady) return;
    layoutReady = true;
    requestAnimationFrame(() => {
      try {
        body().classList.remove('resiar-initializing-view');
        body().classList.add('resiar-layout-ready');
      } catch(_) {}
    });
  }

  function applyState(kind, options){
    const explicit = normalizeState(kind);
    let state = explicit || deriveState();
    const logged = isLogged();
    if (state === 'config' && renderedExamActive()) state = 'exam';
    if (state === 'exam' && (window._resiarExamFinished === true || modalFinalOpen())) state = 'exam-ended';
    if (state === 'exam-review' && !questionRendered()) state = 'exam-ended';
    if (!logged || state === 'landing' || domLooksPublicLanding()) state = 'landing';
    applying = true;
    try {
      const isLanding = !logged || state === 'landing';
      const isBiblioHome = state === 'bibliografia2026';
      const isBiblioPractice = state === 'bibliografia2026-practice';
      const isVaccinesPractice = state === 'vaccines-practice';
      const isConfigLike = state === 'config' || isBiblioHome || isVaccinesPractice;
      const isExamLike = state === 'exam' || state === 'exam-review' || isBiblioPractice;
      if (body().dataset.resiarView !== state) body().dataset.resiarView = state;
      body().classList.toggle('resiar-user-authenticated', logged);
      body().classList.toggle('resiar-public-landing', isLanding);
      body().classList.toggle('resiar-config-home', logged && isConfigLike);
      body().classList.toggle('resiar-in-simulator', logged && isExamLike);
      body().classList.toggle('resiar-exam-ended', logged && state === 'exam-ended');
      body().classList.toggle('resiar-exam-review', logged && state === 'exam-review');
      body().classList.toggle('resiar-view-landing', state === 'landing');
      body().classList.toggle('resiar-view-config', isConfigLike);
      body().classList.toggle('resiar-view-exam', state === 'exam');
      body().classList.toggle('resiar-view-exam-review', state === 'exam-review');
      body().classList.toggle('resiar-view-exam-ended', state === 'exam-ended');
      body().classList.toggle('resiar-view-bibliografia2026', isBiblioHome);
      body().classList.toggle('resiar-view-bibliografia2026-practice', isBiblioPractice);
      body().classList.toggle('resiar-view-vaccines-practice', isVaccinesPractice);
      body().classList.toggle('resiar-vaccines-practice', isVaccinesPractice);
      body().classList.toggle('resiar-biblio-home', isBiblioHome);
      body().classList.toggle('resiar-biblio-practice', isBiblioPractice);
      if (!isBiblioPractice) {
        body().classList.remove('biblio-practice-active');
      }
      if (!isVaccinesPractice) {
        body().classList.remove('resiar-vaccines-practice');
      }
      syncSidebarDom(state);
      syncExamChromeDom(state);
      if (isLanding && typeof window.resiarSetWhatsAppVisible === 'function') {
        try { window.resiarSetWhatsAppVisible(true); } catch(_) {}
      } else if (typeof window.resiarSetWhatsAppVisible === 'function') {
        try { window.resiarSetWhatsAppVisible(false); } catch(_) {}
      }
    } finally {
      applying = false;
    }
    markLayoutReady();
    if (!options || options.chat !== false) {
      if (state === 'exam') requestAnimationFrame(() => { ensureQuestionChat(state); });
      else if (lastAppliedState !== state || !chatHidden) hideQuestionChat();
    }
    lastAppliedState = state;
    return state;
  }

  function syncState(){ return applyState('', {sync:true}); }
  function scheduleSync(){
    if (applying || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; syncState(); });
  }
  function scheduleDelayedSync(ms){
    clearTimeout(delayedSyncTimer);
    delayedSyncTimer = setTimeout(scheduleSync, ms || 120);
  }

  const api = {
    applyState,
    syncState,
    scheduleSync,
    setSidebarCollapsed,
    sidebarAllowed,
    chatAllowed,
    ensureQuestionChat,
    hideQuestionChat,
    ensureExamRuntime,
    cleanExamChromeIfNoRenderedExam
  };

  window.resiarSetSidebarCollapsed = setSidebarCollapsed;
  window.resiarSyncSidebarForView = syncSidebarDom;
  window.resiarQuestionChatAllowed = chatAllowed;
  window.resiarSyncQuestionChat = ensureQuestionChat;
  window.resiarResyncQuestionChatSoon = function(){
    try { requestAnimationFrame(() => { ensureQuestionChat('exam'); }); } catch(_) {}
    try { setTimeout(() => { ensureQuestionChat('exam'); }, 180); } catch(_) {}
    try { setTimeout(() => { ensureQuestionChat('exam'); }, 650); } catch(_) {}
  };
  window.resiarEnsureExamRuntime = ensureExamRuntime;
  window.resiarEnsureQuestionChat = function(){ return ensureQuestionChat(hasRunningExam() ? 'exam' : undefined); };
  window.resiarCleanExamChromeIfNoRenderedExam = cleanExamChromeIfNoRenderedExam;
  window.resiarSetViewState = applyState;
  window.resiarMarkViewState = applyState;
  window.resiarSyncViewState = syncState;
  window.resiarIsPublicLandingVisible = function(){ return !isLogged() || deriveState() === 'landing'; };
  window.toggleSidebar = function(){
    const state = deriveState();
    if (!sidebarAllowed(state)) {
      applyState('landing');
      return false;
    }
    return setSidebarCollapsed(!sidebarCollapsed, true);
  };

  const delayedAfter = {
    onLogin:160,
    onLogout:160,
    resiarShowPublicLandingAfterLogout:160,
    resiarRenderHome:100,
    mostrarPantallaBienvenida:100,
    mostrarPantallaBloqueo:100,
    irAConfigurarNuevoExamen:100,
    iniciar:140,
    iniciarExamenInteligente:140,
    iniciarRepaso:140,
    crearDesafio:140,
    unirseDesafio:140,
    finalizar:140
  };
  const examStartAfter = {
    iniciar:true,
    iniciarExamenInteligente:true,
    iniciarRepaso:true,
    crearDesafio:true,
    unirseDesafio:true
  };

  function configHomeVisible(){
    try {
      if (renderedExamActive()) return false;
      return deriveState() === 'config' || !!q('preguntaBox')?.querySelector('.home-sim,.home-hero-card,#welcome.home-sim');
    } catch(_) { return false; }
  }

  function runExamStartAfter(name, wasConfig){
    try {
      requestAnimationFrame(() => {
        try {
          if (typeof window.resiarEnsureExamRuntime === 'function') {
            window.resiarEnsureExamRuntime({ showStreak:true });
          } else {
            applyState('exam');
          }
        } catch(_) {}
      });
    } catch(_) {}
    if (wasConfig && typeof window.resiarCleanExamChromeIfNoRenderedExam === 'function') {
      setTimeout(() => { try { if (configHomeVisible()) window.resiarCleanExamChromeIfNoRenderedExam(); } catch(_) {} }, 0);
      setTimeout(() => { try { if (configHomeVisible()) window.resiarCleanExamChromeIfNoRenderedExam(); } catch(_) {} }, 180);
    }
  }

  function wrapAfter(name){
    const fn = getFunction(name) || window[name];
    if (typeof fn !== 'function' || fn.__resiarViewStateWrapped) return;
    const wrapped = function(){
      const wasConfig = examStartAfter[name] ? configHomeVisible() : false;
      const out = fn.apply(this, arguments);
      Promise.resolve(out).finally(() => {
        if (examStartAfter[name]) runExamStartAfter(name, wasConfig);
        scheduleSync();
        if (['render','iniciar','iniciarExamenInteligente','iniciarRepaso','next','prev','irDesdeNav','responder'].includes(name)) {
          try { if (typeof window.resiarResyncQuestionChatSoon === 'function') window.resiarResyncQuestionChatSoon(name); } catch(_) {}
        }
        if (delayedAfter[name]) scheduleDelayedSync(delayedAfter[name]);
      });
      return out;
    };
    wrapped.__resiarViewStateWrapped = true;
    window[name] = wrapped;
    try { setFunction(name, wrapped); } catch(_) {}
  }

  [
    'renderUserUI','onLogin','onLogout','resiarShowPublicLandingAfterLogout','resiarRenderHome','mostrarPantallaBienvenida','mostrarPantallaBloqueo','irAConfigurarNuevoExamen','render','iniciar','iniciarExamenInteligente','iniciarRepaso','crearDesafio','unirseDesafio','finalizar','next','prev','irDesdeNav','responder'
  ].forEach(wrapAfter);

  document.addEventListener('click', function(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('.sb-toggle-edge') : null;
    if (btn && !sidebarAllowed()) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
      applyState('landing');
      return false;
    }
    const chatFab = ev.target && ev.target.closest ? ev.target.closest('#qchatFab') : null;
    if (chatFab && !chatAllowed('exam')) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
      hideQuestionChat();
      return false;
    }
  }, true);

  document.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        window.toggleSidebar();
      }
    }
  }, true);

  document.addEventListener('DOMContentLoaded', syncState);
  window.addEventListener('load', scheduleSync);
  window.addEventListener('resize', scheduleSync);
  syncState();
  scheduleDelayedSync(180);

  window.__resiarViewStateControllerApi = api;
  return api;
}
