import { escapeHtml, markdownToHtml } from '../utils/sanitize.js';

const OPTION_LETTERS = ['A','B','C','D','E','F','G','H'];
const CONFIDENCE_VALUES = ['', 'alta', 'media', 'baja'];
const MANUAL_EXPLANATION_PROMPT_VERSION = 5;
const EXPLANATION_IMAGES_BUCKET = 'explanation-images';
const MAX_EXPLANATION_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXPLANATION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

let deps = {};
let installed = false;
let metadataIndexCache = null;
let state = {
  open: false,
  question: null,
  index: -1,
  options: {},
  explanation: null,
  loadingExplanation: false,
  saving: false,
  deleting: false,
  deletingExplanation: false,
  uploadingExplanationImage: false,
  explanationInsertRange: null,
  activeTab: 'pregunta',
};

function noop() {}
function getSb() { return typeof deps.getSupabase === 'function' ? deps.getSupabase() : window.sb; }
function toast(message, timeout) {
  const fn = typeof deps.mostrarToast === 'function' ? deps.mostrarToast : noop;
  try { fn(message, timeout); } catch (_) {}
}
function isAdmin() {
  try { if (typeof deps.isAdmin === 'function' && deps.isAdmin()) return true; } catch (_) {}
  try { return String(deps.getCurrentProfile?.()?.plan || '').trim() === 'admin'; } catch (_) {}
  return false;
}
function getCurrentExam() { return Array.isArray(deps.getCurrentExam?.()) ? deps.getCurrentExam() : []; }
function getCurrentIndex() { return Number(deps.getCurrentIndex?.() ?? -1); }
function getAllQuestions() { return Array.isArray(deps.getAllQuestions?.()) ? deps.getAllQuestions() : []; }
function safeLower(value) { return String(value ?? '').trim().toLowerCase(); }
function safeUpper(value) { return String(value ?? '').trim().toUpperCase(); }
function normalizeNullableText(value) {
  const clean = String(value ?? '').trim();
  return clean || null;
}
function normalizeBool(value) { return value === true || value === 'true' || value === 1 || value === '1'; }

function normalizeOptions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const entries = Object.entries(src)
    .map(([key, value]) => [safeUpper(key), String(value ?? '')])
    .filter(([key]) => key && OPTION_LETTERS.includes(key))
    .sort((a, b) => OPTION_LETTERS.indexOf(a[0]) - OPTION_LETTERS.indexOf(b[0]));
  const out = {};
  entries.forEach(([, value], index) => { out[OPTION_LETTERS[index]] = value; });
  if (!Object.keys(out).length) {
    ['A','B','C','D'].forEach(letter => { out[letter] = ''; });
  }
  return out;
}

function lowerOptions(options) {
  const out = {};
  Object.entries(options || {}).forEach(([key, value]) => {
    const letter = safeLower(key);
    if (letter) out[letter] = String(value ?? '');
  });
  return out;
}

function getQuestionTitle(question = state.question, index = state.index) {
  if (!question) return 'Sin pregunta';
  const parts = [question.examen, question.anio].filter(Boolean).join(' · ');
  const num = question.num_original ?? (index >= 0 ? index + 1 : question.id);
  return `${parts || 'Banco'} · Pregunta ${num}`;
}

