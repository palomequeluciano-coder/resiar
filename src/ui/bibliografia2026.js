import {
  getBibliografia2026Access,
  getBibliografia2026Catalog,
  getBibliografia2026Questions,
  getBibliografia2026MyStats,
  getBibliografia2026Ranking,
  submitBibliografia2026Session
} from '../services/bibliografia2026Service.js';

const NEW_FEATURE_UNTIL = '2026-05-28T23:59:59-03:00';
const DEFAULT_LIMIT = 20;
const LIMITS = [10, 20, 30, 50];

let deps = {
  getSupabase: () => window.sb,
  getCurrentUser: () => null,
  getCurrentProfile: () => null,
  openAuth: () => {},
  escapeHtml: (value) => String(value ?? ''),
  mostrarToast: () => {},
  hideExamChrome: () => {},
  getQuestionBox: () => document.getElementById('preguntaBox')
};

let originalReportModalHtml = null;
let originalFinalModalHtml = null;
let originalReviewModalHtml = null;

const state = {
  installed: false,
  catalog: null,
  catalogLoadedAt: 0,
  access: null,
  accessLoadedAt: 0,
  view: 'home',
  questions: [],
  current: 0,
  answers: {},
  hints: {},
  filters: {
    modo: 'rapida',
    especialidad: '',
    tema: '',
    examenRelacionado: '',
    limit: DEFAULT_LIMIT
  },
  startedAt: 0,
  savedResult: null,
  saving: false,
  rankingFilter: 'historico',
  timerId: null,
  questionEnteredAt: 0,
  questionTimes: [],
  answerHistory: [],
  reportReason: null,
  reportSending: false,
  reviewFilter: 'all',
  finalized: false,
  reviewMode: false
};

function esc(value) {
  return deps.escapeHtml ? deps.escapeHtml(value) : String(value ?? '');
}

function toast(message, type) {
  if (typeof deps.mostrarToast === 'function') deps.mostrarToast(message, type);
}

function sb() {
  return deps.getSupabase?.() || window.sb;
}

function currentUser() {
  return deps.getCurrentUser?.() || null;
}

function profileName() {
  const profile = deps.getCurrentProfile?.() || null;
  return profile?.username || currentUser()?.email || '';
}

function questionBox() {
  return deps.getQuestionBox?.() || document.getElementById('preguntaBox');
}

function isFeatureActive(until = NEW_FEATURE_UNTIL) {
  return Date.now() <= new Date(until).getTime();
}

function isNewFeatureActive() {
  return isFeatureActive(NEW_FEATURE_UNTIL);
}

function featureBadge({ label = 'NUEVO', until = NEW_FEATURE_UNTIL, className = '' } = {}) {
  if (!isFeatureActive(until)) return '';
  return `<span class="resiar-feature-badge ${esc(className)}">${esc(label)}</span>`;
}

function newBadge() {
  return featureBadge({ label: 'NUEVO', until: NEW_FEATURE_UNTIL, className: 'biblio-new-badge' });
}

function clean(value) {
  return String(value ?? '').trim();
}

function letterLabel(letter) {
  return String(letter || '').toUpperCase();
}

function pctColor(pct) {
  const n = Number(pct) || 0;
  return n >= 70 ? 'var(--green)' : n >= 50 ? 'var(--amber)' : 'var(--red)';
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function normalizeExplanation(explicaciones, letter) {
  const raw = explicaciones && typeof explicaciones === 'object' ? explicaciones[letter] : null;
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return raw.texto || raw.explicacion || raw.detalle || raw.text || '';
  return String(raw || '');
}

function relatedExamsText(q) {
  return Array.isArray(q?.examenes) && q.examenes.length ? q.examenes.join(', ') : 'No especificado';
}

function relatedExamTags(q) {
  const exams = Array.isArray(q?.examenes) ? q.examenes.filter(Boolean) : [];
  if (!exams.length) return '<span class="biblio-exam-chip muted">Sin examen asociado</span>';
  return exams.map((exam) => {
    const safe = esc(exam);
    const key = String(exam).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<span class="biblio-exam-chip exam-${esc(key)}">${safe}</span>`;
  }).join('');
}

function sourceFooter(q) {
  const fuente = q?.fuente || 'Fuente no especificada';
  return `<div class="biblio-source-footer"><span>Fuente</span><b>${esc(fuente)}</b></div>`;
}

function biblioNotesStorageKey() {
  const user = currentUser();
  const raw = user?.id || user?.email || 'anon';
  const safe = String(raw || 'anon').replace(/[^a-zA-Z0-9_.:-]/g, '_');
  return `resiar_biblio_2026_notes_v1:${safe}`;
}

function readBiblioNotes() {
  try {
    const raw = localStorage.getItem(biblioNotesStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeBiblioNotes(notes) {
  try { localStorage.setItem(biblioNotesStorageKey(), JSON.stringify(notes || {})); } catch (_) {}
}

function currentBiblioQuestion() {
  return state.questions[state.current] || null;
}

function currentBiblioNoteKey() {
  const q = currentBiblioQuestion();
  return q?.id ? `biblio_2026_${q.id}` : null;
}

function updateBiblioNoteButton() {
  const btn = document.getElementById('rpBtnNota');
  const editor = document.getElementById('rpNotaEditor');
  if (!btn) return;
  const key = currentBiblioNoteKey();
  const notes = readBiblioNotes();
  const hasNote = !!(key && notes[key] && String(notes[key]).trim());
  btn.classList.toggle('has-nota', hasNote);
  const editorOpen = editor && editor.style.display !== 'none';
  btn.textContent = editorOpen ? '📝 Cerrar nota' : (hasNote ? '📝 Ver mi nota' : '📝 Agregar nota');
}

function toggleBiblioNotePanel() {
  const key = currentBiblioNoteKey();
  if (!key) return;
  const editor = document.getElementById('rpNotaEditor');
  const textarea = document.getElementById('rpNotaTextarea');
  if (!editor || !textarea) return;
  const notes = readBiblioNotes();
  const visible = editor.style.display !== 'none';
  if (visible) {
    editor.style.display = 'none';
    updateBiblioNoteButton();
    return;
  }
  textarea.value = notes[key] || '';
  textarea.dataset.notaKey = key;
  editor.style.display = 'block';
  updateBiblioNoteButton();
  setTimeout(() => textarea.focus(), 50);
}

let biblioNoteSaveTimer = null;
let biblioHistorySignature = '';
function saveBiblioNoteFromPanel(value) {
  const textarea = document.getElementById('rpNotaTextarea');
  const key = textarea?.dataset?.notaKey || currentBiblioNoteKey();
  if (!key) return;
  clearTimeout(biblioNoteSaveTimer);
  biblioNoteSaveTimer = window.setTimeout(() => {
    const notes = readBiblioNotes();
    const cleanValue = String(value || '');
    if (cleanValue.trim()) notes[key] = cleanValue;
    else delete notes[key];
    writeBiblioNotes(notes);
    const hint = document.getElementById('rpNotaHint');
    if (hint) {
      hint.classList.add('show');
      window.setTimeout(() => hint.classList.remove('show'), 1600);
    }
    updateBiblioNoteButton();
  }, 450);
}

function reportReasonOptions() {
  const reasons = [
    ['respuesta_incorrecta', '❌ La respuesta correcta es incorrecta'],
    ['especialidad_erronea', '🏷️ Especialidad o tema erróneo'],
    ['pregunta_mal_redactada', '✏️ Pregunta mal redactada o confusa'],
    ['imagen_rota', '🖼️ Imagen rota o fuente problemática'],
    ['duplicada', '🔁 Pregunta duplicada'],
    ['otro', '💬 Otro motivo']
  ];
  return reasons.map(([value, label]) => `<div class="reporte-motivo-opt ${state.reportReason === value ? 'sel' : ''}" data-biblio-action="report-reason" data-reason="${esc(value)}">${esc(label)}</div>`).join('');
}

function ensureBiblioReportModal() {
  let modal = document.getElementById('modalReporte');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalReporte';
    modal.className = 'reporte-modal-overlay';
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }
  if (originalReportModalHtml === null) originalReportModalHtml = modal.innerHTML;
  return modal;
}

function openBiblioReport() {
  const q = currentBiblioQuestion();
  if (!q?.id) return;
  state.reportReason = null;
  state.reportSending = false;
  const modal = ensureBiblioReportModal();
  modal.dataset.biblioReport = '1';
  modal.innerHTML = `
    <div class="reporte-modal" role="dialog" aria-modal="true" aria-label="Reportar pregunta">
      <h3>⚑ Reportar pregunta</h3>
      <div class="rm-sub" id="rmPreguntaId">ID: ${esc(q.id)}</div>
      <div class="reporte-motivos" id="rmMotivos">${reportReasonOptions()}</div>
      <textarea class="reporte-desc" id="rmDesc" placeholder="Descripción adicional (opcional)..."></textarea>
      <div class="reporte-modal-btns">
        <button class="btn-rm-cancel" data-biblio-action="close-report">Cancelar</button>
        <button class="btn-rm-enviar" disabled id="btnEnviarReporte" data-biblio-action="send-report">Enviar reporte</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
  modal.onclick = (event) => {
    if (event.target === modal) closeBiblioReport();
  };
}

function restoreOfficialReportModal() {
  const modal = document.getElementById('modalReporte');
  if (!modal || modal.dataset.biblioReport !== '1') return;
  modal.style.display = 'none';
  modal.onclick = null;
  if (originalReportModalHtml !== null) modal.innerHTML = originalReportModalHtml;
  delete modal.dataset.biblioReport;
}

function closeBiblioReport() {
  restoreOfficialReportModal();
  state.reportReason = null;
  state.reportSending = false;
}

function selectBiblioReportReason(reason) {
  state.reportReason = clean(reason);
  const modal = document.getElementById('modalReporte');
  if (!modal || modal.dataset.biblioReport !== '1') return;
  modal.querySelectorAll('.reporte-motivo-opt').forEach((el) => {
    el.classList.toggle('sel', el.dataset.reason === state.reportReason);
  });
  const btn = document.getElementById('btnEnviarReporte');
  if (btn) btn.disabled = !state.reportReason;
}

async function sendBiblioReport() {
  const q = currentBiblioQuestion();
  if (!q?.id || !state.reportReason || state.reportSending) return;
  const btn = document.getElementById('btnEnviarReporte');
  const desc = document.getElementById('rmDesc');
  state.reportSending = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
  }
  try {
    const client = sb();
    const user = currentUser();
    const profile = deps.getCurrentProfile?.() || null;
    const detalle = String(desc?.value || '').trim();
    const { error } = await client.from('reportes_preguntas').insert({
      pregunta_id: String(q.id),
      user_id: user?.id || null,
      username: profile?.username || profileName() || null,
      motivo: state.reportReason,
      descripcion: detalle ? `[Bibliografía 2026] ${detalle}` : '[Bibliografía 2026] Reporte desde práctica con bibliografía.'
    });
    if (error) throw error;
    closeBiblioReport();
    toast('Reporte enviado. Gracias por ayudar a mejorar ResiAR.', 'ok');
  } catch (error) {
    state.reportSending = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Enviar reporte';
    }
    toast('No se pudo enviar el reporte: ' + (error?.message || error), 'error');
  }
}

function ensureBiblioReviewModal() {
  const modal = document.getElementById('modalReview');
  const inner = document.getElementById('modalReviewInner');
  if (!modal || !inner) return null;
  if (originalReviewModalHtml === null) originalReviewModalHtml = inner.innerHTML;
  modal.dataset.biblioReview = '1';
  return { modal, inner };
}

function biblioReviewStatus(index, question) {
  const ans = state.answers[index];
  if (!ans) return 'skip';
  const correcta = clean(question?.respuesta).toLowerCase();
  return ans.selected === correcta ? 'ok' : 'no';
}

function biblioReviewIcon(status, hasNote) {
  const base = status === 'ok' ? '✓' : status === 'no' ? '✗' : '—';
  return `${hasNote ? '📝 ' : ''}${base}`;
}

function renderBiblioReviewGrid() {
  const grid = document.getElementById('reviewGrid');
  if (!grid) return;
  const notes = readBiblioNotes();
  const rows = state.questions.map((q, i) => {
    const status = biblioReviewStatus(i, q);
    const hasNote = !!notes[`biblio_2026_${q.id}`];
    return { q, i, status, hasNote };
  }).filter(({ status, hasNote }) => {
    if (state.reviewFilter === 'all') return true;
    if (state.reviewFilter === 'marked') return hasNote;
    return status === state.reviewFilter;
  });

  if (!rows.length) {
    grid.innerHTML = '<div class="search-empty">No hay preguntas en esta categoría</div>';
    return;
  }

  grid.innerHTML = rows.map(({ q, i, status, hasNote }) => `<div class="review-row rr-${esc(status)}" data-biblio-action="review-open-question" data-index="${i}">
    <span class="review-num">${i + 1}</span>
    <span class="review-txt">${esc(q.pregunta)}</span>
    <span class="review-icon">${esc(biblioReviewIcon(status, hasNote))}</span>
  </div>`).join('');
}

function setBiblioReviewFilter(filter, button) {
  state.reviewFilter = filter || 'all';
  document.querySelectorAll('#modalReview .rf-btn').forEach((btn) => btn.classList.remove('active'));
  if (button) button.classList.add('active');
  renderBiblioReviewGrid();
}

function openBiblioReview() {
  const refs = ensureBiblioReviewModal();
  if (!refs) return;
  const { modal, inner } = refs;
  state.reviewFilter = 'all';
  inner.innerHTML = `<div class="review-hdr"><div class="review-title">📋 Revisión del examen</div><div style="display:flex;align-items:center;gap:8px;"><button class="review-back-btn" data-biblio-action="review-back-final">← Volver al resultado</button><button class="sclose" data-biblio-action="review-close">✕</button></div></div><div class="review-filters"><button class="rf-btn active" data-biblio-action="review-filter" data-filter="all">Todas</button><button class="rf-btn" data-biblio-action="review-filter" data-filter="ok">✓ Correctas</button><button class="rf-btn" data-biblio-action="review-filter" data-filter="no">✗ Incorrectas</button><button class="rf-btn" data-biblio-action="review-filter" data-filter="skip">— Sin responder</button><button class="rf-btn" data-biblio-action="review-filter" data-filter="marked">📝 Con nota</button></div><div class="review-grid" id="reviewGrid"></div>`;
  renderBiblioReviewGrid();
  modal.classList.add('vis');
}

function closeBiblioReview({ restore = false } = {}) {
  const modal = document.getElementById('modalReview');
  const inner = document.getElementById('modalReviewInner');
  if (!modal || modal.dataset.biblioReview !== '1') return;
  modal.classList.remove('vis');
  if (restore && inner && originalReviewModalHtml !== null) {
    inner.innerHTML = originalReviewModalHtml;
    delete modal.dataset.biblioReview;
  }
}

function closeBiblioReviewAndShowFinal() {
  closeBiblioReview();
  const finalModal = document.getElementById('modalFinal');
  if (finalModal?.dataset?.biblioFinal === '1') finalModal.classList.add('vis');
}

function openBiblioReviewQuestion(index) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0 || idx >= state.questions.length) return;
  closeBiblioReview();
  closeBiblioFinalModal();
  state.reviewMode = true;
  showBiblioPracticeChrome();
  goToQuestion(idx);
}


