import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const MANUAL_EXPLANATION_PROMPT_VERSION = 5;
const ADMIN_UPDATE_QUESTION_VERSION = 'v70C_explanation_cache_replace';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'true' || text === 'si' || text === 'sí' || text === 'yes') return true;
  if (text === 'false' || text === 'no') return false;
  return fallback;
}

function pickQuestionId(body: JsonRecord): string | null {
  const direct = asText(body.id || body.pregunta_id || body.question_id || body.questionId);
  if (direct) return direct;

  const question = asRecord(body.question);
  if (question) {
    const id = asText(question.id || question.pregunta_id || question.question_id || question.questionId);
    if (id) return id;
  }

  const payload = asRecord(body.payload);
  if (payload) {
    const id = asText(payload.id || payload.pregunta_id || payload.question_id || payload.questionId);
    if (id) return id;
  }

  return null;
}

function getPatchSource(body: JsonRecord): JsonRecord {
  return asRecord(body.question) || asRecord(body.payload) || body;
}

function normalizeOptions(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(value as JsonRecord)) {
    const k = String(key || '').trim().toLowerCase();
    if (!k) continue;
    out[k] = String(raw ?? '');
  }

  return Object.keys(out).length ? out : null;
}

function normalizeAnswer(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;

  const firstLetter = text.match(/^[a-hA-H](?:$|[\s).:\-])/);
  if (firstLetter) return firstLetter[0].charAt(0).toLowerCase();

  return text.toLowerCase();
}

function pickExplanation(body: JsonRecord, source: JsonRecord) {
  const nested = asRecord(body.explanation) || asRecord(body.explicacion_manual);

  const text = asText(
    nested?.texto ??
    nested?.text ??
    nested?.explicacion ??
    body.explicacion ??
    body.explicacion_manual ??
    source.explicacion ??
    source.explicacion_manual
  );

  const rawVersion =
    nested?.prompt_version ??
    nested?.promptVersion ??
    body.prompt_version ??
    body.promptVersion ??
    source.prompt_version ??
    source.promptVersion;

  const version = Math.max(1, Math.round(Number(rawVersion || MANUAL_EXPLANATION_PROMPT_VERSION) || MANUAL_EXPLANATION_PROMPT_VERSION));

  return text ? { text, version } : null;
}

