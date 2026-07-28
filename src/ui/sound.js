/*
 * ResiAR — sistema de sonidos.
 *
 * Contiene Web Audio, sonidos custom persistidos en IndexedDB, panel de sonidos
 * y extensión de slots/eventos. Fue extraído del monolito sin cambiar CSS ni HTML.
 */

let soundDeps = {
  mostrarToast(message) { console.warn(message); },
  canUseCustomSounds() { return false; }
};

export function configureSoundSystem(deps = {}) {
  soundDeps = { ...soundDeps, ...deps };
}

// ══════════════════════════════════════════════
//  SISTEMA DE SONIDOS — ResiAR
//  Soporta: sonidos sintéticos (Web Audio API)
//           + múltiples archivos custom por slot
//           + rotación aleatoria entre ellos
// ══════════════════════════════════════════════
let sonidoActivo = true;
let _audioCtx = null;

// Cada slot tiene un array de { name, buffer }
const _customSounds = { ok: [], no: [], timer: [], fin: [] };
const SOUND_DB_NAME = 'resiar_custom_sounds';
const SOUND_DB_VERSION = 1;
const SOUND_STORE = 'slots';
let _soundDbPromise = null;
const _activeSoundSources = new Set();

function _getCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _trackSoundSource(src) {
  _activeSoundSources.add(src);
  const prev = src.onended;
  src.onended = (ev) => {
    _activeSoundSources.delete(src);
    if (typeof prev === 'function') prev.call(src, ev);
  };
  return src;
}

function _stopActiveSounds() {
  _activeSoundSources.forEach(src => {
    try { src.stop(0); } catch(e) {}
  });
  _activeSoundSources.clear();
}

function _openSoundDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB no disponible'));
  if (_soundDbPromise) return _soundDbPromise;
  _soundDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(SOUND_DB_NAME, SOUND_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SOUND_STORE)) db.createObjectStore(SOUND_STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _soundDbPromise;
}

async function _persistSoundSlot(slot) {
  try {
    const db = await _openSoundDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SOUND_STORE, 'readwrite');
      tx.objectStore(SOUND_STORE).put({
        slot,
        files: (_customSounds[slot] || []).map(f => ({
          name: f.name,
          type: f.type || '',
          size: f.size || 0,
          arrayBuffer: f.arrayBuffer,
        })),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) {
    console.warn('No se pudieron guardar sonidos custom:', e);
  }
}

async function _restoreCustomSounds() {
  try {
    const db = await _openSoundDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(SOUND_STORE, 'readonly');
      const req = tx.objectStore(SOUND_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const ctx = _getCtx();
    for (const row of rows) {
      if (!_customSounds[row.slot]) continue;
      _customSounds[row.slot] = [];
      for (const f of (row.files || [])) {
        if (!f.arrayBuffer) continue;
        try {
          const audioBuf = await ctx.decodeAudioData(f.arrayBuffer.slice(0));
          _customSounds[row.slot].push({
            name: f.name,
            type: f.type || '',
            size: f.size || 0,
            arrayBuffer: f.arrayBuffer,
            buffer: audioBuf,
          });
        } catch(e) {
          console.warn('No se pudo restaurar sonido custom:', f.name, e);
        }
      }
    }
    if (document.getElementById('soundPanel')?.style.display === 'flex') renderSoundPanel();
  } catch(e) {
    console.warn('No se pudieron cargar sonidos custom:', e);
  }
}

// ── Elegir uno al azar del array y reproducirlo ──
function _playRandom(slot) {
  const arr = _customSounds[slot];
  if (!arr || !arr.length) return false;
  const item = arr[Math.floor(Math.random() * arr.length)];
  try {
    const ctx = _getCtx();
    const src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.connect(ctx.destination);
    _trackSoundSource(src);
    src.start(0);
  } catch(e) {}
  return true;
}

// ── Sonido correcto: acorde mayor ascendente ──
function _sonOkSynth() {
  try {
    const ctx = _getCtx(), t = ctx.currentTime;
    const base = Math.random() > 0.5 ? 523.25 : 659.25;
    [base, base * 1.25, base * 1.5].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.32);
      _trackSoundSource(osc);
      osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.34);
    });
  } catch(e) {}
}

