import { describe, it, expect } from 'vitest';
import { normalizeQuestionPerformance, buildMistakesExamPlan } from '../services/mistakesExam.js';

// mistakesExam.js decide qué preguntas ve cada usuario en el "repaso de
// errores" -- lógica 100% pura (sin DOM ni red), pero con bastante
// ramificación (distribución de cuotas, deduplicación, fallback de
// relleno). No tenía ningún test.

function q(id, overrides = {}) {
  return { id, especialidad: 'Cardiologia', tema: 'Arritmias', pregunta: `Pregunta ${id}`, ...overrides };
}

describe('normalizeQuestionPerformance', () => {
  it('devuelve [] para entradas vacías o no-array', () => {
    expect(normalizeQuestionPerformance([])).toEqual([]);
    expect(normalizeQuestionPerformance(null)).toEqual([]);
    expect(normalizeQuestionPerformance(undefined)).toEqual([]);
  });

  it('normaliza filas con forma "question_performance" (snake_case, ya agregadas)', () => {
    const rows = [{
      question_id: 'q1',
      especialidad_v2: 'Cardiologia',
      tema_v2: 'Arritmias',
      total_attempts: 3,
      wrong_attempts: 2,
      correct_attempts: 1,
      last_answer_at: '2026-01-01',
      last_is_correct: false,
      last_selected_answer: 'b',
      correct_answer: 'a'
    }];
    const out = normalizeQuestionPerformance(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      questionId: 'q1',
      especialidad: 'Cardiologia',
      tema: 'Arritmias',
      totalAttempts: 3,
      wrongAttempts: 2,
      correctAttempts: 1,
      lastIsCorrect: false,
      lastSelectedAnswer: 'b',
      correctAnswer: 'a'
    });
  });

  it('descarta filas sin question_id', () => {
    const out = normalizeQuestionPerformance([{ total_attempts: 1 }]);
    expect(out).toEqual([]);
  });

  it('nunca deja totalAttempts/wrongAttempts/correctAttempts negativos', () => {
    const out = normalizeQuestionPerformance([{ question_id: 'q1', total_attempts: -5, wrong_attempts: -2 }]);
    expect(out[0].totalAttempts).toBe(0);
    expect(out[0].wrongAttempts).toBe(0);
  });

  it('agrega filas crudas de exam_answers (sin forma de performance) por pregunta', () => {
    const rawAnswers = [
      { question_id: 'q1', is_correct: false, created_at: '2026-01-01T10:00:00Z', selected_answer: 'b', correct_answer: 'a' },
      { question_id: 'q1', is_correct: true, created_at: '2026-01-02T10:00:00Z', selected_answer: 'a', correct_answer: 'a' },
      { question_id: 'q2', is_correct: false, created_at: '2026-01-01T10:00:00Z' }
    ];
    const out = normalizeQuestionPerformance(rawAnswers);
    const q1 = out.find((r) => r.questionId === 'q1');
    expect(q1.totalAttempts).toBe(2);
    expect(q1.wrongAttempts).toBe(1);
    expect(q1.correctAttempts).toBe(1);
    expect(q1.lastIsCorrect).toBe(true);
    expect(q1.lastSelectedAnswer).toBe('a');
  });

  it('ignora respuestas no contestadas o anuladas al agregar filas crudas', () => {
    const rawAnswers = [
      { question_id: 'q1', is_correct: false, is_answered: false },
      { question_id: 'q1', is_correct: false, is_annulled: true },
      { question_id: 'q1', is_correct: false, created_at: '2026-01-01' }
    ];
    const out = normalizeQuestionPerformance(rawAnswers);
    expect(out.find((r) => r.questionId === 'q1').totalAttempts).toBe(1);
  });

  it('promedia avg_time_ms solo sobre intentos con tiempo > 0', () => {
    const rawAnswers = [
      { question_id: 'q1', is_correct: true, time_ms: 1000 },
      { question_id: 'q1', is_correct: true, time_ms: 3000 },
      { question_id: 'q1', is_correct: true, time_ms: 0 }
    ];
    const out = normalizeQuestionPerformance(rawAnswers);
    expect(out.find((r) => r.questionId === 'q1').avgTimeMs).toBe(2000);
  });
});

