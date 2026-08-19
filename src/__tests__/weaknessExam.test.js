import { describe, it, expect } from 'vitest';
import {
  collectWeaknessStatsFromLocal,
  collectWeaknessStatsFromRows,
  chooseWeakSpecialties,
  buildWeaknessExamPlan
} from '../services/weaknessExam.js';

// weaknessExam.js decide qué preguntas ve cada usuario en el examen de
// "puntos débiles" -- lógica 100% pura sobre estadísticas de desempeño.
// Sin ningún test.
//
// Importante: el normalizador de especialidad por defecto es `identity`
// (no hace lowercase/sin-acentos) -- production le inyecta un
// normalizador real. Los tests que arman `weakSpecialties`/`weakTopics`
// a mano deben usar las mismas claves ("Cardiologia" tal cual, no
// "cardiologia") salvo que se pase `normalizeSpecialty` explícitamente.

function q(id, overrides = {}) {
  return { id, especialidad: 'Cardiologia', tema: 'Arritmias', pregunta: `Pregunta ${id}`, ...overrides };
}

const commonOptions = {
  espLabel: (item) => item.especialidad,
  topicLabel: (item) => item.tema
};

describe('collectWeaknessStatsFromLocal / collectWeaknessStatsFromRows', () => {
  it('delegan en performanceEngine y devuelven las entradas por especialidad', () => {
    const local = collectWeaknessStatsFromLocal({ esps: { Cardiologia: { c: 1, t: 10 } } });
    expect(local[0].label).toBe('Cardiologia');

    const remote = collectWeaknessStatsFromRows([{ especialidad: 'Neurologia', total: 10, correctas: 8 }]);
    expect(remote[0].label).toBe('Neurologia');
  });
});

describe('chooseWeakSpecialties', () => {
  it('prioriza entradas remotas sobre las locales cuando ambas califican', () => {
    const local = [{ key: 'a', label: 'Local', t: 10, pct: 20 }];
    const remote = [{ key: 'b', label: 'Remoto', t: 10, pct: 30 }];
    const choice = chooseWeakSpecialties(local, remote, { minAnswers: 3 });
    expect(choice.source).toBe('remote');
    expect(choice.specialties.map((s) => s.label)).toEqual(['Remoto']);
  });

  it('usa local como fallback si no hay remoto calificado', () => {
    const local = [{ key: 'a', label: 'Local', t: 10, pct: 20 }];
    const choice = chooseWeakSpecialties(local, [], { minAnswers: 3 });
    expect(choice.source).toBe('local-fallback');
  });

  it('sin nada calificado, source "none" y hasStats false', () => {
    const choice = chooseWeakSpecialties([], []);
    expect(choice.source).toBe('none');
    expect(choice.hasStats).toBe(false);
  });
});

