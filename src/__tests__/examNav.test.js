import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureExamNav,
  getOptimizedNavRanges
} from '../ui/examNav.js';
import { esRespuestaAnulada } from '../utils/examAnswers.js';

describe('getOptimizedNavRanges (pura)', () => {
  it('devuelve un único rango completo para bancos chicos (<=180)', () => {
    expect(getOptimizedNavRanges(50, 10)).toEqual([[0, 49]]);
    expect(getOptimizedNavRanges(180, 179)).toEqual([[0, 179]]);
  });

  it('para bancos grandes, recorta a una ventana alrededor de la pregunta actual', () => {
    const ranges = getOptimizedNavRanges(500, 250);
    // Debe incluir el principio, el final, y la página actual (bloques de 90)
    expect(ranges[0]).toEqual([0, 2]);
    expect(ranges[ranges.length - 1]).toEqual([497, 499]);
    const middle = ranges.find(([s, e]) => 250 >= s && 250 <= e);
    expect(middle).toBeDefined();
  });

  it('fusiona rangos que quedan contiguos o superpuestos', () => {
    // Cerca del principio, el rango inicial y la página actual se pisan
    const ranges = getOptimizedNavRanges(500, 5);
    // No debe haber rangos solapados/duplicados: cada rango empieza después
    // de que termina el anterior (con al menos un hueco de 1)
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][1]);
    }
  });

  it('no revienta con total 0 o current fuera de rango', () => {
    expect(getOptimizedNavRanges(0, 0)).toEqual([[0, -1]]);
    expect(() => getOptimizedNavRanges(500, 9999)).not.toThrow();
  });
});

describe('esRespuestaAnulada (pura)', () => {
  it('es true si la pregunta viene marcada anulada explícitamente', () => {
    expect(esRespuestaAnulada({ anulada: true, respuesta: 'a' })).toBe(true);
  });

  it('es true si no hay valor de respuesta válido', () => {
    expect(esRespuestaAnulada({ respuesta: null })).toBe(true);
    expect(esRespuestaAnulada({ respuesta: '' })).toBe(true);
  });

  it('es false si hay una respuesta válida y no está anulada', () => {
    expect(esRespuestaAnulada({ respuesta: 'a', anulada: false })).toBe(false);
  });

  it('respeta _resiarAnswerHidden: solo mira el flag anulada, no la respuesta oculta', () => {
    expect(esRespuestaAnulada({ _resiarAnswerHidden: true, anulada: false, respuesta: null })).toBe(false);
    expect(esRespuestaAnulada({ _resiarAnswerHidden: true, anulada: true, respuesta: null })).toBe(true);
  });

  it('devuelve false para valores no-objeto', () => {
    expect(esRespuestaAnulada(null)).toBe(false);
    expect(esRespuestaAnulada(undefined)).toBe(false);
  });
});

describe('configureExamNav — getQuestionNavClass (con dependencias mock)', () => {
  let examen, actual, marcadas, visitadas, evaluations, api;

  beforeEach(() => {
    examen = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
    actual = 1;
    marcadas = new Set();
    visitadas = new Set([2]);
    evaluations = {
      0: { status: 'ok' },
      1: { status: 'pendiente' },
      2: { status: null }
    };
    api = configureExamNav({
      getExamen: () => examen,
      getActual: () => actual,
      getMarcadas: () => marcadas,
      getVisitadas: () => visitadas,
      evaluateQuestionAnswer: (i) => evaluations[i] || { status: null }
    });
  });

  it('marca la pregunta actual con clase "actual" + su status', () => {
    expect(api.getQuestionNavClass(examen[1], 1)).toBe('actual pendiente');
  });

  it('marca correctas e incorrectas según el status de evaluación', () => {
    expect(api.getQuestionNavClass(examen[0], 0)).toBe('ok');
  });

  it('marca "salteada" si fue visitada pero no tiene status ni es la actual', () => {
    expect(api.getQuestionNavClass(examen[2], 2)).toBe('salteada');
  });

  it('renderNavDotsOptimized genera un dot por pregunta con la clase correcta', () => {
    const html = api.renderNavDotsOptimized('inline');
    expect(html).toContain('id="qnavdot_0"');
    expect(html).toContain('actual pendiente');
  });
});
