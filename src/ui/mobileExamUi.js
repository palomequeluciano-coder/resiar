// v117 - UI móvil/tablet de examen desacoplada del DOM de escritorio.
// No depende de botones desktop ocultos: usa una API explícita publicada por main.js.

const MOBILE_QUERY = '(max-width: 1180px), (max-width: 1366px) and (pointer: coarse)';
const PHONE_QUERY = '(max-width: 720px)';

let installed = false;
let mqMobile = null;
let mqPhone = null;
let observer = null;
let syncTimer = null;
let lastViewportMode = null;
let lastViewportHeight = 0;

function updateViewportVars() {
  try {
    const vv = window.visualViewport;
    const height = Math.max(320, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0));
    const width = Math.max(280, Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0));
    const offsetTop = Math.max(0, Math.round(vv?.offsetTop || 0));
    const bottomInset = Math.max(0, Math.round((window.innerHeight || height) - height - offsetTop));
    const keyboardOpen = !!(window.innerHeight && height < window.innerHeight * 0.78);

    document.documentElement.style.setProperty('--resiar-vh', `${height}px`);
    document.documentElement.style.setProperty('--resiar-vw', `${width}px`);
    document.documentElement.style.setProperty('--resiar-visual-bottom-gap', `${bottomInset}px`);

    const touchLike = isTouchLikeDevice();
    const sidebarBase = width > 720 && touchLike ? 560 : 360;
    const sidebarWidth = Math.max(300, Math.min(sidebarBase, Math.round(width * 0.92), Math.max(0, width - 14)));
    document.documentElement.style.setProperty('--resiar-sidebar-mobile-w', `${sidebarWidth}px`);
    document.body.classList.toggle('resiar-keyboard-open', keyboardOpen);
    lastViewportHeight = height;

    // v123: el examen móvil no puede depender del scroll del body.
    // En varios navegadores móviles el root mantiene overflow/height heredados
    // del layout desktop o de la landing. Por eso calculamos un alto real
    // para #preguntaBox y lo convertimos en el scroller del enunciado/opciones.
    updateExamScrollVars(height, offsetTop, bottomInset);
  } catch (_) {}
}

function updateExamScrollVars(viewportHeight, viewportOffsetTop = 0, bottomInset = 0) {
  try {
    const box = document.getElementById('preguntaBox');
    if (!box) return;

    const bar = document.getElementById('resiarMobileExamBar');
    const barRect = bar?.getBoundingClientRect?.();
    const barHeight = barRect && barRect.height > 0 ? Math.ceil(barRect.height) : 68;
    const bottomReserve = Math.max(86, barHeight + 22 + Math.max(0, bottomInset));

    const rect = box.getBoundingClientRect();
    const top = Math.max(0, Math.round(rect.top - viewportOffsetTop));
    const available = Math.max(260, Math.round(viewportHeight - top - bottomReserve));

    document.documentElement.style.setProperty('--resiar-exam-scroll-h', `${available}px`);
    document.documentElement.style.setProperty('--resiar-exam-scroll-bottom-reserve', `${bottomReserve}px`);
  } catch (_) {}
}

function qs(sel) {
  try { return document.querySelector(sel); } catch (_) { return null; }
}

function runtime() {
  try { return window.resiarExamMobileRuntime || null; } catch (_) { return null; }
}

function isTouchLikeDevice() {
  try {
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) return true;
    if (window.matchMedia?.('(pointer: coarse)')?.matches) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(String(navigator.userAgent || ''))) return true;
  } catch (_) {}
  return false;
}

function isMobileViewport() {
  try {
    if (mqMobile?.matches) return true;
    const width = Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    // Android/iOS con "ver como sitio de escritorio" puede reportar un viewport ancho,
    // pero sigue siendo una superficie táctil chica. Lo tratamos como mobile/tablet
    // para que la sidebar sea overlay y no vuelva al layout de PC.
    if (isTouchLikeDevice() && width <= 1460) return true;
  } catch (_) {}
  return false;
}

function isPhoneViewport() {
  try { return !!mqPhone?.matches; } catch (_) { return false; }
}

