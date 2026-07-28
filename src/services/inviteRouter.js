import {
  normalizeSocialNotificationPayload,
  createNotificationId,
  isInviteExpired,
  inviteRemainingMs,
  inviteExpiresAt
} from './cloudflareSocialClient.js';

import { normalizeQuestionImageFields } from '../utils/questionImages.js';

export const QUESTION_INVITE_SELECT = 'id,examen,anio,tipo,especialidad,tema,especialidad_v2,tema_v2,num_original,corregida,anulada,imagen_path,imagenes_paths,imagen_alt,imagen_caption';

function safeString(value) {
  return String(value ?? '').trim();
}

function defaultEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  if (total >= 60) {
    const min = Math.ceil(total / 60);
    return `${min} min`;
  }
  return `${total} s`;
}

export function stableInviteDomId(payload) {
  const data = payload?.data || {};
  const stableId = payload?.invite_id || payload?.notification_id || payload?.id || data.invite_id || data.notification_id || data.id || '';
  if (stableId) return 'inv_' + String(stableId).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 96);
  const fingerprint = [payload?.kind, data.question_id, data.room, data.examen, data.anio, data.num_original, payload?.t]
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .join('_');
  if (fingerprint) return 'inv_' + fingerprint.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 96);
  return 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function normalizeInvitePayload(payload) {
  return normalizeSocialNotificationPayload(payload);
}


function normalizeCatalogPayload(data) {
  if (Array.isArray(data)) return data[0] && typeof data[0] === 'object' ? data[0] : { questions: data };
  if (data && typeof data === 'object') return data;
  return { questions: [] };
}

function stripSensitiveQuestionFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.pregunta;
  delete out.opciones;
  delete out.respuesta;
  delete out.correct_answer;
  delete out.raw_correct_answer;
  return normalizeQuestionImageFields(out);
}

function isMissingRpcError(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || error || '').toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || (msg.includes('function') && msg.includes('not found'))
    || msg.includes('could not find the function')
    || msg.includes('does not exist');
}

function normalizeYearForRpc(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}


const SOFT_INVITE_VALIDATION_REASONS = new Set([
  'plan_restricted',
  'question_not_allowed',
  'question_not_visible',
  'forbidden',
  'access_denied',
  'worker_validate_unavailable',
  'validation_unavailable',
  'route_not_found',
  'not_found'
]);

function inviteValidationReason(validation) {
  return String(validation?.reason || validation?.error || validation?.code || '').trim();
}

function isSoftInviteValidationFailure(validation) {
  return SOFT_INVITE_VALIDATION_REASONS.has(inviteValidationReason(validation));
}

function rememberSoftInviteValidation(payload, validation) {
  try {
    window.__resiarLastInviteSoftValidation = {
      at: new Date().toISOString(),
      reason: inviteValidationReason(validation) || 'validation_unavailable',
      validation,
      invite_id: payload?.invite_id || payload?.notification_id || payload?.id || payload?.data?.invite_id || ''
    };
  } catch (_) {}
}

