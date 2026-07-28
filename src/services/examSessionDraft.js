const DRAFT_VERSION = 1;
const DRAFT_PREFIX = 'resiar_exam_draft_v1';
const MAX_DRAFT_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function userKey(user) {
  const id = user?.id || user?.email || 'anon';
  return String(id || 'anon').replace(/[^a-zA-Z0-9_.:-]/g, '_');
}

export function examDraftStorageKey(user) {
  return `${DRAFT_PREFIX}:${userKey(user)}`;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function questionId(question) {
  if (!question) return null;
  const id = question.id;
  return id == null ? null : String(id);
}

export function buildExamDraftPayload({
  user,
  exam,
  answers,
  answerResults,
  currentIndex,
  marked,
  visited,
  questionTimes,
  timeRemaining,
  timeTotal,
  startedAt,
  mode = 'exam'
} = {}) {
  const list = toArray(exam);
  const ids = list.map(questionId).filter(Boolean);
  if (!user || ids.length !== list.length || !ids.length) return null;

  return {
    version: DRAFT_VERSION,
    userId: String(user.id || user.email || ''),
    mode: String(mode || 'exam'),
    savedAt: Date.now(),
    startedAt: toNumber(startedAt, Date.now()),
    currentIndex: Math.max(0, toNumber(currentIndex, 0)),
    questionIds: ids,
    answers: toArray(answers).map(value => value == null ? null : String(value)),
    answerResults: toArray(answerResults).map(value => value && typeof value === 'object' && !Array.isArray(value) ? value : null),
    marked: [...(marked instanceof Set ? marked : new Set())].map(value => toNumber(value, -1)).filter(value => value >= 0),
    visited: [...(visited instanceof Set ? visited : new Set())].map(value => toNumber(value, -1)).filter(value => value >= 0),
    questionTimes: toArray(questionTimes).map(value => Math.max(0, toNumber(value, 0))),
    timeRemaining: Math.max(0, toNumber(timeRemaining, 0)),
    timeTotal: Math.max(1, toNumber(timeTotal, 120 * 60))
  };
}

export function saveExamDraft(writeJson, user, payload) {
  if (!payload || typeof writeJson !== 'function') return false;
  return writeJson(examDraftStorageKey(user), payload);
}

export function loadExamDraft(readJson, user) {
  if (!user || typeof readJson !== 'function') return null;
  const draft = readJson(examDraftStorageKey(user), null);
  if (!draft || typeof draft !== 'object') return null;
  if (draft.version !== DRAFT_VERSION) return null;
  const savedAt = toNumber(draft.savedAt, 0);
  if (!savedAt || Date.now() - savedAt > MAX_DRAFT_AGE_MS) return null;
  if (!Array.isArray(draft.questionIds) || !draft.questionIds.length) return null;
  return draft;
}

export function clearExamDraft(removeStorage, user) {
  if (!user || typeof removeStorage !== 'function') return false;
  return removeStorage(examDraftStorageKey(user));
}

export function hydrateExamDraft(draft, visibleQuestions) {
  if (!draft || !Array.isArray(draft.questionIds) || !Array.isArray(visibleQuestions)) return null;
  const byId = new Map();
  visibleQuestions.forEach(question => {
    const id = questionId(question);
    if (id) byId.set(id, question);
  });

  const hydrated = [];
  for (const id of draft.questionIds.map(String)) {
    const question = byId.get(id);
    if (!question) return null;
    hydrated.push(question);
  }

  const len = hydrated.length;
  const answers = Array.from({ length: len }, (_, index) => {
    const value = draft.answers?.[index];
    return value == null || value === '' ? null : String(value);
  });

  const answerResults = Array.from({ length: len }, (_, index) => {
    const value = draft.answerResults?.[index];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  });

  const marked = new Set(toArray(draft.marked)
    .map(value => toNumber(value, -1))
    .filter(value => value >= 0 && value < len));

  const visited = new Set(toArray(draft.visited)
    .map(value => toNumber(value, -1))
    .filter(value => value >= 0 && value < len));

  const questionTimes = Array.from({ length: len }, (_, index) => Math.max(0, toNumber(draft.questionTimes?.[index], 0)));
  const maxIndex = Math.max(0, len - 1);
  const currentIndex = Math.max(0, Math.min(toNumber(draft.currentIndex, 0), maxIndex));

  return {
    exam: hydrated,
    answers,
    answerResults,
    marked,
    visited,
    questionTimes,
    currentIndex,
    timeRemaining: Math.max(0, toNumber(draft.timeRemaining, 0)),
    timeTotal: Math.max(1, toNumber(draft.timeTotal, 120 * 60)),
    startedAt: toNumber(draft.startedAt, Date.now()),
    savedAt: toNumber(draft.savedAt, 0),
    mode: String(draft.mode || 'exam')
  };
}

export function summarizeAnswers(exam, answers, isQuestionVoided) {
  const list = toArray(exam);
  const values = toArray(answers);
  let correct = 0;
  let incorrect = 0;
  let answered = 0;

  list.forEach((question, index) => {
    const answer = values[index];
    if (!answer) return;
    answered++;
    if (typeof isQuestionVoided === 'function' && isQuestionVoided(question)) return;
    if (String(answer) === String(question?.respuesta)) correct++;
    else incorrect++;
  });

  return { correct, incorrect, answered };
}
