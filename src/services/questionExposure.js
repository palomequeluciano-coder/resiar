import { uniqueQuestionIds } from './secureExamSession.js';

const renderedQuestionKeys = new Set();

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePayload(data) {
  if (Array.isArray(data)) return data[0] || {};
  if (data && typeof data === 'object') return data;
  return {};
}

function questionIdOf(question) {
  const id = question && question.id != null ? String(question.id).trim() : '';
  return id || '';
}

function normalizeSessionId(sessionId) {
  const sid = String(sessionId || '').trim();
  return sid || null;
}

function fallbackUniqueQuestions(questions) {
  const out = [];
  const seen = new Set();
  for (const question of asArray(questions)) {
    const id = questionIdOf(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(question);
  }
  return out;
}

export function resetQuestionExposureRenderTracker() {
  renderedQuestionKeys.clear();
}

export async function buildBalancedRandomQuestionPool({
  supabase,
  questions,
  limit = 100,
  mode = 'exam',
  filters = {}
} = {}) {
  const fallback = fallbackUniqueQuestions(questions);
  if (!fallback.length) return fallback;

  if (!supabase || typeof supabase.rpc !== 'function') return fallback;

  const ids = uniqueQuestionIds(fallback.map((question) => question && question.id));
  if (!ids.length) return fallback;

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 10000));
  const byId = new Map(fallback.map((question) => [questionIdOf(question), question]));

  const { data, error } = await supabase.rpc('get_balanced_question_ids_v1', {
    p_question_ids: ids,
    p_limit: safeLimit,
    p_mode: String(mode || 'exam'),
    p_filters: filters && typeof filters === 'object' ? filters : {}
  });

  if (error) throw error;

  const payload = normalizePayload(data);
  const orderedIds = asArray(payload.question_ids || payload.questionIds)
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  if (!orderedIds.length) return fallback;

  const ordered = [];
  const seen = new Set();
  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const question = byId.get(id);
    if (!question) continue;
    seen.add(id);
    ordered.push(question);
  }

  for (const question of fallback) {
    const id = questionIdOf(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(question);
  }

  try {
    window.__resiarLastBalancedRandomSelection = {
      ...(payload.diagnostics || {}),
      requestedIds: ids.length,
      returnedIds: orderedIds.length,
      finalPool: ordered.length,
      source: 'get_balanced_question_ids_v1',
      at: new Date().toISOString()
    };
  } catch (_) {}

  return ordered;
}

export function markRenderedQuestionSeen({
  supabase,
  user,
  question,
  mode = 'exam',
  sessionId = null
} = {}) {
  const qid = questionIdOf(question);
  if (!qid) return false;
  if (!user) return false;
  if (!supabase || typeof supabase.rpc !== 'function') return false;

  const normalizedMode = String(mode || 'exam').trim() || 'exam';
  if (normalizedMode !== 'exam') return false;

  const sid = normalizeSessionId(sessionId || question?._resiarSecureSessionId);
  const key = `${sid || 'no-session'}::${qid}`;
  if (renderedQuestionKeys.has(key)) return false;
  renderedQuestionKeys.add(key);

  supabase.rpc('mark_question_seen_v1', {
    p_question_id: qid,
    p_mode: normalizedMode,
    p_session_id: sid
  }).then(({ data, error }) => {
    if (error) throw error;
    try {
      const payload = normalizePayload(data);
      window.__resiarLastQuestionExposure = {
        questionId: qid,
        sessionId: sid,
        seenCount: payload.seen_count ?? payload.seenCount ?? null,
        incremented: payload.incremented !== false,
        source: 'mark_question_seen_v1',
        at: new Date().toISOString()
      };
    } catch (_) {}
  }).catch((error) => {
    renderedQuestionKeys.delete(key);
    console.warn('[ResiAR] No se pudo registrar la pregunta vista:', error?.message || error);
  });

  return true;
}
