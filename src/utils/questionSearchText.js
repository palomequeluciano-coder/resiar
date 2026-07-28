import { normalizeSearchText } from './text.js';

// Extraído de main.js sin cambios de comportamiento — funciones puras
// de texto/matching para el buscador de preguntas. No tocan el DOM ni
// dependen de estado del módulo (sb, preguntas, etc.).

export function resiarOptionTextForSearch(question) {
  if (!question || typeof question !== 'object') return '';

  const chunks = [];

  const append = (value) => {
    const text = String(value == null ? '' : value).trim();
    if (text) chunks.push(text);
  };

  const opciones = question.opciones;
  if (Array.isArray(opciones)) {
    opciones.forEach((value, index) => append(`${String.fromCharCode(65 + index)}) ${value}`));
  } else if (opciones && typeof opciones === 'object') {
    Object.entries(opciones).forEach(([key, value]) => append(`${String(key).toUpperCase()}) ${value}`));
  }

  [
    'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'opcion_e', 'opcion_f',
    'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE', 'opcionF',
    'opcion1', 'opcion2', 'opcion3', 'opcion4', 'opcion5', 'opcion6',
    'A', 'B', 'C', 'D', 'E', 'F',
    'a', 'b', 'c', 'd', 'e', 'f'
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(question, key)) append(question[key]);
  });

  return [...new Set(chunks)].join(' · ');
}

export function resiarQuestionCaseTextForSearch(question) {
  if (!question || typeof question !== 'object') return '';

  const keys = [
    'pregunta',
    'enunciado',
    'texto',
    'texto_pregunta',
    'pregunta_texto',
    'question_text',
    'questionText',
    'statement',
    'stem',
    'caso',
    'consigna',
    'body'
  ];

  for (const key of keys) {
    const value = String(question[key] == null ? '' : question[key]).trim();
    if (value) return value;
  }

  return '';
}

export function resiarQuestionSearchProxy(question) {
  if (!question || typeof question !== 'object') return question;

  const optionText = resiarOptionTextForSearch(question);
  const baseText = resiarQuestionCaseTextForSearch(question);

  if (!baseText && !optionText) return question;

  const searchText = `${baseText}${optionText ? `\n\nOpciones: ${optionText}` : ''}`.trim();

  return {
    ...question,

    // Se conserva el texto original para depurar si hiciera falta.
    __resiarOriginalPregunta: question.pregunta,
    __resiarOriginalEnunciado: question.enunciado,
    __resiarOriginalTexto: question.texto,
    __resiarSearchOptionsText: optionText,
    __resiarSearchCaseText: baseText,

    // reviewSearch.js puede leer distintos campos según la pantalla.
    // Rellenamos todos para que el resultado vuelva a mostrar el inicio del caso.
    pregunta: searchText,
    enunciado: baseText || question.enunciado || question.pregunta || question.texto || '',
    texto: baseText || question.texto || question.pregunta || question.enunciado || '',
    preview: baseText,
    resumen: baseText
  };
}

export function resiarEnhanceQuestionSearchPool(pool) {
  if (!Array.isArray(pool)) return [];
  return pool.map(resiarQuestionSearchProxy);
}

export function resiarCleanSearchPreviewText(text) {
  return String(text == null ? '' : text)
    .replace(/\s+/g, ' ')
    .replace(/\bOpciones:\s.*$/i, '')
    .trim();
}

export function resiarSearchPreviewTextFromQuestion(question) {
  const text = resiarQuestionCaseTextForSearch(question);
  return resiarCleanSearchPreviewText(text);
}

export function resiarQuestionSearchHaystack(question) {
  if (!question || typeof question !== 'object') return '';
  const proxy = resiarQuestionSearchProxy(question) || question;
  return normalizeSearchText([
    proxy.pregunta,
    proxy.enunciado,
    proxy.texto,
    proxy.preview,
    proxy.resumen,
    proxy.__resiarSearchOptionsText,
    proxy.tema,
    proxy.topic,
    proxy.especialidad,
    proxy.categoria,
    proxy.examen,
    proxy.anio,
    proxy.año
  ].filter(Boolean).join(' '));
}

export function resiarQuestionMatchesSearchQuery(question, query) {
  const q = normalizeSearchText(query);
  if (!q) return false;
  return q.split(/\s+/).filter(Boolean).every((token) => resiarQuestionSearchHaystack(question).includes(token));
}
