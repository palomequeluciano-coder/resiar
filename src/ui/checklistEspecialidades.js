// Numeración de preguntas por examen/año y checklist de especialidades.
// Extraído de main.js siguiendo el patrón configure() documentado en
// ARCHITECTURE.md: main.js sigue siendo dueño del pool de preguntas
// (resiarBuildExamSelection) y lo inyecta acá vía closure.

import { escapeHtml } from '../utils/sanitize.js';
import { formatEsp, normEspecialidadKey, espLabel } from '../utils/text.js';
import { resiarSortByOriginalExamOrder } from '../utils/questionOrder.js';

const checklistDeps = {
  // Debe devolver el pool de preguntas sin filtro de especialidad/tema
  // (equivalente a resiarBuildExamSelection({ includeSpecialty:false,
  // includeTopic:false, shuffleWhenUnfiltered:false }).questions).
  getUnfilteredPool: () => []
};

export function configureChecklistEspecialidades(deps = {}) {
  Object.assign(checklistDeps, deps || {});
  return { buildNumeroMap, cargarChecklist };
}

// Pura: agrupa por examen+año y asigna un rank 1-based dentro de cada
// grupo, ordenado por número original. Se usa como fallback en
// utils/questionOrder.js (_resiarOriginalGroupRank) cuando la pregunta no
// trae número original propio.
export function buildNumeroMap(pregs) {
  const groups = {};
  (Array.isArray(pregs) ? pregs : []).forEach(p => {
    const anio = p.anio || p.año || p.year || '';
    const key = (p.examen || 'Sin examen') + (anio ? '_' + anio : '');
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  Object.keys(groups).forEach(key => {
    const sorted = resiarSortByOriginalExamOrder(groups[key]);
    sorted.forEach((p, idx) => {
      try { p._resiarOriginalGroupRank = idx + 1; } catch (_) {}
    });
  });
}

export function cargarChecklist() {
  const checklistEl = document.getElementById('checklistEspecialidades');
  if (!checklistEl) return;

  // Preservar qué valores BD estaban chequeados antes de re-renderizar
  const prev = new Set();
  document.querySelectorAll('.espCheck:checked').forEach(cb => {
    try { JSON.parse(cb.value).forEach(v => prev.add(v)); }
    catch { prev.add(cb.value); }
  });

  const pool = checklistDeps.getUnfilteredPool();

  // Agrupar usando _normEsp: resuelve tildes, guiones bajos Y sinonimias
  // (ej: MedicinaGeneral + General + Medicina_familiar → misma clave)
  const counts = {};    // key normalizada → count
  const rawValues = {}; // key normalizada → array de valores BD originales
  (Array.isArray(pool) ? pool : []).forEach(p => {
    const raw = espLabel(p);
    const key = normEspecialidadKey(raw);
    counts[key] = (counts[key] || 0) + 1;
    if (!rawValues[key]) rawValues[key] = [];
    if (!rawValues[key].includes(raw)) rawValues[key].push(raw);
  });

  checklistEl.innerHTML = Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))  // alfabético
    .map(([key, n]) => {
      // El label visual es el canónico del primer valor BD del grupo
      const displayLabel = formatEsp(rawValues[key][0]);
      // El value del checkbox guarda todos los valores BD del grupo (JSON)
      // para poder filtrar correctamente sin tocar la BD
      const allRaws = JSON.stringify(rawValues[key]);
      const isPrev = rawValues[key].some(v => prev.has(v));
      return `
      <label class="esp-label">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
          <input type="checkbox" value="${escapeHtml(allRaws)}" class="espCheck" data-raws="${escapeHtml(allRaws)}" ${isPrev ? 'checked' : ''}>
          <span style="min-width:0;line-height:1.35;">${displayLabel}</span>
        </div>
        <span class="esp-n" style="flex-shrink:0;">${n}</span>
      </label>`;
    }).join('');
}
