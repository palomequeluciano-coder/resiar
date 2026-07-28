import {
  enqueueResultSync,
  flushResultSyncQueue,
  getPendingResultSyncCount
} from '../services/resultSyncQueue.js';

const STATS_LEGACY_GLOBAL_KEYS = ['enarm_hist_v1'];
const STATS_LEGACY_USER_PREFIXES = ['enarm_hist_v2'];
const STATS_PREFIX = 'resiar_stats_v1';
const MAX_LOCAL_SESSIONS = 60;
const MAX_SPECIALTIES = 180;

function emptyStats() {
  return { version: 2, sesiones: [], esps: {} };
}

function safeUserKey(user) {
  const raw = user?.id || user?.user_id || user?.email || '';
  return String(raw || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '_');
}

function currentStatsUserKey() {
  return safeUserKey(currentUser());
}

function currentStatsKey() {
  const key = currentStatsUserKey();
  return key ? `${STATS_PREFIX}:${key}` : '';
}

function legacyUserStatsKeys() {
  const key = currentStatsUserKey();
  if (!key) return [];
  return STATS_LEGACY_USER_PREFIXES.map((prefix) => `${prefix}:${key}`);
}

function normalizeStatSession(item) {
  if (!item || typeof item !== 'object') return null;
  const respondidas = Math.max(0, Number(item.respondidas || 0));
  const correctas = Math.max(0, Number(item.correctas || 0));
  if (!respondidas) return null;
  const pct = Number.isFinite(Number(item.pct))
    ? Math.max(0, Math.min(100, Math.round(Number(item.pct))))
    : Math.round((correctas / respondidas) * 100);
  return {
    fecha: item.fecha || new Date().toISOString(),
    correctas: Math.min(correctas, respondidas),
    respondidas,
    pct,
    esps: item.esps && typeof item.esps === 'object' ? item.esps : {}
  };
}

function normalizeSpecialtyStats(value) {
  if (!value || typeof value !== 'object') return null;
  const t = Math.max(0, Number(value.t || 0));
  const c = Math.max(0, Number(value.c || 0));
  if (!t) return null;
  return { c: Math.min(c, t), t };
}

function normalizeStatsPayload(value) {
  const data = value && typeof value === 'object' ? value : emptyStats();
  const sesiones = (Array.isArray(data.sesiones) ? data.sesiones : [])
    .map(normalizeStatSession)
    .filter(Boolean)
    .slice(-MAX_LOCAL_SESSIONS);

  const esps = {};
  Object.entries(data.esps && typeof data.esps === 'object' ? data.esps : {})
    .slice(0, MAX_SPECIALTIES)
    .forEach(([especialidad, raw]) => {
      const clean = normalizeSpecialtyStats(raw);
      const key = String(especialidad || '').trim();
      if (key && clean) esps[key] = clean;
    });

  return {
    version: 2,
    migratedFromLegacy: !!data.migratedFromLegacy,
    sesiones,
    esps
  };
}

function hasStatsData(data) {
  return !!(data && (Array.isArray(data.sesiones) && data.sesiones.length || Object.keys(data.esps || {}).length));
}

const statsDeps = {
  readJson: null,
  writeJson: null,
  espLabel: null,
  formatEsp: null,
  getExam: null,
  getRespuestas: null,
  getCorrectas: null,
  getTiempo: null,
  getTiempoTotal: null,
  getQuestionTimes: null,
  isRespuestaAnulada: null,
  getExamMode: null,
  getCurrentUser: null,
  getSb: null,
  getSubmitResultUrl: null,
  getModalFinal: null,
  isChallengeActive: null,
  guardarResultadoDesafio: null
};

let statsConfigured = false;
let statsModalClickBound = false;
let resultSyncFlushTimer = null;

export function configureStats(deps = {}) {
  Object.assign(statsDeps, deps || {});
  statsConfigured = true;

  scheduleResultSyncFlush(1200);

  if (!statsModalClickBound) {
    statsModalClickBound = true;
    const modal = document.getElementById('modalStats');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) cerrarModalStats();
      });
    }
  }
}

