import { getBibliografia2026Access } from '../services/bibliografia2026Service.js';

/* ResiAR — Práctica interactiva de vacunación.
 * Fuente de datos: Supabase RPC public.get_vaccine_practice_data().
 * No usa casos hardcodeados en frontend: vacunas y casos salen de las tablas
 * public.vacunas y public.ninos a través de una función SECURITY DEFINER con control de acceso.
 */

let deps = {};
let delegationInstalled = false;
let keyboardInstalled = false;

const NO_VACCINE_CODE = '__NO_VACCINE__';
const NO_VACCINE_LABEL = 'No corresponde aplicar vacunas en esta consulta';

const state = {
  vaccines: [],
  vaccineByCode: new Map(),
  cases: [],
  deck: [],
  currentIndex: 0,
  currentOptions: [],
  selected: [],
  checked: false,
  score: 0,
  streak: 0,
  attempts: 0,
  perfectAnswers: 0,
  finished: false,
  access: null,
  accessLoadedAt: 0,
  dataLoadedAt: 0,
  dataError: '',
  hintOpen: false,
  courseProgress: { completed: {}, loadedFor: '' }
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shuffle(array) {
  const copy = Array.isArray(array) ? array.slice() : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function unique(array) {
  return Array.from(new Set((Array.isArray(array) ? array : []).filter(Boolean)));
}

function normalizeCode(value) {
  return String(value == null ? '' : value).trim().toUpperCase();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(normalizeCode).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(normalizeCode).filter(Boolean);
    } catch (_) {}
    return trimmed.split(',').map(normalizeCode).filter(Boolean);
  }
  return [];
}

function q(id) { return document.getElementById(id); }
function root() { return q('vaccinesPracticeRoot'); }
function getBox() { return typeof deps.getQuestionBox === 'function' ? deps.getQuestionBox() : q('preguntaBox'); }

function ensureVaccineProgressVisualPatch() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('resiar-vaccines-progress-v71d')) return;

  const style = document.createElement('style');
  style.id = 'resiar-vaccines-progress-v71d';
  style.textContent = `
    .vaccines-total-progress {
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 12px;
      border-radius: 24px !important;
      padding: 18px 22px !important;
      background:
        radial-gradient(circle at 10% 0%, rgba(52, 211, 153, .12), transparent 36%),
        linear-gradient(135deg, rgba(255,255,255,.82), rgba(236,253,245,.62)) !important;
      border: 1px solid rgba(16, 185, 129, .22) !important;
      box-shadow: 0 18px 52px rgba(15, 23, 42, .08), inset 0 1px rgba(255,255,255,.72) !important;
    }

    [data-theme="dark"] .vaccines-total-progress {
      background:
        radial-gradient(circle at 10% 0%, rgba(52, 211, 153, .14), transparent 36%),
        linear-gradient(135deg, rgba(15, 23, 42, .88), rgba(20, 28, 39, .72)) !important;
      border-color: rgba(52, 211, 153, .24) !important;
      box-shadow: 0 18px 52px rgba(0, 0, 0, .30), inset 0 1px rgba(255,255,255,.06) !important;
    }

    .vaccines-total-progress-head {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-end !important;
      gap: 14px !important;
    }

    .vaccines-total-progress-head span {
      display: block;
      font-family: var(--font-mono, monospace);
      letter-spacing: .18em;
      text-transform: uppercase;
      font-size: .62rem;
      font-weight: 900;
      color: var(--green, #10b981);
    }

    .vaccines-total-progress-head strong {
      display: block;
      margin-top: 3px;
      font-family: var(--font-serif, serif);
      font-size: clamp(1.5rem, 2.4vw, 2.35rem);
      line-height: .95;
      color: var(--text, #111827);
    }

    .vaccines-total-progress-head p {
      margin: 0;
      color: var(--text2, #64748b);
      font-size: .86rem;
      font-weight: 700;
      text-align: right;
    }

    .vaccines-total-progress-track {
      height: 12px !important;
      border-radius: 999px !important;
      overflow: hidden !important;
      background: rgba(148, 163, 184, .22) !important;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, .12) !important;
    }

    .vaccines-total-progress-fill {
      height: 100% !important;
      width: 0%;
      border-radius: inherit !important;
      background: linear-gradient(90deg, var(--green, #10b981), #34d399, #a78bfa) !important;
      box-shadow: 0 0 22px rgba(16, 185, 129, .34) !important;
      transition: width .42s cubic-bezier(.4,0,.2,1) !important;
    }

    .vaccines-keyboard-hint {
      font-family: var(--font-mono, monospace);
      letter-spacing: .04em;
      font-size: .72rem;
      color: var(--text2, #64748b);
    }
  `;

  document.head.appendChild(style);
}


function sb() { return typeof deps.getSupabase === 'function' ? deps.getSupabase() : window.sb; }
function currentUser() { return typeof deps.getCurrentUser === 'function' ? deps.getCurrentUser() : null; }
function currentProfile() { return typeof deps.getCurrentProfile === 'function' ? deps.getCurrentProfile() : null; }
function clean(value) { return String(value == null ? '' : value).trim(); }
function currentCase() { return state.deck[state.currentIndex] || state.cases[0] || null; }
function getVaccine(code) { return state.vaccineByCode.get(normalizeCode(code)) || null; }
function getName(code) { return getVaccine(code)?.name || normalizeCode(code); }

function normalizeTextKey(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function shouldUseCompactSubtypeLabel(vaccine) {
  const key = normalizeTextKey(vaccine?.name);
  return key === 'fiebre amarilla' || key === 'fiebre hemorragica argentina';
}

function visibleVaccineSubtype(vaccine) {
  if (!vaccine) return '';
  if (shouldUseCompactSubtypeLabel(vaccine)) return 'Atenuada';

  const vaccineKey = normalizeTextKey(vaccine?.name);
  const subtypeParts = clean(vaccine.group)
    .split(/\s*[-–—]\s*/g)
    .map((part) => clean(part))
    .filter(Boolean)
    .filter((part) => {
      const partKey = normalizeTextKey(part);
      return partKey !== 'orden medica' && partKey !== 'zona de riesgo';
    });

  let subtype = subtypeParts.join(' - ');

  if (vaccineKey === 'antirrabica') {
    subtype = subtype.replace(/\s*\(\s*virus muerto\s*\)/gi, '');
  }

  return clean(subtype);
}

function vaccineCardTags(vaccine, label) {
  if (!vaccine) return [];
  return [label, visibleVaccineSubtype(vaccine)].filter(Boolean);
}

const COURSE_STORAGE_PREFIX = 'resiar:vaccines-course:v1';

function stableValue(value) {
  const text = clean(value);
  return text || '';
}

function caseSortValue(item) {
  const explicit = Number(item?.order ?? item?.orden ?? item?.numero ?? item?.position ?? item?.secuencia);
  if (Number.isFinite(explicit)) return explicit;
  const idNumber = Number(item?.id);
  if (Number.isFinite(idNumber)) return idNumber;
  return Number.MAX_SAFE_INTEGER;
}

function compareCases(a, b) {
  const orderA = caseSortValue(a);
  const orderB = caseSortValue(b);
  if (orderA !== orderB) return orderA - orderB;
  return stableValue(a?.title).localeCompare(stableValue(b?.title), 'es', { numeric: true, sensitivity: 'base' });
}

function compareVaccinesByCalendar(a, b) {
  const va = getVaccine(a);
  const vb = getVaccine(b);
  const ia = Number.isFinite(va?.orderIndex) ? va.orderIndex : Number.MAX_SAFE_INTEGER;
  const ib = Number.isFinite(vb?.orderIndex) ? vb.orderIndex : Number.MAX_SAFE_INTEGER;
  if (ia !== ib) return ia - ib;
  return getName(a).localeCompare(getName(b), 'es', { numeric: true, sensitivity: 'base' });
}

function sortVaccineCodes(codes) {
  return unique(codes).slice().sort(compareVaccinesByCalendar);
}

function orderedCases(cases) {
  return (Array.isArray(cases) ? cases : []).slice().sort(compareCases);
}

function userStorageId() {
  const user = currentUser() || {};
  const profile = currentProfile() || {};
  return clean(user.id || profile.id || user.email || profile.email || 'anonimo');
}

function courseStorageKey() {
  return `${COURSE_STORAGE_PREFIX}:${userStorageId()}`;
}

function normalizeProgressEntry(value, fallbackId = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      ...value,
      caseId: clean(value.caseId || fallbackId),
      title: clean(value.title || `Caso ${fallbackId}`),
      completedAt: clean(value.completedAt || new Date().toISOString()),
      perfect: !!value.perfect,
      lastPerfect: !!value.lastPerfect,
      correctCount: Number(value.correctCount || 0),
      missingCount: Number(value.missingCount || 0),
      wrongCount: Number(value.wrongCount || 0)
    };
  }
  return {
    caseId: clean(fallbackId),
    title: clean(fallbackId ? `Caso ${fallbackId}` : 'Caso completado'),
    completedAt: new Date().toISOString(),
    perfect: false,
    lastPerfect: false,
    correctCount: 0,
    missingCount: 0,
    wrongCount: 0
  };
}

