// Filtro de banco de examen (dropdown custom) + filtro de año MIR
// (dependiente del banco elegido). Extraído de main.js siguiendo el
// patrón configure() documentado en ARCHITECTURE.md: main.js sigue
// siendo dueño del estado (_filtroExamenValue, _filtroAnioMirValue,
// preguntas) y lo inyecta acá vía closure.

import { PROVINCIA_VALUE, EU_VALUE, esProvinciaBsAs, esExamenUnico } from '../utils/examFilters.js';

const filterDeps = {
  getPreguntas: () => [],
  getFiltroExamenValue: () => 'todos',
  setFiltroExamenValue: () => {},
  getFiltroAnioMirValue: () => 'todos',
  setFiltroAnioMirValue: () => {}
};

function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function configureExamBankFilter(deps = {}) {
  Object.assign(filterDeps, deps || {});

  // Cerrar el dropdown de año al hacer click afuera.
  document.addEventListener('click', e => {
    if (!e.target.closest('#filtroAnioMirSelectWrap') && !e.target.closest('#filtroAnioMirDropdown')) {
      const dd = document.getElementById('filtroAnioMirDropdown');
      dd?.classList.remove('open');
      const svg = document.querySelector('#filtroAnioMirTrigger svg');
      if (svg) svg.style.transform = '';
    }
  });

  // Cerrar el dropdown de examen al hacer click afuera.
  document.addEventListener('click', e => {
    if (!e.target.closest('#filtroExamenWrap') && !e.target.closest('#filtroExamenDropdown')) {
      const dd = document.getElementById('filtroExamenDropdown');
      dd?.classList.remove('open');
      const svg = document.querySelector('#filtroExamenTrigger svg');
      if (svg) svg.style.transform = '';
    }
  });

  return {
    cargarFiltros,
    cargarAniosMir,
    selectAnioMir,
    toggleAnioMirSelect,
    selectExamen,
    toggleCustomSelect
  };
}

export function cargarFiltros() {
  const preguntas = filterDeps.getPreguntas();
  const ex = [...new Set(preguntas.map(p => p.examen))];
  const exOtros = ex.filter(e => !esProvinciaBsAs(e) && !esExamenUnico(e));
  const hayProvincia = ex.some(e => esProvinciaBsAs(e));
  const hayEU        = ex.some(e => esExamenUnico(e));

  const opciones = [{ value: 'todos', label: 'Todos los exámenes' }];
  exOtros.forEach(e => opciones.push({ value: e, label: e }));
  if (hayEU)       opciones.push({ value: EU_VALUE,        label: 'Examen Único' });
  if (hayProvincia) opciones.push({ value: PROVINCIA_VALUE, label: 'Provincia de Buenos Aires' });

  const filtroExamenValue = filterDeps.getFiltroExamenValue();
  const filtroExamenEl = document.getElementById('filtroExamen');
  if (filtroExamenEl) filtroExamenEl.innerHTML = opciones.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  const dd = document.getElementById('filtroExamenDropdown');
  if (dd) dd.innerHTML = opciones.map(o => `
    <div class="custom-select-option${o.value === filtroExamenValue ? ' selected' : ''}"
         data-action="select-exam-filter"
         data-value="${escapeAttr(o.value)}"
         data-label="${escapeAttr(o.label)}">
      ${o.label}
    </div>`).join('');
  cargarAniosMir(filtroExamenValue === 'todos' ? null : filtroExamenValue);
}

export function cargarAniosMir(bancoValue) {
  const wrap = document.getElementById('filtroAnioMirWrap');
  const esProv  = bancoValue === PROVINCIA_VALUE;
  const esEU    = bancoValue === EU_VALUE;

  // Ocultar si no hay banco seleccionado
  if (!bancoValue || bancoValue === 'todos') {
    if (wrap) wrap.style.display = 'none';
    filterDeps.setFiltroAnioMirValue('todos');
    return;
  }
  if (wrap) wrap.style.display = '';

  const preguntas = filterDeps.getPreguntas();
  // Para provincia: años de todas las preguntas de provincia BA
  // Para EU: años de todas las preguntas con examen === 'EU'
  // Para cualquier otro banco exacto
  const fuente = esProv
    ? preguntas.filter(p => esProvinciaBsAs(p.examen))
    : esEU
      ? preguntas.filter(p => esExamenUnico(p.examen))
      : preguntas.filter(p => p.examen == bancoValue);

  const anios = [...new Set(
    fuente
      .map(p => {
        const explicit = p.anio || p.año || p.year;
        if (explicit) return String(explicit);
        const match = String(p.examen || '').match(/\b(19|20)\d{2}\b/);
        return match ? match[0] : null;
      })
      .filter(Boolean)
  )].sort((a, b) => b - a);

  const dd = document.getElementById('filtroAnioMirDropdown');
  const opciones = [{ value: 'todos', label: 'Todos los años' }, ...anios.map(a => ({ value: a, label: a }))];
  const filtroAnioMirValue = filterDeps.getFiltroAnioMirValue();
  if (dd) dd.innerHTML = opciones.map(o => `
    <div class="custom-select-option${o.value === filtroAnioMirValue ? ' selected' : ''}"
         data-action="select-mir-year-filter"
         data-value="${escapeAttr(o.value)}"
         data-label="${escapeAttr(o.label)}">
      ${o.label}
    </div>`).join('');
  filterDeps.setFiltroAnioMirValue('todos');
  const label = document.getElementById('filtroAnioMirLabel');
  if (label) label.textContent = 'Todos los años';
}

export function selectAnioMir(value, label) {
  filterDeps.setFiltroAnioMirValue(value);
  const labelEl = document.getElementById('filtroAnioMirLabel');
  if (labelEl) labelEl.textContent = label;
  document.getElementById('filtroAnioMirDropdown')?.classList.remove('open');
  const svg = document.querySelector('#filtroAnioMirTrigger svg');
  if (svg) svg.style.transform = '';
  document.querySelectorAll('#filtroAnioMirDropdown .custom-select-option').forEach(el => {
    el.classList.toggle('selected', el.textContent.trim() === label);
  });
}

export function toggleAnioMirSelect() {
  const dd = document.getElementById('filtroAnioMirDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  const svg = document.querySelector('#filtroAnioMirTrigger svg');
  if (svg) svg.style.transform = dd.classList.contains('open') ? 'rotate(180deg)' : '';
}

export function selectExamen(value, label) {
  filterDeps.setFiltroExamenValue(value);
  const filtroExamenEl = document.getElementById('filtroExamen');
  if (filtroExamenEl) filtroExamenEl.value = value;
  const labelEl = document.getElementById('filtroExamenLabel');
  if (labelEl) labelEl.textContent = label;
  document.getElementById('filtroExamenDropdown')?.classList.remove('open');
  const svg = document.querySelector('#filtroExamenTrigger svg');
  if (svg) svg.style.transform = '';
  // Trigger change event
  filtroExamenEl?.dispatchEvent(new Event('change'));
  // Actualizar selected en dropdown
  document.querySelectorAll('#filtroExamenDropdown .custom-select-option').forEach(el => {
    el.classList.toggle('selected', el.textContent.trim() === label);
  });
  // Mostrar/ocultar selector de año MIR
  cargarAniosMir(value === 'todos' ? null : value);
}

export function toggleCustomSelect() {
  const dd = document.getElementById('filtroExamenDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  const svg = document.querySelector('#filtroExamenTrigger svg');
  if (svg) svg.style.transform = dd.classList.contains('open') ? 'rotate(180deg)' : '';
}