function escapeAttr(value) { return escapeHtml(String(value ?? '')).replace(/"/g, '&quot;'); }
function escapeTextareaValue(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeMarkdownText(value) {
  return String(value || '').replace(/[\\\]\[()]/g, '\\$&').replace(/\n+/g, ' ').trim();
}

function slugPart(value) {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'imagen';
}

function getFileExtension(file) {
  const byName = String(file?.name || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1] || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(byName)) return byName === 'jpeg' ? 'jpg' : byName;
  const byType = String(file?.type || '').toLowerCase();
  if (byType === 'image/jpeg') return 'jpg';
  if (byType === 'image/png') return 'png';
  if (byType === 'image/webp') return 'webp';
  if (byType === 'image/gif') return 'gif';
  return 'jpg';
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function getExplanationTextarea() {
  return document.querySelector('#adminQuestionEditorModal [data-admin-editor-field="explicacion_texto"]');
}

function getExplanationInsertionRange() {
  const textarea = getExplanationTextarea();
  if (!textarea) return null;
  try {
    const value = String(textarea.value || '');
    const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : value.length;
    const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
    return { start, end };
  } catch (_) {
    return null;
  }
}

function rememberExplanationInsertionRange() {
  const range = getExplanationInsertionRange();
  if (range) state.explanationInsertRange = range;
  return range;
}

function clearFileInput(event) {
  try { if (event?.target) event.target.value = ''; } catch (_) {}
}

function buildImageMarkdown(url, alt = '') {
  const cleanUrl = String(url || '').trim();
  const cleanAlt = escapeMarkdownText(alt || 'Imagen de la explicación');
  return `![${cleanAlt}](${cleanUrl})`;
}

function normalizeAnswerLetter(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = text.match(/^[a-hA-H](?:$|[\s).:\-])/);
  return safeUpper(match ? match[0].charAt(0) : text.charAt(0));
}

function getKnownCorrectAnswer() {
  const qid = String(state.question?.id || '').trim();
  const candidates = [
    state.question?._resiarAnswerServer?.correctAnswer,
    state.question?._resiarAnswerServer?.correct_answer,
    state.question?._resiarAnswerServer?.correctAnswerLetter,
    state.question?._resiarAnswerServer?.correct_answer_letter,
    state.question?.respuesta,
  ];

  try {
    const last = window.__resiarLastSecureAnswer;
    if (last && String(last.questionId || last.question_id || '').trim() === qid) {
      candidates.unshift(last.correctAnswer, last.correct_answer);
    }
  } catch (_) {}

  for (const value of candidates) {
    const letter = normalizeAnswerLetter(value);
    if (letter && OPTION_LETTERS.includes(letter)) return letter;
  }

  return '';
}

function normalizeLookup(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getQuestionFieldValues(question, selectors) {
  const fields = Array.isArray(selectors) ? selectors : [selectors];
  return fields
    .map(field => String(question?.[field] || '').trim())
    .filter(Boolean);
}

function addUnique(map, value) {
  const clean = String(value || '').trim();
  const key = normalizeLookup(clean);
  if (key && !map.has(key)) map.set(key, clean);
}

function addTopicForSpecialty(topicsBySpecialty, specialty, topic) {
  const espKey = normalizeLookup(specialty);
  const cleanTopic = String(topic || '').trim();
  const topicKey = normalizeLookup(cleanTopic);
  if (!espKey || !topicKey) return;
  if (!topicsBySpecialty.has(espKey)) topicsBySpecialty.set(espKey, new Map());
  const topics = topicsBySpecialty.get(espKey);
  if (!topics.has(topicKey)) topics.set(topicKey, cleanTopic);
}

function buildMetadataIndex() {
  const questions = getAllQuestions();
  if (metadataIndexCache && metadataIndexCache.source === questions) return metadataIndexCache;

  const specialties = new Map();
  const topicsBySpecialty = new Map();

  questions.forEach((question) => {
    const questionSpecialties = getQuestionFieldValues(question, ['especialidad', 'especialidad_v2']);
    const questionTopics = getQuestionFieldValues(question, ['tema', 'tema_v2']);

    questionSpecialties.forEach((specialty) => addUnique(specialties, specialty));
    questionSpecialties.forEach((specialty) => {
      questionTopics.forEach((topic) => addTopicForSpecialty(topicsBySpecialty, specialty, topic));
    });
  });

  metadataIndexCache = {
    source: questions,
    specialties: [...specialties.values()].sort((a, b) => a.localeCompare(b, 'es')),
    topicsBySpecialty,
  };
  return metadataIndexCache;
}

function getUniqueList(selectors) {
  if (Array.isArray(selectors) && selectors.includes('especialidad')) {
    return buildMetadataIndex().specialties;
  }
  const set = new Map();
  getAllQuestions().forEach((question) => {
    getQuestionFieldValues(question, selectors).forEach((value) => addUnique(set, value));
  });
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function getTopicListForSpecialty(specialty) {
  const espKey = normalizeLookup(specialty);
  if (!espKey) return [];
  const topics = buildMetadataIndex().topicsBySpecialty.get(espKey);
  if (!topics) return [];
  return [...topics.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function renderDatalist(id, items) {
  return `<datalist id="${id}">${items.map(item => `<option value="${escapeAttr(item)}"></option>`).join('')}</datalist>`;
}

function renderTopicFillButtons(field, topics, currentValue, specialty) {
  const clean = String(currentValue || '').trim();
  const normalizedCurrent = normalizeLookup(clean);
  const selectedSpecialty = String(specialty || '').trim();
  const uniqueTopics = (topics || [])
    .filter(Boolean)
    .filter((topic, index, arr) => arr.findIndex(item => normalizeLookup(item) === normalizeLookup(topic)) === index);
  const visible = uniqueTopics.slice(0, 32);
  const hiddenCount = Math.max(0, uniqueTopics.length - visible.length);

  if (!selectedSpecialty) {
    return `<div class="aqe-topic-fill"><div class="aqe-topic-fill-title">Temas disponibles</div><div class="aqe-topic-empty">Elegí una especialidad para ver sus temas existentes.</div></div>`;
  }

  if (!visible.length) {
    return `<div class="aqe-topic-fill"><div class="aqe-topic-fill-title">Temas disponibles para ${escapeHtml(selectedSpecialty)}</div><div class="aqe-topic-empty">No hay temas existentes para esta especialidad. Podés escribir uno nuevo manualmente.</div></div>`;
  }

  return `
    <div class="aqe-topic-fill" data-topic-fill-for="${escapeAttr(field)}">
      <div class="aqe-topic-fill-title">Temas disponibles para ${escapeHtml(selectedSpecialty)}</div>
      <div class="aqe-topic-chips">
        ${visible.map(topic => {
          const active = normalizedCurrent && normalizeLookup(topic) === normalizedCurrent;
          return `<button type="button" class="aqe-topic-chip ${active ? 'active' : ''}" data-admin-editor-action="fill-topic" data-field="${escapeAttr(field)}" data-value="${escapeAttr(topic)}">${escapeHtml(topic)}</button>`;
        }).join('')}
      </div>
      <div class="aqe-topic-hint">Click en un tema para completar el campo. El listado está filtrado por la especialidad elegida.${hiddenCount ? ` Hay ${hiddenCount} más en el autocompletado del campo.` : ''}</div>
    </div>`;
}

function getModal() { return document.getElementById('adminQuestionEditorModal'); }
function getBody() { return document.getElementById('adminQuestionEditorBody'); }
function getMsg() { return document.getElementById('adminQuestionEditorMsg'); }
function setMsg(message, type = '') {
  const el = getMsg();
  if (!el) return;
  el.textContent = message || '';
  el.className = `aqe-msg ${type || ''}`.trim();
}

function ensureModal() {
  if (getModal()) return getModal();
  const modal = document.createElement('div');
  modal.className = 'aqe-modal';
  modal.id = 'adminQuestionEditorModal';
  modal.innerHTML = `
    <div class="aqe-dialog" role="dialog" aria-modal="true" aria-labelledby="adminQuestionEditorTitle">
      <div class="aqe-head">
        <div>
          <div class="aqe-kicker">Modo corrección</div>
          <div class="aqe-title" id="adminQuestionEditorTitle">Editor de pregunta</div>
          <div class="aqe-sub" id="adminQuestionEditorSubtitle"></div>
        </div>
        <button type="button" class="aqe-close" data-admin-editor-action="close">✕</button>
      </div>
      <div class="aqe-toolbar">
        <button type="button" class="aqe-nav-btn" data-admin-editor-action="previous-question">← Pregunta anterior</button>
        <button type="button" class="aqe-nav-btn" data-admin-editor-action="next-question">Siguiente pregunta →</button>
      </div>
      <div class="aqe-tabs">
        <button type="button" class="aqe-tab active" data-admin-editor-action="tab" data-tab="pregunta">Pregunta</button>
        <button type="button" class="aqe-tab" data-admin-editor-action="tab" data-tab="opciones">Opciones</button>
        <button type="button" class="aqe-tab" data-admin-editor-action="tab" data-tab="meta">Metadatos</button>
        <button type="button" class="aqe-tab" data-admin-editor-action="tab" data-tab="explicacion">Explicación</button>
      </div>
      <div class="aqe-body" id="adminQuestionEditorBody"></div>
      <div class="aqe-foot">
        <div class="aqe-msg" id="adminQuestionEditorMsg"></div>
        <button type="button" class="aqe-danger" id="adminQuestionEditorDeleteBtn" data-admin-editor-action="delete">Borrar pregunta</button>
        <button type="button" class="aqe-secondary" data-admin-editor-action="reload">Descartar cambios</button>
        <button type="button" class="aqe-primary" id="adminQuestionEditorSaveBtn" data-admin-editor-action="save">Guardar en Supabase</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function renderOptionRows() {
  const entries = Object.entries(state.options || {});
  return `
    <div class="aqe-options-toolbar">
      <span>${entries.length} opción${entries.length !== 1 ? 'es' : ''}</span>
      <button type="button" data-admin-editor-action="add-option">+ Agregar opción</button>
      <button type="button" data-admin-editor-action="remove-option">− Quitar última</button>
      <button type="button" data-admin-editor-action="load-correct-answer" ${getKnownCorrectAnswer() ? '' : 'disabled'}>Cargar respuesta correcta</button>
    </div>
    <div class="aqe-options-list">
      ${entries.map(([key, value]) => `
        <div class="aqe-option-row">
          <div class="aqe-option-key">${escapeHtml(key)}</div>
          <input type="text" data-admin-editor-field="option" data-key="${escapeAttr(key)}" value="${escapeAttr(value)}">
        </div>`).join('')}
    </div>
    <label class="aqe-field">
      <span>Respuesta correcta</span>
      <select data-admin-editor-field="respuesta">
        <option value="">— Sin respuesta oficial —</option>
        ${entries.map(([key, value]) => `<option value="${escapeAttr(key)}" ${safeUpper(state.question?.respuesta) === key ? 'selected' : ''}>${escapeHtml(key)}. ${escapeHtml(value || '(sin texto)')}</option>`).join('')}
      </select>
    </label>`;
}

function renderMetaFields(question) {
  const specialties = getUniqueList(['especialidad', 'especialidad_v2']);
  const selectedSpecialty = String(question.especialidad || '').trim();
  const selectedSpecialtyV2 = String(question.especialidad_v2 || '').trim();
  const topics = getTopicListForSpecialty(selectedSpecialty);
  const topicsV2 = getTopicListForSpecialty(selectedSpecialtyV2);
  const conf = String(question.clasificacion_confianza || '').toLowerCase();
  return `
    ${renderDatalist('aqeEspecialidadesList', specialties)}
    ${renderDatalist('aqeTemasList', topics)}
    ${renderDatalist('aqeTemasV2List', topicsV2)}
    <div class="aqe-grid2">
      <label class="aqe-field">
        <span>Especialidad</span>
        <input type="text" list="aqeEspecialidadesList" data-admin-editor-field="especialidad" value="${escapeAttr(question.especialidad)}">
      </label>
      <label class="aqe-field">
        <span>Tema</span>
        <input type="text" list="aqeTemasList" data-admin-editor-field="tema" value="${escapeAttr(question.tema)}">
      </label>
    </div>
    ${renderTopicFillButtons('tema', topics, question.tema, selectedSpecialty)}
    <label class="aqe-field">
      <span>Tipo</span>
      <input type="text" data-admin-editor-field="tipo" value="${escapeAttr(question.tipo)}">
    </label>
    <div class="aqe-checks">
      <label><input type="checkbox" data-admin-editor-field="corregida" ${question.corregida ? 'checked' : ''}> Marcar como corregida</label>
      <label><input type="checkbox" data-admin-editor-field="anulada" ${question.anulada ? 'checked' : ''}> Anulada</label>
    </div>
    <div class="aqe-v2-box">
      <div class="aqe-v2-head">
        <span>Reclasificación IA v2</span>
        <button type="button" data-admin-editor-action="apply-v2">Aplicar v2 a oficial</button>
      </div>
      <div class="aqe-grid2">
        <label class="aqe-field">
          <span>Especialidad v2</span>
          <input type="text" list="aqeEspecialidadesList" data-admin-editor-field="especialidad_v2" value="${escapeAttr(question.especialidad_v2)}">
        </label>
        <label class="aqe-field">
          <span>Tema v2</span>
          <input type="text" list="aqeTemasV2List" data-admin-editor-field="tema_v2" value="${escapeAttr(question.tema_v2)}">
        </label>
      </div>
      ${renderTopicFillButtons('tema_v2', topicsV2, question.tema_v2, selectedSpecialtyV2)}
      <div class="aqe-grid2">
        <label class="aqe-field">
          <span>Confianza</span>
          <select data-admin-editor-field="clasificacion_confianza">
            ${CONFIDENCE_VALUES.map(value => `<option value="${value}" ${conf === value ? 'selected' : ''}>${value ? value.charAt(0).toUpperCase() + value.slice(1) : '— sin datos —'}</option>`).join('')}
          </select>
        </label>
        <label class="aqe-field">
          <span>Modelo IA</span>
          <input type="text" data-admin-editor-field="clasificacion_modelo" value="${escapeAttr(question.clasificacion_modelo)}">
        </label>
      </div>
    </div>`;
}


function renderExplanationImagesPanel(text) {
  const hasImageMarkdown = /!\[[^\]\n]*\]\(https?:\/\//i.test(String(text || ''));
  return `
    <div class="aqe-explanation-images-panel">
      <div class="aqe-explanation-images-head">
        <div>
          <div class="aqe-topic-fill-title">Imágenes en explicación</div>
          <div class="aqe-topic-hint">Poné el cursor en el texto donde querés ubicar la imagen, o seleccioná texto para reemplazarlo. La imagen se inserta exactamente ahí.</div>
        </div>
        <div class="aqe-explanation-image-actions">
          <label class="aqe-image-upload-btn ${state.uploadingExplanationImage ? 'disabled' : ''}">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-admin-editor-file="explanation-image" ${state.uploadingExplanationImage ? 'disabled' : ''}>
            ${state.uploadingExplanationImage ? 'Subiendo...' : 'Subir en cursor'}
          </label>
          <button type="button" class="aqe-image-url-btn" data-admin-editor-action="insert-explanation-image-url" ${state.uploadingExplanationImage ? 'disabled' : ''}>URL en cursor</button>
        </div>
      </div>
      <div class="aqe-explanation-format-hint">También podés escribirlo manualmente: <code>![descripción](https://...)</code></div>
    </div>
    ${hasImageMarkdown ? `<div class="aqe-explanation-preview"><div class="aqe-topic-fill-title">Vista previa</div><div class="exp-body">${markdownToHtml(text)}</div></div>` : ''}`;
}

function insertTextIntoExplanation(markdown, options = {}) {
  const snippet = String(markdown || '').trim();
  if (!snippet) return;

  state.explanation = state.explanation || { pregunta_id: state.question?.id, modelo: 'manual' };
  const textarea = getExplanationTextarea();

  if (!textarea) {
    const current = String(state.explanation.texto || '');
    const range = options.range || state.explanationInsertRange;
    if (range && Number.isFinite(range.start)) {
      const start = Math.max(0, Math.min(current.length, range.start));
      const end = Math.max(start, Math.min(current.length, Number.isFinite(range.end) ? range.end : start));
      const before = current.slice(0, start);
      const after = current.slice(end);
      const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n\n' : '\n';
      state.explanation.texto = `${before}${prefix}${snippet}${suffix}${after}`;
      return;
    }
    const sep = current.trim() ? '\n\n' : '';
    state.explanation.texto = `${current}${sep}${snippet}\n`;
    return;
  }

  const current = String(textarea.value || '');
  const range = options.range || state.explanationInsertRange || getExplanationInsertionRange();
  const rawStart = range && Number.isFinite(range.start) ? range.start : current.length;
  const rawEnd = range && Number.isFinite(range.end) ? range.end : rawStart;
  const start = Math.max(0, Math.min(current.length, rawStart));
  const end = Math.max(start, Math.min(current.length, rawEnd));
  const before = current.slice(0, start);
  const after = current.slice(end);
  const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n\n' : '\n';
  const next = `${before}${prefix}${snippet}${suffix}${after}`;

  textarea.value = next;
  state.explanation.texto = next;
  state.explanation.prompt_version = Math.max(1, Number(state.explanation.prompt_version || MANUAL_EXPLANATION_PROMPT_VERSION) || MANUAL_EXPLANATION_PROMPT_VERSION);

  const cursor = (before + prefix + snippet + suffix).length;
  state.explanationInsertRange = { start: cursor, end: cursor };
  try {
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  } catch (_) {}
}

async function uploadExplanationImage(file) {
  if (!file || state.uploadingExplanationImage) return;
  if (!state.question?.id) {
    setMsg('No hay pregunta activa para asociar la imagen.', 'er');
    return;
  }
  if (!isAdmin()) {
    setMsg('Solo administrador puede subir imágenes.', 'er');
    return;
  }
  if (!ALLOWED_EXPLANATION_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    setMsg('Formato no permitido. Usá JPG, PNG, WebP o GIF.', 'er');
    return;
  }
  if (Number(file.size || 0) > MAX_EXPLANATION_IMAGE_BYTES) {
    setMsg('La imagen supera 8 MB.', 'er');
    return;
  }

  const sb = getSb();
  if (!sb?.storage) {
    setMsg('Supabase Storage no está disponible.', 'er');
    return;
  }

  updateStateFromDom();
  const insertionRange = rememberExplanationInsertionRange();
  state.uploadingExplanationImage = true;
  setMsg('Subiendo imagen...');

  try {
    const questionId = slugPart(state.question.id);
    const base = slugPart(String(file.name || '').replace(/\.[^.]+$/, ''));
    const ext = getFileExtension(file);
    const path = `${questionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${ext}`;

    const { data, error } = await sb.storage
      .from(EXPLANATION_IMAGES_BUCKET)
      .upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (error) throw error;

    const uploadedPath = data?.path || path;
    const { data: publicData } = sb.storage.from(EXPLANATION_IMAGES_BUCKET).getPublicUrl(uploadedPath);
    const publicUrl = String(publicData?.publicUrl || '').trim();
    if (!isSafeHttpUrl(publicUrl)) throw new Error('No se pudo obtener URL pública de la imagen.');

    insertTextIntoExplanation(buildImageMarkdown(publicUrl, file.name || 'Imagen'), { range: insertionRange });
    setMsg('Imagen subida e insertada en el cursor. Guardá en Supabase para persistir la explicación.', 'ok');
  } catch (error) {
    const message = error?.message || String(error || 'error desconocido');
    setMsg('Error al subir imagen: ' + message, 'er');
  } finally {
    state.uploadingExplanationImage = false;
  }
}

function insertExplanationImageUrl() {
  updateStateFromDom();
  const insertionRange = rememberExplanationInsertionRange();
  const url = window.prompt('Pegá la URL pública de la imagen:');
  if (!url) {
    setMsg('Inserción de imagen cancelada.', '');
    return;
  }
  if (!isSafeHttpUrl(url)) {
    setMsg('URL inválida. Usá una URL pública http/https.', 'er');
    return;
  }
  const alt = window.prompt('Texto alternativo o descripción breve:', 'Imagen de la explicación') || 'Imagen de la explicación';
  insertTextIntoExplanation(buildImageMarkdown(url, alt), { range: insertionRange });
  setMsg('Imagen insertada en el cursor. Guardá en Supabase para persistir.', 'ok');
}

function renderExplanationFields() {
  if (state.loadingExplanation) {
    return `<div class="aqe-empty">Cargando explicación manual/cacheada…</div>`;
  }
  const exp = state.explanation || null;
  const text = exp?.texto || '';
  const version = Number(exp?.prompt_version || MANUAL_EXPLANATION_PROMPT_VERSION);
  const model = exp?.modelo ? `Modelo actual: ${exp.modelo}` : 'Sin explicación manual/cacheada';
  const hasExplanation = !!String(text || '').trim();
  return `
    <div class="aqe-help">La explicación guardada como <strong>manual</strong> tiene prioridad sobre la IA en la app. Si la borrás, la próxima explicación se regenerará desde IA/cache nuevo.</div>
    <label class="aqe-field">
      <span>Texto de explicación</span>
      <textarea rows="10" data-admin-editor-field="explicacion_texto" placeholder="Escribí o corregí la explicación...">${escapeTextareaValue(text)}</textarea>
    </label>
    ${renderExplanationImagesPanel(text)}
    <div class="aqe-grid2">
      <label class="aqe-field">
        <span>Prompt version</span>
        <input type="number" min="1" data-admin-editor-field="explicacion_version" value="${version}">
      </label>
      <div class="aqe-readonly-meta">${escapeHtml(model)}</div>
    </div>
    <div class="aqe-actions-inline">
      <button
        type="button"
        class="aqe-danger"
        data-admin-editor-action="delete-explanation"
        ${hasExplanation && !state.deletingExplanation ? '' : 'disabled'}
      >${state.deletingExplanation ? 'Borrando explicación...' : 'Borrar explicación'}</button>
    </div>`;
}

function renderBody() {
  const body = getBody();
  const question = state.question;
  if (!body || !question) return;
  const tab = state.activeTab || 'pregunta';
  const badges = `
    <div class="aqe-badges">
      <span>${escapeHtml(question.examen || 'Banco')}</span>
      <span>${escapeHtml(question.especialidad || 'Sin especialidad')}</span>
      <span>${escapeHtml(question.tema || 'Sin tema')}</span>
      ${question.corregida ? '<span class="ok">✓ Corregida</span>' : '<span class="warn">Pendiente</span>'}
      ${question.anulada ? '<span class="danger">Anulada</span>' : ''}
    </div>`;

  const panels = {
    pregunta: `
      ${badges}
      <label class="aqe-field">
        <span>Enunciado</span>
        <textarea rows="8" data-admin-editor-field="pregunta">${escapeHtml(question.pregunta || '')}</textarea>
      </label>`,
    opciones: `
      ${badges}
      ${renderOptionRows()}`,
    meta: `
      ${badges}
      ${renderMetaFields(question)}`,
    explicacion: `
      ${badges}
      ${renderExplanationFields()}`,
  };
  body.innerHTML = panels[tab] || panels.pregunta;
  document.querySelectorAll('#adminQuestionEditorModal .aqe-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

function renderModal() {
  const modal = ensureModal();
  const q = state.question;
  document.getElementById('adminQuestionEditorTitle').textContent = q ? 'Editor de pregunta' : 'Editor de pregunta';
  document.getElementById('adminQuestionEditorSubtitle').textContent = getQuestionTitle(q, state.index);
  modal.classList.toggle('vis', !!state.open);
  renderBody();
}

async function loadExplanation(questionId) {
  const sb = getSb();
  if (!sb || !questionId) return null;
  state.loadingExplanation = true;
  if (state.open) renderBody();
  try {
    const { data, error } = await sb
      .from('explicaciones_cache')
      .select('*')
      .eq('pregunta_id', questionId)
      .order('prompt_version', { ascending: false })
      .limit(1);
    if (error) throw error;
    state.explanation = Array.isArray(data) && data.length ? data[0] : null;
    return state.explanation;
  } catch (error) {
    console.warn('[ResiAR] No se pudo cargar explicación para editor admin:', error);
    state.explanation = null;
    setMsg('No se pudo cargar la explicación: ' + (error?.message || error), 'er');
    return null;
  } finally {
    state.loadingExplanation = false;
    if (state.open) renderBody();
  }
}

function openForQuestion(question, index = -1) {
  if (!isAdmin()) {
    toast('Modo corrección disponible solo para administrador.');
    return false;
  }
  if (!question?.id) {
    toast('No hay pregunta activa para corregir.');
    return false;
  }
  state.open = true;
  state.question = { ...question, opciones: { ...(question.opciones || {}) } };
  state.options = normalizeOptions(question.opciones || {});
  state.index = Number.isFinite(index) ? index : -1;
  state.explanation = null;
  state.activeTab = 'pregunta';
  ensureModal();
  renderModal();
  loadExplanation(question.id);
  return true;
}

function openCurrent() {
  const exam = getCurrentExam();
  const index = getCurrentIndex();
  return openForQuestion(exam[index], index);
}

function close() {
  state.open = false;
  renderModal();
}

function updateStateFromDom() {
  if (!state.question) return;
  const root = getModal();
  if (!root) return;
  root.querySelectorAll('[data-admin-editor-field]').forEach((input) => {
    const field = input.dataset.adminEditorField;
    if (field === 'option') {
      const key = safeUpper(input.dataset.key);
      if (key) state.options[key] = input.value;
      return;
    }
    if (field === 'corregida' || field === 'anulada') {
      state.question[field] = !!input.checked;
      return;
    }
    if (field === 'explicacion_texto' || field === 'explicacion_version') {
      state.explanation = state.explanation || { pregunta_id: state.question.id, modelo: 'manual' };
      if (field === 'explicacion_texto') state.explanation.texto = input.value;
      if (field === 'explicacion_version') state.explanation.prompt_version = Math.max(1, Number(input.value) || 1);
      return;
    }
    state.question[field] = input.value;
  });
}

function switchTab(tab) {
  updateStateFromDom();
  state.activeTab = tab || 'pregunta';
  renderBody();
}

function addOption() {
  updateStateFromDom();
  const current = Object.keys(state.options).length;
  if (current >= OPTION_LETTERS.length) {
    setMsg('Máximo 8 opciones.', 'er');
    return;
  }
  state.options[OPTION_LETTERS[current]] = '';
  renderBody();
}

function removeOption() {
  updateStateFromDom();
  const keys = Object.keys(state.options);
  if (keys.length <= 1) {
    setMsg('Debe quedar al menos una opción.', 'er');
    return;
  }
  delete state.options[keys[keys.length - 1]];
  const response = safeUpper(state.question?.respuesta);
  if (!state.options[response]) state.question.respuesta = '';
  renderBody();
}

function loadCorrectAnswer() {
  updateStateFromDom();
  const answer = getKnownCorrectAnswer();
  if (!answer) {
    setMsg('No hay respuesta correcta disponible para cargar. Respondé primero la pregunta o recargá desde Supabase.', 'er');
    return;
  }
  if (!state.options?.[answer]) {
    setMsg(`La respuesta ${answer} no existe entre las opciones actuales.`, 'er');
    return;
  }
  state.question.respuesta = safeLower(answer);
  state.activeTab = 'opciones';
  renderBody();
  setMsg(`Respuesta correcta cargada: ${answer}. Guardá para persistir en Supabase.`, 'ok');
}

function fillTopic(field, value) {
  updateStateFromDom();
  const key = String(field || '').trim();
  if (!['tema', 'tema_v2'].includes(key)) return;
  state.question[key] = String(value || '').trim();
  state.activeTab = 'meta';
  renderBody();
  const input = document.querySelector(`#adminQuestionEditorModal [data-admin-editor-field="${key}"]`);
  if (input) {
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
  }
  setMsg(`Tema completado desde los existentes: ${state.question[key] || '—'}. Guardá para persistir.`, 'ok');
}

function applyV2() {
  updateStateFromDom();
  const esp = String(state.question?.especialidad_v2 || '').trim();
  const tema = String(state.question?.tema_v2 || '').trim();
  if (!esp && !tema) {
    setMsg('La reclasificación v2 no tiene datos para aplicar.', 'er');
    return;
  }
  if (esp) state.question.especialidad = esp;
  if (tema) state.question.tema = tema;
  state.activeTab = 'meta';
  renderBody();
  setMsg('Clasificación v2 copiada a los campos oficiales. Guardá para persistir.', 'ok');
}

function normalizeQuestionForComparison(question = {}) {
  const out = {};
  if ('pregunta' in question) out.pregunta = String(question.pregunta ?? '').trim();
  if ('respuesta' in question) out.respuesta = safeLower(question.respuesta);
  if ('especialidad' in question) out.especialidad = String(question.especialidad ?? '').trim();
  if ('tema' in question) out.tema = String(question.tema ?? '').trim();
  if ('tipo' in question) out.tipo = String(question.tipo ?? '').trim();
  if ('anulada' in question) out.anulada = normalizeBool(question.anulada);
  if ('especialidad_v2' in question) out.especialidad_v2 = String(question.especialidad_v2 ?? '').trim();
  if ('tema_v2' in question) out.tema_v2 = String(question.tema_v2 ?? '').trim();
  if ('clasificacion_confianza' in question) out.clasificacion_confianza = String(question.clasificacion_confianza ?? '').trim();
  if ('clasificacion_modelo' in question) out.clasificacion_modelo = String(question.clasificacion_modelo ?? '').trim();
  if ('opciones' in question) {
    const normalizedOptions = {};
    Object.entries(question.opciones || {}).forEach(([key, value]) => {
      const k = safeLower(key);
      if (k) normalizedOptions[k] = String(value ?? '').trim();
    });
    out.opciones = normalizedOptions;
  }
  return out;
}

function assertSavedQuestionMatches(expected = {}, actual = {}) {
  if (!actual || typeof actual !== 'object') {
    throw new Error('Supabase no devolvió la pregunta actualizada. No se puede confirmar el guardado.');
  }

  const exp = normalizeQuestionForComparison(expected);
  const got = normalizeQuestionForComparison(actual);
  const failures = [];

  ['pregunta', 'respuesta', 'especialidad', 'tema', 'tipo', 'especialidad_v2', 'tema_v2', 'clasificacion_confianza', 'clasificacion_modelo'].forEach((field) => {
    if (!(field in exp)) return;
    if (String(exp[field] ?? '') !== String(got[field] ?? '')) failures.push(field);
  });

  if ('anulada' in exp && Boolean(exp.anulada) !== Boolean(got.anulada)) failures.push('anulada');

  if ('opciones' in exp) {
    const expOps = JSON.stringify(exp.opciones || {});
    const gotOps = JSON.stringify(got.opciones || {});
    if (expOps !== gotOps) failures.push('opciones');
  }

  if (failures.length) {
    throw new Error(`Supabase respondió, pero no confirmó los cambios en: ${failures.join(', ')}. Recargá antes de seguir corrigiendo.`);
  }
}

function buildSavePayload() {
  updateStateFromDom();
  const response = safeLower(state.question.respuesta);
  const question = {
    pregunta: String(state.question.pregunta || ''),
    opciones: lowerOptions(state.options),
    respuesta: response || null,
    especialidad: normalizeNullableText(state.question.especialidad),
    tema: normalizeNullableText(state.question.tema),
    tipo: normalizeNullableText(state.question.tipo),
    corregida: true,
    anulada: normalizeBool(state.question.anulada),
    especialidad_v2: normalizeNullableText(state.question.especialidad_v2),
    tema_v2: normalizeNullableText(state.question.tema_v2),
    clasificacion_confianza: normalizeNullableText(state.question.clasificacion_confianza),
    clasificacion_modelo: normalizeNullableText(state.question.clasificacion_modelo),
  };
  const explanationText = String(state.explanation?.texto || '').trim();
  const explanation = explanationText ? {
    texto: explanationText,
    prompt_version: Math.max(1, Number(state.explanation?.prompt_version || MANUAL_EXPLANATION_PROMPT_VERSION) || MANUAL_EXPLANATION_PROMPT_VERSION),
    modelo: 'manual',
  } : null;

  return {
    action: 'update',
    questionId: state.question.id,
    id: state.question.id,
    ...question,
    question,
    explanation,
  };
}

async function getAccessToken() {
  const sb = getSb();
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesión no disponible');
  return token;
}

async function save() {
  if (!state.question?.id || state.saving) return;
  if (!isAdmin()) {
    setMsg('Solo administrador puede guardar cambios.', 'er');
    return;
  }
  const sb = getSb();
  if (!sb) {
    setMsg('Supabase no está inicializado.', 'er');
    return;
  }
  const saveBtn = document.getElementById('adminQuestionEditorSaveBtn');
  state.saving = true;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }
  setMsg('Guardando cambios en Supabase...');
  try {
    const savePayload = buildSavePayload();
    const token = await getAccessToken();
    const endpoint = `${String(deps.getSupabaseUrl?.() || window.SUPA_URL || '').replace(/\/$/, '')}/functions/v1/admin-update-question`;
    if (!endpoint.startsWith('http')) throw new Error('URL de Supabase no disponible');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(savePayload),
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok || json?.error) {
      throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
    }

    const updatedQuestion = json?.question || json?.data?.question;
    assertSavedQuestionMatches(savePayload.question, updatedQuestion);

    const version = json?.questionBankVersion || json?.version || json?.data?.questionBankVersion || null;
    if (typeof deps.applyUpdatedQuestion === 'function') {
      deps.applyUpdatedQuestion(updatedQuestion, { questionBankVersion: version });
    }

    state.question = { ...(state.question || {}), ...(updatedQuestion || {}) };
    state.options = normalizeOptions(state.question.opciones || lowerOptions(state.options));

    if (savePayload.explanation) {
      state.explanation = {
        ...(state.explanation || {}),
        ...(json?.explanation || {}),
        pregunta_id: state.question.id,
        texto: json?.explanation?.texto || savePayload.explanation.texto,
        prompt_version: json?.explanation?.prompt_version || savePayload.explanation.prompt_version,
        modelo: 'manual',
      };

      if (typeof deps.applyUpdatedExplanation === 'function') {
        try { await deps.applyUpdatedExplanation(state.question.id, state.explanation); } catch (_) {}
      }
    } else {
      state.explanation = null;
    }

    const cacheText = json?.cacheInvalidated ? ' Cache IA invalidada.' : '';
    setMsg(`Pregunta guardada y banco publicado.${cacheText}`, 'ok');
    toast('Pregunta corregida, cache invalidada y banco publicado.');
    renderBody();
  } catch (error) {
    const message = error?.message || String(error || 'error desconocido');
    setMsg('Error al guardar: ' + message, 'er');
  } finally {
    state.saving = false;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar en Supabase'; }
  }
}

async function deleteExplanation() {
  if (!state.question?.id || state.deletingExplanation) return;
  if (!isAdmin()) {
    setMsg('Solo administrador puede borrar explicaciones.', 'er');
    return;
  }

  updateStateFromDom();

  const hasExplanation = !!String(state.explanation?.texto || '').trim();
  if (!hasExplanation) {
    setMsg('No hay explicación guardada para borrar.', '');
    return;
  }

  const typed = window.prompt(
    `Borrar la explicación cacheada/manual de esta pregunta:\n\n${getQuestionTitle(state.question, state.index)}\n\nLa pregunta NO se borra. Solo se elimina la explicación guardada.\n\nEscribí BORRAR para confirmar.`
  );

  if (typed !== 'BORRAR') {
    setMsg('Borrado de explicación cancelado.', '');
    return;
  }

  const sb = getSb();
  if (!sb) {
    setMsg('Supabase no está inicializado.', 'er');
    return;
  }

  state.deletingExplanation = true;
  setMsg('Borrando explicación...');
  renderBody();

  try {
    const token = await getAccessToken();
    const endpoint = `${String(deps.getSupabaseUrl?.() || window.SUPA_URL || '').replace(/\/$/, '')}/functions/v1/admin-update-question`;
    if (!endpoint.startsWith('http')) throw new Error('URL de Supabase no disponible');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        action: 'delete-explanation',
        questionId: state.question.id,
      }),
    });

    let json = null;
    try { json = await res.json(); } catch (_) {}

    if (!res.ok || json?.error) {
      throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
    }

    state.explanation = null;
    if (typeof deps.applyDeletedExplanation === 'function') {
      try { await deps.applyDeletedExplanation(state.question.id); } catch (_) {}
    }
    setMsg(`Explicación borrada. Filas eliminadas: ${Number(json?.cacheDeletedCount || 0)}.`, 'ok');
    toast('Explicación borrada.');
    renderBody();
  } catch (error) {
    const message = error?.message || String(error || 'error desconocido');
    setMsg('Error al borrar explicación: ' + message, 'er');
    renderBody();
  } finally {
    state.deletingExplanation = false;
    renderBody();
  }
}

async function deleteQuestion() {
  if (!state.question?.id || state.deleting) return;
  if (!isAdmin()) {
    setMsg('Solo administrador puede borrar preguntas.', 'er');
    return;
  }
  const sb = getSb();
  if (!sb) {
    setMsg('Supabase no está inicializado.', 'er');
    return;
  }
  const label = getQuestionTitle(state.question, state.index);
  const typed = window.prompt(`Borrar definitivamente esta pregunta:\n\n${label}\n\nEsta acción elimina la pregunta del banco, borra su explicación cacheada y publica una nueva versión global.\n\nEscribí BORRAR para confirmar.`);
  if (typed !== 'BORRAR') {
    setMsg('Borrado cancelado.', '');
    return;
  }

  const deleteBtn = document.getElementById('adminQuestionEditorDeleteBtn');
  const saveBtn = document.getElementById('adminQuestionEditorSaveBtn');
  state.deleting = true;
  if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = 'Borrando...'; }
  if (saveBtn) saveBtn.disabled = true;
  setMsg('Borrando pregunta y publicando banco...');

  try {
    const token = await getAccessToken();
    const endpoint = `${String(deps.getSupabaseUrl?.() || window.SUPA_URL || '').replace(/\/$/, '')}/functions/v1/admin-update-question`;
    if (!endpoint.startsWith('http')) throw new Error('URL de Supabase no disponible');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ action: 'delete', questionId: state.question.id }),
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok || json?.error) {
      throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
    }

    const deletedId = json?.questionId || state.question.id;
    const version = json?.questionBankVersion || json?.version || null;
    if (typeof deps.applyDeletedQuestion === 'function') {
      deps.applyDeletedQuestion(deletedId, { questionBankVersion: version });
    }
    toast('Pregunta borrada y banco publicado.');
    close();
    if (typeof deps.renderExam === 'function') deps.renderExam();
  } catch (error) {
    const message = error?.message || String(error || 'error desconocido');
    setMsg('Error al borrar: ' + message, 'er');
  } finally {
    state.deleting = false;
    if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = 'Borrar pregunta'; }
    if (saveBtn) saveBtn.disabled = false;
  }
}