function normalizeCompletedMap(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([id, entry]) => [clean(id), normalizeProgressEntry(entry, id)])
      .filter(([id]) => !!id)
  );
}

function normalizeCourseProgress(raw) {
  const legacyCompleted = normalizeCompletedMap(raw?.completed);
  const cycleCompleted = normalizeCompletedMap(raw?.cycle?.completed);
  const cycle = raw?.cycle && typeof raw.cycle === 'object' && !Array.isArray(raw.cycle)
    ? {
        id: clean(raw.cycle.id || `cycle-${Date.now()}`),
        startedAt: clean(raw.cycle.startedAt || new Date().toISOString()),
        completedAt: clean(raw.cycle.completedAt || ''),
        currentCaseId: clean(raw.cycle.currentCaseId || ''),
        order: unique(Array.isArray(raw.cycle.order) ? raw.cycle.order.map(clean).filter(Boolean) : []),
        completed: cycleCompleted
      }
    : null;
  const allTime = normalizeCompletedMap(raw?.allTime || legacyCompleted);
  const cyclesCompleted = Math.max(0, Number(raw?.cyclesCompleted || 0) || 0);

  return {
    version: 2,
    completed: cycle ? cycle.completed : legacyCompleted,
    allTime,
    cycle,
    cyclesCompleted,
    loadedFor: courseStorageKey()
  };
}

function loadCourseProgress() {
  const key = courseStorageKey();
  if (state.courseProgress?.loadedFor === key) return state.courseProgress;
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(key) || '{}');
    state.courseProgress = normalizeCourseProgress(parsed);
  } catch (_) {
    state.courseProgress = normalizeCourseProgress({});
  }
  return state.courseProgress;
}

function saveCourseProgress() {
  try {
    state.courseProgress.loadedFor = courseStorageKey();
    window.localStorage?.setItem(courseStorageKey(), JSON.stringify({
      version: 2,
      completed: state.courseProgress.completed || {},
      allTime: state.courseProgress.allTime || {},
      cycle: state.courseProgress.cycle || null,
      cyclesCompleted: Number(state.courseProgress.cyclesCompleted || 0)
    }));
  } catch (_) {}
}

function caseProgressId(item) {
  return clean(item?.id || item?.title || item?.text).slice(0, 160);
}

function courseCaseIds() {
  return unique(orderedCases(state.cases).map(caseProgressId).filter(Boolean));
}

function caseByProgressId() {
  const map = new Map();
  orderedCases(state.cases).forEach((item) => {
    const id = caseProgressId(item);
    if (id && !map.has(id)) map.set(id, item);
  });
  return map;
}