// ── Sonido incorrecto: intervalo descendente disonante ──
function _sonNoSynth() {
  try {
    const ctx = _getCtx(), t = ctx.currentTime;
    const base = Math.random() > 0.5 ? 311.13 : 277.18;
    [base, base * 0.84].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.38);
      _trackSoundSource(osc);
      osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.4);
    });
  } catch(e) {}
}

// ── Sonido timer: beep corto ──
function _sonTimerSynth() {
  try {
    const ctx = _getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    _trackSoundSource(osc);
    osc.start(t); osc.stop(t + 0.2);
  } catch(e) {}
}

// ── Sonido fin: fanfarria ascendente ──
function _sonFinSynth() {
  try {
    const ctx = _getCtx(), t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.35);
      _trackSoundSource(osc);
      osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.4);
    });
  } catch(e) {}
}

// ── API pública — usa custom si hay, si no sintético ──
function sonOk()    { if (!sonidoActivo) return; _stopActiveSounds(); if (!_playRandom('ok'))    _sonOkSynth(); }
function sonNo()    { if (!sonidoActivo) return; _stopActiveSounds(); if (!_playRandom('no'))    _sonNoSynth(); }
function sonTimer() { if (!sonidoActivo) return; _stopActiveSounds(); if (!_playRandom('timer')) _sonTimerSynth(); }
function sonFin()   { if (!sonidoActivo) return; _stopActiveSounds(); if (!_playRandom('fin'))   _sonFinSynth(); }

// ── Agregar archivo al slot ──
async function agregarSonidoCustom(slot, file) {
  try {
    const ctx = _getCtx();
    const arrayBuf = await file.arrayBuffer();
    const storedBuf = arrayBuf.slice(0);
    const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
    _customSounds[slot].push({ name: file.name, type: file.type, size: file.size, arrayBuffer: storedBuf, buffer: audioBuf });
    await _persistSoundSlot(slot);
    return true;
  } catch(e) {
    console.warn('Error cargando sonido:', e);
    return false;
  }
}

// ── Eliminar uno por índice ──
function eliminarSonidoCustom(slot, idx) {
  _customSounds[slot].splice(idx, 1);
  _persistSoundSlot(slot);
}

// ── Limpiar todo el slot ──
function resetSonidoCustom(slot) {
  _customSounds[slot] = [];
  _stopActiveSounds();
  _persistSoundSlot(slot);
}

// ── Toggle global mute ──
function toggleSonido() {
  sonidoActivo = !sonidoActivo;
  if (!sonidoActivo) _stopActiveSounds();
  const btn = document.getElementById('soundBtn');
  if (btn) btn.textContent = sonidoActivo ? '🔊' : '🔇';
  const tog = document.getElementById('soundToggleChk');
  if (tog) tog.checked = sonidoActivo;
}

