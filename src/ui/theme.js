/*
 * ResiAR — Theme UI.
 *
 * Maneja el tema claro/oscuro y su persistencia local.
 */

import { RESIAR_THEME_KEY, LEGACY_THEME_KEYS } from '../utils/storageKeys.js';

let readTextRef = null;
let writeTextRef = null;
let themeButtonId = 'themeBtn';

export function initTheme(options = {}) {
  readTextRef = typeof options.readText === 'function' ? options.readText : null;
  writeTextRef = typeof options.writeText === 'function' ? options.writeText : null;
  themeButtonId = options.themeButtonId || themeButtonId;

  const saved = readStoredTheme();
  const html = document.documentElement;
  const theme = normalizeTheme(saved) || 'light';

  html.setAttribute('data-theme', theme);
}

function normalizeTheme(value) {
  const theme = String(value || '').toLowerCase();
  return theme === 'dark' || theme === 'light' ? theme : '';
}

function readStoredTheme() {
  if (!readTextRef) return null;
  const current = normalizeTheme(readTextRef(RESIAR_THEME_KEY, null));
  if (current) return current;

  for (const key of LEGACY_THEME_KEYS) {
    const legacy = normalizeTheme(readTextRef(key, null));
    if (legacy) {
      if (writeTextRef) writeTextRef(RESIAR_THEME_KEY, legacy);
      return legacy;
    }
  }
  return null;
}

export function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';

  html.classList.add('no-transition');
  html.setAttribute('data-theme', next);

  if (writeTextRef) writeTextRef(RESIAR_THEME_KEY, next);

  const button = document.getElementById(themeButtonId);
  if (button) button.textContent = isLight ? '🌙' : '☀️';

  requestAnimationFrame(() => html.classList.remove('no-transition'));
}