function createCourseCycle(seedCompleted = {}) {
  const ids = courseCaseIds();
  const valid = new Set(ids);
  const completed = {};
  Object.entries(normalizeCompletedMap(seedCompleted)).forEach(([id, entry]) => {
    if (valid.has(id)) completed[id] = entry;
  });
  const pendingIds = shuffle(ids.filter((id) => !completed[id]));
  const completedIds = shuffle(ids.filter((id) => completed[id]));
  return {
    id: `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    completedAt: '',
    currentCaseId: pendingIds[0] || completedIds[0] || '',
    order: [...pendingIds, ...completedIds],
    completed
  };
}

function isCourseCycleComplete(cycle = state.courseProgress?.cycle) {
  const ids = courseCaseIds();
  if (!ids.length || !cycle) return false;
  return ids.every((id) => !!cycle.completed?.[id]);
}

function ensureCourseCycle(options = {}) {
  loadCourseProgress();
  const ids = courseCaseIds();
  const valid = new Set(ids);
  if (!ids.length) return null;

  let cycle = state.courseProgress.cycle;
  if (!cycle) {
    cycle = createCourseCycle(state.courseProgress.completed || {});
  }

  const completed = {};
  Object.entries(normalizeCompletedMap(cycle.completed)).forEach(([id, entry]) => {
    if (valid.has(id)) completed[id] = entry;
  });

  const savedOrder = unique(Array.isArray(cycle.order) ? cycle.order.map(clean).filter((id) => valid.has(id)) : []);
  const missingIds = ids.filter((id) => !savedOrder.includes(id));
  cycle = {
    id: clean(cycle.id || `cycle-${Date.now()}`),
    startedAt: clean(cycle.startedAt || new Date().toISOString()),
    completedAt: clean(cycle.completedAt || ''),
    currentCaseId: clean(cycle.currentCaseId || ''),
    order: [...savedOrder, ...shuffle(missingIds)],
    completed
  };

  state.courseProgress.cycle = cycle;
  state.courseProgress.completed = cycle.completed;
  if (!state.courseProgress.allTime || typeof state.courseProgress.allTime !== 'object') state.courseProgress.allTime = {};

  if (options.restartIfComplete && isCourseCycleComplete(cycle)) {
    cycle = createCourseCycle({});
    state.courseProgress.cycle = cycle;
    state.courseProgress.completed = cycle.completed;
  }

  saveCourseProgress();
  return state.courseProgress.cycle;
}

function deckFromCycle(cycle) {
  const byId = caseByProgressId();
  const orderedIds = unique(Array.isArray(cycle?.order) ? cycle.order : []);
  const deck = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const already = new Set(deck.map(caseProgressId));
  orderedCases(state.cases).forEach((item) => {
    const id = caseProgressId(item);
    if (id && !already.has(id)) deck.push(item);
  });
  return deck;
}

function isCaseCompleted(item) {
  const id = caseProgressId(item);
  if (!id) return false;
  const cycle = ensureCourseCycle();
  return !!cycle?.completed?.[id];
}

function courseStats() {
  const cycle = ensureCourseCycle();
  const ids = courseCaseIds();
  const completedMap = cycle?.completed || {};
  const completed = ids.filter((id) => !!completedMap[id]);
  const perfect = completed.filter((id) => !!completedMap[id]?.perfect);
  const total = ids.length;
  const percent = total ? Math.round((completed.length / total) * 100) : 0;
  return {
    total,
    completed: completed.length,
    pending: Math.max(0, total - completed.length),
    perfect: perfect.length,
    percent,
    cyclesCompleted: Number(state.courseProgress.cyclesCompleted || 0),
    recent: completed
      .map((id) => completedMap[id])
      .filter(Boolean)
      .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')))
      .slice(0, 5)
  };
}

function firstIncompleteIndex(deck) {
  const list = Array.isArray(deck) ? deck : [];
  const cycle = ensureCourseCycle();
  const completed = cycle?.completed || {};
  const index = list.findIndex((item) => !completed[caseProgressId(item)]);
  return index >= 0 ? index : 0;
}

function incompleteCaseIndices(deck = state.deck, cycle = ensureCourseCycle()) {
  const list = Array.isArray(deck) ? deck : [];
  const completed = cycle?.completed || {};
  return list
    .map((item, index) => ({ item, index, id: caseProgressId(item) }))
    .filter(({ id }) => !!id && !completed[id])
    .map(({ index }) => index);
}

function indexForSavedCurrentCase(deck = state.deck, cycle = ensureCourseCycle()) {
  const savedId = clean(cycle?.currentCaseId || '');
  if (!savedId) return -1;
  return (Array.isArray(deck) ? deck : []).findIndex((item) => caseProgressId(item) === savedId);
}

function firstActiveCourseIndex(deck = state.deck, cycle = ensureCourseCycle()) {
  const savedIndex = indexForSavedCurrentCase(deck, cycle);
  if (savedIndex >= 0 && !cycle?.completed?.[caseProgressId(deck[savedIndex])]) return savedIndex;
  return firstIncompleteIndex(deck);
}

function saveCurrentCaseCursor() {
  const cycle = ensureCourseCycle();
  const item = currentCase();
  const id = caseProgressId(item);
  if (!cycle || !id) return;
  cycle.currentCaseId = id;
  saveCourseProgress();
}

function nextIncompleteIndex(fromIndex = state.currentIndex, direction = 1) {
  const cycle = ensureCourseCycle();
  const pending = incompleteCaseIndices(state.deck, cycle);
  if (!pending.length) return -1;
  if (pending.length === 1) return pending[0];
  const dir = direction < 0 ? -1 : 1;
  const list = Array.isArray(state.deck) ? state.deck : [];
  for (let step = 1; step <= list.length; step += 1) {
    const index = (fromIndex + dir * step + list.length) % list.length;
    if (pending.includes(index)) return index;
  }
  return pending[0];
}

function moveToCaseIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.deck.length) return false;
  state.currentIndex = index;
  saveCurrentCaseCursor();
  setupCase();
  paint();
  scrollCourseTop();
  return true;
}

function finalizeCourseCycleIfComplete(cycle) {
  if (!cycle || !isCourseCycleComplete(cycle) || cycle.completedAt) return;
  cycle.completedAt = new Date().toISOString();
  state.courseProgress.cyclesCompleted = Number(state.courseProgress.cyclesCompleted || 0) + 1;
}

function markCaseCompleted(item, result = {}) {
  const id = caseProgressId(item);
  if (!id) return;
  const cycle = ensureCourseCycle();
  if (!cycle) return;
  const previous = cycle.completed?.[id] || {};
  const entry = {
    caseId: id,
    title: clean(item?.title || `Caso ${id}`),
    completedAt: new Date().toISOString(),
    perfect: !!result.perfect || !!previous.perfect,
    lastPerfect: !!result.perfect,
    correctCount: Number(result.correctCount || 0),
    missingCount: Number(result.missingCount || 0),
    wrongCount: Number(result.wrongCount || 0)
  };
  cycle.completed[id] = entry;
  state.courseProgress.completed = cycle.completed;
  const allTimePrevious = state.courseProgress.allTime?.[id] || {};
  state.courseProgress.allTime[id] = {
    ...entry,
    timesCompleted: Number(allTimePrevious.timesCompleted || 0) + 1,
    perfectCount: Number(allTimePrevious.perfectCount || 0) + (result.perfect ? 1 : 0),
    bestPerfect: !!result.perfect || !!allTimePrevious.bestPerfect
  };
  finalizeCourseCycleIfComplete(cycle);
  saveCourseProgress();
}

function resetCourseProgress() {
  state.courseProgress = {
    version: 2,
    completed: {},
    allTime: {},
    cycle: null,
    cyclesCompleted: 0,
    loadedFor: courseStorageKey()
  };
  ensureCourseCycle({ restartIfComplete: true });
  saveCourseProgress();
}

function notify(message) {
  if (typeof deps.mostrarToast === 'function') deps.mostrarToast(message);
  else if (typeof window.mostrarToast === 'function') window.mostrarToast(message);
}

function markView(kind) {
  try {
    if (typeof deps.markViewState === 'function') deps.markViewState(kind);
    else if (typeof window.resiarMarkViewState === 'function') window.resiarMarkViewState(kind);
  } catch (_) {}
}

function hideAppChrome() {
  try { if (typeof deps.hideExamChrome === 'function') deps.hideExamChrome(); } catch (_) {}
  try { if (typeof window.resiarHomeHideExamChrome === 'function') window.resiarHomeHideExamChrome(); } catch (_) {}
  try { document.getElementById('rightPanel')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('statsBox')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('navBox')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('rachaBox')?.classList.remove('vis'); } catch (_) {}
  try { document.getElementById('rachaPill')?.classList.remove('vis'); } catch (_) {}
  try { if (typeof window.resiarDisableQuestionChat === 'function') window.resiarDisableQuestionChat(); } catch (_) {}
  try { if (typeof window.resiarSetWhatsAppVisible === 'function') window.resiarSetWhatsAppVisible(false); } catch (_) {}
  try { window._resiarExamRunning = false; window._resiarExamFinished = true; } catch (_) {}
}

function normalizeVaccine(row) {
  const code = normalizeCode(row?.codigo || row?.code || row?.id);
  if (!code) return null;
  const group = clean(row?.grupo || row?.tipo_vacuna || (row?.solo_zona_riesgo ? 'Zona de riesgo' : 'Calendario'));
  return {
    id: code,
    code,
    name: clean(row?.nombre || row?.name || code),
    group: group || 'Calendario',
    description: clean(row?.descripcion),
    diseases: clean(row?.enfermedades_que_previene),
    riskOnly: !!row?.solo_zona_riesgo,
    prescription: !!row?.requiere_orden_medica
  };
}

function normalizeCase(row) {
  const expectedRaw = unique(normalizeArray(row?.vacunas_correctas));
  const noVaccine =
    expectedRaw.includes(NO_VACCINE_CODE) ||
    expectedRaw.includes('NO_VACUNAR');
  const expected = noVaccine
    ? [NO_VACCINE_CODE]
    : expectedRaw;
  const explicitWrong = unique(normalizeArray(row?.vacunas_incorrectas)).filter((code) => !expected.includes(code));
  const previous = unique(normalizeArray(row?.vacunas_previas)).filter((code) => state.vaccineByCode.has(code));
  return {
    id: row?.id,
    order: row?.orden ?? row?.numero ?? row?.position ?? row?.secuencia ?? row?.id,
    title: clean(row?.nombre || `Caso ${row?.id || ''}`) || 'Caso clínico',
    text: clean(row?.caso_clinico || row?.motivo_consulta || row?.visita_motivo || 'Seleccioná las vacunas correspondientes.'),
    visit: clean(row?.visita_motivo || row?.motivo_consulta),
    category: clean(row?.categoria),
    difficulty: clean(row?.dificultad),
    expected: expected.filter((code) => state.vaccineByCode.has(code)),
    distractors: explicitWrong.filter((code) => state.vaccineByCode.has(code)),
    previous,
    explanation: clean(row?.explicacion),
    noVaccine,
    sourceCode: clean(row?.fuente_principal_codigo),
    validationState: clean(row?.estado_validacion),
    zoneRisk: !!row?.zona_riesgo,
    premature: !!row?.es_prematuro,
    condition: clean(row?.condicion_especial)
  };
}

function setDataset(payload) {
  const vaccines = (Array.isArray(payload?.vaccines) ? payload.vaccines : [])
    .map(normalizeVaccine)
    .filter(Boolean)
    .map((vaccine, index) => ({ ...vaccine, orderIndex: index }));

  const map = new Map();
  vaccines.forEach((vaccine) => map.set(vaccine.code, vaccine));
  map.set(NO_VACCINE_CODE, {
    id: NO_VACCINE_CODE,
    code: NO_VACCINE_CODE,
    name: NO_VACCINE_LABEL,
    group: 'Conducta',
    description: 'Seleccionar cuando no corresponde aplicar vacunas durante esta consulta.',
    diseases: '',
    riskOnly: false,
    prescription: false,
    special: true
  });
  state.vaccines = vaccines;
  state.vaccineByCode = map;

  state.cases = orderedCases((Array.isArray(payload?.cases) ? payload.cases : [])
    .map(normalizeCase)
    .filter((item) => item && (item.expected.length > 0 || item.noVaccine)));

  state.dataLoadedAt = Date.now();
  state.dataError = '';
}

async function loadVaccinePracticeData(force = false) {
  if (!force && state.vaccines.length && state.cases.length && Date.now() - state.dataLoadedAt < 5 * 60 * 1000) {
    return true;
  }

  const client = sb();
  if (!client || typeof client.rpc !== 'function') throw new Error('No se encontró la conexión de datos.');

  const { data, error } = await client.rpc('get_vaccine_practice_data');
  if (error) throw error;

  if (!data || data.allowed === false) {
    state.access = { ...(state.access || {}), allowed: false, source: 'vaccine-rpc' };
    renderVaccinesAccessLocked(state.access);
    return false;
  }

  setDataset(data);

  if (!state.vaccines.length) throw new Error('No hay vacunas cargadas para la práctica.');
  if (!state.cases.length) throw new Error('No hay casos de vacunación utilizables para la práctica.');

  return true;
}

function setupCase() {
  const item = currentCase();
  state.selected = [];
  state.checked = false;
  state.finished = false;
  state.hintOpen = false;

  if (!item) {
    state.currentOptions = [];
    return;
  }

  saveCurrentCaseCursor();

  const expected = unique(item.expected).filter((code) => state.vaccineByCode.has(code));
  let distractors = unique(item.distractors).filter((code) => state.vaccineByCode.has(code) && !expected.includes(code));

  if (!distractors.length) {
    distractors = state.vaccines
      .map((vaccine) => vaccine.code)
      .filter((code) => !expected.includes(code));
  }

  // En casos de no vacunación, la opción especial es la respuesta correcta.
  // En casos comunes no se agrega como distractor para evitar confundir la mecánica base.
  state.currentOptions = sortVaccineCodes([...expected, ...distractors]);
}

function startPractice(resetScore = true) {
  const cycle = ensureCourseCycle({ restartIfComplete: true });
  state.deck = deckFromCycle(cycle);
  state.currentIndex = firstActiveCourseIndex(state.deck, cycle);
  state.finished = false;

  if (resetScore) {
    state.score = 0;
    state.streak = 0;
    state.attempts = 0;
    state.perfectAnswers = 0;
  }

  setupCase();
  paint();
}

function renderLoadingShell() {
  return `
    <div id="welcome" class="home-sim vaccines-practice-page vaccines-loading-page">
      <div class="vaccines-shell" id="vaccinesPracticeRoot">
        <section class="vaccines-hero vaccines-loading-card">
          <div class="vaccines-hero-copy">
            <div class="vaccines-eyebrow"><span></span> Datos clínicos</div>
            <h1 class="vaccines-title"><span>Cargando práctica</span><em>de vacunación.</em></h1>
            <p class="vaccines-sub">Cargando vacunas y casos clínicos del calendario.</p>
          </div>
        </section>
      </div>
    </div>`;
}

function renderDataError(error) {
  hideAppChrome();
  markView('vaccines-practice');
  const box = getBox();
  if (!box) return;
  box.innerHTML = `
    <div id="welcome" class="home-sim vaccines-practice-page vaccines-access-page">
      <section class="biblio-access-card vaccines-access-card">
        <div class="biblio-lock-orb" aria-hidden="true">💉</div>
        <div class="biblio-access-copy">
          <div class="home-eyebrow"><span class="home-eyebrow-dot"></span> Datos no disponibles</div>
          <h1 class="home-title"><span>No se pudo cargar la práctica de vacunas</span></h1>
          <p class="home-sub">No pudimos cargar los casos y vacunas de la práctica.</p>
          <div class="biblio-access-note">${esc(error?.message || error || 'Error desconocido.')}</div>
          <div class="biblio-access-actions">
            <button type="button" class="home-secondary" data-vaccine-action="reload-data">↻ Reintentar carga</button>
            <button type="button" class="home-secondary" data-vaccine-action="home">← Volver al configurador</button>
          </div>
        </div>
      </section>
    </div>`;
  try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}
}

function renderShell() {
  ensureVaccineProgressVisualPatch();
  const totalCases = state.cases.length;
  const totalVaccines = state.vaccines.length;
  return `
    <div id="welcome" class="home-sim vaccines-practice-page">
      <div class="vaccines-shell" id="vaccinesPracticeRoot">
        <section class="vaccines-hero">
          <div class="vaccines-hero-copy">
            <div class="vaccines-eyebrow"><span></span> Curso interactivo</div>
            <h1 class="vaccines-title"><span>Curso interactivo</span><em>de vacunación.</em></h1>
            <p class="vaccines-sub">Resolvé los casos en el orden que quieras; los completados no vuelven a aparecer hasta cerrar el curso al 100%.</p>
            <div class="vaccines-actions-top">
              <button type="button" class="vaccines-primary" data-vaccine-action="restart">Continuar curso</button>
              <button type="button" class="vaccines-secondary" data-vaccine-action="reset-course">Reiniciar curso</button>
              <button type="button" class="vaccines-secondary" data-vaccine-action="home">Volver al configurador</button>
            </div>
          </div>

          <aside class="vaccines-stats">
            <div class="vaccines-stat-grid">
              <div class="vaccines-stat"><strong data-vaccine-slot="courseCompleted">0</strong><span>Completados</span></div>
              <div class="vaccines-stat"><strong data-vaccine-slot="coursePending">0</strong><span>Pendientes</span></div>
              <div class="vaccines-stat"><strong data-vaccine-slot="accuracy">0%</strong><span>Precisión</span></div>
            </div>
            <div class="vaccines-progress-wrap">
              <div class="vaccines-progress-info"><span data-vaccine-slot="counter">Caso 1 de ${esc(totalCases)}</span><span data-vaccine-slot="progressLabel">0%</span></div>
              <div class="vaccines-progress"><div class="vaccines-progress-fill" data-vaccine-slot="progressFill"></div></div>
            </div>
            <div class="vaccines-course-log" data-vaccine-slot="courseLog"></div>
            <div class="vaccines-source-pill">${esc(totalCases)} casos · ${esc(totalVaccines)} vacunas</div>
          </aside>
        </section>

        <section class="vaccines-total-progress" aria-label="Progreso total del curso">
          <div class="vaccines-total-progress-head">
            <div>
              <span>Progreso total</span>
              <strong data-vaccine-slot="totalProgressLabel">0%</strong>
            </div>
            <p data-vaccine-slot="totalProgressText">0 de ${esc(totalCases)} casos completados</p>
          </div>
          <div class="vaccines-total-progress-track" aria-hidden="true">
            <div class="vaccines-total-progress-fill" data-vaccine-slot="totalProgressFill"></div>
          </div>
          <div class="vaccines-keyboard-hint">Usá ← / → para cambiar de caso.</div>
        </section>

        <section class="vaccines-case-card vaccines-case-card-clean">
          <div class="vaccines-case-content">
            <span class="vaccines-case-kicker" data-vaccine-slot="caseKicker">Caso actual</span>
            <div class="vaccines-case-age" data-vaccine-slot="age">—</div>
            <div class="vaccines-case-narrative" data-vaccine-slot="caseNarrative">
              <p>Seleccioná las vacunas correspondientes.</p>
            </div>
          </div>
        </section>

        <button type="button" class="vaccines-floating-hint" data-vaccine-action="toggle-hint" aria-expanded="false" aria-controls="vaccinesHintPanel">
          <span aria-hidden="true">?</span>
          <b>Pista</b>
        </button>
        <div class="vaccines-floating-hint-panel" id="vaccinesHintPanel" data-vaccine-slot="hintPanel" hidden></div>

        <section class="vaccines-board">
          <article class="vaccines-panel">
            <div class="vaccines-panel-header">
              <div><h2>Vacunas disponibles</h2><p>Tocá una ficha para agregarla a tu respuesta.</p></div>
              <span class="vaccines-mini-count" data-vaccine-slot="availableCount">0 opciones</span>
            </div>
            <div class="vaccines-pool" data-vaccine-slot="pool"></div>
          </article>

          <article class="vaccines-panel">
            <div class="vaccines-panel-header">
              <div><h2>Tu respuesta</h2><p>Agregá las vacunas que correspondan al caso.</p></div>
              <span class="vaccines-mini-count" data-vaccine-slot="selectedCount">0 seleccionadas</span>
            </div>

            <div class="vaccines-drop-zone" data-vaccine-slot="dropZone">
              <div class="vaccines-answer-grid" data-vaccine-slot="answer"></div>
            </div>

            <div class="vaccines-action-row">
              <button type="button" class="vaccines-btn vaccines-btn-primary" data-vaccine-action="verify">Verificar</button>
              <button type="button" class="vaccines-btn vaccines-btn-secondary" data-vaccine-action="retry">Reintentar</button>
              <button type="button" class="vaccines-btn vaccines-btn-secondary" data-vaccine-action="next">Siguiente</button>
            </div>
          </article>
        </section>

        <section class="vaccines-result" data-vaccine-slot="result"></section>
        <section class="vaccines-finish" data-vaccine-slot="finish"></section>
      </div>
    </div>`;
}

function slots() {
  const r = root();
  if (!r) return {};
  return {
    score: r.querySelector('[data-vaccine-slot="score"]'),
    streak: r.querySelector('[data-vaccine-slot="streak"]'),
    courseCompleted: r.querySelector('[data-vaccine-slot="courseCompleted"]'),
    coursePending: r.querySelector('[data-vaccine-slot="coursePending"]'),
    accuracy: r.querySelector('[data-vaccine-slot="accuracy"]'),
    counter: r.querySelector('[data-vaccine-slot="counter"]'),
    progressLabel: r.querySelector('[data-vaccine-slot="progressLabel"]'),
    progressFill: r.querySelector('[data-vaccine-slot="progressFill"]'),
    totalProgressLabel: r.querySelector('[data-vaccine-slot="totalProgressLabel"]'),
    totalProgressText: r.querySelector('[data-vaccine-slot="totalProgressText"]'),
    totalProgressFill: r.querySelector('[data-vaccine-slot="totalProgressFill"]'),
    caseKicker: r.querySelector('[data-vaccine-slot="caseKicker"]'),
    age: r.querySelector('[data-vaccine-slot="age"]'),
    text: r.querySelector('[data-vaccine-slot="text"]'),
    caseNarrative: r.querySelector('[data-vaccine-slot="caseNarrative"]'),
    details: r.querySelector('[data-vaccine-slot="details"]'),
    expectedCount: r.querySelector('[data-vaccine-slot="expectedCount"]'),
    selectedCount: r.querySelector('[data-vaccine-slot="selectedCount"]'),
    hintPanel: r.querySelector('[data-vaccine-slot="hintPanel"]'),
    courseLog: r.querySelector('[data-vaccine-slot="courseLog"]'),
    hintButton: r.querySelector('[data-vaccine-action="toggle-hint"]'),
    availableCount: r.querySelector('[data-vaccine-slot="availableCount"]'),
    pool: r.querySelector('[data-vaccine-slot="pool"]'),
    answer: r.querySelector('[data-vaccine-slot="answer"]'),
    dropZone: r.querySelector('[data-vaccine-slot="dropZone"]'),
    verifyButton: r.querySelector('[data-vaccine-action="verify"]'),
    retryButton: r.querySelector('[data-vaccine-action="retry"]'),
    nextButton: r.querySelector('[data-vaccine-action="next"]'),
    result: r.querySelector('[data-vaccine-slot="result"]'),
    finish: r.querySelector('[data-vaccine-slot="finish"]')
  };
}

function vaccineCardHtml(code, origin) {
  const vaccine = getVaccine(code);
  if (!vaccine) return '';
  const id = vaccine.code;
  const isSelected = state.selected.includes(id);
  const item = currentCase();
  let cls = vaccine?.special ? 'vaccines-card vaccines-card-no-vaccine' : 'vaccines-card';
  let label = origin === 'answer' ? 'Seleccionada' : origin === 'missing' ? 'Faltó' : '';

  if (origin === 'pool' && isSelected) cls += ' is-disabled';
  if (origin === 'answer') {
    if (state.checked) cls += (item?.expected || []).includes(id) ? ' is-correct' : ' is-wrong';
    else cls += ' is-selected';
  }
  if (origin === 'missing') cls += ' is-missing';

  const tags = vaccineCardTags(vaccine, label);

  return `
    <button type="button" class="${cls}" data-vaccine-action="${origin === 'answer' ? 'remove' : 'add'}" data-id="${esc(id)}" draggable="${origin !== 'missing'}">
      <span class="vaccines-card-name">${esc(vaccine.name)}</span>
      <span class="vaccines-card-tag">${esc(tags.join(' · '))}</span>
    </button>`;
}

function renderPool(s) {
  if (!s.pool) return;
  s.pool.innerHTML = state.currentOptions.map((code) => vaccineCardHtml(code, 'pool')).join('');
}

function renderAnswer(s) {
  if (!s.answer) return;
  if (!state.selected.length) {
    const item = currentCase();
    s.answer.innerHTML = `
      <div class="vaccines-empty-answer">
        <div><strong>${item?.noVaccine ? 'Elegí la conducta correcta' : 'Agregá las vacunas acá'}</strong><span>${item?.noVaccine ? 'Puede corresponder no aplicar vacunas en esta consulta.' : 'Tocá una ficha disponible para sumarla a tu respuesta.'}</span></div>
      </div>`;
    return;
  }

  const item = currentCase();
  const missing = state.checked ? (item?.expected || []).filter((code) => !state.selected.includes(code)) : [];
  s.answer.innerHTML = [
    ...state.selected.map((code) => vaccineCardHtml(code, 'answer')),
    ...missing.map((code) => vaccineCardHtml(code, 'missing').replace('data-vaccine-action="add"', 'data-vaccine-action="none"'))
  ].join('');
}

function renderResult(s, correct, missing, wrong, perfect) {
  if (!s.result) return;
  const item = currentCase();
  const explanationBlocks = [];
  if (item?.explanation) {
    explanationBlocks.push(`<div class="vaccines-explanation"><b>Explicación</b><p>${esc(item.explanation)}</p></div>`);
  }

  if (!explanationBlocks.length) {
    s.result.innerHTML = '';
    s.result.classList.remove('show', 'vaccines-result-explanation-only');
    return;
  }

  s.result.innerHTML = explanationBlocks.join('');
  s.result.classList.add('show', 'vaccines-result-explanation-only');
}

function renderCaseNarrative(item) {
  if (!item) return '<p>Seleccioná las vacunas correspondientes.</p>';
  const paragraphs = [];
  if (item.text) paragraphs.push(item.text);

  // Mantener esta sección clínica y limpia: no chips, no fuente, no dificultad,
  // no categoría y sin volver a mostrar "Motivo de consulta" como línea separada.

  return paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p>${esc(paragraph)}</p>`)
    .join('');
}

