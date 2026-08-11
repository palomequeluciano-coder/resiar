import { describe, it, expect } from 'vitest';
import {
  resiarNormalizeAnswerResult,
  resiarQuestionHasKnownCorrectAnswer,
  resiarEvaluateQuestionAnswer
} from '../utils/answerEvaluation.js';

describe('resiarNormalizeAnswerResult', () => {
  it('devuelve null para valores no-objeto o vacíos', () => {
    expect(resiarNormalizeAnswerResult(null)).toBeNull();
    expect(resiarNormalizeAnswerResult(undefined)).toBeNull();
    expect(resiarNormalizeAnswerResult('a')).toBeNull();
    expect(resiarNormalizeAnswerResult(42)).toBeNull();
    expect(resiarNormalizeAnswerResult([])).toBeNull();
    expect(resiarNormalizeAnswerResult({})).toBeNull();
  });

  it('acepta camelCase (isCorrect/isAnnulled/correctAnswer/selectedAnswer)', () => {
    const out = resiarNormalizeAnswerResult({ isCorrect: true, isAnnulled: false, correctAnswer: 'B', selectedAnswer: 'b' });
    expect(out).toEqual({ isCorrect: true, isAnnulled: false, correctAnswer: 'b', selectedAnswer: 'b' });
  });

  it('acepta snake_case (is_correct/is_annulled/correct_answer/selected_answer)', () => {
    const out = resiarNormalizeAnswerResult({ is_correct: false, is_annulled: true, correct_answer: 'C', selected_answer: 'a' });
    expect(out).toEqual({ isCorrect: false, isAnnulled: true, correctAnswer: 'c', selectedAnswer: 'a' });
  });

  it('acepta "anulada" como fuente de isAnnulled cuando no viene isAnnulled/is_annulled', () => {
    const out = resiarNormalizeAnswerResult({ anulada: true });
    expect(out.isAnnulled).toBe(true);
  });

  it('acepta "respuesta" como fuente de correctAnswer cuando no viene correctAnswer/correct_answer', () => {
    const out = resiarNormalizeAnswerResult({ respuesta: 'D' });
    expect(out.correctAnswer).toBe('d');
  });

  it('normaliza correctAnswer/selectedAnswer a minúsculas sin espacios', () => {
    const out = resiarNormalizeAnswerResult({ correctAnswer: '  B  ', selectedAnswer: ' A ' });
    expect(out.correctAnswer).toBe('b');
    expect(out.selectedAnswer).toBe('a');
  });
});

describe('resiarQuestionHasKnownCorrectAnswer', () => {
  it('false si no hay pregunta', () => {
    expect(resiarQuestionHasKnownCorrectAnswer(null)).toBe(false);
    expect(resiarQuestionHasKnownCorrectAnswer(undefined)).toBe(false);
  });

  it('false si la respuesta está oculta por sesión segura (_resiarAnswerHidden)', () => {
    expect(resiarQuestionHasKnownCorrectAnswer({ respuesta: 'a', _resiarAnswerHidden: true })).toBe(false);
  });

  it('false si la pregunta está anulada', () => {
    expect(resiarQuestionHasKnownCorrectAnswer({ respuesta: 'a', anulada: true })).toBe(false);
  });

  it('false si no hay valor de respuesta válido', () => {
    expect(resiarQuestionHasKnownCorrectAnswer({ respuesta: null })).toBe(false);
    expect(resiarQuestionHasKnownCorrectAnswer({ respuesta: '' })).toBe(false);
    expect(resiarQuestionHasKnownCorrectAnswer({ respuesta: 'anulada' })).toBe(false);
  });

  it('true si hay una respuesta local válida, no oculta, no anulada', () => {
    expect(resiarQuestionHasKnownCorrectAnswer({ respuesta: 'c' })).toBe(true);
  });
});

