// Racha de respuestas correctas consecutivas (pill + flames + boom).
// Extraído de main.js siguiendo el patrón configure() documentado en
// ARCHITECTURE.md: main.js sigue siendo dueño del estado (examen, respuestas,
// actual, correctas) y lo inyecta acá vía closures.

const rachaDeps = {
  getExamen: () => [],
  getRespuestas: () => [],
  getActual: () => 0,
  getLastAnsweredIndex: () => -1,
  evaluateQuestionAnswer: () => ({ answered: false }),
  getCorrectas: () => 0
};

export function configureRacha(deps = {}) {
  Object.assign(rachaDeps, deps || {});
  return {
    resiarEvaluationCountsForStreak,
    resiarFindRachaAnchorIndex,
    resiarCalcularRachaCorrectas,
    actualizarRachaPill,
    renderRacha
  };
}

// Pura, sin dependencias inyectadas: se puede usar/testear directamente.
export function resiarEvaluationCountsForStreak(evaluation) {
  if (!evaluation || !evaluation.answered) return false;
  return evaluation.isAnnulled === true || evaluation.evaluable === true;
}

export function resiarFindRachaAnchorIndex() {
  const examen = rachaDeps.getExamen();
  const respuestas = rachaDeps.getRespuestas();
  const total = Array.isArray(examen) ? examen.length : 0;
  if (!total || !Array.isArray(respuestas)) return -1;

  const lastAnswered = rachaDeps.getLastAnsweredIndex();
  const preferred = Number.isInteger(lastAnswered) && lastAnswered >= 0
    ? lastAnswered
    : rachaDeps.getActual();
  const boundedPreferred = Math.max(0, Math.min(Number(preferred) || 0, total - 1));
  if (resiarEvaluationCountsForStreak(rachaDeps.evaluateQuestionAnswer(boundedPreferred))) return boundedPreferred;

  // La racha debe seguir el último bloque de respuestas efectivamente corregidas,
  // no el último índice del array. `respuestas` se inicializa con el largo total
  // del examen; por eso mirar `respuestas.length - 1` devolvía 0 mientras quedaran
  // preguntas finales sin responder.
  for (let i = total - 1; i >= 0; i--) {
    if (resiarEvaluationCountsForStreak(rachaDeps.evaluateQuestionAnswer(i))) return i;
  }
  return -1;
}

export function resiarCalcularRachaCorrectas() {
  const anchor = resiarFindRachaAnchorIndex();
  if (anchor < 0) return 0;

  let streak = 0;
  for (let i = anchor; i >= 0; i--) {
    const evaluation = rachaDeps.evaluateQuestionAnswer(i);

    // Saltarse preguntas no respondidas permite que la racha refleje respuestas
    // correctas consecutivas aunque el usuario haya navegado o dejado huecos.
    if (!evaluation.answered) continue;
    if (evaluation.isAnnulled) continue;
    if (!evaluation.evaluable) break;

    if (evaluation.isCorrect) streak++;
    else break;
  }
  return streak;
}

export function actualizarRachaPill() {
  const streak = resiarCalcularRachaCorrectas();
  const examen = rachaDeps.getExamen();
  const pill = document.getElementById('rachaPill');
  const num = document.getElementById('rachaNum');
  const fire = document.getElementById('rachaFire');
  if (!pill || !num) return;
  num.textContent = streak;
  // Color dinámico según racha
  if (streak >= 10) {
    num.style.color = '#f97316'; // naranja intenso
    if (fire) fire.style.fontSize = '1.3rem';
  } else if (streak >= 5) {
    num.style.color = 'var(--amber)';
    if (fire) fire.style.fontSize = '1.1rem';
  } else {
    num.style.color = streak > 0 ? 'var(--amber)' : 'var(--text3)';
    if (fire) fire.style.fontSize = '1rem';
  }
  pill.classList.toggle('vis', Array.isArray(examen) && examen.length > 0);
}

function boom() {
  const el = document.createElement('div');
  el.className = 'explosion';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function renderRacha() {
  const streak = resiarCalcularRachaCorrectas();
  const examen = rachaDeps.getExamen();
  const rachaEl = document.getElementById('racha');
  const streakTexto = document.getElementById('streakTexto');
  if (!rachaEl || !streakTexto) return;
  if (streak < 10) { rachaEl.innerHTML = ''; streakTexto.innerText = ''; return; }
  let qty = Math.floor(streak / 10), html = '';
  for (let i = 0; i < qty; i++) html += `<span class="flame" style="font-size:${1 + i * .18}rem">🔥</span>`;
  rachaEl.innerHTML = html; streakTexto.innerText = streak;
  if (rachaDeps.getCorrectas() === (Array.isArray(examen) ? examen.length : 0)) boom();
}