function renderHintPanel(item) {
  if (!item) return '';
  const expectedCount = item.noVaccine ? 0 : (item.expected || []).length;
  const sentence = item.noVaccine
    ? 'No se esperan vacunas para esta consulta.'
    : expectedCount === 1
      ? 'Se espera 1 vacuna para este caso.'
      : `Se esperan ${expectedCount} vacunas para este caso.`;
  return `
    <div class="vaccines-floating-hint-title">Pista</div>
    <p>${esc(sentence)}</p>`;
}

function renderCourseLog(s, stats) {
  if (!s.courseLog) return;
  const recent = Array.isArray(stats.recent) ? stats.recent : [];
  const list = recent.length
    ? recent.map((entry) => `<li><span>${esc(entry.title || 'Caso completado')}</span><b>${entry.perfect ? 'Perfecto' : 'Completado'}</b></li>`).join('')
    : '<li class="is-empty"><span>Aún no hay casos completados.</span><b>0%</b></li>';
  s.courseLog.innerHTML = `
    <div class="vaccines-course-log-head"><span>Registro del curso</span><strong>${esc(stats.completed)}/${esc(stats.total)}</strong></div>
    <ul>${list}</ul>`;
}

function renderDetails(item) {
  if (!item) return '';
  const parts = [];
  if (item.visit) parts.push(`<span>${esc(item.visit)}</span>`);
  if (item.category) parts.push(`<span>${esc(item.category)}</span>`);
  if (item.difficulty) parts.push(`<span>${esc(item.difficulty)}</span>`);
  if (item.zoneRisk) parts.push('<span>zona de riesgo</span>');
  if (item.premature) parts.push('<span>prematuro</span>');
  if (item.condition) parts.push(`<span>${esc(item.condition)}</span>`);
  if (item.previous?.length) parts.push(`<span>Previas: ${esc(item.previous.map(getName).join(', '))}</span>`);
  if (item.noVaccine) parts.push('<span>conducta: no vacunar</span>');
  if (item.sourceCode) parts.push(`<span>${esc(item.sourceCode)}</span>`);
  return parts.join('');
}

