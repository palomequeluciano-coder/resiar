import { readResultSyncQueue } from './resultSyncQueue.js';

const DEFAULT_MIN_ANSWERS = 3;
const DEFAULT_THRESHOLD = 70;
const DEFAULT_MAX_FALLBACK = 3;
const DEFAULT_RECENT_LIMIT = 200;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clean(value, fallback = '') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function identity(value) {
  return clean(value);
}

function defaultNormalize(value) {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function percent(correct, total) {
  const t = safeNumber(total);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((safeNumber(correct) / t) * 100)));
}

function normalizeWith(fn, value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    return clean(fn(raw));
  } catch (_) {
    return defaultNormalize(raw);
  }
}

function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  const text = clean(value).toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
}

function normalizeTopic(value) {
  return defaultNormalize(value || '');
}

export function performanceTopicKey(specialtyKey, topicLabel) {
  const s = clean(specialtyKey) || defaultNormalize('General');
  const t = normalizeTopic(topicLabel);
  return t ? `${s}::${t}` : '';
}

function createBucket({ key, label, kind, specialty = '', topic = '' }) {
  return {
    key,
    e: label,
    label,
    kind,
    specialty,
    topic,
    c: 0,
    t: 0,
    sourceCounts: { remote: 0, pending: 0, localFallback: 0 },
    lastSeenAt: ''
  };
}

function bumpLastSeen(bucket, value) {
  const iso = clean(value);
  if (!iso) return;
  if (!bucket.lastSeenAt || iso > bucket.lastSeenAt) bucket.lastSeenAt = iso;
}

function addBucket(map, descriptor) {
  const key = clean(descriptor.key);
  if (!key) return;

  if (!map.has(key)) {
    map.set(key, createBucket(descriptor));
  }

  const bucket = map.get(key);
  const total = Math.max(0, safeNumber(descriptor.total));
  const correct = Math.max(0, safeNumber(descriptor.correct));
  if (!total) return;

  bucket.c += Math.min(correct, total);
  bucket.t += total;
  if (descriptor.source && bucket.sourceCounts[descriptor.source] != null) {
    bucket.sourceCounts[descriptor.source] += total;
  }
  bumpLastSeen(bucket, descriptor.createdAt);
}

function mapToEntries(map) {
  return Array.from(map.values())
    .filter((item) => item && item.t > 0)
    .map((item) => ({
      ...item,
      c: Math.round(item.c * 100) / 100,
      t: Math.round(item.t * 100) / 100,
      pct: percent(item.c, item.t)
    }))
    .sort((a, b) => a.pct - b.pct || b.t - a.t || String(a.label).localeCompare(String(b.label), 'es', { sensitivity: 'base' }));
}

function defaultSplitSpecialties(value) {
  return clean(value || 'General')
    .split(',')
    .map((item) => clean(item))
    .filter(Boolean);
}

function splitSpecialties(value, options) {
  const splitter = typeof options.splitEspecialidades === 'function' ? options.splitEspecialidades : defaultSplitSpecialties;
  try {
    const list = splitter(value || 'General');
    const cleanList = safeArray(list).map((item) => clean(item)).filter(Boolean);
    return cleanList.length ? cleanList : ['General'];
  } catch (_) {
    return defaultSplitSpecialties(value || 'General');
  }
}

function questionIdCandidates(question) {
  const values = [
    question?.id,
    question?.numero,
    question?.num_original,
    question?.question_id,
    question?.pregunta_id
  ];
  return values.map((value) => clean(value)).filter(Boolean);
}

function buildQuestionIndex(questions) {
  const map = new Map();
  safeArray(questions).forEach((question) => {
    questionIdCandidates(question).forEach((id) => {
      if (!map.has(id)) map.set(id, question);
    });
  });
  return map;
}

function questionSpecialties(question, options) {
  const labeler = typeof options.espLabel === 'function'
    ? options.espLabel
    : (item) => item?.especialidad_v2 || item?.especialidad || 'General';
  let raw = 'General';
  try { raw = labeler(question) || 'General'; } catch (_) {}
  return splitSpecialties(raw, options);
}

