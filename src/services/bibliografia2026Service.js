const DEFAULT_LIMIT = 20;

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanNullable(value) {
  const text = cleanText(value);
  return text ? text : null;
}

const MAX_LIMIT = 300;

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(n)));
}

function normalizeLetter(value) {
  const letter = cleanText(value).toLowerCase();
  return ['a', 'b', 'c', 'd'].includes(letter) ? letter : '';
}

function normalizeQuestion(row) {
  if (!row || typeof row !== 'object') return null;
  const opciones = row.opciones && typeof row.opciones === 'object' ? row.opciones : {};
  const respuesta = normalizeLetter(row.respuesta);

  return {
    id: row.id,
    pregunta: cleanText(row.pregunta),
    opciones: {
      a: cleanText(opciones.a),
      b: cleanText(opciones.b),
      c: cleanText(opciones.c),
      d: cleanText(opciones.d)
    },
    respuesta,
    tipo: cleanText(row.tipo),
    especialidad: cleanText(row.especialidad),
    tema: cleanText(row.tema),
    num_original: row.num_original,
    fuente: cleanText(row.fuente),
    examenes: Array.isArray(row.examenes) ? row.examenes.map(cleanText).filter(Boolean) : [],
    pista: cleanText(row.pista),
    explicaciones: row.explicaciones && typeof row.explicaciones === 'object' ? row.explicaciones : {}
  };
}

function requireSupabase(sb) {
  if (!sb || typeof sb.rpc !== 'function') {
    throw new Error('No se pudo conectar con Supabase.');
  }
  return sb;
}

export async function getBibliografia2026Access(sb) {
  const client = requireSupabase(sb);

  const accessRes = await client.rpc('can_access_bibliografia_2026');
  if (accessRes.error) throw accessRes.error;

  const [planRes, trialRes] = await Promise.allSettled([
    client.rpc('get_my_plan'),
    client.rpc('get_my_trial_activado_at')
  ]);

  const planPayload = planRes.status === 'fulfilled' ? planRes.value : null;
  const trialPayload = trialRes.status === 'fulfilled' ? trialRes.value : null;

  return {
    allowed: !!accessRes.data,
    plan: planPayload && !planPayload.error ? cleanText(planPayload.data) : '',
    trialActivadoAt: trialPayload && !trialPayload.error ? (trialPayload.data || null) : null
  };
}

export async function getBibliografia2026Catalog(sb) {
  const client = requireSupabase(sb);
  const { data, error } = await client.rpc('get_bibliografia_2026_catalog');
  if (error) throw error;
  return data && typeof data === 'object'
    ? data
    : { total: 0, especialidades: [], temas: [], examenes: [], especialidades_por_examen: [], temas_por_examen: [] };
}

export async function getBibliografia2026Questions(sb, filters = {}) {
  const client = requireSupabase(sb);
  const { data, error } = await client.rpc('get_preguntas_bibliografia_2026', {
    p_limit: clampLimit(filters.limit),
    p_especialidad: cleanNullable(filters.especialidad),
    p_tema: cleanNullable(filters.tema),
    p_examen_relacionado: cleanNullable(filters.examenRelacionado)
  });

  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .map(normalizeQuestion)
    .filter((q) => q && q.id && q.pregunta && q.respuesta);
}

export async function submitBibliografia2026Session(sb, payload = {}) {
  const client = requireSupabase(sb);
  const respuestas = Array.isArray(payload.respuestas) ? payload.respuestas : [];
  const cleanAnswers = respuestas
    .map((item) => ({
      pregunta_id: cleanText(item?.pregunta_id),
      respuesta_elegida: normalizeLetter(item?.respuesta_elegida)
    }))
    .filter((item) => item.pregunta_id && item.respuesta_elegida);

  const { data, error } = await client.rpc('submit_bibliografia_2026_session', {
    p_modo: cleanNullable(payload.modo) || 'rapida',
    p_especialidad: cleanNullable(payload.especialidad),
    p_tema: cleanNullable(payload.tema),
    p_examen_relacionado: cleanNullable(payload.examenRelacionado),
    p_tiempo: Math.max(0, Math.round(Number(payload.tiempo) || 0)),
    p_respuestas: cleanAnswers
  });

  if (error) throw error;
  return data || null;
}

export async function getBibliografia2026Ranking(sb) {
  const client = requireSupabase(sb);
  const { data, error } = await client.rpc('get_ranking_bibliografia_2026');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getBibliografia2026MyStats(sb) {
  const client = requireSupabase(sb);
  const { data, error } = await client.rpc('get_bibliografia_2026_my_stats');
  if (error) throw error;
  return data && typeof data === 'object'
    ? data
    : { overview: {}, by_especialidad: [], by_tema: [], by_examen: [], recent_sessions: [] };
}
