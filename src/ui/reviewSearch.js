let deps = null;
let reviewFilter = 'all';

const SEARCH_DEBOUNCE_MS = 140;
const SEARCH_MAX_RESULTS = 60;
let searchTimer = 0;
let searchSeq = 0;
let lastSearchPool = [];
let lastSearchMatches = [];
let lastSearchScope = null;
let lastSearchRenderedTerm = '';
let lastSearchRenderedScopeLabel = '';
const searchHaystackCache = new WeakMap();
const remoteSearchCache = new Map();
const REMOTE_SEARCH_CACHE_MAX = 24;

function rememberRemoteSearch(key, value) {
  if (!key) return;
  if (remoteSearchCache.has(key)) remoteSearchCache.delete(key);
  remoteSearchCache.set(key, value);
  while (remoteSearchCache.size > REMOTE_SEARCH_CACHE_MAX) {
    const firstKey = remoteSearchCache.keys().next().value;
    remoteSearchCache.delete(firstKey);
  }
}

function d() {
  if (!deps) throw new Error('reviewSearch no está configurado.');
  return deps;
}

function byId(id) {
  return document.getElementById(id);
}

export function enterExamReviewMode() {
  try { window._resiarExamReviewMode = true; } catch (_) {}
  try { document.body.classList.add('resiar-exam-review'); } catch (_) {}
}

export function exitExamReviewMode() {
  try { window._resiarExamReviewMode = false; } catch (_) {}
  try { document.body.classList.remove('resiar-exam-review', 'resiar-view-exam-review'); } catch (_) {}
  try { if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState('exam-ended'); } catch (_) {}
}

function safeCall(fn, fallback) {
  try {
    return typeof fn === 'function' ? fn() : fallback;
  } catch (_) {
    return fallback;
  }
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function activeExamScopeAvailable(examen) {
  if (!Array.isArray(examen) || !examen.length) return false;
  try { if (window._resiarExamRunning && window._resiarExamFinished !== true) return true; } catch (_) {}
  try {
    const view = String(document.body?.dataset?.resiarView || '');
    if ((view === 'exam' || view === 'exam-review') && window._resiarExamFinished !== true) return true;
  } catch (_) {}
  try {
    if (document.body?.classList?.contains('resiar-exam-review')) return true;
  } catch (_) {}
  return false;
}

function getSearchScope(cfg) {
  const examen = safeCall(cfg.getExam, []);
  if (activeExamScopeAvailable(examen)) {
    return { pool: Array.isArray(examen) ? examen : [], inExam: true, label: 'examen actual', remote: false };
  }

  const all = safeCall(cfg.getAllQuestions, []);
  return { pool: Array.isArray(all) ? all : [], inExam: false, label: 'banco completo', remote: true };
}

function stableQuestionKey(p, fallbackIndex) {
  const id = p && (p.id ?? p.uid ?? p.uuid);
  if (id !== undefined && id !== null && id !== '') return String(id);
  return String(fallbackIndex ?? '');
}

function buildSearchHaystack(p, cfg, normalizeSearchText, espLabel, temaRaw) {
  if (p && typeof p === 'object') {
    const cached = searchHaystackCache.get(p);
    if (cached) return cached;
  }
  const parts = [];
  parts.push(p?.pregunta || '');
  parts.push(p?.preview_text || '');
  parts.push(p?.pregunta_preview || '');
  parts.push(p?.__resiarSearchCaseText || '');
  parts.push(p?.imagen_alt || '');
  parts.push(p?.imagen_caption || '');
  parts.push(p?.examen || '');
  parts.push(p?.anio || '');
  try { parts.push(espLabel(p) || ''); } catch (_) {}
  try { parts.push(temaRaw(p) || ''); } catch (_) {}
  const opciones = p?.opciones || {};
  if (opciones && typeof opciones === 'object') {
    for (const value of Object.values(opciones)) parts.push(value || '');
  }
  const normalized = normalizeSearchText(parts.join(' | '));
  if (p && typeof p === 'object') searchHaystackCache.set(p, normalized);
  return normalized;
}

function scoreSearchMatch(p, term, tokens, haystack, normalizeSearchText, espLabel, temaRaw) {
  if (!tokens.every(t => haystack.includes(t))) return 0;
  let score = 1;
  const pregunta = normalizeSearchText(p?.pregunta || '');
  if (pregunta.includes(term)) score += 120;
  else if (tokens.some(t => pregunta.includes(t))) score += 45;
  try {
    const tema = normalizeSearchText(temaRaw(p) || '');
    if (tema.includes(term)) score += 35;
  } catch (_) {}
  try {
    const esp = normalizeSearchText(espLabel(p) || '');
    if (esp.includes(term)) score += 25;
  } catch (_) {}
  const exam = normalizeSearchText(p?.examen || '');
  if (exam.includes(term)) score += 18;
  return score;
}

export function configureReviewSearch(options) {
  deps = options || {};

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    cerrarBuscador();
    cerrarReview();
    byId('filtroExamenDropdown')?.classList.remove('open');
  });
}