function getBiblioState() {
  // Obtiene estado de navegación de bibliografía 2026 y vacunas
  // leyendo los dots del panel derecho o los atributos de navegación
  try {
    // Intentar leer desde la API de bibliografía si está disponible
    const biblioApi = window.resiarBiblioRuntime || window._resiarBiblioApi;
    if (biblioApi && typeof biblioApi.getState === 'function') {
      const s = biblioApi.getState();
      if (s && s.total > 0) return s;
    }
  } catch (_) {}

  try {
    // Fallback: leer del DOM
    const dots = document.querySelectorAll('#rpNavGrid .rp-qnav-dot, #rpNavGrid [class*="qnav-dot"]');
    const total = dots.length;
    let current = 1;
    dots.forEach((dot, i) => {
      if (dot.classList.contains('actual')) current = i + 1;
    });
    const progressText = document.getElementById('rpProgressText')?.textContent || '';
    const pmatch = progressText.match(/(\d+)\s*de\s*(\d+)/);
    const answered = pmatch ? Number(pmatch[1]) : 0;
    const tot = pmatch ? Number(pmatch[2]) : total;
    return {
      active: true,
      current,
      total: tot || total,
      answered,
      label: tot ? `${current}/${tot}` : (total ? `${current}/${total}` : 'Mapa'),
      canPrev: current > 1,
      canNext: current < (tot || total),
      canFinish: true,
      finishLabel: 'Fin',
      isReviewMode: false,
      isBiblioMode: true
    };
  } catch (_) {}
  return null;
}

function getRuntimeState() {
  const api = runtime();
  try {
    if (api && typeof api.getState === 'function') {
      const state = api.getState();
      if (state && typeof state === 'object') return state;
    }
  } catch (_) {}

  // Para bibliografía y vacunas, leer el estado del DOM
  if (isBiblioOrVaccinesActive()) {
    const bs = getBiblioState();
    if (bs) return bs;
  }

  const raw = qs('#preguntaBox .qcount')?.textContent || qs('.qcount')?.textContent || '';
  const match = String(raw).match(/(\d+)\s*\/\s*(\d+)/);
  const current = match ? Number(match[1]) : null;
  const total = match ? Number(match[2]) : null;
  return {
    active: !!(qs('#preguntaBox .resiar-exam-question') || qs('#preguntaBox .biblio-official-question')),
    current,
    total,
    label: current && total ? `${current}/${total}` : 'Mapa',
    canPrev: current ? current > 1 : false,
    canNext: current && total ? current < total : false,
    canFinish: true,
    finishLabel: 'Fin',
    isReviewMode: false
  };
}

function isBiblioOrVaccinesActive() {
  // Bibliografía 2026 y Vacunas usan el mismo layout de pregunta
  // pero no activan _resiarExamRunning — los detectamos por body classes
  try {
    const b = document.body;
    if (b.classList.contains('biblio-practice-active')) return true;
    if (b.classList.contains('resiar-biblio-practice')) return true;
    if (b.classList.contains('resiar-vaccines-practice')) return true;
    if (b.classList.contains('resiar-view-vaccines-practice')) return true;
    const view = String(b.dataset?.resiarView || '').toLowerCase();
    if (view === 'bibliografia2026-practice') return true;
    if (view === 'vaccines-practice') return true;
    if (qs('#preguntaBox .biblio-official-question')) return true;
  } catch (_) {}
  return false;
}

function isExamActive() {
  try {
    // Bibliografía y vacunas siempre activas cuando tienen su clase
    if (isBiblioOrVaccinesActive()) return true;
  } catch (_) {}

  try {
    const state = getRuntimeState();
    if (state && state.active === false) return false;
    if (state && state.total > 0) return true;
  } catch (_) {}

  try {
    if (document.body.classList.contains('resiar-exam-render-active')) return true;
    if (document.body.classList.contains('resiar-view-exam')) return true;
    if (document.body.dataset.resiarView === 'exam') return true;
    if (window._resiarExamRunning && window._resiarExamFinished !== true) return true;
    return !!qs('#preguntaBox .resiar-exam-question');
  } catch (_) {
    return false;
  }
}

