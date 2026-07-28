const ANSWER_NUMBER_TO_LETTER = Object.freeze({
  '0': 'a',
  '1': 'b',
  '2': 'c',
  '3': 'd',
  '4': 'e',
  '5': 'f',
  '6': 'g',
  '7': 'h'
});

const ANSWER_INDEX_TO_LETTER = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

export function normalizeAnswerValue(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (!token) return '';
  return ANSWER_NUMBER_TO_LETTER[token] || token;
}

export function hasAnswerValue(value) {
  const normalized = normalizeAnswerValue(value);
  return normalized !== ''
    && normalized !== 'null'
    && normalized !== 'undefined'
    && normalized !== 'anulada'
    && normalized !== 'anulado';
}

function optionKeyForEntry(rawKey, index) {
  const normalized = normalizeAnswerValue(rawKey);
  if (normalized) return normalized;
  return ANSWER_INDEX_TO_LETTER[index] || String(index + 1);
}

export function getCanonicalOptionEntries(questionOrOptions) {
  const rawOptions = questionOrOptions && Object.prototype.hasOwnProperty.call(questionOrOptions, 'opciones')
    ? questionOrOptions.opciones
    : questionOrOptions;

  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((value, index) => [ANSWER_INDEX_TO_LETTER[index] || String(index + 1), value])
      .filter(([key]) => !!key);
  }

  if (!rawOptions || typeof rawOptions !== 'object') return [];

  return Object.entries(rawOptions)
    .map(([rawKey, value], index) => [optionKeyForEntry(rawKey, index), value])
    .filter(([key]) => !!key);
}

export function normalizeOptionsObject(questionOrOptions) {
  const normalized = {};
  for (const [key, value] of getCanonicalOptionEntries(questionOrOptions)) {
    normalized[key] = value;
  }
  return normalized;
}

export function normalizeQuestionAnswerSchema(question) {
  if (!question || typeof question !== 'object') return question;

  question.opciones = normalizeOptionsObject(question);

  if (Object.prototype.hasOwnProperty.call(question, 'respuesta') && question.respuesta != null) {
    question.respuesta = normalizeAnswerValue(question.respuesta);
  }

  return question;
}