export function abrirReview() {
  renderReviewGrid();
  byId('modalReview')?.classList.add('vis');
}

export function cerrarReview() {
  byId('modalReview')?.classList.remove('vis');
}

export function setReviewFilter(filter, button) {
  reviewFilter = filter || 'all';
  document.querySelectorAll('.rf-btn').forEach(btn => btn.classList.remove('active'));
  if (button) button.classList.add('active');
  renderReviewGrid();
}

export function renderReviewGrid() {
  const cfg = d();
  const grid = byId('reviewGrid');
  if (!grid) return;

  const examen = safeCall(cfg.getExam, []);
  const respuestas = safeCall(cfg.getAnswers, []);
  const marcadas = safeCall(cfg.getMarked, new Set());
  const notas = safeCall(cfg.getNotas, {});

  const rows = (Array.isArray(examen) ? examen : []).map((p, i) => {
    const respuestaUsuario = respuestas[i];
    const anulada = !!safeCall(() => cfg.esRespuestaAnulada(p), false);
    const estado = !respuestaUsuario ? 'skip' : anulada ? 'anulada' : respuestaUsuario === p.respuesta ? 'ok' : 'no';
    const icon = estado === 'ok' ? '✓' : estado === 'no' ? '✗' : estado === 'anulada' ? '⚠' : '—';
    const isMark = marcadas && typeof marcadas.has === 'function' ? marcadas.has(i) : false;
    return { i, p, respuestaUsuario, estado, icon, isMark };
  }).filter(({ estado, isMark }) => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'marked') return isMark;
    return estado === reviewFilter;
  });

  if (!rows.length) {
    grid.innerHTML = '<div class="search-empty">No hay preguntas en esta categoría</div>';
    return;
  }

  const escapeHtml = cfg.escapeHtml || (value => String(value ?? ''));
  grid.innerHTML = rows.map(({ i, p, estado, icon, isMark }) => {
    const hasNota = !!notas[`q_${p.id ?? i}`];
    return `<div class="review-row rr-${estado}" data-action="review-open-question" data-index="${i}">
      <span class="review-num">${i + 1}</span>
      <span class="review-txt">${escapeHtml(p.pregunta)}</span>
      <span class="review-icon">${isMark ? '🔖' : ''}${hasNota ? '📝' : ''} ${icon}</span>
    </div>`;
  }).join('');
}

export function irAPregunta(idx) {
  const cfg = d();
  safeCall(cfg.stopActiveSounds, undefined);
  enterExamReviewMode();
  if (typeof cfg.setCurrentIndex === 'function') cfg.setCurrentIndex(idx);
  cerrarReview();
  // Aplicar el estado de revisión antes de renderizar evita que render() calcule el
  // layout como examen común y cree el navegador inline legacy debajo de la pregunta.
  try { if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState('exam-review'); } catch (_) {}
  safeCall(cfg.renderExam, undefined);
  try { requestAnimationFrame(() => { if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState('exam-review'); }); } catch (_) {}
}

export function abrirBuscador() {
  const cfg = d();
  if (!safeCall(cfg.getCurrentUser, null)) {
    safeCall(cfg.requireLogin, undefined);
    return;
  }
  byId('modalSearch')?.classList.add('vis');
  setTimeout(() => byId('searchModalInput')?.focus(), 80);
}

export function cerrarBuscador() {
  byId('modalSearch')?.classList.remove('vis');
  const input = byId('searchModalInput');
  if (input) input.value = '';
  const results = byId('searchResults');
  if (results) results.innerHTML = '<div class="search-empty">Escribí algo para buscar en los filtros actuales</div>';
  lastSearchPool = [];
  lastSearchMatches = [];
  lastSearchScope = null;
}

export function buscarPreguntas(query, options = {}) {
  const seq = ++searchSeq;
  const cfg = d();
  const res = byId('searchResults');
  if (!res) return;

  const q = String(query || '').trim();
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = 0;
  }

  if (!q || q.length < 2) {
    lastSearchPool = [];
    lastSearchMatches = [];
    lastSearchScope = null;
    res.innerHTML = '<div class="search-empty">Escribí al menos 2 caracteres</div>';
    return;
  }

  const run = () => {
    if (seq !== searchSeq) return;
    ejecutarBusquedaPreguntas(q, seq);
  };

  if (options && options.immediate) run();
  else {
    res.innerHTML = '<div class="search-empty">Buscando…</div>';
    searchTimer = setTimeout(run, SEARCH_DEBOUNCE_MS);
  }
}

