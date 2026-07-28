import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function randCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

function cleanCount(v: unknown) {
  const n = Math.round(Number(v || 10));
  return Math.max(1, Math.min(100, Number.isFinite(n) ? n : 10));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'missing_env' }, 500);

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const admin = createClient(url, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const action = String(body.action || 'search');
  const questionCount = cleanCount(body.question_count ?? body.questionCount);
  const timeLimitSec = Math.max(30, Math.min(14400, Math.round(Number(body.time_limit_sec ?? body.timeLimitSec ?? 600) || 600)));

  if (action === 'cancel') {
    await admin.from('arena_matchmaking_queue').update({ status: 'cancelled' }).eq('user_id', user.id).eq('status', 'searching');
    return json({ ok: true, status: 'cancelled' });
  }

  const { data: existingMatched } = await admin
    .from('arena_matchmaking_queue')
    .select('matched_match_id,status')
    .eq('user_id', user.id)
    .eq('status', 'matched')
    .not('matched_match_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingMatched?.matched_match_id) {
    const { data: match } = await admin.from('arena_matches').select('*').eq('id', existingMatched.matched_match_id).maybeSingle();
    if (match && ['ready', 'active'].includes(match.status)) return json({ ok: true, status: 'matched', matched: true, match });
  }

  await admin.from('arena_matchmaking_queue').update({ status: 'expired' }).eq('status', 'searching').lt('expires_at', new Date().toISOString());

  const { data: myProfile } = await admin.from('profiles').select('username,plan').eq('id', user.id).maybeSingle();
  const { data: myScope } = await admin.rpc('arena_access_scope_for_users', { p_user_a: user.id, p_user_b: null });

  const { data: opponent, error: opponentError } = await admin
    .from('arena_matchmaking_queue')
    .select('*')
    .eq('status', 'searching')
    .eq('mode', 'duel_live')
    .neq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (opponentError) return json({ error: 'queue_read_failed', message: opponentError.message }, 500);

  if (!opponent) {
    const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();
    const { data: queued, error: queueError } = await admin.from('arena_matchmaking_queue').upsert({
      user_id: user.id,
      username: myProfile?.username || user.email || null,
      mode: 'duel_live',
      status: 'searching',
      access_snapshot: String(myScope || 'limited'),
      question_count: questionCount,
      time_limit_sec: timeLimitSec,
      expires_at: expiresAt
    }, { onConflict: 'user_id,status' }).select('*').single();
    if (queueError) return json({ error: 'queue_upsert_failed', message: queueError.message }, 500);
    return json({ ok: true, status: 'searching', matched: false, queue: queued });
  }

  const code = randCode();
  const seed = crypto.randomUUID().replaceAll('-', '');
  const { data: scopeData, error: scopeError } = await admin.rpc('arena_access_scope_for_users', { p_user_a: opponent.user_id, p_user_b: user.id });
  if (scopeError) return json({ error: 'scope_failed', message: scopeError.message }, 500);
  const accessScope = String(scopeData || 'limited');
  const { data: picked, error: pickError } = await admin.rpc('arena_pick_questions', { p_scope: accessScope, p_count: questionCount, p_seed: seed, p_filters: {} });
  if (pickError) return json({ error: 'pick_questions_failed', message: pickError.message }, 500);
  const questionIds = Array.isArray(picked) ? picked : [];
  if (!questionIds.length) return json({ error: 'no_questions_available' }, 400);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: match, error: matchError } = await admin.from('arena_matches').insert({
    code,
    mode: 'duel_live',
    status: 'ready',
    creator_id: opponent.user_id,
    opponent_id: user.id,
    access_scope: accessScope,
    access_reason: accessScope === 'full' ? 'one_participant_full_access' : 'all_participants_limited',
    question_ids: questionIds,
    question_count: questionCount,
    seed,
    time_limit_sec: timeLimitSec,
    scoring_version: 'arena_v1',
    accepted_at: now,
    expires_at: expiresAt,
    metadata: { created_by_function: 'arena-find-match', queue_id: opponent.id }
  }).select('*').single();
  if (matchError) return json({ error: 'match_create_failed', message: matchError.message }, 500);

  const { data: opponentProfile } = await admin.from('profiles').select('username,plan').eq('id', opponent.user_id).maybeSingle();
  const { error: participantsError } = await admin.from('arena_participants').insert([
    { match_id: match.id, user_id: opponent.user_id, username: opponentProfile?.username || opponent.username || null, role: 'creator', plan_snapshot: opponentProfile?.plan || null, access_snapshot: accessScope, status: 'accepted' },
    { match_id: match.id, user_id: user.id, username: myProfile?.username || user.email || null, role: 'opponent', plan_snapshot: myProfile?.plan || null, access_snapshot: accessScope, status: 'accepted' }
  ]);
  if (participantsError) return json({ error: 'participants_create_failed', message: participantsError.message }, 500);

  await admin.from('arena_matchmaking_queue').update({ status: 'matched', matched_match_id: match.id }).eq('id', opponent.id);
  await admin.from('arena_matchmaking_queue').update({ status: 'matched', matched_match_id: match.id }).eq('user_id', user.id).eq('status', 'searching');

  return json({ ok: true, status: 'matched', matched: true, match });
});
