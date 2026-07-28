const DEFAULT_LOADING_PHRASES = [
  'Cargando banco de preguntas…',
  'Preparando simulador de residencias…',
  'Cargando preguntas de clínica médica…',
  'Cargando preguntas de cirugía…',
  'Cargando preguntas de pediatría…',
  'Cargando preguntas de ginecología…',
  'Cargando preguntas de guardia…',
  'Sincronizando EU, CABA, Pcia. BA, MIR, ENARM…',
  'Listo para entrenar…',
];

export function configureLoadingScreens(options = {}) {
  const getPreguntaBox = typeof options.getPreguntaBox === 'function'
    ? options.getPreguntaBox
    : () => document.getElementById('preguntaBox');
  const markViewState = typeof options.markViewState === 'function'
    ? options.markViewState
    : null;
  const loadingPhrases = Array.isArray(options.loadingPhrases) && options.loadingPhrases.length
    ? options.loadingPhrases
    : DEFAULT_LOADING_PHRASES;

  let loadingPhraseIdx = 0;
  let loadingPhraseTimer = null;
  let loadingStateObserver = null;

  function deactivateLoadingState() {
    try { document.body.classList.remove('resiar-auth-loading', 'resiar-loading-active', 'resiar-auth-clicking'); } catch (_) {}
    try { document.documentElement.classList.remove('resiar-oauth-returning'); } catch (_) {}
    try {
      if (loadingStateObserver) loadingStateObserver.disconnect();
      loadingStateObserver = null;
    } catch (_) {}
    try {
      if (window._resiarLoadingWatchdog) {
        clearTimeout(window._resiarLoadingWatchdog);
        window._resiarLoadingWatchdog = null;
      }
    } catch (_) {}
  }

  function activateLoadingState() {
    try { document.body.classList.add('resiar-auth-loading', 'resiar-loading-active'); } catch (_) {}
    try {
      if (loadingStateObserver) loadingStateObserver.disconnect();
      const box = getPreguntaBox();
      if (!box || typeof MutationObserver === 'undefined') return;
      loadingStateObserver = new MutationObserver(() => {
        if (!box.querySelector('.loading-screen')) deactivateLoadingState();
      });
      // subtree:true ensures detection even when preguntaBox has overflow:hidden on mobile
      loadingStateObserver.observe(box, { childList: true, subtree: true });
    } catch (_) {}

    // Safety watchdog: if MutationObserver fails to fire on mobile (e.g. due to
    // overflow:hidden blocking reflow events), force deactivation after 30s max.
    try {
      if (window._resiarLoadingWatchdog) clearTimeout(window._resiarLoadingWatchdog);
      window._resiarLoadingWatchdog = setTimeout(() => {
        try {
          const box = getPreguntaBox();
          if (box && !box.querySelector('.loading-screen')) {
            deactivateLoadingState();
          } else if (box && box.querySelector('.loading-screen')) {
            // Still stuck — force remove and deactivate
            const screens = box.querySelectorAll('.loading-screen');
            screens.forEach(el => el.remove());
            deactivateLoadingState();
          }
        } catch (_) {}
      }, 30000);
    } catch (_) {}
  }

  function mostrarPantallaBloqueo(plan) {
    try { if (markViewState) markViewState('config'); } catch (_) {}
    deactivateLoadingState();

    const preguntaBox = getPreguntaBox();
    if (!preguntaBox) return;

    const contacto = `<a href="mailto:resiar.soporte@gmail.com" style="color:var(--accent);text-decoration:none;">resiar.soporte@gmail.com</a>`;
    const mensaje = plan === 'pro_expirado'
      ? `Tu plan <strong>Pro</strong> venció. Escribinos a ${contacto} para renovarlo.`
      : plan === 'sin_acceso' || plan === 'bloqueado'
      ? `Tu cuenta no tiene acceso activo.<br>Si creés que es un error, escribinos a ${contacto}.`
      : `Tu plan actual (<strong>${plan}</strong>) no tiene acceso a las preguntas. Escribinos a ${contacto}.`;

    preguntaBox.innerHTML = `
      <div class="welcome-simple">
        <div class="wicon">🔒</div>
        <div class="wtitle" style="opacity:0.85;">Acceso restringido</div>
        <div class="wsub-lg" style="max-width:340px;line-height:1.6;">${mensaje}</div>
      </div>`;
  }

  function mostrarPantallaCargando() {
    const preguntaBox = getPreguntaBox();
    if (!preguntaBox) return;

    activateLoadingState();
    try {
      document.body?.classList.remove('resiar-auth-clicking');
      document.documentElement.classList.remove('resiar-oauth-returning');
    } catch (_) {}
    preguntaBox.innerHTML = `
      <div class="loading-screen" role="status" aria-live="polite">
        <div class="loading-card">
          <div class="loading-orbit" aria-hidden="true">
            <span class="loading-orbit-ring loading-orbit-ring-a"></span>
            <span class="loading-orbit-ring loading-orbit-ring-b"></span>
            <span class="loading-logo">🧠</span>
          </div>
          <div class="loading-kicker">Simulador de residencias médicas</div>
          <div class="loading-title">Preparando tu simulador</div>
          <div class="loading-phrase" id="loadingPhrase">${loadingPhrases[0]}</div>
          <div class="loading-bar-wrap"><div class="loading-bar" id="loadingBar"></div></div>
          <div class="loading-meta">
            <span>EU · CABA · Pcia. BA · MIR · ENARM</span>
            <strong id="loadingPct">0%</strong>
          </div>
        </div>
      </div>`;

    loadingPhraseIdx = 0;
    clearInterval(loadingPhraseTimer);
    loadingPhraseTimer = setInterval(() => {
      const el = document.getElementById('loadingPhrase');
      if (!el) {
        clearInterval(loadingPhraseTimer);
        return;
      }
      el.classList.add('fade');
      setTimeout(() => {
        loadingPhraseIdx = (loadingPhraseIdx + 1) % loadingPhrases.length;
        el.textContent = loadingPhrases[loadingPhraseIdx];
        el.classList.remove('fade');
      }, 400);
    }, 2200);
  }

  function setLoadingProgress(pct) {
    const safePct = Math.max(0, Math.min(100, Number(pct) || 0));
    const bar = document.getElementById('loadingBar');
    const lbl = document.getElementById('loadingPct');
    if (bar) bar.style.width = safePct + '%';
    if (lbl) lbl.textContent = safePct + '%';
  }

  function stopLoadingRotation() {
    clearInterval(loadingPhraseTimer);
    loadingPhraseTimer = null;
    deactivateLoadingState();
  }

  return {
    mostrarPantallaBloqueo,
    mostrarPantallaCargando,
    setLoadingProgress,
    stopLoadingRotation,
  };
}
