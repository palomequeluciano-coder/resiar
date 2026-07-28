import {
  collectLocalFallbackPerformance,
  collectRemotePerformance,
  performanceTopicKey,
  selectWeakPerformanceEntries
} from './performanceEngine.js';

const DEFAULT_MIN_ANSWERS = 3;
const DEFAULT_THRESHOLD = 70;
const DEFAULT_MAX_FALLBACK = 3;
const DEFAULT_LIMIT = 50;
const WEAKNESS_EXAM_DISTRIBUTION = Object.freeze({
  weakTopics: 0.40,
  failedQuestions: 0.25,
  weakSpecialtyNew: 0.20,
  generalReview: 0.15
});

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function identity(value) {
  return String(value == null ? '' : value).trim();
}

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function defaultNormalize(value) {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function normalizeWith(fn, value) {
  const raw = clean(value);
  if (!raw) return '';
  try { return clean(fn(raw)); } catch (_) { return defaultNormalize(raw); }
}

function defaultSplitSpecialties(value) {
  return clean(value || 'General').split(',').map((item) => clean(item)).filter(Boolean);
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
  return [
    question?.id,
    question?.numero,
    question?.num_original,
    question?.question_id,
    question?.pregunta_id
  ].map((value) => clean(value)).filter(Boolean);
}

function questionId(question) {
  return questionIdCandidates(question)[0] || clean(question?.pregunta) || '';
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueQuestions(list) {
  const seen = new Set();
  const output = [];
  safeArray(list).forEach((question) => {
    const key = questionId(question);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(question);
  });
  return output;
}

function buildDistributionTargets(limit, flags = {}) {
  const safeLimit = Math.max(1, safeNumber(limit, DEFAULT_LIMIT));
  const hasTopicFocus = flags.hasTopicFocus !== false;
  const hasFailedPool = flags.hasFailedPool !== false;

  const targets = {
    weakTopics: hasTopicFocus ? Math.round(safeLimit * WEAKNESS_EXAM_DISTRIBUTION.weakTopics) : 0,
    failedQuestions: hasFailedPool ? Math.floor(safeLimit * WEAKNESS_EXAM_DISTRIBUTION.failedQuestions) : 0,
    weakSpecialtyNew: Math.round(safeLimit * WEAKNESS_EXAM_DISTRIBUTION.weakSpecialtyNew),
    generalReview: 0
  };

  if (!hasTopicFocus) {
    // Si todavía no hay temas aprovechables, no se desperdicia ese 40%:
    // se redistribuye hacia preguntas nuevas de especialidades débiles.
    targets.weakSpecialtyNew += Math.round(safeLimit * WEAKNESS_EXAM_DISTRIBUTION.weakTopics);
  }

  if (!hasFailedPool) {
    // Si no hay errores previos recuperables, ese bloque se redistribuye al repaso general.
    targets.generalReview += Math.floor(safeLimit * WEAKNESS_EXAM_DISTRIBUTION.failedQuestions);
  }

  const assigned = targets.weakTopics + targets.failedQuestions + targets.weakSpecialtyNew + targets.generalReview;
  targets.generalReview += Math.max(0, safeLimit - assigned);

  // Protección ante redondeos o límites bajos.
  while ((targets.weakTopics + targets.failedQuestions + targets.weakSpecialtyNew + targets.generalReview) > safeLimit) {
    if (targets.generalReview > 0) targets.generalReview -= 1;
    else if (targets.failedQuestions > 0) targets.failedQuestions -= 1;
    else if (targets.weakSpecialtyNew > 0) targets.weakSpecialtyNew -= 1;
    else if (targets.weakTopics > 0) targets.weakTopics -= 1;
    else break;
  }

  return targets;
}

function questionMatchesIdSet(question, idSet) {
  if (!idSet || !idSet.size) return false;
  return questionIdCandidates(question).some((id) => idSet.has(id));
}

function questionSpecialtyKeys(question, options) {
  const normalizeSpecialty = options.normalizeSpecialty || identity;
  const espLabel = typeof options.espLabel === 'function' ? options.espLabel : () => 'General';
  let raw = 'General';
  try { raw = espLabel(question) || 'General'; } catch (_) {}
  return splitSpecialties(raw, options).map((specialty) => normalizeWith(normalizeSpecialty, specialty) || defaultNormalize(specialty));
}

function questionTopicKeys(question, options) {
  const topicLabel = typeof options.topicLabel === 'function'
    ? options.topicLabel
    : (item) => item?.tema_v2 || item?.tema || '';
  let topic = '';
  try { topic = clean(topicLabel(question)); } catch (_) { topic = clean(question?.tema_v2 || question?.tema || ''); }
  if (!topic) return [];
  return questionSpecialtyKeys(question, options)
    .map((specialtyKey) => performanceTopicKey(specialtyKey, topic))
    .filter(Boolean);
}

function planFromEntries(localEntries, remoteEntries, options = {}) {
  const minAnswers = Math.max(1, safeNumber(options.minAnswers, DEFAULT_MIN_ANSWERS));
  const threshold = Math.max(0, Math.min(100, safeNumber(options.threshold, DEFAULT_THRESHOLD)));
  const maxFallback = Math.max(1, safeNumber(options.maxFallback, DEFAULT_MAX_FALLBACK));

  const remoteQualified = safeArray(remoteEntries).filter((item) => item && item.t >= minAnswers);
  const localQualified = safeArray(localEntries).filter((item) => item && item.t >= minAnswers);
  const entries = remoteQualified.length ? remoteQualified : localQualified;
  const source = remoteQualified.length ? 'remote' : (localQualified.length ? 'local-fallback' : 'none');
  const selection = selectWeakPerformanceEntries(entries, { minAnswers, threshold, maxFallback });

  return {
    source,
    hasStats: selection.hasStats,
    entries: selection.entries,
    specialties: selection.weak,
    topics: [],
    activeScope: 'specialty',
    minAnswers,
    threshold
  };
}

function addFromPool({ selected, seen, pool, quota, bucketName, composition }) {
  if (!quota || quota <= 0) return;
  for (const question of shuffle(uniqueQuestions(pool))) {
    if (selected.length >= quota) break;
    const id = questionId(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(question);
    composition[bucketName] = (composition[bucketName] || 0) + 1;
  }
}

function addUntilLimit({ selected, seen, pool, limit, bucketName, composition }) {
  for (const question of shuffle(uniqueQuestions(pool))) {
    if (selected.length >= limit) break;
    const id = questionId(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(question);
    composition[bucketName] = (composition[bucketName] || 0) + 1;
  }
}

export function collectWeaknessStatsFromLocal(localStats, options = {}) {
  return collectLocalFallbackPerformance(localStats, options).specialtyEntries;
}

export function collectWeaknessStatsFromRows(rows, options = {}) {
  return collectRemotePerformance(rows, options).specialtyEntries;
}

export function chooseWeakSpecialties(localEntries, remoteEntries, options = {}) {
  return planFromEntries(localEntries, remoteEntries, options);
}

export function buildWeaknessExamPlan(options = {}) {
  const questions = safeArray(options.questions);
  const limit = Math.max(1, safeNumber(options.limit, DEFAULT_LIMIT));
  const performance = options.performance || null;

  const localEntries = performance
    ? []
    : collectWeaknessStatsFromLocal(options.localStats, options);
  const remoteEntries = performance
    ? []
    : collectWeaknessStatsFromRows(options.remoteRows, options);

  const fallbackChoice = performance
    ? null
    : planFromEntries(localEntries, remoteEntries, options);

  const weakTopics = performance ? safeArray(performance.weakTopics) : [];
  const weakSpecialties = performance ? safeArray(performance.weakSpecialties) : safeArray(fallbackChoice.specialties);
  const topicKeys = new Set(weakTopics.map((item) => item.key).filter(Boolean));
  const specialtyKeys = new Set(weakSpecialties.map((item) => item.key).filter(Boolean));
  const failedIds = new Set(safeArray(performance?.failedQuestionIds).map((id) => clean(id)).filter(Boolean));
  const answeredIds = new Set(safeArray(performance?.answeredQuestionIds).map((id) => clean(id)).filter(Boolean));
  const recentIds = new Set(safeArray(performance?.recentQuestionIds).map((id) => clean(id)).filter(Boolean));

  const topicPool = topicKeys.size
    ? questions.filter((question) => questionTopicKeys(question, options).some((key) => topicKeys.has(key)))
    : [];

  const specialtyPool = specialtyKeys.size
    ? questions.filter((question) => questionSpecialtyKeys(question, options).some((key) => specialtyKeys.has(key)))
    : [];

  const failedPool = failedIds.size
    ? questions.filter((question) => questionMatchesIdSet(question, failedIds))
    : [];

  const weakNewPool = specialtyPool.filter((question) => !questionMatchesIdSet(question, answeredIds));
  const generalReviewPool = questions.filter((question) => {
    if (questionMatchesIdSet(question, recentIds)) return false;
    if (topicKeys.size && questionTopicKeys(question, options).some((key) => topicKeys.has(key))) return false;
    if (specialtyKeys.size && questionSpecialtyKeys(question, options).some((key) => specialtyKeys.has(key))) return false;
    return true;
  });

  const hasTopicFocus = topicPool.length > 0 && weakTopics.length > 0;
  const distributionTargets = buildDistributionTargets(limit, {
    hasTopicFocus,
    hasFailedPool: failedPool.length > 0
  });

  const selected = [];
  const seen = new Set();
  const composition = {
    weakTopics: 0,
    failedQuestions: 0,
    weakSpecialtyNew: 0,
    generalReview: 0,
    fillWeakSpecialty: 0,
    fillAny: 0
  };

  addFromPool({ selected, seen, pool: topicPool, quota: selected.length + distributionTargets.weakTopics, bucketName: 'weakTopics', composition });
  addFromPool({ selected, seen, pool: failedPool, quota: selected.length + distributionTargets.failedQuestions, bucketName: 'failedQuestions', composition });
  addFromPool({ selected, seen, pool: weakNewPool, quota: selected.length + distributionTargets.weakSpecialtyNew, bucketName: 'weakSpecialtyNew', composition });
  addFromPool({ selected, seen, pool: generalReviewPool, quota: selected.length + distributionTargets.generalReview, bucketName: 'generalReview', composition });

  addUntilLimit({ selected, seen, pool: specialtyPool, limit, bucketName: 'fillWeakSpecialty', composition });
  addUntilLimit({ selected, seen, pool: questions, limit, bucketName: 'fillAny', composition });

  const source = performance ? performance.source : fallbackChoice.source;
  const hasStats = performance ? performance.hasStats : fallbackChoice.hasStats;
  const activeScope = hasTopicFocus ? 'topic' : 'specialty';

  return {
    source,
    hasStats,
    activeScope,
    entries: performance ? performance.specialtyEntries : fallbackChoice.entries,
    topicEntries: performance ? performance.topicEntries : [],
    specialties: weakSpecialties,
    topics: weakTopics,
    localEntries,
    remoteEntries,
    performance,
    pool: selected.slice(0, limit),
    composition,
    diagnostics: {
      topicPool: topicPool.length,
      specialtyPool: specialtyPool.length,
      failedPool: failedPool.length,
      weakNewPool: weakNewPool.length,
      generalReviewPool: generalReviewPool.length,
      answeredCount: answeredIds.size,
      recentCount: recentIds.size,
      limit,
      desiredDistribution: WEAKNESS_EXAM_DISTRIBUTION,
      distributionTargets
    },
    minAnswers: performance?.minAnswers ?? fallbackChoice?.minAnswers ?? DEFAULT_MIN_ANSWERS,
    threshold: performance?.threshold ?? fallbackChoice?.threshold ?? DEFAULT_THRESHOLD
  };
}
