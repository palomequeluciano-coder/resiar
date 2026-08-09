// Helpers globales de visibilidad del flotante de WhatsApp + marcado de
// "view state" del body. Extraído de main.js sin cambios de comportamiento:
// era un IIFE sin ninguna dependencia del estado interno de main.js (solo
// document/window), así que se movió tal cual, como módulo de efecto
// (se importa por su efecto en window, no exporta nada que main.js use
// directamente -- main.js sigue llamando a `resiarMarkViewState` etc. como
// identificador global, igual que antes).
//
// Se apoya en `window.resiarSetViewState` (definido en state/viewState.js)
// y `window.resiarSyncWhatsAppFloat` (definido en ui/whatsappFloat.js),
// ambos consultados de forma defensiva porque el orden de carga entre
// módulos no está garantizado.

function q(id) { return document.getElementById(id); }

if (typeof window.resiarSetWhatsAppVisible !== 'function') {
  window.resiarSetWhatsAppVisible = function (visible) {
    try {
      var wa = q('waFloat');
      if (!wa) return;
      wa.style.display = visible ? 'flex' : 'none';
      wa.style.visibility = visible ? 'visible' : 'hidden';
      wa.style.pointerEvents = visible ? 'auto' : 'none';
      wa.setAttribute('aria-hidden', visible ? 'false' : 'true');
      wa.tabIndex = visible ? 0 : -1;
    } catch (_) {}
  };
}

window.resiarMarkViewState = function (kind) {
  try {
    if (typeof window.resiarSetViewState === 'function') {
      window.resiarSetViewState(kind);
      return;
    }
    var state = String(kind || '').toLowerCase().replace(/_/g, '-');
    if (state === 'home' || state === 'blocked') state = 'config';
    if (state === 'ended' || state === 'final') state = 'exam-ended';
    if (!state) state = 'config';
    document.body.dataset.resiarView = state;
    document.body.classList.toggle('resiar-public-landing', state === 'landing');
    if (state !== 'landing' && typeof window.resiarSetWhatsAppVisible === 'function') window.resiarSetWhatsAppVisible(false);
    else if (state === 'landing' && typeof window.resiarSyncWhatsAppFloat === 'function') window.resiarSyncWhatsAppFloat();
  } catch (_) {}
};

window.resiarHideStreakToast = function () {
  try { q('streakToast')?.classList.remove('show'); } catch (_) {}
};
