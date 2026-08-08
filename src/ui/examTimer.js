// Timer principal de examen (cuenta ascendente en pantalla, cuenta
// descendente internamente). Extraído de main.js siguiendo el patrón
// configure() documentado en ARCHITECTURE.md: main.js sigue siendo dueño
// del estado (tiempo, tiempoTotal, timer) y lo inyecta acá vía closure.

const timerDeps = {
  getTiempo: () => 0,
  setTiempo: () => {},
  getTiempoTotal: () => 0,
  setTiempoTotal: () => {},
  getTimer: () => undefined,
  setTimer: () => {},
  saveDraft: () => {},
  playTimerSound: () => {},
  onTimeUp: () => {}
};

export function configureExamTimer(deps = {}) {
  Object.assign(timerDeps, deps || {});
  return { resiarFormatElapsedTimer, iniciarTimer };
}

// Pura: sin dependencias inyectadas, se puede usar/testear directamente.
export function resiarFormatElapsedTimer(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function iniciarTimer(initialRemaining, initialTotal) {
  clearInterval(timerDeps.getTimer());
  const total = Number(initialTotal);
  const remaining = Number(initialRemaining);

  // Internamente mantenemos `tiempo` como tiempo restante para no romper:
  // - guardado/restauración de borradores
  // - estadísticas finales
  // - sonidos de aviso al quedar 60/30/10 segundos
  // Visualmente mostramos tiempo transcurrido, empezando en 00:00.
  const tiempoTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 120 * 60;
  const tiempoInicial = Number.isFinite(remaining) && remaining >= 0 ? Math.min(Math.floor(remaining), tiempoTotal) : tiempoTotal;
  timerDeps.setTiempoTotal(tiempoTotal);
  timerDeps.setTiempo(tiempoInicial);

  const renderTimer = () => {
    const timerSpan = document.getElementById('timer');
    if (!timerSpan) return;
    const elapsed = Math.max(0, timerDeps.getTiempoTotal() - timerDeps.getTiempo());
    timerSpan.innerText = resiarFormatElapsedTimer(elapsed);
  };

  renderTimer();

  timerDeps.setTimer(setInterval(() => {
    const tiempo = timerDeps.getTiempo() - 1;
    timerDeps.setTiempo(tiempo);
    renderTimer();

    if (tiempo > 0 && tiempo % 15 === 0) timerDeps.saveDraft('timer');
    if (tiempo === 60 || tiempo === 30 || (tiempo <= 10 && tiempo > 0)) timerDeps.playTimerSound();
    if (tiempo <= 0) { clearInterval(timerDeps.getTimer()); timerDeps.onTimeUp(); }
  }, 1000));
}
