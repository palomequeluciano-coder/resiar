const DEFAULT_LIMIT = 50;
const MISTAKES_EXAM_DISTRIBUTION = Object.freeze({
  activeErrors: 0.50,
  recurrentErrors: 0.25,
  correctedErrors: 0.15,
  relatedReinforcement: 0.10
});

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clean(value) {
  return String(value == null ? '' : value).trim();
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

function defaultNormalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
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

function defaultSplitSpecialties(value) {
  return clean(value || 'General')
    .split(',')
    .map((item) => clean(item))
    .filter(Boolean);
}

function splitSpecialties(value, options) {
  const splitter = typeof options.splitEspecialidades === 'function'
    ? options.splitEspecialidades
    : defaultSplitSpecialties;

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

function buildQuestionIndex(questions) {
  const map = new Map();

  safeArray(questions).forEach((question) => {
    questionIdCandidates(question).forEach((id) => {
      if (id && !map.has(id)) map.set(id, question);
    });
  });

  return map;
}

function findQuestion(index, id) {
  const cleanId = clean(id);
  if (!cleanId) return null;
  return index.get(cleanId) || null;
}

function questionSpecialtyLabels(question, options) {
  const labeler = typeof options.espLabel === 'function'
    ? options.espLabel
    : (item) => item?.especialidad_v2 || item?.especialidad || 'General';

  let raw = 'General';
  try {
    raw = labeler(question) || 'General';
  } catch (_) {}

  return splitSpecialties(raw, options);
}

function questionSpecialtyKeys(question, options) {
  const normalizeSpecialty = options.normalizeSpecialty || defaultNormalize;
  return questionSpecialtyLabels(question, options)
    .map((specialty) => normalizeWith(normalizeSpecialty, specialty) || defaultNormalize(specialty))
    .filter(Boolean);
}

function questionTopicLabel(question, options) {
  const labeler = typeof options.topicLabel === 'function'
    ? options.topicLabel
    : (item) => item?.tema_v2 || item?.tema || '';

  try {
    return clean(labeler(question));
  } catch (_) {
    return clean(question?.tema_v2 || question?.tema || '');
  }
}

function topicKey(specialtyKey, topic) {
  const topicPart = defaultNormalize(topic || '');
  return specialtyKey && topicPart ? `${specialtyKey}::${topicPart}` : '';
}

function questionTopicKeys(question, options) {
  const topic = questionTopicLabel(question, options);
  if (!topic) return [];
  return questionSpecialtyKeys(question, options)
    .map((specialtyKey) => topicKey(specialtyKey, topic))
    .filter(Boolean);
}

function rowSpecialtyKeys(row, options) {
  const normalizeSpecialty = options.normalizeSpecialty || defaultNormalize;
  return splitSpecialties(row?.especialidad_v2 || row?.especialidad || row?.specialty || 'General', options)
    .map((specialty) => normalizeWith(normalizeSpecialty, specialty) || defaultNormalize(specialty))
    .filter(Boolean);
}

function rowTopicKeys(row, options) {
  const topic = clean(row?.tema_v2 || row?.tema || row?.topic || '');
  if (!topic) return [];
  return rowSpecialtyKeys(row, options)
    .map((specialtyKey) => topicKey(specialtyKey, topic))
    .filter(Boolean);
}

function rowHasQuestionPerformanceShape(row) {
  return row && typeof row === 'object' && (
    row.total_attempts != null ||
    row.wrong_attempts != null ||
    row.correct_attempts != null ||
    row.last_is_correct != null ||
    row.last_answer_at != null
  );
}

function normalizePerformanceRow(row, options = {}) {
  const questionId = clean(row?.question_id || row?.id || row?.pregunta_id);
  if (!questionId) return null;

  const totalAttempts = Math.max(0, safeNumber(row?.total_attempts ?? row?.totalAttempts ?? row?.attempts, 0));
  const wrongAttempts = Math.max(0, safeNumber(row?.wrong_attempts ?? row?.wrongAttempts, 0));
  const correctAttempts = Math.max(0, safeNumber(row?.correct_attempts ?? row?.correctAttempts, 0));
  const lastIsCorrect = asBool(row?.last_is_correct ?? row?.lastIsCorrect, false);
  const specialty = clean(row?.especialidad_v2 || row?.especialidad || row?.specialty || 'General') || 'General';
  const topic = clean(row?.tema_v2 || row?.tema || row?.topic || '');

  return {
    questionId,
    especialidad: specialty,
    tema: topic,
    subtema: clean(row?.subtema_v2 || row?.subtema || row?.subtopic || ''),
    totalAttempts,
    wrongAttempts,
    correctAttempts,
    lastAnswerAt: clean(row?.last_answer_at || row?.lastAnswerAt || row?.created_at || ''),
    lastIsCorrect,
    lastSelectedAnswer: clean(row?.last_selected_answer || row?.selected_answer || ''),
    correctAnswer: clean(row?.correct_answer || ''),
    avgTimeMs: safeNumber(row?.avg_time_ms ?? row?.avgTimeMs, 0),
    errorState: clean(row?.error_state || row?.errorState || ''),
    specialtyKeys: rowSpecialtyKeys(row, options),
    topicKeys: rowTopicKeys(row, options)
  };
}

function aggregateRawAnswerRows(rows, options = {}) {
  const map = new Map();

  safeArray(rows).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const questionId = clean(row.question_id || row.id || row.pregunta_id);
    if (!questionId) return;

    const isAnswered = row.is_answered == null ? true : asBool(row.is_answered, true);
    const isAnnulled = asBool(row.is_annulled, false);
    if (!isAnswered || isAnnulled) return;

    if (!map.has(questionId)) {
      map.set(questionId, {
        questionId,
        especialidad: clean(row.especialidad_v2 || row.especialidad || row.specialty || 'General') || 'General',
        tema: clean(row.tema_v2 || row.tema || row.topic || ''),
        subtema: clean(row.subtema_v2 || row.subtema || row.subtopic || ''),
        totalAttempts: 0,
        wrongAttempts: 0,
        correctAttempts: 0,
        lastAnswerAt: '',
        lastIsCorrect: false,
        lastSelectedAnswer: '',
        correctAnswer: clean(row.correct_answer || ''),
        timeSum: 0,
        timeCount: 0
      });
    }

    const bucket = map.get(questionId);
    const createdAt = clean(row.created_at || row.fecha || row.inserted_at || '');
    const isCorrect = asBool(row.is_correct, false);

    bucket.totalAttempts += 1;
    if (isCorrect) bucket.correctAttempts += 1;
    else bucket.wrongAttempts += 1;

    const timeMs = safeNumber(row.time_ms, 0);
    if (timeMs > 0) {
      bucket.timeSum += timeMs;
      bucket.timeCount += 1;
    }

    if (!bucket.lastAnswerAt || (createdAt && createdAt >= bucket.lastAnswerAt)) {
      bucket.lastAnswerAt = createdAt;
      bucket.lastIsCorrect = isCorrect;
      bucket.lastSelectedAnswer = clean(row.selected_answer || row.respuesta || row.answer || '');
      bucket.correctAnswer = clean(row.correct_answer || bucket.correctAnswer || '');
      bucket.especialidad = clean(row.especialidad_v2 || row.especialidad || row.specialty || bucket.especialidad || 'General') || 'General';
      bucket.tema = clean(row.tema_v2 || row.tema || row.topic || bucket.tema || '');
      bucket.subtema = clean(row.subtema_v2 || row.subtema || row.subtopic || bucket.subtema || '');
    }
  });

  return Array.from(map.values()).map((row) => normalizePerformanceRow({
    question_id: row.questionId,
    especialidad: row.especialidad,
    tema: row.tema,
    subtema: row.subtema,
    total_attempts: row.totalAttempts,
    wrong_attempts: row.wrongAttempts,
    correct_attempts: row.correctAttempts,
    last_answer_at: row.lastAnswerAt,
    last_is_correct: row.lastIsCorrect,
    last_selected_answer: row.lastSelectedAnswer,
    correct_answer: row.correctAnswer,
    avg_time_ms: row.timeCount ? row.timeSum / row.timeCount : 0
  }, options)).filter(Boolean);
}

