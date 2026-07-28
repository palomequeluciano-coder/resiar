import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MAX_ANSWERS = 1000;

type JsonRecord = Record<string, unknown>;

type NormalizedAnswer = {
  id: string;
  question_id: string;
  selected_answer: string;
  frontend_correct_answer: string | null;
  frontend_especialidad: string | null;
  frontend_tema: string | null;
  frontend_subtema: string | null;
  time_ms: number | null;
  question_index: number | null;
  mode: string | null;
  metadata: JsonRecord;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

function asText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeAnswerValue(value: unknown): string | null {
  const text = asText(value);
  return text ? text.toLowerCase().slice(0, 16) : null;
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  const text = String(value ?? '').toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
}

function asNonNegativeInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function isAnnulledAnswer(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return text === '' || text === 'null' || text === 'anulada' || text === 'anulado';
}

function normalizeMode(value: unknown): string {
  const mode = asText(value) || 'exam';
  return mode.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 40) || 'exam';
}

function normalizeSource(value: unknown): string {
  const source = asText(value) || 'web';
  return source.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 40) || 'web';
}

function normalizeAnswers(body: JsonRecord): NormalizedAnswer[] {
  const raw = Array.isArray(body.answers) ? body.answers : [];
  const output: NormalizedAnswer[] = [];

  raw.slice(0, MAX_ANSWERS).forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const row = item as JsonRecord;
    const id = asText(row.question_id ?? row.questionId ?? row.id ?? row.pregunta_id);
    const selected = normalizeAnswerValue(row.selected_answer ?? row.selectedAnswer ?? row.respuesta ?? row.answer);
    if (!id || !selected) return;

    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as JsonRecord
      : {};

    output.push({
      id,
      question_id: id,
      selected_answer: selected,
      frontend_correct_answer: normalizeAnswerValue(row.correct_answer ?? row.correctAnswer),
      frontend_especialidad: asText(row.especialidad_v2 ?? row.especialidad ?? row.specialty),
      frontend_tema: asText(row.tema_v2 ?? row.tema ?? row.topic),
      frontend_subtema: asText(row.subtema_v2 ?? row.subtema ?? row.subtopic),
      time_ms: asNonNegativeInt(row.time_ms ?? row.timeMs ?? row.tiempo_ms),
      question_index: asNonNegativeInt(row.question_index ?? row.questionIndex ?? row.index) ?? index,
      mode: asText(row.mode),
      metadata
    });
  });

  return output;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function readQuestionMap(admin: ReturnType<typeof createClient>, ids: string[]) {
  const map = new Map<string, JsonRecord>();
  const uniqueIds = [...new Set(ids)].filter(Boolean);

  for (const part of chunk(uniqueIds, 200)) {
    const { data, error } = await admin
      .from('preguntas')
      .select('id,respuesta,anulada,especialidad,especialidad_v2,tema,tema_v2,subtema,subtema_v2,examen,anio,tipo,num_original')
      .in('id', part);
    if (error) throw new Error('question_read_failed: ' + error.message);
    for (const row of data || []) map.set(String(row.id), row as JsonRecord);
  }

  return map;
}

function buildAnswerRows(answers: NormalizedAnswer[], questionMap: Map<string, JsonRecord>, sessionId: string, userId: string, sessionMode: string) {
  return answers.map((answer) => {
    const question = questionMap.get(answer.question_id) || {};
    const correctAnswer = normalizeAnswerValue(question.respuesta) || answer.frontend_correct_answer;
    const isAnnulled = asBool(question.anulada, false) || isAnnulledAnswer(question.respuesta) || !correctAnswer;
    const isCorrect = !isAnnulled && !!correctAnswer && answer.selected_answer === correctAnswer;
    const especialidad = asText(question.especialidad_v2 ?? question.especialidad) || answer.frontend_especialidad || 'General';
    const tema = asText(question.tema_v2 ?? question.tema) || answer.frontend_tema;
    const subtema = asText(question.subtema_v2 ?? question.subtema) || answer.frontend_subtema;

    return {
      session_id: sessionId,
      user_id: userId,
      question_id: answer.question_id,
      especialidad,
      tema,
      subtema,
      selected_answer: answer.selected_answer,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      is_answered: true,
      is_annulled: isAnnulled,
      time_ms: answer.time_ms,
      question_index: answer.question_index,
      mode: answer.mode || sessionMode,
      metadata: {
        ...answer.metadata,
        examen: answer.metadata.examen ?? question.examen ?? null,
        anio: answer.metadata.anio ?? question.anio ?? null,
        tipo: answer.metadata.tipo ?? question.tipo ?? null,
        num_original: answer.metadata.num_original ?? question.num_original ?? null
      }
    };
  });
}