function go(delta) {
  updateStateFromDom();
  const exam = getCurrentExam();
  if (!exam.length) return;
  const current = state.index >= 0 ? state.index : getCurrentIndex();
  const next = current + delta;
  if (next < 0 || next >= exam.length) return;
  if (typeof deps.setCurrentIndex === 'function') deps.setCurrentIndex(next);
  if (typeof deps.renderExam === 'function') deps.renderExam();
  openForQuestion(exam[next], next);
}

function handleClick(event) {
  const trigger = event.target.closest('[data-admin-editor-action]');
  if (!trigger) return;
  const action = trigger.dataset.adminEditorAction;
  event.preventDefault();
  if (action === 'open-current') return openCurrent();
  if (action === 'close') return close();
  if (action === 'tab') return switchTab(trigger.dataset.tab || 'pregunta');
  if (action === 'add-option') return addOption();
  if (action === 'remove-option') return removeOption();
  if (action === 'apply-v2') return applyV2();
  if (action === 'fill-topic') return fillTopic(trigger.dataset.field, trigger.dataset.value);
  if (action === 'insert-explanation-image-url') return insertExplanationImageUrl();
  if (action === 'load-correct-answer') return loadCorrectAnswer();
  if (action === 'save') return save();
  if (action === 'delete-explanation') return deleteExplanation();
  if (action === 'delete') return deleteQuestion();
  if (action === 'reload') return openForQuestion(getCurrentExam()[state.index >= 0 ? state.index : getCurrentIndex()], state.index >= 0 ? state.index : getCurrentIndex());
  if (action === 'previous-question') return go(-1);
  if (action === 'next-question') return go(1);
}

