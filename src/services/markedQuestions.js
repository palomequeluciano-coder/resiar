const STORAGE_PREFIX = 'resiar_marked_questions_v1';

let deps = {
  getCurrentUser: () => null,
  getExamen: () => [],
  readJson: () => null,
  writeJson: () => false,
  removeStorage: () => false
};

export function configureMarkedQuestions(overrides = {}) {
  deps = { ...deps, ...overrides };
  return {
    resiarMarkedQuestionsUserScope,
    resiarMarkedQuestionsStorageKey,
    resiarNormalizeQuestionId,
    resiarQuestionIdAtIndex,
    resiarReadPersistentMarkedIds,
    resiarWritePersistentMarkedIds,
    resiarHydratePersistentMarkedForExam,
    resiarPersistMarkedIndexSet
  };
}

export function resiarMarkedQuestionsUserScope() {
  const currentUser = deps.getCurrentUser();
  const raw = currentUser?.id || currentUser?.email || currentUser?.user_metadata?.email || 'anon';
  return String(raw || 'anon').replace(/[^a-zA-Z0-9@._:-]/g, '_');
}

export function resiarMarkedQuestionsStorageKey() {
  return `${STORAGE_PREFIX}:${resiarMarkedQuestionsUserScope()}`;
}

export function resiarNormalizeQuestionId(value) {
  const id = String(value == null ? '' : value).trim();
  return id || null;
}

export function resiarQuestionIdAtIndex(index) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0) return null;
  const examen = deps.getExamen();
  return resiarNormalizeQuestionId(examen?.[idx]?.id);
}

export function resiarReadPersistentMarkedIds() {
  const currentUser = deps.getCurrentUser();
  if (!currentUser) return new Set();
  const raw = deps.readJson(resiarMarkedQuestionsStorageKey(), null);
  const values = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.ids)
      ? raw.ids
      : [];

  const ids = new Set();
  for (const value of values) {
    const id = resiarNormalizeQuestionId(value);
    if (id) ids.add(id);
  }
  return ids;
}

export function resiarWritePersistentMarkedIds(ids) {
  const currentUser = deps.getCurrentUser();
  if (!currentUser) return false;
  const clean = [...(ids instanceof Set ? ids : new Set())]
    .map(resiarNormalizeQuestionId)
    .filter(Boolean)
    .slice(0, 5000);

  const key = resiarMarkedQuestionsStorageKey();
  if (!clean.length) return deps.removeStorage(key);

  return deps.writeJson(key, {
    version: 1,
    userId: currentUser?.id || null,
    ids: clean,
    updatedAt: new Date().toISOString()
  });
}

export function resiarHydratePersistentMarkedForExam(baseMarked = new Set()) {
  const examen = deps.getExamen();
  const persistentIds = resiarReadPersistentMarkedIds();
  const next = new Set();

  if (baseMarked instanceof Set) {
    for (const rawIdx of baseMarked) {
      const idx = Number(rawIdx);
      if (Number.isInteger(idx) && idx >= 0 && idx < examen.length) {
        next.add(idx);
      }
    }
  }

  examen.forEach((question, idx) => {
    const id = resiarNormalizeQuestionId(question?.id);
    if (id && persistentIds.has(id)) next.add(idx);
  });

  return next;
}

export function resiarPersistMarkedIndexSet(indexSet) {
  const currentUser = deps.getCurrentUser();
  const examen = deps.getExamen();
  if (!currentUser || !Array.isArray(examen) || !examen.length) return false;

  const ids = resiarReadPersistentMarkedIds();
  const examIds = examen
    .map((question) => resiarNormalizeQuestionId(question?.id))
    .filter(Boolean);

  // Para el examen actual, el Set de índices es la fuente de verdad.
  // No tocamos marcas de preguntas que no estén en este examen.
  for (const id of examIds) ids.delete(id);

  const marked = indexSet instanceof Set ? indexSet : new Set();
  for (const rawIdx of marked) {
    const id = resiarQuestionIdAtIndex(rawIdx);
    if (id) ids.add(id);
  }

  return resiarWritePersistentMarkedIds(ids);
}
