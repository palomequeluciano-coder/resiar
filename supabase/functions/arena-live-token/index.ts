import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const liveSecret = Deno.env.get('ARENA_LIVE_SECRET');
  if (!supabaseUrl || !serviceKey) return json({ error: 'missing_supabase_env' }, 500);
  if (!liveSecret) return json({ error: 'missing_arena_live_secret' }, 500);

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const matchId = String(body.match_id || body.matchId || '').trim();
  if (!matchId) return json({ error: 'missing_match_id' }, 400);

  const { data: participant, error: participantError } = await admin
    .from('arena_participants')
    .select('match_id,user_id,username,role,status')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle();
  if (participantError) return json({ error: 'participant_read_failed', message: participantError.message }, 500);
  if (!participant) return json({ error: 'not_participant' }, 403);

  const { data: match, error: matchError } = await admin
    .from('arena_matches')
    .select('id,status,mode,question_count,expires_at')
    .eq('id', matchId)
    .maybeSingle();
  if (matchError) return json({ error: 'match_read_failed', message: matchError.message }, 500);
  if (!match) return json({ error: 'match_not_found' }, 404);
  if (['completed', 'cancelled', 'expired'].includes(String(match.status))) return json({ error: 'match_not_live', status: match.status }, 409);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 10 * 60;
  const liveToken = await sign({
    iss: 'resiar-supabase',
    aud: 'arena-live-room',
    sub: userId,
    match_id: matchId,
    username: participant.username || null,
    role: participant.role || 'player',
    iat: now,
    exp
  }, liveSecret);

  return json({ ok: true, token: liveToken, ticket: liveToken, expires_at: exp, match_id: matchId });
});
