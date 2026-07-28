const RESULT_SYNC_QUEUE_LEGACY_KEY = 'resiar_result_sync_queue_v1';
const RESULT_SYNC_QUEUE_PREFIX = 'resiar_result_sync_queue_v2';
const MAX_QUEUE_ITEMS = 30;
const MAX_ATTEMPTS = 8;
const inFlightFlushes = new Map();

function nowIso() {
  return new Date().toISOString();
}

function safeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_) {}
  return `rsq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function storage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

function userStoragePart(user) {
  const raw = user?.id || user?.user_id || user?.email || '';
  return String(raw || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '_');
}

export function resultSyncQueueKey(user) {
  const part = userStoragePart(user);
  return part ? `${RESULT_SYNC_QUEUE_PREFIX}:${part}` : '';
}


function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return fallback;
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeAnswerPayload(answer) {
  if (!answer || typeof answer !== 'object') return null;
  const id = cleanText(answer.id || answer.question_id || answer.questionId || answer.pregunta_id);
  const respuesta = cleanText(answer.respuesta || answer.selected_answer || answer.selectedAnswer || answer.answer).toLowerCase();
  if (!id || !respuesta) return null;

  const out = {
    ...answer,
    id,
    question_id: cleanText(answer.question_id || answer.questionId || id) || id,
    respuesta,
    selected_answer: cleanText(answer.selected_answer || answer.selectedAnswer || respuesta).toLowerCase() || respuesta
  };

  if ('correct_answer' in answer || 'correctAnswer' in answer) out.correct_answer = cleanText(answer.correct_answer || answer.correctAnswer).toLowerCase() || null;
  if ('is_correct' in answer || 'isCorrect' in answer) out.is_correct = normalizeBool(answer.is_correct ?? answer.isCorrect, false);
  if ('is_answered' in answer || 'isAnswered' in answer) out.is_answered = normalizeBool(answer.is_answered ?? answer.isAnswered, true);
  if ('is_annulled' in answer || 'isAnnulled' in answer || 'anulada' in answer) out.is_annulled = normalizeBool(answer.is_annulled ?? answer.isAnnulled ?? answer.anulada, false);

  const timeMs = normalizeNullableNumber(answer.time_ms ?? answer.timeMs ?? answer.tiempo_ms);
  if (timeMs != null) out.time_ms = Math.max(0, Math.round(timeMs));

  const questionIndex = normalizeNullableNumber(answer.question_index ?? answer.questionIndex ?? answer.index);
  if (questionIndex != null) out.question_index = Math.max(0, Math.round(questionIndex));

  ['especialidad', 'especialidad_v2', 'tema', 'tema_v2', 'subtema', 'subtema_v2', 'mode'].forEach((key) => {
    if (key in answer) out[key] = cleanText(answer[key]);
  });

  if (answer.metadata && typeof answer.metadata === 'object' && !Array.isArray(answer.metadata)) {
    out.metadata = answer.metadata;
  }

  return out;
}

function normalizePayload(value) {
  const answers = Array.isArray(value?.answers)
    ? value.answers.map(normalizeAnswerPayload).filter(Boolean)
    : [];
  return {
    answers,
    tiempo: value?.tiempo == null ? null : Number(value.tiempo),
    duration_ms: value?.duration_ms == null ? null : Number(value.duration_ms),
    mode: cleanText(value?.mode || 'exam') || 'exam',
    source: cleanText(value?.source || 'web') || 'web'
  };
}

function normalizeQueue(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((item) => item && item.payload && Array.isArray(item.payload.answers) && item.payload.answers.length)
    .map((item) => ({
      id: String(item.id || safeId()),
      createdAt: item.createdAt || nowIso(),
      updatedAt: item.updatedAt || item.createdAt || nowIso(),
      attempts: Number.isFinite(Number(item.attempts)) ? Number(item.attempts) : 0,
      lastError: item.lastError ? String(item.lastError).slice(0, 220) : '',
      payload: normalizePayload(item.payload)
    }))
    .slice(-MAX_QUEUE_ITEMS);
}

function readQueueFromKey(s, key) {
  if (!s || !key) return [];
  try {
    const raw = s.getItem(key);
    if (!raw) return [];
    return normalizeQueue(JSON.parse(raw));
  } catch (_) {
    return [];
  }
}

function writeQueueToKey(s, key, queue) {
  if (!s || !key) return false;
  try {
    const normalized = normalizeQueue(queue).slice(-MAX_QUEUE_ITEMS);
    if (!normalized.length) {
      s.removeItem(key);
    } else {
      s.setItem(key, JSON.stringify(normalized));
    }
    return true;
  } catch (_) {
    return false;
  }
}

function migrateLegacyQueueIfNeeded(s, key) {
  if (!s || !key) return [];
  const current = readQueueFromKey(s, key);
  if (current.length) return current;

  const legacy = readQueueFromKey(s, RESULT_SYNC_QUEUE_LEGACY_KEY);
  if (!legacy.length) return [];

  // La cola vieja era global y podía cruzarse entre cuentas. Se migra una sola vez
  // al usuario logueado actual y se elimina la clave global para evitar reenvíos
  // con tokens de otra cuenta.
  const migrated = legacy.map((item) => ({
    ...item,
    updatedAt: nowIso(),
    lastError: item.lastError || 'migrated_from_global_queue'
  }));
  writeQueueToKey(s, key, migrated);
  try { s.removeItem(RESULT_SYNC_QUEUE_LEGACY_KEY); } catch (_) {}
  return migrated;
}

export function readResultSyncQueue(user) {
  const s = storage();
  const key = resultSyncQueueKey(user);
  if (!s || !key) return [];
  return migrateLegacyQueueIfNeeded(s, key);
}

export function writeResultSyncQueue(user, queue) {
  const s = storage();
  const key = resultSyncQueueKey(user);
  if (!s || !key) return false;
  return writeQueueToKey(s, key, queue);
}

export function getPendingResultSyncCount(user) {
  return readResultSyncQueue(user).length;
}

export function enqueueResultSync(user, payload, meta = {}) {
  const normalizedPayload = normalizePayload(payload);
  const answers = normalizedPayload.answers;
  if (!answers.length) return false;

  const queue = readResultSyncQueue(user);
  const item = {
    id: safeId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    attempts: Number.isFinite(Number(meta.attempts)) ? Number(meta.attempts) : 0,
    lastError: meta.lastError ? String(meta.lastError).slice(0, 220) : '',
    payload: normalizedPayload
  };

  queue.push(item);
  return writeResultSyncQueue(user, queue.slice(-MAX_QUEUE_ITEMS)) ? item.id : false;
}

function shouldRetryStatus(status) {
  return status === 0 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function submitPayload({ endpoint, token, payload, fetchImpl = fetch }) {
  if (!endpoint || !token || !payload?.answers?.length) {
    return { ok: false, retryable: false, status: 0, error: 'missing_endpoint_token_or_payload' };
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) return { ok: true, retryable: false, status: response.status };

    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error || errorBody?.message || `HTTP ${response.status}`;
    return {
      ok: false,
      retryable: shouldRetryStatus(response.status),
      status: response.status,
      error: String(message).slice(0, 220)
    };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      status: 0,
      error: String(error?.message || error || 'fetch_failed').slice(0, 220)
    };
  }
}

export async function submitOrQueueResultSync({ user, endpoint, token, payload, fetchImpl = fetch }) {
  const itemId = enqueueResultSync(user, payload, { lastError: 'pending_flush' });
  if (!itemId) {
    return { ok: false, retryable: false, queued: false, status: 0, error: 'empty_or_unwritable_payload' };
  }

  const result = await flushResultSyncQueue({ user, endpoint, token, fetchImpl });
  if (Array.isArray(result.sentIds) && result.sentIds.includes(itemId)) {
    return { ok: true, retryable: false, queued: false, status: 200 };
  }

  if (Array.isArray(result.droppedIds) && result.droppedIds.includes(itemId)) {
    return { ok: false, retryable: false, queued: false, status: result.lastStatus || 0, error: result.lastError || 'sync_dropped' };
  }

  return { ok: false, retryable: true, queued: true, status: result.lastStatus || 0, error: result.lastError || 'queued' };
}

async function flushResultSyncQueueNow({ user, endpoint, token, fetchImpl = fetch } = {}) {
  const queue = readResultSyncQueue(user);
  if (!queue.length) return { attempted: 0, sent: 0, kept: 0, sentIds: [], droppedIds: [] };
  if (!endpoint || !token) return { attempted: 0, sent: 0, kept: queue.length, sentIds: [], droppedIds: [], lastError: 'missing_endpoint_or_token', lastStatus: 0 };

  const kept = [];
  const sentIds = [];
  const droppedIds = [];
  let sent = 0;
  let attempted = 0;
  let lastError = '';
  let lastStatus = 0;

  for (const item of queue) {
    attempted++;
    const result = await submitPayload({ endpoint, token, payload: item.payload, fetchImpl });
    lastStatus = Number(result.status || 0);
    if (result.error) lastError = result.error;

    if (result.ok) {
      sent++;
      sentIds.push(item.id);
      continue;
    }

    const attempts = Number(item.attempts || 0) + 1;
    if (result.retryable && attempts < MAX_ATTEMPTS) {
      kept.push({
        ...item,
        attempts,
        updatedAt: nowIso(),
        lastError: result.error || `HTTP ${result.status || 0}`
      });
    } else {
      droppedIds.push(item.id);
    }
  }

  writeResultSyncQueue(user, kept);
  return { attempted, sent, kept: kept.length, sentIds, droppedIds, lastError, lastStatus };
}

export async function flushResultSyncQueue({ user, endpoint, token, fetchImpl = fetch } = {}) {
  const key = resultSyncQueueKey(user);
  if (!key) return { attempted: 0, sent: 0, kept: 0, sentIds: [], droppedIds: [] };
  if (inFlightFlushes.has(key)) return inFlightFlushes.get(key);

  const promise = flushResultSyncQueueNow({ user, endpoint, token, fetchImpl })
    .finally(() => { inFlightFlushes.delete(key); });
  inFlightFlushes.set(key, promise);
  return promise;
}

export function getResultSyncQueueStorageInfo(user) {
  return {
    key: resultSyncQueueKey(user),
    legacyKey: RESULT_SYNC_QUEUE_LEGACY_KEY,
    pending: getPendingResultSyncCount(user),
    userScoped: !!resultSyncQueueKey(user)
  };
}