function isBiblioModalOpen() {
  return !!document.querySelector('.modal[style*="flex"], .modal.vis, #modalReporte[style*="flex"], #modalReview.vis, #modalAdminReportes.vis, #biblioReportModal.vis');
}

function shouldIgnoreBiblioKeydown(event) {
  if (!document.body?.classList?.contains('biblio-practice-active')) return true;
  if (isBiblioModalOpen()) return true;
  const target = event.target;
  const tag = target?.tagName;
  if (tag && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return true;
  if (target?.isContentEditable) return true;
  return false;
}

function stopKeyboardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
}

function handleBiblioKeydown(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('modalReview');
    if (modal?.dataset?.biblioReview === '1' && modal.classList.contains('vis')) {
      event.preventDefault();
      closeBiblioReview();
      return;
    }
  }
  if (shouldIgnoreBiblioKeydown(event)) return;
  const q = currentBiblioQuestion();
  if (!q) return;
  const key = String(event.key || '').toLowerCase();
  const answered = !!state.answers[state.current];
  const optionByNumber = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };

  if (!answered && ['a', 'b', 'c', 'd'].includes(key) && q.opciones?.[key]) {
    stopKeyboardEvent(event);
    selectAnswer(key);
    return;
  }

  if (!answered && optionByNumber[key] && q.opciones?.[optionByNumber[key]]) {
    stopKeyboardEvent(event);
    selectAnswer(optionByNumber[key]);
    return;
  }

  if (event.key === 'ArrowRight' || (answered && event.key === 'Enter')) {
    stopKeyboardEvent(event);
    goToQuestion(Math.min(state.current + 1, state.questions.length - 1));
    return;
  }

  if (event.key === 'ArrowLeft') {
    stopKeyboardEvent(event);
    goToQuestion(Math.max(state.current - 1, 0));
    return;
  }

  if (key === 'h' || key === 'p') {
    stopKeyboardEvent(event);
    toggleHint();
  }
}

function currentStreak() {
  let streak = 0;
  for (let i = state.answerHistory.length - 1; i >= 0; i--) {
    const ans = state.answers[state.answerHistory[i]];
    if (!ans || !ans.correct) break;
    streak++;
  }
  return streak;
}

function commitQuestionElapsed() {
  if (!state.questionEnteredAt || !state.questions.length) return;
  const delta = Math.max(0, Math.floor((Date.now() - state.questionEnteredAt) / 1000));
  state.questionTimes[state.current] = Math.max(Number(state.questionTimes[state.current] || 0), delta);
}

function questionElapsed() {
  const saved = Number(state.questionTimes[state.current] || 0);
  const live = state.questionEnteredAt ? Math.floor((Date.now() - state.questionEnteredAt) / 1000) : 0;
  return Math.max(saved, live);
}

function startSessionClock() {
  stopSessionClock();
  state.timerId = window.setInterval(syncTimerUi, 1000);
  syncTimerUi();
}

function stopSessionClock() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
}

function sessionElapsedSeconds() {
  return state.startedAt ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)) : 0;
}

function syncTimerUi() {
  const elapsed = sessionElapsedSeconds();
  const timerEl = document.getElementById('biblioTimer');
  if (timerEl) timerEl.textContent = formatTime(elapsed);
  const qTimerEl = document.getElementById('biblioQuestionTimer');
  if (qTimerEl) qTimerEl.textContent = `⏱ ${formatTime(questionElapsed())}`;
  const streakEl = document.getElementById('biblioStreakNum');
  if (streakEl) streakEl.textContent = currentStreak();
  updateBiblioPracticeChrome();
}

function biblioNavClass(i) {
  if (i === state.current) return 'actual';
  const ans = state.answers[i];
  if (!ans) return '';
  return ans.correct ? 'ok' : 'no';
}

function getBiblioOptimizedNavRanges(total, current) {
  if (!total) return [];
  if (total <= 180) return [[0, total - 1]];

  // Mismo criterio que el simulador principal: inicio, ventana actual por bloques y final.
  const pageSize = 90;
  const pageStart = Math.max(0, Math.floor(current / pageSize) * pageSize);
  const pageEnd = Math.min(total - 1, pageStart + pageSize - 1);
  const ranges = [
    [0, Math.min(2, total - 1)],
    [pageStart, pageEnd],
    [Math.max(0, total - 3), total - 1]
  ].filter((range) => range[0] <= range[1]).sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range[0] > last[1] + 1) merged.push(range.slice());
    else last[1] = Math.max(last[1], range[1]);
  }
  return merged;
}

function biblioNavDots() {
  const total = state.questions.length || 0;
  const ranges = getBiblioOptimizedNavRanges(total, state.current || 0);
  let html = '';
  let prevEnd = -1;

  for (const [start, end] of ranges) {
    if (start > prevEnd + 1) {
      const hidden = start - prevEnd - 1;
      html += `<div class="rp-qnav-ellipsis" title="${hidden} preguntas omitidas">…</div>`;
    }

    for (let i = start; i <= end; i += 1) {
      const cls = biblioNavClass(i);
      html += `<button type="button" class="rp-qnav-dot ${cls}" data-biblio-action="go" data-index="${i}" aria-label="Pregunta ${i + 1}" title="Pregunta ${i + 1}">${i + 1}</button>`;
    }
    prevEnd = end;
  }

  return html;
}

function biblioSidePanel() {
  const total = state.questions.length || 1;
  const answered = countAnswered();
  const progress = Math.round((answered / total) * 100);
  return `
    <aside class="biblio-side-panel">
      <div class="rp-card biblio-rp-card">
        <div class="rp-title">Progreso</div>
        <div class="rp-progress-text">${esc(answered)} de ${esc(total)} &nbsp;·&nbsp; <span style="color:var(--green)">${esc(countCorrect())} correctas</span> · <span style="color:var(--red)">${esc(countIncorrect())} incorrectas</span></div>
        <div class="rp-progress-bar"><div style="width:${progress}%"></div></div>
      </div>
      <div class="rp-card biblio-rp-card">
        <div class="rp-title">Sesión</div>
        <div class="biblio-side-metrics">
          <div><span>Tiempo</span><b id="biblioTimer">${esc(formatTime(sessionElapsedSeconds()))}</b></div>
          <div><span>Racha</span><b><span id="biblioStreakNum">${esc(currentStreak())}</span> 🔥</b></div>
          <div><span>Precisión</span><b style="color:${pctColor(sessionPct())}">${esc(sessionPct())}%</b></div>
        </div>
      </div>
      <div class="rp-card biblio-rp-card">
        <div class="rp-title">Navegación</div>
        <div class="qnav-grid biblio-qnav-grid">${biblioNavDots()}</div>
      </div>
      <button type="button" class="home-secondary biblio-panel-back" data-biblio-action="home">← Configurar práctica</button>
      <button type="button" class="home-secondary biblio-panel-back" data-biblio-action="open-main-config">← Configurador principal</button>
    </aside>
  `;
}

