let deps = {};
let currentChallengeCode = null;
let rankingCache = [];
let arenaHudTimer = null;
let arenaLastAnsweredCount = 0;
let arenaLastCorrectCount = 0;
let arenaLobbyPollTimer = null;
let arenaLobbyPollStartedAt = 0;
let arenaAutoStarting = false;
let arenaRivalPollTimer = null;
let arenaRivalPollBusy = false;
let arenaFinalPollTimer = null;
let arenaFinalPollBusy = false;
let arenaInlineNoticeTimer = null;
let arenaLiveSocket = null;
let arenaLiveConnecting = false;
let arenaLiveReconnectTimer = null;
let arenaLiveLastMatchId = null;
let arenaLiveFallbackMode = false;
let arenaLiveLastMessageAt = 0;
let arenaSearchRunId = 0;
let arenaSuppressSearchNoticesUntil = 0;
const arenaSubmittedAnswers = new Set();
const arenaShownPulseKeys = new Set();

function getSupabase() {
  return (deps.getSupabase && deps.getSupabase()) || window.sb;
}

function getCurrentUser() {
  return deps.getCurrentUser ? deps.getCurrentUser() : null;
}

function getCurrentExam() {
  const value = deps.getCurrentExam ? deps.getCurrentExam() : [];
  return Array.isArray(value) ? value : [];
}

function getRespuestas() {
  const value = deps.getRespuestas ? deps.getRespuestas() : [];
  return Array.isArray(value) ? value : [];
}

function toast(message) {
  if (typeof deps.mostrarToast === 'function') deps.mostrarToast(message);
}

function esc(value) {
  return typeof deps.escapeHtml === 'function' ? deps.escapeHtml(value) : String(value ?? '');
}

function openAuth() {
  if (typeof deps.openAuth === 'function') deps.openAuth();
}


function arenaWsReady() {
  return !!arenaLiveSocket && arenaLiveSocket.readyState === WebSocket.OPEN;
}

function getArenaLiveWsUrl() {
  const getter = deps.getArenaLiveWsUrl;
  const value = typeof getter === 'function' ? getter() : '';
  return String(value || '').trim();
}

function closeArenaLiveSocket({ silent = true } = {}) {
  if (arenaLiveReconnectTimer) clearTimeout(arenaLiveReconnectTimer);
  arenaLiveReconnectTimer = null;
  arenaLiveConnecting = false;
  arenaLiveLastMatchId = null;
  arenaLiveFallbackMode = false;
  arenaLiveLastMessageAt = 0;
  const ws = arenaLiveSocket;
  arenaLiveSocket = null;
  if (ws && ws.readyState <= WebSocket.OPEN) {
    try { ws.close(silent ? 1000 : 1001, silent ? 'arena-reset' : 'arena-close'); } catch (_) {}
  }
}

function sendArenaLive(type, payload = {}) {
  if (!arenaWsReady()) return false;
  try {
    arenaLiveSocket.send(JSON.stringify({ type, ...payload, sent_at: Date.now() }));
    return true;
  } catch (_) {
    return false;
  }
}

function numericArenaValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function mergeArenaParticipantData(existing = {}, incoming = {}) {
  const merged = { ...existing, ...incoming };
  const incomingStatus = String(incoming.status || '');
  const presenceOnly = ['connected', 'disconnected', 'accepted', 'ready'].includes(incomingStatus);
  ['score', 'correct_count', 'wrong_count', 'total_answered', 'streak_best', 'time_spent_sec'].forEach((key) => {
    const oldValue = numericArenaValue(existing[key]);
    const newValue = numericArenaValue(incoming[key]);
    if ((incoming[key] == null) || (presenceOnly && oldValue > 0 && newValue === 0) || (oldValue > 0 && newValue < oldValue)) merged[key] = existing[key];
  });
  if (presenceOnly && ['playing', 'completed', 'completed_local'].includes(String(existing.status || ''))) merged.status = existing.status;
  if (!merged.username && existing.username) merged.username = existing.username;
  if (!merged.role && existing.role) merged.role = existing.role;
  return merged;
}

function applyArenaLiveParticipants(participants) {
  if (!Array.isArray(participants)) return false;
  if (!window._arenaActivo?.match?.id) return false;
  const current = Array.isArray(window._arenaActivo.participants) ? window._arenaActivo.participants.slice() : [];
  const byUser = new Map();
  current.forEach((p) => { if (p?.user_id) byUser.set(p.user_id, p); });
  participants.forEach((incoming) => {
    if (!incoming?.user_id) return;
    byUser.set(incoming.user_id, mergeArenaParticipantData(byUser.get(incoming.user_id) || {}, incoming));
  });
  const merged = Array.from(byUser.values());
  window._arenaActivo.participants = merged;
  rankingCache = merged;
  updateArenaHud();
  return true;
}

function mergeArenaParticipant(participant) {
  if (!participant || !window._arenaActivo?.match?.id) return false;
  return applyArenaLiveParticipants([participant]);
}

async function connectArenaLive(matchId) {
  if (!matchId || arenaLiveConnecting) return;
  const wsBase = getArenaLiveWsUrl();
  if (!wsBase) {
    arenaLiveFallbackMode = true;
    return;
  }
  if (arenaWsReady() && arenaLiveLastMatchId === matchId) return;
  closeArenaLiveSocket();
  arenaLiveConnecting = true;
  arenaLiveLastMatchId = matchId;

  try {
    const ticketData = await callArena('liveTicket', { match_id: matchId });
    const ticket = ticketData?.ticket || ticketData?.token;
    if (!ticket) throw new Error('missing_live_ticket');
    const sep = wsBase.includes('?') ? '&' : '?';
    const wsUrl = `${wsBase.replace(/\/$/, '')}/${encodeURIComponent(matchId)}${sep}ticket=${encodeURIComponent(ticket)}`;
    const ws = new WebSocket(wsUrl);
    arenaLiveSocket = ws;

    ws.addEventListener('open', () => {
      arenaLiveConnecting = false;
      arenaLiveFallbackMode = false;
      arenaLiveLastMessageAt = Date.now();
      sendArenaLive('hello', {
        match_id: matchId,
        participant: buildArenaLocalParticipantSnapshot()
      });
    });

    ws.addEventListener('message', (event) => {
      let msg = null;
      try { msg = JSON.parse(event.data); } catch (_) { return; }
      if (!msg || msg.match_id && msg.match_id !== matchId) return;
      arenaLiveLastMessageAt = Date.now();
      if (Array.isArray(msg.participants)) applyArenaLiveParticipants(msg.participants);
      if (msg.participant) mergeArenaParticipant(msg.participant);
      if (msg.type === 'opponent_progress' && msg.participant) mergeArenaParticipant(msg.participant);
      if (msg.type === 'snapshot' && Array.isArray(msg.participants)) applyArenaLiveParticipants(msg.participants);
    });

    ws.addEventListener('close', () => {
      if (arenaLiveSocket === ws) arenaLiveSocket = null;
      arenaLiveConnecting = false;
      if (window._arenaActivo?.match?.id === matchId && !document.getElementById('modalFinal')?.hasAttribute('data-arena-final')) {
        arenaLiveFallbackMode = true;
        arenaLiveReconnectTimer = setTimeout(() => connectArenaLive(matchId), 2500);
      }
    });

    ws.addEventListener('error', () => {
      arenaLiveFallbackMode = true;
    });
  } catch (_) {
    arenaLiveConnecting = false;
    arenaLiveFallbackMode = true;
  }
}

function buildArenaLocalParticipantSnapshot(extra = {}) {
  const active = window._arenaActivo || null;
  const user = getCurrentUser();
  const progress = getLocalArenaProgress();
  const existing = Array.isArray(active?.participants) ? active.participants.find((p) => p.user_id === user?.id) : null;
  return {
    ...(existing || {}),
    user_id: user?.id,
    username: existing?.username || user?.email || 'yo',
    status: progress.total && progress.answered >= progress.total ? 'completed_local' : 'playing',
    score: progress.score,
    correct_count: progress.correct,
    wrong_count: progress.wrong,
    total_answered: progress.answered,
    streak_best: progress.bestStreak,
    ...extra
  };
}

