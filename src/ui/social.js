import { formatEsp } from '../utils/text.js';
import {
  createCloudflareSocialClient,
  isInviteKind as cloudflareIsInviteKind,
  normalizeSocialNotificationPayload,
  isInviteExpired
} from '../services/cloudflareSocialClient.js';

let socialDeps = {
  getSb: () => window.sb || null,
  getCurrentUser: () => null,
  abrirAuth: () => {},
  mostrarToast: () => {},
  escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m])),
  resiarAvatarHtml: (profile, cls) => `<div class="${cls || ''}">${String(profile?.username || '?').slice(0,1).toUpperCase() || '?'}</div>`,
  resiarInstallAvatarFallback: () => {},
  getQuestionChatWorkerConfigured: () => false,
  getQuestionChatWorkerUrl: () => '',
  getQuestionChatClientId: () => '',
  getQuestionInviteReceive: () => () => {},
  getQuestionInviteRegister: () => () => '',
  getQuestionChatState: () => null,
  cloudflareLiveClient: null
};

let socialListenersInstalled = false;
let socialMetaInterval = null;
let fallbackCloudflareClient = null;

export function configureSocial(deps = {}) {
  socialDeps = { ...socialDeps, ...deps };
  try { socialDeps.resiarInstallAvatarFallback?.(); } catch (_) {}
  installSocialRuntimeListeners();
  try { socialUpdateSummary(); } catch (_) {}
  try { socialStartRealtime(); } catch (_) {}
  return {
    socialState,
    cargarSocialSidebar,
    socialStartRealtime,
    socialStopRealtime,
    socialRequestRefresh,
    buscarUsuariosSocial,
    socialScheduleSearch,
    enviarSolicitudSocial,
    responderSolicitudSocial,
    eliminarAmigoSocial,
    socialOpenFriendProfile,
    socialCloseFriendProfile,
    socialNotifyUser
  };
}

function getSb() { return typeof socialDeps.getSb === 'function' ? socialDeps.getSb() : null; }
function getCurrentUser() { return typeof socialDeps.getCurrentUser === 'function' ? socialDeps.getCurrentUser() : null; }
function getAbrirAuth() { return socialDeps.abrirAuth || function(){}; }
function getMostrarToast() { return socialDeps.mostrarToast || function(){}; }
function getEscapeHtml() { return socialDeps.escapeHtml || ((value) => String(value ?? '')); }
function getAvatarHtml() { return socialDeps.resiarAvatarHtml || ((profile, cls) => `<div class="${cls || ''}">${String(profile?.username || '?').slice(0,1).toUpperCase() || '?'}</div>`); }
function getCloudflareClient() {
  if (socialDeps.cloudflareLiveClient) return socialDeps.cloudflareLiveClient;
  if (!fallbackCloudflareClient) {
    fallbackCloudflareClient = createCloudflareSocialClient({ getSb, getCurrentUser });
  }
  return fallbackCloudflareClient;
}
function getQuestionChatWorkerConfigured() { return () => getCloudflareClient().isConfigured(); }
function getWorkerUrl() { return getCloudflareClient().getWorkerUrl(); }
function getClientId() { return getCloudflareClient().clientId; }
function getQuestionInviteReceive() { return typeof socialDeps.getQuestionInviteReceive === 'function' ? socialDeps.getQuestionInviteReceive() : function(){}; }
function getQuestionInviteRegister() { return typeof socialDeps.getQuestionInviteRegister === 'function' ? socialDeps.getQuestionInviteRegister() : function(){ return ''; }; }
function getQuestionChatState() { return typeof socialDeps.getQuestionChatState === 'function' ? socialDeps.getQuestionChatState() : null; }

function installSocialRuntimeListeners() {
  if (socialListenersInstalled) return;
  socialListenersInstalled = true;
  document.addEventListener('DOMContentLoaded', () => {
    socialUpdateSummary();
    socialStartRealtime();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getCurrentUser()) {
      socialRequestRefresh(120);
      socialRefreshLiveMeta().catch(e => console.warn('socialRefreshLiveMeta:', e));
    }
  });
  if (!socialMetaInterval) {
    socialMetaInterval = setInterval(() => {
      if (getCurrentUser() && socialState.loaded && !document.hidden) {
        socialRefreshLiveMeta().catch(e => console.warn('socialRefreshLiveMeta:', e));
      }
    }, 45000);
  }
}

