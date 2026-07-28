/*
 * ResiAR — Toast UI.
 *
 * Centraliza los toasts ricos de la app. No depende de estado de examen ni de Supabase.
 */

const ACTIVE_TOASTS = new Map();
const MAX_VISIBLE_TOASTS = 3;

function _toastKey(type, message) {
  return `${type}|${String(message || '').trim().slice(0, 180)}`;
}

function _isMobileToastViewport() {
  try {
    return !!window.matchMedia?.('(max-width: 1180px), (max-width: 1366px) and (pointer: coarse)')?.matches;
  } catch (_) {
    return false;
  }
}

function _toastCountBadge(toast) {
  let badge = toast.querySelector('.resiar-toast-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'resiar-toast-count';
    const title = toast.querySelector('.resiar-toast-title');
    if (title) title.appendChild(badge);
  }
  return badge;
}

export function _toastTypeFromMessage(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.startsWith('❌') || m.startsWith('⛔') || m.includes('error') || m.includes('bloqueado') || m.includes('venció') || m.includes('falló')) return 'error';
  if (m.startsWith('⚠️') || m.startsWith('⚠') || m.startsWith('⚡') || m.includes('cuidado') || m.includes('advertencia')) return 'warn';
  if (m.startsWith('✓') || m.startsWith('🎉') || m.startsWith('✅') || m.startsWith('👋') || m.includes('listo') || m.includes('guardado') || m.includes('copiado') || m.includes('bienvenido')) return 'success';
  if (m.startsWith('🔒') || m.startsWith('🔐')) return 'locked';
  return 'info';
}
export function _toastTitleForType(type) {
  return ({ success:'Listo', error:'Error', warn:'Atención', locked:'Acceso restringido', info:'Información' })[type] || 'Información';
}
export function _toastIconForType(type) {
  return ({ success:'✓', error:'✕', warn:'⚠', locked:'🔒', info:'ℹ' })[type] || 'ℹ';
}
export function _getToastWrap() {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'resiar-toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}
export function _positionToastWrap() {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;

  // En celulares/tablets los toasts son una capa propia anclada al viewport.
  // No deben recalcularse según la sidebar porque esa sidebar es overlay y
  // puede dejar el mensaje fuera de pantalla o comprimido.
  if (_isMobileToastViewport()) {
    wrap.style.left = '';
    wrap.style.right = '';
    wrap.style.transform = '';
    wrap.style.width = '';
    return;
  }

  const aside = document.querySelector('aside.visible');
  if (aside) {
    const sw = aside.offsetWidth || 272;
    wrap.style.left = (sw + (window.innerWidth - sw) / 2) + 'px';
  } else {
    wrap.style.left = '50%';
  }
  wrap.style.right = '';
  wrap.style.width = '';
  wrap.style.transform = 'translateX(-50%)';
}
if (!window._resiarToastResizeHook) {
  window.addEventListener('resize', _positionToastWrap);
  window._resiarToastResizeHook = true;
}
export function _showRichToast(opts = {}) {
  const wrap = _getToastWrap();
  _positionToastWrap();
  const type = opts.type || 'info';
  const duration = opts.duration || 4500;
  const messageText = String(opts.message || '');
  const key = _toastKey(type, messageText);
  const existing = ACTIVE_TOASTS.get(key);
  if (existing && document.body.contains(existing) && !existing.classList.contains('is-leaving')) {
    existing._toastCount = (existing._toastCount || 1) + 1;
    const badge = _toastCountBadge(existing);
    badge.textContent = `×${existing._toastCount}`;
    existing.classList.add('is-refreshed');
    setTimeout(() => existing.classList.remove('is-refreshed'), 260);
    clearTimeout(existing._timer);
    existing._timer = setTimeout(existing._dismiss, duration);
    return existing;
  }
  const toast = document.createElement('div');
  toast.className = 'resiar-toast resiar-toast--' + type;
  toast.dataset.toastKey = key;
  toast.setAttribute('role', type === 'error' || type === 'warn' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' || type === 'warn' ? 'assertive' : 'polite');
  toast.style.setProperty('--toast-ms', duration + 'ms');

  const icon = document.createElement('div');
  icon.className = 'resiar-toast-icon';
  icon.textContent = opts.icon || _toastIconForType(type);

  const body = document.createElement('div');
  body.className = 'resiar-toast-body';
  const title = document.createElement('div');
  title.className = 'resiar-toast-title';
  title.textContent = opts.title || _toastTitleForType(type);
  const message = document.createElement('div');
  message.className = 'resiar-toast-message';
  message.textContent = messageText;
  body.appendChild(title);
  body.appendChild(message);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'resiar-toast-close';
  close.setAttribute('aria-label', 'Cerrar mensaje');
  close.textContent = '✕';

  const progress = document.createElement('div');
  progress.className = 'resiar-toast-progress';

  toast.appendChild(icon);
  toast.appendChild(body);
  toast.appendChild(close);
  toast.appendChild(progress);
  wrap.appendChild(toast);
  ACTIVE_TOASTS.set(key, toast);
  Array.from(wrap.querySelectorAll('.resiar-toast:not(.is-leaving)'))
    .slice(0, Math.max(0, wrap.querySelectorAll('.resiar-toast:not(.is-leaving)').length - MAX_VISIBLE_TOASTS))
    .forEach(el => { if (typeof el._dismiss === 'function') el._dismiss(); else el.remove(); });

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.remove('is-visible');
    toast.classList.add('is-leaving');
    if (ACTIVE_TOASTS.get(key) === toast) ACTIVE_TOASTS.delete(key);
    setTimeout(() => toast.remove(), 360);
  }
  toast._dismiss = dismiss;

  close.addEventListener('click', dismiss);
  toast.addEventListener('click', (ev) => { if (ev.target === close) return; dismiss(); });
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
  toast._timer = setTimeout(dismiss, duration);
  return toast;
}
export function mostrarToast(msg, duracion) {
  const type = _toastTypeFromMessage(msg);
  return _showRichToast({ message: msg, type, duration: duracion || 4500 });
}

