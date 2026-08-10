// Configurador de la home: arma el panel principal (banco/año, especialidades,
// tema, modos especiales), sus contadores y resúmenes en vivo, y expone en
// window el API que consumen los templates (data-action) y otros módulos ya
// extraídos (mixedExamFilter.js, homeSearchBindings.js, checklistEspecialidades.js).
// Extraído de main.js siguiendo el patrón configure(): main.js sigue siendo
// dueño del estado mutable (preguntas, currentUser, currentProfile,
// _serverAcceso, _resiarQuestionBankVersion, _filtroExamenValue,
// _filtroAnioMirValue, questionChatState/Close/Disconnect, cerrarModal,
// cerrarReview, resiarIsLegacyConfigPlaceholder, resiarSyncReviewErrorsButton,
// deseleccionarEspecialidades) y lo inyecta acá vía closure.
//
// Nota sobre mostrarPantallaBienvenida: este módulo define su PROPIA versión
// de esa función (usa el home moderno en vez de la pantalla legacy) y
// reemplaza la de main.js -- por eso pide un setter en vez de importarla.
// resiarRenderHome/irAConfigurarNuevoExamen, en cambio, están definidas ACÁ
// (nunca existieron como bindings propios de main.js; homeSearchBindings.js
// las consume vía window, no vía scope de main.js, así que no hace falta
// exponerlas de ninguna otra forma).
//
// Varias referencias del código original (resiarMarkViewState,
// resiarSetWhatsAppVisible, resiarUserIsAdmin, resiarEnsureModernConfigHome,
// resiarTopicQuestionCount) se resuelven vía identificador global (quedan
// expuestas en window por sus módulos de origen) y no necesitan inyección.

import { PROVINCIA_VALUE, EU_VALUE, esProvinciaBsAs, esExamenUnico, labelExamen } from '../utils/examFilters.js';
import { planUsesTrialQuestionCache } from './trialAccess.js';
import { espLabel, temaRaw, normalizeSearchText } from '../utils/text.js';
import { questionMatchesAnyTopic, topicMatchesFilter } from '../services/examSelection.js';

const deps = {
  getQuestions: () => [],
  getCurrentUser: () => null,
  getServerAccess: () => '',
  getCurrentProfile: () => null,
  getQuestionBankVersion: () => '',
  getFiltroExamenValue: () => 'todos',
  getFiltroAnioMirValue: () => 'todos',
  getQuestionChatState: () => null,
  getQuestionChatClose: () => null,
  getQuestionChatDisconnect: () => null,
  getCerrarModal: () => () => {},
  getCerrarReview: () => () => {},
  getResiarIsLegacyConfigPlaceholder: () => () => false,
  getResiarSyncReviewErrorsButton: () => () => {},
  getDeseleccionarEspecialidades: () => null,
  setMostrarPantallaBienvenida: () => {}
};