function paint() {
  const r = root();
  if (!r) return;
  const s = slots();
  const item = currentCase();
  if (!item) return;
  const stats = courseStats();
  const accuracy = state.attempts === 0 ? '0%' : `${Math.round((state.perfectAnswers / state.attempts) * 100)}%`;
  const currentCompleted = isCaseCompleted(item);
  r.classList.toggle('is-reviewing', state.checked && !state.finished);
  r.classList.toggle('is-finished', state.finished);

  if (s.score) s.score.textContent = String(state.score);
  if (s.streak) s.streak.textContent = String(state.streak);
  if (s.courseCompleted) s.courseCompleted.textContent = String(stats.completed);
  if (s.coursePending) s.coursePending.textContent = String(stats.pending);
  if (s.accuracy) s.accuracy.textContent = accuracy;
  if (s.counter) s.counter.textContent = `Caso ${state.currentIndex + 1} de ${state.deck.length || state.cases.length}`;
  if (s.progressLabel) s.progressLabel.textContent = `${stats.percent}%`;
  if (s.progressFill) s.progressFill.style.width = `${stats.percent}%`;
  if (s.totalProgressLabel) s.totalProgressLabel.textContent = `${stats.percent}%`;
  if (s.totalProgressText) s.totalProgressText.textContent = `${stats.completed} de ${stats.total} casos completados`;
  if (s.totalProgressFill) s.totalProgressFill.style.width = `${stats.percent}%`;
  if (s.caseKicker) s.caseKicker.textContent = `Caso ${item.id || state.currentIndex + 1}${currentCompleted ? ' · Completado' : ''}`;
  renderCourseLog(s, stats);
  if (s.age) s.age.textContent = item.title;
  if (s.text) s.text.textContent = item.text;
  if (s.caseNarrative) s.caseNarrative.innerHTML = renderCaseNarrative(item);
  if (s.details) s.details.innerHTML = '';
  if (s.expectedCount) s.expectedCount.textContent = '';
  if (s.selectedCount) s.selectedCount.textContent = `${state.selected.length} seleccionada${state.selected.length === 1 ? '' : 's'}`;
  if (s.availableCount) s.availableCount.textContent = `${state.currentOptions.length} opciones`;
  if (s.verifyButton) s.verifyButton.disabled = state.checked;
  if (s.retryButton) s.retryButton.disabled = !state.checked;
  if (s.nextButton) s.nextButton.disabled = false;
  const hintAvailable = !state.checked && !state.finished;
  if (!hintAvailable && state.hintOpen) state.hintOpen = false;
  if (s.hintPanel) {
    const showHintPanel = hintAvailable && state.hintOpen;
    s.hintPanel.innerHTML = hintAvailable ? renderHintPanel(item) : '';
    s.hintPanel.hidden = !showHintPanel;
    s.hintPanel.style.display = showHintPanel ? '' : 'none';
    s.hintPanel.classList.toggle('show', showHintPanel);
  }
  if (s.hintButton) {
    s.hintButton.hidden = !hintAvailable;
    s.hintButton.style.display = hintAvailable ? '' : 'none';
    s.hintButton.disabled = !hintAvailable;
    s.hintButton.setAttribute('aria-hidden', hintAvailable ? 'false' : 'true');
    s.hintButton.setAttribute('aria-expanded', hintAvailable && state.hintOpen ? 'true' : 'false');
    s.hintButton.classList.toggle('is-open', hintAvailable && state.hintOpen);
  }

  if (s.result && !state.checked) {
    s.result.classList.remove('show', 'vaccines-result-explanation-only');
    s.result.innerHTML = '';
  }
  if (s.finish && !state.finished) {
    s.finish.classList.remove('show');
    s.finish.innerHTML = '';
  }

  renderPool(s);
  renderAnswer(s);
  installDragHooks();
}

