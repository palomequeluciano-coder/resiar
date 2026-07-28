import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
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

  const { data: seasonKeyData } = await admin.rpc('arena_current_week_key');
  const seasonKey = String(seasonKeyData || 'unknown');

  const { data: myParticipants, error: partError } = await admin
    .from('arena_participants')
    .select('match_id,status,score,correct_count,wrong_count,total_answered,streak_best,time_spent_sec,completed_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);
  if (partError) return respond({ error: 'participants_read_failed', message: partError.message }, 500);

  const matchIds = (myParticipants || []).map((p) => p.match_id).filter(Boolean);
  let matches: unknown[] = [];
  if (matchIds.length) {
    const { data: matchRows, error: matchError } = await admin
      .from('arena_matches')
      .select('id,code,mode,status,creator_id,opponent_id,access_scope,access_reason,question_count,created_at,accepted_at,completed_at,expires_at')
      .in('id', matchIds);
    if (matchError) return respond({ error: 'matches_read_failed', message: matchError.message }, 500);
    const byId = new Map((matchRows || []).map((m) => [m.id, m]));
    matches = (myParticipants || []).map((p) => ({ participant: p, match: byId.get(p.match_id) || null }));
  }

  const { data: stats, error: statsError } = await admin
    .from('arena_user_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('season_key', seasonKey);
  if (statsError) return respond({ error: 'stats_read_failed', message: statsError.message }, 500);

  const { data: leaderboard, error: leaderboardError } = await admin
    .from('arena_user_stats')
    .select('user_id,season_key,mode,matches_played,wins,losses,draws,total_score,best_score,best_streak')
    .eq('season_key', seasonKey)
    .order('total_score', { ascending: false })
    .limit(20);
  if (leaderboardError) return respond({ error: 'leaderboard_read_failed', message: leaderboardError.message }, 500);

  const leaderboardUserIds = (leaderboard || []).map((row) => row.user_id).filter(Boolean);
  let profilesById: Record<string, unknown> = {};
  if (leaderboardUserIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id,username,avatar_url').in('id', leaderboardUserIds);
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  const enrichedLeaderboard = (leaderboard || []).map((row, index) => ({
    rank: index + 1,
    ...row,
    profile: profilesById[row.user_id] || null
  }));

  return respond({ ok: true, season_key: seasonKey, matches, stats: stats || [], leaderboard: enrichedLeaderboard });
});
