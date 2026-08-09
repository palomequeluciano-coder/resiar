// Filtro de "exámenes mixtos" (combinar bancos y años en una sola
// selección) + tracking de preguntas completadas + totales reales del
// banco para usuarios en trial. Extraído de main.js siguiendo el patrón
// configure(): main.js sigue siendo dueño del estado mutable
// (preguntas, currentUser, currentProfile, _serverAcceso,
// _resiarQuestionBankVersion, cargarChecklist, cargarFiltros,
// _filtroExamenValue, _filtroAnioMirValue) y lo inyecta acá vía closure.
//
// Nota sobre cargarFiltros: este módulo envuelve `cargarFiltros` en
// runtime (installFilterHooks) para recalcular los grupos combinados
// cada vez que se recargan los filtros -- por eso pide un getter/setter
// en vez de importarla directo (main.js la mantiene como `let` desde la
// pasada 6, justamente por este wrapper).
//
// Expone su API en window (mixedExamFilterRefresh/Toggle/ToggleBank/
// Clear/Debug, resiarMarkCompletionAnsweredIds, etc.) porque otras partes
// de la UI (home configurator, templates de preguntas) la consultan así,
// igual que antes de la extracción.

import { PROVINCIA_VALUE, EU_VALUE, esProvinciaBsAs, esExamenUnico, labelExamen } from '../utils/examFilters.js';
import { planUsesTrialQuestionCache } from './trialAccess.js';
import { readJson, writeJson } from '../utils/storage.js';
import {
  RESIAR_MIXED_EXAM_FILTER_PREFIX,
  LEGACY_MIXED_EXAM_FILTER_KEYS,
  userScopedStorageKey
} from '../utils/storageKeys.js';
import { sbUpdateSummary } from './sidebar.js';

const deps = {
  getQuestions: () => [],
  getCurrentUser: () => null,
  getServerAccess: () => '',
  getCurrentProfile: () => null,
  getQuestionBankVersion: () => '',
  getCargarChecklist: () => null,
  getCargarFiltros: () => null,
  setCargarFiltros: () => {},
  setFiltroExamenValue: () => {},
  setFiltroAnioMirValue: () => {}
};