export function normalizeQuestionPerformance(rows, options = {}) {
  const list = safeArray(rows).filter(Boolean);
  if (!list.length) return [];

  if (list.some(rowHasQuestionPerformanceShape)) {
    return list.map((row) => normalizePerformanceRow(row, options)).filter(Boolean);
  }

  return aggregateRawAnswerRows(list, options);
}

function decorateErrorState(row) {
  const wrongAttempts = safeNumber(row.wrongAttempts, 0);
  const lastIsCorrect = !!row.lastIsCorrect;

  let errorState = row.errorState;
  if (!errorState) {
    if (wrongAttempts >= 2 && !lastIsCorrect) errorState = 'error_recurrente';
    else if (wrongAttempts > 0 && !lastIsCorrect) errorState = 'error_activo';
    else if (wrongAttempts > 0 && lastIsCorrect) errorState = 'error_corregido';
    else errorState = 'dominada';
  }

  return { ...row, errorState };
}

function sortActiveRows(a, b) {
  return safeNumber(b.wrongAttempts) - safeNumber(a.wrongAttempts)
    || String(b.lastAnswerAt || '').localeCompare(String(a.lastAnswerAt || ''));
}

function sortCorrectedRows(a, b) {
  return String(b.lastAnswerAt || '').localeCompare(String(a.lastAnswerAt || ''))
    || safeNumber(b.wrongAttempts) - safeNumber(a.wrongAttempts);
}