/* ══ SOCIAL SIDEBAR — Supabase RPC integrado ══ */
export const socialState = {
  loaded:false,
  friends:[],
  incoming:[],
  outgoing:[],
  search:[],
  busy:false,
  busyAction:false,
  searchTimer:null,
  searchSeq:0,
  refreshTimer:null,
  refreshQueued:false,
  realtimeChannel:null,
  realtimeUserId:null,
  cfWs:null,
  cfConnectSeq:0,
  cfReconnectTimer:null,
  cfIntentionalClose:false,
  cfConnected:false,
  statusMap:{},
  activity:[],
  statusTimer:null,
  profileBusy:false
};

function socialEsc(v) {
  if (typeof getEscapeHtml() === 'function') return getEscapeHtml()(String(v ?? ''));
  return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function socialAvatar(profile) {
  return getAvatarHtml()(profile, 'social-avatar', 'div');
}
function socialSetText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function socialSetHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function socialSetLoading() {
  ['socialIncomingList','socialOutgoingList','socialFriendsList'].forEach(id => socialSetHtml(id, '<div class="social-empty social-loading">Cargando...</div>'));
}
function socialUpdateSummary() {
  const friends = socialState.friends.length;
  const inc = socialState.incoming.length;
  const out = socialState.outgoing.length;
  socialSetText('socialFriendsCount', String(friends));
  socialSetText('socialIncomingCount', String(inc));
  socialSetText('socialOutgoingCount', String(out));
  socialSetText('socialFriendsBadge', String(friends));
  socialSetText('socialIncomingBadge', String(inc));
  socialSetText('socialOutgoingBadge', String(out));

  const summary = document.getElementById('summary-social');
  const dot = document.getElementById('socialDot');
  if (summary) {
    summary.className = 'sb-trigger-summary';
    if (!getCurrentUser()) {
      summary.textContent = 'Login';
      summary.classList.add('var-warn');
    } else if (inc > 0) {
      summary.textContent = inc + ' nueva' + (inc === 1 ? '' : 's');
      summary.classList.add('var-warn');
    } else if (friends > 0) {
      summary.textContent = friends + ' amigo' + (friends === 1 ? '' : 's');
    } else {
      summary.textContent = 'Amigos';
      summary.classList.add('var-muted');
    }
  }
  if (dot) {
    dot.classList.remove('state-warn','state-pro');
    if (!getCurrentUser() || inc > 0) dot.classList.add('state-warn');
  }
}

function socialNow() { return Date.now(); }
function socialIsInviteKind(kind) {
  return cloudflareIsInviteKind(kind);
}

function socialFormatRelative(t) {
  const n = Number(t || 0);
  if (!n) return 'sin datos';
  const diff = Math.max(0, socialNow() - n);
  if (diff < 45000) return 'recién';
  const min = Math.round(diff / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}
function socialStatusFor(uid) {
  return socialState.statusMap && uid ? socialState.statusMap[uid] : null;
}
function socialStatusLabel(uid) {
  const st = socialStatusFor(uid);
  if (st?.online) return 'Online';
  if (st?.last_seen_at) return 'Última vez ' + socialFormatRelative(st.last_seen_at);
  return 'Sin actividad reciente';
}
function socialStatusDot(uid) {
  const st = socialStatusFor(uid);
  return `<span class="social-online-dot ${st?.online ? 'on' : ''}"></span>`;
}
function socialActivityIcon(kind) {
  if (kind === 'friend_request_sent') return '👋';
  if (kind === 'friend_request_accepted') return '✅';
  if (kind === 'friend_request_rejected') return '↩';
  if (kind === 'friend_request_cancelled') return '↩';
  if (kind === 'friend_removed') return '—';
  if (kind === 'invite_question') return '❔';
  return '🔔';
}
function socialActivityText(item) {
  const actor = item?.actor?.username || 'Un amigo';
  const kind = item?.kind || '';
  if (kind === 'friend_request_sent') return `${actor} te envió una solicitud.`;
  if (kind === 'friend_request_accepted') return `${actor} aceptó tu solicitud.`;
  if (kind === 'friend_request_rejected') return `${actor} rechazó una solicitud.`;
  if (kind === 'friend_request_cancelled') return `${actor} canceló una solicitud.`;
  if (kind === 'friend_removed') return `${actor} actualizó su amistad.`;
  if (kind === 'invite_question') return `${actor} te invitó a una pregunta.`;
  return item?.body || 'Actividad social reciente.';
}
function socialIsInviteActivity(item) {
  return socialIsInviteKind(item?.kind || '');
}
function socialNormalizeInviteActivity(item) {
  if (!item || !socialIsInviteActivity(item)) return null;
  const normalized = normalizeSocialNotificationPayload(item);
  if (!normalized || isInviteExpired(normalized)) return null;
  return {
    ...normalized,
    actor: normalized.actor || item.actor || {},
    body: normalized.body || item.body || '',
    t: normalized.t || Date.now()
  };
}
function socialRegisterInviteActivity(item) {
  const payload = socialNormalizeInviteActivity(item);
  if (!payload?.data) return '';
  try {
    const register = getQuestionInviteRegister();
    if (typeof register !== 'function') return '';
    return register(payload) || '';
  } catch (e) {
    console.warn('socialRegisterInviteActivity:', e);
    return '';
  }
}
function socialRenderActivity() {
  socialSetText('socialActivityBadge', String(socialState.activity.length || 0));
  const live = document.getElementById('socialLiveSummary');
  if (live) {
    const online = socialState.friends.filter(f => socialStatusFor(f.id)?.online).length;
    const text = online ? `${online} amigo${online === 1 ? '' : 's'} online` : 'Sin amigos online';
    live.innerHTML = `<span>Online</span><strong>${socialEsc(text)}</strong>`;
  }
  if (!socialState.activity.length) {
    socialSetHtml('socialActivityList', '<div class="social-empty">Sin actividad reciente.</div>');
    return;
  }
  socialSetHtml('socialActivityList', socialState.activity.slice(0, 6).map(item => {
    const inviteId = socialRegisterInviteActivity(item);
    const openButton = inviteId
      ? `<button type="button" class="social-activity-open" data-action="question-invite-open-payload" data-invite-id="${socialEsc(inviteId)}">Abrir</button>`
      : '';
    return `
    <div class="social-item social-activity-item ${inviteId ? 'is-invite' : ''}">
      <div class="social-activity-icon">${socialEsc(socialActivityIcon(item.kind))}</div>
      <div class="social-user">
        <div class="social-activity-text">${socialEsc(socialActivityText(item))}</div>
        <div class="social-activity-time">${socialEsc(socialFormatRelative(item.t))}</div>
      </div>
      ${openButton}
    </div>`;
  }).join(''));
}
async function socialFetchStatuses() {
  if (!getCurrentUser() || !getQuestionChatWorkerConfigured()()) return;
  const ids = socialState.friends.map(f => f.id).filter(Boolean).slice(0, 80);
  if (!ids.length) { socialState.statusMap = {}; socialRenderActivity(); socialRenderLists(); return; }
  socialState.statusMap = await getCloudflareClient().fetchStatuses(ids);
}
async function socialFetchActivity() {
  if (!getCurrentUser() || !getQuestionChatWorkerConfigured()()) return;
  socialState.activity = (await getCloudflareClient().fetchActivity()).filter(item => {
    if (!socialIsInviteActivity(item)) return true;
    return Boolean(socialNormalizeInviteActivity(item));
  });
}
async function socialRefreshLiveMeta() {
  if (!getCurrentUser()) return;
  try { await Promise.all([socialFetchStatuses(), socialFetchActivity()]); }
  catch(e) { console.warn('socialRefreshLiveMeta:', e); }
  socialRenderLists();
}
function socialProfileAvatar(profile) {
  return getAvatarHtml()(profile, 'social-profile-avatar', 'div');
}
function socialEnsureProfileModal() {
  let overlay = document.getElementById('socialProfileOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'socialProfileOverlay';
  overlay.className = 'social-profile-overlay';
  overlay.innerHTML = '<div class="social-profile-card" id="socialProfileCard"></div>';
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) socialCloseFriendProfile(); });
  document.body.appendChild(overlay);
  return overlay;
}
export function socialCloseFriendProfile() {
  const overlay = document.getElementById('socialProfileOverlay');
  if (overlay) overlay.classList.remove('open');
}
function socialProfilePlanLabel(plan) {
  const p = String(plan || '').trim().toLowerCase();
  if (!p) return 'Sin plan';
  if (p === 'pro') return 'Pro';
  if (p === 'trial') return 'Trial';
  if (p === 'admin') return 'Admin';
  if (p === 'free') return 'Free';
  return p.charAt(0).toUpperCase() + p.slice(1);
}
function socialProfilePlanClass(plan) {
  const p = String(plan || '').trim().toLowerCase();
  if (p === 'pro') return 'plan-pro';
  if (p === 'trial') return 'plan-trial';
  if (p === 'admin') return 'plan-pro';
  return 'plan-free';
}
function socialFormatCalendarDate(v) {
  if (!v) return 'sin datos';
  const d = new Date(v);
  if (isNaN(d.getTime())) return 'sin datos';
  try { return d.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' }); }
  catch(_) { return d.toLocaleDateString(); }
}
function socialFormatDurationMini(sec) {
  const n = Number(sec || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const total = Math.round(n);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  if (mm <= 0) return ss + ' s';
  if (mm < 60) return mm + ' min' + (ss ? ' ' + String(ss).padStart(2,'0') + ' s' : '');
  const hh = Math.floor(mm / 60);
  const rm = mm % 60;
  return hh + ' h' + (rm ? ' ' + rm + ' min' : '');
}
export async function socialOpenFriendProfile(userId) {
  if (!getCurrentUser()) { getAbrirAuth()(); return; }
  if (!userId || socialState.profileBusy) return;
  socialState.profileBusy = true;
  const overlay = socialEnsureProfileModal();
  const card = document.getElementById('socialProfileCard');
  overlay.classList.add('open');
  if (card) card.innerHTML = '<button class="social-profile-close" data-action="close-social-profile" type="button">×</button><div class="social-profile-body"><div class="social-empty social-loading">Cargando perfil...</div></div>';
  try {
    const json = await getCloudflareClient().fetchProfile(userId);
    const p = json.profile || {};
    const stats = json.stats || {};
    const st = json.status || socialStatusFor(userId) || {};
    const last = stats.last_result;
    const planLabel = socialProfilePlanLabel(p.plan);
    const planClass = socialProfilePlanClass(p.plan);
    const onlineLabel = st.online ? 'Online ahora' : 'Última vez ' + socialFormatRelative(st.last_seen_at);
    const topSpecialtyLabel = stats.top_specialty ? formatEsp(stats.top_specialty) : 'Sin datos';
    const lastSpecialtyLabel = last?.especialidad ? formatEsp(last.especialidad) : 'Sin datos';
    const lastResultLabel = last ? socialFormatRelative(last.created_at ? new Date(last.created_at).getTime() : 0) : 'sin intentos visibles';
    const joinedLabel = socialFormatCalendarDate(p.created_at);
    const lastTotal = Number(last?.total || 0) || '—';
    const lastCorrect = Number.isFinite(Number(last?.correctas)) ? Number(last.correctas) : '—';
    const lastIncorrect = Number.isFinite(Number(last?.incorrectas)) ? Number(last.incorrectas) : '—';
    const lastPct = last && last.pct != null ? Number(last.pct || 0) + '%' : '—';
    const avgPct = stats.avg_pct != null ? Number(stats.avg_pct) + '%' : '—';
    const bestPct = stats.best_pct != null ? Number(stats.best_pct) + '%' : '—';
    if (card) card.innerHTML = `<button class="social-profile-close" data-action="close-social-profile" type="button">×</button>
      <div class="social-profile-head">
        ${socialProfileAvatar(p)}
        <div style="min-width:0;flex:1">
          <div class="social-profile-title">${socialEsc(p.username || 'Usuario')}</div>
          <div class="social-profile-sub">Perfil académico resumido de tu amigo.</div>
          <div class="social-profile-badges">
            <span class="social-profile-badge ${st.online ? 'is-online' : ''}">${st.online ? '● Online' : '⏱ ' + socialEsc(onlineLabel)}</span>
            <span class="social-profile-badge ${planClass}">Plan · ${socialEsc(planLabel)}</span>
            <span class="social-profile-badge">Alta · ${socialEsc(joinedLabel)}</span>
          </div>
        </div>
      </div>
      <div class="social-profile-body">
        <div class="social-profile-grid">
          <div class="social-profile-stat"><strong>${stats.total_results ?? 0}</strong><span>Intentos</span></div>
          <div class="social-profile-stat"><strong>${avgPct}</strong><span>Promedio</span></div>
          <div class="social-profile-stat"><strong>${bestPct}</strong><span>Mejor</span></div>
          <div class="social-profile-stat"><strong>${lastPct}</strong><span>Último</span></div>
        </div>
        <div class="social-profile-panels">
          <div class="social-profile-panel accent">
            <div class="social-profile-panel-title">Actividad académica</div>
            <div class="social-profile-kv"><div class="social-profile-k">Especialidad más practicada</div><div class="social-profile-v">${socialEsc(topSpecialtyLabel)}</div></div>
            <div class="social-profile-kv"><div class="social-profile-k">Última especialidad</div><div class="social-profile-v">${socialEsc(lastSpecialtyLabel)}</div></div>
            <div class="social-profile-kv"><div class="social-profile-k">Última actividad</div><div class="social-profile-v">${socialEsc(lastResultLabel)}</div></div>
          </div>
          <div class="social-profile-panel">
            <div class="social-profile-panel-title">Último rendimiento</div>
            <div class="social-profile-kv"><div class="social-profile-k">Correctas</div><div class="social-profile-v">${socialEsc(String(lastCorrect))}</div></div>
            <div class="social-profile-kv"><div class="social-profile-k">Incorrectas</div><div class="social-profile-v">${socialEsc(String(lastIncorrect))}</div></div>
            <div class="social-profile-kv"><div class="social-profile-k">Total</div><div class="social-profile-v">${socialEsc(String(lastTotal))}</div></div>
            <div class="social-profile-kv"><div class="social-profile-k">Tiempo</div><div class="social-profile-v">${socialEsc(socialFormatDurationMini(last?.tiempo))}</div></div>
          </div>
        </div>
        <div class="social-profile-note"><strong>Resumen</strong><br>${socialEsc(p.username || 'Usuario')} lleva <strong>${socialEsc(String(stats.total_results ?? 0))}</strong> intentos visibles, con un promedio de <strong>${socialEsc(avgPct)}</strong> y un mejor resultado de <strong>${socialEsc(bestPct)}</strong>. Su foco principal está en <strong>${socialEsc(topSpecialtyLabel)}</strong>.</div>
      </div>`;
  } catch(e) {
    if (card) card.innerHTML = `<button class="social-profile-close" data-action="close-social-profile" type="button">×</button><div class="social-profile-body"><div class="social-empty">No se pudo cargar el perfil: ${socialEsc(e.message || e)}</div></div>`;
  } finally {
    socialState.profileBusy = false;
  }
}

function socialRenderRequest(r, mode) {
  const fecha = r.created_at ? new Date(r.created_at).toLocaleDateString('es',{day:'2-digit',month:'2-digit'}) : '';
  const profile = { username:r.username, avatar_url:r.avatar_url };
  const requestId = socialEsc(r.id || '');
  const actions = mode === 'incoming'
    ? `<div class="social-actions"><button class="social-chip-btn ok" data-action="social-respond-request" data-request-id="${requestId}" data-status="accepted" type="button">Aceptar</button><button class="social-chip-btn danger" data-action="social-respond-request" data-request-id="${requestId}" data-status="rejected" type="button">Rechazar</button></div>`
    : `<div class="social-actions"><button class="social-chip-btn warn" data-action="social-respond-request" data-request-id="${requestId}" data-status="cancelled" type="button">Cancelar</button></div>`;
  return `<div class="social-item">${socialAvatar(profile)}<div class="social-user"><div class="social-name">${socialEsc(r.username || 'Usuario')}</div><div class="social-meta">${mode === 'incoming' ? 'Te agregó' : 'Pendiente'}${fecha ? ' · ' + fecha : ''}</div></div>${actions}</div>`;
}
function socialRenderFriend(f) {
  const fecha = f.created_at ? new Date(f.created_at).toLocaleDateString('es',{day:'2-digit',month:'2-digit'}) : '';
  const profile = { username:f.username, avatar_url:f.avatar_url };
  const meta = `${socialStatusDot(f.id)}${socialEsc(socialStatusLabel(f.id))}${fecha ? ' · desde ' + socialEsc(fecha) : ''}`;
  const friendId = socialEsc(f.id || '');
  return `<div class="social-item">${socialAvatar(profile)}<div class="social-user"><div class="social-name">${socialEsc(f.username || 'Usuario')}</div><div class="social-meta-row">${meta}</div></div><div class="social-actions"><button class="social-chip-btn" data-action="open-social-profile" data-user-id="${friendId}" type="button">Perfil</button><button class="social-chip-btn danger" data-action="remove-social-friend" data-user-id="${friendId}" type="button">Quitar</button></div></div>`;
}
function socialRenderLists() {
  socialUpdateSummary();
  socialRenderActivity();
  socialSetHtml('socialIncomingList', socialState.incoming.length ? socialState.incoming.map(r => socialRenderRequest(r,'incoming')).join('') : '<div class="social-empty">No tenés solicitudes recibidas.</div>');
  socialSetHtml('socialOutgoingList', socialState.outgoing.length ? socialState.outgoing.map(r => socialRenderRequest(r,'outgoing')).join('') : '<div class="social-empty">No hay solicitudes enviadas pendientes.</div>');
  socialSetHtml('socialFriendsList', socialState.friends.length ? socialState.friends.map(socialRenderFriend).join('') : '<div class="social-empty">Todavía no agregaste amigos.</div>');
}
export async function cargarSocialSidebar(force) {
  if (!getCurrentUser()) {
    socialState.loaded = false;
    socialState.friends = [];
    socialState.incoming = [];
    socialState.outgoing = [];
    socialState.search = [];
    socialRenderLists();
    return;
  }
  if (socialState.busy) {
    if (force) socialState.refreshQueued = true;
    return;
  }
  if (socialState.loaded && !force) { socialRenderLists(); return; }

  socialState.busy = true;
  socialSetLoading();
  try {
    const [{ data: friends, error: friendsErr }, { data: requests, error: reqErr }] = await Promise.all([
      getSb().rpc('list_my_friends'),
      getSb().rpc('list_friend_requests')
    ]);
    if (friendsErr) throw friendsErr;
    if (reqErr) throw reqErr;

    socialState.friends = friends || [];
    socialState.incoming = (requests || []).filter(r => r.direction === 'incoming');
    socialState.outgoing = (requests || []).filter(r => r.direction === 'outgoing');
    socialState.loaded = true;
    socialRenderLists();
    socialRefreshLiveMeta().catch(e => console.warn('socialRefreshLiveMeta:', e));
  } catch(e) {
    console.error('cargarSocialSidebar:', e);
    socialSetHtml('socialIncomingList', `<div class="social-empty">Error al cargar social: ${socialEsc(e.message || e)}</div>`);
    socialSetHtml('socialOutgoingList', '<div class="social-empty">—</div>');
    socialSetHtml('socialFriendsList', '<div class="social-empty">—</div>');
  } finally {
    socialState.busy = false;
    if (socialState.refreshQueued) {
      socialState.refreshQueued = false;
      setTimeout(() => cargarSocialSidebar(true), 0);
    }
  }
}

function socialRefreshNow() {
  if (!getCurrentUser()) return;
  socialState.loaded = false;
  const chatState = getQuestionChatState();
  if (chatState) chatState.friendsReady = false;
  cargarSocialSidebar(true);
  const input = document.getElementById('socialSearchInput');
  if (input && input.value.trim().replace(/^@/,'').length >= 2) {
    buscarUsuariosSocial();
  }
}

export function socialRequestRefresh(delay = 200) {
  if (socialState.refreshTimer) clearTimeout(socialState.refreshTimer);
  socialState.refreshTimer = setTimeout(socialRefreshNow, delay);
}

export function socialStopRealtime() {
  socialState.cfIntentionalClose = true;
  if (socialState.cfReconnectTimer) clearTimeout(socialState.cfReconnectTimer);
  socialState.cfReconnectTimer = null;
  if (socialState.cfWs) {
    try { socialState.cfWs.close(1000, 'logout'); } catch(e) {}
  }
  socialState.cfWs = null;
  socialState.cfConnected = false;
  socialState.realtimeChannel = null;
  socialState.realtimeUserId = null;
}

function socialNotificationText(payload) {
  const actor = payload?.actor?.username || 'Un usuario';
  const kind = payload?.kind || 'social_refresh';
  if (kind === 'friend_request_sent') return `${actor} te envió una solicitud.`;
  if (kind === 'friend_request_accepted') return `${actor} aceptó tu solicitud.`;
  if (kind === 'friend_request_rejected') return `${actor} rechazó tu solicitud.`;
  if (kind === 'friend_request_cancelled') return `${actor} canceló una solicitud.`;
  if (kind === 'friend_removed') return `${actor} actualizó su amistad.`;
  if (kind === 'invite_question') return `${actor} te invitó a resolver una pregunta.`;
  return payload?.body || 'Hay cambios en Social.';
}

function socialAddCloudflareActivity(payload) {
  if (!payload || payload.type !== 'social_notification') return;
  if (socialIsInviteActivity(payload) && !socialNormalizeInviteActivity(payload)) return;
  const normalized = socialNormalizeInviteActivity(payload) || payload;
  const id = normalized.id || normalized.invite_id || normalized.notification_id || normalized?.data?.invite_id || '';
  if (id) socialState.activity = socialState.activity.filter(item => String(item.id || item.invite_id || item.notification_id || item?.data?.invite_id || '') !== String(id));
  socialState.activity.unshift(normalized);
  socialState.activity = socialState.activity.slice(0, 30);
  socialRenderActivity();
}

function socialHandleCloudflareNotification(payload) {
  if (!payload || payload.type !== 'social_notification') return;
  socialAddCloudflareActivity(payload);
  if (payload.kind === 'invite_question') {
    const normalized = socialNormalizeInviteActivity(payload);
    if (normalized) getQuestionInviteReceive()(normalized);
    return;
  }
  socialRequestRefresh(80);
  const input = document.getElementById('socialSearchInput');
  if (input && input.value.trim().replace(/^@/,'').length >= 2) {
    setTimeout(() => buscarUsuariosSocial(), 180);
  }
  socialRefreshLiveMeta().catch(e => console.warn('socialRefreshLiveMeta:', e));
  const text = socialNotificationText(payload);
  if (typeof getMostrarToast() === 'function') getMostrarToast()('🔔 ' + text, 5200);
}

export async function socialStartRealtime() {
  if (!getSb() || !getCurrentUser()?.id) { socialStopRealtime(); return; }
  const uid = getCurrentUser().id;
  if (socialState.cfWs && socialState.realtimeUserId === uid && socialState.cfWs.readyState === WebSocket.OPEN) return;
  socialStopRealtime();
  socialState.cfIntentionalClose = false;
  socialState.realtimeUserId = uid;
  const seq = ++socialState.cfConnectSeq;
  try {
    if (!getQuestionChatWorkerConfigured()()) return;
    const ws = await getCloudflareClient().connectSocial({
      client_id: getClientId(),
      onOpen: () => {
        if (seq !== socialState.cfConnectSeq || getCurrentUser()?.id !== uid) return;
        socialState.cfConnected = true;
        socialRefreshLiveMeta().catch(e => console.warn('socialRefreshLiveMeta:', e));
        try { ws.send(JSON.stringify({ type:'ping', t:Date.now() })); } catch(e) {}
      },
      onMessage: (ev) => {
        let payload = null;
        try { payload = JSON.parse(ev.data); } catch(e) { return; }
        if (payload?.type === 'social_notification') socialHandleCloudflareNotification(payload);
      },
      onClose: () => {
        socialState.cfConnected = false;
        if (socialState.cfWs === ws) socialState.cfWs = null;
        if (!socialState.cfIntentionalClose && getCurrentUser()?.id === uid) {
          if (socialState.cfReconnectTimer) clearTimeout(socialState.cfReconnectTimer);
          socialState.cfReconnectTimer = setTimeout(() => socialStartRealtime(), 2500);
        }
      },
      onError: () => {
        try { ws.close(); } catch(e) {}
      }
    });
    if (seq !== socialState.cfConnectSeq || !getCurrentUser() || getCurrentUser().id !== uid) {
      try { ws.close(1000, 'stale'); } catch(e) {}
      return;
    }
    socialState.cfWs = ws;
  } catch(e) {
    console.warn('socialStartRealtime:', e);
    if (!socialState.cfIntentionalClose && getCurrentUser()?.id === uid) {
      if (socialState.cfReconnectTimer) clearTimeout(socialState.cfReconnectTimer);
      socialState.cfReconnectTimer = setTimeout(() => socialStartRealtime(), 4000);
    }
  }
}

export async function socialNotifyUser(targetUserId, kind, data, options = {}) {
  return getCloudflareClient().notifyUser(targetUserId, kind, data || {}, options || {});
}


export function socialScheduleSearch() {
  const input = document.getElementById('socialSearchInput');
  const box = document.getElementById('socialSearchResults');
  const term = (input?.value || '').trim().replace(/^@/,'');
  if (socialState.searchTimer) clearTimeout(socialState.searchTimer);
  socialState.searchSeq++;
  if (!box) return;
  if (!getCurrentUser()) { box.innerHTML = '<div class="social-empty">Iniciá sesión para buscar usuarios.</div>'; return; }
  if (!term) { box.innerHTML = ''; return; }
  if (term.length < 2) {
    box.innerHTML = '<div class="social-empty">Escribí al menos 2 caracteres.</div>';
    return;
  }
  box.innerHTML = '<div class="social-empty social-loading">Buscando usuarios...</div>';
  socialState.searchTimer = setTimeout(() => buscarUsuariosSocial(), 300);
}

export async function buscarUsuariosSocial() {
  const searchSeq = ++socialState.searchSeq;
  if (!getCurrentUser()) { getAbrirAuth()(); return; }
  const input = document.getElementById('socialSearchInput');
  const box = document.getElementById('socialSearchResults');
  const term = (input?.value || '').trim().replace(/^@/,'');
  if (!box) return;
  if (term.length < 2) {
    box.innerHTML = '<div class="social-empty">Escribí al menos 2 caracteres.</div>';
    return;
  }
  box.innerHTML = '<div class="social-empty social-loading">Buscando usuarios...</div>';
  try {
    if (!socialState.loaded) await cargarSocialSidebar(false);
    const { data, error } = await getSb().rpc('search_users_for_friends', { q: term, lim: 8 });
    if (error) throw error;
    if (searchSeq !== socialState.searchSeq) return;
    socialState.search = data || [];
    if (!socialState.search.length) {
      box.innerHTML = '<div class="social-empty">Sin usuarios encontrados.</div>';
      return;
    }
    box.innerHTML = socialState.search.map(p => {
      let label = 'Agregar';
      let cls = 'ok';
      let disabled = '';
      let actionAttrs = `data-action="social-send-request" data-user-id="${socialEsc(p.id || '')}"`;
      if (p.friendship_status === 'friends') { label = 'Perfil'; cls = ''; disabled = ''; actionAttrs = `data-action="open-social-profile" data-user-id="${socialEsc(p.id || '')}"`; }
      else if (p.friendship_status === 'sent') { label = 'Pendiente'; cls = 'warn'; disabled = 'disabled'; actionAttrs = ''; }
      else if (p.friendship_status === 'received') { label = 'Responder'; cls = 'warn'; actionAttrs = 'data-action="scroll-social-incoming"'; }
      return `<div class="social-item">${socialAvatar(p)}<div class="social-user"><div class="social-name">${socialEsc(p.username || 'Usuario')}</div><div class="social-meta">${p.friendship_status === 'friends' ? 'Amigo' : p.friendship_status === 'sent' ? 'Solicitud enviada' : p.friendship_status === 'received' ? 'Solicitud recibida' : 'Usuario'}</div></div><div class="social-actions"><button class="social-chip-btn ${cls}" ${disabled} ${actionAttrs} type="button">${label}</button></div></div>`;
    }).join('');
  } catch(e) {
    if (searchSeq !== socialState.searchSeq) return;
    box.innerHTML = `<div class="social-empty">Error al buscar: ${socialEsc(e.message || e)}</div>`;
  }
}
async function socialRunAction(rpcName, params, okMsg) {
  if (!getCurrentUser()) { getAbrirAuth()(); return null; }
  if (socialState.busyAction) return null;
  socialState.busyAction = true;
  try {
    const { data, error } = await getSb().rpc(rpcName, params || {});
    if (error) throw error;
    socialState.loaded = false;
    await cargarSocialSidebar(true);
    const input = document.getElementById('socialSearchInput');
    if (input && input.value.trim().replace(/^@/,'').length >= 2) await buscarUsuariosSocial();
    socialRequestRefresh(250);
    if (okMsg && typeof getMostrarToast() === 'function') getMostrarToast()(okMsg);
    return data;
  } catch(e) {
    console.error('socialRunAction:', rpcName, e);
    if (typeof getMostrarToast() === 'function') getMostrarToast()('⛔ No se pudo completar la acción social: ' + (e.message || e), 6500);
    return null;
  } finally {
    socialState.busyAction = false;
  }
}
export async function enviarSolicitudSocial(toUserId) {
  const ok = await socialRunAction('send_friend_request', { target_user_id: toUserId }, 'Solicitud enviada.');
  if (ok) socialNotifyUser(toUserId, 'friend_request_sent', { action:'send_friend_request' }).catch(e => console.warn('socialNotifyUser:', e));
}
export async function responderSolicitudSocial(requestId, status) {
  const req = [...socialState.incoming, ...socialState.outgoing].find(r => r.id === requestId);
  const targetUserId = req?.user_id;
  const map = {
    accepted: ['accept_friend_request', 'Solicitud aceptada.', 'friend_request_accepted'],
    rejected: ['reject_friend_request', 'Solicitud rechazada.', 'friend_request_rejected'],
    cancelled: ['cancel_friend_request', 'Solicitud cancelada.', 'friend_request_cancelled']
  };
  const cfg = map[status];
  if (!cfg) return;
  const ok = await socialRunAction(cfg[0], { request_id: requestId }, cfg[1]);
  if (ok && targetUserId) socialNotifyUser(targetUserId, cfg[2], { request_id: requestId }).catch(e => console.warn('socialNotifyUser:', e));
}
export async function eliminarAmigoSocial(otherUserId) {
  const ok = await socialRunAction('remove_friend', { friend_user_id: otherUserId }, 'Amigo eliminado.');
  if (ok) socialNotifyUser(otherUserId, 'friend_removed', { action:'remove_friend' }).catch(e => console.warn('socialNotifyUser:', e));
}