function installDragHooks() {
  const r = root();
  if (!r) return;
  r.querySelectorAll('.vaccines-card[draggable="true"]').forEach((card) => {
    if (card.__vaccinesDragReady) return;
    card.__vaccinesDragReady = true;
    card.addEventListener('dragstart', (event) => {
      if (state.checked) return;
      event.dataTransfer?.setData('text/plain', card.dataset.id || '');
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
  });
  const s = slots();
  if (s.dropZone && !s.dropZone.__vaccinesDropReady) {
    s.dropZone.__vaccinesDropReady = true;
    s.dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!state.checked) s.dropZone.classList.add('is-drag-over');
    });
    s.dropZone.addEventListener('dragleave', () => s.dropZone.classList.remove('is-drag-over'));
    s.dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      s.dropZone.classList.remove('is-drag-over');
      addVaccine(event.dataTransfer?.getData('text/plain'));
    });
  }
  if (s.pool && !s.pool.__vaccinesDropBackReady) {
    s.pool.__vaccinesDropBackReady = true;
    s.pool.addEventListener('dragover', (event) => event.preventDefault());
    s.pool.addEventListener('drop', (event) => {
      event.preventDefault();
      removeVaccine(event.dataTransfer?.getData('text/plain'));
    });
  }
}

function addVaccine(code) {
  const id = normalizeCode(code);
  if (!id || !getVaccine(id)) return;
  if (state.checked) { notify('Tocá Reintentar para modificar la respuesta.'); return; }
  if (id === NO_VACCINE_CODE) {
    state.selected = [NO_VACCINE_CODE];
  } else {
    state.selected = state.selected.filter((item) => item !== NO_VACCINE_CODE);
    if (!state.selected.includes(id)) state.selected.push(id);
  }
  paint();
}

