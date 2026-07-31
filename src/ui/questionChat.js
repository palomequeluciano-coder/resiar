import { escapeHtml } from '../utils/sanitize.js';
import { readText, writeText } from '../utils/storage.js';
import { resiarAvatarHtml } from '../utils/avatar.js';
import { createCloudflareSocialClient } from '../services/cloudflareSocialClient.js';
import { createInviteRouter } from '../services/inviteRouter.js';

export function configureQuestionChat(options = {}) {
  const noop = function () {};
  let currentUser = null;
  let currentProfile = null;
  let examen = [];
  let actual = 0;
  let preguntas = [];
  let sb = null;
  let socialState = { friends: [], loaded: false };

  function syncDeps() {
    currentUser = options.getCurrentUser?.() || null;
    currentProfile = options.getCurrentProfile?.() || null;
    examen = options.getExam?.() || [];
    actual = Number(options.getActual?.() || 0);
    preguntas = options.getPreguntas?.() || [];
    sb = options.getSupabase?.() || window.sb;
    socialState = options.getSocialState?.() || { friends: [], loaded: false };
  }
  function cargarSocialSidebar(...args) {
    return options.cargarSocialSidebar ? options.cargarSocialSidebar(...args) : Promise.resolve();
  }
  function socialNotifyUser(...args) {
    return options.socialNotifyUser ? options.socialNotifyUser(...args) : Promise.resolve();
  }
  function mostrarToast(...args) {
    return options.mostrarToast ? options.mostrarToast(...args) : noop();
  }
  function abrirAuth(...args) {
    return options.abrirAuth ? options.abrirAuth(...args) : noop();
  }
  function irDesdeNav(...args) {
    return options.irDesdeNav ? options.irDesdeNav(...args) : noop();
  }
  function buildNumeroMap(...args) {
    return options.buildNumeroMap ? options.buildNumeroMap(...args) : noop();
  }
  function startInviteSession(...args) {
    return options.startInviteSession ? options.startInviteSession(...args) : false;
  }
  function getNPregunta(p) {
    return options.getNPregunta ? options.getNPregunta(p) : (actual + 1);
  }
  function esExamenUnico(v) {
    return options.esExamenUnico ? options.esExamenUnico(v) : false;
  }
  syncDeps();

/* ══ QUESTION CHAT — Cloudflare Worker + Durable Objects, sin usar Supabase Realtime ══ */
const cloudflareLiveClient = options.cloudflareLiveClient || createCloudflareSocialClient({
  getSb: () => options.getSupabase?.() || window.sb || null,
  getCurrentUser: () => options.getCurrentUser?.() || null
});

const QUESTION_CHAT_WORKER_URL = cloudflareLiveClient.getWorkerUrl();
const QUESTION_CHAT_CLIENT_ID = cloudflareLiveClient.clientId;

const QUESTION_CHAT_LIMITS = {
  maxParticipants: 40,
  maxChars: 500,
  maxLocalMessages: 80,
  minSendIntervalMs: 2500,
  maxSendsPerMinute: 12,
  maxUnreadBadge: 9,
  maxPayloadBytes: 4096
};

const questionChatState = {
  ws: null,
  channel: null, // compat: ya no se usa Supabase channel; se conserva para no romper referencias viejas.
  channelName: '',
  questionKey: '',
  scope: readText('resar_qchat_scope', 'public') || 'public',
  open: false,
  joined: false,
  participants: [],
  typingUsers: new Map(),
  typingCleanupTimer: null,
  typingStopTimer: null,
  selfTyping: false,
  lastTypingPingAt: 0,
  messages: [],
  unread: 0,
  sending: false,
  lastSendAt: 0,
  sendTimes: [],
  friendsReady: false,
  friendIds: new Set(),
  status: 'Desconectado',
  connectSeq: 0,
  reconnectTimer: null,
  intentionalClose: false,
  inviteOpen: false,
  inviteBusy: false,
  invites: new Map()
};

const questionInviteRouter = createInviteRouter({
  state: questionChatState,
  getSupabase: () => options.getSupabase?.() || window.sb || null,
  getExam: () => options.getExam?.() || [],
  getActual: () => Number(options.getActual?.() || 0),
  getPreguntas: () => options.getPreguntas?.() || [],
  getCurrentProfile: () => options.getCurrentProfile?.() || null,
  getServerAccess: () => options.getServerAccess?.() || null,
  getQuestionKey: (p) => questionChatQuestionKey(p),
  getQuestionLabel: (p) => questionChatQuestionLabel(p),
  getQuestionNumber: (p) => getNPregunta(p),
  escapeHtml: (value) => questionChatSafe(value),
  mostrarToast: (...args) => mostrarToast(...args),
  irDesdeNav: (idx) => irDesdeNav(idx),
  buildNumeroMap: (items) => buildNumeroMap(items),
  startInviteSession: (list, idx, openChat) => startInviteSession(list, idx, openChat),
  validateInvite: (payload) => cloudflareLiveClient.validateInvite(payload),
  openChat: () => questionChatOpen()
});

function questionChatWorkerConfigured() {
  syncDeps();
  return cloudflareLiveClient.isConfigured();
}
function questionChatHttpBase() {
  syncDeps();
  return cloudflareLiveClient.httpBase();
}
function questionChatWsBase() {
  syncDeps();
  return cloudflareLiveClient.wsOrigin();
}
function questionChatSafe(v) {
  syncDeps();
  if (typeof escapeHtml === 'function') return escapeHtml(String(v ?? ''));
  return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function questionChatNowId() {
  syncDeps();
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch(e) {}
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
}
function questionChatAvatarHtml(profile, cls) {
  syncDeps();
  const klass = cls || 'qchat-avatar';
  return resiarAvatarHtml(profile, klass, 'span');
}
function questionChatQuestionKey(p) {
  syncDeps();
  // Chat general: un único canal compartido para todos los usuarios,
  // ya no se separa por pregunta/examen.
  return 'general';
}
function questionChatChannelName(key, scope) {
  syncDeps();
  return `cf:qchat:v1:${scope}:${key}`;
}
function questionChatQuestionLabel(p) {
  syncDeps();
  // Chat general: mismo canal para todos, ya no describe la pregunta/examen actual.
  return {
    examLabel: 'Chat general',
    questionLabel: '',
    title: 'Chat general',
    sub: 'Chat en vivo de Resiar · Cloudflare Live · historial corto'
  };
}
function questionChatDockHtml(p) {
  syncDeps();
  const key = questionChatQuestionKey(p);
  const qlabel = questionChatQuestionLabel(p);
  const openCls = questionChatState.open ? 'open' : '';
  const unreadCls = questionChatState.unread ? 'has-unread' : '';
  const offlineCls = currentUser && questionChatState.joined ? '' : 'is-offline';
  const unread = questionChatState.unread ? Math.min(questionChatState.unread, QUESTION_CHAT_LIMITS.maxUnreadBadge) : '';
  const scope = questionChatState.scope === 'friends' ? 'friends' : 'public';
  return `
    <div id="qchatRoot" class="qchat-root" data-qkey="${questionChatSafe(key)}">
      <button id="qchatFab" class="qchat-fab ${unreadCls} ${offlineCls}" data-action="question-chat-toggle" type="button" title="Chat en vivo general">
        <span class="qchat-fab-icon">↗</span>
        <span class="qchat-fab-label">Chat</span>
        <span id="qchatUnreadBadge" class="qchat-unread">${questionChatSafe(unread)}</span>
      </button>
      <div id="qchatWindow" class="qchat-window ${openCls}" aria-live="polite">
        <div class="qchat-head">
          <div class="qchat-title-block">
            <div class="qchat-eyebrow">Chat en vivo</div>
            <div class="qchat-title">${questionChatSafe(qlabel.title)}</div>
            <div class="qchat-sub">${questionChatSafe(qlabel.sub)}</div>
          </div>
          <button class="qchat-close" data-action="question-chat-close" type="button" title="Cerrar">×</button>
        </div>
        <div class="qchat-body">
          <div class="qchat-mode">
            <button id="qchatModePublic" class="${scope === 'public' ? 'active' : ''}" data-action="question-chat-set-scope" data-scope="public" type="button">Público</button>
            <button id="qchatModeFriends" class="${scope === 'friends' ? 'active' : ''}" data-action="question-chat-set-scope" data-scope="friends" type="button">Amigos</button>
          </div>
          <div class="qchat-limits"><span><strong>${QUESTION_CHAT_LIMITS.maxParticipants}</strong> máx · <strong>${QUESTION_CHAT_LIMITS.maxChars}</strong> caract. · últimos mensajes recientes</span><span id="qchatConnDot">•</span></div>
          <div class="qchat-presence"><span class="qchat-presence-label">Conectados</span><div id="qchatAvatars" class="qchat-avatars"></div><span id="qchatCount" class="qchat-count">0 conectados</span></div>
          <div id="qchatTyping" class="qchat-typing" aria-live="polite"></div>
          <div id="qchatMessages" class="qchat-messages"><div class="qchat-empty">Abrí el chat para conversar con toda la comunidad. Los mensajes recientes viven en Cloudflare, sin escribir el chat en Supabase.</div></div>
          <form class="qchat-form" data-submit-action="question-chat-send">
            <div class="qchat-input-wrap">
              <textarea id="qchatInput" class="qchat-input" maxlength="${QUESTION_CHAT_LIMITS.maxChars}" rows="1" placeholder="Escribir mensaje en vivo…" data-input-action="question-chat-typing" data-keydown-action="question-chat-maybe-send"></textarea>
              <span id="qchatChar" class="qchat-char">0/${QUESTION_CHAT_LIMITS.maxChars}</span>
            </div>
            <button id="qchatSend" class="qchat-send" type="submit" title="Enviar">➤</button>
          </form>
          <div id="qchatStatus" class="qchat-status">${questionChatSafe(questionChatState.status || '')}</div>
        </div>
      </div>
    </div>`;
}


function questionInviteCurrentContext(type) {
  syncDeps();
  return questionInviteRouter.currentContext(type);
}
function questionInvitePanelHtml() {
  syncDeps();
  if (!currentUser) return '<div class="qchat-invite-empty">Iniciá sesión para invitar amigos.</div>';
  if (!Array.isArray(socialState?.friends) || !socialState.friends.length) {
    return '<div class="qchat-invite-head"><div class="qchat-invite-title">Invitar amigos</div><button class="qchat-invite-close" data-action="question-invite-close" type="button">×</button></div><div class="qchat-invite-empty">Todavía no hay amigos cargados. Abrí Social o agregá amigos para enviar invitaciones.</div>';
  }
  const rows = socialState.friends.slice(0, 20).map(f => {
    const name = escapeHtml(f.username || 'Usuario');
    const id = escapeHtml(f.id || '');
    const avatar = resiarAvatarHtml({ username: f.username, avatar_url: f.avatar_url }, 'social-avatar', 'div');
    return `<div class="qchat-invite-row">${avatar}<div class="qchat-invite-name" title="${name}">${name}</div><div class="qchat-invite-actions"><button type="button" data-action="question-invite-send" data-friend-id="${id}" data-invite-type="question">Invitar a pregunta</button></div></div>`;
  }).join('');
  return `<div class="qchat-invite-head"><div class="qchat-invite-title">Invitar amigos</div><button class="qchat-invite-close" data-action="question-invite-close" type="button">×</button></div><div class="qchat-invite-list">${rows}</div>`;
}
async function questionInviteToggle() {
  syncDeps();
  if (!currentUser) { abrirAuth(); return; }
  questionChatState.inviteOpen = !questionChatState.inviteOpen;
  questionInvitePaint();
  if (questionChatState.inviteOpen && (!socialState.loaded || !socialState.friends.length)) {
    try { await cargarSocialSidebar(true); } catch(e) {}
    questionInvitePaint();
  }
}
function questionInviteClose() {
  syncDeps();
  questionChatState.inviteOpen = false;
  questionInvitePaint();
}
function questionInvitePaint() {
  syncDeps();
  const panel = document.getElementById('qchatInvitePanel');
  if (!panel) return;
  panel.classList.toggle('open', Boolean(questionChatState.inviteOpen));
  if (questionChatState.inviteOpen) panel.innerHTML = questionInvitePanelHtml();
}
async function questionInviteSendToFriend(friendId) {
  syncDeps();
  if (!currentUser) { abrirAuth(); return; }
  const ctx = questionInviteCurrentContext('question');
  if (!ctx) { mostrarToast('⚠️ No hay una pregunta activa para invitar.'); return; }
  const friend = (socialState.friends || []).find(f => f.id === friendId);
  const kind = 'invite_question';
  questionChatState.inviteBusy = true;
  questionInvitePaint();
  try {
    await socialNotifyUser(friendId, kind, ctx, {
      id: ctx.invite_id,
      invite_id: ctx.invite_id,
      title: 'Invitación a pregunta',
      body: `${currentProfile?.username || 'Un amigo'} te invitó a resolver una pregunta: ${ctx.title}`
    });
    mostrarToast(`✅ Invitación enviada a ${friend?.username || 'tu amigo'}.`);
  } catch(e) {
    console.warn('questionInviteSendToFriend:', e);
    mostrarToast('⛔ No se pudo enviar la invitación: ' + (e.message || e), 6500);
  } finally {
    questionChatState.inviteBusy = false;
    questionInvitePaint();
  }
}
function questionInviteRegister(payload) {
  syncDeps();
  return questionInviteRouter.register(payload);
}
function questionInviteReceive(payload) {
  syncDeps();
  return questionInviteRouter.receive(payload);
}
async function questionInviteOpenPayload(inviteId) {
  syncDeps();
  return questionInviteRouter.openPayload(inviteId);
}

function questionChatAfterRender() {
  syncDeps();
  try {
    if (typeof window.resiarQuestionChatAllowed === 'function' && !window.resiarQuestionChatAllowed()) {
      if (typeof questionChatClose === 'function') questionChatClose();
      if (typeof questionChatDisconnect === 'function') questionChatDisconnect();
      document.querySelectorAll('#qchatRoot,.qchat-root,#qchatRescueFab,#resiarStableChatFab').forEach(el => el.remove());
      return;
    }
  } catch(_) {}
  const roots = Array.from(document.querySelectorAll('#qchatRoot'));
  const embeddedRoot = document.getElementById('preguntaBox')?.querySelector('#qchatRoot') || null;
  const freshRoot = embeddedRoot || roots[roots.length - 1];
  roots.forEach(r => { if (r !== freshRoot) r.remove(); });
  if (freshRoot && freshRoot.parentElement !== document.body) document.body.appendChild(freshRoot);

  questionChatUpdateOffsets();
  const p = examen?.[actual];
  if (!p) { questionChatDisconnect(); return; }
  const key = questionChatQuestionKey(p);
  questionChatSyncChannel(key).catch(e => console.warn('questionChatSyncChannel:', e));
  questionChatPaint();
}
function questionChatUpdateOffsets() {
  syncDeps();
  const rp = document.getElementById('rightPanel');
  let right = 24;
  if (window.innerWidth > 980 && rp && rp.classList.contains('vis')) {
    const r = rp.getBoundingClientRect();
    if (r.width > 0) right = Math.max(24, Math.round(window.innerWidth - r.left + 18));
  }
  document.documentElement.style.setProperty('--qchat-right', right + 'px');
}
async function questionChatGetTicket(key, scope) {
  syncDeps();
  return cloudflareLiveClient.requestTicket({ room: key, scope, client_id: QUESTION_CHAT_CLIENT_ID });
}
function questionChatBuildWsUrl(key, scope, ticket) {
  syncDeps();
  return cloudflareLiveClient.buildQuestionWsUrl(key, { scope, ticket });
}
async function questionChatSyncChannel(key) {
  syncDeps();
  if (!currentUser) { questionChatDisconnect(); questionChatState.status = 'Iniciá sesión para usar el chat.'; questionChatPaint(); return; }
  if (!questionChatWorkerConfigured()) {
    questionChatDisconnect(false);
    questionChatState.questionKey = key;
    questionChatState.status = 'Configurá la URL del Worker Cloudflare para activar el chat.';
    questionChatPaint();
    return;
  }
  const scope = questionChatState.scope === 'friends' ? 'friends' : 'public';
  const name = questionChatChannelName(key, scope);
  const ws = questionChatState.ws;
  if (ws && questionChatState.channelName === name && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  await questionChatDisconnect(false);
  const seq = ++questionChatState.connectSeq;
  questionChatState.questionKey = key;
  questionChatState.channelName = name;
  questionChatState.joined = false;
  questionChatState.participants = [];
  questionChatClearTypingState();
  questionChatState.messages = [];
  questionChatState.unread = 0;
  questionChatState.status = 'Conectando a Cloudflare…';
  questionChatPaint();

  try {
    const ticket = await questionChatGetTicket(key, scope);
    if (seq !== questionChatState.connectSeq) return;
    const socket = new WebSocket(questionChatBuildWsUrl(key, scope, ticket));
    questionChatState.ws = socket;
    questionChatState.channel = socket;
    questionChatState.intentionalClose = false;

    socket.onopen = () => {
      if (seq !== questionChatState.connectSeq) return;
      questionChatState.joined = true;
      questionChatState.status = scope === 'friends' ? 'Conectado · Cloudflare · amigos' : 'Conectado · Cloudflare · público';
      questionChatPaint();
    };
    socket.onmessage = ev => questionChatHandleSocketMessage(ev.data);
    socket.onerror = () => {
      if (seq !== questionChatState.connectSeq) return;
      questionChatState.status = 'Error de conexión con Cloudflare.';
      questionChatPaint();
    };
    socket.onclose = () => {
      if (seq !== questionChatState.connectSeq) return;
      questionChatState.joined = false;
      questionChatState.participants = [];
      questionChatPaintPresence();
      questionChatUpdateInputState();
      if (!questionChatState.intentionalClose && currentUser && questionChatState.questionKey === key) {
        questionChatState.status = 'Conexión cerrada. Reintentando…';
        questionChatPaint();
        clearTimeout(questionChatState.reconnectTimer);
        questionChatState.reconnectTimer = setTimeout(() => {
          const p = examen?.[actual];
          const k = p ? questionChatQuestionKey(p) : '';
          if (k === key) questionChatSyncChannel(key).catch(() => {});
        }, 1800);
      } else {
        questionChatState.status = 'Desconectado';
        questionChatPaint();
      }
    };
  } catch(e) {
    if (seq !== questionChatState.connectSeq) return;
    console.warn('questionChatSyncChannel:', e);
    questionChatState.joined = false;
    questionChatState.status = 'No se pudo conectar el chat Cloudflare.';
    questionChatPaint();
  }
}
async function questionChatDisconnect(resetState = true) {
  syncDeps();
  clearTimeout(questionChatState.reconnectTimer);
  questionChatState.intentionalClose = true;
  if (questionChatState.ws) {
    try { questionChatState.ws.onclose = null; questionChatState.ws.close(1000, 'switch'); } catch(e) {}
  }
  questionChatState.ws = null;
  questionChatState.channel = null;
  questionChatState.channelName = '';
  questionChatState.joined = false;
  questionChatState.participants = [];
  questionChatClearTypingState();
  if (resetState) {
    questionChatState.messages = [];
    questionChatState.unread = 0;
    questionChatState.questionKey = '';
    questionChatState.status = 'Desconectado';
  }
}
function questionChatHandleSocketMessage(raw) {
  syncDeps();
  let payload;
  try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch(e) { return; }
  if (!payload || !payload.type) return;
  if (payload.type === 'ready') {
    questionChatState.joined = true;
    questionChatPaint();
    return;
  }
  if (payload.type === 'presence') {
    questionChatState.participants = Array.isArray(payload.participants) ? payload.participants.slice(0, QUESTION_CHAT_LIMITS.maxParticipants + 3) : [];
    if (Array.isArray(payload.typing)) questionChatReceiveTypingList(payload.typing);
    questionChatPaintPresence();
    questionChatUpdateInputState();
    return;
  }
  if (payload.type === 'typing') {
    questionChatReceiveTyping(payload);
    return;
  }
  if (payload.type === 'history') {
    questionChatReceiveHistory(payload);
    return;
  }
  if (payload.type === 'message') {
    questionChatReceive(payload);
    return;
  }
  if (payload.type === 'notice') {
    questionChatReceiveNotice(payload);
    return;
  }
  if (payload.type === 'error') {
    questionChatState.status = payload.text || 'Error de chat.';
    questionChatPaint();
  }
}

function questionChatClearTypingState() {
  syncDeps();
  clearTimeout(questionChatState.typingCleanupTimer);
  clearTimeout(questionChatState.typingStopTimer);
  questionChatState.typingCleanupTimer = null;
  questionChatState.typingStopTimer = null;
  questionChatState.selfTyping = false;
  questionChatState.lastTypingPingAt = 0;
  if (questionChatState.typingUsers && typeof questionChatState.typingUsers.clear === 'function') questionChatState.typingUsers.clear();
  else questionChatState.typingUsers = new Map();
  questionChatPaintTyping();
}
function questionChatTypingReady() {
  syncDeps();
  return currentUser && questionChatState.ws && questionChatState.ws.readyState === WebSocket.OPEN && questionChatState.joined;
}
function questionChatEmitTyping(isTyping) {
  syncDeps();
  if (!questionChatTypingReady()) return;
  const now = Date.now();
  if (isTyping) {
    if (questionChatState.selfTyping && now - questionChatState.lastTypingPingAt < 1200) return;
    questionChatState.selfTyping = true;
    questionChatState.lastTypingPingAt = now;
  } else {
    if (!questionChatState.selfTyping) return;
    questionChatState.selfTyping = false;
    questionChatState.lastTypingPingAt = now;
  }
  try { questionChatState.ws.send(JSON.stringify({ type:'typing', isTyping: Boolean(isTyping), t: now })); } catch(e) {}
}
function questionChatHandleTypingInput() {
  syncDeps();
  questionChatUpdateInputState();
  const input = document.getElementById('qchatInput');
  const active = Boolean((input?.value || '').trim());
  clearTimeout(questionChatState.typingStopTimer);
  if (active) {
    questionChatEmitTyping(true);
    questionChatState.typingStopTimer = setTimeout(() => questionChatEmitTyping(false), 1800);
  } else {
    questionChatEmitTyping(false);
  }
}
function questionChatTypingKey(payload) {
  syncDeps();
  return String(payload?.client_id || payload?.uid || '').slice(0, 96);
}
function questionChatNormalizeTypingPayload(payload) {
  syncDeps();
  if (!payload || !payload.uid) return null;
  if (!questionChatCanSeePayload(payload)) return null;
  if (payload.client_id && payload.client_id === QUESTION_CHAT_CLIENT_ID) return null;
  if (!payload.client_id && payload.uid === currentUser?.id) return null;
  const key = questionChatTypingKey(payload);
  if (!key) return null;
  return {
    key,
    uid: payload.uid,
    client_id: payload.client_id || '',
    username: String(payload.username || 'Usuario').slice(0, 32),
    t: Date.now()
  };
}
function questionChatReceiveTyping(payload) {
  syncDeps();
  const item = questionChatNormalizeTypingPayload(payload);
  const key = item?.key || questionChatTypingKey(payload);
  if (!key) return;
  if (!questionChatState.typingUsers || typeof questionChatState.typingUsers.set !== 'function') questionChatState.typingUsers = new Map();
  if (payload.isTyping && item) questionChatState.typingUsers.set(key, item);
  else questionChatState.typingUsers.delete(key);
  questionChatPaintTyping();
  questionChatScheduleTypingCleanup();
}
function questionChatReceiveTypingList(list) {
  syncDeps();
  if (!questionChatState.typingUsers || typeof questionChatState.typingUsers.set !== 'function') questionChatState.typingUsers = new Map();
  questionChatState.typingUsers.clear();
  for (const payload of Array.isArray(list) ? list : []) {
    const item = questionChatNormalizeTypingPayload({ ...payload, isTyping: true });
    if (item?.key) questionChatState.typingUsers.set(item.key, item);
  }
  questionChatPaintTyping();
  if (questionChatState.typingUsers.size) questionChatScheduleTypingCleanup();
}
function questionChatScheduleTypingCleanup() {
  syncDeps();
  clearTimeout(questionChatState.typingCleanupTimer);
  questionChatState.typingCleanupTimer = setTimeout(() => {
    const now = Date.now();
    let changed = false;
    if (!questionChatState.typingUsers || typeof questionChatState.typingUsers.entries !== 'function') questionChatState.typingUsers = new Map();
    for (const [uid, item] of questionChatState.typingUsers.entries()) {
      if (now - Number(item.t || 0) > 3600) {
        questionChatState.typingUsers.delete(uid);
        changed = true;
      }
    }
    if (changed) questionChatPaintTyping();
    if (questionChatState.typingUsers.size) questionChatScheduleTypingCleanup();
  }, 1200);
}
function questionChatPaintTyping() {
  syncDeps();
  const el = document.getElementById('qchatTyping');
  if (!el) return;
  if (!questionChatState.typingUsers || typeof questionChatState.typingUsers.values !== 'function') questionChatState.typingUsers = new Map();
  const users = Array.from(questionChatState.typingUsers.values()).filter(Boolean);
  if (!users.length) { el.textContent = ''; return; }
  const names = users.slice(0, 3).map(u => u.username || 'Alguien');
  if (users.length === 1) el.textContent = `${names[0]} está escribiendo`;
  else if (users.length === 2) el.textContent = `${names[0]} y ${names[1]} están escribiendo`;
  else el.textContent = `${names.join(', ')} y ${users.length - 3} más están escribiendo`;
}

function questionChatCanSeePayload(payload) {
  syncDeps();
  const room = payload?.q || payload?.room;
  if (!payload || room !== questionChatState.questionKey || payload.scope !== questionChatState.scope) return false;
  return true;
}
function questionChatReceive(payload) {
  syncDeps();
  if (!questionChatCanSeePayload(payload)) return;
  const size = new Blob([JSON.stringify(payload)]).size;
  if (size > QUESTION_CHAT_LIMITS.maxPayloadBytes) return;
  questionChatAppendMessage(payload, false, false);
}
function questionChatReceiveHistory(payload) {
  syncDeps();
  if (!payload || payload.room !== questionChatState.questionKey || payload.scope !== questionChatState.scope) return;
  const items = Array.isArray(payload.messages) ? payload.messages : [];
  if (!items.length) { questionChatPaintMessages(); return; }
  const sorted = items.slice(0, 60).sort((a,b) => Number(a.t || 0) - Number(b.t || 0));
  for (const item of sorted) {
    if (!questionChatCanSeePayload(item)) continue;
    questionChatAppendMessage(item, false, true);
  }
  questionChatPaintMessages();
}
function questionChatReceiveNotice(payload) {
  syncDeps();
  if (!questionChatCanSeePayload(payload) || !payload.text) return;
  questionChatAppendSystem(payload.text);
}
function questionChatAppendMessage(payload, ownLocal, silentHistory = false) {
  syncDeps();
  const msg = {
    id: payload.id || questionChatNowId(),
    uid: payload.uid,
    username: String(payload.username || 'Usuario').slice(0, 32),
    avatar_url: payload.avatar_url || null,
    text: String(payload.text || '').slice(0, QUESTION_CHAT_LIMITS.maxChars),
    t: payload.t || Date.now(),
    own: ownLocal || (payload.client_id && payload.client_id === QUESTION_CHAT_CLIENT_ID) || (!payload.client_id && payload.uid === currentUser?.id),
    system: false
  };
  if (!msg.text.trim()) return;
  if (questionChatState.typingUsers && msg.uid) {
    questionChatState.typingUsers.delete(questionChatTypingKey(msg));
    questionChatState.typingUsers.delete(msg.uid);
  }
  questionChatPaintTyping();
  if (questionChatState.messages.some(m => m.id === msg.id)) return;
  questionChatState.messages.push(msg);
  if (questionChatState.messages.length > QUESTION_CHAT_LIMITS.maxLocalMessages) questionChatState.messages.shift();
  if (!silentHistory && !questionChatState.open && !msg.own) questionChatState.unread = Math.min(QUESTION_CHAT_LIMITS.maxUnreadBadge, questionChatState.unread + 1);
  questionChatPaint();
}
function questionChatAppendSystem(text) {
  syncDeps();
  questionChatState.messages.push({ id: questionChatNowId(), text: String(text).slice(0,120), system:true, t: Date.now() });
  if (questionChatState.messages.length > QUESTION_CHAT_LIMITS.maxLocalMessages) questionChatState.messages.shift();
  questionChatPaintMessages();
}
function questionChatToggle() {
  syncDeps();
  if (typeof window.resiarQuestionChatAllowed === 'function' && !window.resiarQuestionChatAllowed()) return;
  if (!currentUser) { abrirAuth(); return; }
  questionChatState.open ? questionChatClose() : questionChatOpen();
}
function questionChatOpen() {
  syncDeps();
  if (typeof window.resiarQuestionChatAllowed === 'function' && !window.resiarQuestionChatAllowed()) return;
  if (!currentUser) { abrirAuth(); return; }
  questionChatState.open = true;
  questionChatState.unread = 0;
  const win = document.getElementById('qchatWindow');
  win?.classList.remove('closing');
  win?.classList.add('open');
  questionChatPaint();
  setTimeout(() => document.getElementById('qchatInput')?.focus(), 90);
}
function questionChatClose() {
  syncDeps();
  questionChatState.open = false;
  const win = document.getElementById('qchatWindow');
  if (win) {
    win.classList.add('closing');
    win.classList.remove('open');
    setTimeout(() => win.classList.remove('closing'), 260);
  }
  questionChatPaintFab();
}
async function questionChatSetScope(scope) {
  syncDeps();
  if (!currentUser) { abrirAuth(); return; }
  const next = scope === 'friends' ? 'friends' : 'public';
  if (questionChatState.scope === next) return;
  questionChatState.scope = next;
  writeText('resar_qchat_scope', next);
  questionChatState.friendsReady = false;
  questionChatState.messages = [];
  questionChatState.unread = 0;
  const p = examen?.[actual];
  if (p) await questionChatSyncChannel(questionChatQuestionKey(p));
  questionChatPaint();
}
function questionChatPaint() {
  syncDeps();
  questionChatPaintFab();
  questionChatPaintMode();
  questionChatPaintPresence();
  questionChatPaintTyping();
  questionChatPaintMessages();
  questionChatUpdateInputState();
  questionInvitePaint();
  const st = document.getElementById('qchatStatus');
  if (st) st.textContent = questionChatState.status || '';
  const dot = document.getElementById('qchatConnDot');
  if (dot) {
    dot.textContent = questionChatState.joined ? '●' : '•';
    dot.style.color = questionChatState.joined ? 'var(--accent)' : 'var(--text3)';
  }
}
function questionChatPaintFab() {
  syncDeps();
  const fab = document.getElementById('qchatFab');
  const badge = document.getElementById('qchatUnreadBadge');
  if (fab) {
    fab.classList.toggle('has-unread', questionChatState.unread > 0);
    fab.classList.toggle('is-offline', !currentUser || !questionChatState.joined);
  }
  if (badge) badge.textContent = questionChatState.unread ? String(Math.min(questionChatState.unread, QUESTION_CHAT_LIMITS.maxUnreadBadge)) : '';
}
function questionChatPaintMode() {
  syncDeps();
  document.getElementById('qchatModePublic')?.classList.toggle('active', questionChatState.scope === 'public');
  document.getElementById('qchatModeFriends')?.classList.toggle('active', questionChatState.scope === 'friends');
}
function questionChatPaintPresence() {
  syncDeps();
  const av = document.getElementById('qchatAvatars');
  const ct = document.getElementById('qchatCount');
  const arr = questionChatState.participants || [];
  if (av) av.innerHTML = arr.slice(0, 6).map(p => questionChatAvatarHtml({username:p.username, avatar_url:p.avatar_url}, 'qchat-avatar')).join('');
  if (ct) {
    const n = arr.length;
    const over = n > QUESTION_CHAT_LIMITS.maxParticipants;
    const visibleNames = arr.map(p => p.username || 'Usuario');
    const suffix = n === 1 && visibleNames[0] ? ` · ${visibleNames[0]}` : (n > 1 && visibleNames[0] ? ` · ${visibleNames[0]} + ${n - 1}` : '');
    ct.textContent = over ? `${n} conectados · sala llena` : `${n} conectado${n === 1 ? '' : 's'}${suffix}`;
    ct.title = visibleNames.join(', ');
    ct.style.color = over ? 'var(--amber)' : '';
  }
}
function questionChatPaintMessages() {
  syncDeps();
  const box = document.getElementById('qchatMessages');
  if (!box) return;
  if (!questionChatState.messages.length) {
    box.innerHTML = `<div class="qchat-empty">${questionChatState.scope === 'friends' ? 'Modo amigos: solo se muestran mensajes de tus amigos conectados al chat.' : 'Modo público: todos los usuarios conectados al chat general pueden participar.'}<br>No hay mensajes recientes guardados en Cloudflare.</div>`;
    return;
  }
  box.innerHTML = questionChatState.messages.map(m => {
    if (m.system) return `<div class="qchat-system">${questionChatSafe(m.text)}</div>`;
    const own = m.uid === currentUser?.id || m.own;
    const profile = { username:m.username, avatar_url:m.avatar_url };
    const hora = m.t ? new Date(m.t).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="qchat-msg ${own ? 'own' : ''}">${questionChatAvatarHtml(profile,'qchat-msg-avatar')}<div><div class="qchat-msg-meta">${own ? 'Vos' : questionChatSafe(m.username)}${hora ? ' · ' + hora : ''}</div><div class="qchat-bubble">${questionChatSafe(m.text)}</div></div></div>`;
  }).join('');
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}
function questionChatUpdateInputState() {
  syncDeps();
  const input = document.getElementById('qchatInput');
  const send = document.getElementById('qchatSend');
  const char = document.getElementById('qchatChar');
  const status = document.getElementById('qchatStatus');
  const txt = input?.value || '';
  if (char) char.textContent = `${txt.length}/${QUESTION_CHAT_LIMITS.maxChars}`;
  const now = Date.now();
  questionChatState.sendTimes = questionChatState.sendTimes.filter(t => now - t < 60000);
  const cooldown = now - questionChatState.lastSendAt < QUESTION_CHAT_LIMITS.minSendIntervalMs;
  const overMinute = questionChatState.sendTimes.length >= QUESTION_CHAT_LIMITS.maxSendsPerMinute;
  const overParticipants = (questionChatState.participants || []).length > QUESTION_CHAT_LIMITS.maxParticipants;
  const configured = questionChatWorkerConfigured();
  const wsReady = questionChatState.ws && questionChatState.ws.readyState === WebSocket.OPEN;
  let disabled = !configured || !currentUser || !questionChatState.joined || !wsReady || questionChatState.sending || !txt.trim() || cooldown || overMinute || overParticipants;
  if (send) send.disabled = disabled;
  if (input) input.disabled = !configured || !currentUser || !questionChatState.joined || !wsReady || overParticipants;
  if (status) {
    status.className = 'qchat-status';
    if (!configured) { status.textContent = 'Configurá Cloudflare Worker para activar el chat.'; status.classList.add('warn'); }
    else if (!currentUser) status.textContent = 'Iniciá sesión para usar el chat.';
    else if (overParticipants) { status.textContent = `Sala llena: máximo ${QUESTION_CHAT_LIMITS.maxParticipants} participantes.`; status.classList.add('warn'); }
    else if (overMinute) { status.textContent = 'Límite local: máximo 12 mensajes por minuto.'; status.classList.add('warn'); }
    else if (cooldown) status.textContent = 'Esperá unos segundos antes de enviar otro mensaje.';
    else status.textContent = questionChatState.status || '';
  }
}
function questionChatMaybeSend(ev) {
  syncDeps();
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    questionChatSend(ev);
  }
}
async function questionChatSend(ev) {
  syncDeps();
  ev?.preventDefault?.();
  if (!currentUser) { abrirAuth(); return; }
  const input = document.getElementById('qchatInput');
  const text = (input?.value || '').trim().replace(/\s+\n/g,'\n');
  if (!text) return;
  const now = Date.now();
  questionChatState.sendTimes = questionChatState.sendTimes.filter(t => now - t < 60000);
  if (text.length > QUESTION_CHAT_LIMITS.maxChars) { mostrarToast('⚠️ Mensaje demasiado largo.'); return; }
  if (now - questionChatState.lastSendAt < QUESTION_CHAT_LIMITS.minSendIntervalMs) { questionChatUpdateInputState(); return; }
  if (questionChatState.sendTimes.length >= QUESTION_CHAT_LIMITS.maxSendsPerMinute) { questionChatUpdateInputState(); return; }
  if ((questionChatState.participants || []).length > QUESTION_CHAT_LIMITS.maxParticipants) { questionChatUpdateInputState(); return; }
  if (!questionChatState.ws || questionChatState.ws.readyState !== WebSocket.OPEN || !questionChatState.joined) { questionChatUpdateInputState(); return; }

  questionChatEmitTyping(false);
  clearTimeout(questionChatState.typingStopTimer);
  const payload = { type:'message', id: questionChatNowId(), text, t: now };
  if (new Blob([JSON.stringify(payload)]).size > QUESTION_CHAT_LIMITS.maxPayloadBytes) { mostrarToast('⚠️ Payload demasiado grande.'); return; }
  questionChatState.sending = true;
  questionChatUpdateInputState();
  try {
    questionChatState.ws.send(JSON.stringify(payload));
    questionChatState.lastSendAt = now;
    questionChatState.sendTimes.push(now);
    if (input) input.value = '';
  } catch(e) {
    console.error('questionChatSend:', e);
    questionChatState.status = 'Error al enviar el mensaje.';
    mostrarToast('❌ No se pudo enviar el mensaje en vivo.');
  } finally {
    questionChatState.sending = false;
    questionChatUpdateInputState();
  }
}
try { window.addEventListener('resize', questionChatUpdateOffsets); } catch (_) {}

  return {
    QUESTION_CHAT_WORKER_URL,
    QUESTION_CHAT_CLIENT_ID,
    QUESTION_CHAT_LIMITS,
    state: questionChatState,
    questionChatState,
    questionChatWorkerConfigured,
    questionChatHttpBase,
    questionChatWsBase,
    questionChatQuestionKey,
    questionChatQuestionLabel,
    questionChatDockHtml,
    questionInviteCurrentContext,
    questionInviteToggle,
    questionInviteClose,
    questionInvitePaint,
    questionInviteSendToFriend,
    questionInviteRegister,
    questionInviteReceive,
    questionInviteOpenPayload,
    questionChatAfterRender,
    questionChatUpdateOffsets,
    questionChatDisconnect,
    questionChatSyncChannel,
    questionChatPaint,
    questionChatAppendMessage,
    questionChatAppendSystem,
    questionChatToggle,
    questionChatOpen,
    questionChatClose,
    questionChatSetScope,
    questionChatMaybeSend,
    questionChatSend,
    questionChatHandleTypingInput
  };
}
