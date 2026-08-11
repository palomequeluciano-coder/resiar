// Lógica de corrección de respuestas de examen. Extraída de main.js como
// funciones puras (sin leer `examen`/`respuestas`/`resiarAnswerResults` del
// estado de main.js) para poder testearla directamente con datos reales.
// main.js sigue siendo dueño del estado del examen en curso; le pasa la
// pregunta/respuesta cruda/resultado guardado como parámetros explícitos.

import { hasAnswerValue, normalizeAnswerValue } from './answerOptions.js';
import { esRespuestaAnulada } from './examAnswers.js';

// Normaliza el objeto de "resultado guardado" (viene de sesión segura /
// borrador) a una forma consistente: {isCorrect?, isAnnulled?, correctAnswer?,
// selectedAnswer?}. Acepta tanto camelCase como snake_case (distintas fuentes
// históricas de datos). Devuelve null si no hay nada útil.
export function resiarNormalizeAnswerResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};

  if ('isCorrect' in value) out.isCorrect = value.isCorrect === true;
  else if ('is_correct' in value) out.isCorrect = value.is_correct === true;

  if ('isAnnulled' in value) out.isAnnulled = value.isAnnulled === true;
  else if ('is_annulled' in value) out.isAnnulled = value.is_annulled === true;
  else if ('anulada' in value) out.isAnnulled = value.anulada === true;

  const correctAnswer = value.correctAnswer ?? value.correct_answer ?? value.respuesta ?? null;
  if (correctAnswer != null) out.correctAnswer = String(correctAnswer).trim().toLowerCase();

  const selectedAnswer = value.selectedAnswer ?? value.selected_answer ?? value.selected ?? null;
  if (selectedAnswer != null) out.selectedAnswer = String(selectedAnswer).trim().toLowerCase();

  return Object.keys(out).length ? out : null;
}

// True si la pregunta local trae una respuesta correcta "en vivo" y confiable
// (no oculta por sesión segura, no anulada, con valor de respuesta real).
// Cuando esto es true, la pregunta local es la fuente canónica de corrección
// por encima de cualquier resultado guardado (ver comentario en
// resiarEvaluateQuestionAnswer).
export function resiarQuestionHasKnownCorrectAnswer(question) {
  if (!question) return false;
  if (question._resiarAnswerHidden === true) return false;
  if (question?.anulada === true) return false;
  return hasAnswerValue(question.respuesta);
}

// Evalúa una pregunta respondida (o no) contra su corrección disponible.
// Parámetros explícitos en vez de leer examen[i]/respuestas[i]/
// resiarAnswerResults[i] -- así queda pura y testeable directamente.
export function resiarEvaluateQuestionAnswer(question, rawAnswer, rawResult, index) {
  const i = Number(index);
  const selectedAnswer = normalizeAnswerValue(rawAnswer);
  const answered = hasAnswerValue(rawAnswer);
  const result = resiarNormalizeAnswerResult(rawResult);
  const hasLiveCorrect = resiarQuestionHasKnownCorrectAnswer(question);

  // Si el admin corrigió la pregunta y ya hay respuesta oficial cargada,
  // esa pregunta local pasa a ser la fuente canónica. Esto evita que una
  // corrección vieja guardada como anulada/pendiente deje stats y navegación
  // leyendo estados distintos.
  const isAnnulled = hasLiveCorrect
    ? question?.anulada === true
    : !!(esRespuestaAnulada(question) || result?.isAnnulled === true);

  const correctAnswer = hasLiveCorrect
    ? normalizeAnswerValue(question?.respuesta)
    : (result?.correctAnswer ? normalizeAnswerValue(result.correctAnswer) : '');

  let status = '';
  let isCorrect = false;
  let isIncorrect = false;
  let evaluable = false;

  if (!answered) {
    status = '';
  } else if (isAnnulled) {
    status = 'anulada';
  } else if (correctAnswer) {
    evaluable = true;
    isCorrect = selectedAnswer === correctAnswer;
    isIncorrect = !isCorrect;
    status = isCorrect ? 'ok' : 'no';
  } else if (result && typeof result.isCorrect === 'boolean') {
    evaluable = true;
    isCorrect = result.isCorrect === true;
    isIncorrect = !isCorrect;
    status = isCorrect ? 'ok' : 'no';
  } else {
    // Respondida pero sin corrección confiable todavía: no debe sumar como
    // correcta ni incorrecta hasta que haya respuesta/anulación verificable.
    status = 'pendiente';
  }

  return {
    index: i,
    question,
    rawAnswer,
    selectedAnswer,
    correctAnswer,
    result,
    answered,
    evaluable,
    isAnnulled,
    isCorrect,
    isIncorrect,
    status
  };
}