function countAnswered() {
  return Object.keys(state.answers).length;
}

function countCorrect() {
  return Object.values(state.answers).filter((a) => a?.correct).length;
}

function countIncorrect() {
  return Object.values(state.answers).filter((a) => a && !a.correct).length;
}

function sessionPct() {
  const total = countAnswered();
  return total ? Math.round((countCorrect() / total) * 100) : 0;
}

function ensureUser() {
  if (currentUser()) return true;
  deps.openAuth?.();
  return false;
}

function localProfileAccessFallback() {
  const profile = deps.getCurrentProfile?.() || {};
  const plan = clean(profile.plan || '');
  const trialActivadoAt = profile.trial_activado_at || profile.trialActivadoAt || null;
  return {
    allowed: ['admin', 'pro'].includes(plan) || !!trialActivadoAt,
    plan,
    trialActivadoAt,
    source: 'profile'
  };
}

async function checkBibliografiaAccess(force = false) {
  const now = Date.now();
  if (!force && state.access && now - state.accessLoadedAt < 60000) return state.access;

  try {
    const remote = await getBibliografia2026Access(sb());
    const fallback = localProfileAccessFallback();
    const access = {
      allowed: !!remote.allowed,
      plan: clean(remote.plan || fallback.plan),
      trialActivadoAt: remote.trialActivadoAt || fallback.trialActivadoAt || null,
      error: null,
      source: 'rpc'
    };
    state.access = access;
    state.accessLoadedAt = now;
    return access;
  } catch (error) {
    const fallback = localProfileAccessFallback();
    const access = {
      ...fallback,
      error: error?.message || 'No se pudo verificar el acceso.'
    };
    state.access = access;
    state.accessLoadedAt = now;
    return access;
  }
}

async function ensureBibliografiaAccess({ renderLocked = true, force = false } = {}) {
  if (!ensureUser()) return false;
  const access = await checkBibliografiaAccess(force);
  if (access.allowed) return true;
  if (renderLocked) renderAccessLocked(access);
  return false;
}

function planDisplayName(plan) {
  const p = clean(plan).toLowerCase();
  if (p === 'admin') return 'Admin';
  if (p === 'pro') return 'Pro';
  if (p === 'trial') return 'Trial gratuito';
  if (p === 'trial_limitado') return 'Trial limitado';
  if (p === 'trial_activo') return 'Trial activo';
  if (!p) return 'Sin plan activo';
  return p.replace(/_/g, ' ');
}

function lockedMessage(access = {}) {
  const plan = clean(access.plan).toLowerCase();
  if (plan === 'trial') {
    return {
      title: 'Activá tu trial para usar Bibliografía 2026',
      body: 'Tu cuenta tiene acceso trial disponible. Esta práctica se habilita cuando activás el trial completo, o con plan Pro/Admin.',
      cta: 'Activar trial'
    };
  }
  if (plan === 'trial_limitado') {
    return {
      title: 'Bibliografía 2026 queda fuera del trial limitado',
      body: 'El trial limitado mantiene acceso reducido al banco oficial. Para esta función necesitás Pro, Admin o trial completo activado.',
      cta: 'Ver plan Pro'
    };
  }
  return {
    title: 'Bibliografía 2026 es una función avanzada',
    body: 'Está disponible para usuarios Pro, Admin o cuentas con trial activado. Así mantenemos esta práctica separada del banco oficial y de sus estadísticas.',
    cta: 'Ver plan Pro'
  };
}

function renderAccessLocked(access = {}) {
  hideBiblioPracticeChrome();
  const info = lockedMessage(access);
  const plan = planDisplayName(access.plan);
  const trialOn = !!access.trialActivadoAt;
  const trialText = trialOn ? 'Trial activado detectado' : 'Trial activado no detectado';
  try {
    document.body.dataset.resiarView = 'bibliografia2026';
    document.body.classList.add('resiar-config-home', 'resiar-biblio-home', 'resiar-view-bibliografia2026');
    document.body.classList.remove('biblio-practice-active', 'resiar-biblio-practice', 'resiar-view-bibliografia2026-practice', 'resiar-in-simulator');
  } catch (_) {}

  renderShell(`
    <div class="biblio-home-topbar">
      <button type="button" class="biblio-back" data-biblio-action="open-main-config">← Configurador principal</button>
    </div>
    <section class="biblio-access-card">
      <div class="biblio-lock-orb" aria-hidden="true">🔒</div>
      <div class="biblio-access-copy">
        <div class="home-eyebrow"><span class="home-eyebrow-dot"></span> Acceso especial ${newBadge()}</div>
        <h1 class="home-title"><span>${esc(info.title)}</span></h1>
        <p class="home-sub">${esc(info.body)}</p>
        <div class="biblio-access-status">
          <div><span>Tu plan actual</span><b>${esc(plan)}</b></div>
          <div><span>Estado trial</span><b>${esc(trialText)}</b></div>
          <div><span>Disponible con</span><b>Admin · Pro · Trial activado</b></div>
        </div>
        <div class="biblio-access-actions">
          <button type="button" class="home-primary" data-action="activate-trial-premium"><span>🔓</span><span>${esc(info.cta === 'Activar trial' ? 'Activar trial' : 'Activar trial gratis')}</span></button>
          <button type="button" class="home-secondary" data-action="start-payment" data-plan="mensual">⭐ Ver Pro mensual</button>
          <button type="button" class="home-secondary" data-biblio-action="retry-access">↻ Ya tengo acceso, reintentar</button>
        </div>
        ${access.error ? `<div class="biblio-access-note">No se pudo verificar el permiso con servidor: ${esc(access.error)}. Si acabás de activar acceso, tocá “reintentar”.</div>` : ''}
      </div>
      <div class="biblio-access-benefits">
        <div><b>📚 Bibliografía oficial</b><span>Preguntas creadas a partir de fuentes oficiales cargadas.</span></div>
        <div><b>💡 Pistas</b><span>Ayuda antes de responder sin revelar la respuesta.</span></div>
        <div><b>✅ Explicaciones por opción</b><span>Luego de marcar, cada alternativa muestra su justificación.</span></div>
        <div><b>📊 Estadísticas propias</b><span>Ranking y progreso separados de los bancos reales.</span></div>
      </div>
    </section>
  `);
}

async function retryBibliografiaAccess() {
  state.access = null;
  state.accessLoadedAt = 0;
  abrirBibliografia2026();
}

function installEvents() {
  if (state.installed) return;
  state.installed = true;

  document.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-biblio-action]');
    if (!trigger) return;

    const action = trigger.dataset.biblioAction;
    event.preventDefault();

    try {
      if (action === 'open') return abrirBibliografia2026();
      if (action === 'retry-access') return retryBibliografiaAccess();
      if (action === 'home') { restoreOfficialFinalModal(); closeBiblioReview({ restore: true }); return renderHome(); }
      if (action === 'open-main-config') { restoreOfficialFinalModal(); closeBiblioReview({ restore: true }); return openMainConfig(); }
      if (action === 'filter-select') return updateFilter(trigger.dataset.key, trigger.dataset.value || '');
      if (action === 'start-quick') return startPractice({ modo: 'rapida', limit: DEFAULT_LIMIT });
      if (action === 'start-custom') return startPractice(readFiltersFromDom());
      if (action === 'answer') return selectAnswer(trigger.dataset.answer);
      if (action === 'toggle-hint') return toggleHint();
      if (action === 'toggle-note-panel') return toggleBiblioNotePanel();
      if (action === 'open-current-report') return openBiblioReport();
      if (action === 'close-report') return closeBiblioReport();
      if (action === 'report-reason') return selectBiblioReportReason(trigger.dataset.reason || '');
      if (action === 'send-report') return sendBiblioReport();
      if (action === 'prev') return goToQuestion(state.current - 1);
      if (action === 'next') return goToQuestion(state.current + 1);
      if (action === 'go') return goToQuestion(Number(trigger.dataset.index));
      if (action === 'finish') return finishPractice();
      if (action === 'stats') { restoreOfficialFinalModal(); return renderStats(); }
      if (action === 'export-pdf') return exportBiblioPDF();
      if (action === 'ranking') { restoreOfficialFinalModal(); return renderRanking(); }
      if (action === 'ranking-filter') return setRankingFilter(trigger.dataset.filter || 'historico', trigger);
      if (action === 'restart') { restoreOfficialFinalModal(); return startPractice({ ...state.filters }); }
      if (action === 'close-final-and-review') { closeBiblioFinalModal(); return openBiblioReview(); }
      if (action === 'review-back-final') return closeBiblioReviewAndShowFinal();
      if (action === 'review-close') return closeBiblioReview();
      if (action === 'review-filter') return setBiblioReviewFilter(trigger.dataset.filter || 'all', trigger);
      if (action === 'review-open-question') return openBiblioReviewQuestion(trigger.dataset.index);
    } catch (error) {
      renderError(error);
    }
  });

  document.addEventListener('click', (event) => {
    const finalModal = document.getElementById('modalFinal');
    if (finalModal?.dataset?.biblioFinal === '1' && event.target === finalModal) {
      event.preventDefault();
      closeBiblioFinalModal();
    }
    const reviewModal = document.getElementById('modalReview');
    if (reviewModal?.dataset?.biblioReview === '1' && event.target === reviewModal) {
      event.preventDefault();
      closeBiblioReview();
    }
  }, true);

  document.addEventListener('input', (event) => {
    const input = event.target?.closest?.('[data-biblio-input-action]');
    if (!input) return;
    if (input.dataset.biblioInputAction === 'save-question-note') {
      saveBiblioNoteFromPanel(input.value);
    }
  });

  document.addEventListener('keydown', handleBiblioKeydown, true);

}

export function configureBibliografia2026(options = {}) {
  deps = { ...deps, ...options };
  installEvents();
}

export async function abrirBibliografia2026() {
  installEvents();
  if (!ensureUser()) return;

  try { deps.hideExamChrome?.(); } catch (_) {}
  hideBiblioPracticeChrome();
  try { document.body.dataset.resiarView = 'bibliografia2026'; } catch (_) {}
  try { document.body.classList.add('resiar-config-home'); document.body.classList.remove('resiar-in-simulator','resiar-exam-ended','resiar-public-landing'); } catch (_) {}

  const box = questionBox();
  if (!box) return;
  box.innerHTML = loadingMarkup('Cargando práctica con bibliografía 2026...');

  if (!(await ensureBibliografiaAccess({ renderLocked: true }))) return;
  await loadCatalog();
  renderHome();
}

async function loadCatalog(force = false) {
  const now = Date.now();
  if (!force && state.catalog && now - state.catalogLoadedAt < 120000) return state.catalog;
  state.catalog = await getBibliografia2026Catalog(sb());
  state.catalogLoadedAt = now;
  return state.catalog;
}

function loadingMarkup(text) {
  return `<div class="biblio-page"><div class="biblio-loading">${esc(text || 'Cargando...')}</div></div>`;
}

