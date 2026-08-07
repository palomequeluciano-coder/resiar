/*
 * ResiAR — orden estable de preguntas.
 *
 * Mantiene el orden original para exámenes específicos. En IDs compuestos
 * como CABA_2006_15 usa el último bloque numérico como número de pregunta.
 */

import { esProvinciaBsAs, esExamenUnico, PROVINCIA_VALUE, EU_VALUE } from './examFilters.js';

export function resiarParseOrderNumber(value) {
  if (value == null || value === '') return Number.POSITIVE_INFINITY;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value).trim();
  const exact = Number(text.replace(',', '.'));
  if (Number.isFinite(exact)) return exact;

  const matches = text.match(/\d+/g);
  return matches && matches.length
    ? Number(matches[matches.length - 1])
    : Number.POSITIVE_INFINITY;
}

export function resiarQuestionOriginalOrderValue(question) {
  const candidates = [
    question?.num_original,
    question?.numero,
    question?.nro,
    question?.nro_pregunta,
    question?.pregunta_numero,
    question?.numero_pregunta,
    question?.orden,
    question?.orden_original,
    question?.question_number,
    question?.question_no
  ];

  for (const candidate of candidates) {
    const parsed = resiarParseOrderNumber(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }

  const idNumber = resiarParseOrderNumber(question?.id);
  if (Number.isFinite(idNumber)) return idNumber;

  const rank = resiarParseOrderNumber(question?._resiarOriginalGroupRank);
  if (Number.isFinite(rank)) return rank;

  return Number.POSITIVE_INFINITY;
}

// Muestra sólo el número visible de la pregunta, no el ID completo
// (ej: CABA_2006_15 debe verse como "Pregunta 15").
export function resiarGetNPregunta(question) {
  const n = resiarQuestionOriginalOrderValue(question);
  if (Number.isFinite(n)) return n;
  return question?.id ?? '–';
}

export function resiarQuestionYear(question) {
  const y = question && (question.anio ?? question.año ?? question.year);
  if (y !== undefined && y !== null && y !== '') return String(y);
  const match = String((question && question.examen) || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

// Agrupa Provincia de Buenos Aires y Examen Único bajo su clave canónica
// (igual que en los selects de filtro), para que la numeración por examen
// reinicie en 1 de forma consistente con el resto de la app.
export function resiarQuestionBank(question) {
  const ex = String((question && question.examen) || '');
  if (esProvinciaBsAs(ex)) return PROVINCIA_VALUE;
  if (esExamenUnico(ex)) return EU_VALUE;
  return ex || 'Sin examen';
}

export function resiarQuestionStableFallback(question) {
  const loadIndex = resiarParseOrderNumber(question?._resiarLoadIndex);
  if (Number.isFinite(loadIndex)) return loadIndex;

  const idNumber = resiarParseOrderNumber(question?.id);
  if (Number.isFinite(idNumber)) return idNumber;

  return String(question?.id || question?.pregunta || '').slice(0, 160);
}

// Orden estable: primero agrupa por examen+año (cada año/examen arranca en
// 1), y dentro de cada grupo ordena por el número original de la pregunta.
export function resiarStableOriginalQuestionCompare(a, b) {
  const groupA = `${resiarQuestionBank(a)}::${resiarQuestionYear(a)}`;
  const groupB = `${resiarQuestionBank(b)}::${resiarQuestionYear(b)}`;
  if (groupA !== groupB) {
    return groupA.localeCompare(groupB, 'es', { numeric: true, sensitivity: 'base' });
  }

  const orderA = resiarQuestionOriginalOrderValue(a);
  const orderB = resiarQuestionOriginalOrderValue(b);
  if (orderA !== orderB) return orderA - orderB;

  const fallbackA = resiarQuestionStableFallback(a);
  const fallbackB = resiarQuestionStableFallback(b);

  if (typeof fallbackA === 'number' && typeof fallbackB === 'number' && fallbackA !== fallbackB) {
    return fallbackA - fallbackB;
  }

  return String(fallbackA).localeCompare(String(fallbackB), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

export function resiarSortByOriginalExamOrder(list) {
  return (Array.isArray(list) ? list : []).slice().sort(resiarStableOriginalQuestionCompare);
}