export function configureMixedExamFilter(overrides = {}) {
  Object.assign(deps, overrides || {});

  const state = {
    selected:new Set(),
    groups:[],
    installed:false,
    originals:{},
    lastStorageKey:'',
    completedIds:new Set(),
    completionLoaded:false,
    completionLoading:false,
    completionUserKey:'',
    completionTimer:0,
    completionWatchStarted:false,
    fullTotalsLoaded:false,
    fullTotalsLoading:false,
    fullTotalsVersion:'',
    fullTotalsTimer:0,
    fullTotalsByBank:new Map(),
    fullTotalsByPair:new Map()
  };
  const RESIAR_EXAM_COMPLETION_STORAGE_PREFIX = 'resiar_exam_completed_question_ids_v1';


  function getCurrentUserForStorage(){
    try { return deps.getCurrentUser() || null; } catch(_) { return null; }
  }
  function storageKey(){
    return userScopedStorageKey(RESIAR_MIXED_EXAM_FILTER_PREFIX, getCurrentUserForStorage(), 'anon');
  }

  function escHtml(v){
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function getQuestions(){
    try { const qs = deps.getQuestions(); return Array.isArray(qs) ? qs : []; }
    catch(_) { return []; }
  }
  function getYear(p){
    const explicit = p && (p.anio ?? p.año ?? p.year);
    if (explicit !== undefined && explicit !== null && explicit !== '') return String(explicit);
    const m = String((p && p.examen) || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : 's/año';
  }
  function getProvKey(){
    return PROVINCIA_VALUE;
  }
  function getEuKey(){
    return EU_VALUE;
  }
  function bankKeyFor(p){
    const ex = (p && p.examen) || '';
    if (esProvinciaBsAs(ex)) return getProvKey();
    if (esExamenUnico(ex)) return getEuKey();
    return String(ex || 'Sin examen');
  }
  function bankLabelFor(key){
    const label = labelExamen(key);
    if (label) return label;
    if (key === getProvKey()) return 'Provincia de Buenos Aires';
    if (key === getEuKey()) return 'Examen Único';
    return String(key || 'Sin examen');
  }
  function pairKeyFromParts(bank, year){ return String(bank) + '::' + String(year); }
  function pairKeyFor(p){ return pairKeyFromParts(bankKeyFor(p), getYear(p)); }
  function isEnarmBankKey(bank){
    const raw = String(bank || '');
    const lbl = String(bankLabelFor(bank) || '');
    return (raw + ' ' + lbl).toUpperCase().includes('ENARM');
  }
  function isEnarmQuestion(p){ return isEnarmBankKey(bankKeyFor(p)); }

  const RESIAR_BANK_TOTALS_STORAGE_PREFIX = 'resiar_question_bank_full_totals_v1';

  function currentPlanUsesTrialBankTotals(){
    try {
      return planUsesTrialQuestionCache(deps.getServerAccess() || deps.getCurrentProfile()?.plan || '');
    } catch (_) {
      return false;
    }
  }

  function fullTotalsVersionKey(){
    try { return String(deps.getQuestionBankVersion() || window.__resiarQuestionBankVersion || 'v1').trim() || 'v1'; }
    catch (_) { return 'v1'; }
  }

  function fullTotalsStorageKey(){
    return RESIAR_BANK_TOTALS_STORAGE_PREFIX + ':' + fullTotalsVersionKey();
  }

  function clearFullTotals(){
    state.fullTotalsByBank = new Map();
    state.fullTotalsByPair = new Map();
    state.fullTotalsLoaded = false;
    state.fullTotalsVersion = '';
  }

  function applyFullTotalsRows(rows){
    const byBank = new Map();
    const byPair = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const total = Number(row?.total ?? row?.count ?? row?.preguntas_total ?? 0);
      if (!Number.isFinite(total) || total <= 0) return;
      const pseudo = { examen: row?.examen, anio: row?.anio ?? row?.año ?? row?.year };
      const bank = bankKeyFor(pseudo);
      const year = getYear(pseudo);
      const pair = pairKeyFromParts(bank, year);
      byBank.set(bank, (byBank.get(bank) || 0) + total);
      byPair.set(pair, (byPair.get(pair) || 0) + total);
    });
    state.fullTotalsByBank = byBank;
    state.fullTotalsByPair = byPair;
    state.fullTotalsLoaded = byBank.size > 0 || byPair.size > 0;
    state.fullTotalsVersion = fullTotalsVersionKey();
    return state.fullTotalsLoaded;
  }

  function loadCachedFullTotals(){
    try {
      const cached = readJson(fullTotalsStorageKey(), null);
      if (!cached || cached.version !== fullTotalsVersionKey() || !Array.isArray(cached.rows)) return false;
      return applyFullTotalsRows(cached.rows);
    } catch (_) { return false; }
  }

  function saveCachedFullTotals(rows){
    try {
      writeJson(fullTotalsStorageKey(), {
        version: fullTotalsVersionKey(),
        rows: Array.isArray(rows) ? rows : [],
        updatedAt: new Date().toISOString()
      });
    } catch (_) {}
  }

  function fullTotalForBank(bank, visibleTotal){
    const visible = Math.max(Number(visibleTotal) || 0, 0);
    if (!currentPlanUsesTrialBankTotals()) return visible;
    const full = Number(state.fullTotalsByBank?.get(String(bank)) || 0);
    return Number.isFinite(full) && full > 0 ? Math.max(full, visible) : visible;
  }

  function fullTotalForPair(bank, year, visibleCount){
    const visible = Math.max(Number(visibleCount) || 0, 0);
    if (!currentPlanUsesTrialBankTotals()) return visible;
    const key = pairKeyFromParts(bank, year);
    const full = Number(state.fullTotalsByPair?.get(key) || 0);
    return Number.isFinite(full) && full > 0 ? Math.max(full, visible) : visible;
  }

  function countMarkup(visible, full, cssClass = ''){
    const v = Math.max(Number(visible) || 0, 0);
    const f = Math.max(Number(full) || 0, 0);
    const cls = cssClass ? ' ' + cssClass : '';
    if (currentPlanUsesTrialBankTotals() && f > v) {
      const missing = f - v;
      return '<span class="trial-count-pair' + cls + '" title="Disponibles en tu plan: ' + escHtml(v) + ' de ' + escHtml(f) + ' preguntas. No incluidas: ' + escHtml(missing) + '."><span class="trial-count-visible">' + escHtml(v) + '</span><span class="trial-count-sep">/</span><span class="trial-count-full">' + escHtml(f) + '</span></span>';
    }
    return '<span class="trial-count-single' + cls + '">' + escHtml(v) + '</span>';
  }

  function scheduleFullTotalsRefresh(delay = 250, force = false){
    clearTimeout(state.fullTotalsTimer);
    state.fullTotalsTimer = setTimeout(() => {
      refreshFullTotals(force);
    }, delay);
  }

  async function refreshFullTotals(force = false){
    if (!currentPlanUsesTrialBankTotals()) {
      if (state.fullTotalsLoaded || state.fullTotalsByBank?.size || state.fullTotalsByPair?.size) {
        clearFullTotals();
        try { buildGroups(); render(); } catch (_) {}
        try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
      }
      return false;
    }

    const version = fullTotalsVersionKey();
    if (!force && state.fullTotalsLoaded && state.fullTotalsVersion === version) return true;
    if (state.fullTotalsLoading) return false;

    const hadCache = !force && loadCachedFullTotals();
    if (hadCache) {
      try { buildGroups(); render(); } catch (_) {}
      try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
    }

    let client = null;
    try { client = typeof sb !== 'undefined' ? sb : null; } catch (_) { client = null; }
    if (!client || typeof client.rpc !== 'function') return hadCache;

    state.fullTotalsLoading = true;
    try {
      const { data, error } = await client.rpc('get_question_bank_totals_v1');
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const applied = applyFullTotalsRows(rows);
      if (applied) saveCachedFullTotals(rows);
      try { buildGroups(); render(); } catch (_) {}
      try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
      return applied;
    } catch (error) {
      console.warn('[ResiAR] No se pudieron cargar totales completos de bancos:', error);
      return hadCache;
    } finally {
      state.fullTotalsLoading = false;
    }
  }
  function hasMixedSelection(){ return state.selected.size > 0; }
  function selectedQuestionsFrom(list){
    if (!hasMixedSelection()) return list || [];
    return (list || []).filter(p => state.selected.has(pairKeyFor(p)));
  }
  function selectedLabels(){
    const map = new Map();
    const enarmLabels = new Set();
    for (const g of state.groups) {
      const selectedYears = [];
      for (const y of g.years) {
        if (state.selected.has(pairKeyFromParts(g.bank, y.year))) selectedYears.push(y.year);
      }
      if (!selectedYears.length) continue;
      if (isEnarmBankKey(g.bank)) enarmLabels.add(g.label + ' Todas');
      else map.set(g.label, selectedYears);
    }
    return [...map.entries()].map(([label, years]) => label + ' ' + years.join(', ')).concat([...enarmLabels]);
  }
  function save(){
    const key = storageKey();
    state.lastStorageKey = key;
    writeJson(key, [...state.selected]);
  }
  function load(){
    const key = storageKey();
    if (state.lastStorageKey === key && state.selected instanceof Set) return;
    state.lastStorageKey = key;
    try {
      let arr = readJson(key, null);
      if (!Array.isArray(arr)) {
        for (const legacyKey of LEGACY_MIXED_EXAM_FILTER_KEYS) {
          const legacy = readJson(legacyKey, null);
          if (Array.isArray(legacy)) {
            arr = legacy;
            writeJson(key, legacy);
            break;
          }
        }
      }
      state.selected = new Set((Array.isArray(arr) ? arr : []).map(String));
    } catch(_) { state.selected = new Set(); }
  }
  function completionSafeId(value){
    const id = String(value == null ? '' : value).trim();
    return id || '';
  }

  function questionIdForCompletion(question){
    return completionSafeId(question && question.id);
  }

  function completionUserKey(){
    const user = getCurrentUserForStorage();
    const raw = user && (user.id || user.email || user.user_metadata?.email);
    return completionSafeId(raw);
  }

  function completionStorageKey(){
    return userScopedStorageKey(RESIAR_EXAM_COMPLETION_STORAGE_PREFIX, getCurrentUserForStorage(), 'anon');
  }

  function loadLocalCompletionIds(){
    try {
      if (!completionUserKey()) return;
      const raw = readJson(completionStorageKey(), null);
      const ids = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.ids)
          ? raw.ids
          : [];
      ids.forEach((value) => {
        const id = completionSafeId(value);
        if (id) state.completedIds.add(id);
      });
    } catch (_) {}
  }

  function saveLocalCompletionIds(){
    try {
      if (!completionUserKey()) return false;
      const ids = [...state.completedIds].map(completionSafeId).filter(Boolean).slice(0, 50000);
      return writeJson(completionStorageKey(), {
        version: 1,
        userKey: completionUserKey(),
        ids,
        updatedAt: new Date().toISOString()
      });
    } catch (_) {
      return false;
    }
  }

  function resetCompletionIfUserChanged(){
    const key = completionUserKey();
    if (state.completionUserKey === key) return false;

    state.completionUserKey = key;
    state.completedIds = new Set();
    state.completionLoaded = false;
    state.completionLoading = false;

    if (key) loadLocalCompletionIds();
    return true;
  }

  function completionStatsForIds(ids){
    const clean = [...new Set((ids || []).map(completionSafeId).filter(Boolean))];
    if (!clean.length) return { total:0, done:0, complete:false };
    const done = clean.reduce((acc, id) => acc + (state.completedIds.has(id) ? 1 : 0), 0);
    return { total:clean.length, done, complete:done >= clean.length };
  }

  function completionBadge(ids, label = 'Completado'){
    const stats = completionStatsForIds(ids);
    if (!stats.complete) return '';
    return '<span class="mixed-exam-completed" title="' + escHtml(label + ': ya respondiste todas las preguntas al menos una vez') + '" aria-label="' + escHtml(label) + '">✓</span>';
  }

  function ensureCompletionStyles(){
    if (document.getElementById('resiar-mixed-exam-completion-style-v102')) return;
    const style = document.createElement('style');
    style.id = 'resiar-mixed-exam-completion-style-v102';
    style.textContent = `
      .mixed-exam-chip.completed:not(.active),
      .home-chip.completed:not(.active){
        border-color:var(--border,rgba(148,163,184,.22))!important;
        background:var(--surface,#fff)!important;
        box-shadow:none!important;
        color:inherit!important;
      }
      .mixed-exam-completed{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:auto!important;
        min-width:0!important;
        max-width:none!important;
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        border-radius:0!important;
        margin-left:6px!important;
        background:transparent!important;
        border:0!important;
        color:var(--green,#059669)!important;
        font-size:.88rem!important;
        font-weight:950!important;
        line-height:1!important;
        vertical-align:middle!important;
        flex:0 0 auto!important;
        opacity:1!important;
        visibility:visible!important;
        overflow:visible!important;
        box-shadow:none!important;
      }
      .home-chip .mixed-exam-completed{
        margin-left:5px!important;
      }
      .mixed-exam-chip.active .mixed-exam-completed,
      .home-chip.active .mixed-exam-completed{
        color:#fff!important;
      }
      .mixed-exam-bank-completed{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:4px!important;
        border-radius:0!important;
        padding:0!important;
        background:transparent!important;
        border:0!important;
        color:var(--green,#059669)!important;
        font-family:var(--font-mono,'Space Grotesk',monospace)!important;
        font-size:.62rem!important;
        font-weight:950!important;
        letter-spacing:.08em!important;
        text-transform:uppercase!important;
        white-space:nowrap!important;
        opacity:1!important;
        visibility:visible!important;
        box-shadow:none!important;
      }
      .mixed-exam-group-actions .mixed-exam-bank-completed,
      .home-bank-head .mixed-exam-bank-completed{
        margin-right:3px!important;
      }

      .trial-count-pair,
      .trial-count-single{
        display:inline-flex!important;
        align-items:baseline!important;
        justify-content:center!important;
        gap:2px!important;
        white-space:nowrap!important;
        font-variant-numeric:tabular-nums!important;
      }
      .trial-count-visible{color:var(--text2,#64748b)!important;font-weight:700!important;}
      .trial-count-sep{color:var(--text3,#94a3b8)!important;opacity:.75!important;font-weight:800!important;}
      .trial-count-full{color:var(--green,#059669)!important;font-weight:950!important;}
      .home-chip.active .trial-count-visible,
      .home-chip.active .trial-count-sep,
      .home-chip.active .trial-count-full,
      .mixed-exam-chip.active .trial-count-visible,
      .mixed-exam-chip.active .trial-count-sep,
      .mixed-exam-chip.active .trial-count-full{color:currentColor!important;opacity:.92!important;}
      .home-bank-total.trial-count-pair,
      .mixed-exam-count.trial-count-pair{font-size:.64rem!important;letter-spacing:.02em!important;}
      .home-bank-total .trial-count-full,
      .mixed-exam-count .trial-count-full{color:var(--green,#059669)!important;}
      @media(max-width:720px){
        .mixed-exam-bank-completed{font-size:.58rem;padding:0;}
        .mixed-exam-completed{font-size:.8rem;}
      }
    `;
    document.head.appendChild(style);
  }

  function markCompletionAnsweredIds(ids, options = {}){
    resetCompletionIfUserChanged();
    if (!state.completionUserKey) return false;

    let changed = false;
    (Array.isArray(ids) ? ids : [ids]).forEach((value) => {
      const id = completionSafeId(value);
      if (id && !state.completedIds.has(id)) {
        state.completedIds.add(id);
        changed = true;
      }
    });

    if (!changed) return false;

    if (options.persist !== false) saveLocalCompletionIds();

    if (options.render !== false) {
      try { render(); } catch (_) {}
      try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
    }

    return true;
  }

  async function fetchRemoteCompletionIds(){
    if (!state.completionUserKey || !sb) return new Set();

    const out = new Set();
    const addRows = (rows) => {
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const id = completionSafeId(row && (row.question_id || row.id));
        if (id) out.add(id);
      });
    };

    // v104: RPC como fuente preferida, pero no única.
    // Si la migración todavía no está aplicada, el frontend cae a tablas propias
    // protegidas por RLS para que los tildes aparezcan sin hotfix manual.
    if (typeof sb.rpc === 'function') {
      try {
        const { data, error } = await sb.rpc('get_user_answered_question_ids_v1');
        if (!error) addRows(data);
        else console.warn('[ResiAR] RPC de progreso no disponible; usando fallback:', error?.message || error);
      } catch (error) {
        console.warn('[ResiAR] RPC de progreso no disponible; usando fallback:', error?.message || error);
      }
    }

    async function fetchPagedQuestionIds(table, applyFilters){
      if (!sb || typeof sb.from !== 'function') return;
      const pageSize = 1000;
      for (let from = 0; from < 20000; from += pageSize) {
        let query = sb.from(table).select('question_id').range(from, from + pageSize - 1);
        if (typeof applyFilters === 'function') query = applyFilters(query) || query;
        const { data, error } = await query;
        if (error) throw error;
        addRows(data);
        if (!Array.isArray(data) || data.length < pageSize) break;
      }
    }

    try {
      await fetchPagedQuestionIds('exam_answers', (query) => query.eq('is_answered', true));
    } catch (error) {
      console.warn('[ResiAR] No se pudo cargar progreso desde exam_answers:', error?.message || error);
    }

    try {
      await fetchPagedQuestionIds('secure_exam_session_answers');
    } catch (error) {
      console.warn('[ResiAR] No se pudo cargar progreso desde secure_exam_session_answers:', error?.message || error);
    }

    return out;
  }

  async function refreshCompletionFromRemote(force = false){
    resetCompletionIfUserChanged();

    if (!state.completionUserKey) {
      try { render(); } catch (_) {}
      try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
      return state.completedIds;
    }

    if (state.completionLoading) return state.completedIds;
    if (state.completionLoaded && !force) return state.completedIds;

    state.completionLoading = true;

    try {
      loadLocalCompletionIds();

      const remoteIds = await fetchRemoteCompletionIds();
      remoteIds.forEach((id) => state.completedIds.add(id));

      state.completionLoaded = true;
      saveLocalCompletionIds();
      render();
      try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
    } catch (error) {
      console.warn('[ResiAR] No se pudo cargar progreso de exámenes completos:', error);
      state.completionLoaded = true;
      render();
      try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch (_) {}
    } finally {
      state.completionLoading = false;
    }

    return state.completedIds;
  }

  function scheduleCompletionRefresh(delay = 250, force = false){
    clearTimeout(state.completionTimer);
    state.completionTimer = setTimeout(() => {
      refreshCompletionFromRemote(force);
    }, delay);
  }

  function startCompletionWatch(){
    if (state.completionWatchStarted) return;
    state.completionWatchStarted = true;

    setInterval(() => {
      const changed = resetCompletionIfUserChanged();
      if (changed) scheduleCompletionRefresh(0, true);
    }, 2500);
  }

  try {
    window.resiarMarkCompletionAnsweredIds = function(ids, options){
      return markCompletionAnsweredIds(ids, options || {});
    };
    window.resiarExamCompletionStatsForIds = function(ids){
      resetCompletionIfUserChanged();
      return completionStatsForIds(ids || []);
    };
    window.resiarRefreshExamCompletionBadges = function(){
      return refreshCompletionFromRemote(true);
    };
  } catch (_) {}

  function buildGroups(){
    const byBank = new Map();
    getQuestions().forEach(p => {
      const bank = bankKeyFor(p);
      const year = getYear(p);
      const key = pairKeyFromParts(bank, year);
      if (!byBank.has(bank)) byBank.set(bank, { bank, label:bankLabelFor(bank), yearsMap:new Map(), total:0, questionIds:new Set() });
      const g = byBank.get(bank);
      const qid = questionIdForCompletion(p);
      g.total++;
      if (qid) g.questionIds.add(qid);
      if (!g.yearsMap.has(year)) g.yearsMap.set(year, { year, count:0, key, questionIds:new Set() });
      const yg = g.yearsMap.get(year);
      yg.count++;
      if (qid) yg.questionIds.add(qid);
    });
    const eu = getEuKey();
    const prov = getProvKey();
    const priority = (bank) => {
      const b = String(bank || '').toUpperCase();
      if (bank === eu) return 1;
      if (b === 'CABA') return 2;
      if (bank === prov) return 3;
      if (b.includes('MIR')) return 4;
      if (b.includes('ENARM')) return 5;
      return 20;
    };
    state.groups = [...byBank.values()].map(g => ({
      bank:g.bank,
      label:g.label,
      total:g.total,
      fullTotal:fullTotalForBank(g.bank, g.total),
      questionIds:[...(g.questionIds || new Set())],
      years:[...g.yearsMap.values()].map(y => ({
        year:y.year,
        count:y.count,
        fullCount:fullTotalForPair(g.bank, y.year, y.count),
        key:y.key,
        questionIds:[...(y.questionIds || new Set())]
      })).sort((a,b) => {
        const na = Number(a.year), nb = Number(b.year);
        if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
        return String(b.year).localeCompare(String(a.year), 'es');
      })
    })).sort((a,b) => priority(a.bank) - priority(b.bank) || a.label.localeCompare(b.label, 'es'));
    const valid = new Set();
    state.groups.forEach(g => g.years.forEach(y => valid.add(pairKeyFromParts(g.bank, y.year))));
    state.selected = new Set([...state.selected].filter(k => valid.has(k)));
  }
  function render(){
    ensureCompletionStyles();
    resetCompletionIfUserChanged();
    if (currentPlanUsesTrialBankTotals() && (!state.fullTotalsLoaded || state.fullTotalsVersion !== fullTotalsVersionKey())) {
      scheduleFullTotalsRefresh(120, false);
    }

    const root = document.getElementById('mixedExamFilterRoot');
    if (!root) return;
    const selected = selectedLabels();
    const selectedTxt = selected.length
      ? '<strong>' + state.selected.size + '</strong> combinación' + (state.selected.size === 1 ? '' : 'es') + ': ' + escHtml(selected.join(' · '))
      : 'Sin selección específica: se usan <strong>todos los exámenes</strong>.';
    root.innerHTML = '<div class="mixed-exam-filter">'
      + '<div class="mixed-exam-filter-head"><span class="mixed-exam-filter-title">Exámenes y años</span><button type="button" class="mixed-exam-clear" data-action="mixed-filter-clear">Limpiar</button></div>'
      + '<div class="mixed-exam-selected">' + selectedTxt + '</div>'
      + '<div class="mixed-exam-help">Podés mezclar bancos y años individuales. Ej.: EU 2025 + CABA 2016 + MIR 2024.</div>'
      + '<div class="mixed-exam-groups">' + state.groups.map(g => {
        const isEnarm = isEnarmBankKey(g.bank);
        if (isEnarm) {
          const keys = g.years.map(y => pairKeyFromParts(g.bank, y.year));
          const allSelected = keys.length && keys.every(k => state.selected.has(k));
          const anySelected = keys.some(k => state.selected.has(k));
          const bankDone = completionStatsForIds(g.questionIds).complete;
          const bankDonePill = bankDone ? '<span class="mixed-exam-bank-completed" title="Ya respondiste todas las preguntas de este banco al menos una vez">✓ Completo</span>' : '';
          return '<div class="mixed-exam-group home-bank-group-enarm">'
            + '<div class="mixed-exam-group-head"><div class="mixed-exam-bank" title="' + escHtml(g.label) + '">' + escHtml(g.label) + '</div>'
            + '<div class="mixed-exam-group-actions">' + countMarkup(g.total, g.fullTotal, 'mixed-exam-count') + '' + bankDonePill + '<button type="button" class="mixed-exam-mini" data-action="mixed-filter-toggle-bank" data-bank="' + String(g.bank).replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '">' + (allSelected ? 'Quitar' : 'Todo') + '</button></div></div>'
            + '<div class="mixed-exam-years"><button type="button" class="mixed-exam-chip ' + (anySelected ? 'active ' : '') + (bankDone ? 'completed' : '') + '" data-action="mixed-filter-toggle-bank" data-bank="' + String(g.bank).replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '">Todas<small>' + countMarkup(g.total, g.fullTotal) + '</small>' + completionBadge(g.questionIds, 'Banco completo') + '</button><div class="home-enarm-note">ENARM se puede elegir como cualquier banco, pero se muestra completo porque los años de origen no están identificados.</div></div></div>';
        }
        const allSelected = g.years.length && g.years.every(y => state.selected.has(pairKeyFromParts(g.bank, y.year)));
        const bankDone = completionStatsForIds(g.questionIds).complete;
        const bankDonePill = bankDone ? '<span class="mixed-exam-bank-completed" title="Ya respondiste todas las preguntas de este banco al menos una vez">✓ Completo</span>' : '';
        return '<div class="mixed-exam-group">'
          + '<div class="mixed-exam-group-head"><div class="mixed-exam-bank" title="' + escHtml(g.label) + '">' + escHtml(g.label) + '</div>'
          + '<div class="mixed-exam-group-actions">' + countMarkup(g.total, g.fullTotal, 'mixed-exam-count') + '' + bankDonePill + '<button type="button" class="mixed-exam-mini" data-action="mixed-filter-toggle-bank" data-bank="' + String(g.bank).replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '">' + (allSelected ? 'Quitar' : 'Todo') + '</button></div></div>'
          + '<div class="mixed-exam-years">' + g.years.map(y => {
            const k = pairKeyFromParts(g.bank, y.year);
            const yearDone = completionStatsForIds(y.questionIds).complete;
            return '<button type="button" class="mixed-exam-chip ' + (state.selected.has(k) ? 'active ' : '') + (yearDone ? 'completed' : '') + '" data-action="mixed-filter-toggle" data-key="' + String(k).replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '">' + escHtml(y.year) + '<small>' + countMarkup(y.count, y.fullCount) + '</small>' + completionBadge(y.questionIds, 'Examen completado') + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div></div>';
    updateNativeLabels();
  }
  function updateNativeLabels(){
    const examLabel = document.getElementById('filtroExamenLabel');
    const yearLabel = document.getElementById('filtroAnioMirLabel');
    const n = state.selected.size;
    if (examLabel) examLabel.textContent = n ? (n + ' exámenes/años') : 'Todos los exámenes';
    if (yearLabel) yearLabel.textContent = 'Todos los años';
    try { sbUpdateSummary(); } catch(_) {}
  }
  function refreshAfterChange(){
    try { deps.setFiltroExamenValue('todos'); deps.setFiltroAnioMirValue('todos'); } catch(_) {}
    try { const fn = deps.getCargarChecklist(); if (typeof fn === 'function') fn(); } catch(e) { console.warn(e); }
  }
  function installFilterHooks(){
    if (state.installed) return;
    state.installed = true;

    const originalCargarFiltros = deps.getCargarFiltros();
    if (typeof originalCargarFiltros === 'function') {
      state.originals.cargarFiltros = originalCargarFiltros;
      const wrapped = function(){
        const out = state.originals.cargarFiltros.apply(this, arguments);
        load();
        buildGroups();
        setTimeout(function(){
          render();
          try { if (typeof window.resiarHomeRefresh === 'function') window.resiarHomeRefresh(); } catch(_) {}
        }, 0);
        return out;
      };
      deps.setCargarFiltros(wrapped);
      window.cargarFiltros = wrapped;
    }
  }

  window.mixedExamFilterRefresh = function(){
    load();
    buildGroups();
    render();
    if (currentPlanUsesTrialBankTotals()) scheduleFullTotalsRefresh(80, false);
    return state.groups;
  };
  window.mixedExamFilterToggle = function(key){
    key = String(key || '');
    if (!key) return;
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    save(); render(); refreshAfterChange();
  };
  window.mixedExamFilterToggleBank = function(bank){
    const g = state.groups.find(x => x.bank === bank);
    if (!g) return;
    const keys = g.years.map(y => pairKeyFromParts(g.bank, y.year));
    const all = keys.every(k => state.selected.has(k));
    keys.forEach(k => all ? state.selected.delete(k) : state.selected.add(k));
    save(); render(); refreshAfterChange();
  };
  window.mixedExamFilterClear = function(){
    state.selected.clear(); save(); render(); refreshAfterChange();
  };
  window.mixedExamFilterDebug = function(){
    return {
      selected:[...state.selected],
      storageKey:storageKey(),
      completionLoaded:state.completionLoaded,
      completedCount:state.completedIds.size,
      fullTotalsLoaded:state.fullTotalsLoaded,
      fullTotalsVersion:state.fullTotalsVersion,
      groups:state.groups,
      selectedCount:selectedQuestionsFrom(getQuestions()).length,
      total:getQuestions().length
    };
  };
  let _mixedMountAttempts = 0;
  function mount(){
    const qs = getQuestions();
    if (!Array.isArray(qs) || (!qs.length && _mixedMountAttempts < 80)) {
      _mixedMountAttempts++;
      return setTimeout(mount, 250);
    }
    load(); buildGroups(); installFilterHooks();
    const examWrap = document.getElementById('filtroExamenWrap');
    const yearWrap = document.getElementById('filtroAnioMirWrap');
    if (examWrap) examWrap.style.display = 'none';
    if (yearWrap) yearWrap.style.display = 'none';
    let host = document.getElementById('mixedExamFilterRoot');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mixedExamFilterRoot';
      host.className = 'sb-field';
      const anchor = yearWrap || examWrap;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling);
      else (document.querySelector('#resiarHomeInternalFilterBridge #panel-configurar .sb-panel-inner') || document.getElementById('resiarHomeInternalFilterBridge') || document.body).appendChild(host);
    }
    render();
    startCompletionWatch();
    scheduleCompletionRefresh(450, false);
    if (currentPlanUsesTrialBankTotals()) scheduleFullTotalsRefresh(320, false);
    try { const fn = deps.getCargarChecklist(); if (typeof fn === 'function') fn(); } catch(_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