function renderShell(inner) {
  const box = questionBox();
  if (!box) return;
  box.innerHTML = `<div class="biblio-page home-sim fade-in">${inner}</div>`;
  try {
    document.body.dataset.resiarView = 'bibliografia2026';
    document.body.classList.add('resiar-config-home', 'resiar-biblio-home', 'resiar-view-bibliografia2026');
    document.body.classList.remove('biblio-practice-active', 'resiar-biblio-practice', 'resiar-view-bibliografia2026-practice', 'resiar-in-simulator');
    if (typeof window.resiarSyncSidebarForView === 'function') window.resiarSyncSidebarForView('bibliografia2026');
  } catch (_) {}
}

function defaultRightPanelMarkup() {
  return `<div class="rp-section"><div class="rp-title">PROGRESO</div><div class="rp-prog-bar-wrap"><div class="rp-prog-bar" id="rpProgressBar"><div class="rp-prog-fill" id="rpProgressFill" style="width:0%"></div></div></div></div><div class="rp-section"><div class="rp-title">NAVEGACIÓN</div><div class="rp-qnav-grid" id="rpNavGrid"></div></div><div class="rp-actions"><button type="button" class="rp-btn-nota" id="rpBtnNota" data-biblio-action="toggle-note-panel">📝 Agregar nota</button><button type="button" class="rp-btn-report" id="rpBtnReport" data-biblio-action="open-current-report">⚑ Reportar pregunta</button></div><div id="rpNotaEditor" style="display:none; padding:0 14px 14px;"><textarea class="nota-editor" id="rpNotaTextarea" data-biblio-input-action="save-question-note" placeholder="Escribí tu apunte para esta pregunta..."></textarea><span class="nota-saved-hint" id="rpNotaHint">✓ guardado</span></div>`;
}

function officialRightPanelMarkup() {
  return `<div class="rp-section"><div class="rp-title">PROGRESO</div><div class="rp-prog-bar-wrap"><div class="rp-prog-bar" id="rpProgressBar"><div class="rp-prog-fill" id="rpProgressFill" style="width:0%"></div></div></div><div class="rp-progress-text" id="rpProgressText" style="display:none;"></div></div><div class="rp-section"><div class="rp-title">NAVEGACIÓN</div><div class="rp-qnav-grid" id="rpNavGrid"></div></div><div class="rp-actions"><button class="rp-btn-nota" id="rpBtnNota" data-action="toggle-note-panel">📝 Agregar nota</button><button class="rp-btn-report" data-action="open-current-report">⚑ Reportar pregunta</button></div><div id="rpNotaEditor" style="display:none; padding:0 14px 14px;"><textarea class="nota-editor" id="rpNotaTextarea" data-input-action="save-question-note" placeholder="Escribí tu apunte para esta pregunta..."></textarea><span class="nota-saved-hint" id="rpNotaHint">✓ guardado</span></div>`;
}

function restoreDefaultRightPanel() {
  const panel = document.getElementById('rightPanel');
  if (!panel) return;
  if (panel.dataset.biblioPanel === '1') {
    panel.innerHTML = officialRightPanelMarkup();
    delete panel.dataset.biblioPanel;
  }
}

function hideBiblioPracticeChrome() {
  try { biblioHistorySignature = ''; const h = document.getElementById('historial'); if (h) { delete h.dataset.biblioHistorySignature; delete h.dataset.biblioHistoryOwner; } } catch (_) {}
  try { closeBiblioReport(); } catch (_) {}
  try { closeBiblioReview({ restore: true }); } catch (_) {}
  try { document.body.classList.remove('resiar-in-simulator', 'biblio-practice-active', 'resiar-biblio-practice', 'resiar-view-bibliografia2026-practice'); } catch (_) {}
  try { document.body.classList.add('resiar-config-home', 'resiar-biblio-home', 'resiar-view-bibliografia2026'); } catch (_) {}
  try { document.body.dataset.resiarView = 'bibliografia2026'; } catch (_) {}
  try { window._resiarExamRunning = false; window._resiarExamFinished = true; } catch (_) {}
  try { document.getElementById('statsBox')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('rightPanel')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('navBox')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('rachaBox')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('historial') && (document.getElementById('historial').innerHTML = ''); } catch (_) {}
  try { document.getElementById('racha') && (document.getElementById('racha').innerHTML = ''); } catch (_) {}
  try { document.getElementById('streakTexto') && (document.getElementById('streakTexto').innerText = ''); } catch (_) {}
  restoreDefaultRightPanel();
}

function showBiblioPracticeChrome() {
  try { biblioHistorySignature = ''; const h = document.getElementById('historial'); if (h) { delete h.dataset.biblioHistorySignature; delete h.dataset.biblioHistoryOwner; } } catch (_) {}
  try { document.body.classList.add('resiar-in-simulator', 'biblio-practice-active', 'resiar-biblio-practice', 'resiar-view-bibliografia2026-practice'); } catch (_) {}
  try { document.body.classList.remove('resiar-config-home', 'resiar-biblio-home', 'resiar-view-bibliografia2026', 'resiar-exam-ended', 'resiar-public-landing'); } catch (_) {}
  try { if (typeof window.questionChatDisconnect === 'function') window.questionChatDisconnect(); } catch (_) {}
  try { document.querySelectorAll('#qchatRoot,.qchat-root,#qchatFab,#qchatWindow').forEach((el) => { el.style.display = 'none'; }); } catch (_) {}
  try { document.body.dataset.resiarView = 'bibliografia2026-practice'; } catch (_) {}
  try { window._resiarExamRunning = false; window._resiarExamFinished = true; } catch (_) {}
  try { document.getElementById('statsBox')?.classList.add('vis'); } catch (_) {}
  try { document.getElementById('rightPanel')?.classList.add('vis'); } catch (_) {}
  try { document.getElementById('navBox')?.classList.remove('vis'); } catch (_) {}
  updateBiblioPracticeChrome();
}

function updateText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


function renderBiblioHistoryDots() {
  const historial = document.getElementById('historial');
  if (!historial) return;

  if (!state.questions.length) {
    if (historial.innerHTML) historial.innerHTML = '';
    historial.dataset.biblioHistoryOwner = '1';
    historial.dataset.biblioHistorySignature = '';
    biblioHistorySignature = '';
    return;
  }

  const hasta = state.current + 1;
  const desde = Math.max(0, hasta - 10);
  const items = [];

  for (let i = desde; i < hasta; i++) {
    const ans = state.answers[i];
    let cls = 'mt';
    if (ans) cls = ans.correct ? 'ok' : 'no';
    else if (i === state.current) cls = 'mt-actual';
    items.push(cls);
  }

  const signature = `${desde}:${hasta}:${state.current}:${items.join('|')}`;
  const alreadyOwned = historial.dataset.biblioHistoryOwner === '1';
  if (alreadyOwned && biblioHistorySignature === signature && historial.dataset.biblioHistorySignature === signature) {
    updateBiblioStreakIndicator();
    return;
  }

  historial.innerHTML = items
    .map((cls, idx) => `<span class="hdot ${cls}" data-biblio-history-dot="1" style="--i:${idx}"></span>`)
    .join('');

  historial.dataset.biblioHistoryOwner = '1';
  historial.dataset.biblioHistorySignature = signature;
  biblioHistorySignature = signature;

  updateBiblioStreakIndicator();
}

function updateBiblioStreakIndicator() {
  const streak = currentStreak();
  const racha = document.getElementById('racha');
  const streakTexto = document.getElementById('streakTexto');
  if (racha) {
    if (streak >= 10) {
      const qty = Math.floor(streak / 10);
      racha.innerHTML = Array.from({ length: qty }, (_, i) => `<span class="flame" style="font-size:${1 + i * .18}rem">🔥</span>`).join('');
    } else if (racha.innerHTML) {
      racha.innerHTML = '';
    }
  }
  if (streakTexto) streakTexto.innerText = streak >= 10 ? String(streak) : '';
}

function updateBiblioPracticeChrome() {
  if (!document.body?.classList?.contains('biblio-practice-active')) return;
  const total = state.questions.length || 0;
  const answered = countAnswered();
  const correct = countCorrect();
  const incorrect = countIncorrect();
  const pct = sessionPct();
  updateText('correctas', String(correct));
  updateText('incorrectas', String(incorrect));
  updateText('porcentaje', `${pct}%`);
  updateText('timer', formatTime(sessionElapsedSeconds()));
  updateText('rachaNum', String(currentStreak()));
  const rpText = document.getElementById('rpProgressText');
  if (rpText) {
    rpText.style.display = 'none';
    rpText.innerHTML = '';
  }
  renderBiblioHistoryDots();
  const fill = document.getElementById('rpProgressFill');
  if (fill) fill.style.width = total ? `${Math.round((answered / total) * 100)}%` : '0%';
  const grid = document.getElementById('rpNavGrid');
  if (grid) grid.innerHTML = biblioNavDots();
  updateBiblioNoteButton();
}

function renderBiblioRightPanel() {
  const panel = document.getElementById('rightPanel');
  if (!panel) return;
  panel.dataset.biblioPanel = '1';
  panel.innerHTML = defaultRightPanelMarkup();
}


function forceMainConfigState() {
  try {
    const b = document.body;
    b.dataset.resiarView = 'config';
    b.classList.add('resiar-config-home', 'resiar-view-config');
    b.classList.remove(
      'biblio-practice-active',
      'resiar-biblio-home',
      'resiar-biblio-practice',
      'resiar-view-bibliografia2026',
      'resiar-view-bibliografia2026-practice',
      'resiar-in-simulator',
      'resiar-view-exam',
      'resiar-view-exam-review',
      'resiar-exam-review',
      'resiar-exam-ended',
      'resiar-view-exam-ended',
      'resiar-public-landing'
    );
    window._resiarExamRunning = false;
    window._resiarExamFinished = true;
  } catch (_) {}
}

function openMainConfig() {
  restoreOfficialFinalModal();
  stopSessionClock();
  hideBiblioPracticeChrome();
  forceMainConfigState();

  if (typeof window.resiarRenderHome === 'function') {
    try { window.resiarRenderHome(false); } catch (_) {}
    forceMainConfigState();
    try { if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState('config'); } catch (_) {}
    try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}
    requestAnimationFrame(() => {
      forceMainConfigState();
      try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}
      try { const box = document.getElementById('preguntaBox'); if (box) box.scrollTop = 0; } catch (_) {}
    });
    return;
  }

  if (typeof window.irAConfigurarNuevoExamen === 'function') {
    try { window.irAConfigurarNuevoExamen(); } catch (_) {}
    forceMainConfigState();
    return;
  }

  if (typeof window.mostrarPantallaBienvenida === 'function') {
    try { window.mostrarPantallaBienvenida(); } catch (_) {}
    forceMainConfigState();
    return;
  }

  forceMainConfigState();
  renderHome();
}

function renderError(error) {
  const message = error?.message || 'Ocurrió un error inesperado.';
  renderShell(`
    <div class="biblio-topbar">
      <button class="biblio-back" data-biblio-action="home">← Volver</button>
    </div>
    <div class="biblio-error-card">
      <div class="biblio-error-title">No se pudo completar la acción</div>
      <div class="biblio-error-text">${esc(message)}</div>
      <button class="home-primary" data-biblio-action="home">Volver a bibliografía 2026</button>
    </div>
  `);
}

