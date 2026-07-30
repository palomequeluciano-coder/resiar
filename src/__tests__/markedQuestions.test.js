import { describe, it, expect, beforeEach } from 'vitest';
import { configureMarkedQuestions } from '../services/markedQuestions.js';

function makeFakeStorage() {
  const store = new Map();
  return {
    store,
    readJson: (key, fallback = null) => (store.has(key) ? store.get(key) : fallback),
    writeJson: (key, value) => { store.set(key, value); return true; },
    removeStorage: (key) => { store.delete(key); return true; }
  };
}

describe('markedQuestions (con dependencias mock)', () => {
  let storage;
  let currentUser;
  let examen;
  let api;

  beforeEach(() => {
    storage = makeFakeStorage();
    currentUser = { id: 'user-1', email: 'user@test.com' };
    examen = [
      { id: 'q1' },
      { id: 'q2' },
      { id: 'q3' }
    ];

    api = configureMarkedQuestions({
      getCurrentUser: () => currentUser,
      getExamen: () => examen,
      readJson: storage.readJson,
      writeJson: storage.writeJson,
      removeStorage: storage.removeStorage
    });
  });

  it('resiarQuestionIdAtIndex devuelve el id normalizado en la posición dada', () => {
    expect(api.resiarQuestionIdAtIndex(0)).toBe('q1');
    expect(api.resiarQuestionIdAtIndex(2)).toBe('q3');
    expect(api.resiarQuestionIdAtIndex(99)).toBeNull();
    expect(api.resiarQuestionIdAtIndex(-1)).toBeNull();
  });

  it('sin usuario logueado, resiarReadPersistentMarkedIds devuelve Set vacío', () => {
    currentUser = null;
    expect(api.resiarReadPersistentMarkedIds()).toEqual(new Set());
  });

  it('persiste y vuelve a leer un Set de índices marcados', () => {
    const ok = api.resiarPersistMarkedIndexSet(new Set([0, 2]));
    expect(ok).toBe(true);

    const persisted = api.resiarReadPersistentMarkedIds();
    expect(persisted).toEqual(new Set(['q1', 'q3']));
  });

  it('resiarHydratePersistentMarkedForExam reconstruye índices marcados a partir de ids persistidos', () => {
    api.resiarPersistMarkedIndexSet(new Set([1])); // marca q2

    const hydrated = api.resiarHydratePersistentMarkedForExam();
    expect(hydrated).toEqual(new Set([1]));
  });

  it('resiarHydratePersistentMarkedForExam conserva marcas base válidas del examen actual', () => {
    const hydrated = api.resiarHydratePersistentMarkedForExam(new Set([0, 99]));
    // El índice 99 no existe en el examen (largo 3) y se descarta; el 0 se conserva.
    expect(hydrated).toEqual(new Set([0]));
  });

  it('al persistir un nuevo Set, no toca marcas de preguntas fuera del examen actual', () => {
    // Simular que el usuario tenía marcada una pregunta de OTRO examen (id "q-otro")
    storage.writeJson(
      `resiar_marked_questions_v1:${currentUser.id}`,
      { ids: ['q-otro'] }
    );

    api.resiarPersistMarkedIndexSet(new Set([0])); // marca q1 en el examen actual

    const persisted = api.resiarReadPersistentMarkedIds();
    expect(persisted.has('q-otro')).toBe(true); // se preservó
    expect(persisted.has('q1')).toBe(true); // se agregó la nueva
  });

  it('persistir un Set vacío borra el registro guardado', () => {
    api.resiarPersistMarkedIndexSet(new Set([0]));
    expect(api.resiarReadPersistentMarkedIds().size).toBe(1);

    api.resiarPersistMarkedIndexSet(new Set());
    expect(api.resiarReadPersistentMarkedIds().size).toBe(0);
  });

  it('separa el storage por usuario (scope distinto = datos distintos)', () => {
    api.resiarPersistMarkedIndexSet(new Set([0]));

    currentUser = { id: 'user-2' };
    const otroUsuario = api.resiarReadPersistentMarkedIds();
    expect(otroUsuario.size).toBe(0);
  });
});
