import { escapeHtml } from './sanitize.js';

function safeString(value) {
  return String(value ?? '').trim();
}

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

function pickRepeatedPayload(question) {
  if (!question || typeof question !== 'object') return null;
  return question.repetida_en
    ?? question.repetidas_en
    ?? question.repeated_in
    ?? question.repeatedIn
    ?? question.repeat_in
    ?? question.repeated_questions
    ?? question.duplicate_questions
    ?? question.duplicadas
    ?? question.duplicada_en
    ?? question.repeticiones
    ?? null;
}

function normalizeRepeatedEntries(raw) {
  const parsed = parseJsonMaybe(raw);
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;

  if (typeof parsed === 'string') {
    return parsed
      .split(/\n|;|\|/g)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.repeatedIn)) return parsed.repeatedIn;
    if (Array.isArray(parsed.repetida_en)) return parsed.repetida_en;

    return Object.entries(parsed).map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return { questionId: key, ...value };
      }
      const text = safeString(value);
      return text ? `${key}: ${text}` : key;
    });
  }

  return [];
}

function isSameQuestion(question, ref) {
  if (!question || !ref || typeof ref !== 'object') return false;

  const selfId = safeString(question.id);
  const refId = safeString(ref.id ?? ref.questionId ?? ref.question_id ?? ref.pregunta_id ?? ref.id_pregunta);
  if (selfId && refId && selfId === refId) return true;

  const selfExam = safeString(question.examen || question.tipo).toLowerCase();
  const refExam = safeString(ref.examen ?? ref.exam ?? ref.tipo ?? ref.banco ?? ref.sourceExam).toLowerCase();
  const selfYear = safeString(question.anio ?? question.año ?? question.year);
  const refYear = safeString(ref.anio ?? ref.año ?? ref.year);
  const selfNum = safeString(question.num_original ?? question.numero ?? question.nro ?? question.questionNumber);
  const refNum = safeString(ref.num_original ?? ref.numero ?? ref.nro ?? ref.questionNumber ?? ref.pregunta ?? ref.n_pregunta);

  return !!(selfExam && refExam && selfExam === refExam && selfYear === refYear && selfNum && refNum && selfNum === refNum);
}

function formatRepeatedReference(ref) {
  if (typeof ref === 'string') return safeString(ref);
  if (!ref || typeof ref !== 'object') return '';

  const exam = safeString(ref.examen ?? ref.exam ?? ref.tipo ?? ref.banco ?? ref.sourceExam);
  const year = safeString(ref.anio ?? ref.año ?? ref.year);
  const number = safeString(ref.num_original ?? ref.numero ?? ref.nro ?? ref.questionNumber ?? ref.pregunta ?? ref.n_pregunta);
  const id = safeString(ref.id ?? ref.questionId ?? ref.question_id ?? ref.pregunta_id ?? ref.id_pregunta);

  const left = [exam, year].filter(Boolean).join(' ');
  const right = number ? `pregunta ${number}` : (id ? `ID ${id}` : 'otra pregunta');

  return [left, right].filter(Boolean).join(' — ');
}

export function getRepeatedQuestionReferences(question) {
  const raw = pickRepeatedPayload(question);
  const refs = normalizeRepeatedEntries(raw);
  const seen = new Set();
  const out = [];

  for (const ref of refs) {
    if (isSameQuestion(question, ref)) continue;
    const label = formatRepeatedReference(ref);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }

  return out;
}

export function isQuestionMarkedAsRepeated(question) {
  if (!question || typeof question !== 'object') return false;
  if (question.repetida === true || question.repeated === true || question.duplicada === true || question.duplicate === true) return true;
  return getRepeatedQuestionReferences(question).length > 0;
}

export function renderQuestionRepeatedBanner(question) {
  const references = getRepeatedQuestionReferences(question);
  if (!references.length && !isQuestionMarkedAsRepeated(question)) return '';

  const body = references.length
    ? `
      <span class="banner-repetida-text">Esta pregunta también apareció en:</span>
      <ul class="banner-repetida-list">
        ${references.map(ref => `<li>${escapeHtml(ref)}</li>`).join('')}
      </ul>`
    : `<span class="banner-repetida-text">Esta pregunta está marcada como repetida, pero todavía no tiene cargado el examen relacionado.</span>`;

  return `
  <div class="banner-repetida" data-question-repeat-notice="true">
    <span class="banner-repetida-icon" aria-hidden="true">↻</span>
    <span class="banner-repetida-content">
      <strong>Pregunta repetida</strong>
      ${body}
    </span>
  </div>`;
}