function searchResultPreviewText(p) {
  if (!p || typeof p !== 'object') return '';

  const candidates = [
    p.preview_text,
    p.pregunta_preview,
    p.__resiarSearchCaseText,
    p.preview,
    p.resumen,
    p.enunciado,
    p.texto,
    p.pregunta
  ];

  for (const candidate of candidates) {
    const clean = String(candidate ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\bOpciones:\s.*$/i, '')
      .trim();

    if (!clean) continue;
    if (/^Opciones\s*:/i.test(clean)) continue;
    if (/^ID\)\s*Examen/i.test(clean)) continue;
    if (/EXAMEN\)\s*Examen/i.test(clean) && /TIPO\)\s*/i.test(clean)) continue;
    if (clean.length < 12 && !/[¿?]/.test(clean)) continue;
    return clean;
  }

  return '';
}

function searchResultMetaText(p, cfg, espLabel, temaRaw) {
  const parts = [];
  const examen = String(p?.examen || '').trim();
  if (examen) parts.push(examen);
  try {
    const esp = String(espLabel(p) || '').trim();
    if (esp) parts.push(esp);
  } catch (_) {}
  try {
    const tema = String(temaRaw(p) || '').trim();
    if (tema) parts.push(tema);
  } catch (_) {}
  return parts.join(' · ');
}

function renderSearchMatches({ query, seq, cfg, scope, matches, asyncPending = false }) {
  const res = byId('searchResults');
  if (!res || seq !== searchSeq) return;

  const escapeHtml = cfg.escapeHtml || (value => String(value ?? ''));
  const espLabel = cfg.espLabel || (() => '');
  const temaRaw = cfg.temaRaw || (() => '');

  lastSearchMatches = matches.map(({ p, i, score }) => ({ p, originalIndex: i, score }));
  const visible = matches.slice(0, SEARCH_MAX_RESULTS);

  if (!visible.length) {
    lastSearchMatches = [];
    res.innerHTML = `<div class="search-empty">Sin resultados para "${escapeHtml(query)}" en ${escapeHtml(scope.label)}</div>`;
    return;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  function hl(txt) {
    return escapeHtml(txt).replace(pattern, '<mark>$1</mark>');
  }

  const scopeNote = `<div class="search-scope-note search-scope-note-exam">
    <div><strong>${matches.length}</strong> coincidencia${matches.length === 1 ? '' : 's'} en ${escapeHtml(scope.label)} · se genera un examen con todas.${asyncPending ? ' · cargando vista previa…' : ''}</div>
    <button type="button" class="search-generate-exam-btn" data-action="search-start-matches" data-index="0">Generar examen</button>
  </div>`;

  res.innerHTML = scopeNote + visible.map(({ p, i }, visibleIndex) => {
    const preview = searchResultPreviewText(p) || 'Vista previa no disponible. Al generar el examen se carga la pregunta completa.';
    const meta = searchResultMetaText(p, cfg, espLabel, temaRaw);
    const key = stableQuestionKey(p, i);
    return `<div class="search-result-item" data-action="search-open-question" data-index="${visibleIndex}" data-original-index="${i}" data-question-key="${escapeHtml(key)}" data-in-exam="${scope.inExam ? 'true' : 'false'}">
      <div class="sr-text">${hl(preview)}</div>
      <div class="sr-meta">${escapeHtml(meta)}</div>
      <div class="sr-action">Generar examen con las coincidencias y empezar acá →</div>
    </div>`;
  }).join('');
}

async function hydrateSearchPreviewsForMatches({ query, seq, cfg, scope, matches }) {
  if (seq !== searchSeq || !Array.isArray(matches) || !matches.length) return;
  if (typeof cfg.getSearchPreviews !== 'function') return;

  const missing = matches
    .filter(({ p }) => !searchResultPreviewText(p))
    .map(({ p }) => stableQuestionKey(p, ''))
    .filter(Boolean)
    .slice(0, SEARCH_MAX_RESULTS);

  if (!missing.length) return;

  try {
    const previewMap = await cfg.getSearchPreviews(missing);
    if (seq !== searchSeq || !previewMap) return;

    const getPreview = (id) => {
      if (previewMap instanceof Map) return previewMap.get(id);
      if (typeof previewMap === 'object') return previewMap[id];
      return '';
    };

    let changed = false;
    const hydrated = matches.map((row) => {
      const id = stableQuestionKey(row.p, '');
      const preview = id ? getPreview(id) : '';
      if (!preview || searchResultPreviewText(row.p)) return row;
      changed = true;
      return { ...row, p: { ...row.p, preview_text: preview, pregunta_preview: preview } };
    });

    if (changed) renderSearchMatches({ query, seq, cfg, scope, matches: hydrated, asyncPending: false });
  } catch (error) {
    console.warn('[ResiAR] No se pudieron cargar previews del buscador:', error);
  }
}


function normalizeRemoteQuestionRow(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id ?? row.question_id ?? '').trim();
  if (!id) return null;
  const preview = String(row.preview_text ?? row.preview ?? row.pregunta_preview ?? '').trim();
  return {
    id,
    examen: row.examen ?? null,
    anio: row.anio ?? null,
    tipo: row.tipo ?? null,
    especialidad: row.especialidad ?? null,
    tema: row.tema ?? null,
    especialidad_v2: row.especialidad_v2 ?? null,
    tema_v2: row.tema_v2 ?? null,
    num_original: row.num_original ?? null,
    corregida: row.corregida ?? null,
    anulada: !!row.anulada,
    imagen_path: row.imagen_path ?? null,
    imagenes_paths: row.imagenes_paths ?? null,
    imagen_alt: row.imagen_alt ?? null,
    imagen_caption: row.imagen_caption ?? null,
    preview_text: preview,
    pregunta_preview: preview,
    preview,
    resumen: preview,
    _resiarSearchRank: Number(row.search_rank || row.rank || 0)
  };
}