function dep(name, fallback = null) {
  const value = statsDeps[name];
  return value == null ? fallback : value;
}

function callDep(name, fallback, ...args) {
  const fn = statsDeps[name];
  if (typeof fn !== 'function') return fallback;
  return fn(...args);
}


function scheduleResultSyncFlush(delay = 0) {
  try {
    if (resultSyncFlushTimer) clearTimeout(resultSyncFlushTimer);
    resultSyncFlushTimer = setTimeout(() => {
      resultSyncFlushTimer = null;
      flushPendingResultSync().catch((error) => {
        console.warn('flushPendingResultSync:', error?.message || error);
      });
    }, Math.max(0, Number(delay) || 0));
  } catch (_) {}
}

async function getAccessToken() {
  const sb = getSb();
  if (!sb || !sb.auth || typeof sb.auth.getSession !== 'function') return '';
  try {
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token || '';
  } catch (_) {
    return '';
  }
}

export async function flushPendingResultSync() {
  const user = currentUser();
  if (!user) return { attempted: 0, sent: 0, kept: 0 };
  const endpoint = getSubmitResultUrl();
  if (!endpoint) return { attempted: 0, sent: 0, kept: getPendingResultSyncCount(user) };
  const token = await getAccessToken();
  if (!token) return { attempted: 0, sent: 0, kept: getPendingResultSyncCount(user) };

  const result = await flushResultSyncQueue({ user, endpoint, token });
  if (result.sent) {
    console.info(`ResiAR: ${result.sent} resultado${result.sent > 1 ? 's' : ''} pendiente${result.sent > 1 ? 's' : ''} sincronizado${result.sent > 1 ? 's' : ''}.`);
  }
  return result;
}

function getExam() {
  const list = callDep('getExam', []);
  return Array.isArray(list) ? list : [];
}

function getRespuestas() {
  const list = callDep('getRespuestas', []);
  return Array.isArray(list) ? list : [];
}

function getCorrectas() {
  const value = Number(callDep('getCorrectas', 0));
  return Number.isFinite(value) ? value : 0;
}

function getTiempo() {
  const value = Number(callDep('getTiempo', 0));
  return Number.isFinite(value) ? value : 0;
}

function getTiempoTotal() {
  const value = Number(callDep('getTiempoTotal', 0));
  return Number.isFinite(value) ? value : 0;
}

function getQuestionTimes() {
  const list = callDep('getQuestionTimes', []);
  return Array.isArray(list) ? list : [];
}

function getExamMode() {
  const value = String(callDep('getExamMode', 'exam') || 'exam').trim();
  return value || 'exam';
}

function isRespuestaAnuladaSafe(question) {
  const fn = dep('isRespuestaAnulada');
  if (typeof fn === 'function') {
    try { return !!fn(question); } catch (_) {}
  }
  const raw = String(question?.respuesta == null ? '' : question.respuesta).trim().toLowerCase();
  return raw === '' || raw === 'null' || raw === 'anulada' || raw === 'anulado';
}

function textOrEmpty(value) {
  return String(value == null ? '' : value).trim();
}

function questionId(question) {
  return textOrEmpty(question?.id || question?.numero || question?.num_original || question?.pregunta_id || question?.question_id);
}

function questionTopic(question) {
  return textOrEmpty(question?.tema_v2 || question?.tema || question?.topic || '');
}

function questionSubtopic(question) {
  return textOrEmpty(question?.subtema_v2 || question?.subtema || question?.subtopic || '');
}

function normalizeAnswer(value) {
  return textOrEmpty(value).toLowerCase();
}

function currentUser() {
  return callDep('getCurrentUser', null);
}

function getSb() {
  return callDep('getSb', window.sb || null);
}

function getSubmitResultUrl() {
  return callDep('getSubmitResultUrl', '');
}

function getModalFinal() {
  return callDep('getModalFinal', document.getElementById('modalFinal'));
}

function espLabelSafe(p) {
  const fn = dep('espLabel');
  if (typeof fn === 'function') return fn(p);
  return p?.especialidad_v2 || p?.especialidad || 'Sin especialidad';
}