function removeVaccine(code) {
  const id = normalizeCode(code);
  if (!id || !getVaccine(id)) return;
  if (state.checked) { notify('Tocá Reintentar para modificar la respuesta.'); return; }
  state.selected = state.selected.filter((item) => item !== id);
  paint();
}

function verify() {
  if (state.checked) { notify('Esta respuesta ya fue verificada.'); return; }
  if (!state.selected.length) { notify('Seleccioná una respuesta antes de verificar.'); return; }
  const item = currentCase();
  const expected = item?.expected || [];
  const correct = state.selected.filter((code) => expected.includes(code));
  const missing = expected.filter((code) => !state.selected.includes(code));
  const wrong = state.selected.filter((code) => !expected.includes(code));
  const perfect = missing.length === 0 && wrong.length === 0;

  state.checked = true;
  state.hintOpen = false;
  state.attempts += 1;

  if (perfect) {
    state.perfectAnswers += 1;
    state.streak += 1;
    state.score += 100 + Math.max(0, state.streak - 1) * 20;
    notify('Correcto. Caso registrado.');
    confetti();
  } else {
    state.streak = 0;
    state.score += correct.length * 20;
    notify('Caso registrado con vacunas faltantes o incorrectas.');
  }

  markCaseCompleted(item, {
    perfect,
    correctCount: correct.length,
    missingCount: missing.length,
    wrongCount: wrong.length
  });

  paint();
  renderResult(slots(), correct, missing, wrong, perfect);
}

function retry() {
  state.selected = [];
  state.checked = false;
  state.hintOpen = false;
  const s = slots();
  if (s.result) {
    s.result.classList.remove('show', 'vaccines-result-explanation-only');
    s.result.innerHTML = '';
  }
  paint();
}

function finishPractice() {
  state.finished = true;
  const s = slots();
  const stats = courseStats();
  if (s.progressFill) s.progressFill.style.width = `${stats.percent}%`;
  if (s.progressLabel) s.progressLabel.textContent = `${stats.percent}%`;
  if (s.totalProgressFill) s.totalProgressFill.style.width = `${stats.percent}%`;
  if (s.totalProgressLabel) s.totalProgressLabel.textContent = `${stats.percent}%`;
  if (s.totalProgressText) s.totalProgressText.textContent = `${stats.completed} de ${stats.total} casos completados`;
  if (s.result) {
    s.result.classList.remove('show', 'vaccines-result-explanation-only');
    s.result.innerHTML = '';
  }
  if (s.finish) {
    s.finish.innerHTML = `
      <h2>${stats.percent >= 100 ? 'Curso completado' : 'Tramo terminado'}</h2>
      <p>Registro del ciclo actual: <strong>${stats.completed}/${stats.total}</strong> casos completados (${stats.percent}%). En esta sesión: <strong>${state.score}</strong> puntos y <strong>${state.perfectAnswers}/${state.attempts || 0}</strong> respuestas perfectas.</p>
      <div class="vaccines-action-row">
        <button type="button" class="vaccines-btn vaccines-btn-primary" data-vaccine-action="restart">${stats.percent >= 100 ? 'Volver a hacer curso' : 'Continuar curso'}</button>
        <button type="button" class="vaccines-btn vaccines-btn-secondary" data-vaccine-action="reset-course">Reiniciar curso</button>
      </div>`;
    s.finish.classList.add('show');
  }
  notify(stats.percent >= 100 ? 'Curso de vacunas completado.' : 'Tramo terminado.');
}

function scrollCourseTop() {
  try { root()?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
}

function previousCase() {
  const cycle = ensureCourseCycle();
  if (isCourseCycleComplete(cycle)) { finishPractice(); return; }
  const target = nextIncompleteIndex(state.currentIndex, -1);
  if (target < 0) { finishPractice(); return; }
  if (target === state.currentIndex) {
    notify('Solo queda este caso pendiente en el curso.');
    return;
  }
  moveToCaseIndex(target);
}

function nextCase() {
  const cycle = ensureCourseCycle();
  if (isCourseCycleComplete(cycle)) { finishPractice(); return; }
  const target = nextIncompleteIndex(state.currentIndex, 1);
  if (target < 0) { finishPractice(); return; }
  if (target === state.currentIndex) {
    notify('Solo queda este caso pendiente en el curso.');
    return;
  }
  moveToCaseIndex(target);
}

function isEditableTarget(element) {
  if (!element) return false;
  const tag = String(element.tagName || '').toLowerCase();
  return element.isContentEditable || ['input', 'textarea', 'select', 'button'].includes(tag);
}

function handleKeyboard(event) {
  if (!root()) return;
  if (isEditableTarget(document.activeElement)) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    nextCase();
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    previousCase();
  }
}

function confetti() {
  const colors = ['#009b72', '#10b981', '#f97316', '#e11d48', '#2563eb'];
  for (let i = 0; i < 32; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'vaccines-confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1400);
  }
}

function localVaccinesAccessFallback() {
  const profile = currentProfile() || {};
  const server = clean(typeof deps.getServerAccess === 'function' ? deps.getServerAccess() : '');
  const plan = clean(server || profile.plan || '').toLowerCase();
  const trialActivadoAt = profile.trial_activado_at || profile.trialActivadoAt || null;
  return {
    allowed: ['admin', 'pro', 'trial_activo'].includes(plan) || !!trialActivadoAt,
    plan,
    trialActivadoAt,
    source: server ? 'server-access' : 'profile'
  };
}

