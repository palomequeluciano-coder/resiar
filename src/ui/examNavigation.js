export function getOptimizedNavRanges(total, current) {
  const totalQuestions = Number(total);
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) return [];
  if (totalQuestions <= 180) return [[0, totalQuestions - 1]];

  // Para bancos grandes, la ventana central cambia por bloques y no en cada pregunta.
  // Esto reduce reconstrucciones de DOM durante navegación secuencial larga.
  const currentIndex = Number.isFinite(Number(current)) ? Number(current) : 0;
  const pageSize = 90;
  const pageStart = Math.max(0, Math.floor(currentIndex / pageSize) * pageSize);
  const pageEnd = Math.min(totalQuestions - 1, pageStart + pageSize - 1);
  const ranges = [
    [0, Math.min(2, totalQuestions - 1)],
    [pageStart, pageEnd],
    [Math.max(0, totalQuestions - 3), totalQuestions - 1]
  ].filter(r => r[0] <= r[1]).sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r[0] > last[1] + 1) merged.push(r.slice());
    else last[1] = Math.max(last[1], r[1]);
  }
  return merged;
}

export function createExamNavigationRenderer(options = {}) {
  const getExam = () => {
    try {
      const exam = options.getExam?.();
      return Array.isArray(exam) ? exam : [];
    } catch (_) { return []; }
  };
  const getAnswers = () => {
    try {
      const answers = options.getAnswers?.();
      return Array.isArray(answers) ? answers : [];
    } catch (_) { return []; }
  };
  const getCurrentIndex = () => {
    try {
      const idx = Number(options.getCurrentIndex?.());
      return Number.isFinite(idx) ? idx : 0;
    } catch (_) { return 0; }
  };
  const getMarked = () => {
    try {
      const marked = options.getMarked?.();
      return marked instanceof Set ? marked : new Set();
    } catch (_) { return new Set(); }
  };
  const getVisited = () => {
    try {
      const visited = options.getVisited?.();
      return visited instanceof Set ? visited : new Set();
    } catch (_) { return new Set(); }
  };
  const isRespuestaAnulada = (question) => {
    try { return !!options.isRespuestaAnulada?.(question); }
    catch (_) { return false; }
  };

  function getQuestionNavClass(q, i) {
    const answers = getAnswers();
    const visited = getVisited();
    const r = answers[i];
    if (i === getCurrentIndex()) return 'actual';
    if (isRespuestaAnulada(q) && r) return 'anulada';
    if (r && r === q?.respuesta) return 'ok';
    if (r && r !== q?.respuesta) return 'no';
    if (visited.has(i)) return 'salteada';
    return '';
  }

  function renderNavDotsOptimized(kind) {
    const exam = getExam();
    const marked = getMarked();
    const total = exam.length;
    const clsBase = kind === 'right' ? 'rp-qnav-dot' : 'qnav-dot';
    const ellipsisCls = kind === 'right' ? 'rp-qnav-ellipsis' : 'qnav-ellipsis';
    let html = '';
    let prevEnd = -1;
    const ranges = getOptimizedNavRanges(total, getCurrentIndex());
    for (const [start, end] of ranges) {
      if (start > prevEnd + 1) {
        const hidden = start - prevEnd - 1;
        html += `<div class="${ellipsisCls}" title="${hidden} preguntas omitidas">…</div>`;
      }
      for (let i = start; i <= end; i++) {
        const q = exam[i];
        const cls = getQuestionNavClass(q, i);
        const isMark = marked.has(i) ? 'marcada' : '';
        const id = kind === 'inline' ? ` id="qnavdot_${i}"` : '';
        html += `<div class="${clsBase} ${cls} ${isMark}" data-action="exam-go-question" data-index="${i}" title="Pregunta ${i + 1}"${id}>${i + 1}</div>`;
      }
      prevEnd = end;
    }
    return html;
  }

  function getNavRenderKey(kind) {
    const exam = getExam();
    const ranges = getOptimizedNavRanges(exam.length, getCurrentIndex())
      .map(([start, end]) => `${start}-${end}`)
      .join('|');
    return `${kind}:${exam.length}:${ranges}`;
  }

  function syncNavDotState(grid, kind) {
    if (!grid) return;
    const exam = getExam();
    const marked = getMarked();
    const clsBase = kind === 'right' ? 'rp-qnav-dot' : 'qnav-dot';
    grid.querySelectorAll('[data-index]').forEach(el => {
      const i = Number(el.dataset.index);
      const q = exam[i];
      if (!q || !Number.isFinite(i)) return;
      const cls = getQuestionNavClass(q, i);
      const isMark = marked.has(i) ? 'marcada' : '';
      el.className = `${clsBase} ${cls} ${isMark}`.trim();
      el.title = `Pregunta ${i + 1}`;
    });
  }

  function renderNavGridInto(grid, kind) {
    if (!grid) return;
    const key = getNavRenderKey(kind);
    if (grid.dataset.navKey === key && grid.childElementCount) {
      syncNavDotState(grid, kind);
      return;
    }
    grid.innerHTML = renderNavDotsOptimized(kind);
    grid.dataset.navKey = key;
  }

  return {
    getQuestionNavClass,
    getOptimizedNavRanges,
    renderNavDotsOptimized,
    getNavRenderKey,
    syncNavDotState,
    renderNavGridInto
  };
}