function formatEspSafe(value) {
  const fn = dep('formatEsp');
  if (typeof fn === 'function') return fn(value);
  return String(value || 'Sin especialidad');
}

export function getStats() {
  const reader = dep('readJson');
  if (typeof reader !== 'function') return emptyStats();

  const key = currentStatsKey();
  if (!key) return emptyStats();

  let data = normalizeStatsPayload(reader(key, null));

  // Migración conservadora desde claves históricas.
  // Solo ocurre si el usuario actual todavía no tiene estadísticas propias.
  // Orden: primero claves user-scoped antiguas, después la clave global legacy.
  if (!hasStatsData(data)) {
    const migrationKeys = [
      ...legacyUserStatsKeys(),
      ...STATS_LEGACY_GLOBAL_KEYS
    ];

    for (const legacyKey of migrationKeys) {
      const legacy = normalizeStatsPayload(reader(legacyKey, null));
      if (!hasStatsData(legacy)) continue;

      data = { ...legacy, version: 2, migratedFromLegacy: true, migratedFromKey: legacyKey };
      const writer = dep('writeJson');
      if (typeof writer === 'function') writer(key, data);
      break;
    }
  }

  return data;
}

export function saveStats(data) {
  const writer = dep('writeJson');
  const key = currentStatsKey();
  if (typeof writer !== 'function' || !key) return false;
  return writer(key, normalizeStatsPayload(data));
}

export function getStatsStorageInfo() {
  const key = currentStatsKey();
  return {
    key,
    legacyGlobalKeys: [...STATS_LEGACY_GLOBAL_KEYS],
    legacyUserKeys: legacyUserStatsKeys(),
    userScoped: !!key,
    pendingRemote: getPendingResultSyncCount(currentUser())
  };
}

export function actualizarBadge() {
  const data = getStats();
  const count = data.sesiones.length;
  const badge = document.getElementById('statsBadge');
  if (badge) {
    const pending = getPendingResultSyncCount(currentUser());
    badge.textContent = count
      ? `${count} sesión${count > 1 ? 'es' : ''}${pending ? ` · ${pending} pendiente${pending > 1 ? 's' : ''}` : ''}`
      : (pending ? `${pending} pendiente${pending > 1 ? 's' : ''}` : '—');
  }

  const btnSmart = document.getElementById('btnSmartExam');
  if (btnSmart) {
    const pending = getPendingResultSyncCount(currentUser());
    const tieneEspsLocales = Object.values(data.esps).some((value) => value && value.t >= 3);
    const tieneUsuario = !!currentUser();

    // El examen por debilidades ya no depende solo de localStorage: usa Supabase
    // como fuente principal, suma pendientes locales y deja el local completo solo
    // como respaldo. Por eso no se bloquea el botón si el navegador no tiene
    // estadísticas locales pero el usuario está logueado.
    btnSmart.disabled = !tieneUsuario && !tieneEspsLocales && !pending;
    btnSmart.title = tieneEspsLocales
      ? 'Genera un examen con tus especialidades más débiles'
      : (tieneUsuario
        ? 'Usa tu historial sincronizado y pendientes locales para detectar debilidades'
        : 'Iniciá sesión para usar el examen por debilidades');
  }
}

export function guardarSesion() {
  const examen = getExam();
  const respuestas = getRespuestas();
  const correctas = getCorrectas();
  const respondidas = examen.filter((_, index) => respuestas[index]).length;
  if (!respondidas) return;

  const pct = Math.round((correctas / respondidas) * 100);
  const espData = {};

  examen.forEach((pregunta, index) => {
    if (!respuestas[index]) return;
    const especialidad = espLabelSafe(pregunta);
    if (!espData[especialidad]) espData[especialidad] = { c: 0, t: 0 };
    espData[especialidad].t++;
    if (respuestas[index] === pregunta.respuesta) espData[especialidad].c++;
  });

  const data = getStats();
  data.sesiones.push({ fecha: new Date().toISOString(), correctas, respondidas, pct, esps: espData });
  if (data.sesiones.length > 60) data.sesiones = data.sesiones.slice(-60);

  Object.entries(espData).forEach(([especialidad, value]) => {
    if (!data.esps[especialidad]) data.esps[especialidad] = { c: 0, t: 0 };
    data.esps[especialidad].c += value.c;
    data.esps[especialidad].t += value.t;
  });

  saveStats(data);
  actualizarBadge();
  guardarSesionEnSupabase(pct, respondidas, espData);
}

