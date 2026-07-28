export function installWhatsAppFloatController(options = {}) {
  if (window.__resiarWhatsAppFloatControllerInstalled) return;
  window.__resiarWhatsAppFloatControllerInstalled = true;

  const isLogged = typeof options.isLogged === 'function' ? options.isLogged : () => false;

  function q(id) {
    return document.getElementById(id);
  }

  function setVisible(visible) {
    const wa = q('waFloat');
    if (!wa) return false;
    wa.style.display = visible ? 'flex' : 'none';
    wa.style.visibility = visible ? 'visible' : 'hidden';
    wa.style.pointerEvents = visible ? 'auto' : 'none';
    wa.setAttribute('aria-hidden', visible ? 'false' : 'true');
    wa.tabIndex = visible ? 0 : -1;
    return !!visible;
  }

  function computeVisible() {
    const welcome = q('welcome');
    const view = (document.body && document.body.dataset ? document.body.dataset.resiarView : '') || '';
    const publicLanding = view === 'landing' || document.body.classList.contains('resiar-public-landing');
    const homeSim = !!(welcome && welcome.classList && welcome.classList.contains('home-sim'));
    const welcomeVisible = !!(
      welcome &&
      welcome.offsetParent !== null &&
      welcome.style.display !== 'none' &&
      !welcome.hidden &&
      welcome.offsetHeight > 0
    );

    return !isLogged() && publicLanding && !homeSim && welcomeVisible;
  }

  window.resiarSetWhatsAppVisible = setVisible;
  window.resiarSyncWhatsAppFloat = function resiarSyncWhatsAppFloat() {
    return setVisible(computeVisible());
  };

  try {
    window.resiarSyncWhatsAppFloat();
  } catch (_) {}
}