function questionTopic(question, options) {
  const labeler = typeof options.topicLabel === 'function'
    ? options.topicLabel
    : (item) => item?.tema_v2 || item?.tema || '';
  try { return clean(labeler(question)); } catch (_) { return clean(question?.tema_v2 || question?.tema || ''); }
}

function addAnswerToMaps({ specialtyMap, topicMap, row, question, correct, total, source, createdAt, options }) {
  const normalizeSpecialty = options.normalizeSpecialty || identity;
  const specialties = row
    ? splitSpecialties(row.especialidad_v2 || row.especialidad || row.specialty || 'General', options)
    : questionSpecialties(question, options);
  const parts = Math.max(1, specialties.length || 1);
  const c = safeNumber(correct) / parts;
  const t = safeNumber(total) / parts;
  const topic = row ? clean(row.tema_v2 || row.tema || row.topic || '') : questionTopic(question, options);

  specialties.forEach((specialty) => {
    const specialtyKey = normalizeWith(normalizeSpecialty, specialty) || defaultNormalize(specialty || 'General');
    addBucket(specialtyMap, {
      key: specialtyKey,
      label: specialty,
      kind: 'specialty',
      specialty,
      correct: c,
      total: t,
      source,
      createdAt
    });

    const topicKey = performanceTopicKey(specialtyKey, topic);
    if (topicKey) {
      addBucket(topicMap, {
        key: topicKey,
        label: `${specialty} · ${topic}`,
        kind: 'topic',
        specialty,
        topic,
        correct: c,
        total: t,
        source,
        createdAt
      });
    }
  });
}

function rowIsDetailedAnswer(row) {
  return row && typeof row === 'object' && (
    row.question_id != null ||
    row.is_correct != null ||
    row.is_answered != null ||
    row.is_annulled != null ||
    row.selected_answer != null ||
    row.correct_answer != null
  );
}

function rowIsScorableAnswer(row) {
  if (!rowIsDetailedAnswer(row)) return false;
  if (row.is_answered === false || row.is_answered === 'false' || row.is_answered === 0 || row.is_answered === '0') return false;
  if (row.is_annulled === true || row.is_annulled === 'true' || row.is_annulled === 1 || row.is_annulled === '1') return false;
  return row.is_correct != null;
}

export function collectRemotePerformance(rows, options = {}) {
  const specialtyMap = new Map();
  const topicMap = new Map();

  safeArray(rows).forEach((row) => {
    if (!row || typeof row !== 'object') return;

    let total = safeNumber(row.total ?? row.respondidas ?? row.t, 0);
    let correct = safeNumber(row.correctas ?? row.c, 0);

    if (rowIsScorableAnswer(row)) {
      total = 1;
      correct = asBool(row.is_correct, false) ? 1 : 0;
    } else if (!total && row.es_correcta != null) {
      total = 1;
      correct = row.es_correcta === true || row.es_correcta === 1 ? 1 : 0;
    }

    if (total <= 0) return;
    addAnswerToMaps({
      specialtyMap,
      topicMap,
      row,
      question: null,
      correct,
      total,
      source: 'remote',
      createdAt: row.created_at || row.fecha || row.inserted_at || '',
      options
    });
  });

  return {
    specialtyEntries: mapToEntries(specialtyMap),
    topicEntries: mapToEntries(topicMap)
  };
}