function summarizeAnswerRows(answerRows: JsonRecord[]) {
  const scorable = answerRows.filter((row) => row.is_answered !== false && row.is_annulled !== true);
  const correctas = scorable.filter((row) => row.is_correct === true).length;
  const total = scorable.length;
  const respondidas = answerRows.filter((row) => row.is_answered !== false).length;
  const incorrectas = Math.max(0, total - correctas);
  const porcentaje = total ? Math.round((correctas / total) * 10000) / 100 : 0;
  return { total, respondidas, correctas, incorrectas, porcentaje };
}

function legacySpecialtyLabel(answerRows: JsonRecord[]) {
  const names = [...new Set(answerRows.map((row) => asText(row.especialidad)).filter(Boolean) as string[])];
  return names.length ? names.slice(0, 20).join(', ') : 'General';
}

async function insertLegacyResultado(admin: ReturnType<typeof createClient>, row: JsonRecord) {
  const attempts: JsonRecord[] = [
    row,
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'tiempo')),
    Object.fromEntries(Object.entries(row).filter(([key]) => ['user_id', 'especialidad', 'correctas', 'total', 'pct'].includes(key)))
  ];

  let lastError = '';
  for (const attempt of attempts) {
    const { error } = await admin.from('resultados').insert(attempt);
    if (!error) return { ok: true };
    lastError = error.message;
  }
  return { ok: false, error: lastError };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'missing_env' }, 500);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ ok: false, error: 'missing_token' }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ ok: false, error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    let body: JsonRecord = {};
    try { body = await req.json(); } catch (_) {}

    const answers = normalizeAnswers(body);
    if (!answers.length) return json({ ok: false, error: 'empty_answers' }, 400);

    const mode = normalizeMode(body.mode ?? answers[0]?.mode ?? 'exam');
    const source = normalizeSource(body.source ?? 'web');
    const durationMs = asNonNegativeInt(body.duration_ms ?? body.durationMs)
      ?? (asNonNegativeInt(body.tiempo) != null ? Number(asNonNegativeInt(body.tiempo)) * 1000 : 0);

    const questionMap = await readQuestionMap(admin, answers.map((answer) => answer.question_id));

    const { data: session, error: sessionError } = await admin.from('exam_sessions').insert({
      user_id: userId,
      mode,
      total: 0,
      correctas: 0,
      incorrectas: 0,
      respondidas: answers.length,
      porcentaje: 0,
      duration_ms: durationMs || 0,
      source,
      metadata: {
        answer_count_received: answers.length,
        question_count_matched: questionMap.size,
        submit_result_version: 'v59'
      }
    }).select('id').single();

    if (sessionError || !session?.id) {
      return json({ ok: false, error: 'session_insert_failed', message: sessionError?.message || 'missing_session_id' }, 500);
    }

    const sessionId = String(session.id);
    const answerRows = buildAnswerRows(answers, questionMap, sessionId, userId, mode);
    const summary = summarizeAnswerRows(answerRows);

    const { error: answersError } = await admin.from('exam_answers').insert(answerRows);
    if (answersError) {
      await admin.from('exam_sessions').delete().eq('id', sessionId).eq('user_id', userId);
      return json({ ok: false, error: 'answers_insert_failed', message: answersError.message }, 500);
    }

    const { error: updateError } = await admin.from('exam_sessions').update({
      total: summary.total,
      correctas: summary.correctas,
      incorrectas: summary.incorrectas,
      respondidas: summary.respondidas,
      porcentaje: summary.porcentaje
    }).eq('id', sessionId).eq('user_id', userId);

    if (updateError) {
      return json({ ok: false, error: 'session_update_failed', message: updateError.message }, 500);
    }

    const legacy = await insertLegacyResultado(admin, {
      user_id: userId,
      especialidad: legacySpecialtyLabel(answerRows),
      correctas: summary.correctas,
      total: summary.total,
      pct: summary.porcentaje,
      tiempo: durationMs ? Math.round(durationMs / 1000) : null
    });

    return json({
      ok: true,
      session_id: sessionId,
      answers_inserted: answerRows.length,
      summary,
      legacy_resultados: legacy
    });
  } catch (error) {
    return json({ ok: false, error: 'unexpected_error', message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
