import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function normalizeAnswer(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  return raw ? raw.slice(0, 8) : null;
}

function scoreDelta(isCorrect: boolean, timeMs: number | null) {
  if (!isCorrect) return 0;
  if (typeof timeMs === 'number' && Number.isFinite(timeMs)) {
    if (timeMs <= 8000) return 130;
    if (timeMs <= 20000) return 115;
  }
  return 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return respond({ error: 'missing_env' }, 500);

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return respond({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const matchId = String(body.match_id || body.matchId || '').trim();
  const questionId = String(body.question_id || body.questionId || '').trim();
  const selectedAnswer = normalizeAnswer(body.selected_answer ?? body.selectedAnswer ?? body.answer);
  const rawTime = Number(body.time_ms ?? body.timeMs ?? 0);
  const timeMs = Number.isFinite(rawTime) && rawTime >= 0 ? Math.round(rawTime) : null;
  if (!matchId || !questionId) return respond({ error: 'missing_fields' }, 400);
  if (!selectedAnswer) return respond({ error: 'missing_answer' }, 400);

  const { data: match, error: matchError } = await admin.from('arena_matches').select('*').eq('id', matchId).maybeSingle();
  if (matchError) return respond({ error: 'match_read_failed', message: matchError.message }, 500);
  if (!match) return respond({ error: 'match_not_found' }, 404);
  if (!['ready', 'active'].includes(match.status)) return respond({ error: 'match_not_playable', status: match.status }, 409);

  const questionIds = Array.isArray(match.question_ids) ? match.question_ids.map(String) : [];
  const questionIndex = questionIds.indexOf(questionId);
  if (questionIndex < 0) return respond({ error: 'question_not_in_match' }, 403);

  const { data: participant } = await admin.from('arena_participants').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle();
  if (!participant) return respond({ error: 'not_participant' }, 403);
  if (participant.status === 'completed') return respond({ error: 'participant_completed' }, 409);

  const { data: existing } = await admin.from('arena_answers').select('*').eq('match_id', matchId).eq('user_id', userId).eq('question_id', questionId).maybeSingle();
  if (existing) return respond({ ok: true, duplicate: true, answer: existing });

  const { data: question, error: questionError } = await admin.from('preguntas').select('id,respuesta,anulada').eq('id', questionId).maybeSingle();
  if (questionError) return respond({ error: 'question_read_failed', message: questionError.message }, 500);
  if (!question) return respond({ error: 'question_not_found' }, 404);

  const correctAnswer = normalizeAnswer(question.respuesta);
  const isCorrect = !question.anulada && !!correctAnswer && selectedAnswer === correctAnswer;
  const delta = scoreDelta(isCorrect, timeMs);

  const { data: answer, error: insertError } = await admin.from('arena_answers').insert({
    match_id: matchId,
    user_id: userId,
    question_id: questionId,
    question_index: questionIndex,
    selected_answer: selectedAnswer,
    correct_answer: correctAnswer,
    is_correct: isCorrect,
    time_ms: timeMs,
    score_delta: delta,
    metadata: { scoring_version: match.scoring_version || 'arena_v1' }
  }).select('*').single();
  if (insertError) return respond({ error: 'answer_insert_failed', message: insertError.message }, 500);

  if (match.status === 'ready') {
    await admin.from('arena_matches').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', matchId).eq('status', 'ready');
  }

  return respond({ ok: true, answer });
});