function getArenaAnchorRect() {
  const selectors = [
    '#preguntaBox .resiar-exam-question',
    '#preguntaBox:not(:has(.home-sim))',
    '.resiar-exam-question',
    '#examLayout',
    '#questionCard', '#preguntaCard', '#examQuestionCard', '#examMainCard',
    '.question-card', '.exam-question-card', '.q-card',
    '.practice-main', '.main-panel', 'main'
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 260 && rect.height > 40) return rect;
  }
  const main = document.querySelector('.app-main') || document.querySelector('#app') || document.body;
  return main.getBoundingClientRect();
}

function positionArenaFloatingElement(el, { yOffset = 12 } = {}) {
  if (!el) return;
  const rect = getArenaAnchorRect();
  const left = Math.max(18, Math.min(window.innerWidth - 18, rect.left + rect.width / 2));
  const top = Math.max(82, Math.min(window.innerHeight - 120, rect.top + yOffset));
  const width = Math.max(280, Math.min(620, rect.width));
  el.style.setProperty('left', `${left}px`, 'important');
  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('top', `${top}px`, 'important');
  el.style.setProperty('bottom', 'auto', 'important');
  el.style.setProperty('--arena-float-left', `${left}px`);
  el.style.setProperty('--arena-float-top', `${top}px`);
  el.style.setProperty('--arena-anchor-width', `${width}px`);
}

function showArenaGameNotice(message, type = 'warn') {
  if (!window._arenaActivo && !window._desafioActivo?.arena && !document.body.classList.contains('resiar-arena-mode')) return false;
  let notice = document.getElementById('arenaGameNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'arenaGameNotice';
    notice.className = 'arena-game-notice';
    document.body.appendChild(notice);
  }
  notice.className = `arena-game-notice ${type || 'warn'} vis`;
  notice.innerHTML = `<b>Arena</b><span>${esc(message)}</span><button type="button" aria-label="Cerrar">×</button>`;
  positionArenaFloatingElement(notice, { yOffset: 18 });
  notice.querySelector('button')?.addEventListener('click', () => notice.classList.remove('vis'), { once: true });
  clearTimeout(arenaInlineNoticeTimer);
  arenaInlineNoticeTimer = setTimeout(() => notice.classList.remove('vis'), 4200);
  return true;
}

function showArenaInlineNotice(message, type = 'warn') {
  const modal = document.getElementById('modalDesafio');
  const finalModal = document.getElementById('modalFinal');
  const modalVisible = modal?.classList.contains('vis');
  const finalVisible = finalModal?.hasAttribute('data-arena-final') && finalModal?.classList.contains('vis');
  const arenaVisible = modalVisible || finalVisible || !!window._arenaActivo || !!window._desafioActivo?.arena;
  if (!arenaVisible) return false;
  if (finalVisible && isStaleArenaSearchNotice(message)) return true;

  if (!modalVisible && !finalVisible) return showArenaGameNotice(message, type);

  const host = modalVisible
    ? (modal.querySelector('.sb-card') || modal.querySelector('.mbody') || modal.querySelector('.modal-body') || modal.querySelector('.sb-body') || modal.querySelector('.modal-inner') || modal)
    : (finalModal?.querySelector('#desafioRankingFinal') || finalModal?.querySelector('#modalInner') || finalModal);
  if (!host) return false;

  let notice = document.getElementById('arenaInlineNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'arenaInlineNotice';
    notice.className = 'arena-inline-notice';
    const ref = modalVisible ? (modal.querySelector('.challenge-tabs') || document.getElementById('desafioInfoLine')) : null;
    if (ref && ref.parentElement === host) host.insertBefore(notice, ref.nextSibling);
    else host.insertBefore(notice, host.firstChild || null);
  }

  notice.className = `arena-inline-notice ${type || 'warn'} vis`;
  notice.innerHTML = `<div class="arena-inline-icon">⚔️</div><div><b>Arena</b><span>${esc(message)}</span></div><button type="button" aria-label="Cerrar">×</button>`;
  notice.querySelector('button')?.addEventListener('click', () => notice.classList.remove('vis'), { once: true });
  clearTimeout(arenaInlineNoticeTimer);
  arenaInlineNoticeTimer = setTimeout(() => notice.classList.remove('vis'), 4600);
  return true;
}

function showRichToast(message, type = 'warn') {
  if (isStaleArenaSearchNotice(message) && Date.now() < arenaSuppressSearchNoticesUntil) return;
  if ((isArenaGameCurrentlyActive() || isArenaFinalVisible()) && isStaleArenaSearchNotice(message)) return;
  if (showArenaInlineNotice(message, type)) return;
  if (typeof deps.showRichToast === 'function') {
    deps.showRichToast({ message, type, title: 'Arena', icon: '⚔️', duration: 5200 });
  } else {
    toast(message);
  }
}

function setArenaSearchButtonState(isSearching) {
  const btn = document.getElementById('arenaFindMatchBtn');
  if (!btn) return;
  btn.disabled = !!isSearching;
  btn.classList.toggle('is-searching', !!isSearching);
  btn.textContent = isSearching ? 'Buscando rival...' : '🔎 Buscar partida ahora';
}

function setArenaCreateButtonState(isWaiting = false) {
  const createBtn = document.getElementById('btnCrearDesafio');
  if (!createBtn) return;
  createBtn.disabled = false;
  createBtn.classList.toggle('is-waiting', !!isWaiting);
  createBtn.textContent = isWaiting ? 'Esperando rival...' : '⚔️ Crear código Arena';
}

function resetArenaCreationUi({ clearInfo = false } = {}) {
  setArenaSearchButtonState(false);
  setArenaCreateButtonState(false);
  const createBtn = document.getElementById('btnCrearDesafio');
  if (createBtn) createBtn.classList.add('arena-action-btn', 'arena-create-code-btn');
  const infoEl = document.getElementById('desafioInfoLine');
  if (infoEl && (clearInfo || infoEl.querySelector('.arena-lobby-card.searching'))) infoEl.innerHTML = '';
  document.getElementById('arenaInlineNotice')?.remove();
}

function resetArenaModalToIdle() {
  setCreatedCode(null);
  resetArenaCreationUi({ clearInfo: true });
  const resEl = document.getElementById('desafioResultados');
  const resList = document.getElementById('desafioResultadosList');
  if (resEl) resEl.style.display = 'none';
  if (resList) resList.innerHTML = '';
}

async function getAccessToken() {
  const sb = getSupabase();
  if (!sb?.auth?.getSession) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || null;
}

async function callArena(endpointName, payload = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Sin sesión activa');

  const urlGetter = {
    create: deps.getArenaCreateMatchUrl,
    accept: deps.getArenaAcceptInviteUrl,
    get: deps.getArenaGetMatchUrl,
    submit: deps.getArenaSubmitAnswerUrl,
    complete: deps.getArenaCompleteMatchUrl,
    summary: deps.getArenaSummaryUrl,
    find: deps.getArenaFindMatchUrl,
    liveTicket: deps.getArenaLiveTicketUrl,
  }[endpointName];

  const url = typeof urlGetter === 'function' ? urlGetter() : '';
  if (!url) throw new Error('Endpoint Arena no configurado: ' + endpointName);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.message || data?.error || ('HTTP ' + res.status));
  }
  return data;
}

function normalizeArenaCode(value) {
  const raw = String(value || '').trim().toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  const found = compact.match(/[A-Z0-9]{8}/);
  return found ? found[0] : compact;
}

function hasValidOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return false;
  return Object.values(options).some((value) => String(value ?? '').trim().length > 0);
}

