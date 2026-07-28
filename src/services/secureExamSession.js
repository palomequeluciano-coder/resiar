import { normalizeAnswerValue, normalizeQuestionAnswerSchema } from '../utils/answerOptions.js';

// RESIAR v69D — corrección segura por sesión
// El frontend no valida contra respuesta en memoria.
// Cada respuesta se corrige en backend contra submit_secure_exam_answer_v69.
// Requiere SQL v69D ya aplicado.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function uniqueQuestionIds(values) {
  const out = [];
  const seen = new Set();

  for (const value of asArray(values)) {
    const id = String(value == null ? '' : value).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

function normalizePayload(data) {
  if (Array.isArray(data)) return data[0] || {};
  if (data && typeof data === 'object') return data;
  return {};
}

function normalizeQuestion(row, sessionId) {
  const q = row && typeof row === 'object' ? { ...row } : {};
  q._resiarSecureSessionId = sessionId;
  q._resiarAnswerHidden = true;
  q._resiarAnswerVerified = false;

  normalizeQuestionAnswerSchema(q);

  // La respuesta correcta no debe existir antes de responder.
  q.respuesta = null;

  return q;
}

export async function startSecureExamSession({
  supabase,
  questionIds,
  mode = 'exam',
  limit = 100,
  filters = {}
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('Supabase no inicializado');
  }

  const ids = uniqueQuestionIds(questionIds);
  if (!ids.length) {
    throw new Error('No hay preguntas disponibles para iniciar la sesión segura');
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 10000));

  const { data, error } = await supabase.rpc('get_exam_session_v69', {
    p_question_ids: ids,
    p_limit: safeLimit,
    p_mode: String(mode || 'exam'),
    p_filters: filters && typeof filters === 'object' ? filters : {}
  });

  if (error) throw error;

  const payload = normalizePayload(data);
  const sessionId = payload.session_id || payload.sessionId;
  const rows = asArray(payload.questions);

  if (!sessionId) {
    throw new Error('El servidor no devolvió session_id para el examen seguro');
  }

  if (!rows.length) {
    throw new Error('El servidor no devolvió preguntas para esta sesión');
  }

  const questions = rows.map((row) => normalizeQuestion(row, sessionId));

  return {
    sessionId,
    questions,
    deliveredCount: Number(payload.delivered_count || questions.length),
    requestedCount: Number(payload.requested_count || ids.length),
    expiresAt: payload.expires_at || null,
    diagnostics: {
      sessionId,
      mode,
      requestedIds: ids.length,
      requestedCount: Number(payload.requested_count || ids.length),
      deliveredCount: Number(payload.delivered_count || questions.length),
      limit: safeLimit,
      source: 'get_exam_session_v69',
      answerHidden: true,
      accessEnforced: payload.access_enforced === true,
      at: new Date().toISOString()
    }
  };
}

export async function submitSecureExamAnswer({
  supabase,
  sessionId,
  questionId,
  selectedAnswer,
  answerRawToDisplayMap = null,
  answerDisplayToRawMap = null
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('Supabase no inicializado');
  }

  const sid = String(sessionId || '').trim();
  const qid = String(questionId || '').trim();
  const selectedDisplay = normalizeAnswerValue(selectedAnswer);
  const selectedForServer = selectedDisplay;

  if (!sid) throw new Error('Sesión segura no disponible');
  if (!qid) throw new Error('Pregunta inválida');
  if (!selectedDisplay) throw new Error('Respuesta inválida');

  const { data, error } = await supabase.rpc('submit_secure_exam_answer_v69', {
    p_session_id: sid,
    p_question_id: qid,
    p_selected_answer: selectedForServer
  });

  if (error) throw error;

  const payload = normalizePayload(data);
  const rawCorrectAnswer =
    payload.raw_correct_answer == null
      ? (payload.correct_answer == null ? null : String(payload.correct_answer).trim().toLowerCase())
      : String(payload.raw_correct_answer).trim().toLowerCase();
  const correctAnswer = payload.correct_answer == null
    ? null
    : normalizeAnswerValue(payload.correct_answer);
  const normalizedSelectedAnswer = normalizeAnswerValue(payload.selected_answer || selectedForServer) || selectedDisplay;
  const isAnnulled = payload.is_annulled === true;
  const isCorrect = !isAnnulled && correctAnswer
    ? normalizedSelectedAnswer === correctAnswer
    : payload.is_correct === true;

  const result = {
    sessionId: payload.session_id || sid,
    questionId: payload.question_id || qid,
    selectedAnswer: normalizedSelectedAnswer,
    submittedAnswer: selectedForServer,
    correctAnswer,
    rawCorrectAnswer,
    isCorrect,
    isAnnulled,
    answeredAt: payload.answered_at || null,
    source: 'submit_secure_exam_answer_v69'
  };

  try {
    window.__resiarLastSecureAnswer = {
      sessionId: result.sessionId,
      questionId: result.questionId,
      selectedAnswer: result.selectedAnswer,
      correctAnswer: result.correctAnswer,
      isCorrect: result.isCorrect,
      isAnnulled: result.isAnnulled,
      source: result.source,
      at: new Date().toISOString()
    };
  } catch (_) {}

  return result;
}