function isLandingView() {
  // v122: el DOM de la landing puede quedar montado aunque estemos en examen.
  // La detección de landing no debe basarse solo en que exista #welcome/.landing-root,
  // porque eso activa reglas de scroll de landing sobre el examen móvil.
  try {
    if (isExamActive()) return false;

    const state = String(document.body?.dataset?.resiarView || '').toLowerCase();
    if (state === 'landing') return true;
    if (state && state !== 'landing') return false;

    const body = document.body;
    const publicLanding = body.classList.contains('resiar-public-landing');
    const authenticated = body.classList.contains('resiar-user-authenticated');
    if (publicLanding && !authenticated) return true;

    const landingRoot = document.querySelector('.landing-root, #welcome .lp-hero, #welcome .lp-nav');
    if (!landingRoot) return false;
    const rect = landingRoot.getBoundingClientRect?.();
    return !!rect && rect.width > 0 && rect.height > 0 && !authenticated;
  } catch (_) {}
  return false;
}

function isLeftSidebarOpen() {
  try {
    const aside = qs('body > aside.visible, aside.visible');
    if (!aside) return false;
    const rect = aside.getBoundingClientRect();
    return rect.width > 40 && rect.height > 120;
  } catch (_) {
    return false;
  }
}

function ensureChrome() {
  let bar = document.getElementById('resiarMobileExamBar');
  if (!bar) {
    bar = document.createElement('nav');
    bar.id = 'resiarMobileExamBar';
    bar.className = 'resiar-mobile-exam-bar';
    bar.setAttribute('aria-label', 'Navegación del examen');
    bar.innerHTML = `
      <button type="button" class="rmeb-btn rmeb-prev" data-mobile-exam-action="prev" aria-label="Pregunta anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button type="button" class="rmeb-btn rmeb-map" data-mobile-exam-action="panel" aria-label="Abrir mapa de preguntas">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span class="rmeb-count">—</span>
      </button>
      <button type="button" class="rmeb-btn rmeb-tools" data-mobile-exam-action="tools" aria-label="Abrir herramientas">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 1.41 14.14"/><path d="M4.93 4.93a10 10 0 0 0-1.41 14.14"/></svg>
        <span class="rmeb-tools-label">Herr.</span>
      </button>
      <button type="button" class="rmeb-btn rmeb-finish" data-mobile-exam-action="finish" aria-label="Finalizar examen">Fin</button>
      <button type="button" class="rmeb-btn rmeb-next" data-mobile-exam-action="next" aria-label="Pregunta siguiente">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    `;
    document.body.appendChild(bar);
  }

  let scrim = document.getElementById('resiarMobileExamScrim');
  if (!scrim) {
    scrim = document.createElement('button');
    scrim.id = 'resiarMobileExamScrim';
    scrim.className = 'resiar-mobile-exam-scrim';
    scrim.type = 'button';
    scrim.setAttribute('aria-label', 'Cerrar panel');
    document.body.appendChild(scrim);
  }

  // Tools drawer — separado del panel de mapa
  let drawer = document.getElementById('resiarMobileToolsDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'resiarMobileToolsDrawer';
    drawer.className = 'resiar-tools-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Herramientas del examen');
    drawer.innerHTML = `
      <div class="rtd-handle"></div>
      <div class="rtd-header">
        <span class="rtd-title">Herramientas</span>
        <button class="rtd-close" data-mobile-exam-action="close-tools" aria-label="Cerrar herramientas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="rtd-body">
        <button class="rtd-tool-btn rtd-nota" data-mobile-exam-action="open-nota" aria-label="Agregar o ver nota">
          <span class="rtd-tool-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </span>
          <span class="rtd-tool-text">
            <b class="rtd-nota-label">Mis notas</b>
            <small>Apuntes sobre esta pregunta</small>
          </span>
          <span class="rtd-tool-arrow">›</span>
        </button>
        <button class="rtd-tool-btn rtd-report" data-mobile-exam-action="open-report" aria-label="Reportar pregunta">
          <span class="rtd-tool-icon rtd-icon-report">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="rtd-tool-text">
            <b>Reportar error</b>
            <small>Error en enunciado u opciones</small>
          </span>
          <span class="rtd-tool-arrow">›</span>
        </button>
        <button class="rtd-tool-btn rtd-guide" data-mobile-exam-action="open-guide" aria-label="Guía clínica">
          <span class="rtd-tool-icon rtd-icon-guide">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </span>
          <span class="rtd-tool-text">
            <b>Guía clínica</b>
            <small>Referencia rápida del tema</small>
          </span>
          <span class="rtd-tool-arrow">›</span>
        </button>
      </div>
    `;
    document.body.appendChild(drawer);
  }
}