function isPlayableArenaQuestion(question) {
  if (!question || typeof question !== 'object') return false;
  if (question.anulada === true) return false;
  const id = String(question.id || '').trim();
  const statement = String(question.pregunta || '').trim();
  const answer = String(question.respuesta ?? '').trim().toLowerCase();
  return Boolean(id && statement && answer && hasValidOptions(question.opciones));
}

function normalizeArenaQuestion(row) {
  if (!row || typeof row !== 'object') return null;
  const p = { ...row };
  p.id = String(p.id || '').trim();
  p.pregunta = String(p.pregunta || '').trim();
  p.respuesta = String(p.respuesta ?? '').trim().toLowerCase();
  if (p.arena_index == null) p.arena_index = 0;
  return isPlayableArenaQuestion(p) ? p : null;
}


function getArenaMatchQuestionIds(match) {
  return Array.isArray(match?.question_ids)
    ? match.question_ids.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
}

function orderArenaQuestionsByMatch(data) {
  const rawQuestions = Array.isArray(data?.questions) ? data.questions : [];
  const normalized = rawQuestions.map(normalizeArenaQuestion).filter(Boolean);
  const ids = getArenaMatchQuestionIds(data?.match);
  if (!ids.length) return normalized.sort((a, b) => Number(a.arena_index || 0) - Number(b.arena_index || 0));

  const byId = new Map(normalized.map((q) => [String(q.id), q]));
  return ids
    .map((id, index) => {
      const q = byId.get(id);
      return q ? { ...q, arena_index: index } : null;
    })
    .filter(Boolean);
}

function getArenaExpectedQuestionId(index) {
  const active = window._arenaActivo || null;
  const ids = Array.isArray(active?.questionIds) ? active.questionIds : getArenaMatchQuestionIds(active?.match);
  const id = ids[index];
  return id ? String(id) : '';
}