export function createInviteRouter(deps = {}) {
  function getState() {
    return typeof deps.getState === 'function' ? deps.getState() : deps.state || {};
  }

  function getSupabase() {
    return typeof deps.getSupabase === 'function' ? deps.getSupabase() : window.sb || null;
  }

  function getExam() {
    return typeof deps.getExam === 'function' ? deps.getExam() : [];
  }

  function getActual() {
    return Number(typeof deps.getActual === 'function' ? deps.getActual() : 0) || 0;
  }

  function getPreguntas() {
    return typeof deps.getPreguntas === 'function' ? deps.getPreguntas() : [];
  }

  function getCurrentProfile() {
    return typeof deps.getCurrentProfile === 'function' ? deps.getCurrentProfile() : null;
  }

  function getServerAccess() {
    if (typeof deps.getServerAccess === 'function') return deps.getServerAccess();
    return getCurrentProfile()?.plan || null;
  }

  function getQuestionKey(p) {
    return typeof deps.getQuestionKey === 'function' ? deps.getQuestionKey(p) : String(p?.id || '');
  }

  function getQuestionLabel(p) {
    if (typeof deps.getQuestionLabel === 'function') return deps.getQuestionLabel(p);
    return { title: 'Pregunta', sub: 'Sala de estudio' };
  }

  function getQuestionNumber(p) {
    return typeof deps.getQuestionNumber === 'function' ? deps.getQuestionNumber(p) : getActual() + 1;
  }

  function escape(value) {
    return typeof deps.escapeHtml === 'function' ? deps.escapeHtml(value) : defaultEscape(value);
  }

  function toast(message, timeout) {
    return typeof deps.mostrarToast === 'function' ? deps.mostrarToast(message, timeout) : undefined;
  }

  async function validateInvite(payload) {
    if (typeof deps.validateInvite === 'function') return deps.validateInvite(payload);
    return { ok: true, valid: true, skipped: true };
  }

  function removeInvite(inviteId) {
    try { getState().invites?.delete(inviteId); } catch (_) {}
  }

  function currentContext(type) {
    const exam = getExam();
    const actual = getActual();
    const p = exam?.[actual];
    if (!p) return null;
    const label = getQuestionLabel(p);
    const room = getQuestionKey(p);
    const inviteId = createNotificationId('inv');
    const inviteType = 'question';
    return {
      schema_version: 3,
      source: 'resiar_frontend',
      invite_id: inviteId,
      notification_id: inviteId,
      invite_type: inviteType,
      kind: 'invite_question',
      room,
      room_key: room,
      question_key: room,
      scope: getState().scope === 'friends' ? 'friends' : 'public',
      question_index: Number(actual || 0),
      question_id: p.id || p.pregunta_id || null,
      pregunta_id: p.pregunta_id || p.id || null,
      question_num_original: p.num_original ?? null,
      num_original: p.num_original ?? null,
      title: label.title,
      sub: label.sub,
      examen: p.examen || p.tipo || '',
      tipo: p.tipo || p.examen || '',
      anio: p.anio || p.año || p.year || '',
      year: p.year || p.anio || p.año || '',
      especialidad: p.especialidad || p.especialidad_v2 || '',
      tema: p.tema || p.tema_v2 || '',
      total: Array.isArray(exam) ? exam.length : 0,
      sent_at: Date.now(),
      // El Worker vuelve a calcular expires_at de forma autoritativa; esto solo mejora la UI local si el payload se renderiza antes de la respuesta.
      expires_at: Date.now() + 10 * 60 * 1000
    };
  }

  function register(payload) {
    const normalized = normalizeInvitePayload(payload);
    if (!normalized || !normalized.data || isInviteExpired(normalized)) return '';
    const id = stableInviteDomId(normalized);
    const state = getState();
    if (!state.invites || typeof state.invites.set !== 'function') state.invites = new Map();
    state.invites.set(id, normalized);
    return id;
  }

  function receive(payload) {
    const normalized = normalizeInvitePayload(payload);
    if (!normalized || isInviteExpired(normalized)) return;
    const id = register(normalized);
    if (!id) return;
    showToast(id, normalized);
  }

  function sameExam(p, data) {
    if (!p || !data) return false;
    const exA = String(p.examen || p.tipo || '').trim().toLowerCase();
    const exB = String(data.examen || data.tipo || data.exam || '').trim().toLowerCase();
    const anA = String(p.anio || p.año || p.year || '').trim();
    const anB = String(data.anio || data.año || data.year || '').trim();
    return !!exA && !!exB && exA === exB && (!anB || anA === anB);
  }

  function findIndexIn(list, data) {
    if (!Array.isArray(list) || !list.length || !data) return -1;
    const targetRooms = [data.room, data.room_key, data.question_key, data.q].map(v => String(v || '')).filter(Boolean);
    const targetIds = [data.question_id, data.pregunta_id, data.id_pregunta].map(v => String(v || '')).filter(Boolean);
    const targetNum = data.num_original ?? data.question_num_original;
    const targetNumStr = targetNum === undefined || targetNum === null ? '' : String(targetNum);
    return list.findIndex(p => {
      const pId = String(p.id || p.pregunta_id || '');
      if (targetIds.length && targetIds.includes(pId)) return true;
      if (targetRooms.length && targetRooms.includes(getQuestionKey(p))) return true;
      if (targetNumStr && sameExam(p, data) && String(p.num_original ?? '') === targetNumStr) return true;
      return false;
    });
  }

  function mergeQuestionData(data, row) {
    if (!row) return data || {};
    const imageFields = normalizeQuestionImageFields({
      imagen_path: data?.imagen_path || row.imagen_path || '',
      imagenes_paths: data?.imagenes_paths ?? row.imagenes_paths ?? null,
      imagen_alt: data?.imagen_alt || row.imagen_alt || '',
      imagen_caption: data?.imagen_caption || row.imagen_caption || ''
    });
    return {
      ...(data || {}),
      question_id: data?.question_id || row.id || row.pregunta_id || '',
      pregunta_id: data?.pregunta_id || row.pregunta_id || row.id || '',
      examen: data?.examen || row.examen || row.tipo || '',
      tipo: data?.tipo || row.tipo || row.examen || '',
      anio: data?.anio || row.anio || row.año || row.year || '',
      year: data?.year || row.year || row.anio || row.año || '',
      ...imageFields,
      num_original: data?.num_original ?? data?.question_num_original ?? row.num_original ?? null,
      question_num_original: data?.question_num_original ?? data?.num_original ?? row.num_original ?? null
    };
  }

  async function prepareSession(list, idx) {
    const openChat = () => {
      const state = getState();
      state.open = true;
      setTimeout(() => {
        try { if (typeof deps.openChat === 'function') deps.openChat(); } catch (_) {}
      }, 140);
    };
    return typeof deps.startInviteSession === 'function'
      ? await deps.startInviteSession(list, idx, openChat)
      : false;
  }

  async function fetchCatalogRows({ ids = [], examen = null, anio = null, limit = 1000 } = {}) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase no está disponible.');

    const cleanIds = Array.isArray(ids)
      ? ids.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 10000));

    if (typeof sb.rpc === 'function') {
      try {
        const { data, error } = await sb.rpc('get_question_catalog_v72', {
          p_question_ids: cleanIds,
          p_examen: examen ? String(examen) : null,
          p_anio: normalizeYearForRpc(anio),
          p_limit: safeLimit
        });
        if (error) throw error;
        const payload = normalizeCatalogPayload(data);
        return (Array.isArray(payload.questions) ? payload.questions : [])
          .map(stripSensitiveQuestionFields)
          .filter(Boolean);
      } catch (error) {
        if (!isMissingRpcError(error)) throw error;
      }
    }

    // Compatibilidad solo para despliegues donde todavía no existe el RPC v72.
    // No solicita enunciado, opciones ni respuesta.
    if (cleanIds.length) {
      const { data: rows, error } = await sb
        .from('preguntas')
        .select(QUESTION_INVITE_SELECT)
        .in('id', cleanIds)
        .limit(safeLimit);
      if (error) throw error;
      const byId = new Map((rows || []).map((row) => [String(row?.id || ''), row]));
      return cleanIds.map((id) => byId.get(id)).filter(Boolean).map(stripSensitiveQuestionFields);
    }

    let q = sb.from('preguntas').select(QUESTION_INVITE_SELECT);
    if (examen) q = q.eq('examen', String(examen));
    const normalizedYear = normalizeYearForRpc(anio);
    if (normalizedYear !== null) q = q.eq('anio', normalizedYear);
    const { data: rows, error } = await q
      .order('num_original', { ascending: true })
      .limit(safeLimit);
    if (error) throw error;
    return (rows || []).map(stripSensitiveQuestionFields);
  }

  async function fetchQuestion(data) {
    const ids = [data?.question_id, data?.pregunta_id, data?.id_pregunta]
      .map(v => String(v || '').trim())
      .filter(Boolean);
    if (ids.length) {
      const rows = await fetchCatalogRows({ ids, limit: ids.length });
      if (rows.length) return rows[0];
    }

    const examName = safeString(data?.examen || data?.tipo || data?.exam);
    if (examName) {
      const year = data?.anio ?? data?.year ?? data?.año;
      const rows = await fetchCatalogRows({ examen: examName, anio: year, limit: 300 });
      const idx = findIndexIn(rows || [], data);
      if (idx >= 0) return rows[idx];
    }

    return null;
  }

  async function fetchExam(data) {
    let seed = null;
    let normalized = data || {};
    if (!safeString(normalized.examen || normalized.tipo) && (normalized.question_id || normalized.pregunta_id || normalized.id_pregunta)) {
      seed = await fetchQuestion(normalized);
      normalized = mergeQuestionData(normalized, seed);
    }
    const examName = safeString(normalized.examen || normalized.tipo || normalized.exam);
    if (!examName) return seed ? [seed] : [];
    const year = normalized.anio ?? normalized.year ?? normalized.año;
    const rows = await fetchCatalogRows({ examen: examName, anio: year, limit: 10000 });
    return rows.length ? rows : (seed ? [seed] : []);
  }

  function accessDenied(data) {
    const examName = data?.examen ? ` (${data.examen}${data.anio ? ' · ' + data.anio : ''})` : '';
    toast(`🔒 No podés abrir esa invitación con tu plan actual${examName}. El acceso se valida contra Supabase y no se desbloquea por invitación.`, 8500);
  }

  async function openPayload(inviteId) {
    const payload = getState().invites?.get(inviteId);
    const normalized = normalizeInvitePayload(payload);
    let data = normalized?.data || {};
    if (!normalized || !data) {
      toast('⛔ La invitación no está disponible. Abrí Social > Actividad y probá de nuevo.', 6500);
      return;
    }
    if (isInviteExpired(normalized)) {
      removeInvite(inviteId);
      toast('⏳ La invitación expiró. Pedile a tu amigo que te mande una nueva.', 6500);
      return;
    }

    try {
      let validation = null;
      try {
        validation = await validateInvite(normalized);
      } catch (validationError) {
        validation = {
          ok: false,
          valid: true,
          skipped: true,
          reason: 'validation_unavailable',
          error: validationError?.message || String(validationError || '')
        };
        rememberSoftInviteValidation(normalized, validation);
      }

      if (validation && validation.valid === false) {
        const reason = inviteValidationReason(validation);
        if (isSoftInviteValidationFailure(validation)) {
          // Cloudflare Live solo valida presencia/notificación. El acceso real al banco
          // lo decide Supabase al abrir la sesión segura. No bloqueamos acá por plan
          // ni por visibilidad local para evitar falsos negativos admin/pro.
          rememberSoftInviteValidation(normalized, validation);
        } else {
          removeInvite(inviteId);
          const msg = reason === 'sender_left'
            ? '⏳ La invitación ya no está activa porque tu amigo salió de ese examen/pregunta.'
            : reason === 'expired'
              ? '⏳ La invitación expiró. Pedile a tu amigo que te mande una nueva.'
              : '⛔ La invitación ya no está disponible.';
          toast(msg, 7500);
          return;
        }
      }

      const exam = getExam();
      let idx = findIndexIn(exam, data);
      if (idx >= 0) {
        getState().open = true;
        if (typeof deps.irDesdeNav === 'function') deps.irDesdeNav(idx);
        setTimeout(() => {
          try { if (typeof deps.openChat === 'function') deps.openChat(); } catch (_) {}
        }, 120);
        toast('✅ Invitación abierta.');
        return;
      }


      const visibleQuestions = getPreguntas() || [];
      let pool = visibleQuestions.filter(p => sameExam(p, data));
      idx = findIndexIn(pool, data);
      if (idx >= 0 && pool.length) {
        await prepareSession(pool, idx);
        toast('✅ Pregunta abierta desde invitación.');
        return;
      }

      // No se bloquea por el pool local: el banco visible real lo decide el RPC
      // sanitizado de Supabase. El cliente no lee enunciado/opciones/respuesta
      // desde public.preguntas para resolver invitaciones.
      if (!pool.length && (data?.examen || data?.tipo)) pool = await fetchExam(data);
      idx = findIndexIn(pool, data);
      if (idx >= 0 && pool.length) {
        await prepareSession(pool, idx);
        toast('✅ Pregunta abierta desde invitación.');
        return;
      }

      const row = await fetchQuestion(data);
      if (row) {
        data = mergeQuestionData(data, row);
        await prepareSession([row], 0);
        toast('✅ Pregunta abierta desde invitación.');
        return;
      }

      accessDenied(data);
    } catch (e) {
      console.warn('inviteRouter.openPayload:', e);
      toast('⛔ No se pudo abrir la invitación: ' + (e.message || e), 7500);
    }
  }

  function showToast(inviteId, payload) {
    const remaining = inviteRemainingMs(payload);
    if (remaining <= 0 || isInviteExpired(payload)) return;
    const actor = payload?.actor?.username || 'Un amigo';
    const kind = payload?.kind;
    const data = payload?.data || {};
    const title = 'Invitación a pregunta';
    const detail = data.title || data.sub || 'Sala de estudio';
    const expiresText = `Expira en ${formatRemaining(remaining)}`;
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      wrap.className = 'resiar-toast-wrap';
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'qinvite-toast';
    t.innerHTML = `<div class="qinvite-toast-kicker">${escape(title)}</div><div class="qinvite-toast-body"><strong>${escape(actor)}</strong> te invitó a resolver: ${escape(detail)}</div><div class="qinvite-toast-expiry">${escape(expiresText)}</div><div class="qinvite-toast-actions"><button type="button" data-action="question-invite-open-payload" data-invite-id="${escape(inviteId)}">Abrir</button><button class="secondary" type="button">Cerrar</button></div>`;
    const closeBtn = t.querySelector('button.secondary');
    const openBtn = t.querySelector('[data-action="question-invite-open-payload"]');
    function dismiss() {
      t.classList.remove('is-visible');
      t.classList.add('is-dismissing');
      setTimeout(() => t.remove(), 260);
    }
    openBtn?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      dismiss();
      openPayload(inviteId);
    });
    closeBtn?.addEventListener('click', dismiss);
    t.addEventListener('click', ev => { if (ev.target === t) dismiss(); });
    wrap.appendChild(t);
    requestAnimationFrame(() => { t.classList.add('is-visible'); });
    setTimeout(dismiss, Math.max(4000, Math.min(14000, remaining)));
  }

  return {
    currentContext,
    normalizePayload: normalizeInvitePayload,
    stableDomId: stableInviteDomId,
    register,
    receive,
    openPayload,
    sameExam,
    findIndexIn,
    mergeQuestionData,
    fetchQuestion,
    fetchExam,
    isExpired: isInviteExpired,
    remainingMs: inviteRemainingMs,
    expiresAt: inviteExpiresAt
  };
}
