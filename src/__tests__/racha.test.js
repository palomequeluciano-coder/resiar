import { describe, it, expect } from 'vitest';
import { configureRacha, resiarEvaluationCountsForStreak } from '../ui/racha.js';

describe('resiarEvaluationCountsForStreak (pura)', () => {
  it('false si no está respondida', () => {
    expect(resiarEvaluationCountsForStreak({ answered: false })).toBe(false);
    expect(resiarEvaluationCountsForStreak(null)).toBe(false);
  });

  it('true si está anulada, aunque no sea evaluable', () => {
    expect(resiarEvaluationCountsForStreak({ answered: true, isAnnulled: true, evaluable: false })).toBe(true);
  });

  it('true si es evaluable', () => {
    expect(resiarEvaluationCountsForStreak({ answered: true, evaluable: true })).toBe(true);
  });

  it('false si respondida pero ni anulada ni evaluable (ej. pendiente de corrección)', () => {
    expect(resiarEvaluationCountsForStreak({ answered: true, evaluable: false, isAnnulled: false })).toBe(false);
  });
});

// Arma una evaluación simple a partir de un mapa índice -> resultado.
function makeEvaluator(byIndex) {
  return (i) => byIndex[i] || { answered: false };
}

describe('resiarCalcularRachaCorrectas / resiarFindRachaAnchorIndex (con deps inyectadas)', () => {
  it('cuenta correctas consecutivas hacia atrás desde el ancla', () => {
    const examen = [1, 2, 3, 4, 5];
    const respuestas = ['a', 'a', 'a', 'a', 'a'];
    const evals = {
      0: { answered: true, evaluable: true, isCorrect: true },
      1: { answered: true, evaluable: true, isCorrect: true },
      2: { answered: true, evaluable: true, isCorrect: false },
      3: { answered: true, evaluable: true, isCorrect: true },
      4: { answered: true, evaluable: true, isCorrect: true }
    };
    const { resiarCalcularRachaCorrectas } = configureRacha({
      getExamen: () => examen,
      getRespuestas: () => respuestas,
      getActual: () => 4,
      getLastAnsweredIndex: () => 4,
      evaluateQuestionAnswer: makeEvaluator(evals),
      getCorrectas: () => 4
    });
    // Ancla en índice 4 (correcta), 3 (correcta) -> racha 2, corta en 2 (incorrecta)
    expect(resiarCalcularRachaCorrectas()).toBe(2);
  });

  it('salta preguntas no respondidas sin cortar la racha', () => {
    const examen = [1, 2, 3];
    const respuestas = ['a', null, 'a'];
    const evals = {
      0: { answered: true, evaluable: true, isCorrect: true },
      1: { answered: false },
      2: { answered: true, evaluable: true, isCorrect: true }
    };
    const { resiarCalcularRachaCorrectas } = configureRacha({
      getExamen: () => examen,
      getRespuestas: () => respuestas,
      getActual: () => 2,
      getLastAnsweredIndex: () => 2,
      evaluateQuestionAnswer: makeEvaluator(evals),
      getCorrectas: () => 2
    });
    expect(resiarCalcularRachaCorrectas()).toBe(2);
  });

  it('las anuladas cuentan para el ancla pero no rompen ni suman la racha', () => {
    const examen = [1, 2, 3];
    const respuestas = ['a', 'a', 'a'];
    const evals = {
      0: { answered: true, evaluable: true, isCorrect: true },
      1: { answered: true, isAnnulled: true, evaluable: false },
      2: { answered: true, isAnnulled: true, evaluable: false }
    };
    const { resiarCalcularRachaCorrectas } = configureRacha({
      getExamen: () => examen,
      getRespuestas: () => respuestas,
      getActual: () => 2,
      getLastAnsweredIndex: () => 2,
      evaluateQuestionAnswer: makeEvaluator(evals),
      getCorrectas: () => 1
    });
    expect(resiarCalcularRachaCorrectas()).toBe(1);
  });

  it('sin examen o sin respuestas devuelve 0', () => {
    const { resiarCalcularRachaCorrectas } = configureRacha({
      getExamen: () => [],
      getRespuestas: () => [],
      getActual: () => 0,
      getLastAnsweredIndex: () => -1,
      evaluateQuestionAnswer: makeEvaluator({}),
      getCorrectas: () => 0
    });
    expect(resiarCalcularRachaCorrectas()).toBe(0);
  });
});