describe('resiarEvaluateQuestionAnswer — datos reales del flujo de examen', () => {
  it('sin responder: status vacío, no evaluable', () => {
    const ev = resiarEvaluateQuestionAnswer({ respuesta: 'a' }, null, null, 0);
    expect(ev.answered).toBe(false);
    expect(ev.evaluable).toBe(false);
    expect(ev.status).toBe('');
    expect(ev.isCorrect).toBe(false);
    expect(ev.isIncorrect).toBe(false);
  });

  it('rawAnswer vacío ("") se trata como no respondida', () => {
    const ev = resiarEvaluateQuestionAnswer({ respuesta: 'a' }, '', null, 0);
    expect(ev.answered).toBe(false);
    expect(ev.status).toBe('');
  });

  it('respuesta correcta con corrección local en vivo (banco normal)', () => {
    const question = { respuesta: 'b' };
    const ev = resiarEvaluateQuestionAnswer(question, 'b', null, 0);
    expect(ev.answered).toBe(true);
    expect(ev.evaluable).toBe(true);
    expect(ev.isCorrect).toBe(true);
    expect(ev.isIncorrect).toBe(false);
    expect(ev.status).toBe('ok');
  });

  it('respuesta incorrecta con corrección local en vivo', () => {
    const question = { respuesta: 'b' };
    const ev = resiarEvaluateQuestionAnswer(question, 'c', null, 0);
    expect(ev.evaluable).toBe(true);
    expect(ev.isCorrect).toBe(false);
    expect(ev.isIncorrect).toBe(true);
    expect(ev.status).toBe('no');
  });

  it('normaliza respuestas numéricas (bancos viejos con opciones 0-4) contra la letra local', () => {
    const question = { respuesta: 'a' }; // opción correcta ya normalizada como letra
    const ev = resiarEvaluateQuestionAnswer(question, 0, null, 0); // el usuario eligió la opción índice 0
    expect(ev.selectedAnswer).toBe('a');
    expect(ev.isCorrect).toBe(true);
    expect(ev.status).toBe('ok');
  });

  it('pregunta anulada localmente (anulada=true) con corrección en vivo: status "anulada" pase lo que pase con selectedAnswer', () => {
    const question = { respuesta: 'a', anulada: true };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', null, 0);
    expect(ev.isAnnulled).toBe(true);
    expect(ev.status).toBe('anulada');
    expect(ev.evaluable).toBe(false);
  });

  it('pregunta anulada localmente tiene prioridad sobre un resultado guardado que diga lo contrario', () => {
    // Escenario del comentario del código: el admin corrigió/anuló la pregunta
    // después de que el usuario ya tenía un resultado guardado viejo.
    const question = { respuesta: 'a', anulada: true };
    const oldResult = { isAnnulled: false, isCorrect: true, correctAnswer: 'a' };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', oldResult, 0);
    expect(ev.status).toBe('anulada');
  });

  it('sin corrección local en vivo, usa esRespuestaAnulada(question) como fallback de anulación', () => {
    // pregunta sin respuesta válida propia (típico de sesión segura antes de corregir)
    const question = { respuesta: null };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', null, 0);
    expect(ev.isAnnulled).toBe(true);
    expect(ev.status).toBe('anulada');
  });

  it('sin corrección local en vivo, usa result.isAnnulled como fallback de anulación', () => {
    const question = {}; // sin campo respuesta => esRespuestaAnulada la marcaría igual, probamos la rama result explícita
    const result = { isAnnulled: true };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', result, 0);
    expect(ev.isAnnulled).toBe(true);
    expect(ev.status).toBe('anulada');
  });

  it('sesión segura: respuesta local oculta (_resiarAnswerHidden), usa correctAnswer del resultado guardado', () => {
    const question = { respuesta: null, _resiarAnswerHidden: true };
    const result = { correctAnswer: 'c', isAnnulled: false };
    const evOk = resiarEvaluateQuestionAnswer(question, 'c', result, 0);
    expect(evOk.evaluable).toBe(true);
    expect(evOk.isCorrect).toBe(true);
    expect(evOk.status).toBe('ok');

    const evNo = resiarEvaluateQuestionAnswer(question, 'a', result, 0);
    expect(evNo.isCorrect).toBe(false);
    expect(evNo.status).toBe('no');
  });

  it('sesión segura sin correctAnswer pero con isCorrect booleano ya resuelto por el servidor', () => {
    const question = { respuesta: null, _resiarAnswerHidden: true };
    const result = { isCorrect: true };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', result, 0);
    expect(ev.evaluable).toBe(true);
    expect(ev.isCorrect).toBe(true);
    expect(ev.status).toBe('ok');
  });

  it('respondida pero sin ninguna corrección confiable todavía: pendiente, no evaluable, no cuenta ni como correcta ni incorrecta', () => {
    const question = { respuesta: null, _resiarAnswerHidden: true };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', null, 0);
    expect(ev.answered).toBe(true);
    expect(ev.evaluable).toBe(false);
    expect(ev.isCorrect).toBe(false);
    expect(ev.isIncorrect).toBe(false);
    expect(ev.status).toBe('pendiente');
  });

  it('preserva el índice, la pregunta y la respuesta cruda en el resultado', () => {
    const question = { respuesta: 'a', id: 'q123' };
    const ev = resiarEvaluateQuestionAnswer(question, 'a', null, 7);
    expect(ev.index).toBe(7);
    expect(ev.question).toBe(question);
    expect(ev.rawAnswer).toBe('a');
  });

  it('index llega como string (típico de main.js) y se normaliza a número', () => {
    const ev = resiarEvaluateQuestionAnswer({ respuesta: 'a' }, 'a', null, '3');
    expect(ev.index).toBe(3);
  });
});
