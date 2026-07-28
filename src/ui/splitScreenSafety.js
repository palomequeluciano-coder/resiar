// RESIAR v93 — Split screen focus mode
// Solución más fuerte pero segura para pantalla dividida.
// CSS + clases de viewport. No toca datos, sesiones, respuestas ni Supabase.

let installed = false;
let forcedSidebarCollapse = false;
let sidebarWasCollapsedBeforeForce = false;

function ensureSplitScreenSafetyStyle() {
  if (document.getElementById('resiar-split-screen-safe-ui-v93')) return;

  const style = document.createElement('style');
  style.id = 'resiar-split-screen-safe-ui-v93';
  style.textContent = `
    /*
      v93:
      En pantalla dividida real (~700-950 px), el sidebar social consume demasiado
      ancho. En ese rango se activa un modo foco: el examen usa todo el ancho.
      Es CSS-only y solo cuando body tiene resiar-in-simulator.
    */

    @media (max-width: 1100px) and (min-width: 681px) {
      body.resiar-in-simulator.resiar-split-screen-compact {
        overflow-x: hidden !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact *,
      body.resiar-in-simulator.resiar-split-screen-compact *::before,
      body.resiar-in-simulator.resiar-split-screen-compact *::after {
        box-sizing: border-box !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #app {
        max-width: 100vw !important;
        overflow-x: hidden !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact main,
      body.resiar-in-simulator.resiar-split-screen-compact #main,
      body.resiar-in-simulator.resiar-split-screen-compact [role="main"],
      body.resiar-in-simulator.resiar-split-screen-compact .main,
      body.resiar-in-simulator.resiar-split-screen-compact .main-content {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
        padding-left: clamp(8px, 1.6vw, 14px) !important;
        padding-right: clamp(8px, 1.6vw, 14px) !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #statsBox,
      body.resiar-in-simulator.resiar-split-screen-compact #preguntaBox,
      body.resiar-in-simulator.resiar-split-screen-compact #rachaBox,
      body.resiar-in-simulator.resiar-split-screen-compact #navBox,
      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #statsBox {
        overflow: hidden !important;
        border-radius: 16px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #statsBox .stat-pill,
      body.resiar-in-simulator.resiar-split-screen-compact #statsBox > * {
        min-width: 0 !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #statsBox .stat-v {
        font-size: clamp(.95rem, 2vw, 1.12rem) !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #statsBox .stat-l {
        font-size: .46rem !important;
        letter-spacing: .08em !important;
        white-space: nowrap !important;
      }

      /*
        Sidebar en ancho 951-1100:
        colapsar en rail chico, sin esconderlo del todo.
      */
      body.resiar-in-simulator.resiar-split-screen-compact:not(.resiar-split-screen-focus) aside {
        width: 72px !important;
        min-width: 72px !important;
        max-width: 72px !important;
        flex: 0 0 72px !important;
        overflow: hidden !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact:not(.resiar-split-screen-focus) aside .sb-panel,
      body.resiar-in-simulator.resiar-split-screen-compact:not(.resiar-split-screen-focus) aside .sb-section,
      body.resiar-in-simulator.resiar-split-screen-compact:not(.resiar-split-screen-focus) aside [class*="social"],
      body.resiar-in-simulator.resiar-split-screen-compact:not(.resiar-split-screen-focus) aside [id*="social"] {
        max-width: 64px !important;
        overflow: hidden !important;
      }

      /*
        Panel derecho debajo del examen:
        convertir navegación en chips compactos.
      */
      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        overflow: hidden !important;
        border-radius: 18px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel .rp-qnav-grid,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel .rp-qnav-grid {
        display: flex !important;
        flex-wrap: wrap !important;
        grid-template-columns: none !important;
        justify-content: flex-start !important;
        align-content: flex-start !important;
        gap: 6px !important;
        max-height: 154px !important;
        min-height: 0 !important;
        padding: 2px 2px 8px 0 !important;
        overflow: auto !important;
        overscroll-behavior: contain !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel .rp-qnav-dot,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel .rp-qnav-dot {
        flex: 0 0 36px !important;
        width: 36px !important;
        max-width: 36px !important;
        height: 30px !important;
        min-height: 30px !important;
        aspect-ratio: auto !important;
        border-radius: 9px !important;
        font-size: .60rem !important;
        line-height: 1 !important;
        padding: 0 !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel .rp-section,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel .rp-section {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel .rp-actions,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel .rp-actions {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 7px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel .rp-actions button,
      body.resiar-in-simulator.resiar-split-screen-compact #rightPanel .rp-actions .btn,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel .rp-actions button,
      body.resiar-in-simulator.resiar-split-screen-compact .right-panel .rp-actions .btn,
      body.resiar-in-simulator.resiar-split-screen-compact #resiarClinicalGuideButton {
        min-height: 38px !important;
        max-height: 44px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact .resiar-question-text,
      body.resiar-in-simulator.resiar-split-screen-compact #preguntaBox,
      body.resiar-in-simulator.resiar-split-screen-compact #opcionesBox {
        overflow-wrap: anywhere !important;
        word-break: normal !important;
      }

      body.resiar-in-simulator.resiar-split-screen-compact .resiar-option,
      body.resiar-in-simulator.resiar-split-screen-compact .opcion,
      body.resiar-in-simulator.resiar-split-screen-compact [class*="option"] {
        min-width: 0 !important;
      }
    }

    /*
      Pantalla dividida real.
      Acá esconder el sidebar social es la forma más segura de recuperar ancho.
      No se borra nada; solo se oculta mientras el viewport siga estrecho.
    */
    @media (max-width: 950px) and (min-width: 681px) {
      body.resiar-in-simulator.resiar-split-screen-focus aside {
        display: none !important;
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        flex-basis: 0 !important;
      }

      body.resiar-in-simulator.resiar-split-screen-focus #app,
      body.resiar-in-simulator.resiar-split-screen-focus .app,
      body.resiar-in-simulator.resiar-split-screen-focus .app-shell,
      body.resiar-in-simulator.resiar-split-screen-focus .layout,
      body.resiar-in-simulator.resiar-split-screen-focus .page,
      body.resiar-in-simulator.resiar-split-screen-focus .page-shell {
        grid-template-columns: minmax(0, 1fr) !important;
        max-width: 100vw !important;
        width: 100vw !important;
        overflow-x: hidden !important;
      }

      body.resiar-in-simulator.resiar-split-screen-focus main,
      body.resiar-in-simulator.resiar-split-screen-focus #main,
      body.resiar-in-simulator.resiar-split-screen-focus [role="main"],
      body.resiar-in-simulator.resiar-split-screen-focus .main,
      body.resiar-in-simulator.resiar-split-screen-focus .main-content {
        width: 100vw !important;
        max-width: 100vw !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        transform: none !important;
        padding-left: 8px !important;
        padding-right: 8px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-focus #statsBox {
        margin-top: 6px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-focus #rightPanel .rp-qnav-grid,
      body.resiar-in-simulator.resiar-split-screen-focus .right-panel .rp-qnav-grid {
        max-height: 126px !important;
      }

      body.resiar-in-simulator.resiar-split-screen-focus #rightPanel .rp-qnav-dot,
      body.resiar-in-simulator.resiar-split-screen-focus .right-panel .rp-qnav-dot {
        flex-basis: 34px !important;
        width: 34px !important;
        max-width: 34px !important;
        height: 28px !important;
        min-height: 28px !important;
        font-size: .58rem !important;
      }
    }

    @media (max-width: 760px) {
      body.resiar-in-simulator.resiar-split-screen-focus #rightPanel .rp-qnav-dot,
      body.resiar-in-simulator.resiar-split-screen-focus .right-panel .rp-qnav-dot {
        flex-basis: 32px !important;
        width: 32px !important;
        max-width: 32px !important;
        height: 27px !important;
        min-height: 27px !important;
        font-size: .56rem !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function isExamViewportActive() {
  try {
    return document.body?.classList?.contains('resiar-in-simulator');
  } catch (_) {
    return false;
  }
}

function applyForcedSidebarCollapse(active) {
  try {
    if (active && !forcedSidebarCollapse) {
      sidebarWasCollapsedBeforeForce = document.body.classList.contains('sb-collapsed');
      document.body.classList.add('sb-collapsed');
      forcedSidebarCollapse = true;
      return;
    }

    if (!active && forcedSidebarCollapse) {
      if (!sidebarWasCollapsedBeforeForce) document.body.classList.remove('sb-collapsed');
      forcedSidebarCollapse = false;
    }
  } catch (_) {}
}

function syncViewportClass() {
  try {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const inExam = isExamViewportActive();

    const compact = inExam && width <= 1100 && width >= 681;
    const focus = inExam && width <= 950 && width >= 681;

    document.body.classList.toggle('resiar-split-screen-compact', compact);
    document.body.classList.toggle('resiar-split-screen-focus', focus);

    applyForcedSidebarCollapse(compact);
  } catch (_) {}
}

export function installSplitScreenSafety() {
  if (installed) return;
  installed = true;

  ensureSplitScreenSafetyStyle();
  syncViewportClass();

  window.addEventListener('resize', syncViewportClass, { passive: true });
  window.addEventListener('orientationchange', syncViewportClass, { passive: true });

  const observer = new MutationObserver(syncViewportClass);
  try {
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-resiar-view'] });
  } catch (_) {}

  setInterval(syncViewportClass, 1200);

  try {
    window.resiarSplitScreenSafety = {
      version: 'v93',
      sync: syncViewportClass
    };
  } catch (_) {}
}

export default installSplitScreenSafety;
