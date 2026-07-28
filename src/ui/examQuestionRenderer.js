import { escapeHtml } from '../utils/sanitize.js';
import { renderQuestionRepeatedBanner } from '../utils/questionRepeats.js';
import { getCanonicalOptionEntries, normalizeAnswerValue } from '../utils/answerOptions.js';
import { esBancoMIR, esExamenUnico } from '../utils/examFilters.js';
import {
  getQuestionImageDomId,
  getQuestionImageLabel,
  getQuestionImagePaths,
  getQuestionImageUrlFromPath
} from '../utils/questionImages.js';

export function renderQuestionImage(question, options = {}) {
  const paths = getQuestionImagePaths(question);
  if (!paths.length) return '';

  const safeId = getQuestionImageDomId(question);
  const total = paths.length;
  const altBase = escapeHtml(question?.imagen_alt || 'Imagen de la pregunta');
  const caption = question?.imagen_caption
    ? `<div class="q-img-caption">${escapeHtml(question.imagen_caption)}</div>`
    : '';

  const items = paths.map((path, index) => {
    const url = getQuestionImageUrlFromPath(path, options);
    if (!url) return '';
    const safeUrl = escapeHtml(url);
    const label = escapeHtml(getQuestionImageLabel(path, index, total));
    const alt = total > 1 ? `${altBase} ${index + 1}` : altBase;
    return `
      <a href="${safeUrl}" target="_blank" rel="noopener" class="q-img-link q-img-item">
        ${total > 1 ? `<span class="q-img-label">${label}</span>` : ''}
        <img
          src="${safeUrl}"
          alt="${alt}"
          class="q-img"
          loading="lazy"
          decoding="async"
          data-question-image="true"
        >
      </a>
    `;
  }).join('');

  if (!items.trim()) return '';

  return `
    <figure class="q-img-wrap ${total > 1 ? 'q-img-wrap-multiple' : ''}" id="imagen-pregunta-${safeId}">
      ${total > 1 ? `<div class="q-img-head"><span>Imágenes de referencia</span><small>${total} archivos</small></div>` : ''}
      <div class="q-img-grid ${total > 1 ? 'q-img-grid-multiple' : ''}">
        ${items}
      </div>
      ${caption}
    </figure>
  `;
}

export function renderQuestionTextWithImageRef(text, question) {
  const safe = escapeHtml(text || '');
  if (!getQuestionImagePaths(question).length) return safe;

  const safeId = getQuestionImageDomId(question);

  return safe.replace(
    /\[(imagen|ver imagen|figura|ver figura)\]/gi,
    `<button
      type="button"
      class="q-img-ref"
      data-action="scroll-question-image"
      data-target-id="imagen-pregunta-${safeId}"
    >
      Ver imagen
    </button>`
  );
}

function visibleQuestionType(tipo) {
  const raw = String(tipo || '').trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'medicina' || normalized === 'opcion_multiple' || normalized === 'opción_multiple' || normalized === 'multiple_choice') return null;
  return raw;
}

function renderQuestionMeta(question, getQuestionNumber) {
  const tipo = visibleQuestionType(question.tipo);
  const anio = (question.anio || question.año || question.year);
  const examenNombre = esExamenUnico(question.examen) ? 'Examen Único' : question.examen;
  const examenYaTieneAnio = anio && examenNombre && examenNombre.includes(String(anio));
  const esENARM = (question.examen || '').toUpperCase().includes('ENARM');
  const partes = [tipo, examenNombre, (examenYaTieneAnio || esENARM) ? null : anio].filter(Boolean);
  return `${partes.join(' · ')}<br>Pregunta ${getQuestionNumber(question)}`;
}

function renderQuestionCancelledBanner(question, isRespuestaAnulada) {
  if (!isRespuestaAnulada(question)) return '';
  return `
  <div class="banner-anulada">
    ⚠️ <span>${esBancoMIR(question.examen)
      ? `<strong>Pregunta anulada por el MIR</strong> — Esta pregunta fue anulada oficialmente por las autoridades responsables del examen MIR. Tu elección no afecta tu puntaje.`
      : `<strong>Pregunta sin respuesta cargada</strong> — Esta pregunta puede tener un error en la base de datos. Tu elección no afecta tu puntaje. Si podés confirmar la respuesta correcta, usá el botón <em>Reportar pregunta</em> para ayudarnos a corregirla.`
    }</span>
  </div>`;
}

function renderQuestionOptions({ question, currentAnswer, showResolution, isRespuestaAnulada }) {
  let html = '';
  const selectedAnswer = normalizeAnswerValue(currentAnswer);
  const correctAnswer = normalizeAnswerValue(question?.respuesta);

  for (const [key, value] of getCanonicalOptionEntries(question)) {
    const optionKey = normalizeAnswerValue(key);
    let cls = 'opcion resiar-option';
    if (showResolution) {
      if (isRespuestaAnulada(question)) {
        if (optionKey === selectedAnswer) cls += ' anulada';
      } else {
        if (correctAnswer && optionKey === correctAnswer) cls += ' ok';
        else if (selectedAnswer && optionKey === selectedAnswer) cls += ' no';
      }
    }
    const safeKey = escapeHtml(optionKey || key);
    const answerAttrs = showResolution ? 'data-off="1"' : `data-action="exam-answer" data-answer="${safeKey}"`;
    html += `<label class="${cls}" ${answerAttrs}>
      <input type="radio" ${showResolution ? 'disabled' : ''}>
      <span class="olbl resiar-option-label">${safeKey}</span>
      <span class="otext resiar-option-text">${escapeHtml(value)}</span>
    </label>`;
  }
  return html;
}

