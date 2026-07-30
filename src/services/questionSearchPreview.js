import { normalizeSearchText } from '../utils/text.js';
import {
  resiarQuestionMatchesSearchQuery,
  resiarCleanSearchPreviewText,
  resiarSearchPreviewTextFromQuestion
} from '../utils/questionSearchText.js';

// Extraído de main.js sin cambios de comportamiento — sistema de preview
// del modal "Buscar pregunta". Combina heurísticas de scraping del DOM
// (buscar el modal/las cards por su texto visible) con una capa de RPC
// y un fallback vía sesión segura de examen.
//
// ⚠️ Este módulo depende de la estructura visual del modal de búsqueda.
// Si se toca el HTML/markup de ese modal, hay que volver a probar a mano
// que las previews sigan apareciendo (escribir una búsqueda, tipear rápido,
// borrar y volver a escribir).

const RESIAR_SEARCH_PREVIEW_LIMIT = 30;

let deps = {
  getSb: () => null,
  getPreguntas: () => [],
  uniqueQuestionIds: (ids) => [...new Set((ids || []).map((id) => String(id ?? '').trim()).filter(Boolean))],
  resiarSecureExamEnabled: () => false,
  resiarCreateSecureExamFromCatalog: async () => ({ questions: [] })
};

let resiarSearchPreviewTimer = null;
let resiarSearchPreviewSeq = 0;
const resiarSearchPreviewCache = new Map();
let resiarSearchPreviewRpcAvailable = null;

export function configureQuestionSearchPreview(overrides = {}) {
  deps = { ...deps, ...overrides };
  return {
    resiarTrimSearchVisibleOptionSuffix,
    resiarFetchQuestionSearchPreviewsRpc,
    resiarSearchFullQuestionBankRpc,
    resiarFindSearchModal,
    resiarCurrentSearchQueryFromModal,
    resiarSearchPreviewPool,
    resiarVisibleSearchCards,
    resiarInsertSearchPreview,
    resiarSearchPreviewCacheKey,
    resiarApplySearchPreviews,
    resiarApplySearchPreviewTextMap,
    resiarHydrateVisibleSearchPreviews,
    resiarScheduleSearchPreviewHydration
  };
}

function resiarTrimSearchVisibleOptionSuffix() {
  try {
    const modal = Array.from(document.querySelectorAll('[role="dialog"], .modal, .modal-card, .modal-content, section, div'))
      .find((el) => /Buscar pregunta/i.test(el.textContent || '') && el.querySelector('input'));
    if (!modal) return;

    const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      const text = String(node.nodeValue || '');
      const idx = text.indexOf('Opciones:');
      if (idx > 80) {
        node.nodeValue = text.slice(0, idx).trim();
      }
    });
  } catch (_) {}
}

async function resiarFetchQuestionSearchPreviewsRpc(questionIds) {
  const sb = deps.getSb();
  if (!sb || typeof sb.rpc !== 'function') return null;
  if (resiarSearchPreviewRpcAvailable === false) return null;

  const ids = deps.uniqueQuestionIds(questionIds).slice(0, RESIAR_SEARCH_PREVIEW_LIMIT);
  if (!ids.length) return new Map();

  try {
    const { data, error } = await sb.rpc('get_question_search_previews_v1', {
      p_question_ids: ids,
      p_limit: Math.min(ids.length, RESIAR_SEARCH_PREVIEW_LIMIT)
    });

    if (error) throw error;

    resiarSearchPreviewRpcAvailable = true;

    const out = new Map();
    (Array.isArray(data) ? data : []).forEach((row) => {
      const id = String(row?.question_id ?? row?.id ?? '').trim();
      const preview = resiarCleanSearchPreviewText(row?.preview_text ?? row?.preview ?? row?.pregunta_preview ?? '');
      if (id && preview) out.set(id, preview);
    });

    return out;
  } catch (error) {
    resiarSearchPreviewRpcAvailable = false;
    console.warn('[ResiAR] RPC get_question_search_previews_v1 no disponible; fallback a sesión segura:', error);
    return null;
  }
}