async function fetchRemoteSearchMatches({ query, term, seq, cfg, scope, localMatches }) {
  if (!scope?.remote || typeof cfg.searchFullBank !== 'function') return null;
  const cacheKey = term;
  if (remoteSearchCache.has(cacheKey)) return remoteSearchCache.get(cacheKey);

  try {
    const rows = await cfg.searchFullBank(query, SEARCH_MAX_RESULTS);
    if (seq !== searchSeq) return null;
    const normalized = (Array.isArray(rows) ? rows : [])
      .map(normalizeRemoteQuestionRow)
      .filter(Boolean)
      .map((p, i) => ({ p, i, score: Number(p._resiarSearchRank || 1000) }));

    const localById = new Map((Array.isArray(localMatches) ? localMatches : [])
      .map((row) => [stableQuestionKey(row.p, ''), row])
      .filter(([id]) => id));

    const merged = [];
    const seen = new Set();
    normalized.forEach((row) => {
      const id = stableQuestionKey(row.p, '');
      if (!id || seen.has(id)) return;
      const local = localById.get(id);
      merged.push(local ? { ...local, p: { ...local.p, ...row.p }, score: Math.max(Number(local.score || 0), Number(row.score || 0)) } : row);
      seen.add(id);
    });

    (Array.isArray(localMatches) ? localMatches : []).forEach((row) => {
      const id = stableQuestionKey(row.p, '');
      if (!id || seen.has(id)) return;
      merged.push(row);
      seen.add(id);
    });

    rememberRemoteSearch(cacheKey, merged);
    return merged;
  } catch (error) {
    console.warn('[ResiAR] Búsqueda server-side no disponible:', error);
    return null;
  }
}

