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

type AnswerRow = {
  user_id: string;
  is_correct: boolean;
  score_delta: number;
  time_ms: number | null;
  question_index: number;
};

function computeLiveStats(rows: AnswerRow[]) {
  let score = 0;
  let correct_count = 0;
  let wrong_count = 0;
  let total_answered = 0;
  let streak = 0;
  let streak_best = 0;
  let total_ms = 0;

  const ordered = [...rows].sort((a, b) => Number(a.question_index || 0) - Number(b.question_index || 0));
  for (const row of ordered) {
    total_answered += 1;
    score += Number(row.score_delta || 0);
    if (row.time_ms) total_ms += Number(row.time_ms || 0);
    if (row.is_correct) {
      correct_count += 1;
      streak += 1;
      streak_best = Math.max(streak_best, streak);
    } else {
      wrong_count += 1;
      streak = 0;
    }
  }

  return {
    score,
    correct_count,
    wrong_count,
    total_answered,
    streak_best,
    time_spent_sec: Math.round(total_ms / 1000)
  };
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
  const code = String(body.code || '').trim().toUpperCase();
  if (!matchId && !code) return respond({ error: 'missing_match' }, 400);

  let matchQuery = admin.from('arena_matches').select('*');
  matchQuery = matchId ? matchQuery.eq('id', matchId) : matchQuery.eq('code', code);
  const { data: match, error: matchError } = await matchQuery.maybeSingle();
  if (matchError) return respond({ error: 'match_read_failed', message: matchError.message }, 500);
  if (!match) return respond({ error: 'match_not_found' }, 404);

  const { data: participant } = await admin.from('arena_participants').select('id').eq('match_id', match.id).eq('user_id', userId).maybeSingle();
  if (!participant && match.creator_id !== userId && match.opponent_id !== userId) return respond({ error: 'forbidden' }, 403);

  const [{ data: participants, error: participantsError }, { data: myAnswers, error: myAnswersError }, { data: allAnswers, error: allAnswersError }] = await Promise.all([
    admin.from('arena_participants').select('*').eq('match_id', match.id).order('created_at', { ascending: true }),
    admin.from('arena_answers').select('*').eq('match_id', match.id).eq('user_id', userId).order('question_index', { ascending: true }),
    admin.from('arena_answers').select('user_id,is_correct,score_delta,time_ms,question_index,answered_at').eq('match_id', match.id).order('question_index', { ascending: true })
  ]);
  if (participantsError) return respond({ error: 'participants_read_failed', message: participantsError.message }, 500);
  if (myAnswersError) return respond({ error: 'answers_read_failed', message: myAnswersError.message }, 500);
  if (allAnswersError) return respond({ error: 'live_answers_read_failed', message: allAnswersError.message }, 500);

  const ids = Array.isArray(match.question_ids) ? match.question_ids.map(String) : [];
  let questions: Record<string, unknown>[] = [];
  if (ids.length) {
    const { data: rows, error: qError } = await admin
      .from('preguntas')
      .select('id,pregunta,opciones,respuesta,examen,anio,tipo,especialidad,tema,num_original,imagen_path,imagenes_paths,imagen_alt,imagen_caption,anulada')
      .in('id', ids);
    if (qError) return respond({ error: 'questions_read_failed', message: qError.message }, 500);
    const byId = new Map((rows || []).map((row) => [String(row.id), row]));
    questions = ids.map((id, index) => ({ ...(byId.get(id) || { id }), arena_index: index })).filter((q) => q.pregunta);
  }

  const answersByUser = new Map<string, AnswerRow[]>();
  for (const row of (allAnswers || []) as AnswerRow[]) {
    const key = String(row.user_id);
    const bucket = answersByUser.get(key) || [];
    bucket.push(row);
    answersByUser.set(key, bucket);
  }

  const totalQuestions = ids.length || Number(match.question_count || 0);
  const participantsWithLiveStats = (participants || []).map((p) => {
    const live = computeLiveStats(answersByUser.get(String(p.user_id)) || []);
    const status = p.status === 'completed'
      ? 'completed'
      : (live.total_answered >= totalQuestions && totalQuestions > 0 ? 'completed_local' : p.status);
    return {
      ...p,
      status,
      score: live.total_answered ? live.score : Number(p.score || 0),
      correct_count: live.total_answered ? live.correct_count : Number(p.correct_count || 0),
      wrong_count: live.total_answered ? live.wrong_count : Number(p.wrong_count || 0),
      total_answered: live.total_answered || Number(p.total_answered || 0),
      streak_best: live.total_answered ? live.streak_best : Number(p.streak_best || 0),
      time_spent_sec: live.total_answered ? live.time_spent_sec : Number(p.time_spent_sec || 0),
      live_stats: live
    };
  });

  return respond({
    ok: true,
    match,
    participants: participantsWithLiveStats,
    raw_participants: participants || [],
    answers: myAnswers || [],
    all_answers_count: (allAnswers || []).length,
    questions
  });
});