export function collectRemoteQuestionSignals(rows, options = {}) {
  const latestByQuestion = new Map();
  const recentLimit = Math.max(1, safeNumber(options.recentLimit, DEFAULT_RECENT_LIMIT));

  safeArray(rows).forEach((row) => {
    if (!row || typeof row !== 'object' || !rowIsScorableAnswer(row)) return;
    const id = clean(row.question_id || row.id || row.pregunta_id);
    if (!id) return;

    const createdAt = clean(row.created_at || row.fecha || row.inserted_at || '');
    const current = {
      id,
      createdAt,
      isCorrect: asBool(row.is_correct, false),
      timeMs: safeNumber(row.time_ms, 0),
      specialty: clean(row.especialidad_v2 || row.especialidad || row.specialty || 'General'),
      topic: clean(row.tema_v2 || row.tema || row.topic || '')
    };

    const previous = latestByQuestion.get(id);
    if (!previous || !previous.createdAt || (createdAt && createdAt >= previous.createdAt)) {
      latestByQuestion.set(id, current);
    }
  });

  const latest = Array.from(latestByQuestion.values())
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return {
    answeredQuestionIds: latest.map((item) => item.id),
    failedQuestionIds: latest.filter((item) => !item.isCorrect).map((item) => item.id),
    correctQuestionIds: latest.filter((item) => item.isCorrect).map((item) => item.id),
    recentQuestionIds: latest.slice(0, recentLimit).map((item) => item.id),
    latestByQuestion: latest
  };
}

export function collectLocalFallbackPerformance(localStats, options = {}) {
  const specialtyMap = new Map();
  const topicMap = new Map();
  const normalizeSpecialty = options.normalizeSpecialty || identity;
  const esps = localStats && typeof localStats.esps === 'object' ? localStats.esps : {};

  Object.entries(esps || {}).forEach(([specialty, value]) => {
    if (!value || typeof value !== 'object') return;
    const specialtyKey = normalizeWith(normalizeSpecialty, specialty) || defaultNormalize(specialty || 'General');
    addBucket(specialtyMap, {
      key: specialtyKey,
      label: specialty,
      kind: 'specialty',
      specialty,
      correct: value.c,
      total: value.t,
      source: 'localFallback',
      createdAt: ''
    });
  });

  return {
    specialtyEntries: mapToEntries(specialtyMap),
    topicEntries: mapToEntries(topicMap)
  };
}

export function collectPendingPerformance(user, questions, options = {}) {
  const specialtyMap = new Map();
  const topicMap = new Map();
  const questionIndex = buildQuestionIndex(questions);
  const queue = readResultSyncQueue(user);
  let matchedAnswers = 0;
  let unmatchedAnswers = 0;

  safeArray(queue).forEach((item) => {
    const createdAt = item.createdAt || item.updatedAt || '';
    safeArray(item?.payload?.answers).forEach((answer) => {
      const question = questionIndex.get(clean(answer?.id || answer?.question_id || answer?.questionId));
      if (!question) {
        unmatchedAnswers++;
        return;
      }
      matchedAnswers++;
      const selected = clean(answer.respuesta || answer.selected_answer || answer.selectedAnswer || answer.answer).toLowerCase();
      const expected = clean(question.respuesta).toLowerCase();
      addAnswerToMaps({
        specialtyMap,
        topicMap,
        row: null,
        question,
        correct: selected && expected && selected === expected ? 1 : 0,
        total: 1,
        source: 'pending',
        createdAt,
        options
      });
    });
  });

  return {
    specialtyEntries: mapToEntries(specialtyMap),
    topicEntries: mapToEntries(topicMap),
    pendingQueueCount: queue.length,
    pendingMatchedAnswers: matchedAnswers,
    pendingUnmatchedAnswers: unmatchedAnswers
  };
}

function mergeEntries(...entryLists) {
  const map = new Map();

  entryLists.flat().filter(Boolean).forEach((entry) => {
    if (!entry || !entry.key || !entry.t) return;
    if (!map.has(entry.key)) {
      map.set(entry.key, createBucket({
        key: entry.key,
        label: entry.label || entry.e,
        kind: entry.kind || 'specialty',
        specialty: entry.specialty || '',
        topic: entry.topic || ''
      }));
    }
    const bucket = map.get(entry.key);
    bucket.c += safeNumber(entry.c);
    bucket.t += safeNumber(entry.t);
    Object.entries(entry.sourceCounts || {}).forEach(([source, total]) => {
      if (bucket.sourceCounts[source] != null) bucket.sourceCounts[source] += safeNumber(total);
    });
    bumpLastSeen(bucket, entry.lastSeenAt);
  });

  return mapToEntries(map);
}

