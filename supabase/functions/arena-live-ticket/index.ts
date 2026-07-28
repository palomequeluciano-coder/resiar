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

function b64url(bytes: Uint8Array) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlText(text: string) {
  return b64url(new TextEncoder().encode(text));
}

async function sign(payloadB64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return b64url(new Uint8Array(sig));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const liveSecret = Deno.env.get('ARENA_LIVE_SECRET');
  if (!supabaseUrl || !serviceKey) return respond({ error: 'missing_supabase_env' }, 500);
  if (!liveSecret || liveSecret.length < 24) return respond({ error: 'missing_arena_live_secret' }, 500);

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return respond({ error: 'unauthorized' }, 401);
  const user = userData.user;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const matchId = String(body.match_id || body.matchId || '').trim();
  if (!matchId) return respond({ error: 'missing_match_id' }, 400);

  const { data: match, error: matchError } = await admin
    .from('arena_matches')
    .select('id,code,status,mode,question_count,creator_id,opponent_id,expires_at')
    .eq('id', matchId)
    .maybeSingle();
  if (matchError) return respond({ error: 'match_read_failed', message: matchError.message }, 500);
  if (!match) return respond({ error: 'match_not_found' }, 404);
  if (['completed', 'cancelled', 'expired'].includes(String(match.status))) return respond({ error: 'match_not_live', status: match.status }, 409);

  const { data: participant, error: participantError } = await admin
    .from('arena_participants')
    .select('user_id,username,role,status')
    .eq('match_id', matchId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (participantError) return respond({ error: 'participant_read_failed', message: participantError.message }, 500);
  if (!participant && match.creator_id !== user.id && match.opponent_id !== user.id) return respond({ error: 'not_participant' }, 403);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'resiar-arena-live',
    iat: now,
    exp: now + 60 * 30,
    match_id: match.id,
    match_code: match.code,
    user_id: user.id,
    username: participant?.username || user.email || 'usuario',
    role: participant?.role || (match.creator_id === user.id ? 'creator' : 'opponent'),
    question_count: Number(match.question_count || 10)
  };

  const payloadB64 = b64urlText(JSON.stringify(payload));
  const signature = await sign(payloadB64, liveSecret);
  return respond({ ok: true, ticket: `${payloadB64}.${signature}`, payload });
});
