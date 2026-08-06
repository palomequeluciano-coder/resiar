import { describe, it, expect, vi } from 'vitest';
import {
  uniqueQuestionIds,
  startSecureExamSession,
  submitSecureExamAnswer
} from '../services/secureExamSession.js';

// secureExamSession.js es el corazón anti-copia del examen "seguro" (v69D):
// el frontend nunca conoce la respuesta correcta hasta que el backend la
// confirma vía RPC, y cada corrección se valida server-side. No tenía tests.

function makeSupabase(rpcResults) {
  // rpcResults: Map de nombre de RPC -> función(params) => { data, error }
  return {
    rpc: vi.fn(async (name, params) => {
      const impl = rpcResults[name];
      if (!impl) throw new Error(`RPC no mockeada: ${name}`);
      return impl(params);
    })
  };
}

describe('uniqueQuestionIds', () => {
  it('deduplica, recorta espacios y descarta vacíos', () => {
    expect(uniqueQuestionIds(['a1', ' a1 ', 'a2', '', null, undefined, 'a2']))
      .toEqual(['a1', 'a2']);
  });

  it('coacciona valores no-string (números) a string', () => {
    expect(uniqueQuestionIds([1, 2, 1])).toEqual(['1', '2']);
  });

  it('devuelve [] para entradas no-array', () => {
    expect(uniqueQuestionIds(null)).toEqual([]);
    expect(uniqueQuestionIds(undefined)).toEqual([]);
    expect(uniqueQuestionIds('no-es-array')).toEqual([]);
  });
});

describe('startSecureExamSession', () => {
  it('rechaza si no hay cliente de supabase con .rpc', async () => {
    await expect(startSecureExamSession({ supabase: null, questionIds: ['a1'] }))
      .rejects.toThrow('Supabase no inicializado');
  });

  it('rechaza si no quedan question ids válidos', async () => {
    const supabase = makeSupabase({});
    await expect(startSecureExamSession({ supabase, questionIds: ['', null] }))
      .rejects.toThrow('No hay preguntas disponibles');
  });

  it('llama a get_exam_session_v69 con ids deduplicados y el límite clampeado', async () => {
    let capturedParams;
    const supabase = makeSupabase({
      get_exam_session_v69: (params) => {
        capturedParams = params;
        return {
          data: { session_id: 'sess-1', questions: [{ id: 'q1', pregunta: '¿?' }] },
          error: null
        };
      }
    });

    await startSecureExamSession({ supabase, questionIds: ['q1', 'q1', 'q2'], mode: 'practice', limit: 999999 });

    expect(capturedParams.p_question_ids).toEqual(['q1', 'q2']);
    expect(capturedParams.p_limit).toBe(10000); // clampeado al tope
    expect(capturedParams.p_mode).toBe('practice');
  });

  it('el límite nunca baja de 1, incluso con un valor inválido', async () => {
    let capturedParams;
    const supabase = makeSupabase({
      get_exam_session_v69: (params) => {
        capturedParams = params;
        return { data: { session_id: 's', questions: [{ id: 'q1' }] }, error: null };
      }
    });

    await startSecureExamSession({ supabase, questionIds: ['q1'], limit: -5 });
    expect(capturedParams.p_limit).toBe(1);
  });

  it('propaga el error si el RPC falla', async () => {
    const supabase = makeSupabase({
      get_exam_session_v69: () => ({ data: null, error: new Error('boom') })
    });
    await expect(startSecureExamSession({ supabase, questionIds: ['q1'] }))
      .rejects.toThrow('boom');
  });

  it('rechaza si el servidor no devuelve session_id', async () => {
    const supabase = makeSupabase({
      get_exam_session_v69: () => ({ data: { questions: [{ id: 'q1' }] }, error: null })
    });
    await expect(startSecureExamSession({ supabase, questionIds: ['q1'] }))
      .rejects.toThrow('session_id');
  });

  it('rechaza si el servidor no devuelve preguntas', async () => {
    const supabase = makeSupabase({
      get_exam_session_v69: () => ({ data: { session_id: 's1', questions: [] }, error: null })
    });
    await expect(startSecureExamSession({ supabase, questionIds: ['q1'] }))
      .rejects.toThrow('no devolvió preguntas');
  });

  it('oculta la respuesta correcta en cada pregunta devuelta y marca los flags de sesión segura', async () => {
    const supabase = makeSupabase({
      get_exam_session_v69: () => ({
        data: {
          session_id: 'sess-42',
          questions: [{ id: 'q1', pregunta: '¿?', respuesta: 'b' }],
          delivered_count: 1,
          requested_count: 1,
          access_enforced: true
        },
        error: null
      })
    });

    const result = await startSecureExamSession({ supabase, questionIds: ['q1'] });

    expect(result.sessionId).toBe('sess-42');
    expect(result.questions[0].respuesta).toBeNull();
    expect(result.questions[0]._resiarAnswerHidden).toBe(true);
    expect(result.questions[0]._resiarAnswerVerified).toBe(false);
    expect(result.questions[0]._resiarSecureSessionId).toBe('sess-42');
    expect(result.diagnostics.accessEnforced).toBe(true);
    expect(result.diagnostics.source).toBe('get_exam_session_v69');
  });
});

