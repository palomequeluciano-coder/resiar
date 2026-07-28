/*
 * ResiAR — orden estable de preguntas.
 *
 * Mantiene el orden original para exámenes específicos. En IDs compuestos
 * como CABA_2006_15 usa el último bloque numérico como número de pregunta.
 */

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
    question?.orden,
    question?.orden_original,
    question?.question_number
  ];

  for (const candidate of candidates) {
    const parsed = resiarParseOrderNumber(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number.POSITIVE_INFINITY;
}

export function resiarQuestionStableFallback(question) {
  const loadIndex = resiarParseOrderNumber(question?._resiarLoadIndex);
  if (Number.isFinite(loadIndex)) return loadIndex;

  const idNumber = resiarParseOrderNumber(question?.id);
  if (Number.isFinite(idNumber)) return idNumber;

  return String(question?.id || question?.pregunta || '').slice(0, 160);
}

export function resiarStableOriginalQuestionCompare(a, b) {
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
