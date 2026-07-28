/*
 * ResiAR — utilidades de sanitización/render HTML seguro.
 *
 * - escapeHtml conserva saltos de línea como <br>.
 * - markdownToHtml conserva el markdown básico usado por explicaciones IA.
 * - markdownToHtml permite imágenes Markdown seguras: ![alt](https://...)
 * - markdownToHtml permite <br> explícito como salto seguro en explicaciones manuales.
 */

function escapeHtmlRaw(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtmlRaw(value).replace(/`/g, '&#096;');
}

function normalizeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

function renderSafeMarkdownImages(rawText) {
  const images = [];
  const text = String(rawText ?? '').replace(/!\[([^\]\n]{0,180})\]\((https?:\/\/[^\s)]+)(?:\s+"([^"\n]{0,220})")?\)/g, (match, rawAlt, rawUrl, rawCaption) => {
    const url = normalizeImageUrl(rawUrl);
    if (!url) return match;

    const alt = String(rawAlt || '').trim();
    const caption = String(rawCaption || '').trim();
    const token = `@@RESIAR_MD_IMAGE_${images.length}@@`;
    images.push({
      token,
      html: `<figure class="exp-image-figure"><img class="exp-image" src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async">${caption ? `<figcaption>${escapeHtmlRaw(caption)}</figcaption>` : ''}</figure>`
    });
    return token;
  });

  return { text, images };
}

function renderSafeBreakTags(rawText) {
  const breaks = [];
  const text = String(rawText ?? '').replace(/<\s*br\s*\/?\s*>/gi, () => {
    const token = `\uE000RESIAR_MD_BR_${breaks.length}\uE001`;
    breaks.push({ token, html: '<br>' });
    return token;
  });

  return { text, breaks };
}

export function escapeHtml(value) {
  return escapeHtmlRaw(value).replace(/\n/g, '<br>');
}

// Convierte texto con markdown básico a HTML seguro.
// Soporta: **negrita**, títulos de sección, imágenes Markdown seguras y saltos de línea.
export function markdownToHtml(value) {
  if (!value) return '';

  const { text: imageSafeText, images } = renderSafeMarkdownImages(value);
  const { text, breaks } = renderSafeBreakTags(imageSafeText);

  let html = escapeHtmlRaw(text);

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  html = html.replace(
    /(^|\n)(Respuesta correcta|Respuesta oficial|Respuestas incorrectas|Concepto clave|Repaso|Referencias)(\s*:)/g,
    '$1<span class="exp-section-title">$2$3</span>'
  );

  html = html.replace(/\n/g, '<br>');

  breaks.forEach(({ token, html: breakHtml }) => {
    html = html.replaceAll(token, breakHtml);
  });

  images.forEach(({ token, html: imageHtml }) => {
    html = html.split(token).join(imageHtml);
  });

  return html;
}