function refreshMetaSuggestions(fieldToFocus) {
  updateStateFromDom();
  renderBody();
  const field = String(fieldToFocus || '').trim();
  if (!field) return;
  const nextInput = document.querySelector(`#adminQuestionEditorModal [data-admin-editor-field="${field}"]`);
  if (nextInput) {
    nextInput.focus();
    try { nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length); } catch (_) {}
  }
}

function handleInput(event) {
  const input = event.target.closest('[data-admin-editor-field]');
  if (!input) return;
  if (input.dataset.adminEditorField === 'explicacion_texto') {
    rememberExplanationInsertionRange();
    return;
  }
  if (state.activeTab !== 'meta') return;
  // No re-render on each keystroke. Rebuilding the topic chips against the full
  // bank while typing made the admin editor feel laggy. Save/reload still reads
  // the DOM through updateStateFromDom(). Specialty changes refresh on change.
}

function handleExplanationCursorEvent(event) {
  const input = event.target.closest?.('[data-admin-editor-field="explicacion_texto"]');
  if (input) rememberExplanationInsertionRange();
}

function handleChange(event) {
  const fileInput = event.target.closest('[data-admin-editor-file="explanation-image"]');
  if (fileInput) {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) uploadExplanationImage(file);
    return;
  }

  const input = event.target.closest('[data-admin-editor-field="especialidad"],[data-admin-editor-field="especialidad_v2"]');
  if (!input || state.activeTab !== 'meta') return;
  refreshMetaSuggestions(input.dataset.adminEditorField);
}

function handleKeydown(event) {
  if (!state.open) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save();
  }
}

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keyup', handleExplanationCursorEvent);
  document.addEventListener('mouseup', handleExplanationCursorEvent);
  document.addEventListener('select', handleExplanationCursorEvent, true);
}

export function configureAdminQuestionEditor(config = {}) {
  deps = config || {};
  install();
  return {
    openCurrent,
    close,
    isOpen: () => !!state.open,
    renderQuestionToolbarButton() {
      if (!isAdmin()) return '';
      return `<button type="button" class="btn-admin-edit-question" data-admin-editor-action="open-current" title="Abrir modo corrección para esta pregunta">✎ Corregir</button>`;
    },
  };
}
