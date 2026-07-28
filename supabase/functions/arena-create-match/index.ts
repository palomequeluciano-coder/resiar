import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function randCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

function cleanMode(v: unknown) {
  const mode = String(v || 'duel_async');
  return ['duel_async', 'duel_live', 'burst', 'clutch', 'specialty'].includes(mode) ? mode : 'duel_async';
}

function cleanCount(v: unknown) {
  const n = Math.round(Number(v || 10));
  return Math.max(1, Math.min(100, Number.isFinite(n) ? n : 10));
}

function cleanFilters(v: unknown) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const src = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ['especialidad', 'tema', 'examen']) {
    const val = String(src[key] || '').trim();
    if (val) out[key] = val.slice(0, 160);
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Faltan variables de Supabase' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const admin = createClient(url, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'No autorizado' }, 401);
  const user = userData.user;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const mode = cleanMode(body.mode);
  const isDuel = mode === 'duel_async' || mode === 'duel_live';
  const questionCount = cleanCount(body.questionCount ?? body.question_count);
  const filters = cleanFilters(body.filters);
  const timeLimitSec = Math.max(30, Math.min(14400, Math.round(Number(body.timeLimitSec ?? body.time_limit_sec ?? 600) || 600)));
  const code = randCode();
  const seed = crypto.randomUUID().replaceAll('-', '');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profile } = await admin.from('profiles').select('username,plan').eq('id', user.id).maybeSingle();
  let accessScope: string | null = null;
  let accessReason: string | null = null;
  let questionIds: string[] = [];
  let status = 'pending';

  if (!isDuel) {
    const { data: scopeData, error: scopeError } = await admin.rpc('arena_access_scope_for_users', { p_user_a: user.id, p_user_b: null });
    if (scopeError) return json({ error: 'No se pudo calcular acceso: ' + scopeError.message }, 500);
    accessScope = String(scopeData || 'limited');
    accessReason = accessScope === 'full' ? 'creator_full_access' : 'creator_limited';
    const { data: picked, error: pickError } = await admin.rpc('arena_pick_questions', { p_scope: accessScope, p_count: questionCount, p_seed: seed, p_filters: filters });
    if (pickError) return json({ error: 'No se pudieron elegir preguntas: ' + pickError.message }, 500);
    questionIds = Array.isArray(picked) ? picked : [];
    status = 'ready';
  }

  const { data: match, error: matchError } = await admin.from('arena_matches').insert({
    code, mode, status, creator_id: user.id, access_scope: accessScope, access_reason: accessReason,
    question_ids: questionIds, question_count: questionCount, seed, time_limit_sec: timeLimitSec,
    scoring_version: 'arena_v1', especialidad: filters.especialidad || null, tema: filters.tema || null, examen: filters.examen || null,
    expires_at: expiresAt, metadata: { created_by_function: 'arena-create-match' }
  }).select('*').single();
  if (matchError) return json({ error: 'No se pudo crear partida: ' + matchError.message }, 500);

  const { error: participantError } = await admin.from('arena_participants').insert({
    match_id: match.id, user_id: user.id, username: profile?.username || user.email || null,
    role: isDuel ? 'creator' : 'solo', plan_snapshot: profile?.plan || null, access_snapshot: accessScope,
    status: isDuel ? 'accepted' : 'playing'
  });
  if (participantError) return json({ error: 'Partida creada, pero falló participante: ' + participantError.message }, 500);

  if (isDuel) {
    await admin.from('arena_invites').insert({ match_id: match.id, code, created_by: user.id, status: 'open', expires_at: expiresAt });
  }

  return json({ ok: true, match, invite_code: code });
});