describe('buildMistakesExamPlan', () => {
  it('sin preguntas ni historial: pool vacío, hasMistakes false', () => {
    const plan = buildMistakesExamPlan({ questions: [], questionRows: [] });
    expect(plan.pool).toEqual([]);
    expect(plan.hasMistakes).toBe(false);
  });

  it('con preguntas pero sin ningún error: rellena con preguntas al azar (fillAny) hasta el límite', () => {
    const questions = Array.from({ length: 5 }, (_, i) => q(`q${i}`));
    const plan = buildMistakesExamPlan({ questions, questionRows: [], limit: 3 });
    expect(plan.pool).toHaveLength(3);
    expect(plan.composition.fillAny).toBe(3);
    expect(plan.hasMistakes).toBe(false);
  });

  it('prioriza preguntas con error activo (última respuesta incorrecta) por sobre las demás', () => {
    const questions = [q('q1'), q('q2'), q('q3')];
    const questionRows = [
      { question_id: 'q1', wrong_attempts: 1, last_is_correct: false },
      { question_id: 'q2', wrong_attempts: 1, last_is_correct: true }
    ];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    const ids = plan.pool.map((p) => p.id);
    expect(ids).toContain('q1');
    expect(plan.composition.activeErrors).toBeGreaterThan(0);
  });

  it('errores recurrentes (2+ fallos) van al bucket recurrentErrors', () => {
    const questions = [q('q1')];
    const questionRows = [{ question_id: 'q1', wrong_attempts: 3, last_is_correct: false }];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    expect(plan.recurrentErrors).toHaveLength(1);
    expect(plan.recurrentErrors[0].errorState).toBe('error_recurrente');
  });

  it('preguntas con 1 solo error y última respuesta incorrecta son error_activo, no recurrente', () => {
    const questions = [q('q1')];
    const questionRows = [{ question_id: 'q1', wrong_attempts: 1, last_is_correct: false }];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    expect(plan.rows[0].errorState).toBe('error_activo');
    expect(plan.recurrentErrors).toHaveLength(0);
  });

  it('preguntas nunca falladas son "dominada" y no entran a ningún bucket de error', () => {
    const questions = [q('q1')];
    const questionRows = [{ question_id: 'q1', wrong_attempts: 0, correct_attempts: 3, last_is_correct: true }];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    expect(plan.rows[0].errorState).toBe('dominada');
    expect(plan.activeErrors).toHaveLength(0);
    expect(plan.recurrentErrors).toHaveLength(0);
    expect(plan.correctedErrors).toHaveLength(0);
  });

  it('el pool nunca repite la misma pregunta (dedupe por id entre buckets)', () => {
    const questions = [q('q1')];
    const questionRows = [{ question_id: 'q1', wrong_attempts: 3, last_is_correct: false }];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    const ids = plan.pool.map((p) => p.id);
    expect(ids).toEqual(['q1']);
  });

  it('nunca devuelve más preguntas que el límite pedido', () => {
    const questions = Array.from({ length: 30 }, (_, i) => q(`q${i}`));
    const questionRows = questions.map((qq, i) => ({
      question_id: qq.id,
      wrong_attempts: i % 3 === 0 ? 2 : 1,
      last_is_correct: i % 2 === 0
    }));
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 7 });
    expect(plan.pool.length).toBeLessThanOrEqual(7);
  });

  it('refuerzo relacionado: incluye preguntas del mismo tema que un error, aunque nunca se hayan respondido', () => {
    const questions = [
      q('q1', { especialidad: 'Cardiologia', tema: 'Arritmias' }),
      q('q2', { especialidad: 'Cardiologia', tema: 'Arritmias' }),
      q('q3', { especialidad: 'Neurologia', tema: 'ACV' })
    ];
    const questionRows = [{ question_id: 'q1', wrong_attempts: 1, last_is_correct: false, especialidad_v2: 'Cardiologia', tema_v2: 'Arritmias' }];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 2 });
    const ids = plan.pool.map((p) => p.id);
    expect(ids).toContain('q1');
    expect(ids).toContain('q2');
    expect(ids).not.toContain('q3');
  });

  it('el refuerzo relacionado no incluye preguntas ya respondidas (aunque sean del mismo tema)', () => {
    const questions = [
      q('q1', { especialidad: 'Cardiologia', tema: 'Arritmias' }),
      q('q2', { especialidad: 'Cardiologia', tema: 'Arritmias' })
    ];
    const questionRows = [
      { question_id: 'q1', wrong_attempts: 1, last_is_correct: false, especialidad_v2: 'Cardiologia', tema_v2: 'Arritmias' },
      { question_id: 'q2', wrong_attempts: 0, correct_attempts: 1, last_is_correct: true, especialidad_v2: 'Cardiologia', tema_v2: 'Arritmias' }
    ];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    expect(plan.composition.relatedReinforcement).toBe(0);
  });

  it('topics resume especialidad+tema de las preguntas falladas, ordenado por más fallos primero', () => {
    const questions = [q('q1'), q('q2')];
    const questionRows = [
      { question_id: 'q1', wrong_attempts: 1, last_is_correct: false, especialidad_v2: 'Cardiologia', tema_v2: 'Arritmias' },
      { question_id: 'q2', wrong_attempts: 4, last_is_correct: false, especialidad_v2: 'Cardiologia', tema_v2: 'Insuficiencia cardíaca' }
    ];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    expect(plan.topics[0].tema).toBe('Insuficiencia cardíaca');
    expect(plan.topics).toHaveLength(2);
  });

  it('preguntas del historial que ya no existen en el banco actual quedan en unmatchedMistakes', () => {
    const questions = [q('q1')];
    const questionRows = [
      { question_id: 'q1', wrong_attempts: 1, last_is_correct: false },
      { question_id: 'q-eliminada', wrong_attempts: 2, last_is_correct: false }
    ];
    const plan = buildMistakesExamPlan({ questions, questionRows, limit: 10 });
    expect(plan.diagnostics.unmatchedMistakes).toBe(1);
  });

  it('hasMistakes es true apenas hay una sola fila con algún fallo, incluso si no aporta preguntas al pool', () => {
    const plan = buildMistakesExamPlan({ questions: [], questionRows: [{ question_id: 'q1', wrong_attempts: 1, last_is_correct: false }], limit: 10 });
    expect(plan.hasMistakes).toBe(true);
    expect(plan.pool).toEqual([]);
  });

  it('acepta answerRows como alias de questionRows', () => {
    const questions = [q('q1')];
    const plan = buildMistakesExamPlan({
      questions,
      answerRows: [{ question_id: 'q1', is_correct: false, created_at: '2026-01-01' }],
      limit: 10
    });
    expect(plan.hasMistakes).toBe(true);
  });

  it('usa las funciones de especialidad/tema inyectadas (espLabel/topicLabel) en vez de leer los campos crudos', () => {
    const questions = [
      { id: 'q1', customField: 'Custom Esp' },
      { id: 'q2', customField: 'Custom Esp' }
    ];
    const questionRows = [{ question_id: 'q1', wrong_attempts: 1, last_is_correct: false, especialidad_v2: 'Custom Esp', tema_v2: 'X' }];
    const plan = buildMistakesExamPlan({
      questions,
      questionRows,
      limit: 2,
      espLabel: (item) => item.customField,
      topicLabel: () => 'X'
    });
    const ids = plan.pool.map((p) => p.id);
    expect(ids).toContain('q2');
  });

  it('respeta el límite mínimo de 1 aunque se pida 0 o negativo', () => {
    const questions = [q('q1'), q('q2')];
    const plan = buildMistakesExamPlan({ questions, questionRows: [], limit: 0 });
    expect(plan.pool.length).toBe(1);
  });

  it('source por defecto es exam_answers, pero se puede sobreescribir', () => {
    expect(buildMistakesExamPlan({}).source).toBe('exam_answers');
    expect(buildMistakesExamPlan({ source: 'secure_session' }).source).toBe('secure_session');
  });
});