function openToolsDrawer() {
  ensureChrome();
  const drawer = document.getElementById('resiarMobileToolsDrawer');
  const scrim = document.getElementById('resiarMobileExamScrim');
  if (drawer) {
    drawer.classList.add('open');
    document.body.classList.add('resiar-mobile-layer-open');
  }
  if (scrim) scrim.classList.add('tools-scrim');
  // Sync nota label
  try {
    const api = runtime();
    if (api && typeof api.getState === 'function') {
      const state = api.getState();
      const hasNota = !!(state && state.currentHasNota);
      const drawerNota = drawer?.querySelector('.rtd-nota-label');
      if (drawerNota) drawerNota.textContent = hasNota ? '📝 Ver mi nota' : '📝 Agregar nota';
      const notaBtn = drawer?.querySelector('.rtd-nota');
      if (notaBtn) notaBtn.classList.toggle('has-nota', hasNota);
    }
  } catch (_) {}
}

function closeToolsDrawer() {
  const drawer = document.getElementById('resiarMobileToolsDrawer');
  const scrim = document.getElementById('resiarMobileExamScrim');
  if (drawer) drawer.classList.remove('open');
  if (scrim) scrim.classList.remove('tools-scrim');
  if (!document.body.classList.contains('resiar-mobile-panel-open')) {
    document.body.classList.remove('resiar-mobile-layer-open');
  }
}

function openPanel(mode = 'map') {
  if (!isMobileViewport() || !isExamActive() || isLeftSidebarOpen()) return;
  ensureChrome();
  document.body.classList.add('resiar-mobile-panel-open', 'resiar-mobile-layer-open');
  // biblio también necesita su clase para que el scrim aparezca
  if (isBiblioOrVaccinesActive()) {
    document.body.classList.add('resiar-biblio-panel-open');
  }
  document.body.classList.toggle('resiar-mobile-tools-open', mode === 'tools');
  const panel = document.getElementById('rightPanel');
  if (panel) {
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', isBiblioOrVaccinesActive()
      ? 'Mapa de preguntas'
      : 'Mapa y herramientas del examen');
  }
}

function closePanel() {
  document.body.classList.remove(
    'resiar-mobile-panel-open',
    'resiar-mobile-layer-open',
    'resiar-mobile-tools-open',
    'resiar-biblio-panel-open'
  );
  const panel = document.getElementById('rightPanel');
  if (panel) {
    panel.removeAttribute('aria-modal');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-label');
  }
}

function togglePanel() {
  if (document.body.classList.contains('resiar-mobile-panel-open')) closePanel();
  else openPanel('map');
}

function runRuntimeAction(action) {
  // Primero intentar con la API estándar del examen
  const api = runtime();
  if (api) {
    try {
      if (action === 'prev' && typeof api.prev === 'function') { api.prev(); return true; }
      if (action === 'next' && typeof api.next === 'function') { api.next(); return true; }
      if (action === 'finish' && typeof api.finish === 'function') { api.finish(); return true; }
    } catch (error) {
      console.warn('[ResiAR] Error ejecutando acción móvil de examen:', error);
    }
  }

  // Bibliografía 2026 y vacunas: usar data-biblio-action buttons del DOM
  if (isBiblioOrVaccinesActive()) {
    try {
      if (action === 'prev') {
        const btn = document.querySelector('[data-biblio-action="prev"], [data-vaccine-action="prev"], .biblio-nav-prev, .nav-prev-btn');
        if (btn) { btn.click(); return true; }
        // Fallback: simular click en dot anterior
        const dots = document.querySelectorAll('#rpNavGrid .rp-qnav-dot');
        const actualIdx = Array.from(dots).findIndex(d => d.classList.contains('actual'));
        if (actualIdx > 0) { dots[actualIdx - 1].click(); return true; }
      }
      if (action === 'next') {
        const btn = document.querySelector('[data-biblio-action="next"], [data-vaccine-action="next"], .biblio-nav-next, .nav-next-btn');
        if (btn) { btn.click(); return true; }
        // Fallback: simular click en dot siguiente
        const dots = document.querySelectorAll('#rpNavGrid .rp-qnav-dot');
        const actualIdx = Array.from(dots).findIndex(d => d.classList.contains('actual'));
        if (actualIdx >= 0 && actualIdx < dots.length - 1) { dots[actualIdx + 1].click(); return true; }
      }
      if (action === 'finish') {
        const btn = document.querySelector('[data-biblio-action="finish-exam"], [data-biblio-action="end"], [data-vaccine-action="finish"]');
        if (btn) { btn.click(); return true; }
      }
    } catch (e) {}
  }

  return false;
}