export function resiarResetFinalSaveGuard() {
  try { window._resiarFinalSessionSaved = false; } catch (_) {}
  try {
    const modalFinal = getModalFinal();
    if (modalFinal) modalFinal._saved = false;
  } catch (_) {}
}

export function resiarSaveFinalSessionOnce() {
  try {
    if (window._resiarFinalSessionSaved) return;
    window._resiarFinalSessionSaved = true;

    const modalFinal = getModalFinal();
    if (modalFinal) modalFinal._saved = true;

    guardarSesion();

    const isChallengeActive = callDep('isChallengeActive', false);
    const saveChallengeResult = dep('guardarResultadoDesafio');
    if (isChallengeActive && typeof saveChallengeResult === 'function') {
      saveChallengeResult();
    }
  } catch (error) {
    console.warn('resiar final save:', error);
  }
}

export function buildAnswerPayload() {
  const examen = getExam();
  const respuestas = getRespuestas();
  const tiemposPregunta = getQuestionTimes();
  const mode = getExamMode();

  return examen
    .map((pregunta, index) => {
      const selected = respuestas[index];
      const id = questionId(pregunta);
      if (!selected || !id) return null;

      const timeSeconds = Number(tiemposPregunta[index] || 0);
      const timeMs = Number.isFinite(timeSeconds) && timeSeconds > 0 ? Math.round(timeSeconds * 1000) : null;
      const correctAnswer = normalizeAnswer(pregunta?.respuesta);
      const selectedAnswer = normalizeAnswer(selected);
      const isAnnulled = isRespuestaAnuladaSafe(pregunta);

      return {
        id,
        question_id: id,
        respuesta: selectedAnswer,
        selected_answer: selectedAnswer,
        correct_answer: correctAnswer || null,
        is_correct: !isAnnulled && !!correctAnswer && selectedAnswer === correctAnswer,
        is_answered: true,
        is_annulled: isAnnulled,
        especialidad: espLabelSafe(pregunta),
        especialidad_v2: textOrEmpty(pregunta?.especialidad_v2 || ''),
        tema: questionTopic(pregunta),
        tema_v2: textOrEmpty(pregunta?.tema_v2 || ''),
        subtema: questionSubtopic(pregunta),
        time_ms: timeMs,
        question_index: index,
        mode,
        metadata: {
          examen: textOrEmpty(pregunta?.examen || ''),
          anio: textOrEmpty(pregunta?.anio || pregunta?.año || ''),
          tipo: textOrEmpty(pregunta?.tipo || ''),
          num_original: pregunta?.num_original ?? pregunta?.numero ?? null
        }
      };
    })
    .filter((answer) => answer && answer.id && answer.respuesta);
}

export async function guardarSesionEnSupabase(_pct, _respondidas, _espData) {
  const user = currentUser();
  if (!user) return;

  try {
    const answers = buildAnswerPayload();
    if (!answers.length) return;

    // Mantener los tildes del panel principal en sincronía inmediata.
    // El outbox remoto puede tardar o fallar; el progreso local no debe esperar.
    try {
      const ids = answers
        .map((answer) => answer?.question_id || answer?.id)
        .filter(Boolean);

      if (ids.length && typeof window.resiarMarkCompletionAnsweredIds === 'function') {
        window.resiarMarkCompletionAnsweredIds(ids, { persist: true, render: true });
      }
    } catch (_) {}

    const endpoint = getSubmitResultUrl();
    const tiempoUsado = getTiempoTotal() - getTiempo();
    const payload = {
      answers,
      tiempo: tiempoUsado > 0 ? tiempoUsado : null,
      duration_ms: tiempoUsado > 0 ? Math.round(tiempoUsado * 1000) : null,
      mode: getExamMode(),
      source: 'web'
    };

    // Outbox local primero: el resultado queda persistido antes de pedir token o red.
    // Esto evita perder exámenes completos si el usuario cierra, recarga o abre otra vista
    // mientras la petición remota todavía está en curso.
    const queuedId = enqueueResultSync(user, payload, { lastError: 'pending_flush' });
    if (!queuedId) return;
    actualizarBadge();

    if (!endpoint) return;
    const token = await getAccessToken();
    if (!token) return;

    const result = await flushResultSyncQueue({ user, endpoint, token });
    if (Array.isArray(result.droppedIds) && result.droppedIds.includes(queuedId)) {
      console.warn('guardarSesionEnSupabase:', result.lastError || result.lastStatus || 'resultado descartado');
    }

    actualizarBadge();
  } catch (error) {
    console.warn('guardarSesionEnSupabase error:', error?.message || error);
  }
}