describe('buildWeaknessExamPlan', () => {
  it('sin preguntas ni performance, pool vacío', () => {
    const plan = buildWeaknessExamPlan({ questions: [] });
    expect(plan.pool).toEqual([]);
  });

  it('sin ningún dato de desempeño, rellena con preguntas al azar (fillAny)', () => {
    const questions = Array.from({ length: 5 }, (_, i) => q(`q${i}`));
    const plan = buildWeaknessExamPlan({ questions, limit: 3 });
    expect(plan.pool).toHaveLength(3);
    expect(plan.composition.fillAny).toBeGreaterThan(0);
    expect(plan.hasStats).toBe(false);
  });

  it('con un performance model ya armado (activeScope=specialty), prioriza preguntas de la especialidad débil', () => {
    const questions = [
      q('q1', { especialidad: 'Cardiologia' }),
      q('q2', { especialidad: 'Neurologia' })
    ];
    const performance = {
      weakSpecialties: [{ key: 'Cardiologia', label: 'Cardiologia' }],
      weakTopics: [],
      failedQuestionIds: [],
      answeredQuestionIds: [],
      recentQuestionIds: [],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({
      questions, performance, limit: 5,
      espLabel: (item) => item.especialidad,
      topicLabel: (item) => item.tema
    });
    expect(plan.pool[0].id).toBe('q1');
    expect(plan.activeScope).toBe('specialty');
  });

  it('con temas débiles calificados (activeScope=topic), prioriza preguntas de ese tema exacto', () => {
    const questions = [
      q('q1', { especialidad: 'Cardiologia', tema: 'Arritmias' }),
      q('q2', { especialidad: 'Cardiologia', tema: 'Insuficiencia cardíaca' })
    ];
    const performance = {
      weakSpecialties: [{ key: 'Cardiologia', label: 'Cardiologia' }],
      weakTopics: [{ key: 'Cardiologia::arritmias', label: 'Cardiologia · Arritmias' }],
      failedQuestionIds: [],
      answeredQuestionIds: [],
      recentQuestionIds: [],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({
      questions, performance, limit: 3,
      espLabel: (item) => item.especialidad,
      topicLabel: (item) => item.tema
    });
    expect(plan.pool[0].id).toBe('q1');
    expect(plan.activeScope).toBe('topic');
  });

  it('preguntas previamente falladas entran al bucket failedQuestions', () => {
    const questions = [q('q1'), q('q2')];
    const performance = {
      weakSpecialties: [],
      weakTopics: [],
      failedQuestionIds: ['q1'],
      answeredQuestionIds: ['q1'],
      recentQuestionIds: [],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({ questions, performance, limit: 10 });
    expect(plan.composition.failedQuestions).toBeGreaterThan(0);
    expect(plan.pool.map((p) => p.id)).toContain('q1');
  });

  it('weakSpecialtyNew excluye preguntas ya respondidas de la especialidad débil', () => {
    const questions = [
      q('q1', { especialidad: 'Cardiologia' }), // ya respondida
      q('q2', { especialidad: 'Cardiologia' })  // nueva
    ];
    const performance = {
      weakSpecialties: [{ key: 'Cardiologia', label: 'Cardiologia' }],
      weakTopics: [],
      failedQuestionIds: [],
      answeredQuestionIds: ['q1'],
      recentQuestionIds: [],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({
      questions, performance, limit: 10,
      espLabel: (item) => item.especialidad,
      topicLabel: (item) => item.tema
    });
    expect(plan.diagnostics.weakNewPool).toBe(1); // solo q2 califica como "nueva"
  });

  it('el repaso general excluye preguntas recientes y las de especialidad/tema ya cubiertos', () => {
    const questions = [
      q('q1', { especialidad: 'Cardiologia' }), // reciente -> excluida
      q('q2', { especialidad: 'Cardiologia' }), // especialidad débil -> excluida del repaso general
      q('q3', { especialidad: 'Dermatologia' }) // sin relación -> entra al repaso general
    ];
    const performance = {
      weakSpecialties: [{ key: 'Cardiologia', label: 'Cardiologia' }],
      weakTopics: [],
      failedQuestionIds: [],
      answeredQuestionIds: [],
      recentQuestionIds: ['q1'],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({
      questions, performance, limit: 10,
      espLabel: (item) => item.especialidad,
      topicLabel: (item) => item.tema
    });
    expect(plan.diagnostics.generalReviewPool).toBe(1);
  });

  it('nunca repite la misma pregunta en el pool final', () => {
    const questions = [q('q1', { especialidad: 'Cardiologia' })];
    const performance = {
      weakSpecialties: [{ key: 'Cardiologia', label: 'Cardiologia' }],
      weakTopics: [],
      failedQuestionIds: ['q1'], // la misma pregunta califica por dos vías
      answeredQuestionIds: [],
      recentQuestionIds: [],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({ questions, performance, limit: 10 });
    expect(plan.pool.map((p) => p.id)).toEqual(['q1']);
  });

  it('nunca devuelve más preguntas que el límite pedido', () => {
    const questions = Array.from({ length: 40 }, (_, i) => q(`q${i}`, { especialidad: i % 2 === 0 ? 'Cardiologia' : 'Neurologia' }));
    const performance = {
      weakSpecialties: [{ key: 'Cardiologia', label: 'Cardiologia' }],
      weakTopics: [],
      failedQuestionIds: questions.slice(0, 5).map((qq) => qq.id),
      answeredQuestionIds: [],
      recentQuestionIds: [],
      hasStats: true,
      source: 'remote'
    };
    const plan = buildWeaknessExamPlan({ questions, performance, limit: 8 });
    expect(plan.pool.length).toBeLessThanOrEqual(8);
  });

  it('sin performance explícito, calcula uno a partir de localStats/remoteRows (fallback)', () => {
    const questions = [q('q1', { especialidad: 'Cardiologia' })];
    const plan = buildWeaknessExamPlan({
      questions,
      remoteRows: [{ especialidad: 'Cardiologia', total: 10, correctas: 2 }],
      limit: 10
    });
    expect(plan.hasStats).toBe(true);
    expect(plan.source).toBe('remote');
  });

  it('respeta el límite mínimo de 1 aunque se pida 0 o negativo', () => {
    const questions = [q('q1'), q('q2')];
    const plan = buildWeaknessExamPlan({ questions, limit: -5 });
    expect(plan.pool.length).toBe(1);
  });
});