async function checkVaccinesAccess(force = false) {
  const now = Date.now();
  if (!force && state.access && now - state.accessLoadedAt < 60000) return state.access;

  const fallback = localVaccinesAccessFallback();

  try {
    const remote = await getBibliografia2026Access(sb());
    const plan = clean(remote.plan || fallback.plan).toLowerCase();
    const trialActivadoAt = remote.trialActivadoAt || fallback.trialActivadoAt || null;
    const access = {
      allowed: !!remote.allowed || ['admin', 'pro', 'trial_activo'].includes(plan) || !!trialActivadoAt,
      plan,
      trialActivadoAt,
      error: null,
      source: 'rpc'
    };
    state.access = access;
    state.accessLoadedAt = now;
    return access;
  } catch (error) {
    const access = {
      ...fallback,
      error: error?.message || 'No se pudo verificar el acceso.'
    };
    state.access = access;
    state.accessLoadedAt = now;
    return access;
  }
}

function planDisplayName(plan) {
  const p = clean(plan).toLowerCase();
  if (p === 'admin') return 'Admin';
  if (p === 'pro') return 'Pro';
  if (p === 'trial_activo') return 'Trial activo';
  if (p === 'trial') return 'Trial gratuito';
  if (p === 'trial_limitado') return 'Trial limitado';
  if (!p) return 'Sin plan activo';
  return p.replace(/_/g, ' ');
}

function renderVaccinesAccessLocked(access = {}) {
  hideAppChrome();
  markView('vaccines-practice');
  const box = getBox();
  if (!box) return;

  const plan = planDisplayName(access.plan);
  const trialOn = !!access.trialActivadoAt || clean(access.plan).toLowerCase() === 'trial_activo';
  const trialText = trialOn ? 'Trial activo detectado' : 'Trial activo no detectado';
  const planRaw = clean(access.plan).toLowerCase();
  const title = planRaw === 'trial'
    ? 'Activá tu trial para usar la práctica de vacunas'
    : planRaw === 'trial_limitado'
      ? 'La práctica de vacunas queda fuera del trial limitado'
      : 'La práctica de vacunas es una función avanzada';
  const body = planRaw === 'trial'
    ? 'Tu cuenta tiene trial disponible. Este modo se habilita con trial activo, plan Pro o Admin.'
    : planRaw === 'trial_limitado'
      ? 'El trial limitado mantiene acceso reducido al banco oficial. Para este modo necesitás Pro, Admin o trial activo.'
      : 'Está disponible para usuarios Pro, Admin o cuentas con trial activo.';

  box.innerHTML = `
    <div id="welcome" class="home-sim vaccines-practice-page vaccines-access-page">
      <section class="biblio-access-card vaccines-access-card">
        <div class="biblio-lock-orb" aria-hidden="true">🔒</div>
        <div class="biblio-access-copy">
          <div class="home-eyebrow"><span class="home-eyebrow-dot"></span> Acceso especial</div>
          <h1 class="home-title"><span>${esc(title)}</span></h1>
          <p class="home-sub">${esc(body)}</p>
          <div class="biblio-access-status">
            <div><span>Tu plan actual</span><b>${esc(plan)}</b></div>
            <div><span>Estado trial</span><b>${esc(trialText)}</b></div>
          </div>
          <div class="biblio-access-actions">
            <button type="button" class="home-primary" data-action="activate-trial-premium"><span>🔓</span><span>Activar trial gratis</span></button>
            <button type="button" class="home-secondary" data-action="start-payment" data-plan="mensual">⭐ Ver Pro mensual</button>
            <button type="button" class="home-secondary" data-vaccine-action="retry-access">↻ Ya tengo acceso, reintentar</button>
            <button type="button" class="home-secondary" data-vaccine-action="home">← Volver al configurador</button>
          </div>
          ${access.error ? `<div class="biblio-access-note">No se pudo verificar el permiso con servidor: ${esc(access.error)}. Si acabás de activar acceso, tocá “reintentar”.</div>` : ''}
        </div>
        <div class="biblio-access-benefits">
          <div><b>💉 Práctica interactiva</b><span>Casos de vacunación actualizados.</span></div>
          <div><b>✅ Corrección inmediata</b><span>Detecta vacunas correctas, faltantes e incorrectas.</span></div>
          <div><b>📊 Curso al 100%</b><span>Registro persistente de casos completados.</span></div>
        </div>
      </section>
    </div>`;
  try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}
}

async function ensureVaccinesAccess({ force = false } = {}) {
  if (!currentUser()) {
    try { deps.openAuth?.(); } catch (_) {}
    notify('Iniciá sesión para usar la práctica de vacunas.');
    return false;
  }
  const access = await checkVaccinesAccess(force);
  if (access.allowed) return true;
  renderVaccinesAccessLocked(access);
  return false;
}

function goHome() {
  try {
    if (typeof deps.renderHome === 'function') deps.renderHome(false);
    else if (typeof window.resiarRenderHome === 'function') window.resiarRenderHome(false);
  } catch (_) {}
  try { markView('config'); } catch (_) {}
}

function toggleHint() {
  state.hintOpen = !state.hintOpen;
  paint();
}

function handleAction(event) {
  const trigger = event.target.closest('[data-vaccine-action]');
  if (!trigger) return;
  const action = trigger.dataset.vaccineAction;
  if (!action) return;
  event.preventDefault();

  if (action === 'open') { abrirVacunasPractice(); return; }
  if (action === 'retry-access') { state.access = null; abrirVacunasPractice({ forceAccess: true, forceData: true }); return; }
  if (action === 'reload-data') { abrirVacunasPractice({ forceAccess: true, forceData: true }); return; }
  if (action === 'home') { goHome(); return; }
  if (action === 'toggle-hint') { toggleHint(); return; }
  if (!root() && !['open', 'retry-access', 'reload-data', 'home'].includes(action)) return;
  if (action === 'restart') { startPractice(true); return; }
  if (action === 'reset-course') {
    if (window.confirm('¿Reiniciar el registro del curso de vacunas?')) {
      resetCourseProgress();
      startPractice(true);
      notify('Registro del curso reiniciado.');
    }
    return;
  }
  if (action === 'add') { addVaccine(trigger.dataset.id); return; }
  if (action === 'remove') { removeVaccine(trigger.dataset.id); return; }
  if (action === 'verify') { verify(); return; }
  if (action === 'retry') { retry(); return; }
  if (action === 'previous') { previousCase(); return; }
  if (action === 'next') { nextCase(); }
}

export function configureVacunasPractice(options = {}) {
  deps = options || {};
  if (!delegationInstalled) {
    document.addEventListener('click', handleAction);
    delegationInstalled = true;
  }
  if (!keyboardInstalled) {
    document.addEventListener('keydown', handleKeyboard);
    keyboardInstalled = true;
  }
}

export async function abrirVacunasPractice(options = {}) {
  hideAppChrome();
  markView('vaccines-practice');
  const ok = await ensureVaccinesAccess({ force: !!options.forceAccess });
  if (!ok) return;
  const box = getBox();
  if (!box) return;
  box.innerHTML = renderLoadingShell();
  try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}

  try {
    const loaded = await loadVaccinePracticeData(!!options.forceData);
    if (!loaded) return;
  } catch (error) {
    state.dataError = error?.message || String(error || 'No se pudo cargar la práctica.');
    renderDataError(error);
    return;
  }

  box.innerHTML = renderShell();
  try { if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState(); } catch (_) {}
  startPractice(true);
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
}