describe('submitSecureExamAnswer', () => {
  it('rechaza si no hay cliente de supabase con .rpc', async () => {
    await expect(submitSecureExamAnswer({ supabase: null, sessionId: 's', questionId: 'q1', selectedAnswer: 'a' }))
      .rejects.toThrow('Supabase no inicializado');
  });

  it('rechaza si falta sessionId, questionId o selectedAnswer', async () => {
    const supabase = makeSupabase({});
    await expect(submitSecureExamAnswer({ supabase, sessionId: '', questionId: 'q1', selectedAnswer: 'a' }))
      .rejects.toThrow('Sesión segura no disponible');
    await expect(submitSecureExamAnswer({ supabase, sessionId: 's', questionId: '', selectedAnswer: 'a' }))
      .rejects.toThrow('Pregunta inválida');
    await expect(submitSecureExamAnswer({ supabase, sessionId: 's', questionId: 'q1', selectedAnswer: '' }))
      .rejects.toThrow('Respuesta inválida');
  });

  it('normaliza la respuesta seleccionada (número -> letra, mayúscula -> minúscula) antes de enviarla', async () => {
    let capturedParams;
    const supabase = makeSupabase({
      submit_secure_exam_answer_v69: (params) => {
        capturedParams = params;
        return { data: { correct_answer: 'a', is_correct: true }, error: null };
      }
    });

    await submitSecureExamAnswer({ supabase, sessionId: 's1', questionId: 'q1', selectedAnswer: 'A' });
    expect(capturedParams.p_selected_answer).toBe('a');
  });

  it('propaga el error si el RPC falla', async () => {
    const supabase = makeSupabase({
      submit_secure_exam_answer_v69: () => ({ data: null, error: new Error('rpc caída') })
    });
    await expect(submitSecureExamAnswer({ supabase, sessionId: 's1', questionId: 'q1', selectedAnswer: 'a' }))
      .rejects.toThrow('rpc caída');
  });

  it('determina isCorrect comparando contra correct_answer del servidor, no contra lo que el cliente cree', async () => {
    const supabase = makeSupabase({
      submit_secure_exam_answer_v69: () => ({
        data: { correct_answer: 'c', selected_answer: 'a', is_correct: true }, // is_correct del server sería ignorado en este caso
        error: null
      })
    });

    const result = await submitSecureExamAnswer({ supabase, sessionId: 's1', questionId: 'q1', selectedAnswer: 'a' });

    // La función recalcula isCorrect comparando selected vs correct_answer,
    // así que aunque el payload trajera is_correct=true, con selected='a' y
    // correct='c' el resultado real tiene que dar false.
    expect(result.correctAnswer).toBe('c');
    expect(result.isCorrect).toBe(false);
  });

  it('con pregunta anulada, usa is_correct del servidor tal cual (no compara contra correct_answer)', async () => {
    const supabase = makeSupabase({
      submit_secure_exam_answer_v69: () => ({
        data: { correct_answer: 'c', selected_answer: 'a', is_correct: true, is_annulled: true },
        error: null
      })
    });

    const result = await submitSecureExamAnswer({ supabase, sessionId: 's1', questionId: 'q1', selectedAnswer: 'a' });
    expect(result.isAnnulled).toBe(true);
    expect(result.isCorrect).toBe(true);
  });

  it('si no hay correct_answer en el payload, cae al is_correct que manda el servidor', async () => {
    const supabase = makeSupabase({
      submit_secure_exam_answer_v69: () => ({
        data: { selected_answer: 'a', is_correct: true },
        error: null
      })
    });

    const result = await submitSecureExamAnswer({ supabase, sessionId: 's1', questionId: 'q1', selectedAnswer: 'a' });
    expect(result.correctAnswer).toBeNull();
    expect(result.isCorrect).toBe(true);
  });

  it('prioriza raw_correct_answer sobre correct_answer para el campo crudo', async () => {
    const supabase = makeSupabase({
      submit_secure_exam_answer_v69: () => ({
        data: { correct_answer: 'b', raw_correct_answer: 'RAW-B', selected_answer: 'a', is_correct: false },
        error: null
      })
    });

    const result = await submitSecureExamAnswer({ supabase, sessionId: 's1', questionId: 'q1', selectedAnswer: 'a' });
    expect(result.rawCorrectAnswer).toBe('raw-b');
  });
});
