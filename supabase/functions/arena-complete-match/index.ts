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

function resultAgainst(myScore: number, otherScore: number | null) {
  if (otherScore === null) return { wins: 0, losses: 0, draws: 0 };
  if (myScore > otherScore) return { wins: 1, losses: 0, draws: 0 };
  if (myScore < otherScore) return { wins: 0, losses: 1, draws: 0 };
  return { wins: 0, losses: 0, draws: 1 };
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
  if (!matchId) return respond({ error: 'missing_match_id' }, 400);

  const { data: match, error: matchError } = await admin.from('arena_matches').select('*').eq('id', matchId).maybeSingle();
  if (matchError) return respond({ error: 'match_read_failed', message: matchError.message }, 500);
  if (!match) return respond({ error: 'match_not_found' }, 404);

  const { data: participant } = await admin.from('arena_participants').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle();
  if (!participant) return respond({ error: 'not_participant' }, 403);

  const { data: answers, error: answersError } = await admin.from('arena_answers').select('is_correct,score_delta,time_ms,question_index').eq('match_id', matchId).eq('user_id', userId).order('question_index', { ascending: true });
  if (answersError) return respond({ error: 'answers_read_failed', message: answersError.message }, 500);

  let score = 0, correctCount = 0, wrongCount = 0, streak = 0, bestStreak = 0, totalMs = 0;
  for (const row of answers || []) {
    score += Number(row.score_delta || 0);
    if (row.time_ms) totalMs += Number(row.time_ms || 0);
    if (row.is_correct) { correctCount += 1; streak += 1; bestStreak = Math.max(bestStreak, streak); }
    else { wrongCount += 1; streak = 0; }
  }

  const now = new Date().toISOString();
  const totalAnswered = (answers || []).length;
  const totalQuestions = Array.isArray(match.question_ids) ? match.question_ids.length : Number(match.question_count || 0);

  const { data: updatedParticipant, error: updateParticipantError } = await admin.from('arena_participants').update({
    status: 'completed',
    score,
    correct_count: correctCount,
    wrong_count: wrongCount,
    total_answered: totalAnswered,
    streak_best: bestStreak,
    time_spent_sec: Math.round(totalMs / 1000),
    completed_at: now,
    started_at: participant.started_at || now
  }).eq('match_id', matchId).eq('user_id', userId).select('*').single();
  if (updateParticipantError) return respond({ error: 'participant_update_failed', message: updateParticipantError.message }, 500);

  const { data: participants } = await admin.from('arena_participants').select('*').eq('match_id', matchId);
  const requiredPlayers = match.mode === 'duel_async' || match.mode === 'duel_live' ? 2 : 1;
  const completedCount = (participants || []).filter((p) => p.status === 'completed').length;
  let matchCompleted = false;

  if (completedCount >= requiredPlayers) {
    await admin.from('arena_matches').update({ status: 'completed', completed_at: now }).eq('id', matchId);
    matchCompleted = true;
  }

  const other = (participants || []).find((p) => p.user_id !== userId && p.status === 'completed');
  const result = resultAgainst(score, other ? Number(other.score || 0) : null);
  const { data: seasonKeyData } = await admin.rpc('arena_current_week_key');
  const seasonKey = String(seasonKeyData || 'unknown');

  const { data: existingStats } = await admin.from('arena_user_stats').select('*').eq('user_id', userId).eq('season_key', seasonKey).eq('mode', match.mode).maybeSingle();
  if (existingStats) {
    await admin.from('arena_user_stats').update({
      matches_played: Number(existingStats.matches_played || 0) + 1,
      wins: Number(existingStats.wins || 0) + result.wins,
      losses: Number(existingStats.losses || 0) + result.losses,
      draws: Number(existingStats.draws || 0) + result.draws,
      total_score: Number(existingStats.total_score || 0) + score,
      best_score: Math.max(Number(existingStats.best_score || 0), score),
      best_streak: Math.max(Number(existingStats.best_streak || 0), bestStreak),
      updated_at: now
    }).eq('user_id', userId).eq('season_key', seasonKey).eq('mode', match.mode);
  } else {
    await admin.from('arena_user_stats').insert({ user_id: userId, season_key: seasonKey, mode: match.mode, matches_played: 1, wins: result.wins, losses: result.losses, draws: result.draws, total_score: score, best_score: score, best_streak: bestStreak });
  }

  if (totalQuestions >= 10 && correctCount >= totalQuestions) await admin.from('arena_user_achievements').upsert({ user_id: userId, achievement_code: 'perfect_10', metadata: { match_id: matchId } }, { onConflict: 'user_id,achievement_code' });
  if (bestStreak >= 5) await admin.from('arena_user_achievements').upsert({ user_id: userId, achievement_code: 'streak_5', metadata: { match_id: matchId } }, { onConflict: 'user_id,achievement_code' });
  if (match.mode === 'duel_async' || match.mode === 'duel_live') await admin.from('arena_user_achievements').upsert({ user_id: userId, achievement_code: 'first_duel', metadata: { match_id: matchId } }, { onConflict: 'user_id,achievement_code' });

  return respond({ ok: true, participant: updatedParticipant, match_completed: matchCompleted, total_answered: totalAnswered, total_questions: totalQuestions, score, correct_count: correctCount, wrong_count: wrongCount, best_streak: bestStreak });
});