export function abrirModalStats() {
  renderModalStats();
  document.getElementById('modalStats')?.classList.add('vis');
}

export function cerrarModalStats() {
  document.getElementById('modalStats')?.classList.remove('vis');
}

function colPct(pct) {
  return pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
}

export function renderModalStats() {
  const data = getStats();
  const count = data.sesiones.length;
  const subtitle = document.getElementById('statsSubtitle');
  const box = document.getElementById('statsContent');

  if (!subtitle || !box) return;

  subtitle.textContent = count === 0
    ? 'Sin sesiones registradas aún'
    : `${count} sesión${count > 1 ? 'es' : ''} completada${count > 1 ? 's' : ''}`;

  if (count === 0) {
    box.innerHTML = `<div class="empty-stats">
      <span class="empty-icon">📋</span>
      <p>Completá tu primer examen<br>para ver tus estadísticas históricas</p>
    </div>`;
    return;
  }

  const totalPregs = data.sesiones.reduce((sum, item) => sum + item.respondidas, 0);
  const totalCorr = data.sesiones.reduce((sum, item) => sum + item.correctas, 0);
  const pctG = totalPregs ? Math.round((totalCorr / totalPregs) * 100) : 0;
  const mejor = data.sesiones.reduce((best, item) => item.pct > best.pct ? item : best, data.sesiones[0]);

  let tendCls = 'flat';
  let tendTxt = '→ Estable';
  if (count >= 4) {
    const recientes = data.sesiones.slice(-Math.min(5, count));
    const anteriores = data.sesiones.slice(-Math.min(10, count), -Math.min(5, count));
    const avgRecientes = recientes.reduce((sum, item) => sum + item.pct, 0) / recientes.length;
    const avgAnteriores = anteriores.length ? anteriores.reduce((sum, item) => sum + item.pct, 0) / anteriores.length : avgRecientes;
    const diff = Math.round(avgRecientes - avgAnteriores);
    if (diff > 2) {
      tendCls = 'up';
      tendTxt = `↑ +${diff}% vs antes`;
    } else if (diff < -2) {
      tendCls = 'down';
      tendTxt = `↓ ${diff}% vs antes`;
    }
  }

  const esps = Object.entries(data.esps)
    .filter(([, value]) => value && value.t >= 3)
    .map(([especialidad, value]) => ({
      e: especialidad,
      pct: Math.round((value.c / value.t) * 100),
      c: value.c,
      t: value.t
    }))
    .sort((a, b) => b.pct - a.pct);

  const mejorEsp = esps[0];
  const peorEsp = esps[esps.length - 1];
  const ultimas = data.sesiones.slice(-20);
  const bars = ultimas.map((session) => {
    const height = Math.max(4, Math.round((session.pct / 100) * 56));
    const fecha = new Date(session.fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
    return `<div class="session-bar-wrap">
      <div class="session-bar" style="height:${height}px;background:${colPct(session.pct)};"
           data-tip="${session.pct}% · ${fecha}"></div>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="sgrid">
      <div class="scard c-accent"><div class="sc-val" style="color:var(--accent)">${count}</div><div class="sc-lbl">Sesiones</div></div>
      <div class="scard c-accent"><div class="sc-val" style="color:var(--text)">${totalPregs.toLocaleString()}</div><div class="sc-lbl">Preguntas</div></div>
      <div class="scard c-green"><div class="sc-val" style="color:var(--green)">${totalCorr.toLocaleString()}</div><div class="sc-lbl">Correctas</div></div>
      <div class="scard c-red"><div class="sc-val" style="color:var(--red)">${(totalPregs - totalCorr).toLocaleString()}</div><div class="sc-lbl">Incorrectas</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:22px;align-items:stretch;">
      <div class="scard c-violet" style="text-align:left;padding:18px 20px;">
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
          <span style="font-family:'Playfair Display',serif;font-weight:700;font-size:2.4rem;color:${colPct(pctG)}">${pctG}%</span>
          <span class="trend ${tendCls}">${tendTxt}</span>
        </div>
        <div class="sc-lbl" style="margin-top:6px;">Rendimiento global histórico</div>
        <div style="margin-top:10px;background:var(--border);border-radius:99px;height:5px;overflow:hidden;">
          <div id="gBarStats" style="height:100%;border-radius:99px;background:${colPct(pctG)};width:0%;transition:width 1.2s cubic-bezier(.16,1,.3,1);"></div>
        </div>
      </div>
      <div class="scard c-amber" style="text-align:center;padding:16px;min-width:105px;">
        <div class="sc-val" style="color:var(--amber);font-size:1.55rem;">${mejor.pct}%</div>
        <div class="sc-lbl">Mejor sesión</div>
        <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.54rem;color:var(--text3);margin-top:5px;">${new Date(mejor.fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
      </div>
    </div>

    ${count >= 2 ? `
    <div class="ssec-title">Progreso — últimas ${ultimas.length} sesiones</div>
    <div class="sessions-chart">${bars}</div>` : ''}

    ${esps.length >= 2 ? `
    <div class="ssec-title">Destacados por especialidad</div>
    <div class="best-worst">
      <div class="bw-card">
        <div class="bw-tag" style="color:var(--green)">🥇 Mejor</div>
        <div class="bw-name">${formatEspSafe(mejorEsp.e)}</div>
        <div class="bw-pct" style="color:var(--green)">${mejorEsp.pct}%</div>
        <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.56rem;color:var(--text3);margin-top:3px;">${mejorEsp.c}/${mejorEsp.t} correctas</div>
      </div>
      <div class="bw-card">
        <div class="bw-tag" style="color:var(--red)">📌 A mejorar</div>
        <div class="bw-name">${formatEspSafe(peorEsp.e)}</div>
        <div class="bw-pct" style="color:var(--red)">${peorEsp.pct}%</div>
        <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.56rem;color:var(--text3);margin-top:3px;">${peorEsp.c}/${peorEsp.t} correctas</div>
      </div>
    </div>` : ''}

    ${esps.length ? `
    <div class="ssec-title">Todas las especialidades</div>
    <div style="max-height:250px;overflow-y:auto;padding-right:2px;">
      <div class="esp-hist-row header">
        <span>Especialidad</span><span style="text-align:center">Respondidas</span>
        <span style="text-align:right">Rend.</span><span></span>
      </div>
      ${esps.map(({ e, pct, c, t }) => `
      <div class="esp-hist-row">
        <span class="esp-hist-name">${formatEspSafe(e)}</span>
        <span class="esp-hist-num">${c}/${t}</span>
        <span class="esp-hist-pct" style="color:${colPct(pct)}">${pct}%</span>
        <div class="esp-hist-bar"><div class="esp-hist-fill" data-fw="${pct}" style="width:0%;background:${colPct(pct)};"></div></div>
      </div>`).join('')}
    </div>` : ''}
  `;

  setTimeout(() => {
    const globalBar = document.getElementById('gBarStats');
    if (globalBar) globalBar.style.width = pctG + '%';
    document.querySelectorAll('.esp-hist-fill[data-fw]').forEach((element) => {
      element.style.width = element.dataset.fw + '%';
    });
  }, 80);
}