function syncChrome() {
  syncTimer = null;
  updateViewportVars();
  const mobile = isMobileViewport();
  const phone = isPhoneViewport();
  const exam = isExamActive();
  const leftSidebarOpen = mobile && isLeftSidebarOpen();

  const landing = isLandingView();
  const landingMobile = mobile && landing && !exam;
  const examMobile = mobile && exam;

  document.body.classList.toggle('resiar-mobile-ui', mobile);
  document.body.classList.toggle('resiar-mobile-desktop-site-ui', mobile && isTouchLikeDevice() && Math.round(window.visualViewport?.width || window.innerWidth || 0) > 720);
  document.body.classList.toggle('resiar-phone-ui', mobile && phone);
  document.body.classList.toggle('resiar-tablet-ui', mobile && !phone);
  document.body.classList.toggle('resiar-large-tablet-ui', mobile && !phone && window.matchMedia?.('(min-width: 1024px)')?.matches);
  // biblio/vacunas también activan el UI móvil de examen
  const biblioMobile = mobile && isBiblioOrVaccinesActive();
  document.body.classList.toggle('resiar-exam-mobile-ui', examMobile || biblioMobile);
  document.body.classList.toggle('resiar-landing-mobile-ui', landingMobile);
  document.documentElement.classList.toggle('resiar-mobile-scroll-root', landingMobile);
  document.body.classList.toggle('resiar-mobile-left-sidebar-open', leftSidebarOpen);

  if (examMobile) {
    document.documentElement.classList.remove('resiar-mobile-scroll-root');
    document.body.classList.remove('resiar-landing-mobile-ui', 'resiar-public-landing');
  }

  if (leftSidebarOpen) closePanel();

  if (!mobile || !exam) {
    closePanel();
    return;
  }

  ensureChrome();
  const bar = document.getElementById('resiarMobileExamBar');
  if (!bar) return;

  const state = getRuntimeState();
  const current = Number(state.current);
  const total = Number(state.total);
  const label = state.label || (Number.isFinite(current) && Number.isFinite(total) ? `${current}/${total}` : 'Mapa');

  const countEl = bar.querySelector('.rmeb-count');
  if (countEl) countEl.textContent = label;

  const prev = bar.querySelector('[data-mobile-exam-action="prev"]');
  const next = bar.querySelector('[data-mobile-exam-action="next"]');
  const finish = bar.querySelector('[data-mobile-exam-action="finish"]');
  const panel = bar.querySelector('[data-mobile-exam-action="panel"]');
  const tools = bar.querySelector('[data-mobile-exam-action="tools"]');

  if (prev) prev.disabled = state.canPrev === false;
  if (next) next.disabled = state.canNext === false;
  if (panel) panel.disabled = !total;
  if (tools) tools.disabled = !total;
  if (finish) {
    finish.hidden = state.canFinish === false;
    finish.textContent = state.finishLabel || (state.isReviewMode ? 'Volver' : 'Fin');
    finish.setAttribute('aria-label', state.isReviewMode ? 'Volver al resultado' : 'Finalizar examen');
  }
}

function scheduleSync() {
  if (syncTimer) return;
  syncTimer = window.setTimeout(syncChrome, 40);
}