function buildDistributionTargets(limit, flags = {}) {
  const safeLimit = Math.max(1, safeNumber(limit, DEFAULT_LIMIT));
  const hasActive = flags.hasActive !== false;
  const hasRecurrent = flags.hasRecurrent !== false;
  const hasCorrected = flags.hasCorrected !== false;
  const hasRelated = flags.hasRelated !== false;

  const targets = {
    activeErrors: hasActive ? Math.round(safeLimit * MISTAKES_EXAM_DISTRIBUTION.activeErrors) : 0,
    recurrentErrors: hasRecurrent ? Math.floor(safeLimit * MISTAKES_EXAM_DISTRIBUTION.recurrentErrors) : 0,
    correctedErrors: hasCorrected ? Math.round(safeLimit * MISTAKES_EXAM_DISTRIBUTION.correctedErrors) : 0,
    relatedReinforcement: 0
  };

  const used = targets.activeErrors + targets.recurrentErrors + targets.correctedErrors;
  targets.relatedReinforcement = hasRelated ? Math.max(0, safeLimit - used) : 0;

  return targets;
}

function questionMatchesIdSet(question, set) {
  return questionIdCandidates(question).some((id) => set.has(id));
}

function questionsForRows(rows, questionIndex) {
  const out = [];
  const seen = new Set();

  safeArray(rows).forEach((row) => {
    const question = findQuestion(questionIndex, row.questionId);
    if (!question) return;
    const id = questionId(question);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(question);
  });

  return out;
}