// ── Abrir/cerrar panel ──
function abrirSoundPanel() {
  renderSoundPanel();
  document.getElementById('soundPanel').style.display = 'flex';
}
function cerrarSoundPanel() {
  document.getElementById('soundPanel').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', _restoreCustomSounds);


/* ===== resiar-sound-panel-script ===== */
const SOUND_SLOTS_META = [
  { slot: 'ok',    icon: '✅', name: 'Respuesta correcta',  hint: '' },
  { slot: 'no',    icon: '❌', name: 'Respuesta incorrecta', hint: '' },
  { slot: 'timer', icon: '⏱️', name: 'Aviso de timer',       hint: 'Suena al min 1:00, 0:30 y últimos 10 seg' },
  { slot: 'fin',   icon: '🏁', name: 'Fin de examen',        hint: '' },
];

function renderSoundPanel() {
  const container = document.getElementById('soundSlotsContainer');
  const tog = document.getElementById('soundToggleChk');
  if (tog) tog.checked = sonidoActivo;

  container.innerHTML = SOUND_SLOTS_META.map(m => {
    const files = _customSounds[m.slot];
    const count = files.length;
    const countLabel = count === 0
      ? (m.hint || 'Predeterminado · subí archivos para personalizar')
      : count === 1 ? '1 archivo · rotación no aplica' : `${count} archivos · rotación aleatoria`;

    const fileItems = files.map((f, i) => `
      <div class="sound-file-item">
        <span class="sound-file-name" title="${escSP(f.name)}">🎵 ${escSP(f.name)}</span>
        <button class="sound-file-play" title="Escuchar" data-action="sound-preview-file" data-slot="${m.slot}" data-index="${i}">▶</button>
        <button class="sound-file-del"  title="Eliminar" data-action="sound-delete-file" data-slot="${m.slot}" data-index="${i}">✕</button>
      </div>`).join('');

    return `
    <div class="sound-slot-wrap">
      <div class="sound-slot-header">
        <div class="sound-slot-icon">${m.icon}</div>
        <div class="sound-slot-info">
          <div class="sound-slot-name">${m.name}</div>
          <div class="sound-slot-count ${count > 0 ? 'has-custom' : ''}">${countLabel}</div>
        </div>
        <div class="sound-slot-actions">
          <button class="sound-btn preview" title="Escuchar sonido actual" data-action="sound-preview-slot" data-slot="${m.slot}">▶</button>
          ${soundDeps.canUseCustomSounds()
  ? `<button class="sound-btn" data-action="sound-open-file" data-slot="${m.slot}">
      ＋ Agregar
    </button>`
  : `<button class="sound-btn" disabled style="opacity:0.55;cursor:not-allowed">
      🔒
    </button>`}
          ${count > 0 ? `<button class="sound-btn" style="color:var(--red);border-color:rgba(251,113,133,0.3)" data-action="sound-reset-slot" data-slot="${m.slot}">↺</button>` : ''}
        </div>
      </div>
      ${fileItems ? `<div class="sound-file-list">${fileItems}</div>` : ''}
      <input type="file" id="sp-file-${m.slot}" accept="audio/*" multiple style="display:none" data-change-action="sound-upload-slot" data-slot="${m.slot}">
    </div>`;
  }).join('');
}

function escSP(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function handleMultiUpload(slot, input) {

  if (!soundDeps.canUseCustomSounds()) {
    soundDeps.mostrarToast('🔒 Los sonidos custom son exclusivos de Pro / Trial+');
    input.value = '';
    return;
  }

  const files = Array.from(input.files);

  for (const file of files) {

    if (file.size > 5 * 1024 * 1024) {
      soundDeps.mostrarToast('⚠️ Máximo 5MB por sonido');
      continue;
    }

    await agregarSonidoCustom(slot, file);
  }

  input.value = '';
  renderSoundPanel();

  if (files.length) previewSlot(slot);
}

function eliminarYrenderizar(slot, idx) {
  eliminarSonidoCustom(slot, idx);
  renderSoundPanel();
}

function resetYrenderizar(slot) {
  resetSonidoCustom(slot);
  renderSoundPanel();
}

function previewSlot(slot) {
  if (slot === 'ok') sonOk();
  else if (slot === 'no') sonNo();
  else if (slot === 'timer') sonTimer();
  else if (slot === 'fin') sonFin();
}

function previewSlotFile(slot, idx) {
  const item = _customSounds[slot][idx];
  if (!item) return;
  try {
    _stopActiveSounds();
    const ctx = _getCtx();
    const src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.connect(ctx.destination);
    _trackSoundSource(src);
    src.start(0);
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', function() {
  const chk = document.getElementById('soundToggleChk');
  if (chk) chk.checked = sonidoActivo;
});




/* ===== resiar-sound-system-extension ===== */
export function installResiarSoundSystemExtension(bindings = {}) {
  if (window.__resiarSoundSystemExtensionInstalled) return;
  window.__resiarSoundSystemExtensionInstalled = true;

  const getFunction = typeof bindings.getFunction === 'function' ? bindings.getFunction : () => null;
  const setFunction = typeof bindings.setFunction === 'function' ? bindings.setFunction : () => {};
  const getExamLength = typeof bindings.getExamLength === 'function' ? bindings.getExamLength : () => 0;
  const getCurrentIndex = typeof bindings.getCurrentIndex === 'function' ? bindings.getCurrentIndex : () => 0;
  const isExamActiveExternal = typeof bindings.isExamActive === 'function' ? bindings.isExamActive : null;
  const getQuestionChatState = typeof bindings.getQuestionChatState === 'function' ? bindings.getQuestionChatState : () => null;

  const NEW_SOUND_SLOTS = [
    { slot:'start',     icon:'🚀', name:'Inicio de examen',       hint:'Suena al generar un examen normal, por errores o debilidades' },
    { slot:'nav',       icon:'↔️', name:'Cambio de pregunta',     hint:'Suena al avanzar, retroceder o elegir una pregunta desde la navegación' },
    { slot:'mark',      icon:'🔖', name:'Marcar pregunta',        hint:'Suena al marcar o desmarcar una pregunta para revisar' },
    { slot:'search',    icon:'🔎', name:'Abrir buscador',         hint:'Suena al abrir el buscador de preguntas' },
    { slot:'action',    icon:'✦', name:'Acciones de configuración', hint:'Suena en chips, botones y acciones rápidas de la pantalla principal' },
    { slot:'chatOpen',  icon:'💬', name:'Abrir chat',             hint:'Suena al abrir el chat flotante de la pregunta' },
    { slot:'chatClose', icon:'↘', name:'Cerrar chat',             hint:'Suena al cerrar el chat flotante de la pregunta' },
    { slot:'chatMsg',   icon:'✉️', name:'Mensaje de chat',         hint:'Suena al recibir un mensaje nuevo en el chat de pregunta' }
  ];

  function ensureSoundSlots(){
    try {
      NEW_SOUND_SLOTS.forEach(function(m){
        if (!_customSounds[m.slot]) _customSounds[m.slot] = [];
      });
    } catch(_) {}

    try {
      const existing = new Set(SOUND_SLOTS_META.map(function(m){ return m && m.slot; }));
      NEW_SOUND_SLOTS.forEach(function(m){
        if (!existing.has(m.slot)) {
          SOUND_SLOTS_META.push(m);
          existing.add(m.slot);
        }
      });
    } catch(e) {
      console.warn('No se pudo inicializar la extensión del panel de sonidos:', e);
    }

    try {
      if (document.getElementById('soundPanel')?.style.display === 'flex') renderSoundPanel();
    } catch(_) {}
  }

  function soundEnabled(){
    try { return sonidoActivo !== false; } catch(_) { return false; }
  }

  function playPattern(steps){
    try {
      const ctx = _getCtx();
      const t = ctx.currentTime;
      steps.forEach(function(s){
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = s.type || 'sine';
        osc.frequency.setValueAtTime(s.freq || 440, t + (s.at || 0));
        if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, t + (s.at || 0) + (s.dur || .12));
        gain.gain.setValueAtTime(0.0001, t + (s.at || 0));
        gain.gain.linearRampToValueAtTime(s.vol || 0.11, t + (s.at || 0) + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (s.at || 0) + (s.dur || .16));
        try { _trackSoundSource(osc); } catch(_) {}
        osc.start(t + (s.at || 0));
        osc.stop(t + (s.at || 0) + (s.dur || .16) + .03);
      });
    } catch(_) {}
  }

  function playSlot(slot, synth, stop){
    if (!soundEnabled()) return;
    try { if (stop) _stopActiveSounds(); } catch(_) {}
    try { if (_playRandom(slot)) return; } catch(_) {}
    try { synth(); } catch(_) {}
  }

  function _sonStartSynth(){
    playPattern([
      {freq:392, at:0.00, dur:.16, vol:.09, type:'sine'},
      {freq:523.25, at:.07, dur:.20, vol:.11, type:'triangle'},
      {freq:659.25, at:.15, dur:.24, vol:.10, type:'sine'},
      {freq:783.99, at:.23, dur:.28, vol:.08, type:'sine'}
    ]);
  }
  function _sonNavSynth(){
    playPattern([
      {freq:760, at:0, dur:.055, vol:.045, type:'sine'},
      {freq:980, at:.045, dur:.07, vol:.035, type:'sine'}
    ]);
  }
  function _sonMarkSynth(){
    playPattern([
      {freq:520, at:0, dur:.08, vol:.075, type:'triangle'},
      {freq:720, at:.055, dur:.10, vol:.06, type:'sine'}
    ]);
  }
  function _sonSearchSynth(){
    playPattern([
      {freq:880, at:0, dur:.08, vol:.06, type:'sine'},
      {freq:1174.66, at:.08, dur:.12, vol:.05, type:'sine'}
    ]);
  }
  function _sonActionSynth(){
    playPattern([
      {freq:620, to:760, at:0, dur:.07, vol:.045, type:'triangle'}
    ]);
  }
  function _sonChatOpenSynth(){
    playPattern([
      {freq:440, at:0, dur:.13, vol:.075, type:'sine'},
      {freq:660, at:.08, dur:.18, vol:.08, type:'sine'}
    ]);
  }
  function _sonChatCloseSynth(){
    playPattern([
      {freq:660, at:0, dur:.10, vol:.065, type:'sine'},
      {freq:440, at:.07, dur:.14, vol:.055, type:'triangle'}
    ]);
  }
  function _sonChatMsgSynth(){
    playPattern([
      {freq:988, at:0, dur:.09, vol:.055, type:'sine'},
      {freq:1318.51, at:.075, dur:.11, vol:.045, type:'sine'}
    ]);
  }

  function sonStart(){ playSlot('start', _sonStartSynth, true); }
  function sonNav(){ playSlot('nav', _sonNavSynth, false); }
  function sonMark(){ playSlot('mark', _sonMarkSynth, false); }
  function sonSearch(){ playSlot('search', _sonSearchSynth, false); }
  function sonAction(){ playSlot('action', _sonActionSynth, false); }
  function sonChatOpen(){ playSlot('chatOpen', _sonChatOpenSynth, false); }
  function sonChatClose(){ playSlot('chatClose', _sonChatCloseSynth, false); }
  function sonChatMsg(){ playSlot('chatMsg', _sonChatMsgSynth, false); }

  Object.assign(window, {
    sonStart,
    sonNav,
    sonMark,
    sonSearch,
    sonAction,
    sonChatOpen,
    sonChatClose,
    sonChatMsg
  });

  function patchBoundFunction(name, factory){
    try {
      const fn = getFunction(name);
      if (typeof fn !== 'function' || fn.__resiarSoundPatched) return;
      const wrapped = factory(fn);
      wrapped.__resiarSoundPatched = true;
      setFunction(name, wrapped);
      window[name] = wrapped;
    } catch(e) {
      console.warn('resiar sound wrapper '+name+':', e);
    }
  }

  function examLen(){
    try { return Number(getExamLength()) || 0; } catch(_) { return 0; }
  }
  function currentIdx(){
    try { return Number(getCurrentIndex()) || 0; } catch(_) { return 0; }
  }
  function isExamActive(){
    if (isExamActiveExternal) {
      try { return !!isExamActiveExternal(); } catch(_) {}
    }
    try { return examLen() > 0 && document.body.dataset.resiarView === 'exam' && window._resiarExamFinished !== true; } catch(_) {}
    return examLen() > 0 && window._resiarExamFinished !== true;
  }

  function makeStartPatch(fn){
    return function(){
      const out = fn.apply(this, arguments);
      Promise.resolve(out).finally(function(){
        setTimeout(function(){
          if (examLen() > 0) sonStart();
        }, 40);
      });
      return out;
    };
  }

  function makeNavPatch(fn){
    return function(){
      const before = currentIdx();
      const out = fn.apply(this, arguments);
      const after = currentIdx();
      if (after !== before) sonNav();
      return out;
    };
  }

  function installFunctionSounds(){
    patchBoundFunction('iniciar', makeStartPatch);
    patchBoundFunction('iniciarRepaso', makeStartPatch);
    patchBoundFunction('iniciarExamenInteligente', makeStartPatch);

    patchBoundFunction('next', makeNavPatch);
    patchBoundFunction('prev', makeNavPatch);
    patchBoundFunction('irDesdeNav', makeNavPatch);

    patchBoundFunction('toggleMarcada', function(fn){
      return function(){
        const out = fn.apply(this, arguments);
        sonMark();
        return out;
      };
    });

    patchBoundFunction('abrirBuscador', function(fn){
      return function(){
        const out = fn.apply(this, arguments);
        setTimeout(function(){
          const modal = document.getElementById('modalSearch');
          if (modal && modal.classList.contains('vis')) sonSearch();
        }, 40);
        return out;
      };
    });

    patchBoundFunction('questionChatAppendMessage', function(fn){
      return function(payload, ownLocal, silentHistory){
        let before = 0;
        try { before = getQuestionChatState()?.messages?.length || 0; } catch(_) {}
        const out = fn.apply(this, arguments);
        try {
          const state = getQuestionChatState();
          const after = state?.messages?.length || 0;
          const last = state?.messages?.[after - 1];
          if (after > before && !silentHistory && last && !last.own && !last.system) sonChatMsg();
        } catch(_) {}
        return out;
      };
    });

    patchBoundFunction('questionChatOpen', function(fn){
      return function(){
        let wasOpen = false;
        try { wasOpen = !!getQuestionChatState()?.open; } catch(_) {}
        const out = fn.apply(this, arguments);
        try { if (!wasOpen && getQuestionChatState()?.open && isExamActive()) sonChatOpen(); } catch(_) {}
        return out;
      };
    });

    patchBoundFunction('questionChatClose', function(fn){
      return function(){
        let wasOpen = false;
        try { wasOpen = !!getQuestionChatState()?.open; } catch(_) {}
        const out = fn.apply(this, arguments);
        try { if (wasOpen && !getQuestionChatState()?.open && isExamActive()) sonChatClose(); } catch(_) {}
        return out;
      };
    });
  }

  function installPreviewPatch(){
    try {
      if (previewSlot.__resiarPreviewPatched) return;
      const oldPreview = previewSlot;
      const nextPreview = function(slot){
        if (slot === 'start') return sonStart();
        if (slot === 'nav') return sonNav();
        if (slot === 'mark') return sonMark();
        if (slot === 'search') return sonSearch();
        if (slot === 'action') return sonAction();
        if (slot === 'chatOpen') return sonChatOpen();
        if (slot === 'chatClose') return sonChatClose();
        if (slot === 'chatMsg') return sonChatMsg();
        if (typeof oldPreview === 'function') return oldPreview(slot);
      };
      nextPreview.__resiarPreviewPatched = true;
      nextPreview.__resiarPreviousPreviewSlot = oldPreview;
      previewSlot = nextPreview;
      window.previewSlot = nextPreview;
    } catch(e) {
      console.warn('resiar sound preview patch:', e);
    }
  }

  function installUiClickSounds(){
    if (window.__resiarUiClickSoundsInstalled) return;
    window.__resiarUiClickSoundsInstalled = true;
    document.addEventListener('click', function(ev){
      const target = ev.target;
      if (!target || !target.closest) return;
      if (target.closest('#soundPanel')) return;
      if (target.closest('#qchatRescueFab') || target.closest('#qchatRoot')) return;
      if (target.closest('.opcion') || target.closest('.qnav-dot') || target.closest('.rp-qnav-dot')) return;
      const el = target.closest('.home-action,.home-primary,.home-secondary,.home-mini-btn,.home-topic-sug,.home-bank-chip,.home-esp-chip,#soundBtn');
      if (el) sonAction();
    }, true);
  }

  ensureSoundSlots();
  installPreviewPatch();
  installFunctionSounds();
  installUiClickSounds();
}


export {
  sonOk,
  sonNo,
  sonTimer,
  sonFin,
  agregarSonidoCustom,
  eliminarSonidoCustom,
  resetSonidoCustom,
  toggleSonido,
  abrirSoundPanel,
  cerrarSoundPanel,
  renderSoundPanel,
  handleMultiUpload,
  eliminarYrenderizar,
  resetYrenderizar,
  previewSlot,
  previewSlotFile,
  _stopActiveSounds
};

try {
  Object.assign(window, {
    sonOk,
    sonNo,
    sonTimer,
    sonFin,
    agregarSonidoCustom,
    eliminarSonidoCustom,
    resetSonidoCustom,
    toggleSonido,
    abrirSoundPanel,
    cerrarSoundPanel,
    renderSoundPanel,
    handleMultiUpload,
    eliminarYrenderizar,
    resetYrenderizar,
    previewSlot,
    previewSlotFile,
    _stopActiveSounds
  });
} catch (_) {}