function handleChromeClick(event) {
  const trigger = event.target?.closest?.('[data-mobile-exam-action]');
  if (!trigger) return;
  const action = trigger.dataset.mobileExamAction;
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();

  if (action === 'panel') { togglePanel(); return; }
  if (action === 'tools') { closePanel(); openToolsDrawer(); return; }
  if (action === 'close-tools') { closeToolsDrawer(); return; }

  if (action === 'open-nota') {
    closeToolsDrawer();
    try {
      const api = runtime();
      if (api && typeof api.toggleNotaDesdePanel === 'function') api.toggleNotaDesdePanel();
      else {
        const btn = document.getElementById('rpBtnNota');
        if (btn) btn.click();
      }
    } catch (_) {}
    return;
  }

  if (action === 'open-report') {
    closeToolsDrawer();
    try {
      const api = runtime();
      if (api && typeof api.abrirReporteActual === 'function') api.abrirReporteActual();
    } catch (_) {}
    return;
  }

  if (action === 'open-guide') {
    closeToolsDrawer();
    try {
      const btn = document.getElementById('resiarClinicalGuideButton');
      if (btn) btn.click();
    } catch (_) {}
    return;
  }

  if (action === 'prev' || action === 'next' || action === 'finish') {
    closePanel();
    closeToolsDrawer();
    runRuntimeAction(action);
    scheduleSync();
  }
}

function handleDocumentClick(event) {
  if (event.target?.id === 'resiarMobileExamScrim') {
    event.preventDefault();
    closePanel();
    closeToolsDrawer();
    return;
  }

  const panel = document.getElementById('rightPanel');
  if (!panel || !document.body.classList.contains('resiar-mobile-panel-open')) return;

  const navDot = event.target?.closest?.('#rightPanel [data-action="exam-go-question"], #rightPanel .rp-qnav-dot');
  if (navDot) {
    try {
      const raw = navDot.dataset.index ?? navDot.dataset.qindex ?? navDot.dataset.questionIndex ?? navDot.getAttribute('data-i');
      if (raw != null && runtime()?.goTo) runtime().goTo(Number(raw));
    } catch (_) {}
    if (isPhoneViewport()) window.setTimeout(closePanel, 120);
    return;
  }

  const opensExternalTool = event.target?.closest?.('#rightPanel [data-action="open-current-report"], #rightPanel #resiarClinicalGuideButton');
  if (opensExternalTool && isPhoneViewport()) {
    window.setTimeout(closePanel, 140);
  }
}

function handleKeyDown(event) {
  if (event.key === 'Escape') { closePanel(); closeToolsDrawer(); }
}

function handleViewportChange() {
  const mobile = isMobileViewport();
  const previous = lastViewportMode;
  lastViewportMode = mobile ? 'mobile' : 'desktop';
  closePanel();

  // Si el examen ya está renderizado y cambia el breakpoint, se re-renderiza
  // para que el árbol HTML corresponda al modo actual en lugar de esconder nodos.
  if (previous && previous !== lastViewportMode) {
    try {
      const api = runtime();
      if (api && typeof api.render === 'function' && isExamActive()) api.render();
    } catch (_) {}
  }

  scheduleSync();
}

function wire() {
  document.addEventListener('click', handleChromeClick, true);
  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-resiar-view', 'style', 'disabled']
  });
}

export function installMobileExamUi() {
  if (installed) return;
  installed = true;

  mqMobile = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : { matches: false, addEventListener() {}, removeEventListener() {} };
  mqPhone = window.matchMedia ? window.matchMedia(PHONE_QUERY) : { matches: false, addEventListener() {}, removeEventListener() {} };
  lastViewportMode = isMobileViewport() ? 'mobile' : 'desktop';

  try { mqMobile.addEventListener('change', handleViewportChange); } catch (_) {}
  try { mqPhone.addEventListener('change', scheduleSync); } catch (_) {}
  try { window.addEventListener('resize', scheduleSync, { passive: true }); } catch (_) {}
  try { window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true }); } catch (_) {}
  try { window.visualViewport?.addEventListener('scroll', scheduleSync, { passive: true }); } catch (_) {}
  try { window.addEventListener('orientationchange', () => setTimeout(handleViewportChange, 160), { passive: true }); } catch (_) {}

  wire();
  updateViewportVars();
  scheduleSync();
  setTimeout(scheduleSync, 300);
  setTimeout(scheduleSync, 1000);

  try {
    window.resiarSyncMobileExamUi = scheduleSync;
    window.resiarOpenMobileToolsDrawer = openToolsDrawer;
    window.resiarCloseMobileToolsDrawer = closeToolsDrawer;
    window.resiarCloseMobileExamPanel = closePanel;
    window.resiarShouldUseMobileExamUi = () => isMobileViewport();
  } catch (_) {}
}
