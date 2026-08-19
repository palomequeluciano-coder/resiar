import { describe, it, expect } from 'vitest';
import {
  performanceTopicKey,
  collectRemotePerformance,
  collectRemoteQuestionSignals,
  collectLocalFallbackPerformance,
  collectPendingPerformance,
  selectWeakPerformanceEntries,
  buildUserPerformanceModel
} from '../services/performanceEngine.js';
import { writeResultSyncQueue } from '../services/resultSyncQueue.js';

// performanceEngine.js calcula, a partir del historial de respuestas, en
// qué especialidades/temas está débil cada usuario -- alimenta el examen
// de "puntos débiles". Lógica 100% pura salvo collectPendingPerformance
// (lee localStorage), sin ningún test.

describe('performanceTopicKey', () => {
  it('combina especialidad normalizada + tema normalizado', () => {
    expect(performanceTopicKey('cardiologia', 'Arritmias')).toBe('cardiologia::arritmias');
  });

  it('devuelve "" si no hay tema', () => {
    expect(performanceTopicKey('cardiologia', '')).toBe('');
  });

  it('usa "general" normalizado como especialidad si no se pasa ninguna', () => {
    expect(performanceTopicKey('', 'Arritmias')).toBe('general::arritmias');
  });
});

describe('collectRemotePerformance', () => {
  it('[] / no-array -> listas vacías', () => {
    const out = collectRemotePerformance([]);
    expect(out.specialtyEntries).toEqual([]);
    expect(out.topicEntries).toEqual([]);
  });

  it('agrega respuestas detalladas (is_correct) por especialidad y por tema', () => {
    const rows = [
      { question_id: 'q1', is_correct: true, especialidad: 'Cardiologia', tema: 'Arritmias' },
      { question_id: 'q2', is_correct: false, especialidad: 'Cardiologia', tema: 'Arritmias' },
      { question_id: 'q3', is_correct: false, especialidad: 'Cardiologia', tema: 'Arritmias' }
    ];
    const out = collectRemotePerformance(rows);
    const esp = out.specialtyEntries.find((e) => e.label === 'Cardiologia');
    expect(esp.t).toBe(3);
    expect(esp.c).toBe(1);
    expect(esp.pct).toBe(33); // round(1/3 * 100)

    const topic = out.topicEntries.find((e) => e.topic === 'Arritmias');
    expect(topic.t).toBe(3);
  });

  it('acepta filas ya agregadas (total/correctas) en vez de una respuesta por fila', () => {
    const rows = [{ especialidad: 'Neurologia', total: 10, correctas: 7 }];
    const out = collectRemotePerformance(rows);
    expect(out.specialtyEntries[0].t).toBe(10);
    expect(out.specialtyEntries[0].c).toBe(7);
    expect(out.specialtyEntries[0].pct).toBe(70);
  });

  it('ignora respuestas no contestadas o anuladas', () => {
    const rows = [
      { question_id: 'q1', is_correct: true, is_answered: false, especialidad: 'X' },
      { question_id: 'q2', is_correct: true, is_annulled: true, especialidad: 'X' }
    ];
    const out = collectRemotePerformance(rows);
    expect(out.specialtyEntries).toEqual([]);
  });

  it('reparte el peso entre especialidades múltiples separadas por coma', () => {
    const rows = [{ question_id: 'q1', is_correct: true, especialidad: 'Cardiologia, Neurologia' }];
    const out = collectRemotePerformance(rows);
    const cardio = out.specialtyEntries.find((e) => e.label === 'Cardiologia');
    const neuro = out.specialtyEntries.find((e) => e.label === 'Neurologia');
    expect(cardio.t).toBe(0.5);
    expect(neuro.t).toBe(0.5);
  });

  it('las entradas quedan ordenadas de peor a mejor porcentaje', () => {
    const rows = [
      { especialidad: 'Buena', total: 10, correctas: 9 },
      { especialidad: 'Mala', total: 10, correctas: 1 },
      { especialidad: 'Media', total: 10, correctas: 5 }
    ];
    const out = collectRemotePerformance(rows);
    expect(out.specialtyEntries.map((e) => e.label)).toEqual(['Mala', 'Media', 'Buena']);
  });
});

describe('collectRemoteQuestionSignals', () => {
  it('clasifica preguntas por su último intento (no por el historial completo)', () => {
    const rows = [
      { question_id: 'q1', is_correct: false, created_at: '2026-01-01' },
      { question_id: 'q1', is_correct: true, created_at: '2026-01-02' } // el más nuevo gana
    ];
    const out = collectRemoteQuestionSignals(rows);
    expect(out.correctQuestionIds).toEqual(['q1']);
    expect(out.failedQuestionIds).toEqual([]);
    expect(out.answeredQuestionIds).toEqual(['q1']);
  });

  it('recentQuestionIds respeta recentLimit y viene ordenado de más reciente a más viejo', () => {
    const rows = [
      { question_id: 'q1', is_correct: true, created_at: '2026-01-01' },
      { question_id: 'q2', is_correct: true, created_at: '2026-01-03' },
      { question_id: 'q3', is_correct: true, created_at: '2026-01-02' }
    ];
    const out = collectRemoteQuestionSignals(rows, { recentLimit: 2 });
    expect(out.recentQuestionIds).toEqual(['q2', 'q3']);
  });

  it('filas sin is_correct (no respondidas) no cuentan como señal', () => {
    const rows = [{ question_id: 'q1', created_at: '2026-01-01' }];
    expect(collectRemoteQuestionSignals(rows).answeredQuestionIds).toEqual([]);
  });
});

