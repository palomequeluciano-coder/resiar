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

function normalizeInviteCode(input: unknown) {
  const raw = String(input || '').toUpperCase().trim();
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/[A-Z0-9]{8}/);
  return m ? m[0] : compact;
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

  const code = normalizeInviteCode(body.code || body.invite_code || body.inviteCode);
  if (!code || code.length < 6) return json({ error: 'Falta código de invitación' }, 400);

  const { data: invite, error: inviteError } = await admin
    .from('arena_invites')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (inviteError) return json({ error: 'No se pudo leer invitación: ' + inviteError.message }, 500);

  let matchId = invite?.match_id || null;
  if (!matchId) {
    const { data: matchByCode, error: matchByCodeError } = await admin
      .from('arena_matches')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (matchByCodeError) return json({ error: 'No se pudo leer partida: ' + matchByCodeError.message }, 500);
    matchId = matchByCode?.id || null;
  }

  if (!matchId) return json({ error: 'Invitación no encontrada', code }, 404);

  const { data: match, error: matchError } = await admin.from('arena_matches').select('*').eq('id', matchId).maybeSingle();
  if (matchError) return json({ error: 'No se pudo leer partida: ' + matchError.message }, 500);
  if (!match) return json({ error: 'Partida no encontrada', code }, 404);
  if (match.status !== 'pending') return json({ error: 'La invitación ya no está pendiente', status: match.status }, 409);
  if (match.creator_id === user.id) return json({ error: 'No podés aceptar tu propia invitación' }, 400);
  if (new Date(match.expires_at).getTime() < Date.now()) return json({ error: 'La invitación expiró' }, 410);
  if (invite && invite.status !== 'open') return json({ error: 'La invitación ya no está abierta', status: invite.status }, 409);

  const [{ data: creatorProfile }, { data: opponentProfile }] = await Promise.all([
    admin.from('profiles').select('username,plan').eq('id', match.creator_id).maybeSingle(),
    admin.from('profiles').select('username,plan').eq('id', user.id).maybeSingle(),
  ]);

  const { data: scopeData, error: scopeError } = await admin.rpc('arena_access_scope_for_users', { p_user_a: match.creator_id, p_user_b: user.id });
  if (scopeError) return json({ error: 'No se pudo calcular acceso: ' + scopeError.message }, 500);
  const accessScope = String(scopeData || 'limited');
  const accessReason = accessScope === 'full' ? 'one_participant_full_access' : 'all_participants_limited';

  const filters: Record<string, string> = {};
  if (match.especialidad) filters.especialidad = match.especialidad;
  if (match.tema) filters.tema = match.tema;
  if (match.examen) filters.examen = match.examen;

  const { data: picked, error: pickError } = await admin.rpc('arena_pick_questions', {
    p_scope: accessScope,
    p_count: match.question_count || 10,
    p_seed: match.seed,
    p_filters: filters,
  });
  if (pickError) return json({ error: 'No se pudieron elegir preguntas: ' + pickError.message }, 500);
  const questionIds = Array.isArray(picked) ? picked : [];
  if (!questionIds.length) return json({ error: 'No hay preguntas disponibles para esos filtros y plan' }, 400);

  const now = new Date().toISOString();
  const { data: updatedMatch, error: updateError } = await admin.from('arena_matches').update({
    opponent_id: user.id,
    status: 'ready',
    accepted_at: now,
    access_scope: accessScope,
    access_reason: accessReason,
    question_ids: questionIds,
  }).eq('id', match.id).eq('status', 'pending').select('*').maybeSingle();
  if (updateError) return json({ error: 'No se pudo aceptar invitación: ' + updateError.message }, 500);
  if (!updatedMatch) return json({ error: 'La partida ya no está disponible' }, 409);

  const { error: participantError } = await admin.from('arena_participants').upsert([
    { match_id: match.id, user_id: match.creator_id, username: creatorProfile?.username || null, role: 'creator', plan_snapshot: creatorProfile?.plan || null, access_snapshot: accessScope, status: 'accepted' },
    { match_id: match.id, user_id: user.id, username: opponentProfile?.username || user.email || null, role: 'opponent', plan_snapshot: opponentProfile?.plan || null, access_snapshot: accessScope, status: 'accepted' },
  ], { onConflict: 'match_id,user_id' });
  if (participantError) return json({ error: 'Aceptada, pero falló participante: ' + participantError.message }, 500);

  await admin.from('arena_invites').update({ status: 'accepted', accepted_by: user.id, accepted_at: now }).eq('match_id', match.id).eq('code', code);

  return json({ ok: true, match: updatedMatch, invite_code: code });
});
