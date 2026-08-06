// Renderizado de la grilla de navegación de preguntas (los "puntitos" de
// examen). Extraído de main.js siguiendo el patrón configure() documentado
// en ARCHITECTURE.md: main.js sigue siendo dueño del estado (examen, actual,
// marcadas, visitadas) y lo inyecta acá vía closures.

const examNavDeps = {
  getExamen: () => [],
  getActual: () => 0,
  getMarcadas: () => new Set(),
  getVisitadas: () => new Set(),
  evaluateQuestionAnswer: () => ({ status: null })
};

export function configureExamNav(deps = {}) {
  Object.assign(examNavDeps, deps || {});
  return {
    getQuestionNavClass,
    getOptimizedNavRanges,
    renderNavDotsOptimized,
    getNavRenderKey,
    syncNavDotState,
    renderNavGridInto
  };
}

export function getQuestionNavClass(q, i) {
  const actual = examNavDeps.getActual();
  const visitadas = examNavDeps.getVisitadas();
  const evaluation = examNavDeps.evaluateQuestionAnswer(i) || {};
  if (i === actual) return evaluation.status ? `actual ${evaluation.status}` : 'actual';
  if (evaluation.status === 'ok') return 'ok';
  if (evaluation.status === 'no') return 'no';
  if (evaluation.status === 'anulada') return 'anulada';
  if (evaluation.status === 'pendiente') return 'pendiente';
  if (visitadas.has(i)) return 'salteada';
  return '';
}

// Pura, sin dependencias inyectadas: se puede usar/testear directamente.
export function getOptimizedNavRanges(total, current) {
  if (total <= 180) return [[0, total - 1]];

  // Para bancos grandes, la ventana central cambia por bloques y no en cada
  // pregunta. Esto reduce reconstrucciones de DOM durante navegación
  // secuencial larga.
  const pageSize = 90;
  const pageStart = Math.max(0, Math.floor(current / pageSize) * pageSize);
  const pageEnd = Math.min(total - 1, pageStart + pageSize - 1);
  const ranges = [
    [0, Math.min(2, total - 1)],
    [pageStart, pageEnd],
    [Math.max(0, total - 3), total - 1]
  ].filter(r => r[0] <= r[1]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r[0] > last[1] + 1) merged.push(r.slice());
    else last[1] = Math.max(last[1], r[1]);
  }
  return merged;
}

export function renderNavDotsOptimized(kind) {
  const examen = examNavDeps.getExamen();
  const actual = examNavDeps.getActual();
  const marcadas = examNavDeps.getMarcadas();
  const total = examen.length;
  const clsBase = kind === 'right' ? 'rp-qnav-dot' : 'qnav-dot';
  const ellipsisCls = kind === 'right' ? 'rp-qnav-ellipsis' : 'qnav-ellipsis';
  let html = '';
  let prevEnd = -1;
  const ranges = getOptimizedNavRanges(total, actual);
  for (const [start, end] of ranges) {
    if (start > prevEnd + 1) {
      const hidden = start - prevEnd - 1;
      html += `<div class="${ellipsisCls}" title="${hidden} preguntas omitidas">…</div>`;
    }
    for (let i = start; i <= end; i++) {
      const q = examen[i];
      const cls = getQuestionNavClass(q, i);
      const isMark = marcadas.has(i) ? 'marcada' : '';
      const id = kind === 'inline' ? ` id="qnavdot_${i}"` : '';
      html += `<div class="${clsBase} ${cls} ${isMark}" data-action="exam-go-question" data-index="${i}" title="Pregunta ${i + 1}"${id}>${i + 1}</div>`;
    }
    prevEnd = end;
  }
  return html;
}

export function getNavRenderKey(kind) {
  const examen = examNavDeps.getExamen();
  const actual = examNavDeps.getActual();
  const ranges = getOptimizedNavRanges(examen.length, actual)
    .map(([start, end]) => `${start}-${end}`)
    .join('|');
  return `${kind}:${examen.length}:${ranges}`;
}

export function syncNavDotState(grid, kind) {
  if (!grid) return;
  const examen = examNavDeps.getExamen();
  const marcadas = examNavDeps.getMarcadas();
  const clsBase = kind === 'right' ? 'rp-qnav-dot' : 'qnav-dot';
  grid.querySelectorAll('[data-index]').forEach(el => {
    const i = Number(el.dataset.index);
    const q = examen[i];
    if (!q || !Number.isFinite(i)) return;
    const cls = getQuestionNavClass(q, i);
    const isMark = marcadas.has(i) ? 'marcada' : '';
    el.className = `${clsBase} ${cls} ${isMark}`.trim();
    el.title = `Pregunta ${i + 1}`;
  });
}

export function renderNavGridInto(grid, kind) {
  if (!grid) return;
  const key = getNavRenderKey(kind);
  if (grid.dataset.navKey === key && grid.childElementCount) {
    syncNavDotState(grid, kind);
    return;
  }
  grid.innerHTML = renderNavDotsOptimized(kind);
  grid.dataset.navKey = key;
}
