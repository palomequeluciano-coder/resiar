/*
 * ResiAR — utilidades de avatar.
 *
 * Centraliza normalización de URLs de Google/OAuth y fallback con inicial.
 */

import { escapeHtml } from './sanitize.js';

export function resiarAvatarDisplayName(profile, fallback = 'Usuario') {
  return (
    profile?.username ||
    profile?.name ||
    profile?.full_name ||
    profile?.display_name ||
    profile?.email?.split?.('@')?.[0] ||
    fallback ||
    'Usuario'
  );
}

export function resiarAvatarInitial(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

export function resiarNormalizeAvatarUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') return '';

  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'data:') return '';
    return parsed.href;
  } catch (_) {
    return '';
  }
}

export function resiarPickUserAvatarUrl(user) {
  const meta = user?.user_metadata || {};
  return resiarNormalizeAvatarUrl(meta.avatar_url || meta.picture || meta.photo_url || meta.image || '');
}

export function resiarAvatarHtml(profile, className, tag = 'span') {
  const safeTag = tag === 'div' ? 'div' : 'span';
  const klass = escapeHtml(className || 'resiar-avatar');
  const name = resiarAvatarDisplayName(profile);
  const initial = resiarAvatarInitial(name);
  const url = resiarNormalizeAvatarUrl(profile?.avatar_url || profile?.picture || profile?.photo_url || profile?.image || '');

  if (!url) return `<${safeTag} class="${klass}">${escapeHtml(initial)}</${safeTag}>`;

  return `<${safeTag} class="${klass}" data-avatar-fallback="${escapeHtml(initial)}"><img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async"></${safeTag}>`;
}

export function resiarInstallAvatarFallback() {
  if (window.__resiarAvatarFallbackInstalled) return;

  window.__resiarAvatarFallbackInstalled = true;

  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;

    const holder = img.closest('[data-avatar-fallback]');
    if (!holder) return;

    const initial = holder.getAttribute('data-avatar-fallback') || '?';
    holder.textContent = initial;
    holder.classList.add('avatar-fallback');
    holder.removeAttribute('data-avatar-fallback');
  }, true);
}