async function resiarSearchFullQuestionBankRpc(query, limit = 60) {
  const sb = deps.getSb();
  if (!sb || typeof sb.rpc !== 'function') return [];
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const { data, error } = await sb.rpc('search_questions_full_bank_v78', {
    p_query: q,
    p_limit: Math.max(1, Math.min(Number(limit) || 60, 100))
  });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function resiarFindSearchModal() {
  try {
    return Array.from(document.querySelectorAll('[role="dialog"], .modal, .modal-card, .modal-content, section, div'))
      .find((el) => /Buscar pregunta/i.test(el.textContent || '') && el.querySelector('input'));
  } catch (_) {
    return null;
  }
}

function resiarCurrentSearchQueryFromModal(modal) {
  try {
    const input = modal?.querySelector('input[type="search"], input');
    return String(input?.value || '').trim();
  } catch (_) {
    return '';
  }
}

function resiarSearchPreviewPool(query) {
  let pool = [];
  try {
    if (typeof window.resiarGetCurrentFilteredQuestions === 'function') {
      const scoped = window.resiarGetCurrentFilteredQuestions();
      if (Array.isArray(scoped)) pool = scoped;
    }
  } catch (_) {}

  if (!Array.isArray(pool) || !pool.length) pool = deps.getPreguntas() || [];
  return pool.filter((question) => resiarQuestionMatchesSearchQuery(question, query));
}

function resiarVisibleSearchCards(modal) {
  if (!modal) return [];
  const actionRe = /GENERAR EXAMEN CON LAS COINCIDENCIAS Y EMPEZAR ACÁ/i;

  const actionNodes = Array.from(modal.querySelectorAll('a,button,div,span,p'))
    .filter((el) => {
      const text = String(el.textContent || '').trim();
      return actionRe.test(text) && text.length < 140;
    });

  const cards = [];
  actionNodes.forEach((node) => {
    let card = node.closest('article,li,[data-question-id],[data-id]') || node.parentElement;
    for (let i = 0; i < 4 && card && card !== modal; i += 1) {
      const text = String(card.textContent || '');
      const rect = card.getBoundingClientRect?.();
      if (
        actionRe.test(text) &&
        rect &&
        rect.width >= 260 &&
        rect.height >= 38 &&
        rect.height <= 180
      ) break;
      card = card.parentElement;
    }

    if (card && card !== modal && !cards.includes(card)) cards.push(card);
  });

  return cards.slice(0, RESIAR_SEARCH_PREVIEW_LIMIT);
}

function resiarInsertSearchPreview(card, text) {
  try {
    const clean = resiarCleanSearchPreviewText(text);
    if (!card || !clean) return;

    const old = card.querySelector(':scope > .resiar-search-case-preview, .resiar-search-case-preview');
    if (old) old.remove();

    const preview = document.createElement('div');
    preview.className = 'resiar-search-case-preview';
    preview.textContent = clean.length > 260 ? clean.slice(0, 260).trim() + '…' : clean;
    preview.style.cssText = [
      'margin:6px 0 8px',
      'font-size:.86rem',
      'line-height:1.35',
      'font-weight:650',
      'color:var(--text,#111827)',
      'opacity:.92'
    ].join(';');

    const action = Array.from(card.querySelectorAll('a,button,div,span,p'))
      .find((el) => /GENERAR EXAMEN CON LAS COINCIDENCIAS Y EMPEZAR ACÁ/i.test(String(el.textContent || '')));

    if (action && action.parentNode === card) card.insertBefore(preview, action);
    else card.appendChild(preview);
  } catch (_) {}
}

function resiarSearchPreviewCacheKey(query, pool) {
  const ids = pool.slice(0, RESIAR_SEARCH_PREVIEW_LIMIT).map((q) => String(q?.id ?? '')).join('|');
  return normalizeSearchText(query) + '::' + ids;
}

function resiarApplySearchPreviews(cards, pool, hydratedById) {
  cards.forEach((card, index) => {
    const local = pool[index];
    const id = local?.id != null ? String(local.id) : '';
    const hydrated = id ? hydratedById.get(id) : null;
    const text = resiarSearchPreviewTextFromQuestion(hydrated || local);
    resiarInsertSearchPreview(card, text);
  });
}

function resiarApplySearchPreviewTextMap(cards, pool, textById) {
  cards.forEach((card, index) => {
    const local = pool[index];
    const id = local?.id != null ? String(local.id) : '';
    const text = id ? textById.get(id) : '';
    if (text) resiarInsertSearchPreview(card, text);
  });
}

async function resiarHydrateVisibleSearchPreviews() {
  const seq = ++resiarSearchPreviewSeq;

  try {
    const modal = resiarFindSearchModal();
    if (!modal) return;

    const query = resiarCurrentSearchQueryFromModal(modal);
    if (normalizeSearchText(query).length < 2) return;

    const cards = resiarVisibleSearchCards(modal);
    if (!cards.length) return;

    const matches = resiarSearchPreviewPool(query).slice(0, cards.length);
    if (!matches.length) return;

    // Si el banco local ya trae texto, mostrarlo inmediatamente.
    const localById = new Map(matches.map((q) => [String(q?.id ?? ''), q]));
    resiarApplySearchPreviews(cards, matches, localById);

    // Si todos los cards ya tienen preview útil, no pedir backend.
    const missing = matches.filter((q) => !resiarSearchPreviewTextFromQuestion(q));
    if (!missing.length) return;

    const cacheKey = resiarSearchPreviewCacheKey(query, matches);
    if (resiarSearchPreviewCache.has(cacheKey)) {
      const cached = resiarSearchPreviewCache.get(cacheKey);
      if (seq === resiarSearchPreviewSeq) {
        if (cached?.kind === 'text') resiarApplySearchPreviewTextMap(cards, matches, cached.map);
        else resiarApplySearchPreviews(cards, matches, cached);
      }
      return;
    }

    // v99: alternativa correcta para antes de crear examen.
    // Un RPC sanitizado devuelve solo preview del enunciado para IDs visibles.
    // No crea sesión de examen y no expone respuesta ni explicación.
    const rpcPreviewMap = await resiarFetchQuestionSearchPreviewsRpc(matches.map((q) => q?.id));
    if (seq !== resiarSearchPreviewSeq) return;

    if (rpcPreviewMap && rpcPreviewMap.size) {
      resiarSearchPreviewCache.set(cacheKey, { kind: 'text', map: rpcPreviewMap });
      resiarApplySearchPreviewTextMap(cards, matches, rpcPreviewMap);
      return;
    }

    // Fallback: si el RPC no está instalado, usar sesión segura.
    // Esto suele funcionar mejor una vez dentro de un examen, pero no es la vía ideal.
    if (!deps.resiarSecureExamEnabled()) return;

    const secure = await deps.resiarCreateSecureExamFromCatalog(matches, {
      mode: 'search_preview',
      limit: Math.min(matches.length, RESIAR_SEARCH_PREVIEW_LIMIT),
      filters: {
        source: 'question_search_preview',
        query: String(query).slice(0, 80)
      }
    });

    if (seq !== resiarSearchPreviewSeq) return;

    const hydrated = Array.isArray(secure?.questions) ? secure.questions : [];
    const byId = new Map(hydrated.map((q) => [String(q?.id ?? ''), q]));
    resiarSearchPreviewCache.set(cacheKey, byId);
    resiarApplySearchPreviews(cards, matches, byId);
  } catch (error) {
    console.warn('[ResiAR] No se pudieron hidratar previews del buscador:', error);
  }
}

function resiarScheduleSearchPreviewHydration(delay = 160) {
  try {
    clearTimeout(resiarSearchPreviewTimer);
    resiarSearchPreviewTimer = setTimeout(() => {
      resiarTrimSearchVisibleOptionSuffix();
      resiarHydrateVisibleSearchPreviews();
    }, delay);
  } catch (_) {}
}