export function selectWeakPerformanceEntries(entries, options = {}) {
  const minAnswers = Math.max(1, safeNumber(options.minAnswers, DEFAULT_MIN_ANSWERS));
  const threshold = Math.max(0, Math.min(100, safeNumber(options.threshold, DEFAULT_THRESHOLD)));
  const maxFallback = Math.max(1, safeNumber(options.maxFallback, DEFAULT_MAX_FALLBACK));

  const qualified = safeArray(entries).filter((item) => item && safeNumber(item.t) >= minAnswers);
  let weak = qualified.filter((item) => safeNumber(item.pct) < threshold);
  if (!weak.length && qualified.length) weak = qualified.slice(0, Math.min(maxFallback, qualified.length));

  return {
    hasStats: qualified.length > 0,
    entries: qualified,
    weak,
    minAnswers,
    threshold
  };
}

function sourceLabelFromCounts(entries, localFallbackUsed) {
  const totals = { remote: 0, pending: 0, localFallback: 0 };
  safeArray(entries).forEach((entry) => {
    Object.entries(entry.sourceCounts || {}).forEach(([source, total]) => {
      if (totals[source] != null) totals[source] += safeNumber(total);
    });
  });

  if (totals.remote && totals.pending) return 'remote+pending';
  if (totals.remote) return 'remote';
  if (totals.pending) return 'pending';
  if (localFallbackUsed || totals.localFallback) return 'local-fallback';
  return 'none';
}

export function buildUserPerformanceModel(options = {}) {
  const user = options.user || null;
  const questions = safeArray(options.questions);
  const remote = collectRemotePerformance(options.remoteRows, options);
  const pending = collectPendingPerformance(user, questions, options);
  const questionSignals = collectRemoteQuestionSignals(options.remoteRows, options);

  let specialtyEntries = mergeEntries(remote.specialtyEntries, pending.specialtyEntries);
  let topicEntries = mergeEntries(remote.topicEntries, pending.topicEntries);
  let localFallbackUsed = false;

  // Supabase es la fuente principal. El histórico local completo solo se usa si
  // todavía no hay remoto ni pendientes enriquecibles para evitar doble conteo.
  if (!specialtyEntries.length && options.localStats) {
    const local = collectLocalFallbackPerformance(options.localStats, options);
    specialtyEntries = mergeEntries(local.specialtyEntries);
    topicEntries = mergeEntries(local.topicEntries);
    localFallbackUsed = specialtyEntries.length > 0;
  }

  const specialtySelection = selectWeakPerformanceEntries(specialtyEntries, options);
  const topicSelection = selectWeakPerformanceEntries(topicEntries, options);
  const activeScope = topicSelection.weak.length ? 'topic' : 'specialty';

  return {
    version: 2,
    source: sourceLabelFromCounts(specialtyEntries, localFallbackUsed),
    sourceCounts: {
      remoteRows: safeArray(options.remoteRows).length,
      pendingQueueItems: pending.pendingQueueCount,
      pendingMatchedAnswers: pending.pendingMatchedAnswers,
      pendingUnmatchedAnswers: pending.pendingUnmatchedAnswers,
      localFallbackUsed
    },
    specialtyEntries,
    topicEntries,
    weakSpecialties: specialtySelection.weak,
    weakTopics: topicSelection.weak,
    failedQuestionIds: questionSignals.failedQuestionIds,
    answeredQuestionIds: questionSignals.answeredQuestionIds,
    correctQuestionIds: questionSignals.correctQuestionIds,
    recentQuestionIds: questionSignals.recentQuestionIds,
    latestQuestionSignals: questionSignals.latestByQuestion,
    hasStats: specialtySelection.hasStats || topicSelection.hasStats,
    activeScope,
    minAnswers: specialtySelection.minAnswers,
    threshold: specialtySelection.threshold
  };
}