describe('collectLocalFallbackPerformance', () => {
  it('sin localStats, devuelve listas vacías', () => {
    expect(collectLocalFallbackPerformance(null).specialtyEntries).toEqual([]);
  });

  it('lee el objeto esps {especialidad: {c, t}} del localStats legado', () => {
    const out = collectLocalFallbackPerformance({ esps: { Cardiologia: { c: 3, t: 10 } } });
    expect(out.specialtyEntries).toHaveLength(1);
    expect(out.specialtyEntries[0].label).toBe('Cardiologia');
    expect(out.specialtyEntries[0].pct).toBe(30);
  });
});

describe('collectPendingPerformance', () => {
  const user = { id: 'user-1' };
  const questions = [
    { id: 'q1', respuesta: 'a', especialidad: 'Cardiologia', tema: 'Arritmias' },
    { id: 'q2', respuesta: 'b', especialidad: 'Cardiologia', tema: 'Arritmias' }
  ];

  it('sin usuario ni cola pendiente, no rompe', () => {
    const out = collectPendingPerformance(null, questions);
    expect(out.specialtyEntries).toEqual([]);
    expect(out.pendingQueueCount).toBe(0);
  });

  it('evalúa las respuestas encoladas contra la respuesta correcta de la pregunta local', () => {
    writeResultSyncQueue(user, [{
      id: 'item-1',
      createdAt: '2026-01-01',
      payload: { answers: [{ id: 'q1', respuesta: 'a' }, { id: 'q2', respuesta: 'x' }] }
    }]);

    const out = collectPendingPerformance(user, questions);
    expect(out.pendingMatchedAnswers).toBe(2);
    expect(out.pendingUnmatchedAnswers).toBe(0);
    const esp = out.specialtyEntries.find((e) => e.label === 'Cardiologia');
    expect(esp.t).toBe(2);
    expect(esp.c).toBe(1); // q1 correcta, q2 incorrecta
  });

  it('respuestas de preguntas que ya no existen en el banco actual cuentan como unmatched', () => {
    writeResultSyncQueue(user, [{
      id: 'item-1',
      createdAt: '2026-01-01',
      payload: { answers: [{ id: 'q-eliminada', respuesta: 'a' }] }
    }]);
    const out = collectPendingPerformance(user, questions);
    expect(out.pendingUnmatchedAnswers).toBe(1);
    expect(out.pendingMatchedAnswers).toBe(0);
  });
});

describe('selectWeakPerformanceEntries', () => {
  it('sin entradas, hasStats false', () => {
    const out = selectWeakPerformanceEntries([]);
    expect(out.hasStats).toBe(false);
    expect(out.weak).toEqual([]);
  });

  it('descarta entradas con menos respuestas que minAnswers', () => {
    const entries = [{ key: 'a', t: 2, pct: 10 }];
    const out = selectWeakPerformanceEntries(entries, { minAnswers: 3 });
    expect(out.hasStats).toBe(false);
  });

  it('marca como débiles las entradas por debajo del umbral', () => {
    const entries = [
      { key: 'mala', t: 10, pct: 40 },
      { key: 'buena', t: 10, pct: 90 }
    ];
    const out = selectWeakPerformanceEntries(entries, { minAnswers: 3, threshold: 70 });
    expect(out.weak.map((e) => e.key)).toEqual(['mala']);
  });

  it('si nada está por debajo del umbral, hace fallback a las peores maxFallback entradas igual', () => {
    const entries = [
      { key: 'a', t: 10, pct: 95 },
      { key: 'b', t: 10, pct: 80 },
      { key: 'c', t: 10, pct: 100 }
    ];
    const out = selectWeakPerformanceEntries(entries, { minAnswers: 3, threshold: 50, maxFallback: 2 });
    expect(out.weak).toHaveLength(2);
    expect(out.hasStats).toBe(true);
  });
});

describe('buildUserPerformanceModel', () => {
  it('sin ningún dato, hasStats false y source "none"', () => {
    const model = buildUserPerformanceModel({});
    expect(model.hasStats).toBe(false);
    expect(model.source).toBe('none');
  });

  it('con filas remotas, source incluye "remote"', () => {
    const model = buildUserPerformanceModel({
      remoteRows: [{ especialidad: 'Cardiologia', total: 10, correctas: 2 }]
    });
    expect(model.source).toBe('remote');
    expect(model.weakSpecialties.length).toBeGreaterThan(0);
  });

  it('usa localStats como fallback solo si no hay nada remoto ni pendiente', () => {
    const model = buildUserPerformanceModel({
      remoteRows: [],
      localStats: { esps: { Cardiologia: { c: 1, t: 10 } } }
    });
    expect(model.source).toBe('local-fallback');
    expect(model.sourceCounts.localFallbackUsed).toBe(true);
  });

  it('con datos remotos presentes, NO usa localStats aunque esté disponible (evita doble conteo)', () => {
    const model = buildUserPerformanceModel({
      remoteRows: [{ especialidad: 'Cardiologia', total: 10, correctas: 8 }],
      localStats: { esps: { Neurologia: { c: 1, t: 10 } } }
    });
    expect(model.specialtyEntries.some((e) => e.label === 'Neurologia')).toBe(false);
  });

  it('activeScope es "topic" si hay temas débiles calificados, si no "specialty"', () => {
    const modelTopic = buildUserPerformanceModel({
      remoteRows: [
        { especialidad: 'Cardiologia', tema: 'Arritmias', total: 10, correctas: 2 },
        { especialidad: 'Cardiologia', tema: 'Arritmias', total: 0 }
      ]
    });
    expect(modelTopic.activeScope).toBe('topic');
  });
});