function renderHome() {
  restoreOfficialFinalModal();
  stopSessionClock();
  hideBiblioPracticeChrome();
  state.view = 'home';
  state.reviewMode = false;
  state.finalized = false;
  const catalog = state.catalog || { total: 0, especialidades: [], temas: [], examenes: [] };
  const total = Number(catalog.total || 0);
  const especialidades = Array.isArray(catalog.especialidades) ? catalog.especialidades : [];
  const examenes = Array.isArray(catalog.examenes) ? catalog.examenes : [];

  try {
    document.body.dataset.resiarView = 'bibliografia2026';
    document.body.classList.add('resiar-config-home', 'resiar-biblio-home', 'resiar-view-bibliografia2026');
    document.body.classList.remove('biblio-practice-active', 'resiar-biblio-practice', 'resiar-view-bibliografia2026-practice', 'resiar-in-simulator');
  } catch (_) {}

  renderShell(`
    <div class="biblio-home-topbar">
      <button type="button" class="biblio-back" data-biblio-action="open-main-config">← Configurador principal</button>
    </div>
    <section class="biblio-hero">
      <div class="biblio-hero-copy">
        <div class="home-eyebrow biblio-home-eyebrow">${newBadge() || '<span class="biblio-eyebrow-fallback">Bibliografía 2026</span>'}</div>
        <h1 class="home-title"><span>Práctica con bibliografía</span><em>2026.</em></h1>
        <p class="home-sub">Preguntas elaboradas con herramientas de Google a partir de bibliografía oficial. <strong>No corresponden a exámenes oficiales</strong> y tienen ranking/estadísticas propias.</p>
        <div class="biblio-hero-actions">
          <button class="home-primary" data-biblio-action="start-quick"><span>▶</span><span>Práctica rápida</span></button>
          <button class="home-secondary" data-biblio-action="stats">📊 Mis estadísticas</button>
          <button class="home-secondary" data-biblio-action="ranking">🏆 Ranking</button>
        </div>
      </div>
      <div class="biblio-hero-metrics">
        <div class="home-metric"><div class="home-metric-val">${esc(total)}</div><div class="home-metric-lbl">Preguntas</div></div>
        <div class="home-metric"><div class="home-metric-val">${esc(especialidades.length)}</div><div class="home-metric-lbl">Especialidades</div></div>
        <div class="home-metric"><div class="home-metric-val">${esc(examenes.length)}</div><div class="home-metric-lbl">Exámenes rel.</div></div>
      </div>
    </section>

    <section class="biblio-grid">
      <article class="home-card biblio-card">
        <div class="home-card-head">
          <div>
            <div class="home-card-kicker">01 · Random</div>
            <div class="home-card-title">Práctica rápida</div>
            <div class="home-card-desc">Genera ${DEFAULT_LIMIT} preguntas al azar desde toda la bibliografía 2026.</div>
          </div>
        </div>
        <button class="home-action home-action-large biblio-start-card" data-biblio-action="start-quick">
          <span class="biblio-start-icon">▶</span>
          <b>Empezar ahora</b>
          <span>20 preguntas mezcladas de toda la bibliografía 2026.</span>
        </button>
        <div class="biblio-quick-mini">
          <span>Random general</span>
          <span>Sin filtros</span>
          <span>Resultado propio</span>
        </div>
      </article>

      <article class="home-card biblio-card">
        <div class="home-card-head">
          <div>
            <div class="home-card-kicker">02 · Dirigida</div>
            <div class="home-card-title">Elegir práctica</div>
            <div class="home-card-desc">Filtrá por especialidad, tema, examen relacionado y cantidad.</div>
          </div>
        </div>
        ${filtersMarkup(catalog)}
        <button class="home-primary biblio-wide-btn" data-biblio-action="start-custom"><span>▶</span><span>Generar práctica</span></button>
      </article>

      <article class="home-card biblio-card biblio-info-card">
        <div class="home-card-head">
          <div>
            <div class="home-card-kicker">03 · Información visible</div>
            <div class="home-card-title">Cada pregunta muestra su contexto</div>
            <div class="home-card-desc">Fuente, exámenes relacionados, especialidad, tema, pista y explicación de cada opción.</div>
          </div>
        </div>
        <div class="biblio-info-list biblio-info-list-v11">
          <div><strong>📚 Fuente visible</strong><span>Bibliografía oficial asociada en cada pregunta.</span></div>
          <div><strong>🎯 Chips de examen</strong><span>CABA, ERES, INTEGRADO u otras combinaciones.</span></div>
          <div><strong>💡 Pista previa</strong><span>Ayuda antes de responder, sin revelar la opción correcta.</span></div>
          <div><strong>✅ Explicación por opción</strong><span>Justificación debajo de cada alternativa al responder.</span></div>
        </div>
      </article>
    </section>
  `);
}

function catalogLabel(item, key = 'label') {
  return clean(item?.[key] ?? item?.tema ?? item?.examen ?? item?.especialidad ?? item?.label ?? item);
}

function sumTotales(list, matcher) {
  return (Array.isArray(list) ? list : [])
    .filter(matcher)
    .reduce((sum, item) => sum + (Number(item?.total) || 0), 0);
}

// Especialidades a mostrar como chip: si hay un examen seleccionado, solo las
// que tienen al menos una pregunta para ese examen.
function especialidadesDisponibles(catalog, filters) {
  const cat = catalog || {};
  const examen = filters.examenRelacionado || '';
  const especialidades = Array.isArray(cat.especialidades) ? cat.especialidades : [];
  if (!examen) return especialidades;

  const combos = Array.isArray(cat.especialidades_por_examen) ? cat.especialidades_por_examen : [];
  const validas = new Set(
    combos.filter((item) => item.examen === examen).map((item) => catalogLabel(item, 'especialidad'))
  );
  return especialidades.filter((item) => validas.has(catalogLabel(item, 'especialidad')));
}

