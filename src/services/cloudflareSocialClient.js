import { readText } from '../utils/storage.js';

const DEFAULT_CLOUDFLARE_LIVE_URL = 'https://resiar-social-live.palomequeluciano.workers.dev';

export const RESIAR_SOCIAL_INVITE_KINDS = new Set(['invite_question']);
export const DEFAULT_INVITE_TTL_MS = 10 * 60 * 1000;

export function isInviteKind(kind) {
  return RESIAR_SOCIAL_INVITE_KINDS.has(String(kind || ''));
}

export function createNotificationId(prefix = 'ntf') {
  try {
    if (crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch (_) {}
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createCloudflareClientId(prefix = 'qc') {
  try {
    if (crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  } catch (_) {}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeCloudflareLiveUrl(value) {
  const raw = String(value || '').trim();
  return raw.replace(/\/+$/, '');
}

export function readConfiguredCloudflareLiveUrl() {
  return normalizeCloudflareLiveUrl(
    readText('resiar_cf_chat_url', null) ||
    readText('resar_cf_chat_url', null) ||
    window.RESIAR_CLOUDFLARE_CHAT_URL ||
    DEFAULT_CLOUDFLARE_LIVE_URL
  );
}

export function normalizeSocialNotificationData(kind, data, notificationId) {
  let out = data && typeof data === 'object' ? { ...data } : {};
  if (typeof data === 'string') {
    try { out = JSON.parse(data); } catch (_) { out = {}; }
  }
  if (!out || typeof out !== 'object') out = {};

  const finalKind = kind || out.kind || '';
  if (notificationId) {
    out.invite_id = out.invite_id || notificationId;
    out.notification_id = out.notification_id || notificationId;
  }
  out.kind = out.kind || finalKind;

  if (isInviteKind(finalKind)) {
    out.invite_type = 'question';
    out.sender_uid = out.sender_uid || out.sender_id || out.actor_uid || '';
    out.room = out.room || out.room_key || out.question_key || out.q || '';
    out.room_key = out.room_key || out.room || out.question_key || out.q || '';
    out.question_key = out.question_key || out.room || out.room_key || out.q || '';
    out.question_id = out.question_id || out.pregunta_id || out.id_pregunta || '';
    out.pregunta_id = out.pregunta_id || out.question_id || out.id_pregunta || '';
    out.examen = out.examen || out.exam || out.tipo || '';
    out.tipo = out.tipo || out.examen || out.exam || '';
    out.anio = out.anio || out.año || out.year || '';
    out.year = out.year || out.anio || out.año || '';
    out.num_original = out.num_original ?? out.question_num_original ?? null;
    out.question_num_original = out.question_num_original ?? out.num_original ?? null;
  }

  return out;
}

export function inviteExpiresAt(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const kind = payload?.kind || data.kind || '';
  if (!isInviteKind(kind)) return 0;
  const sentAt = Number(data.sent_at || payload?.t || Date.now());
  return Number(payload?.expires_at || data.expires_at || (sentAt + DEFAULT_INVITE_TTL_MS));
}

export function inviteRemainingMs(payload, now = Date.now()) {
  const expiresAt = inviteExpiresAt(payload);
  return expiresAt ? Math.max(0, expiresAt - now) : 0;
}

export function isInviteExpired(payload, now = Date.now()) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const kind = payload?.kind || data.kind || '';
  if (!isInviteKind(kind)) return false;
  return inviteRemainingMs(payload, now) <= 0;
}

export function normalizeSocialNotificationPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  let data = payload.data || {};
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (_) { data = {}; }
  }
  if (!data || typeof data !== 'object') data = {};

  const id = String(
    payload.invite_id || payload.notification_id || payload.id ||
    data.invite_id || data.notification_id || data.id || ''
  ).trim();
  const kind = payload.kind || data.kind || 'invite_question';
  const normalizedData = normalizeSocialNotificationData(kind, data, id);
  const t = Number(payload.t || normalizedData.sent_at || Date.now());
  if (isInviteKind(kind)) {
    const sentAt = Number(normalizedData.sent_at || t || Date.now());
    const expiresAt = Number(payload.expires_at || normalizedData.expires_at || (sentAt + DEFAULT_INVITE_TTL_MS));
    normalizedData.sent_at = sentAt;
    normalizedData.expires_at = expiresAt;
    normalizedData.sender_uid = normalizedData.sender_uid || payload?.actor?.uid || payload?.actor?.id || '';
  }

  return {
    ...payload,
    id: payload.id || id || '',
    invite_id: payload.invite_id || id || normalizedData.invite_id || '',
    notification_id: payload.notification_id || id || normalizedData.notification_id || '',
    expires_at: isInviteKind(kind) ? normalizedData.expires_at : payload.expires_at,
    type: payload.type || 'social_notification',
    kind,
    data: normalizedData,
    t
  };
}

export function createCloudflareSocialClient(options = {}) {
  const clientId = options.clientId || createCloudflareClientId(options.clientIdPrefix || 'qc');

  function getSb() {
    return typeof options.getSb === 'function' ? options.getSb() : window.sb || null;
  }

  function getCurrentUser() {
    return typeof options.getCurrentUser === 'function' ? options.getCurrentUser() : null;
  }

  function getWorkerUrl() {
    if (typeof options.getWorkerUrl === 'function') return normalizeCloudflareLiveUrl(options.getWorkerUrl());
    return readConfiguredCloudflareLiveUrl();
  }

  function isConfigured() {
    const url = getWorkerUrl();
    return Boolean(url) && !/TU_SUBDOMINIO|YOUR_SUBDOMAIN/i.test(url);
  }

  function httpBase() {
    return getWorkerUrl();
  }

  function wsOrigin() {
    const u = new URL(httpBase());
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.origin;
  }

  async function getAccessToken() {
    const sb = getSb();
    if (!sb?.auth?.getSession) throw new Error('Supabase no está disponible.');
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || '';
  }

  async function requestTicket(payload = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('Sin sesión de Supabase');
    const res = await fetch(httpBase() + '/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...payload, client_id: payload.client_id || clientId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ticket) throw new Error(data?.error || 'No se pudo emitir ticket Cloudflare Live.');
    return data.ticket;
  }

  function buildQuestionWsUrl(room, { scope = 'public', ticket } = {}) {
    const url = new URL(wsOrigin() + '/ws/question/' + encodeURIComponent(room));
    url.searchParams.set('scope', scope);
    if (ticket) url.searchParams.set('ticket', ticket);
    return url.toString();
  }

  function buildSocialWsUrl(ticket) {
    const url = new URL(wsOrigin() + '/ws/social');
    if (ticket) url.searchParams.set('ticket', ticket);
    return url.toString();
  }

  async function connectSocial(handlers = {}) {
    const ticket = await requestTicket({ kind: 'social', client_id: handlers.client_id || clientId });
    const ws = new WebSocket(buildSocialWsUrl(ticket));
    if (typeof handlers.onOpen === 'function') ws.onopen = handlers.onOpen;
    if (typeof handlers.onMessage === 'function') ws.onmessage = handlers.onMessage;
    if (typeof handlers.onClose === 'function') ws.onclose = handlers.onClose;
    if (typeof handlers.onError === 'function') ws.onerror = handlers.onError;
    return ws;
  }

  async function fetchStatuses(ids = []) {
    const cleanIds = Array.isArray(ids) ? ids.filter(Boolean).slice(0, 80) : [];
    if (!cleanIds.length) return {};
    const token = await getAccessToken();
    if (!token) return {};
    const res = await fetch(httpBase() + '/social/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ ids: cleanIds })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo cargar estado online.');
    return json.status || {};
  }

  async function fetchActivity() {
    const token = await getAccessToken();
    if (!token) return [];
    const res = await fetch(httpBase() + '/social/activity', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo cargar actividad.');
    return (Array.isArray(json.items) ? json.items : []).filter(item => !isInviteExpired(normalizeSocialNotificationPayload(item)));
  }

  async function fetchProfile(userId) {
    const token = await getAccessToken();
    if (!token) throw new Error('Sesión inválida.');
    const url = new URL(httpBase() + '/social/profile');
    url.searchParams.set('user_id', userId);
    const res = await fetch(url.toString(), { headers: { 'Authorization': 'Bearer ' + token } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo cargar el perfil.');
    return json;
  }

  async function validateInvite(payload) {
    const normalized = normalizeSocialNotificationPayload(payload);
    if (!normalized || !isInviteKind(normalized.kind)) return { ok: true, valid: true, reason: 'not_invite' };
    if (isInviteExpired(normalized)) {
      return { ok: true, valid: false, reason: 'expired', expires_at: inviteExpiresAt(normalized) };
    }
    if (!isConfigured()) return { ok: true, valid: true, skipped: true, reason: 'worker_not_configured' };
    const token = await getAccessToken();
    if (!token) throw new Error('Sesión inválida.');
    const res = await fetch(httpBase() + '/invite/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(normalized)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && json.valid !== false) throw new Error(json.error || 'No se pudo validar la invitación.');
    return json;
  }

  async function notifyUser(targetUserId, kind, data = {}, notifyOptions = {}) {
    if (String(kind || '').startsWith('invite_') && !isInviteKind(kind)) {
      throw new Error('Tipo de invitación no soportado.');
    }
    const user = getCurrentUser();
    if (!targetUserId || !user || targetUserId === user.id) return null;
    if (!isConfigured()) throw new Error('Cloudflare Live no está configurado.');

    const notificationId = String(
      notifyOptions.id || notifyOptions.invite_id || data?.invite_id || data?.notification_id ||
      createNotificationId(isInviteKind(kind) ? 'inv' : 'ntf')
    );
    const normalizedData = normalizeSocialNotificationData(kind, data || {}, notificationId);
    const token = await getAccessToken();
    if (!token) throw new Error('Sesión inválida.');

    const res = await fetch(httpBase() + '/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        id: notificationId,
        invite_id: isInviteKind(kind) ? notificationId : undefined,
        target_user_id: targetUserId,
        kind,
        data: normalizedData,
        title: notifyOptions.title || '',
        body: notifyOptions.body || ''
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = json.error || '';
      if (code === 'sender_not_in_question_room') throw new Error('Solo podés invitar desde la pregunta activa. Esperá a que conecte el chat y probá de nuevo.');
      if (code === 'unsupported_invite_type') throw new Error('Solo se permiten invitaciones a pregunta.');
      if (code === 'not_friends') throw new Error('Solo podés invitar amigos.');
      throw new Error(code || 'No se pudo notificar al usuario.');
    }
    return { ...json, id: json.id || notificationId, invite_id: json.invite_id || normalizedData.invite_id || notificationId };
  }

  return {
    clientId,
    getWorkerUrl,
    isConfigured,
    httpBase,
    wsOrigin,
    getAccessToken,
    requestTicket,
    buildQuestionWsUrl,
    buildSocialWsUrl,
    connectSocial,
    fetchStatuses,
    fetchActivity,
    fetchProfile,
    validateInvite,
    notifyUser,
    normalizeData: normalizeSocialNotificationData,
    normalizePayload: normalizeSocialNotificationPayload,
    isInviteExpired,
    inviteRemainingMs,
    inviteExpiresAt
  };
}
