import { describe, it, expect } from 'vitest';
import {
  resiarOptionTextForSearch,
  resiarQuestionCaseTextForSearch,
  resiarQuestionSearchProxy,
  resiarEnhanceQuestionSearchPool,
  resiarCleanSearchPreviewText,
  resiarSearchPreviewTextFromQuestion,
  resiarQuestionMatchesSearchQuery
} from '../utils/questionSearchText.js';

describe('resiarQuestionCaseTextForSearch', () => {
  it('prioriza "pregunta" sobre otros campos', () => {
    expect(resiarQuestionCaseTextForSearch({ pregunta: 'A', enunciado: 'B' })).toBe('A');
  });

  it('cae a enunciado si no hay pregunta', () => {
    expect(resiarQuestionCaseTextForSearch({ enunciado: 'B' })).toBe('B');
  });

  it('devuelve "" si no hay ningún campo de texto', () => {
    expect(resiarQuestionCaseTextForSearch({})).toBe('');
    expect(resiarQuestionCaseTextForSearch(null)).toBe('');
  });
});

describe('resiarOptionTextForSearch', () => {
  it('arma texto a partir de un array de opciones', () => {
    const text = resiarOptionTextForSearch({ opciones: ['Uno', 'Dos'] });
    expect(text).toContain('A) Uno');
    expect(text).toContain('B) Dos');
  });

  it('arma texto a partir de campos opcion_a/opcion_b (se incluyen sin prefijo)', () => {
    const text = resiarOptionTextForSearch({ opcion_a: 'Sí', opcion_b: 'No' });
    expect(text).toContain('Sí');
    expect(text).toContain('No');
  });

  it('devuelve "" si no hay opciones', () => {
    expect(resiarOptionTextForSearch({})).toBe('');
  });
});

describe('resiarQuestionSearchProxy', () => {
  it('devuelve la pregunta original si no hay texto ni opciones', () => {
    const q = { id: 1 };
    expect(resiarQuestionSearchProxy(q)).toBe(q);
  });

  it('arma un proxy con pregunta enriquecida cuando hay texto', () => {
    const proxy = resiarQuestionSearchProxy({ id: 1, pregunta: 'Caso clínico', opciones: ['A', 'B'] });
    expect(proxy.enunciado).toBe('Caso clínico');
    expect(proxy.pregunta).toContain('Caso clínico');
    expect(proxy.pregunta).toContain('Opciones:');
  });
});

describe('resiarEnhanceQuestionSearchPool', () => {
  it('mapea un array de preguntas', () => {
    const pool = [{ id: 1, pregunta: 'X' }, { id: 2 }];
    expect(resiarEnhanceQuestionSearchPool(pool)).toHaveLength(2);
  });

  it('devuelve [] si no recibe un array', () => {
    expect(resiarEnhanceQuestionSearchPool(null)).toEqual([]);
    expect(resiarEnhanceQuestionSearchPool(undefined)).toEqual([]);
  });
});

describe('resiarCleanSearchPreviewText', () => {
  it('colapsa espacios múltiples', () => {
    expect(resiarCleanSearchPreviewText('hola   mundo\n\ntest')).toBe('hola mundo test');
  });

  it('corta todo lo que sigue a "Opciones:"', () => {
    expect(resiarCleanSearchPreviewText('Caso clínico. Opciones: A) x B) y')).toBe('Caso clínico.');
  });
});

describe('resiarSearchPreviewTextFromQuestion', () => {
  it('devuelve el texto del caso, limpio', () => {
    expect(resiarSearchPreviewTextFromQuestion({ pregunta: 'Un   caso  clínico' })).toBe('Un caso clínico');
  });
});

describe('resiarQuestionMatchesSearchQuery', () => {
  const question = { pregunta: 'Paciente con dolor torácico agudo', tema: 'Cardiología' };

  it('matchea si todos los tokens de la query aparecen', () => {
    expect(resiarQuestionMatchesSearchQuery(question, 'dolor torácico')).toBe(true);
  });

  it('no matchea si falta un token', () => {
    expect(resiarQuestionMatchesSearchQuery(question, 'dolor abdominal')).toBe(false);
  });

  it('no matchea con query vacía', () => {
    expect(resiarQuestionMatchesSearchQuery(question, '')).toBe(false);
  });

  it('es insensible a mayúsculas/acentos (via normalizeSearchText)', () => {
    expect(resiarQuestionMatchesSearchQuery(question, 'CARDIOLOGIA')).toBe(true);
  });
});