async function ejecutarBusquedaPreguntas(query, seq) {
  const cfg = d();
  const res = byId('searchResults');
  if (!res || seq !== searchSeq) return;

  const normalizeSearchText = cfg.normalizeSearchText || (value => String(value ?? '').toLowerCase());
  const escapeHtml = cfg.escapeHtml || (value => String(value ?? ''));
  const espLabel = cfg.espLabel || (() => '');
  const temaRaw = cfg.temaRaw || (() => '');

  const term = normalizeSearchText(query).trim();
  const tokens = term.split(/\s+/).map(t => t.trim()).filter(Boolean);
  if (!term || !tokens.length) {
    res.innerHTML = '<div class="search-empty">Escribí al menos 2 caracteres</div>';
    return;
  }

  const scope = getSearchScope(cfg);
  const pool = Array.isArray(scope.pool) ? scope.pool : [];
  lastSearchPool = pool;
  lastSearchScope = scope;
  lastSearchMatches = [];
  lastSearchRenderedTerm = term;
  lastSearchRenderedScopeLabel = scope.label;

  if (!pool.length) {
    res.innerHTML = '<div class="search-empty">No hay preguntas disponibles con los filtros actuales</div>';
    return;
  }

  const matches = [];
  for (let i = 0; i < pool.length; i += 1) {
    const p = pool[i];
    const haystack = buildSearchHaystack(p, cfg, normalizeSearchText, espLabel, temaRaw);
    const score = scoreSearchMatch(p, term, tokens, haystack, normalizeSearchText, espLabel, temaRaw);
    if (score > 0) matches.push({ p, i, score });
  }

  matches.sort((a, b) => b.score - a.score || a.i - b.i);

  if (scope.remote && typeof cfg.searchFullBank === 'function') {
    const pendingMatches = matches.length ? matches : [];
    if (pendingMatches.length) {
      renderSearchMatches({ query, seq, cfg, scope, matches: pendingMatches, asyncPending: true });
    } else {
      res.innerHTML = `<div class="search-empty">Buscando "${escapeHtml(query)}" en banco completo…</div>`;
    }

    const remoteMatches = await fetchRemoteSearchMatches({ query, term, seq, cfg, scope, localMatches: pendingMatches });
    if (seq !== searchSeq) return;
    if (Array.isArray(remoteMatches) && remoteMatches.length) {
      renderSearchMatches({ query, seq, cfg, scope, matches: remoteMatches, asyncPending: false });
      return;
    }

    if (pendingMatches.length) {
      renderSearchMatches({ query, seq, cfg, scope, matches: pendingMatches, asyncPending: false });
      return;
    }
  }

  if (!matches.length) {
    lastSearchMatches = [];
    res.innerHTML = `<div class="search-empty">Sin resultados para "${escapeHtml(query)}" en ${escapeHtml(scope.label)}</div>`;
    return;
  }

  const needsPreview = matches.slice(0, SEARCH_MAX_RESULTS).some(({ p }) => !searchResultPreviewText(p));
  renderSearchMatches({ query, seq, cfg, scope, matches, asyncPending: needsPreview });
  if (needsPreview) hydrateSearchPreviewsForMatches({ query, seq, cfg, scope, matches });
}

function getLastSearchExamPool() {
  if (Array.isArray(lastSearchMatches) && lastSearchMatches.length) {
    return lastSearchMatches.map(row => row.p).filter(Boolean);
  }
  return Array.isArray(lastSearchPool) && lastSearchPool.length ? lastSearchPool : [];
}

function startSearchGeneratedExam(startIndex = 0) {
  const cfg = d();
  const pool = getLastSearchExamPool();
  if (!pool.length) return false;

  const safeIdx = Number(startIndex);
  const nextIdx = Math.max(0, Math.min(Number.isFinite(safeIdx) ? safeIdx : 0, pool.length - 1));
  cerrarBuscador();

  if (typeof cfg.startSearchExamAt === 'function') {
    cfg.startSearchExamAt(pool, nextIdx);
    return true;
  }
  if (typeof cfg.startFullBankExamAt === 'function') {
    cfg.startFullBankExamAt(nextIdx);
    return true;
  }
  return false;
}

export function iniciarExamenDesdeBusqueda(idx = 0) {
  return startSearchGeneratedExam(idx);
}

export function irAPreguntaDesde(idx, enExamen) {
  const cfg = d();

  const safeIdx = Number(idx);
  const nextIdx = Number.isFinite(safeIdx) ? Math.max(0, safeIdx) : 0;

  // Desde el buscador general, cualquier resultado inicia un examen compuesto
  // únicamente por todas las coincidencias actuales. Si el usuario clickea una
  // coincidencia, el examen empieza en esa pregunta dentro del set coincidente.
  if (Array.isArray(lastSearchMatches) && lastSearchMatches.length) {
    startSearchGeneratedExam(nextIdx);
    return;
  }

  cerrarBuscador();

  if (enExamen) {
    if (typeof cfg.setCurrentIndex === 'function') cfg.setCurrentIndex(nextIdx);
    try { if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState('exam'); } catch (_) {}
    safeCall(cfg.renderExam, undefined);
    try { if (typeof cfg.ensureExamChrome === 'function') cfg.ensureExamChrome(); } catch (_) {}
    requestAnimationFrame(() => {
      try { if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState('exam'); } catch (_) {}
      try { if (typeof cfg.ensureExamChrome === 'function') cfg.ensureExamChrome(); } catch (_) {}
    });
    return;
  }

  const pool = Array.isArray(lastSearchPool) && lastSearchPool.length
    ? lastSearchPool
    : getSearchScope(cfg).pool;

  if (typeof cfg.startSearchExamAt === 'function') {
    cfg.startSearchExamAt(pool, nextIdx);
    return;
  }

  if (typeof cfg.startFullBankExamAt === 'function') {
    cfg.startFullBankExamAt(nextIdx);
  }
}