export function configureHomeConfigurator(overrides = {}) {
  Object.assign(deps, overrides || {});

  let _homeRenderRAF = 0;
  let _homeWrapped = false;
  let _homeTopicCacheKey = '';
  let _homeTopicCacheSample = [];
  let _homeTopicStatsCacheKey = '';
  let _homeTopicStatsCache = null;
  let _homeCatalogStatsCacheKey = '';
  let _homeCatalogStatsCache = null;
  const _homeSelectedTopics = new Map();

  function qs(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function questions(){ try { const qs2 = deps.getQuestions(); return Array.isArray(qs2) ? qs2 : []; } catch(_) { return []; } }
  function getEu(){ try { return EU_VALUE; } catch(_) { return '__EU__'; } }
  function getProv(){ try { return PROVINCIA_VALUE; } catch(_) { return '__PROVINCIA_BA__'; } }
  function bankKey(p){
    const ex = (p && p.examen) || '';
    try { if (typeof esProvinciaBsAs === 'function' && esProvinciaBsAs(ex)) return getProv(); } catch(_) {}
    try { if (typeof esExamenUnico === 'function' && esExamenUnico(ex)) return getEu(); } catch(_) {}
    return String(ex || 'Sin examen');
  }
  function bankLabel(k){
    try { if (typeof labelExamen === 'function') return labelExamen(k); } catch(_) {}
    if (k === getProv()) return 'Provincia de Buenos Aires';
    if (k === getEu()) return 'Examen Único';
    return String(k || 'Sin examen');
  }
  function yearOf(p){
    const y = p && (p.anio ?? p.año ?? p.year);
    if (y !== undefined && y !== null && y !== '') return String(y);
    const m = String((p && p.examen) || '').match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : 's/año';
  }
  function isEnarmBankHome(bank){
    const raw = String(bank || '');
    const lbl = String(bankLabel(bank) || '');
    return (raw + ' ' + lbl).toUpperCase().includes('ENARM');
  }
  function isEnarmQuestionHome(p){ return isEnarmBankHome(bankKey(p)); }
  function pairKey(p){ return bankKey(p) + '::' + yearOf(p); }
  function espOf(p){ try { return espLabel(p); } catch(_) { return (p && (p.especialidad_v2 || p.especialidad)) || 'General'; } }
  function temaOf(p){ try { return temaRaw(p); } catch(_) { return (p && (p.tema_v2 || p.tema)) || ''; } }
  function homeTopicKey(v){ return normalizeSearchText(v || ''); }
  function homeSelectedTopicValues(){ return Array.from(_homeSelectedTopics.values()).filter(Boolean); }
  function homeSyncNativeTopicInput(){
    const native = qs('buscadorTema');
    if (!native) return;
    const selected = homeSelectedTopicValues();
    const val = selected.join(' · ');
    if (native.value !== val) native.value = val;
  }
  function mixedDebug(){ try { return typeof window.mixedExamFilterDebug === 'function' ? window.mixedExamFilterDebug() : null; } catch(_) { return null; } }

  function homeUsesTrialBankTotals(){
    try {
      return planUsesTrialQuestionCache(deps.getServerAccess() || deps.getCurrentProfile()?.plan || '');
    } catch (_) { return false; }
  }

  function homeCountMarkup(visible, full, cssClass = ''){
    const v = Math.max(Number(visible) || 0, 0);
    const f = Math.max(Number(full) || 0, 0);
    const cls = cssClass ? ' ' + cssClass : '';
    if (homeUsesTrialBankTotals() && f > v) {
      const missing = f - v;
      return '<span class="trial-count-pair' + cls + '" title="Disponibles en tu plan: ' + esc(v) + ' de ' + esc(f) + ' preguntas. No incluidas: ' + esc(missing) + '."><span class="trial-count-visible">' + esc(v) + '</span><span class="trial-count-sep">/</span><span class="trial-count-full">' + esc(f) + '</span></span>';
    }
    return '<span class="trial-count-single' + cls + '">' + esc(v) + '</span>';
  }
  function selectedMixedSet(){ const d = mixedDebug(); return d && Array.isArray(d.selected) ? new Set(d.selected.map(String)) : new Set(); }
  function selectedSpecialtyRaws(){
    const out = new Set();
    document.querySelectorAll('.espCheck:checked').forEach(cb => {
      try { JSON.parse(cb.value).forEach(v => out.add(v)); }
      catch(_) { out.add(cb.value); }
    });
    return out;
  }
  function currentFilteredQuestions(opts){
    opts = opts || {};
    let list = questions().slice();
    const mixed = selectedMixedSet();
    if (mixed.size) {
      list = list.filter(p => mixed.has(pairKey(p)));
    } else {
      try {
        const filtroExamenValue = deps.getFiltroExamenValue();
        const filtroAnioMirValue = deps.getFiltroAnioMirValue();
        if (filtroExamenValue === getProv()) list = list.filter(p => esProvinciaBsAs(p.examen));
        else if (filtroExamenValue === getEu()) list = list.filter(p => esExamenUnico(p.examen));
        else if (filtroExamenValue && filtroExamenValue !== 'todos') list = list.filter(p => p.examen == filtroExamenValue);
        if (filtroAnioMirValue && filtroAnioMirValue !== 'todos') list = list.filter(p => yearOf(p) === String(filtroAnioMirValue));
      } catch(_) {}
    }
    const raws = selectedSpecialtyRaws();
    if (raws.size) list = list.filter(p => raws.has(espOf(p)));
    if (!opts.ignoreTopic) {
      const selectedTopics = homeSelectedTopicValues().filter(Boolean);
      if (selectedTopics.length) {
        list = list.filter(p => questionMatchesAnyTopic(p, selectedTopics, {
          getTopic: temaOf,
          normalizeText: normalizeSearchText,
          matchMode: 'exact'
        }));
      }
    }
    return list;
  }
  window.resiarGetCurrentFilteredQuestions = function(opts){
    try { return currentFilteredQuestions(opts || {}); } catch(_) { return questions(); }
  };
  window.resiarHomeSelectedTopicValues = function(){
    try { return homeSelectedTopicValues(); } catch(_) { return []; }
  };
  function selectedBankSummary(){
    const d = mixedDebug();
    if (d && Array.isArray(d.groups) && Array.isArray(d.selected) && d.selected.length) {
      const selected = new Set(d.selected.map(String));
      const labels = [];
      d.groups.forEach(g => {
        const label = String(g.label || bankLabel(g.bank));
        const ys = (g.years || []).filter(y => selected.has(String(g.bank) + '::' + String(y.year))).map(y => y.year);
        if (!ys.length) return;
        if (isEnarmBankHome(g.bank)) labels.push(label + ' Todas');
        else labels.push(label + ' ' + ys.join(', '));
      });
      return labels.length ? labels.join(' · ') : d.selected.length + ' combinaciones';
    }
    try {
      const filtroExamenValue = deps.getFiltroExamenValue();
      const filtroAnioMirValue = deps.getFiltroAnioMirValue();
      if (filtroExamenValue && filtroExamenValue !== 'todos') return bankLabel(filtroExamenValue) + (filtroAnioMirValue && filtroAnioMirValue !== 'todos' ? ' ' + filtroAnioMirValue : '');
    } catch(_) {}
    return 'Todos los bancos y años';
  }
  function specialtySummary(){
    const selected = [...document.querySelectorAll('.espCheck:checked')].map(cb => labelFromCheckbox(cb)).filter(Boolean);
    if (!selected.length) return 'Todas las especialidades';
    if (selected.length <= 3) return selected.join(' · ');
    return selected.slice(0,3).join(' · ') + ' +' + (selected.length - 3);
  }
  function labelFromCheckbox(cb){
    const label = cb && cb.closest('.esp-label');
    if (!label) return '';
    const span = [...label.querySelectorAll('span')].find(s => !s.classList.contains('esp-n'));
    return span ? span.textContent.trim() : label.textContent.trim().replace(/\d+$/,'').trim();
  }
  function countFromCheckbox(cb){
    const n = cb && cb.closest('.esp-label')?.querySelector('.esp-n');
    return n ? n.textContent.trim() : '';
  }
  function shortNum(n){ return n >= 1000 ? '+' + Math.floor(n/1000) + '.' + String(Math.floor((n%1000)/100)) + 'k' : String(n); }
  function homeRandomSample(list, key, limit){
    if (_homeTopicCacheKey === key && _homeTopicCacheSample.length) return _homeTopicCacheSample.slice(0, limit);
    const arr = (list || []).slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    _homeTopicCacheKey = key;
    _homeTopicCacheSample = arr.slice(0, limit);
    return _homeTopicCacheSample.slice();
  }
  function homeCatalogStatsKey(){
    let version = '';
    try { version = String(deps.getQuestionBankVersion() || window.__resiarQuestionBankVersion || ''); } catch (_) {}
    let qCount = 0;
    try { qCount = questions().length; } catch (_) {}
    return version + '@@' + qCount;
  }

  function homeGetCatalogStats(){
    const cacheKey = homeCatalogStatsKey();
    if (_homeCatalogStatsCache && _homeCatalogStatsCacheKey === cacheKey) return _homeCatalogStatsCache;
    const list = questions();
    _homeCatalogStatsCacheKey = cacheKey;
    _homeCatalogStatsCache = {
      total: list.length,
      espCount: new Set(list.map(espOf).filter(Boolean)).size
    };
    return _homeCatalogStatsCache;
  }

  function homeTopicStatsKey(){
    let mixed = '';
    let specialty = '';
    try { mixed = Array.from(selectedMixedSet()).sort().join('|'); } catch (_) {}
    try { specialty = Array.from(selectedSpecialtyRaws()).sort().join('|'); } catch (_) {}
    let version = '';
    try { version = String(deps.getQuestionBankVersion() || window.__resiarQuestionBankVersion || ''); } catch (_) {}
    let qCount = 0;
    try { qCount = questions().length; } catch (_) {}
    return [version, qCount, String(deps.getFiltroExamenValue() || ''), String(deps.getFiltroAnioMirValue() || ''), mixed, specialty].join('@@');
  }

  function homeGetTopicStats(){
    const cacheKey = homeTopicStatsKey();
    if (_homeTopicStatsCache && _homeTopicStatsCacheKey === cacheKey) return _homeTopicStatsCache;

    const counts = new Map();
    currentFilteredQuestions({ ignoreTopic:true }).forEach(p => {
      const label = String(temaOf(p) || '').trim();
      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    if (!counts.size) {
      let fallbackTopics = [];
      try { fallbackTopics = Array.isArray(window._todosLosTemas) ? window._todosLosTemas : []; } catch(_) { fallbackTopics = []; }
      fallbackTopics.forEach(label => {
        if (!label || counts.has(label)) return;
        let count = 0;
        try { count = typeof resiarTopicQuestionCount === 'function' ? resiarTopicQuestionCount(label) : 0; } catch (_) { count = 0; }
        counts.set(label, Number(count) || 0);
      });
    }

    const rows = Array.from(counts.entries()).map(([label, count]) => ({
      label,
      count: Number(count) || 0,
      key: homeTopicKey(label)
    }));

    _homeTopicStatsCacheKey = cacheKey;
    const exactCounts = new Map();
    rows.forEach(row => {
      if (!row || !row.key) return;
      exactCounts.set(row.key, (Number(exactCounts.get(row.key)) || 0) + (Number(row.count) || 0));
    });

    _homeTopicStatsCache = {
      key: cacheKey,
      counts,
      rows,
      baseCount: rows.reduce((acc, row) => acc + (Number(row.count) || 0), 0),
      exactCounts
    };
    return _homeTopicStatsCache;
  }

  function homeTopicEffectiveCount(stats, topicValue){
    if (!stats) return 0;
    const key = homeTopicKey(topicValue);
    if (!key) return 0;
    if (stats.exactCounts && stats.exactCounts.has(key)) return Number(stats.exactCounts.get(key)) || 0;
    const row = Array.isArray(stats.rows) ? stats.rows.find(item => item && item.key === key) : null;
    return row ? Number(row.count) || 0 : 0;
  }

  function homeCountForTopicKeys(stats, normalizedTopicKeys){
    const labels = (Array.isArray(normalizedTopicKeys) ? normalizedTopicKeys : []).map(String).map(v => v.trim()).filter(Boolean);
    if (!labels.length) return Math.max(Number(stats?.baseCount) || 0, 0);
    const seen = new Set();
    let total = 0;
    labels.forEach(label => {
      const key = homeTopicKey(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      total += Number(stats?.exactCounts?.get(key)) || 0;
    });
    return total;
  }

  function resiarDisableQuestionChat(){
    try { if (document.body.dataset.resiarView === 'exam' && window._resiarExamFinished !== true) return; } catch(_) {}
    try { const fn = deps.getQuestionChatClose(); if (typeof fn === 'function') fn(); } catch(_) {}
    try { const fn = deps.getQuestionChatDisconnect(); if (typeof fn === 'function') fn(true); } catch(_) {}
    try { const st = deps.getQuestionChatState(); if (st) { st.open = false; st.unread = 0; st.inviteOpen = false; st.status = ''; } } catch(_) {}
    try { document.querySelectorAll('#qchatRoot,.qchat-root,#qchatFab,#qchatWindow,.qinvite-toast,.qinvite-toast-wrap').forEach(el => el.remove()); } catch(_) {}
  }
  window.resiarDisableQuestionChat = resiarDisableQuestionChat;

  function resiarHomeAdminRefreshMarkup(){
    try { if (!resiarUserIsAdmin()) return ''; } catch (_) { return ''; }
    return `
                    <button class="home-secondary home-admin-refresh-btn" data-action="refresh-question-bank" id="homeRefreshBankBtn" data-admin-only="true" title="Publica una nueva versión global del banco y fuerza lectura nueva desde Supabase">↻ Actualizar banco global</button>`;
  }

  function homeMarkup(){
    return `
      <div id="welcome" class="home-sim">
        <div class="home-shell">
          <section class="home-hero-card">
            <div class="home-hero-copy">
              <div class="home-eyebrow"><span class="home-eyebrow-dot"></span> Simulador listo</div>
              <h1 class="home-title"><span>Configurá tu examen</span><em>desde acá.</em></h1>
              <p class="home-sub">El panel principal concentra <strong>bancos, años, especialidades, temas, búsqueda y modos de práctica</strong>. Una vez que ajustaste todo, empezá haciendo click en el botón Generar examen.</p>
              <div class="home-hero-actions">
                <button class="home-primary" data-action="home-start-exam"><span>▶</span><span>Generar examen</span></button>
                <div class="home-search-cta">
                  <div class="home-search-button-row">
                    <button class="home-secondary" data-action="home-open-search">🔎 Buscar pregunta</button>${resiarHomeAdminRefreshMarkup()}
                  </div>
                  <div class="home-search-copy">¿Estás buscando algo en concreto? Encontralo acá.</div>
                </div>
              </div>
            </div>
            <div class="home-hero-visual">
              <div class="home-visual-top">
                <div class="home-metric"><div class="home-metric-val" id="homeMetricPreguntas">—</div><div class="home-metric-lbl">Preguntas</div></div>
                <div class="home-metric"><div class="home-metric-val" id="homeMetricEsp">—</div><div class="home-metric-lbl">Especialidades</div></div>
                <div class="home-metric"><div class="home-metric-val" id="homeMetricPool">—</div><div class="home-metric-lbl">Resultado</div></div>
              </div>
              <div class="home-summary-glass">
                <div class="home-summary-line"><div class="home-summary-label">Banco</div><div class="home-summary-value" id="homeSumBanco">—</div></div>
                <div class="home-summary-line"><div class="home-summary-label">Especialidad</div><div class="home-summary-value" id="homeSumEsp">—</div></div>
                <div class="home-summary-line"><div class="home-summary-label">Tema</div><div class="home-summary-value" id="homeSumTema">—</div></div>
              </div>
            </div>
          </section>

          <section class="home-config-grid">
            <div class="home-left-stack">
              <article class="home-card home-card-wide">
                <div class="home-card-head">
                  <div><div class="home-card-kicker">01 · Banco y año</div><div class="home-card-title">Mezclá exámenes desde el panel principal</div><div class="home-card-desc">Seleccioná bancos completos o años individuales.</div></div>
                  <button class="home-mini-btn" data-action="home-mixed-clear">Limpiar</button>
                </div>
                <div id="homeMixedExamRoot"></div>
              </article>

              <article class="home-card home-specialties-card">
                <div class="home-card-head">
                  <div><div class="home-card-kicker">02 · Especialidades</div><div class="home-card-title">Enfocá el contenido</div><div class="home-card-desc">Tocá una o varias especialidades.</div></div>
                  <button class="home-mini-btn" data-action="home-clear-specialties">Limpiar</button>
                </div>
                <input id="homeEspSearch" class="home-search" placeholder="Filtrar especialidades..." data-input-action="home-specialties-refresh">
                <div id="homeEspecialidadesGrid" class="home-esp-grid" style="margin-top:11px;"></div>
              </article>

              <article class="home-card home-topic-card">
                <div class="home-card-head">
                  <div><div class="home-card-kicker">03 · Tema y búsqueda</div><div class="home-card-title">Ajuste fino</div><div class="home-card-desc">Filtrá por tema o buscá una pregunta puntual.</div></div>
                </div>
                <div class="home-topic-box">
                  <input id="homeTemaInput" class="home-search" placeholder="Buscar tema..." data-input-action="home-topic">
                  <div class="home-topic-actions">
                    <button class="home-secondary" data-action="home-clear-topic">Limpiar tema</button>
                    <button class="home-secondary" data-action="home-open-search">Buscar pregunta</button>
                  </div>
                  <div id="homeTemaSugerencias" class="home-topic-sugs"></div>
                </div>
              </article>
            </div>

              <article class="home-card home-card-wide home-special-modes-card">
                <div class="home-card-head">
                  <div><div class="home-card-kicker">04 · Modos especiales</div><div class="home-card-title">Debilidades y examen por errores</div><div class="home-card-desc">Accesos directos para practicar con tus puntos flojos o rehacer preguntas falladas del historial.</div></div>
                </div>
                <div class="home-action-grid">
                  <button class="home-action home-action-large" id="homeBtnSmart" data-action="start-smart-exam"><b>🎯 Debilidades</b><span>Genera un examen enfocado en tus puntos flojos según tu rendimiento histórico.</span></button>
                  <button class="home-action home-action-large" id="homeBtnRepaso" data-action="start-review-errors"><b>🔁 Errores</b><span>Arma un examen de 50 preguntas con errores activos, recurrentes, corregidos y refuerzo asociado.</span></button>
                  <button class="home-action home-action-large home-action-biblio" data-biblio-action="open"><b>📚 Práctica con bibliografía 2026</b><span>Preguntas elaboradas con herramientas de Google a partir de bibliografía oficial, con pista, explicación por opción, estadísticas y ranking propios.</span></button>
                  <button class="home-action home-action-large home-action-vaccines" data-vaccine-action="open"><b>💉 Práctica interactiva de vacunas</b><span>Casos clínicos interactivos, con corrección inmediata de vacunas correctas, faltantes e incorrectas.</span></button>
                </div>
              </article>
          </section>

        </div>
      </div>`;
  }

  function resiarHomeHideExamChrome(){
    try { document.getElementById('rightPanel')?.classList.remove('vis'); } catch(_) {}
    try { document.getElementById('statsBox')?.classList.remove('vis'); } catch(_) {}
    try { document.getElementById('navBox')?.classList.remove('vis'); } catch(_) {}
    try { document.getElementById('rachaBox')?.classList.remove('vis'); } catch(_) {}
    try { document.getElementById('rachaPill')?.classList.remove('vis'); } catch(_) {}
    try { const n = document.getElementById('navBox'); if (n) n.innerHTML = ''; } catch(_) {}
    try { const rp = document.getElementById('rpNotaEditor'); if (rp) rp.style.display = 'none'; } catch(_) {}
    try { resiarDisableQuestionChat(); } catch(_) {}
    try { const fn = deps.getQuestionChatClose(); if (typeof fn === 'function') fn(); } catch(_) {}
    try { const st = deps.getQuestionChatState(); if (st) { st.open = false; st.unread = 0; st.inviteOpen = false; } } catch(_) {}
    try { document.querySelectorAll('#qchatRoot,.qchat-root,#qchatFab,#qchatWindow,.qinvite-toast,.qinvite-toast-wrap').forEach(el => el.remove()); } catch(_) {}
    try { if (typeof resiarSetWhatsAppVisible === 'function') resiarSetWhatsAppVisible(false); } catch(_) {}
  }
  window.resiarHomeHideExamChrome = resiarHomeHideExamChrome;

  function resiarRenderHome(forcePublic){
    try { resiarHomeHideExamChrome(); } catch(_) {}
    try { if (typeof resiarMarkViewState === 'function') resiarMarkViewState('config'); } catch(_) {}
    try { if (typeof resiarSetWhatsAppVisible === 'function') resiarSetWhatsAppVisible(false); } catch(_) {}
    const box = qs('preguntaBox');
    if (!box) return;
    box.innerHTML = homeMarkup();
    try { if (typeof resiarSyncViewState === 'function') resiarSyncViewState(); } catch(_) {}
    installHomeHooks();
    scheduleHomeRefresh();
    if (forcePublic) {
      try {
        const sub = box.querySelector('.home-sub');
        if (sub) sub.innerHTML = 'Explorá la configuración principal con una experiencia más clara, visual y ordenada. Cuando quieras generar o continuar, te vamos a pedir iniciar sesión.';
      } catch(_) {}
    }
  }
  window.resiarRenderHome = resiarRenderHome;
  try {
    if (window.__resiarPendingModernHomeRender || deps.getResiarIsLegacyConfigPlaceholder()()) {
      window.__resiarPendingModernHomeRender = false;
      resiarRenderHome(false);
    }
  } catch (_) {}

  function irAConfigurarNuevoExamen(){
    try { window._resiarExamRunning = false; window._resiarExamFinished = true; if (typeof resiarMarkViewState === 'function') resiarMarkViewState('config'); } catch(_) {}
    try { deps.getCerrarReview()(); } catch(_) {}
    try { deps.getCerrarModal()(); } catch(_) {}
    try { resiarRenderHome(false); } catch(_) {}
    try { const box = document.getElementById('preguntaBox'); if (box) box.scrollTop = 0; } catch(_) {}
  }
  window.irAConfigurarNuevoExamen = irAConfigurarNuevoExamen;

  window.mostrarPantallaBienvenida = function(){
    try { if (!deps.getCurrentUser()) return; } catch(_) {}
    try { resiarRenderHome(false); } catch(_) {}
  };
  try { deps.setMostrarPantallaBienvenida(window.mostrarPantallaBienvenida); } catch(_) {}

  // Si la pantalla legacy quedó dibujada por una carrera de carga previa,
  // reintentar con el home moderno. No depende de preguntas.length: el shell
  // moderno también puede renderizar mientras los grupos terminan de cargar.
  try { resiarEnsureModernConfigHome('home-renderer-installed'); } catch(_) {}

  function homeCompletionStats(ids){
    try {
      if (typeof window.resiarExamCompletionStatsForIds === 'function') {
        return window.resiarExamCompletionStatsForIds(ids || []);
      }
    } catch (_) {}
    return { total:0, done:0, complete:false };
  }

  function homeCompletionBadge(ids, label = 'Examen completado'){
    const stats = homeCompletionStats(ids);
    if (!stats || !stats.complete) return '';
    return '<span class="mixed-exam-completed" title="' + esc(label + ': ya respondiste todas las preguntas al menos una vez') + '" aria-label="' + esc(label) + '">✓</span>';
  }

  function homeCompletionBankPill(ids){
    const stats = homeCompletionStats(ids);
    if (!stats || !stats.complete) return '';
    return '<span class="mixed-exam-bank-completed" title="Ya respondiste todas las preguntas de este banco al menos una vez">✓ Completo</span>';
  }

  function renderHomeMixed(){
    const root = qs('homeMixedExamRoot');
    if (!root) return;
    let d = mixedDebug();
    if ((!d || !Array.isArray(d.groups) || !d.groups.length) && questions().length && typeof window.mixedExamFilterRefresh === 'function') {
      try { window.mixedExamFilterRefresh(); } catch(_) {}
      d = mixedDebug();
    }
    if (!d || !Array.isArray(d.groups) || !d.groups.length) {
      root.innerHTML = '<div class="home-empty">Cargando bancos y años…</div>';
      return;
    }
    const selected = new Set((d.selected || []).map(String));
    const selectedTxt = selected.size ? '<strong>' + selected.size + '</strong> combinación' + (selected.size === 1 ? '' : 'es') + ' seleccionada' + (selected.size === 1 ? '' : 's') : 'Sin selección específica: se usan <strong>todos los exámenes</strong>.';
    root.innerHTML = '<div class="home-mixed-selected">' + selectedTxt + '</div>' +
      '<div class="home-bank-groups">' + d.groups.map(g => {
        const years = Array.isArray(g.years) ? g.years : [];
        const total = Number(g.total || 0);
        const fullTotal = Number(g.fullTotal || total);
        const label = g.label || bankLabel(g.bank);
        const isEnarm = isEnarmBankHome(g.bank);
        if (isEnarm) {
          const all = years.length && years.every(y => selected.has(String(g.bank) + '::' + String(y.year)));
          const any = years.some(y => selected.has(String(g.bank) + '::' + String(y.year)));
          const bankDone = homeCompletionStats(g.questionIds).complete;
          const bankPill = homeCompletionBankPill(g.questionIds);
          return '<div class="home-bank-group home-bank-group-enarm"><div class="home-bank-head"><div class="home-bank-name" title="' + esc(label) + '">' + esc(label) + '</div><div style="display:flex;align-items:center;gap:7px;">' + homeCountMarkup(total, fullTotal, 'home-bank-total') + '' + bankPill + '<button class="home-mini-btn" style="padding:5px 8px;font-size:.62rem;" data-action="home-mixed-toggle-bank" data-bank="' + esc(String(g.bank)) + '">' + (all ? 'Quitar' : 'Todo') + '</button></div></div>' +
            '<div class="home-year-chips"><button class="home-chip ' + (any ? 'active ' : '') + (bankDone ? 'completed' : '') + '" data-action="home-mixed-toggle-bank" data-bank="' + esc(String(g.bank)) + '">Todas<small>' + homeCountMarkup(total, fullTotal) + '</small>' + homeCompletionBadge(g.questionIds, 'Banco completo') + '</button><div class="home-enarm-note">ENARM se elige como cualquier banco, pero no muestra años porque no están identificados.</div></div></div>';
        }
        const all = years.length && years.every(y => selected.has(String(g.bank) + '::' + String(y.year)));
        const bankPill = homeCompletionBankPill(g.questionIds);
        return '<div class="home-bank-group"><div class="home-bank-head"><div class="home-bank-name" title="' + esc(label) + '">' + esc(label) + '</div><div style="display:flex;align-items:center;gap:7px;">' + homeCountMarkup(total, fullTotal, 'home-bank-total') + '' + bankPill + '<button class="home-mini-btn" style="padding:5px 8px;font-size:.62rem;" data-action="home-mixed-toggle-bank" data-bank="' + esc(String(g.bank)) + '">' + (all ? 'Quitar' : 'Todo') + '</button></div></div>' +
          '<div class="home-year-chips">' + years.map(y => {
            const key = String(g.bank) + '::' + String(y.year);
            const yearDone = homeCompletionStats(y.questionIds).complete;
            return '<button class="home-chip ' + (selected.has(key) ? 'active ' : '') + (yearDone ? 'completed' : '') + '" data-action="home-mixed-toggle" data-key="' + esc(key) + '">' + esc(y.year) + '<small>' + homeCountMarkup(y.count || 0, y.fullCount || y.count || 0) + '</small>' + homeCompletionBadge(y.questionIds, 'Examen completado') + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>';
  }

  function renderHomeSpecialties(){
    const grid = qs('homeEspecialidadesGrid');
    if (!grid) return;
    const term = normalizeSearchText(qs('homeEspSearch')?.value || '');
    const checks = [...document.querySelectorAll('#checklistEspecialidades .espCheck')];
    if (!checks.length) { grid.innerHTML = '<div class="home-empty">Cargando especialidades…</div>'; return; }
    const items = checks.map((cb, idx) => ({ cb, idx, label:labelFromCheckbox(cb), count:countFromCheckbox(cb), active:cb.checked }))
      .filter(x => !term || normalizeSearchText(x.label).includes(term));
    if (!items.length) { grid.innerHTML = '<div class="home-empty">Sin coincidencias.</div>'; return; }
    grid.innerHTML = items.map(x => '<button class="home-esp-chip ' + (x.active ? 'active' : '') + '" data-action="home-toggle-specialty" data-index="' + x.idx + '">' + esc(x.label) + '<span class="home-esp-count">' + esc(x.count) + '</span></button>').join('');
  }

  function renderHomeTopics(){
    const input = qs('homeTemaInput');
    const box = qs('homeTemaSugerencias');
    if (!box) return;

    const term = normalizeSearchText(input?.value || '');
    const selectedValues = homeSelectedTopicValues();
    const selectedKeys = new Set(selectedValues.map(homeTopicKey).filter(Boolean));
    const stats = homeGetTopicStats();

    let topicRows = Array.isArray(stats.rows) ? stats.rows.slice() : [];
    if (term) topicRows = topicRows.filter(row => topicMatchesFilter(row.label, input?.value || '', normalizeSearchText));

    topicRows.sort((a, b) => {
      const ak = selectedKeys.has(a.key) ? 1 : 0;
      const bk = selectedKeys.has(b.key) ? 1 : 0;
      return bk - ak || (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.label).localeCompare(String(b.label), 'es', { sensitivity:'base' });
    });

    topicRows = topicRows.slice(0, 12);

    const selectedHtml = selectedValues.length
      ? '<div class="home-topic-selected"><span>Temas seleccionados</span>'
        + selectedValues.map(t => '<button class="home-topic-selected-chip" data-action="home-set-topic" data-topic="' + esc(t) + '">' + esc(t) + '<small>×</small></button>').join('')
        + '</div>'
      : '';

    const suggestionHtml = topicRows.length
      ? topicRows.map(row => {
          const active = selectedKeys.has(row.key);
          const displayCount = Number(row.count) || 0;
          return '<button class="home-topic-sug ' + (active ? 'active' : '') + '" data-action="home-set-topic" data-topic="' + esc(row.label) + '"><span class="home-topic-name">' + esc(row.label) + '</span><span class="home-topic-count">' + esc(displayCount) + '</span></button>';
        }).join('')
      : '<div class="home-empty" style="width:100%;padding:11px;">Sin temas sugeridos.</div>';

    box.innerHTML = selectedHtml + suggestionHtml;
  }

  function renderHomeSummary(){
    const catalogStats = homeGetCatalogStats();
    const total = catalogStats.total;
    const espCount = catalogStats.espCount;
    const selectedTopics = homeSelectedTopicValues();
    const topicSearch = qs('homeTemaInput')?.value.trim() || '';
    const topic = selectedTopics.length ? selectedTopics.join(' · ') : topicSearch;
    let filtered = 0;
    try {
      const stats = homeGetTopicStats();
      filtered = homeCountForTopicKeys(stats, selectedTopics);
    } catch (_) {
      filtered = currentFilteredQuestions().length;
    }
    const setText = (id, html) => { const el = qs(id); if (el) el.innerHTML = html; };
    setText('homeMetricPreguntas', total ? shortNum(total) : '—');
    setText('homeMetricEsp', espCount || '—');
    setText('homeMetricPool', filtered || '0');
    setText('homeSumBanco', '<strong>' + esc(selectedBankSummary()) + '</strong>');
    setText('homeSumEsp', '<strong>' + esc(specialtySummary()) + '</strong>');
    setText('homeSumTema', selectedTopics.length
      ? '<strong>' + esc(selectedTopics.length + ' tema' + (selectedTopics.length === 1 ? '' : 's')) + '</strong> · ' + esc(topic)
      : (topicSearch ? 'Buscando tema: <strong>' + esc(topicSearch) + '</strong> · seleccioná uno para filtrar' : 'Sin filtro por tema'));
    setText('homeSumPool', '<strong>' + filtered + '</strong> pregunta' + (filtered === 1 ? '' : 's') + ' disponible' + (filtered === 1 ? '' : 's') + ' con esta configuración.');

    const smart = qs('homeBtnSmart');
    const repaso = qs('homeBtnRepaso');
    // Los botones internos legacy permanecen deshabilitados porque ya no son UI operativa.
    // No deben marcar como bloqueados los accesos nuevos del home; cada acción valida permisos al ejecutarse.
    if (smart) { smart.classList.remove('is-disabled'); smart.disabled = false; smart.removeAttribute('aria-disabled'); }
    if (repaso) { repaso.classList.remove('is-disabled'); repaso.disabled = false; repaso.removeAttribute('aria-disabled'); }
    try { deps.getResiarSyncReviewErrorsButton()(); } catch (_) {}
  }

  function renderCountdown(){
    const el = qs('homeCountdownMini');
    if (!el) return;
    const exams = [
      { name:'Neuquén', date:'2026-05-04' },
      { name:'San Juan', date:'2026-05-28' },
      { name:'CABA', date:'2026-06-10' },
      { name:'Misiones', date:'2026-06-16' },
      { name:'Santa Fe — Básicas', date:'2026-06-17' },
      { name:'Nación — Medicina', date:'2026-07-07' },
      { name:'Provincia de Buenos Aires', date:null }
    ];
    const now = new Date(); now.setHours(0,0,0,0);
    const days = d => d ? Math.round((new Date(d + 'T00:00:00') - now) / 86400000) : null;
    const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'}) : 'a confirmar';
    const upcoming = exams.map(e => ({...e, days:days(e.date)})).filter(e => e.days === null || e.days > 0).slice(0,3);
    el.innerHTML = upcoming.map(e => '<div class="home-date-card ' + (e.days !== null && e.days <= 14 ? 'hot' : '') + '"><div class="home-date-name">' + esc(e.name) + '</div><div class="home-date-meta">' + esc(fmt(e.date)) + '</div><div class="home-date-days">' + (e.days === null ? '?' : e.days) + '</div><div class="home-date-meta">' + (e.days === null ? 'por confirmar' : 'días') + '</div></div>').join('');
  }

  function renderAll(){
    _homeRenderRAF = 0;
    if (!qs('welcome') || !qs('homeMixedExamRoot')) return;
    renderHomeMixed();
    renderHomeSpecialties();
    renderHomeTopics();
    renderHomeSummary();
  }
  function scheduleHomeRefresh(){
    if (_homeRenderRAF) cancelAnimationFrame(_homeRenderRAF);
    _homeRenderRAF = requestAnimationFrame(renderAll);
  }
  window.resiarHomeRefresh = scheduleHomeRefresh;

  let _homeEspRenderRAF = 0;
  window.resiarHomeRefreshSpecialties = function(){
    if (_homeEspRenderRAF) cancelAnimationFrame(_homeEspRenderRAF);
    _homeEspRenderRAF = requestAnimationFrame(function(){
      _homeEspRenderRAF = 0;
      if (!qs('welcome') || !qs('homeEspecialidadesGrid')) return;
      renderHomeSpecialties();
      renderHomeSummary();
    });
  };

  let _homeTopicRenderRAF = 0;
  window.resiarHomeRefreshTopic = function(){
    if (_homeTopicRenderRAF) cancelAnimationFrame(_homeTopicRenderRAF);
    _homeTopicRenderRAF = requestAnimationFrame(function(){
      _homeTopicRenderRAF = 0;
      if (!qs('welcome') || !qs('homeTemaSugerencias')) return;
      renderHomeTopics();
      renderHomeSummary();
    });
  };

  window.resiarHomeMixedToggle = function(key){ if (typeof window.mixedExamFilterToggle === 'function') window.mixedExamFilterToggle(key); scheduleHomeRefresh(); };
  window.resiarHomeMixedToggleBank = function(bank){ if (typeof window.mixedExamFilterToggleBank === 'function') window.mixedExamFilterToggleBank(bank); scheduleHomeRefresh(); };
  window.resiarHomeMixedClear = function(){ if (typeof window.mixedExamFilterClear === 'function') window.mixedExamFilterClear(); scheduleHomeRefresh(); };
  window.resiarHomeToggleSpecialty = function(idx){
    const cb = [...document.querySelectorAll('#checklistEspecialidades .espCheck')][idx];
    if (!cb) return;
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change', { bubbles:true }));
    if (typeof window.resiarHomeRefreshSpecialties === 'function') window.resiarHomeRefreshSpecialties();
    if (typeof window.resiarHomeRefreshTopic === 'function') window.resiarHomeRefreshTopic();
  };
  window.resiarHomeClearSpecialties = function(){
    try { const fn = deps.getDeseleccionarEspecialidades(); if (typeof fn === 'function') fn(); }
    catch(_) { document.querySelectorAll('.espCheck').forEach(cb => cb.checked = false); }
    if (typeof window.resiarHomeRefreshSpecialties === 'function') window.resiarHomeRefreshSpecialties();
    if (typeof window.resiarHomeRefreshTopic === 'function') window.resiarHomeRefreshTopic();
  };
  window.resiarHomeSetTopic = function(v, exact){
    const home = qs('homeTemaInput');
    const val = v == null ? '' : String(v).trim();

    if (exact) {
      // v100: conservar el texto escrito al marcar/desmarcar un tema.
      // Esto permite buscar una palabra, por ejemplo "anemia", y marcar varios
      // temas que coincidan sin tener que volver a escribir la búsqueda.
      const previousSearch = home ? String(home.value || '') : '';

      const key = homeTopicKey(val);
      if (key) {
        if (_homeSelectedTopics.has(key)) _homeSelectedTopics.delete(key);
        else _homeSelectedTopics.set(key, val);
      }

      if (home) {
        home.value = previousSearch;
        try {
          if (previousSearch) {
            const len = home.value.length;
            home.focus({ preventScroll: true });
            home.setSelectionRange(len, len);
          }
        } catch (_) {}
      }

      homeSyncNativeTopicInput();
    } else if (home && document.activeElement !== home && home.value !== val) {
      home.value = val;
    }

    if (typeof window.resiarHomeRefreshTopic === 'function') window.resiarHomeRefreshTopic();
  };
  window.resiarHomeClearTopic = function(){
    _homeSelectedTopics.clear();
    const native = qs('buscadorTema');
    const home = qs('homeTemaInput');
    if (native) native.value = '';
    if (home) home.value = '';
    if (typeof window.resiarHomeRefreshTopic === 'function') window.resiarHomeRefreshTopic();
  };

  function wrapOnce(name){
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__homeWrapped) return;
    const wrapped = function(){ const out = fn.apply(this, arguments); scheduleHomeRefresh(); return out; };
    wrapped.__homeWrapped = true;
    window[name] = wrapped;
  }
  function installHomeHooks(){
    try { resiarDisableQuestionChat(); } catch(_) {}
    if (!_homeWrapped) {
      ['cargarFiltros','cargarChecklist','selectExamen','selectAnioMir','deseleccionarEspecialidades','mixedExamFilterToggle','mixedExamFilterToggleBank','mixedExamFilterClear','actualizarBadge','actualizarBtnMarcadas'].forEach(wrapOnce);
      // v69: no envolvemos iniciar() desde el home. El controlador central de vista/sidebar
      // coordina el cambio a runtime de examen y el estado del chat para evitar wrappers duplicados.
      _homeWrapped = true;
    }
    const checklist = qs('checklistEspecialidades');
    if (checklist && !checklist.__homeChangeHook) {
      checklist.__homeChangeHook = true;
      checklist.addEventListener('change', function(){
        if (typeof window.resiarHomeRefreshSpecialties === 'function') window.resiarHomeRefreshSpecialties();
        if (typeof window.resiarHomeRefreshTopic === 'function') window.resiarHomeRefreshTopic();
      });
    }
    const topic = qs('buscadorTema');
    if (topic && !topic.__homeInputHook) {
      topic.addEventListener('input', function(){
        if (typeof window.resiarHomeRefreshTopic === 'function') window.resiarHomeRefreshTopic();
      });
      topic.__homeInputHook = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ installHomeHooks(); scheduleHomeRefresh(); });
  } else {
    installHomeHooks(); scheduleHomeRefresh();
  }
  // Limpieza puntual al montar. La vigilancia continua del chat queda en resiarSyncViewState.
  setTimeout(function(){ try { resiarDisableQuestionChat(); } catch(_) {} }, 0);
}