async function assertAdmin(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error('No se pudo verificar perfil admin: ' + error.message);

  if (!data || data.plan !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Solo admin puede corregir preguntas' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function buildPatch(source: JsonRecord): JsonRecord {
  const patch: JsonRecord = {};

  if ('pregunta' in source) patch.pregunta = String(source.pregunta ?? '');
  if ('enunciado' in source && !('pregunta' in source)) patch.pregunta = String(source.enunciado ?? '');

  if ('opciones' in source) {
    const ops = normalizeOptions(source.opciones);
    if (ops) patch.opciones = ops;
  }

  if ('respuesta' in source) patch.respuesta = normalizeAnswer(source.respuesta);
  if ('respuesta_correcta' in source && !('respuesta' in source)) {
    patch.respuesta = normalizeAnswer(source.respuesta_correcta);
  }

  if ('especialidad' in source) patch.especialidad = asText(source.especialidad);
  if ('tema' in source) patch.tema = asText(source.tema);
  if ('tipo' in source) patch.tipo = asText(source.tipo);
  if ('anulada' in source) patch.anulada = normalizeBool(source.anulada, false);

  if ('especialidad_v2' in source) patch.especialidad_v2 = asText(source.especialidad_v2);
  if ('tema_v2' in source) patch.tema_v2 = asText(source.tema_v2);
  if ('clasificacion_confianza' in source) patch.clasificacion_confianza = asText(source.clasificacion_confianza);
  if ('clasificacion_modelo' in source) patch.clasificacion_modelo = asText(source.clasificacion_modelo);

  patch.corregida = 'corregida' in source ? normalizeBool(source.corregida, true) : true;

  return patch;
}

async function publishQuestionBankVersion(admin: ReturnType<typeof createClient>) {
  const questionBankVersion = String(Date.now());

  const { error } = await admin
    .from('resiar_app_config')
    .upsert(
      {
        key: 'question_bank_version',
        value: questionBankVersion,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    );

  if (error) throw new Error('Pregunta guardada, pero no se pudo publicar la versión del banco: ' + error.message);

  return questionBankVersion;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceKey) {
      return json({ error: 'Faltan variables de Supabase' }, 500);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'No autorizado' }, 401);

    await assertAdmin(admin, userData.user.id);

    let body: JsonRecord = {};
    try { body = await req.json(); } catch (_) {}

    const action = String(body.action || 'update');
    const id = pickQuestionId(body);

    if (!id) {
      return json({ error: 'No se obtuvo el id de la pregunta', received_keys: Object.keys(body) }, 400);
    }

    if (action === 'delete-explanation' || action === 'delete_explanation' || action === 'deleteExplanation') {
      const { error: cacheError, count: cacheDeletedCount } = await admin
        .from('explicaciones_cache')
        .delete({ count: 'exact' })
        .eq('pregunta_id', id);

      if (cacheError) {
        return json({ error: 'No se pudo borrar la explicación cacheada: ' + cacheError.message }, 500);
      }

      return json({
        ok: true,
        adminUpdateQuestionVersion: ADMIN_UPDATE_QUESTION_VERSION,
        deletedExplanation: true,
        id,
        questionId: id,
        cacheInvalidated: true,
        cacheDeletedCount: cacheDeletedCount ?? 0
      });
    }

    if (action === 'delete') {
      await admin
        .from('preguntas_eliminadas')
        .upsert(
          {
            id,
            motivo: asText(body.motivo) || 'Borrada manualmente desde admin integrado'
          },
          { onConflict: 'id' }
        );

      const { error: cacheError } = await admin
        .from('explicaciones_cache')
        .delete()
        .eq('pregunta_id', id);

      if (cacheError) {
        return json({ error: 'No se pudo invalidar la explicación cacheada: ' + cacheError.message }, 500);
      }

      const { error: deleteError } = await admin
        .from('preguntas')
        .delete()
        .eq('id', id);

      if (deleteError) return json({ error: 'No se pudo borrar pregunta: ' + deleteError.message }, 500);

      const questionBankVersion = await publishQuestionBankVersion(admin);

      return json({
        ok: true,
        deleted: true,
        id,
        questionId: id,
        questionBankVersion,
        cacheInvalidated: true
      });
    }

    const source = getPatchSource(body);
    const patch = buildPatch(source);
    const explanation = pickExplanation(body, source);

    const { data: updated, error: updateError } = await admin
      .from('preguntas')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateError) return json({ error: 'No se pudo guardar pregunta: ' + updateError.message }, 500);
    if (!updated) return json({ error: 'Pregunta no encontrada', id }, 404);

    const { error: cacheError, count: cacheDeletedCount } = await admin
      .from('explicaciones_cache')
      .delete({ count: 'exact' })
      .eq('pregunta_id', id);

    if (cacheError) {
      return json({ error: 'Pregunta guardada, pero no se pudo invalidar explicación cacheada: ' + cacheError.message }, 500);
    }

    let manualExplanationSaved = false;
    let savedExplanation: JsonRecord | null = null;

    if (explanation?.text) {
      const promptVersion = explanation.version || MANUAL_EXPLANATION_PROMPT_VERSION;
      const row = {
        pregunta_id: id,
        prompt_version: promptVersion,
        texto: explanation.text,
        modelo: 'manual',
        updated_at: new Date().toISOString()
      };

      const { error: expError } = await admin
        .from('explicaciones_cache')
        .upsert(row, { onConflict: 'pregunta_id,prompt_version' });

      if (expError) {
        return json({ error: 'Pregunta guardada, pero falló explicación manual: ' + expError.message }, 500);
      }

      manualExplanationSaved = true;
      savedExplanation = row;
    }

    const questionBankVersion = await publishQuestionBankVersion(admin);

    return json({
      ok: true,
      adminUpdateQuestionVersion: ADMIN_UPDATE_QUESTION_VERSION,
      id,
      questionId: id,
      question: updated as JsonRecord,
      explanation: savedExplanation,
      questionBankVersion,
      cacheInvalidated: true,
      cacheDeletedCount: cacheDeletedCount ?? 0,
      manualExplanationSaved,
      appliedPatchKeys: Object.keys(patch)
    });
  } catch (err) {
    if (err instanceof Response) return err;

    return json({
      error: err instanceof Error ? err.message : 'Error inesperado'
    }, 500);
  }
});
