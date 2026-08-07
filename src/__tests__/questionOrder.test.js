import { describe, it, expect } from 'vitest';
import {
  resiarParseOrderNumber,
  resiarQuestionBank,
  resiarQuestionYear,
  resiarGetNPregunta,
  resiarSortByOriginalExamOrder
} from '../utils/questionOrder.js';

// Estos tests existen para probar que consolidar la lógica de orden de
// preguntas en este módulo (en vez del IIFE "resiar-question-order-
// stability-script" que la pisaba en runtime dentro de main.js) no cambia
// el comportamiento real que hoy ve la gente en producción. Reimplementamos
// acá la lógica EXACTA del IIFE viejo como referencia y comparamos.

function legacyParseLastOrderNumber(v) {
  if (v == null || v === '') return Number.POSITIVE_INFINITY;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const exact = Number(s.replace(',', '.'));
  if (Number.isFinite(exact)) return exact;
  const m = s.match(/\d+/g);
  return m && m.length ? Number(m[m.length - 1]) : Number.POSITIVE_INFINITY;
}

function legacyQuestionNumberFromIdOrFields(p) {
  const fields = ['num_original', 'numero', 'nro', 'nro_pregunta', 'pregunta_numero', 'numero_pregunta', 'orden', 'orden_original', 'question_number', 'question_no'];
  for (const f of fields) {
    const n = legacyParseLastOrderNumber(p && p[f]);
    if (Number.isFinite(n)) return n;
  }
  const idN = legacyParseLastOrderNumber(p && p.id);
  if (Number.isFinite(idN)) return idN;
  const rank = legacyParseLastOrderNumber(p && p._resiarOriginalGroupRank);
  if (Number.isFinite(rank)) return rank;
  return Number.POSITIVE_INFINITY;
}

function legacyGetNPregunta(p) {
  const n = legacyQuestionNumberFromIdOrFields(p);
  if (Number.isFinite(n)) return n;
  return (p && p.id) ? p.id : '–';
}

function legacyYearOf(p) {
  const y = p && (p.anio ?? p.año ?? p.year);
  if (y !== undefined && y !== null && y !== '') return String(y);
  const m = String((p && p.examen) || '').match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

function legacyBankOf(p) {
  const ex = String((p && p.examen) || '');
  const u = ex.toUpperCase();
  if (u.includes('BUENOS AIRES') || u.includes('PROVINCIA') || u.includes('PBA')) return '__PROVINCIA_BA__';
  if (u === 'EU') return '__EU__';
  return ex || 'Sin examen';
}

function legacyStableTie(p) {
  const load = legacyParseLastOrderNumber(p && p._resiarLoadIndex);
  if (Number.isFinite(load)) return load;
  return String((p && p.id) || '').toLowerCase();
}

function legacySortByOriginalExamOrder(list) {
  return (Array.isArray(list) ? list : []).slice().sort((a, b) => {
    const ga = legacyBankOf(a) + '::' + legacyYearOf(a);
    const gb = legacyBankOf(b) + '::' + legacyYearOf(b);
    if (ga !== gb) return ga.localeCompare(gb, 'es', { numeric: true, sensitivity: 'base' });
    const oa = legacyQuestionNumberFromIdOrFields(a);
    const ob = legacyQuestionNumberFromIdOrFields(b);
    if (oa !== ob) return oa - ob;
    const ta = legacyStableTie(a), tb = legacyStableTie(b);
    if (typeof ta === 'number' && typeof tb === 'number' && ta !== tb) return ta - tb;
    return String(ta).localeCompare(String(tb), 'es', { numeric: true, sensitivity: 'base' });
  });
}

function buildDataset() {
  return [
    { id: 'CABA_2006_15', examen: 'CABA', anio: 2006, num_original: 15 },
    { id: 'CABA_2006_2', examen: 'CABA', anio: 2006, num_original: 2 },
    { id: 'CABA_2007_1', examen: 'CABA', anio: 2007, num_original: 1 },
    { id: 'ENARM_2020_9', examen: 'ENARM', anio: 2020, num_original: 9 },
    { id: 'ENARM_2020_1', examen: 'ENARM', anio: 2020, num_original: 1 },
    // Provincia de Buenos Aires con distintas variantes de nombre de examen,
    // deben quedar todas en el mismo grupo aunque el string difiera
    { id: 'PBA_1', examen: 'Provincia de Buenos Aires', anio: 2019, num_original: 5 },
    { id: 'PBA_2', examen: 'PBA', anio: 2019, num_original: 1 },
    // Examen Único
    { id: 'EU_1', examen: 'EU', anio: 2021, num_original: 3 },
    { id: 'EU_2', examen: 'EU', anio: 2021, num_original: 1 },
    // sin num_original, sin ningún campo de número → cae al id
    { id: 'MIR_2018_7', examen: 'MIR', anio: 2018 },
    // año embebido en el nombre del examen, no en campo aparte
    { id: 'X_1999_3', examen: 'Examen Especial 1999', num_original: 3 },
    // campo alternativo de número (nro_pregunta) en vez de num_original
    { id: 'ALT_1', examen: 'ALT', anio: 2015, nro_pregunta: 4 },
  ];
}

describe('questionOrder — paridad con la lógica legacy del IIFE (resiar-question-order-stability-script)', () => {
  it('resiarParseOrderNumber coincide con parseLastOrderNumber para valores típicos y raros', () => {
    const casos = ['15', 15, 'CABA_2006_15', '', null, undefined, '3,5', 'abc', '007'];
    for (const c of casos) {
      expect(resiarParseOrderNumber(c)).toBe(legacyParseLastOrderNumber(c));
    }
  });

  it('resiarGetNPregunta da el mismo número que el getNPregunta legacy para todo el dataset', () => {
    const dataset = buildDataset();
    for (const p of dataset) {
      expect(resiarGetNPregunta(p)).toBe(legacyGetNPregunta(p));
    }
  });

  it('resiarQuestionBank agrupa igual que bankOf legacy (incluye variantes de Provincia BA y Examen Único)', () => {
    const dataset = buildDataset();
    for (const p of dataset) {
      expect(resiarQuestionBank(p)).toBe(legacyBankOf(p));
    }
  });

  it('resiarQuestionYear coincide con yearOf legacy, incluida la extracción desde el nombre del examen', () => {
    const dataset = buildDataset();
    for (const p of dataset) {
      expect(resiarQuestionYear(p)).toBe(legacyYearOf(p));
    }
  });

  it('resiarSortByOriginalExamOrder produce el mismo orden final que la versión legacy sobre un dataset mixto', () => {
    const dataset = buildDataset();
    const nuevo = resiarSortByOriginalExamOrder(dataset).map((p) => p.id);
    const legacy = legacySortByOriginalExamOrder(dataset).map((p) => p.id);
    expect(nuevo).toEqual(legacy);
  });

  it('dentro de cada grupo examen+año, la numeración visible arranca en 1 (agrupado, no un sort plano global)', () => {
    const dataset = buildDataset();
    const orden = resiarSortByOriginalExamOrder(dataset);
    // CABA 2006 tiene dos preguntas (num_original 2 y 15): en el sort
    // agrupado deben quedar consecutivas y en orden ascendente entre sí,
    // sin que ENARM/EU/PBA se intercalen en el medio.
    const idxCaba2006_2 = orden.findIndex((p) => p.id === 'CABA_2006_2');
    const idxCaba2006_15 = orden.findIndex((p) => p.id === 'CABA_2006_15');
    expect(idxCaba2006_15).toBe(idxCaba2006_2 + 1);
  });
});
