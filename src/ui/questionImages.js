import { escapeHtml } from '../utils/sanitize.js';
import { getQuestionImagePaths, getQuestionImageLabel } from '../utils/questionImages.js';

// Extraído de main.js sin cambios de comportamiento — solo relocalización.
// Depende de una función `getQuestionImageUrlFromPath` inyectada por el
// llamador porque esa función en main.js incorpora una variable de estado
// del módulo (_resiarQuestionBankVersion) que no vive acá.

export function renderQuestionImage(p, { getQuestionImageUrlFromPath }) {
  const paths = getQuestionImagePaths(p);
  if (!paths.length) return '';

  const safeId = String(p?.id || 'actual').replace(/[^a-zA-Z0-9_-]/g, '_');
  const total = paths.length;
  const altBase = escapeHtml(p?.imagen_alt || 'Imagen de la pregunta');
  const caption = p?.imagen_caption
    ? `<div class="q-img-caption">${escapeHtml(p.imagen_caption)}</div>`
    : '';

  const items = paths.map((path, index) => {
    const url = getQuestionImageUrlFromPath(path);
    if (!url) return '';
    const label = escapeHtml(getQuestionImageLabel(path, index, total));
    const alt = total > 1 ? `${altBase} ${index + 1}` : altBase;
    return `
      <a href="${url}" target="_blank" rel="noopener" class="q-img-link q-img-item">
        ${total > 1 ? `<span class="q-img-label">${label}</span>` : ''}
        <img
          src="${url}"
          alt="${alt}"
          class="q-img"
          loading="lazy"
          decoding="async"
          onerror="const item=this.closest('.q-img-item'); const fig=this.closest('figure'); if(item) item.remove(); if(fig && !fig.querySelector('.q-img-item')) fig.remove();"
        >
      </a>
    `;
  }).join('');

  if (!items.trim()) return '';

  return `
    <figure class="q-img-wrap ${total > 1 ? 'q-img-wrap-multiple' : ''}" id="imagen-pregunta-${safeId}">
      ${total > 1 ? `<div class="q-img-head"><span>Imágenes de referencia</span><small>${total} archivos</small></div>` : ''}
      <div class="q-img-grid ${total > 1 ? 'q-img-grid-multiple' : ''}">
        ${items}
      </div>
      ${caption}
    </figure>
  `;
}

export function renderQuestionTextWithImageRef(text, p) {
  const safe = escapeHtml(text || '');
  if (!getQuestionImagePaths(p).length) return safe;

  const safeId = String(p?.id || 'actual').replace(/[^a-zA-Z0-9_-]/g, '_');

  return safe.replace(
    /\[(imagen|ver imagen|figura|ver figura)\]/gi,
    `<button
      type="button"
      class="q-img-ref"
      onclick="document.getElementById('imagen-pregunta-${safeId}')?.scrollIntoView({behavior:'smooth',block:'center'})"
    >
      Ver imagen
    </button>`
  );
}