function shouldUseMobileExamUi() {
  try {
    if (typeof window !== 'undefined' && typeof window.resiarShouldUseMobileExamUi === 'function') {
      return !!window.resiarShouldUseMobileExamUi();
    }
  } catch (_) {}
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1180px)').matches);
  } catch (_) {
    return false;
  }
}

function renderQuestionNavButtons({ currentIndex, total, isReviewMode }) {
  if (shouldUseMobileExamUi()) return '';

  return isReviewMode ? `
    <div class="nav-inline nav-review-mode resiar-desktop-exam-nav" data-exam-nav-role="desktop">
      <button class="bnav" data-action="exam-prev" ${currentIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="bfin" data-action="close-review-and-show-final">Volver al resultado</button>
      <button class="bnext" data-action="exam-next" ${currentIndex === total - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>` : `
    <div class="nav-inline resiar-desktop-exam-nav" data-exam-nav-role="desktop">
      <button class="bnav" data-action="exam-prev" ${currentIndex === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="bfin" data-action="exam-finish">Finalizar examen</button>
      <button class="bnext" data-action="exam-next" ${currentIndex === total - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>`;
}

function renderExplanationControls({ showResolution, isTrialLimited }) {
  if (!showResolution) return '';
  if (isTrialLimited) {
    return `
        <div style="margin-top:14px;padding:11px 16px;background:linear-gradient(135deg,rgba(251,191,36,0.07),rgba(167,139,250,0.07));border:1px solid rgba(251,191,36,0.25);border-radius:11px;font-family:var(--font-ui);font-size:0.78rem;color:var(--text2);text-align:center;line-height:1.6;">
          🔒 <strong style="color:var(--amber)">Explicación con IA</strong> disponible en el plan Pro
        </div>`;
  }
  return `
        <button class="btn-explicar" id="btnExplicar" data-action="exam-request-explanation">
          <span class="ai-spinner"></span>
          <span class="ai-icon">⚙</span>
          <span class="ai-txt">✨ Explicar con IA</span>
        </button>
        <div id="explicacionBox"></div>`;
}

export function buildExamQuestionHtml({
  exam,
  currentIndex,
  answers,
  marked,
  questionTimes,
  isReviewMode,
  hasSideQuestionNav,
  isExamRunning,
  isExamFinished,
  isTrialLimited,
  isRespuestaAnulada,
  getQuestionNumber,
  renderInlineQuestionNav,
  questionChatDockHtml,
  questionImageOptions = {},
  adminQuestionEditorButtonHtml = ''
}) {
  const question = exam[currentIndex];
  const currentAnswer = answers[currentIndex];
  const hasAnswer = !!currentAnswer;
  const isMarked = marked.has(currentIndex);
  const seconds = questionTimes[currentIndex] || 0;
  const timerCls = seconds > 120 ? 'veryslow' : seconds > 60 ? 'slow' : '';
  const timerTxt = seconds ? `⏱ ${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` : '';
  const showResolution = hasAnswer || isReviewMode;
  const shouldRenderInlineNav = !isReviewMode && !hasSideQuestionNav;

  let html = `<div class="fade-in resiar-exam-question${isReviewMode ? ' review-question-mode' : ''}">
    <div class="qhdr resiar-question-header">
      <span class="qcount">${currentIndex + 1} / ${exam.length}</span>
      <div class="qhdr-actions">
        ${timerTxt ? `<span class="q-timer ${timerCls}">${timerTxt}</span>` : ''}
        ${adminQuestionEditorButtonHtml || ''}
        <button class="btn-bookmark ${isMarked ? 'marked' : ''}" data-action="exam-toggle-marked" data-index="${currentIndex}" title="${isMarked ? 'Quitar marcador' : 'Marcar para revisar'}">${isMarked ? '🔖' : '🏷️'}</button>
        <span class="qmeta">${renderQuestionMeta(question, getQuestionNumber)}</span>
      </div>
    </div>
    <div class="qtext resiar-question-text">${renderQuestionTextWithImageRef(question.pregunta, question)}</div>${renderQuestionImage(question, questionImageOptions)}
  ${renderQuestionRepeatedBanner(question)}
  ${renderQuestionCancelledBanner(question, isRespuestaAnulada)}`;

  html += renderQuestionOptions({ question, currentAnswer, showResolution, isRespuestaAnulada });
  html += renderQuestionNavButtons({ currentIndex, total: exam.length, isReviewMode });
  html += renderExplanationControls({ showResolution, isTrialLimited });

  if (shouldRenderInlineNav) {
    html += `
      <div class="qnav-wrap">
        <div class="qnav-grid">${renderInlineQuestionNav('inline')}</div>
      </div>`;
  }

  if (isExamRunning && !isExamFinished) {
    html += questionChatDockHtml(question);
  }

  html += `</div>`;

  return {
    html,
    question,
    shouldRenderInlineNav
  };
}

export function afterExamQuestionRender({ shouldRenderInlineNav, currentIndex, initNavDrag }) {
  try {
    document.body.classList.add('resiar-user-authenticated', 'resiar-in-simulator', 'resiar-view-exam', 'resiar-exam-render-active');
    document.body.dataset.resiarView = 'exam';
    document.getElementById('preguntaBox')?.setAttribute('data-resiar-render', 'exam-question');
  } catch (_) {}
  requestAnimationFrame(() => {
    if (shouldRenderInlineNav) {
      const dot = document.getElementById(`qnavdot_${currentIndex}`);
      if (dot) dot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    initNavDrag();
  });
}
