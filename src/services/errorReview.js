const STORAGE_PREFIX = 'resiar_error_review_v1';
const DEFAULT_LIMIT = 200;

function safeString(value) {
  return value == null ? '' : String(value).trim();
}

export function reviewStorageKey(user) {
  const userId = safeString(user?.id || user?.user_id || user?.email || 'anon');
  return `${STORAGE_PREFIX}:${userId || 'anon'}`;
}

export function questionReviewKey(question) {
  const id = safeString(question?.id || question?.pregunta_id || question?.question_id || question?.id_pregunta);
  if (id) return `id:${id}`;

  const examen = safeString(question?.examen || question?.tipo);
  const anio = safeString(question?.anio || question?.año || question?.year);
  const num = safeString(question?.num_original || question?.numero || question?.nro || question?.orden_original || question?.orden);
  if (examen || anio || num) return `exam:${examen}|${anio}|${num}`;

  const text = safeString(question?.pregunta).slice(0, 140).toLowerCase();
  return text ? `text:${text}` : '';
}

export function normalizeAnswer(value) {
  const raw = safeString(value);
  if (!raw) return '';
  const letter = raw.match(/[A-ZÁÉÍÓÚÑ]/i);
  return letter ? letter[0].toUpperCase() : raw.toUpperCase();
}

export function answerIsCorrect(question, answer) {
  const userAnswer = normalizeAnswer(answer);
  const correctAnswer = normalizeAnswer(question?.respuesta);
  return !!userAnswer && !!correctAnswer && userAnswer === correctAnswer;
}

function normalizeStoredEntry(entry, now = Date.now()) {
  const question = entry?.question || entry?.pregunta || entry;
  const key = questionReviewKey(question);
  if (!key || !question) return null;
  return {
    key,
    question,
    missedAt: entry?.missedAt || entry?.fecha || entry?.created_at || new Date(now).toISOString()
  };
}

export function loadReviewErrors(readJson, user) {
  if (typeof readJson !== 'function') return [];
  const raw = readJson(reviewStorageKey(user), []);
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(item => normalizeStoredEntry(item)).filter(Boolean);
}

export function saveReviewErrors(writeJson, user, entries) {
  if (typeof writeJson !== 'function') return false;
  const payload = (Array.isArray(entries) ? entries : [])
    .map(item => normalizeStoredEntry(item))
    .filter(Boolean)
    .map(item => ({ key: item.key, missedAt: item.missedAt, question: item.question }));
  return writeJson(reviewStorageKey(user), payload);
}

export function updateReviewErrorsFromSession(existingEntries, exam, answers, isQuestionAnulled, options = {}) {
  const limit = Math.max(1, Number(options.limit || DEFAULT_LIMIT));
  const now = new Date().toISOString();
  const map = new Map();

  (Array.isArray(existingEntries) ? existingEntries : [])
    .map(entry => normalizeStoredEntry(entry))
    .filter(Boolean)
    .forEach(entry => map.set(entry.key, entry));

  (Array.isArray(exam) ? exam : []).forEach((question, index) => {
    const answer = Array.isArray(answers) ? answers[index] : null;
    if (!answer) return;
    if (typeof isQuestionAnulled === 'function' && isQuestionAnulled(question)) return;

    const key = questionReviewKey(question);
    if (!key) return;

    if (answerIsCorrect(question, answer)) {
      map.delete(key);
      return;
    }

    map.delete(key);
    map.set(key, { key, question, missedAt: now });
  });

  return Array.from(map.values())
    .sort((a, b) => new Date(b.missedAt).getTime() - new Date(a.missedAt).getTime())
    .slice(0, limit);
}

export function hydrateReviewQuestions(entries, visibleQuestions, options = {}) {
  const limit = Math.max(1, Number(options.limit || DEFAULT_LIMIT));
  const visible = Array.isArray(visibleQuestions) ? visibleQuestions : [];
  const visibleByKey = new Map();
  visible.forEach(question => {
    const key = questionReviewKey(question);
    if (key) visibleByKey.set(key, question);
  });

  const out = [];
  const seen = new Set();
  (Array.isArray(entries) ? entries : [])
    .map(entry => normalizeStoredEntry(entry))
    .filter(Boolean)
    .sort((a, b) => new Date(b.missedAt).getTime() - new Date(a.missedAt).getTime())
    .forEach(entry => {
      if (seen.has(entry.key)) return;
      const fresh = visibleByKey.get(entry.key);
      if (!fresh) return;
      seen.add(entry.key);
      out.push(fresh);
    });
  return out.slice(0, limit);
}