function uniqueQuestions(list) {
  const out = [];
  const seen = new Set();

  safeArray(list).forEach((question) => {
    const id = questionId(question);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(question);
  });

  return out;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function addFromPool({ selected, seen, pool, quota, bucketName, composition }) {
  if (!quota || quota <= 0) return;
  for (const question of uniqueQuestions(pool)) {
    if (selected.length >= quota) break;
    const id = questionId(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(question);
    composition[bucketName] = (composition[bucketName] || 0) + 1;
  }
}

function addUntilLimit({ selected, seen, pool, limit, bucketName, composition }) {
  for (const question of uniqueQuestions(pool)) {
    if (selected.length >= limit) break;
    const id = questionId(question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    selected.push(question);
    composition[bucketName] = (composition[bucketName] || 0) + 1;
  }
}

export function buildMistakesExamPlan(options = {}) {
  const questions = safeArray(options.questions);
  const limit = Math.max(1, safeNumber(options.limit, DEFAULT_LIMIT));
  const questionRows = normalizeQuestionPerformance(options.questionRows || options.answerRows || [], options)
    .map(decorateErrorState);
  const questionIndex = buildQuestionIndex(questions);

  const activeRows = questionRows
    .filter((row) => row.wrongAttempts > 0 && row.lastIsCorrect === false)
    .sort(sortActiveRows);

  const recurrentRows = questionRows
    .filter((row) => row.wrongAttempts >= 2)
    .sort(sortActiveRows);

  const correctedRows = questionRows
    .filter((row) => row.wrongAttempts > 0 && row.lastIsCorrect === true)
    .sort(sortCorrectedRows);

  const activePool = questionsForRows(activeRows, questionIndex);
  const recurrentPool = questionsForRows(recurrentRows, questionIndex);
  const correctedPool = questionsForRows(correctedRows, questionIndex);

  const allMistakeRows = questionRows.filter((row) => row.wrongAttempts > 0);
  const allMistakeIds = new Set(allMistakeRows.map((row) => row.questionId).filter(Boolean));
  const answeredIds = new Set(questionRows.map((row) => row.questionId).filter(Boolean));

  const relatedTopicKeys = new Set(allMistakeRows.flatMap((row) => safeArray(row.topicKeys)).filter(Boolean));
  const relatedSpecialtyKeys = new Set(allMistakeRows.flatMap((row) => safeArray(row.specialtyKeys)).filter(Boolean));

  const relatedPool = questions.filter((question) => {
    if (questionMatchesIdSet(question, allMistakeIds)) return false;
    const id = questionId(question);
    if (id && answeredIds.has(id)) return false;

    const qTopicKeys = questionTopicKeys(question, options);
    if (qTopicKeys.some((key) => relatedTopicKeys.has(key))) return true;

    const qSpecialtyKeys = questionSpecialtyKeys(question, options);
    return qSpecialtyKeys.some((key) => relatedSpecialtyKeys.has(key));
  });

  const targets = buildDistributionTargets(limit, {
    hasActive: activePool.length > 0,
    hasRecurrent: recurrentPool.length > 0,
    hasCorrected: correctedPool.length > 0,
    hasRelated: relatedPool.length > 0
  });

  const selected = [];
  const seen = new Set();
  const composition = {
    activeErrors: 0,
    recurrentErrors: 0,
    correctedErrors: 0,
    relatedReinforcement: 0,
    fillMistakes: 0,
    fillRelated: 0,
    fillAny: 0
  };

  addFromPool({
    selected,
    seen,
    pool: activePool,
    quota: selected.length + targets.activeErrors,
    bucketName: 'activeErrors',
    composition
  });

  addFromPool({
    selected,
    seen,
    pool: recurrentPool,
    quota: selected.length + targets.recurrentErrors,
    bucketName: 'recurrentErrors',
    composition
  });

  addFromPool({
    selected,
    seen,
    pool: correctedPool,
    quota: selected.length + targets.correctedErrors,
    bucketName: 'correctedErrors',
    composition
  });

  addFromPool({
    selected,
    seen,
    pool: shuffle(relatedPool),
    quota: selected.length + targets.relatedReinforcement,
    bucketName: 'relatedReinforcement',
    composition
  });

  addUntilLimit({
    selected,
    seen,
    pool: [...activePool, ...recurrentPool, ...correctedPool],
    limit,
    bucketName: 'fillMistakes',
    composition
  });

  addUntilLimit({
    selected,
    seen,
    pool: shuffle(relatedPool),
    limit,
    bucketName: 'fillRelated',
    composition
  });

  addUntilLimit({
    selected,
    seen,
    pool: shuffle(questions),
    limit,
    bucketName: 'fillAny',
    composition
  });

  const topics = Array.from(new Map(
    allMistakeRows
      .filter((row) => row.tema)
      .map((row) => [`${row.especialidad}::${row.tema}`, {
        especialidad: row.especialidad,
        tema: row.tema,
        wrongAttempts: row.wrongAttempts,
        lastAnswerAt: row.lastAnswerAt
      }])
  ).values()).sort((a, b) => safeNumber(b.wrongAttempts) - safeNumber(a.wrongAttempts));

  return {
    source: options.source || 'exam_answers',
    hasMistakes: allMistakeRows.length > 0,
    pool: selected.slice(0, limit),
    rows: questionRows,
    activeErrors: activeRows,
    recurrentErrors: recurrentRows,
    correctedErrors: correctedRows,
    topics,
    composition,
    diagnostics: {
      limit,
      desiredDistribution: MISTAKES_EXAM_DISTRIBUTION,
      distributionTargets: targets,
      activePool: activePool.length,
      recurrentPool: recurrentPool.length,
      correctedPool: correctedPool.length,
      relatedPool: relatedPool.length,
      mistakeQuestions: allMistakeRows.length,
      answeredQuestions: answeredIds.size,
      unmatchedMistakes: allMistakeRows.filter((row) => !findQuestion(questionIndex, row.questionId)).length
    }
  };
}
