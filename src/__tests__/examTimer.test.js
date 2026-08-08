import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureExamTimer, resiarFormatElapsedTimer } from '../ui/examTimer.js';

describe('resiarFormatElapsedTimer (pura)', () => {
  it('formatea minutos:segundos por debajo de una hora', () => {
    expect(resiarFormatElapsedTimer(0)).toBe('00:00');
    expect(resiarFormatElapsedTimer(65)).toBe('01:05');
    expect(resiarFormatElapsedTimer(3599)).toBe('59:59');
  });

  it('agrega horas cuando supera los 60 minutos', () => {
    expect(resiarFormatElapsedTimer(3600)).toBe('01:00:00');
    expect(resiarFormatElapsedTimer(3661)).toBe('01:01:01');
  });

  it('nunca devuelve negativo, incluso con input negativo o inválido', () => {
    expect(resiarFormatElapsedTimer(-10)).toBe('00:00');
    expect(resiarFormatElapsedTimer(NaN)).toBe('00:00');
    expect(resiarFormatElapsedTimer(undefined)).toBe('00:00');
  });
});

describe('iniciarTimer (con deps inyectadas, timers falsos)', () => {
  let state;
  let deps;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<span id="timer"></span>';
    state = { tiempo: 0, tiempoTotal: 0, timer: undefined, savedReasons: [], soundPlays: 0, timeUpCalls: 0 };
    deps = {
      getTiempo: () => state.tiempo,
      setTiempo: (v) => { state.tiempo = v; },
      getTiempoTotal: () => state.tiempoTotal,
      setTiempoTotal: (v) => { state.tiempoTotal = v; },
      getTimer: () => state.timer,
      setTimer: (v) => { state.timer = v; },
      saveDraft: (reason) => { state.savedReasons.push(reason); },
      playTimerSound: () => { state.soundPlays++; },
      onTimeUp: () => { state.timeUpCalls++; }
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('inicializa tiempo/tiempoTotal y muestra 00:00 (tiempo transcurrido) al arrancar', () => {
    const { iniciarTimer } = configureExamTimer(deps);
    iniciarTimer(120 * 60, 120 * 60);
    expect(state.tiempo).toBe(120 * 60);
    expect(state.tiempoTotal).toBe(120 * 60);
    expect(document.getElementById('timer').innerText).toBe('00:00');
  });

  it('cuenta tiempo transcurrido (no restante) en el display', () => {
    const { iniciarTimer } = configureExamTimer(deps);
    iniciarTimer(100, 100);
    vi.advanceTimersByTime(5000);
    expect(state.tiempo).toBe(95);
    expect(document.getElementById('timer').innerText).toBe('00:05');
  });

  it('guarda el borrador cada 15 segundos de tiempo restante', () => {
    const { iniciarTimer } = configureExamTimer(deps);
    iniciarTimer(100, 100);
    vi.advanceTimersByTime(85000); // tiempo restante pasa por 85 -> 15
    expect(state.savedReasons.filter(r => r === 'timer').length).toBeGreaterThanOrEqual(1);
  });

  it('reproduce el sonido en 60, 30 y los últimos 10 segundos', () => {
    const { iniciarTimer } = configureExamTimer(deps);
    iniciarTimer(61, 61);
    vi.advanceTimersByTime(61000);
    // segundos con sonido: 60, 30, 10,9,8,7,6,5,4,3,2,1 = 12 veces
    expect(state.soundPlays).toBe(12);
  });

  it('llama a onTimeUp cuando el tiempo restante llega a 0, y no antes', () => {
    const { iniciarTimer } = configureExamTimer(deps);
    iniciarTimer(3, 3);
    vi.advanceTimersByTime(2000);
    expect(state.timeUpCalls).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(state.timeUpCalls).toBe(1);
  });

  it('limpia el interval anterior si se llama de nuevo (no corren dos timers en paralelo)', () => {
    const { iniciarTimer } = configureExamTimer(deps);
    iniciarTimer(100, 100);
    const firstTimer = state.timer;
    iniciarTimer(50, 50);
    expect(state.timer).not.toBe(firstTimer);
    expect(state.tiempo).toBe(50);
  });

  it('no rompe si el elemento #timer no existe en el DOM', () => {
    document.body.innerHTML = '';
    const { iniciarTimer } = configureExamTimer(deps);
    expect(() => { iniciarTimer(10, 10); vi.advanceTimersByTime(1000); }).not.toThrow();
  });
});