// Temas a mostrar como chip: intersección de especialidad (si hay) y examen
// (si hay), para no ofrecer combinaciones sin preguntas.
function temasDisponibles(catalog, filters) {
  const cat = catalog || {};
  const esp = filters.especialidad || '';
  const examen = filters.examenRelacionado || '';
  const temas = Array.isArray(cat.temas) ? cat.temas : [];

  if (!examen) {
    return temas.filter((item) => !esp || item.especialidad === esp);
  }

  const combos = Array.isArray(cat.temas_por_examen) ? cat.temas_por_examen : [];
  const filtrados = combos.filter((item) =>
    item.examen === examen && (!esp || item.especialidad === esp)
  );
  const map = new Map();
  filtrados.forEach((item) => {
    const key = `${item.especialidad}||${item.tema}`;
    const previo = map.get(key);
    map.set(key, {
      especialidad: item.especialidad,
      tema: item.tema,
      total: (previo?.total || 0) + (Number(item.total) || 0)
    });
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total || String(a.tema).localeCompare(String(b.tema)));
}

// Total de preguntas disponibles para la combinación actual de filtros,
// usado tanto para mostrar el conteo de "Todas" como para resolverlo al
// iniciar la práctica.
function computeAvailableTotal(catalog, filters) {
  const cat = catalog || {};
  const esp = filters.especialidad || '';
  const tema = filters.tema || '';
  const examen = filters.examenRelacionado || '';

  if (examen) {
    const combos = Array.isArray(cat.temas_por_examen) ? cat.temas_por_examen : [];
    return sumTotales(combos, (item) =>
      item.examen === examen &&
      (!esp || item.especialidad === esp) &&
      (!tema || item.tema === tema)
    );
  }

  if (tema) {
    const temas = Array.isArray(cat.temas) ? cat.temas : [];
    return sumTotales(temas, (item) => item.tema === tema && (!esp || item.especialidad === esp));
  }

  if (esp) {
    const especialidades = Array.isArray(cat.especialidades) ? cat.especialidades : [];
    return sumTotales(especialidades, (item) => catalogLabel(item, 'especialidad') === esp);
  }

  return Number(cat.total) || 0;
}

function resolveLimit(catalog, filters) {
  if (filters.limit === 'all') {
    const total = computeAvailableTotal(catalog, filters);
    return Math.max(1, total || DEFAULT_LIMIT);
  }
  return Number(filters.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT;
}

function chipButton(key, value, label, total, active) {
  const safeValue = esc(value || '');
  const safeLabel = esc(label || 'Todos');
  const totalMarkup = total != null ? `<small>${esc(total)}</small>` : '';
  return `<button type="button" class="biblio-filter-chip ${active ? 'active' : ''}" data-biblio-action="filter-select" data-key="${esc(key)}" data-value="${safeValue}">${safeLabel}${totalMarkup}</button>`;
}

function filtersMarkup(catalog) {
  const examenes = Array.isArray(catalog.examenes) ? catalog.examenes : [];
  const especialidades = especialidadesDisponibles(catalog, state.filters);
  const filteredTemas = temasDisponibles(catalog, state.filters);
  const availableTotal = computeAvailableTotal(catalog, state.filters);
  return `
    <div class="biblio-filter-panel">
      <div class="biblio-filter-block">
        <div class="biblio-filter-label">Especialidad</div>
        <div class="biblio-chip-row">
          ${chipButton('especialidad', '', 'Todas', null, !state.filters.especialidad)}
          ${especialidades.map((item) => {
            const label = catalogLabel(item, 'especialidad');
            return chipButton('especialidad', label, label, item.total, state.filters.especialidad === label);
          }).join('')}
        </div>
      </div>
      <div class="biblio-filter-block">
        <div class="biblio-filter-label">Tema</div>
        <div class="biblio-chip-row biblio-chip-row-scroll">
          ${chipButton('tema', '', 'Todos', null, !state.filters.tema)}
          ${filteredTemas.map((item) => {
            const label = catalogLabel(item, 'tema');
            return chipButton('tema', label, label, item.total, state.filters.tema === label);
          }).join('')}
        </div>
      </div>
      <div class="biblio-filter-block">
        <div class="biblio-filter-label">Examen relacionado</div>
        <div class="biblio-chip-row">
          ${chipButton('examenRelacionado', '', 'Todos', null, !state.filters.examenRelacionado)}
          ${examenes.map((item) => {
            const label = catalogLabel(item, 'examen');
            return chipButton('examenRelacionado', label, label, item.total, state.filters.examenRelacionado === label);
          }).join('')}
        </div>
      </div>
      <div class="biblio-filter-block">
        <div class="biblio-filter-label">Cantidad</div>
        <div class="biblio-chip-row">
          ${LIMITS.map((n) => chipButton('limit', String(n), String(n), null, state.filters.limit !== 'all' && Number(state.filters.limit) === n)).join('')}
          ${availableTotal > 0 ? chipButton('limit', 'all', `Todas (${availableTotal})`, null, state.filters.limit === 'all') : ''}
        </div>
      </div>
    </div>
  `;
}

function updateFilter(key, value) {
  if (key === 'especialidad') {
    state.filters.especialidad = clean(value);
    state.filters.tema = '';
  } else if (key === 'tema') {
    state.filters.tema = clean(value);
  } else if (key === 'examenRelacionado') {
    state.filters.examenRelacionado = clean(value);
    if (state.filters.examenRelacionado) {
      const catalog = state.catalog || {};
      const espValidas = especialidadesDisponibles(catalog, state.filters).map((item) => catalogLabel(item, 'especialidad'));
      if (state.filters.especialidad && !espValidas.includes(state.filters.especialidad)) {
        state.filters.especialidad = '';
      }
      const temasValidos = temasDisponibles(catalog, state.filters).map((item) => catalogLabel(item, 'tema'));
      if (state.filters.tema && !temasValidos.includes(state.filters.tema)) {
        state.filters.tema = '';
      }
    }
  } else if (key === 'limit') {
    state.filters.limit = value === 'all' ? 'all' : (Number(value || DEFAULT_LIMIT) || DEFAULT_LIMIT);
  }
  renderHome();
}

function readFiltersFromDom() {
  const especialidad = state.filters.especialidad || '';
  const tema = state.filters.tema || '';
  const examenRelacionado = state.filters.examenRelacionado || '';
  const limit = resolveLimit(state.catalog, state.filters);
  let modo = 'rapida';
  if (examenRelacionado) modo = 'examen_relacionado';
  else if (especialidad || tema) modo = 'especialidad_tema';
  return { modo, especialidad, tema, examenRelacionado, limit };
}

async function startPractice(filters = {}) {
  if (!(await ensureBibliografiaAccess({ renderLocked: true }))) return;
  const nextFilters = {
    modo: filters.modo || 'rapida',
    especialidad: clean(filters.especialidad),
    tema: clean(filters.tema),
    examenRelacionado: clean(filters.examenRelacionado),
    limit: Number(filters.limit || DEFAULT_LIMIT)
  };

  state.filters = nextFilters;
  state.questions = [];
  state.current = 0;
  state.answers = {};
  state.hints = {};
  state.questionTimes = [];
  state.answerHistory = [];
  state.savedResult = null;
  state.finalized = false;
  state.reviewMode = false;
  state.startedAt = Date.now();
  state.questionEnteredAt = Date.now();
  state.view = 'practice';

  showBiblioPracticeChrome();
  renderShell(loadingMarkup('Generando práctica...'));
  const questions = await getBibliografia2026Questions(sb(), nextFilters);
  if (!questions.length) {
    renderShell(`
      <div class="biblio-topbar"><button class="biblio-back" data-biblio-action="home">← Volver</button></div>
      <div class="biblio-empty-state">
        <h2>No hay preguntas disponibles con esos filtros</h2>
        <p>Probá con otra especialidad, tema o examen relacionado.</p>
        <button class="home-primary" data-biblio-action="home">Volver</button>
      </div>
    `);
    return;
  }

  state.questions = questions;
  state.questionTimes = new Array(questions.length).fill(0);
  startSessionClock();
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.current];
  if (!q) return renderHome();

  showBiblioPracticeChrome();
  const answer = state.answers[state.current];
  const answered = !!answer;
  const selected = answer?.selected || '';
  const correct = clean(q.respuesta).toLowerCase();
  const showHint = !!state.hints[state.current];
  const selectedOk = answered && selected === correct;
  const timerTxt = `⏱ ${formatTime(questionElapsed())}`;
  const metaParts = [q.especialidad, q.tema].filter(Boolean);

  const html = `<div class="fade-in resiar-exam-question biblio-official-question">
    <div class="qhdr resiar-question-header biblio-qhdr-official">
      <span class="qcount">${esc(state.current + 1)} / ${esc(state.questions.length)}</span>
      <div class="qhdr-actions">
        <span class="q-timer" id="biblioQuestionTimer">${esc(timerTxt)}</span>
        <span class="qmeta">Bibliografía 2026<br>Pregunta ${esc(state.current + 1)}</span>
      </div>
    </div>

    <div class="qtext resiar-question-text biblio-question-text-official">${esc(q.pregunta)}</div>

    <div class="biblio-meta-bar-official">
      <div class="biblio-meta-left">
        ${metaParts.map((item, idx) => `<span><b>${idx === 0 ? 'Especialidad' : 'Tema'}</b>${esc(item)}</span>`).join('')}
      </div>
      <div class="biblio-meta-exams">${relatedExamTags(q)}</div>
    </div>

    <div class="biblio-options-official">
      ${['a', 'b', 'c', 'd'].map((letter) => optionMarkup(q, letter, answered, selected, correct)).join('')}
    </div>

    <div class="biblio-hint-row biblio-hint-row-official">
      <button type="button" class="home-secondary biblio-hint-btn" data-biblio-action="toggle-hint">${showHint ? 'Ocultar pista' : '💡 Ver pista'}</button>
      ${showHint ? `<div class="biblio-hint"><b>Pista:</b> ${esc(q.pista || 'No hay pista cargada.')}</div>` : ''}
    </div>

    <div class="biblio-source-foot-official"><span>Fuente</span>${esc(q.fuente || 'Fuente no especificada')}</div>

    <div class="nav-inline biblio-nav-row-official ${state.reviewMode ? 'nav-review-mode' : ''}">
      <button type="button" class="bnav" data-biblio-action="prev" ${state.current === 0 ? 'disabled' : ''}>← Anterior</button>
      <button type="button" class="bfin" data-biblio-action="${state.reviewMode ? 'review-back-final' : 'finish'}">${state.reviewMode ? 'Volver al resultado' : 'Finalizar práctica'}</button>
      <button type="button" class="bnext" data-biblio-action="next" ${state.current >= state.questions.length - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>
  </div>`;

  const box = questionBox();
  if (box) box.innerHTML = html;
  updateBiblioPracticeChrome();
  syncTimerUi();
}

function optionMarkup(q, letter, answered, selected, correct) {
  const showResolution = answered || state.reviewMode || state.finalized;
  const isCorrect = letter === correct;
  const isSelected = letter === selected;
  let cls = 'opcion resiar-option biblio-option-official';
  if (showResolution && isCorrect) cls += ' ok';
  if (showResolution && isSelected && !isCorrect) cls += ' no';
  if (showResolution && isSelected) cls += ' selected';
  const attrs = showResolution ? 'data-off="1"' : `data-biblio-action="answer" data-answer="${letter}"`;
  const text = normalizeExplanation(q.explicaciones, letter) || 'Explicación no disponible para esta opción.';
  const status = isCorrect ? 'Correcta' : 'Incorrecta';
  return `<label class="${cls}" ${attrs}>
    <input type="radio" ${showResolution ? 'disabled' : ''}>
    <span class="olbl resiar-option-label biblio-option-letter">${letterLabel(letter)}</span>
    <span class="otext resiar-option-text biblio-option-body">
      <span class="biblio-option-text">${esc(q.opciones?.[letter] || '')}</span>
      ${showResolution ? `<span class="biblio-option-explanation ${isCorrect ? 'ok' : 'no'}"><b>${esc(status)}</b>${esc(text)}</span>` : ''}
    </span>
  </label>`;
}

function selectAnswer(letter) {
  const q = state.questions[state.current];
  if (!q) return;
  if (state.answers[state.current] || state.finalized || state.reviewMode) return;
  const selected = clean(letter).toLowerCase();
  if (!['a', 'b', 'c', 'd'].includes(selected)) return;
  state.answers[state.current] = {
    questionId: q.id,
    selected,
    correct: selected === clean(q.respuesta).toLowerCase()
  };
  state.answerHistory.push(state.current);
  renderQuestion();
}

function toggleHint() {
  state.hints[state.current] = !state.hints[state.current];
  renderQuestion();
}

function goToQuestion(index) {
  if (!Number.isFinite(index) || index < 0 || index >= state.questions.length) return;
  commitQuestionElapsed();
  state.current = index;
  state.questionEnteredAt = Date.now();
  const editor = document.getElementById('rpNotaEditor');
  if (editor) editor.style.display = 'none';
  renderQuestion();
}

async function finishPractice() {
  commitQuestionElapsed();
  state.finalized = true;
  state.reviewMode = false;
  if (!state.questions.length) return renderHome();
  const answered = countAnswered();
  if (!answered) {
    state.savedResult = {
      total: 0,
      correctas: 0,
      incorrectas: 0,
      pct: 0,
      tiempo: Math.round((Date.now() - state.startedAt) / 1000),
      error: null
    };
    stopSessionClock();
    return renderFinish(false);
  }

  if (!state.savedResult && !state.saving) {
    state.saving = true;
    renderFinish(true);
    try {
      const respuestas = Object.values(state.answers).map((item) => ({
        pregunta_id: item.questionId,
        respuesta_elegida: item.selected
      }));
      const tiempo = Math.round((Date.now() - state.startedAt) / 1000);
      state.savedResult = await submitBibliografia2026Session(sb(), {
        ...state.filters,
        tiempo,
        respuestas
      });
      toast('Resultado de bibliografía guardado.', 'ok');
    } catch (error) {
      toast('No se pudo guardar el resultado. Se muestra el resultado local.', 'warn');
      state.savedResult = {
        total: answered,
        correctas: countCorrect(),
        incorrectas: countIncorrect(),
        pct: sessionPct(),
        tiempo: Math.round((Date.now() - state.startedAt) / 1000),
        error: error?.message || 'Error al guardar'
      };
    } finally {
      state.saving = false;
    }
  }

  stopSessionClock();
  renderFinish(false);
}

function restoreOfficialFinalModal() {
  const modal = document.getElementById('modalFinal');
  const inner = document.getElementById('modalInner');
  if (!modal || !inner || modal.dataset.biblioFinal !== '1') return;
  modal.classList.remove('vis');
  if (originalFinalModalHtml !== null) inner.innerHTML = originalFinalModalHtml;
  delete modal.dataset.biblioFinal;
}

function closeBiblioFinalModal() {
  const modal = document.getElementById('modalFinal');
  if (modal) modal.classList.remove('vis');
}

function biblioPerformanceBySpecialty() {
  const groups = new Map();
  state.questions.forEach((q, i) => {
    const key = clean(q.especialidad) || 'Sin especialidad';
    if (!groups.has(key)) groups.set(key, { total: 0, resp: 0, c: 0 });
    const g = groups.get(key);
    g.total += 1;
    const ans = state.answers[i];
    if (ans) {
      g.resp += 1;
      if (ans.correct) g.c += 1;
    }
  });
  return [...groups.entries()].filter(([, d]) => d.resp > 0);
}

function renderBiblioFinalModal(result, loading = false) {
  const modal = document.getElementById('modalFinal');
  const inner = document.getElementById('modalInner');
  if (!modal || !inner) return false;
  if (originalFinalModalHtml === null) originalFinalModalHtml = inner.innerHTML;

  const pct = Number(result.pct || 0);
  const correctas = Number(result.correctas || 0);
  const incorrectas = Number(result.incorrectas || 0);
  const respondidas = Number(result.total || 0);
  const sinR = Math.max(0, state.questions.length - respondidas);
  const tiempo = Number(result.tiempo || sessionElapsedSeconds());
  const promSeg = respondidas ? Math.round(tiempo / respondidas) : 0;
  const col = pctColor(pct);
  const titulo = loading ? 'Guardando resultado...' : pct >= 90 ? '¡Excelente! 🏆' : pct >= 70 ? '¡Muy bien! ⭐' : pct >= 50 ? 'Aprobado 👍' : 'Seguí practicando 💪';
  const subtitulo = loading
    ? 'Bibliografía 2026 · guardando estadísticas propias'
    : `${correctas} correctas · ${respondidas} respondidas${sinR ? ' · ' + sinR + ' sin responder' : ''}`;
  const circ = 238.8;
  const offset = circ - (circ * pct / 100);

  const espRows = biblioPerformanceBySpecialty()
    .sort((a, b) => (b[1].c / b[1].resp) - (a[1].c / a[1].resp))
    .map(([esp, d], i) => {
      const p2 = Math.round(d.c / d.resp * 100);
      const med = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const c = pctColor(p2);
      const nota = p2 >= 90 ? 'A' : p2 >= 70 ? 'B' : p2 >= 50 ? 'C' : 'D';
      return `<div class="erow">
        <div>
          <div class="ename">${med} ${esc(esp)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:5px;">
            <div class="ebar"><div class="efill" data-w="${p2}" style="width:0%;background:${c};"></div></div>
            <span style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text3);">${d.resp}/${d.total}</span>
          </div>
        </div>
        <div class="eright">
          <span class="nbadge n${nota}">${nota}</span>
          <span class="epct" style="color:${c}">${p2}%</span>
        </div>
      </div>`;
    }).join('') || '<div class="lb-empty">No hay respuestas suficientes para desglosar por especialidad.</div>';

  modal.dataset.biblioFinal = '1';
  inner.innerHTML = `
    <div class="mresult-band" id="mresultBand" style="color:${col};border-bottom:1px solid ${col}22;background:linear-gradient(135deg, ${col}0d 0%, transparent 60%);">
      <div class="mresult-band-left">
        <div class="mresult-eyebrow">ResiAR · Resultado Bibliografía 2026</div>
        <div class="mresult-title" id="modalTitulo">${esc(titulo)}</div>
        <div class="mresult-sub" id="modalSubtitulo">${esc(subtitulo)}</div>
      </div>
      <div class="mresult-circle">
        <svg height="100" viewBox="0 0 100 100" width="100">
          <circle class="cbg" cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.08)"></circle>
          <circle class="cfg" cx="50" cy="50" id="circleArc" r="38" stroke="${col}" stroke-dasharray="238.8" stroke-dashoffset="${loading ? circ : offset}"></circle>
        </svg>
        <span id="circlePct" style="color:${col}">${loading ? '...' : `${pct}%`}</span>
      </div>
    </div>
    <div class="mresult-body">
      <div class="mcards" id="statsCards">
        <div class="mc"><div class="mc-n" style="color:var(--green)">${correctas}</div><div class="mc-l">Correctas</div></div>
        <div class="mc"><div class="mc-n" style="color:var(--red)">${incorrectas}</div><div class="mc-l">Incorrectas</div></div>
        <div class="mc"><div class="mc-n" style="color:var(--accent)">${state.questions.length || respondidas}</div><div class="mc-l">Total</div></div>
        <div class="mc"><div class="mc-n" style="color:var(--amber);font-size:1.25rem;font-family:'Space Grotesk','DM Mono',monospace;">${formatTime(promSeg)}</div><div class="mc-l">Prom/preg</div></div>
      </div>
      <div class="barsec"><div class="barhdr"><span>⏱ Tiempo utilizado</span><span id="tiempoUsado">${formatTime(tiempo)}</span></div><div class="btrk"><div class="bfill" id="tiempoBar" style="width:${loading ? 20 : 100}%;background:var(--accent);"></div></div></div>
      <div class="etitle">Rendimiento por especialidad</div>
      <div id="espStats" style="margin-bottom:16px;">${espRows}</div>
      <div class="warnb ${sinR && !loading ? 'vis' : ''}" id="warnBox"><span id="warnTxt">⚠ ${sinR} pregunta${sinR !== 1 ? 's' : ''} no respondidas — no se cuentan en el porcentaje.</span></div>
      ${result.error ? `<div class="biblio-save-warning">No se pudo guardar en servidor: ${esc(result.error)}</div>` : ''}
    </div>
    <div class="mbtns">
      <button class="mbsec" data-biblio-action="close-final-and-review">📋 Revisar</button>
      <button class="mbsec" data-biblio-action="export-pdf">📄 Generar PDF</button>
      <button class="mbprim" data-biblio-action="home">⚙️ Configurar otra práctica</button>
    </div>`;

  modal.classList.add('vis');
  setTimeout(() => {
    const arc = document.getElementById('circleArc');
    if (arc && !loading) arc.style.strokeDashoffset = String(offset);
    document.querySelectorAll('#espStats [data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
  }, 80);
  return true;
}

function exportBiblioPDF() {
  const questions = Array.isArray(state.questions) ? state.questions : [];
  if (!questions.length) {
    toast('No hay una práctica de bibliografía para exportar.', 'warn');
    return;
  }
  const result = state.savedResult || {
    total: countAnswered(),
    correctas: countCorrect(),
    incorrectas: countIncorrect(),
    pct: sessionPct(),
    tiempo: Math.round((Date.now() - state.startedAt) / 1000)
  };
  const col = (pct) => pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#e11d48';
  const fmt = (seconds) => formatTime(seconds || 0);
  const rows = questions.map((q, i) => {
    const ans = state.answers[i];
    const selected = ans?.selected || '';
    const correct = clean(q.respuesta).toLowerCase();
    const ok = selected && selected === correct;
    const icon = !selected ? '—' : ok ? '✓' : '✗';
    const iconColor = !selected ? '#64748b' : ok ? '#16a34a' : '#dc2626';
    const pregunta = String(q.pregunta || '');
    const fuente = String(q.fuente || '');
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(pregunta.slice(0, 120))}${pregunta.length > 120 ? '…' : ''}</strong><br><small>${esc(q.especialidad || '')}${q.tema ? ' · ' + esc(q.tema) : ''}${fuente ? '<br>Fuente: ' + esc(fuente.slice(0, 120)) : ''}</small></td>
      <td>${esc(selected ? selected.toUpperCase() : '—')}</td>
      <td>${esc(correct ? correct.toUpperCase() : '—')}</td>
      <td style="color:${iconColor};font-weight:800;">${icon}</td>
      <td>${esc(fmt(state.questionTimes[i] || 0))}</td>
    </tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Resultado Bibliografía 2026</title>
  <style>body{font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;color:#111827;margin:0;padding:30px}h1{font-size:24px;margin:0 0 4px}.sub{color:#64748b;font-size:13px;margin-bottom:22px}.cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 18px;min-width:110px;text-align:center}.n{font-size:28px;font-weight:800;line-height:1}.l{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-top:4px}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}th{background:#f1f5f9;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.1em;text-align:left;padding:9px}td{border-top:1px solid #e5e7eb;padding:8px 9px;font-size:12px;vertical-align:top}small{color:#64748b;line-height:1.45}@media print{body{padding:16px}}</style></head><body>
  <h1>📚 Resultado Bibliografía 2026</h1><div class="sub">Generado el ${new Date().toLocaleDateString('es-AR')} · Tiempo: ${esc(fmt(result.tiempo || 0))}</div>
  <div class="cards"><div class="card"><div class="n" style="color:#16a34a">${esc(result.correctas || 0)}</div><div class="l">Correctas</div></div><div class="card"><div class="n" style="color:#dc2626">${esc(result.incorrectas || 0)}</div><div class="l">Incorrectas</div></div><div class="card"><div class="n">${esc(questions.length)}</div><div class="l">Total</div></div><div class="card"><div class="n" style="color:${col(Number(result.pct || 0))}">${esc(result.pct || 0)}%</div><div class="l">Rendimiento</div></div></div>
  <table><thead><tr><th>#</th><th>Pregunta</th><th>Tu resp.</th><th>Correcta</th><th>Resultado</th><th>Tiempo</th></tr></thead><tbody>${rows}</tbody></table><script>window.print();<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('El navegador bloqueó la ventana del PDF. Permití ventanas emergentes para ResiAR.', 'warn'); return; }
  w.document.write(html);
  w.document.close();
}

function renderFinish(loading = false) {
  const result = state.savedResult || {
    total: countAnswered(),
    correctas: countCorrect(),
    incorrectas: countIncorrect(),
    pct: sessionPct(),
    tiempo: Math.round((Date.now() - state.startedAt) / 1000)
  };

  if (renderBiblioFinalModal(result, loading)) return;

  hideBiblioPracticeChrome();
  renderShell(`
    <div class="biblio-topbar"><button class="biblio-back" data-biblio-action="home">← Bibliografía 2026</button></div>
    <section class="biblio-finish-card">
      <div class="biblio-finish-icon">${loading ? '⏳' : '📚'}</div>
      <h2>${loading ? 'Guardando resultado...' : 'Práctica finalizada'}</h2>
      <div class="biblio-score-main" style="color:${pctColor(result.pct)}">${esc(result.pct || 0)}%</div>
      <div class="biblio-score-grid">
        <div><b>${esc(result.correctas || 0)}</b><span>Correctas</span></div>
        <div><b>${esc(result.incorrectas || 0)}</b><span>Incorrectas</span></div>
        <div><b>${esc(result.total || 0)}</b><span>Respondidas</span></div>
        <div><b>${esc(formatTime(result.tiempo || 0))}</b><span>Tiempo</span></div>
      </div>
      ${result.error ? `<div class="biblio-save-warning">No se pudo guardar en servidor: ${esc(result.error)}</div>` : ''}
      <div class="biblio-finish-actions">
        <button class="home-primary" data-biblio-action="restart">Repetir con mismos filtros</button>
        <button class="home-secondary" data-biblio-action="export-pdf">Generar PDF</button>
        <button class="home-secondary" data-biblio-action="home">Configurar otra práctica</button>
      </div>
    </section>
  `);
}


async function renderStats() {
  hideBiblioPracticeChrome();
  stopSessionClock();
  if (!(await ensureBibliografiaAccess({ renderLocked: true }))) return;
  state.view = 'stats';
  renderShell(loadingMarkup('Cargando estadísticas propias...'));
  const stats = await getBibliografia2026MyStats(sb());
  const overview = stats.overview || {};
  renderShell(`
    <div class="biblio-topbar">
      <button class="biblio-back" data-biblio-action="home">← Bibliografía 2026</button>
      <button class="home-secondary" data-biblio-action="ranking">🏆 Ranking</button>
    </div>
    <section class="biblio-stats-head">
      <div>
        <div class="home-eyebrow"><span class="home-eyebrow-dot"></span> Estadísticas propias</div>
        <h1 class="home-title biblio-stats-title"><span>Mis estadísticas para la</span><em>bibliografía 2026.</em></h1>
      </div>
      <div class="biblio-score-main" style="color:${pctColor(overview.pct_historico)}">${esc(overview.pct_historico || 0)}%</div>
    </section>
    <div class="biblio-score-grid biblio-score-grid-wide">
      <div><b>${esc(overview.sesiones || 0)}</b><span>Sesiones</span></div>
      <div><b>${esc(overview.total_preguntas || 0)}</b><span>Respondidas</span></div>
      <div><b>${esc(overview.total_correctas || 0)}</b><span>Correctas</span></div>
      <div><b>${esc(overview.mejor_pct || 0)}%</b><span>Mejor sesión</span></div>
    </div>
    <section class="biblio-stats-grid">
      ${statsListCard('Por especialidad', stats.by_especialidad)}
      ${statsListCard('Por tema', stats.by_tema)}
      ${statsListCard('Por examen relacionado', stats.by_examen)}
      ${recentSessionsCard(stats.recent_sessions)}
    </section>
  `);
}

function biblioModeLabel(mode) {
  const m = clean(mode).toLowerCase();
  if (m === 'rapida') return 'Práctica rápida';
  if (m === 'especialidad_tema') return 'Práctica dirigida';
  if (m === 'examen_relacionado') return 'Por examen relacionado';
  if (!m) return 'Sesión de práctica';
  return m.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function biblioSessionSubtitle(item = {}) {
  const parts = [item.especialidad, item.tema, item.examen_relacionado].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Bibliografía 2026';
}

function statsListCard(title, items = []) {
  const rows = Array.isArray(items) && items.length ? items.slice(0, 10).map((item) => `
    <div class="biblio-stat-row">
      <div><b>${esc(item.label || '—')}</b><span>${esc(item.correctas || 0)}/${esc(item.total || 0)} correctas</span></div>
      <strong style="color:${pctColor(item.pct)}">${esc(item.pct || 0)}%</strong>
    </div>
  `).join('') : '<div class="biblio-empty-small">Sin datos todavía.</div>';
  return `<article class="home-card biblio-stat-card"><div class="home-card-title">${esc(title)}</div>${rows}</article>`;
}

function recentSessionsCard(items = []) {
  const rows = Array.isArray(items) && items.length ? items.slice(0, 8).map((item) => `
    <div class="biblio-stat-row">
      <div><b>${esc(biblioModeLabel(item.modo))}</b><span>${esc(item.correctas || 0)}/${esc(item.total || 0)} · ${esc(biblioSessionSubtitle(item))} · ${esc(new Date(item.created_at).toLocaleDateString('es-AR'))}</span></div>
      <strong style="color:${pctColor(item.pct)}">${esc(item.pct || 0)}%</strong>
    </div>
  `).join('') : '<div class="biblio-empty-small">Sin sesiones guardadas.</div>';
  return `<article class="home-card biblio-stat-card"><div class="home-card-title">Últimas sesiones</div>${rows}</article>`;
}

async function renderRanking() {
  hideBiblioPracticeChrome();
  stopSessionClock();
  if (!(await ensureBibliografiaAccess({ renderLocked: true }))) return;
  state.view = 'ranking';
  renderShell(loadingMarkup('Cargando ranking...'));
  const data = await getBibliografia2026Ranking(sb());
  renderRankingWithData(data);
}

function setRankingFilter(filter, button) {
  state.rankingFilter = filter || 'historico';
  document.querySelectorAll('.biblio-lb-filter').forEach((el) => el.classList.remove('active'));
  if (button) button.classList.add('active');
  renderRanking();
}

function sortRanking(rows) {
  const users = rows.map((u) => ({
    user_id: u.user_id,
    username: u.username,
    sesiones: Number(u.sesiones || 0),
    totalPregs: Number(u.total_preguntas || 0),
    totalCorrects: Number(u.total_correctas || 0),
    pctHistorico: Number(u.pct_historico || 0),
    mejorPct: Number(u.mejor_pct || 0),
    mejorTotal: Number(u.mejor_total || 0),
    mejorCorrectas: Number(u.mejor_correctas || 0),
    mejorTiempo: Number(u.mejor_tiempo || 0)
  }));

  if (state.rankingFilter === 'sesiones') {
    return users.sort((a, b) => b.sesiones - a.sesiones || b.totalPregs - a.totalPregs || b.pctHistorico - a.pctHistorico);
  }
  if (state.rankingFilter === 'preguntas') {
    return users.sort((a, b) => b.totalPregs - a.totalPregs || b.totalCorrects - a.totalCorrects || b.pctHistorico - a.pctHistorico);
  }
  if (state.rankingFilter === 'mejor') {
    return users
      .filter((u) => u.mejorTotal >= 5)
      .sort((a, b) => b.mejorPct - a.mejorPct || b.mejorTotal - a.mejorTotal || a.mejorTiempo - b.mejorTiempo);
  }
  return users
    .filter((u) => u.totalPregs >= 5)
    .sort((a, b) => b.pctHistorico - a.pctHistorico || b.totalPregs - a.totalPregs || b.sesiones - a.sesiones);
}

function renderRankingWithData(data) {
  const sorted = sortRanking(Array.isArray(data) ? data : []).slice(0, 30);
  const current = currentUser();
  const subtitle = rankingSubtitle();

  renderShell(`
    <div class="biblio-topbar">
      <button class="biblio-back" data-biblio-action="home">← Bibliografía 2026</button>
      <button class="home-secondary" data-biblio-action="stats">📊 Mis estadísticas</button>
    </div>
    <section class="biblio-ranking-card">
      <div class="lb-modal-header biblio-ranking-head">
        <div class="lb-header-top">
          <div class="lb-title-group">
            <div class="lb-trophy-icon">🏆</div>
            <div><div class="lb-title">Ranking</div><div class="lb-subtitle">${esc(subtitle)}</div></div>
          </div>
        </div>
        <div class="lb-filter-row">
          ${rankingFilterButton('historico', '📊 Histórico')}
          ${rankingFilterButton('sesiones', '🗂 Sesiones')}
          ${rankingFilterButton('preguntas', '❓ Preguntas')}
          ${rankingFilterButton('mejor', '⭐ Mejor sesión')}
        </div>
      </div>
      <div class="lb-body">
        <div class="lb-col-header"><span>#</span><span>Usuario</span><span>${esc(rankingColA())}</span><span>${esc(rankingColB())}</span><span style="text-align:right">${esc(rankingColC())}</span></div>
        <div class="lb-scroll biblio-lb-scroll">
          ${sorted.length ? sorted.map((u, i) => rankingRow(u, i, current)).join('') : '<div class="lb-empty">Sin datos suficientes aún</div>'}
        </div>
      </div>
    </section>
  `);

  setTimeout(() => {
    document.querySelectorAll('.biblio-page .lb-bar-fill[data-w]').forEach((el) => {
      el.style.width = `${el.dataset.w}%`;
    });
  }, 60);
}

function rankingFilterButton(filter, label) {
  return `<button class="lb-filter biblio-lb-filter ${state.rankingFilter === filter ? 'active' : ''}" data-biblio-action="ranking-filter" data-filter="${esc(filter)}">${esc(label)}</button>`;
}

function rankingSubtitle() {
  if (state.rankingFilter === 'sesiones') return 'Ranking por cantidad de sesiones completadas en bibliografía 2026';
  if (state.rankingFilter === 'preguntas') return 'Ranking por total de preguntas respondidas en bibliografía 2026';
  if (state.rankingFilter === 'mejor') return 'Mejor sesión · ajustada por confianza estadística (mín. 5 preguntas)';
  return 'Rendimiento histórico · % correctas acumuladas (mín. 5 preguntas)';
}

function rankingColA() {
  if (state.rankingFilter === 'sesiones') return 'Sesiones';
  if (state.rankingFilter === 'preguntas') return 'Respondidas';
  if (state.rankingFilter === 'mejor') return 'Mejor sesión';
  return '% global';
}

function rankingColB() {
  if (state.rankingFilter === 'sesiones') return 'Respondidas';
  if (state.rankingFilter === 'preguntas') return 'Correctas';
  if (state.rankingFilter === 'mejor') return 'Respondidas';
  return 'Respondidas';
}

function rankingColC() {
  if (state.rankingFilter === 'sesiones') return '% global';
  if (state.rankingFilter === 'preguntas') return '% global';
  if (state.rankingFilter === 'mejor') return '% global';
  return 'Sesiones';
}

function rankingRow(u, index, current) {
  const rank = index + 1;
  const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  const topCls = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
  const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
  const isMe = u.user_id === current?.id;
  const initials = (u.username || '?').slice(0, 2).toUpperCase();
  let valA;
  let valB;
  let valC;
  let barPct;
  let barColor;

  if (state.rankingFilter === 'sesiones') {
    barPct = Math.min(100, Math.round(u.sesiones / Math.max(1, u.sesiones) * 100));
    barColor = 'var(--accent)';
    valA = `<strong style="color:var(--accent)">${esc(u.sesiones)}</strong>`;
    valB = esc(u.totalPregs.toLocaleString());
    valC = `<span style="color:${pctColor(u.pctHistorico)}">${esc(u.pctHistorico)}%</span>`;
  } else if (state.rankingFilter === 'preguntas') {
    barPct = 100;
    barColor = 'var(--accent)';
    valA = `<strong style="color:var(--accent)">${esc(u.totalPregs.toLocaleString())}</strong>`;
    valB = esc(u.totalCorrects.toLocaleString());
    valC = `<span style="color:${pctColor(u.pctHistorico)}">${esc(u.pctHistorico)}%</span>`;
  } else if (state.rankingFilter === 'mejor') {
    barPct = u.mejorPct;
    barColor = pctColor(u.mejorPct);
    valA = `<strong style="color:${pctColor(u.mejorPct)}">${esc(u.mejorPct)}%</strong><div style="font-size:0.6rem;color:var(--text3);margin-top:1px;">${esc(u.mejorCorrectas)}/${esc(u.mejorTotal)}</div>`;
    valB = esc(u.totalPregs.toLocaleString());
    valC = `<span style="color:${pctColor(u.pctHistorico)}">${esc(u.pctHistorico)}%</span>`;
  } else {
    barPct = u.pctHistorico;
    barColor = pctColor(u.pctHistorico);
    valA = `<strong style="color:${pctColor(u.pctHistorico)}">${esc(u.pctHistorico)}%</strong>`;
    valB = esc(u.totalPregs.toLocaleString());
    valC = esc(u.sesiones);
  }

  return `<div class="lb-row ${topCls} ${isMe ? 'me' : ''}">
    <div class="lb-rank ${rankCls}">${rankIcon}</div>
    <div class="lb-user-cell">
      <div class="lb-avatar">${esc(initials)}</div>
      <div class="lb-user-info">
        <div class="lb-name">${esc(u.username || '—')}${isMe ? '<span class="lb-yo-tag">yo</span>' : ''}</div>
        <div class="lb-bar-wrap"><div class="lb-bar-fill" data-w="${Number(barPct) || 0}" style="width:0%;background:${barColor};"></div></div>
      </div>
    </div>
    <div class="lb-n">${valA}</div>
    <div class="lb-n">${valB}</div>
    <div class="lb-n right">${valC}</div>
  </div>`;
}