function formatArenaTime(seconds) {
  const n = Math.max(0, Math.round(Number(seconds || 0)));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getStatusLabel(status) {
  return {
    pending: 'Esperando rival',
    ready: 'Lista para jugar',
    active: 'En juego',
    completed: 'Completada',
    expired: 'Vencida',
    cancelled: 'Cancelada'
  }[status] || status || 'Arena';
}

function getAccessLabel(scope) {
  return scope === 'full' ? 'Banco completo' : scope === 'limited' ? 'Banco limitado' : 'Acceso pendiente';
}

function participantLabel(p) {
  if (!p) return 'Jugador';
  const current = getCurrentUser();
  const name = p.username || 'usuario';
  return p.user_id === current?.id ? `${name} (yo)` : name;
}

function getLocalArenaProgress() {
  const exam = getCurrentExam();
  const answers = getRespuestas();
  let answered = 0;
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;
  let score = 0;

  exam.forEach((question, index) => {
    const selected = answers[index];
    if (!selected) return;
    answered += 1;
    const official = question?.respuesta == null ? '' : String(question.respuesta).trim().toLowerCase();
    const ok = !!official && String(selected).trim().toLowerCase() === official;
    if (ok) {
      correct += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      score += 100;
    } else {
      streak = 0;
    }
  });

  return { total: exam.length, answered, correct, wrong: Math.max(0, answered - correct), streak, bestStreak, score };
}

function ensureArenaHud() {
  let hud = document.getElementById('arenaGameHud');
  if (hud) return hud;
  hud = document.createElement('div');
  hud.id = 'arenaGameHud';
  hud.className = 'arena-game-hud';
  document.body.appendChild(hud);
  return hud;
}

function getArenaRival() {
  const active = window._arenaActivo || null;
  const userId = getCurrentUser()?.id;
  return (active?.participants || []).find((p) => p.user_id !== userId) || null;
}

function updateArenaHud() {
  const active = window._arenaActivo || null;
  const hud = document.getElementById('arenaGameHud');
  if (!active?.match) {
    if (hud) hud.classList.remove('vis');
    return;
  }

  const local = getLocalArenaProgress();
  const rival = getArenaRival();
  const rivalAnswered = Number(rival?.total_answered || 0);
  const rivalCorrect = Number(rival?.correct_count || 0);
  const rivalScore = Number(rival?.score || 0);
  const rivalStreak = Number(rival?.streak_best || 0);
  const rivalStatus = rival?.status === 'completed' || rival?.status === 'completed_local' ? 'terminó' : rival?.status === 'playing' ? 'jugando' : rival?.status === 'disconnected' ? 'reconectando' : rival ? 'conectado' : 'conectando';
  const rivalName = rival ? participantLabel(rival).replace(' (yo)', '') : 'Rival';
  const pct = local.total ? Math.round((rivalAnswered / local.total) * 100) : 0;

  const el = ensureArenaHud();
  el.innerHTML = `
    <div class="arena-hud-main arena-hud-main-v41">
      <div class="arena-hud-rival-id">
        <div class="arena-hud-kicker"><span class="arena-live-dot"></span>Contrincante</div>
        <div class="arena-hud-name">${esc(rivalName)}</div>
      </div>
      <div class="arena-hud-score-wrap">
        <div class="arena-hud-score">${rivalScore}<span>pts</span></div>
        <div class="arena-hud-status">${esc(rivalStatus)}</div>
      </div>
    </div>
    <div class="arena-hud-grid arena-hud-grid-v41">
      <div><b>${rivalAnswered}/${local.total || Number(active.match.question_count || 0)}</b><span>respondidas</span></div>
      <div><b>${rivalCorrect}</b><span>correctas</span></div>
      <div><b>x${rivalStreak}</b><span>racha</span></div>
    </div>
    <div class="arena-hud-bar"><span style="width:${pct}%"></span></div>
    <div class="arena-hud-you"><span>Vos</span><b>${local.answered}/${local.total}</b><em>${local.score} pts</em></div>`;
  el.classList.add('vis');

  // El feedback visual se dispara al responder, no desde el polling del HUD.
  // Esto evita que la animación aparezca una sola vez o se pierda cuando el HUD
  // re-renderiza muchas veces por segundo.
  arenaLastAnsweredCount = local.answered;
  arenaLastCorrectCount = local.correct;
}

async function refreshArenaRivalProgress() {
  const active = window._arenaActivo || null;
  if (!active?.match?.id || arenaRivalPollBusy) return;
  const liveFresh = arenaWsReady() && !arenaLiveFallbackMode && (Date.now() - arenaLiveLastMessageAt < 3500);
  if (liveFresh && getArenaRival()) { updateArenaHud(); return; }
  arenaRivalPollBusy = true;
  try {
    const data = await callArena('get', { match_id: active.match.id });
    if (data?.participants) applyArenaLiveParticipants(data.participants);
    if (data?.match) window._arenaActivo.match = data.match;
    updateArenaHud();
  } catch (_) {
    updateArenaHud();
  } finally {
    arenaRivalPollBusy = false;
  }
}

function showArenaPulse(message, type = 'ok') {
  // v46: no reutilizar el mismo nodo. Reusar el nodo provocaba que algunas
  // animaciones/transitionend quedaran en estado muerto después de la primera
  // respuesta. Cada pulso es efímero e independiente.
  try {
    const old = document.getElementById('arenaPulse');
    if (old) old.remove();
  } catch (_) {}

  const pulse = document.createElement('div');
  pulse.id = 'arenaPulse';
  pulse.className = `arena-pulse ${type} arena-pulse-pop`;
  pulse.dataset.arenaPulse = '1';
  pulse.textContent = message;
  document.body.appendChild(pulse);
  positionArenaFloatingElement(pulse, { yOffset: -4 });

  requestAnimationFrame(() => {
    pulse.classList.add('vis');
  });

  clearTimeout(showArenaPulse._timer);
  showArenaPulse._timer = setTimeout(() => {
    pulse.classList.remove('vis');
    pulse.classList.add('out');
    setTimeout(() => { try { pulse.remove(); } catch (_) {} }, 180);
  }, 560);
}

function showArenaAnswerFeedback(index, selectedAnswer, opts = {}) {
  const active = window._arenaActivo || null;
  const matchId = active?.match?.id;
  if (!matchId || index == null || !selectedAnswer) return;

  const key = `${matchId}:${index}:${String(selectedAnswer).trim().toLowerCase()}`;
  if (!opts.force && arenaShownPulseKeys.has(key)) return;
  arenaShownPulseKeys.add(key);

  const question = getCurrentExam()[index];
  const official = question?.respuesta == null ? '' : String(question.respuesta).trim().toLowerCase();
  const chosen = String(selectedAnswer).trim().toLowerCase();
  const ok = typeof opts.isCorrect === 'boolean' ? opts.isCorrect : (!!official && chosen === official);
  showArenaPulse(ok ? '+ puntos' : 'Racha cortada', ok ? 'ok' : 'bad');
}

function arenaOnAnswerFeedback(index, selectedAnswer, meta = {}) {
  if (!window._arenaActivo?.match?.id) return;
  showArenaAnswerFeedback(index, selectedAnswer, {
    force: true,
    isCorrect: typeof meta.isCorrect === 'boolean' ? meta.isCorrect : undefined
  });
}

function startArenaHud() {
  stopArenaHud(false);
  arenaLastAnsweredCount = 0;
  arenaLastCorrectCount = 0;
  updateArenaHud();
  const matchId = window._arenaActivo?.match?.id;
  if (matchId) connectArenaLive(matchId);
  arenaHudTimer = setInterval(updateArenaHud, 700);
  arenaRivalPollTimer = setInterval(refreshArenaRivalProgress, 1800);
  refreshArenaRivalProgress();
  setTimeout(refreshArenaRivalProgress, 450);
  setTimeout(refreshArenaRivalProgress, 1200);
}

function stopArenaHud(remove = true) {
  if (arenaHudTimer) clearInterval(arenaHudTimer);
  if (arenaRivalPollTimer) clearInterval(arenaRivalPollTimer);
  arenaHudTimer = null;
  arenaRivalPollTimer = null;
  arenaRivalPollBusy = false;
  if (remove) document.getElementById('arenaGameHud')?.classList.remove('vis');
}

function resetArenaRuntime({ keepModal = true } = {}) {
  closeArenaLiveSocket();
  stopArenaLobbyPolling();
  stopArenaHud(true);
  stopArenaFinalPolling();
  arenaSubmittedAnswers.clear();
  arenaShownPulseKeys.clear();
  arenaLastAnsweredCount = 0;
  arenaLastCorrectCount = 0;
  invalidateArenaSearch('runtime-reset');
  arenaAutoStarting = false;
  arenaFinalPollBusy = false;
  arenaRivalPollBusy = false;
  try { window._arenaActivo = null; window._desafioActivo = null; window._lastArenaMatchId = null; window._arenaFinalQuestionCount = null; window._resiarArenaMode = false; } catch (_) {}
  try { document.body.classList.remove('resiar-arena-mode'); delete document.body.dataset.resiarMode; } catch (_) {}
  try { document.getElementById('arenaGameHud')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('arenaPulse')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('arenaInlineNotice')?.remove(); } catch (_) {}
  try { document.getElementById('arenaGameNotice')?.remove(); } catch (_) {}
  resetArenaCreationUi();
  try { if (!keepModal) document.getElementById('modalDesafio')?.classList.remove('vis'); } catch (_) {}
}

function renderArenaStatus(data) {
  const infoEl = document.getElementById('desafioInfoLine');
  if (!infoEl || !data?.match) return;

  const match = data.match;
  const participants = Array.isArray(data.participants) ? data.participants : [];
  const creator = participants.find((p) => p.role === 'creator') || participants[0];
  const opponent = participants.find((p) => p.role === 'opponent') || participants[1];
  const ready = match.status !== 'pending';
  const scope = getAccessLabel(match.access_scope);
  const statusLabel = getStatusLabel(match.status);
  const count = Number(match.question_count || (Array.isArray(match.question_ids) ? match.question_ids.length : 0));

  infoEl.innerHTML = `
    <div class="arena-lobby-card ${ready ? 'ready' : 'waiting'}">
      <div class="arena-lobby-top">
        <div>
          <div class="arena-status-kicker">Arena · Duelo asincrónico</div>
          <div class="arena-status-title">${esc(statusLabel)}</div>
        </div>
        <div class="arena-code-pill">${esc(match.code || currentChallengeCode || '------')}</div>
      </div>
      <div class="arena-lobby-meta">
        <span>${esc(scope)}</span>
        <span>${count} preguntas</span>
        <span>${participants.length}/2 jugadores</span>
      </div>
      <div class="arena-versus-row">
        <div class="arena-player-card ${creator ? 'filled' : ''}">
          <span>Creador</span><b>${esc(participantLabel(creator))}</b><small>${esc(creator?.status || 'listo')}</small>
        </div>
        <div class="arena-vs">VS</div>
        <div class="arena-player-card ${opponent ? 'filled' : ''}">
          <span>Rival</span><b>${opponent ? esc(participantLabel(opponent)) : 'Esperando rival'}</b><small>${opponent ? esc(opponent.status || 'listo') : 'compartí el código'}</small>
        </div>
      </div>
      ${ready ? '<div class="arena-lobby-note ok">La partida ya tiene preguntas congeladas. Iniciando Arena...</div>' : '<div class="arena-lobby-note">Esperando rival. Cuando acepte, esta pantalla inicia la Arena automáticamente.</div>'}
    </div>`;
  infoEl.style.display = 'block';
}

function renderArenaParticipants(data) {
  const resEl = document.getElementById('desafioResultados');
  const resList = document.getElementById('desafioResultadosList');
  if (!resEl || !resList) return;

  resEl.style.display = 'block';
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  if (!participants.length) {
    resList.innerHTML = '<div class="lb-empty">Sin participantes todavía</div>';
    return;
  }

  const sorted = [...participants].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  resList.innerHTML = sorted.map((p, i) => {
    const done = p.status === 'completed';
    const score = Number(p.score || 0);
    const total = Number(p.total_answered || 0);
    const correct = Number(p.correct_count || 0);
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return `<div class="arena-participant-row ${p.user_id === getCurrentUser()?.id ? 'me' : ''}">
      <div class="arena-participant-rank">${done ? (i + 1) : '·'}</div>
      <div class="arena-participant-main">
        <b>${esc(participantLabel(p))}</b>
        <span>${done ? 'completado' : p.status === 'playing' ? 'jugando' : 'pendiente'} · racha máx. ${Number(p.streak_best || 0)}</span>
      </div>
      <div class="arena-participant-stat"><b>${correct}/${total}</b><span>${pct}%</span></div>
      <div class="arena-participant-score">${score} pts</div>
    </div>`;
  }).join('');
}

function setCreatedCode(code) {
  currentChallengeCode = code || null;
  const codeEl = document.getElementById('codigoDisplay');
  if (codeEl) codeEl.innerHTML = `${esc(code || '------')}<span class="copy-hint">click para copiar</span>`;
  const codeWrap = document.getElementById('codigoDesafio');
  if (codeWrap) codeWrap.style.display = code ? 'block' : 'none';
}

async function loadArenaMatch(payload) {
  const data = await callArena('get', payload);
  renderArenaStatus(data);
  renderArenaParticipants(data);
  return data;
}

function stopArenaLobbyPolling() {
  if (arenaLobbyPollTimer) clearInterval(arenaLobbyPollTimer);
  arenaLobbyPollTimer = null;
  arenaLobbyPollStartedAt = 0;
  arenaAutoStarting = false;
}

function isArenaGameCurrentlyActive() {
  return Boolean(window._arenaActivo?.match?.id || window._desafioActivo?.arena);
}

function isArenaFinalVisible() {
  const modal = document.getElementById('modalFinal');
  return Boolean(modal?.hasAttribute('data-arena-final') && modal.classList.contains('vis'));
}

function isStaleArenaSearchNotice(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('no encontramos rival') || text.includes('error buscando arena') || text.includes('buscando arena');
}

function suppressArenaSearchNotices(ms = 120000) {
  arenaSuppressSearchNoticesUntil = Date.now() + ms;
  try { document.getElementById('arenaInlineNotice')?.remove(); } catch (_) {}
  try { document.getElementById('arenaGameNotice')?.remove(); } catch (_) {}
}

function invalidateArenaSearch(reason = '') {
  arenaSearchRunId += 1;
  if (reason) suppressArenaSearchNotices();
}

function canAutoStartArena(data) {
  const match = data?.match || {};
  const questions = Array.isArray(data?.questions) ? data.questions.map(normalizeArenaQuestion).filter(Boolean) : [];
  return Boolean(match.id && match.status !== 'pending' && questions.length > 0);
}

async function tryAutoStartCreatorArena(payload, { silent = false } = {}) {
  if (arenaAutoStarting) return false;
  arenaAutoStarting = true;
  try {
    const data = await loadArenaMatch(payload);
    if (!canAutoStartArena(data)) return false;

    stopArenaLobbyPolling();
    const match = data.match || {};
    const label = match.access_scope === 'full' ? 'Arena full' : 'Arena limitada';
    document.getElementById('modalDesafio')?.classList.remove('vis');
    if (!silent) showRichToast('Tu rival aceptó. Arena iniciada automáticamente.', 'success');
    return startArenaExam(data, label);
  } catch (error) {
    if (!silent) showRichToast('No se pudo iniciar Arena automáticamente: ' + error.message, 'error');
    return false;
  } finally {
    arenaAutoStarting = false;
  }
}

function startArenaCreatorPolling(payload) {
  stopArenaLobbyPolling();
  arenaLobbyPollStartedAt = Date.now();
  const poll = async () => {
    if (!payload?.match_id && !payload?.code) return stopArenaLobbyPolling();
    const elapsed = Date.now() - arenaLobbyPollStartedAt;
    if (elapsed > 20 * 60 * 1000) {
      stopArenaLobbyPolling();
      showRichToast('La Arena sigue esperando rival. Podés retomarla desde el historial.', 'warn');
      return;
    }
    await tryAutoStartCreatorArena(payload, { silent: true });
  };
  arenaLobbyPollTimer = setInterval(poll, 2500);
  setTimeout(poll, 900);
}

function startArenaExam(data, label = 'Arena') {
  stopArenaLobbyPolling();
  invalidateArenaSearch('arena-started');
  try { document.getElementById('arenaInlineNotice')?.remove(); document.getElementById('arenaGameNotice')?.remove(); } catch (_) {}
  arenaSubmittedAnswers.clear();
  try { document.body.classList.add('resiar-arena-mode'); document.body.dataset.resiarMode = 'arena'; window._resiarArenaMode = true; } catch (_) {}
  const questionIds = getArenaMatchQuestionIds(data?.match);
  const questions = orderArenaQuestionsByMatch(data);

  if (!questions.length) {
    showRichToast('La partida todavía no tiene preguntas congeladas. Esperá a que el rival acepte la invitación.', 'warn');
    return false;
  }

  window._arenaActivo = {
    match: data.match,
    participants: data.participants || [],
    questions,
    questionIds: questionIds.length ? questionIds : questions.map((q) => String(q.id)),
    startedAt: Date.now()
  };
  window._desafioActivo = {
    id: data.match.id,
    arena: true,
    codigo: data.match.code,
    match: data.match
  };

  rankingCache = data.participants || [];

  if (typeof deps.startChallengeExam === 'function') {
    // Arena no debe disparar toast global de examen: su estado vive en HUD/modal propios.
    deps.startChallengeExam(questions);
    startArenaHud();
    return true;
  }
  return false;
}

function renderArenaIntro() {
  const crear = document.getElementById('challengeCrearSection');
  if (!crear) return;
  resetArenaCreationUi();
  const existingSearchBtn = document.getElementById('arenaFindMatchBtn');
  if (existingSearchBtn) {
    existingSearchBtn.classList.add('arena-action-btn', 'arena-find-btn');
    existingSearchBtn.onclick = buscarArena;
  }
  if (crear.dataset.arenaV24 === '1') return;
  crear.dataset.arenaV24 = '1';
  const btn = document.getElementById('btnCrearDesafio');
  if (btn) btn.classList.add('arena-action-btn', 'arena-create-code-btn');
  const intro = document.createElement('div');
  intro.className = 'arena-mode-grid';
  intro.innerHTML = `
    <div class="arena-mode-card active"><div>⚔️</div><b>Duelo con código</b><span>Invitá a alguien concreto.</span></div>
    <div class="arena-mode-card active"><div>🔎</div><b>Buscar rival</b><span>Te empareja con otro usuario buscando Arena.</span></div>
    <div class="arena-mode-card muted"><div>🔥</div><b>Live 1v1</b><span>Base en tiempo real con progreso del rival.</span></div>`;
  const searchBtn = document.createElement('button');
  searchBtn.id = 'arenaFindMatchBtn';
  searchBtn.className = 'mbprim arena-action-btn arena-find-btn';
  searchBtn.type = 'button';
  searchBtn.textContent = '🔎 Buscar partida ahora';
  searchBtn.addEventListener('click', buscarArena);
  searchBtn.onclick = buscarArena;
  if (btn) {
    crear.insertBefore(intro, btn);
    crear.insertBefore(searchBtn, btn);
  }
}

function renderArenaSummaryShell() {
  const hist = document.getElementById('desafioHistorial');
  if (!hist || document.getElementById('arenaSummaryGrid')) return;
  const shell = document.createElement('div');
  shell.id = 'arenaSummaryGrid';
  shell.className = 'arena-summary-grid';
  shell.innerHTML = `
    <div class="arena-summary-card"><span>Semana</span><b id="arenaWeekScore">—</b><small>puntos</small></div>
    <div class="arena-summary-card"><span>Partidas</span><b id="arenaWeekMatches">—</b><small>jugadas</small></div>
    <div class="arena-summary-card"><span>Mejor</span><b id="arenaWeekBest">—</b><small>score</small></div>`;
  hist.parentNode.insertBefore(shell, hist);

  const leaderboard = document.createElement('div');
  leaderboard.id = 'arenaLeaderboardBox';
  leaderboard.className = 'arena-leaderboard-box';
  leaderboard.innerHTML = `
    <div class="arena-section-title">Top semanal Arena</div>
    <div id="arenaLeaderboardList"><div class="lb-empty">Cargando ranking...</div></div>`;
  hist.parentNode.insertBefore(leaderboard, hist.nextSibling);
}

function renderSummaryData(summary) {
  const stats = Array.isArray(summary?.stats) ? summary.stats : [];
  const totalScore = stats.reduce((acc, row) => acc + Number(row.total_score || 0), 0);
  const matches = stats.reduce((acc, row) => acc + Number(row.matches_played || 0), 0);
  const best = stats.reduce((acc, row) => Math.max(acc, Number(row.best_score || 0)), 0);
  const scoreEl = document.getElementById('arenaWeekScore');
  const matchEl = document.getElementById('arenaWeekMatches');
  const bestEl = document.getElementById('arenaWeekBest');
  if (scoreEl) scoreEl.textContent = String(totalScore);
  if (matchEl) matchEl.textContent = String(matches);
  if (bestEl) bestEl.textContent = String(best);

  const lb = document.getElementById('arenaLeaderboardList');
  if (lb) {
    const rows = Array.isArray(summary?.leaderboard) ? summary.leaderboard : [];
    if (!rows.length) {
      lb.innerHTML = '<div class="lb-empty">Todavía no hay ranking semanal</div>';
    } else {
      lb.innerHTML = rows.slice(0, 6).map((row) => {
        const profile = row.profile || {};
        const isMe = row.user_id === getCurrentUser()?.id;
        const rank = Number(row.rank || 0);
        const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        return `<div class="arena-mini-rank ${isMe ? 'me' : ''}">
          <span>${icon}</span><b>${esc(profile.username || 'usuario')}</b><em>${Number(row.total_score || 0)} pts</em>
        </div>`;
      }).join('');
    }
  }
}

export function configureChallenges(options = {}) {
  deps = options || {};
  try {
    Object.assign(window, {
      abrirDesafio,
      switchChallengeTab,
      cargarHistorialDesafios,
      crearDesafio,
      copiarCodigo,
      copiarLinkDesafio,
      unirseDesafio,
      guardarResultadoDesafio,
      detenerRealtimeDesafio,
      resiarUpdateArenaHud: updateArenaHud,
      resiarArenaSubmitCurrentAnswer: submitArenaAnswerNow,
      resiarArenaOnAnswerFeedback: arenaOnAnswerFeedback,
      buscarArena
    });
  } catch (_) {}
}

export function abrirDesafio() {
  if (!getCurrentUser()) { openAuth(); return; }

  document.getElementById('modalDesafio')?.classList.add('vis');
  const title = document.querySelector('#modalDesafio .sb-title');
  const sub = document.querySelector('#modalDesafio .sb-sub');
  if (title) title.textContent = '⚔️ Arena';
  if (sub) sub.textContent = 'Aprendé jugando: duelos cortos, puntos, racha y ranking semanal';

  const crearText = document.querySelector('#challengeCrearSection p');
  if (crearText) {
    crearText.innerHTML = 'Buscá rival en vivo o creá un código para invitar a alguien. Si uno de los dos tiene Pro/trial activo, esa partida usa banco completo.';
  }
  const createBtn = document.getElementById('btnCrearDesafio');
  if (createBtn) createBtn.textContent = '⚔️ Crear código Arena';

  const joinText = document.querySelector('#challengeUnirseSection p');
  if (joinText) joinText.textContent = 'Ingresá un código Arena para aceptar, jugar o retomar una partida:';

  renderArenaIntro();
  renderArenaSummaryShell();
  setCreatedCode(null);
  cargarHistorialDesafios();
}

export function switchChallengeTab(tab) {
  document.getElementById('tabCrear')?.classList.toggle('active', tab === 'crear');
  document.getElementById('tabUnirse')?.classList.toggle('active', tab === 'unirse');

  const crear = document.getElementById('challengeCrearSection');
  const unirse = document.getElementById('challengeUnirseSection');
  if (crear) crear.style.display = tab === 'crear' ? 'block' : 'none';
  if (unirse) unirse.style.display = tab === 'unirse' ? 'block' : 'none';

  if (tab === 'unirse') cargarHistorialDesafios();
}

export async function cargarHistorialDesafios() {
  const user = getCurrentUser();
  const list = document.getElementById('desafioHistorialList');
  if (!user || !list) return;

  renderArenaSummaryShell();
  list.innerHTML = '<div class="lb-empty" style="padding:10px 0;">Cargando Arena...</div>';

  try {
    const summary = await callArena('summary', {});
    renderSummaryData(summary);
    const rows = Array.isArray(summary.matches) ? summary.matches : [];

    if (!rows.length) {
      list.innerHTML = '<div class="arena-empty-state"><b>Tu Arena está vacía.</b><span>Creá un duelo, compartí el código y empezá a sumar puntos semanales.</span></div>';
      return;
    }

    list.innerHTML = rows.map(({ participant, match }) => {
      const fecha = new Date(participant.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const scope = match?.access_scope === 'full' ? 'full' : match?.access_scope === 'limited' ? 'limitado' : 'pendiente';
      const status = getStatusLabel(match?.status || participant.status);
      const pct = Number(participant.total_answered || 0) ? Math.round((Number(participant.correct_count || 0) / Number(participant.total_answered || 1)) * 100) : 0;
      return `<div class="arena-history-row" data-arena-code="${esc(match?.code || '')}">
        <div class="arena-history-icon">⚔️</div>
        <div class="arena-history-main">
          <b>${esc(match?.code || '—')} · ${esc(status)}</b>
          <span>${fecha} · ${scope} · ${Number(match?.question_count || 0)} preguntas · ${pct}%</span>
        </div>
        <div class="arena-history-score">${Number(participant.score || 0)}<span>pts</span></div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-arena-code]').forEach((el) => {
      el.addEventListener('click', () => {
        const input = document.getElementById('codigoInput');
        if (input) input.value = el.dataset.arenaCode || '';
        switchChallengeTab('unirse');
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="lb-empty" style="padding:10px 0;">Error Arena: ${esc(error.message)}</div>`;
  }
}

export async function buscarArena() {
  const user = getCurrentUser();
  if (!user) { openAuth(); return; }

  resetArenaRuntime({ keepModal: true });
  resetArenaModalToIdle();
  const searchId = ++arenaSearchRunId;
  arenaSuppressSearchNoticesUntil = 0;
  setArenaSearchButtonState(true);
  try { await callArena('find', { action: 'cancel' }); } catch (_) {}
  if (searchId !== arenaSearchRunId) return;

  const startedAt = Date.now();
  const poll = async () => {
    if (searchId !== arenaSearchRunId) return true;
    if (isArenaGameCurrentlyActive() || isArenaFinalVisible()) return true;
    const data = await callArena('find', { mode: 'duel_live', question_count: 10, time_limit_sec: 600 });
    if (searchId !== arenaSearchRunId) return true;
    if (data?.matched && data?.match?.id) {
      showArenaInlineNotice('Rival encontrado. Iniciando Arena.', 'success');
      const matchData = await loadArenaMatch({ match_id: data.match.id });
      if (searchId !== arenaSearchRunId && !window._arenaActivo?.match?.id) return true;
      const label = matchData.match?.access_scope === 'full' ? 'Arena full' : 'Arena limitada';
      resetArenaCreationUi();
      startArenaExam(matchData, label);
      return true;
    }

    const infoEl = document.getElementById('desafioInfoLine');
    if (infoEl && searchId === arenaSearchRunId) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      infoEl.innerHTML = `<div class="arena-lobby-card searching">
        <div class="arena-lobby-top"><div><div class="arena-status-kicker">Arena · Matchmaking</div><div class="arena-status-title">Buscando contrincante</div></div><div class="arena-code-pill">${elapsed}s</div></div>
        <div class="arena-lobby-note">Dejá esta ventana abierta. Si otro usuario también busca partida, empieza automáticamente.</div>
      </div>`;
    }
    return false;
  };

  try {
    const matchedNow = await poll();
    if (matchedNow) {
      if (searchId === arenaSearchRunId) setArenaSearchButtonState(false);
      return;
    }
    arenaLobbyPollStartedAt = Date.now();
    arenaLobbyPollTimer = setInterval(async () => {
      if (searchId !== arenaSearchRunId) {
        stopArenaLobbyPolling();
        setArenaSearchButtonState(false);
        return;
      }
      if (isArenaGameCurrentlyActive() || isArenaFinalVisible()) {
        stopArenaLobbyPolling();
        setArenaSearchButtonState(false);
        suppressArenaSearchNotices();
        return;
      }
      if (Date.now() - arenaLobbyPollStartedAt > 90000) {
        stopArenaLobbyPolling();
        setArenaSearchButtonState(false);
        if (searchId === arenaSearchRunId && !isArenaGameCurrentlyActive() && !isArenaFinalVisible()) {
          showRichToast('No encontramos rival por ahora. Probá de nuevo o usá código.', 'warn');
        }
        return;
      }
      try {
        const matched = await poll();
        if (matched && searchId === arenaSearchRunId) {
          stopArenaLobbyPolling();
          setArenaSearchButtonState(false);
        }
      } catch (_) {}
    }, 2500);
  } catch (error) {
    if (searchId === arenaSearchRunId) showRichToast('Error buscando Arena: ' + error.message, 'error');
    setArenaSearchButtonState(false);
  }
}

export async function crearDesafio() {
  const user = getCurrentUser();
  if (!user) { openAuth(); return; }

  const btn = document.getElementById('btnCrearDesafio');
  if (btn) { btn.disabled = true; btn.classList.add('is-searching'); btn.textContent = 'Creando Arena...'; }

  try {
    const data = await callArena('create', {
      mode: 'duel_async',
      question_count: 10,
      time_limit_sec: 600
    });

    const code = data.invite_code || data.match?.code;
    setCreatedCode(code);
    renderArenaStatus({ match: data.match, participants: [{ user_id: user.id, username: user.email || 'yo', role: 'creator', status: 'accepted' }] });
    renderArenaParticipants({ participants: [{ user_id: user.id, username: user.email || 'yo', role: 'creator', status: 'accepted', score: 0, total_answered: 0, correct_count: 0 }] });
    showArenaInlineNotice('Duelo Arena creado. Compartí el código; cuando el rival acepte, la Arena inicia sola.', 'success');
    startArenaCreatorPolling({ match_id: data.match?.id, code });
    cargarHistorialDesafios();

    setArenaCreateButtonState(true);
  } catch (error) {
    showRichToast('Error al crear Arena: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-searching');
      setTimeout(() => { if (!btn.classList.contains('is-waiting')) setArenaCreateButtonState(false); }, 1600);
    }
  }
}

export function copiarCodigo() {
  if (!currentChallengeCode) return;
  navigator.clipboard.writeText(currentChallengeCode).then(() => toast('✓ Código copiado'));
}

export function copiarLinkDesafio() {
  if (!currentChallengeCode) return;
  const link = `${window.location.origin}${window.location.pathname}?desafio=${encodeURIComponent(currentChallengeCode)}`;
  navigator.clipboard.writeText(link).then(() => toast('✓ Link copiado'));
}

export async function unirseDesafio() {
  const input = document.getElementById('codigoInput');
  const codigo = normalizeArenaCode(input?.value || '');
  const user = getCurrentUser();

  if (!codigo) { toast('⚠️ Ingresá un código'); return; }
  if (!user) { openAuth(); return; }

  if (input) input.value = codigo;
  const joinBtn = document.querySelector('[data-action="join-challenge"]');
  if (joinBtn) { joinBtn.disabled = true; joinBtn.textContent = 'Abriendo Arena...'; }
  stopArenaLobbyPolling();

  try {
    try {
      await callArena('accept', { code: codigo });
    } catch (error) {
      const msg = String(error.message || '');
      const ignorable = msg.includes('propia') || msg.includes('no está pendiente') || msg.includes('no está abierta') || msg.includes('not_playable') || msg.includes('match_not') || msg.includes('forbidden');
      if (!ignorable) throw error;
    }

    const data = await loadArenaMatch({ code: codigo });
    currentChallengeCode = codigo;

    const match = data.match || {};
    if (match.status === 'pending') {
      showRichToast('La partida todavía espera rival. Compartí el código y volvé a abrirla cuando esté lista.', 'warn');
      return;
    }

    const label = match.access_scope === 'full' ? 'Arena full' : 'Arena limitada';
    startArenaExam(data, label);
  } catch (error) {
    showRichToast('Error Arena: ' + error.message, 'error');
  } finally {
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = '⚔️ Unirme al desafío';
    }
  }
}

export function detenerRealtimeDesafio(limpiarCache = true) {
  if (limpiarCache) rankingCache = [];
  stopArenaLobbyPolling();
  stopArenaHud();
}


function stopArenaFinalPolling() {
  if (arenaFinalPollTimer) clearInterval(arenaFinalPollTimer);
  arenaFinalPollTimer = null;
  arenaFinalPollBusy = false;
}

function participantCompletedForArena(p, totalQuestions) {
  if (!p) return false;
  if (p.status === 'completed') return true;
  const answered = Number(p.total_answered || 0);
  return totalQuestions > 0 && answered >= totalQuestions;
}

function exitArenaFinal() {
  invalidateArenaSearch('arena-final-exit');
  suppressArenaSearchNotices(180000);
  try { callArena('find', { action: 'cancel' }).catch(() => {}); } catch (_) {}
  closeArenaLiveSocket();
  stopArenaFinalPolling();
  stopArenaHud();
  stopArenaLobbyPolling();
  try { window._arenaActivo = null; window._desafioActivo = null; window._lastArenaMatchId = null; window._arenaFinalQuestionCount = null; window._resiarArenaMode = false; } catch (_) {}
  try { document.body.classList.remove('resiar-arena-mode'); delete document.body.dataset.resiarMode; } catch (_) {}
  const modal = document.getElementById('modalFinal');
  if (modal) {
    modal.removeAttribute('data-arena-final');
    modal.classList.remove('vis');
  }
  try {
    if (typeof window.irAConfigurarNuevoExamen === 'function') window.irAConfigurarNuevoExamen();
  } catch (_) {}
}

function renderArenaFinalRanking(participants, userId, rankingList, completed) {
  const all = Array.isArray(participants) ? participants : [];
  const sorted = [...all].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const mine = all.find((p) => p.user_id === userId) || null;
  const rival = all.find((p) => p.user_id !== userId) || null;
  const totalQuestions = Number(completed?.total_questions || window._arenaFinalQuestionCount || mine?.total_answered || rival?.total_answered || 0);
  const waiting = !rival || !participantCompletedForArena(rival, totalQuestions);
  const myScore = Number(mine?.score || completed?.score || 0);
  const rivalScore = Number(rival?.score || 0);
  const myTotal = Number(mine?.total_answered || completed?.total_answered || 0);
  const myCorrect = Number(mine?.correct_count || completed?.correct_count || 0);
  const myPct = myTotal ? Math.round((myCorrect / myTotal) * 100) : 0;
  const rivalTotal = Number(rival?.total_answered || 0);
  const rivalCorrect = Number(rival?.correct_count || 0);
  const rivalPct = rivalTotal ? Math.round((rivalCorrect / rivalTotal) * 100) : 0;
  const outcome = waiting
    ? 'Esperando a tu rival'
    : myScore > rivalScore
      ? 'Ganaste la Arena'
      : myScore < rivalScore
        ? 'Perdiste la Arena'
        : 'Empate técnico';
  const outcomeClass = waiting ? 'waiting' : myScore > rivalScore ? 'win' : myScore < rivalScore ? 'lose' : 'draw';
  const rivalName = rival ? participantLabel(rival).replace(' (yo)', '') : 'Rival pendiente';

  document.getElementById('modalFinal')?.setAttribute('data-arena-final', '1');

  rankingList.innerHTML = `
    <div class="arena-final-only ${outcomeClass}">
      <div class="arena-final-hero">
        <div>
          <div class="arena-final-kicker">Arena · Resultado del juego</div>
          <div class="arena-final-title">${esc(outcome)}</div>
          <div class="arena-final-sub">${waiting ? 'Tu partida quedó guardada. Actualizá cuando el rival termine.' : `Duelo contra ${esc(rivalName)}`}</div>
        </div>
        <div class="arena-scoreline">
          <div><span>Vos</span><b>${myScore}</b></div>
          <em>vs</em>
          <div class="rival"><span>${esc(rivalName)}</span><b>${waiting ? '—' : rivalScore}</b></div>
        </div>
      </div>

      <div class="arena-rival-focus ${waiting ? 'pending' : ''}">
        <div class="arena-rival-title">Estadísticas del contrincante</div>
        <div class="arena-rival-name">${esc(rivalName)}</div>
        ${waiting ? `
          <div class="arena-rival-pending">${esc(rivalName)} todavía no terminó. Este panel se actualiza solo cuando complete la Arena.</div>
        ` : `
          <div class="arena-rival-grid">
            <div><b>${rivalScore}</b><span>puntos</span></div>
            <div><b>${rivalCorrect}/${rivalTotal}</b><span>correctas</span></div>
            <div><b>${rivalPct}%</b><span>precisión</span></div>
            <div><b>x${Number(rival?.streak_best || 0)}</b><span>racha máx.</span></div>
            <div><b>${formatArenaTime(rival?.time_spent_sec)}</b><span>tiempo</span></div>
          </div>
        `}
      </div>

      <div class="arena-my-compact">
        <span>Tu partida</span>
        <b>${myScore} pts</b>
        <em>${myCorrect}/${myTotal} correctas · ${myPct}% · racha x${Number(mine?.streak_best || completed?.best_streak || 0)}</em>
      </div>

      <div class="arena-final-list">
        ${sorted.map((p, i) => {
          const isMe = p.user_id === userId;
          const rank = i + 1;
          const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
          const total = Number(p.total_answered || 0);
          const correct = Number(p.correct_count || 0);
          const pct = total ? Math.round((correct / total) * 100) : 0;
          return `<div class="arena-participant-row ${isMe ? 'me' : 'opponent'}">
            <div class="arena-participant-rank">${rankIcon}</div>
            <div class="arena-participant-main"><b>${esc(participantLabel(p))}</b><span>${participantCompletedForArena(p, totalQuestions) ? 'completado' : 'pendiente'} · ${pct}% · racha ${Number(p.streak_best || 0)}</span></div>
            <div class="arena-participant-stat"><b>${correct}/${total}</b><span>correctas</span></div>
            <div class="arena-participant-score">${Number(p.score || 0)} pts</div>
          </div>`;
        }).join('')}
      </div>

      <div class="arena-final-actions">
        <button class="mbsec" id="arenaRematchBtn" type="button">Nueva Arena</button>
        <button class="mbprim" id="arenaExitFinalBtn" type="button">Salir de Arena</button>
      </div>
    </div>`;

  document.getElementById('arenaExitFinalBtn')?.addEventListener('click', exitArenaFinal);

  stopArenaFinalPolling();
  if (waiting) {
    arenaFinalPollTimer = setInterval(async () => {
      if (arenaFinalPollBusy) return;
      arenaFinalPollBusy = true;
      try {
        const active = window._lastArenaMatchId;
        if (!active) return stopArenaFinalPolling();
        const fresh = await loadArenaMatch({ match_id: active });
        const freshParticipants = fresh.participants || [];
        const freshRival = freshParticipants.find((p) => p.user_id !== userId);
        if (participantCompletedForArena(freshRival, totalQuestions)) {
          stopArenaFinalPolling();
          renderArenaFinalRanking(freshParticipants, userId, rankingList, completed);
        }
      } catch (_) {
        // polling silencioso
      } finally {
        arenaFinalPollBusy = false;
      }
    }, 1800);
  }

  document.getElementById('arenaRematchBtn')?.addEventListener('click', async () => {
    invalidateArenaSearch('new-arena-from-final');
    suppressArenaSearchNotices(180000);
    resetArenaRuntime({ keepModal: false });
    try { document.getElementById('arenaGameNotice')?.remove(); document.getElementById('arenaInlineNotice')?.remove(); } catch (_) {}
    try { await callArena('find', { action: 'cancel' }); } catch (_) {}
    document.getElementById('modalFinal')?.removeAttribute('data-arena-final');
    document.getElementById('modalFinal')?.classList.remove('vis');
    abrirDesafio();
    switchChallengeTab('crear');
    setTimeout(() => resetArenaModalToIdle(), 0);
  });
}

async function submitArenaAnswerNow(index, selectedAnswer) {
  const active = window._arenaActivo || null;
  if (!active?.match?.id) return;
  const exam = getCurrentExam();
  const question = exam[index];
  const expectedQuestionId = getArenaExpectedQuestionId(index);
  const questionId = expectedQuestionId || String(question?.id || '');
  if (!isPlayableArenaQuestion(question) || !selectedAnswer || !questionId) return;
  const key = `${active.match.id}:${questionId}`;
  if (arenaSubmittedAnswers.has(key)) return;
  arenaSubmittedAnswers.add(key);
  showArenaAnswerFeedback(index, selectedAnswer);
  const optimistic = buildArenaLocalParticipantSnapshot({ status: 'playing' });
  mergeArenaParticipant(optimistic);
  sendArenaLive('progress', {
    match_id: active.match.id,
    question_id: questionId,
    question_index: index,
    participant: optimistic
  });
  try {
    const saved = await callArena('submit', {
      match_id: active.match.id,
      question_id: questionId,
      selected_answer: selectedAnswer,
      question_index: index,
      client_question_id: String(question?.id || ''),
      time_ms: null
    });
    if (saved?.participant) {
      const mine = buildArenaLocalParticipantSnapshot(saved.participant);
      mergeArenaParticipant(mine);
      sendArenaLive('answer_submitted', {
        match_id: active.match.id,
        question_id: questionId,
        question_index: index,
        participant: mine
      });
    }
    if (!arenaWsReady() || arenaLiveFallbackMode) await refreshArenaRivalProgress();
  } catch (error) {
    arenaSubmittedAnswers.delete(key);
    const msg = String(error?.message || '');
    showRichToast('No se pudo sincronizar esta respuesta Arena: ' + msg, 'error');
  }
}

export async function guardarResultadoDesafio() {
  const user = getCurrentUser();
  const active = window._arenaActivo || null;
  const desafio = window._desafioActivo || null;
  if (!user || !active?.match?.id || !desafio?.arena) return;

  const matchId = active.match.id;
  window._lastArenaMatchId = matchId;
  window._arenaFinalQuestionCount = getCurrentExam().length;
  try { document.body.classList.add('resiar-arena-mode'); document.body.dataset.resiarMode = 'arena'; window._resiarArenaMode = true; } catch (_) {}
  invalidateArenaSearch('arena-completing');
  suppressArenaSearchNotices(180000);
  const arenaFinalSnapshot = buildArenaLocalParticipantSnapshot({ status: 'completed' });
  window._arenaActivo = null;
  window._desafioActivo = null;
  stopArenaHud(false);

  const finalModal = document.getElementById('modalFinal');
  if (finalModal) finalModal.setAttribute('data-arena-final', '1');
  const rankingBox = document.getElementById('desafioRankingFinal');
  const rankingList = document.getElementById('desafioRankingList');
  if (rankingBox) rankingBox.style.display = 'block';
  if (rankingList) {
    rankingList.innerHTML = `
      <div class="arena-final-saving arena-final-saving-rich">
        <div class="arena-saving-orb">⚔️</div>
        <div class="arena-saving-copy">
          <b>Cerrando Arena</b>
          <span>Guardando marcador y esperando el estado del rival.</span>
        </div>
        <div class="arena-saving-dots"><i></i><i></i><i></i></div>
      </div>`;
  }

  try {
    const respuestas = getRespuestas();
    await Promise.all(respuestas.map((answer, idx) => submitArenaAnswerNow(idx, answer)));

    const completed = await callArena('complete', { match_id: matchId });
    sendArenaLive('completed', { match_id: matchId, participant: arenaFinalSnapshot });
    let participants = [];
    if (Array.isArray(completed.participants) && completed.participants.length) {
      participants = completed.participants;
    } else {
      const fresh = await loadArenaMatch({ match_id: matchId });
      participants = Array.isArray(fresh.participants) ? fresh.participants : [];
    }
    const cachedParticipants = Array.isArray(rankingCache) ? rankingCache : [];
    participants = [...cachedParticipants, ...participants].reduce((acc, p) => {
      if (!p?.user_id) return acc;
      const idx = acc.findIndex((x) => x.user_id === p.user_id);
      if (idx >= 0) acc[idx] = mergeArenaParticipantData(acc[idx], p);
      else acc.push(p);
      return acc;
    }, []);
    rankingCache = participants;

    if (rankingList) renderArenaFinalRanking(participants, user.id, rankingList, completed);
    closeArenaLiveSocket();
    // Sin toast global: el resultado de Arena ya queda visible en el panel final.
  } catch (error) {
    if (rankingList) rankingList.innerHTML = `<div class="lb-empty">Error al guardar Arena: ${esc(error.message)}</div>`;
    showRichToast('No se pudo guardar Arena: ' + error.message, 'error');
  }
}
