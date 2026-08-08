import { describe, it, expect, beforeEach } from 'vitest';
import { configureExamBankFilter } from '../ui/examBankFilter.js';

function makeFilterDom() {
  document.body.innerHTML = `
    <select id="filtroExamen"></select>
    <div id="filtroExamenWrap">
      <div id="filtroExamenTrigger"><svg></svg></div>
      <span id="filtroExamenLabel"></span>
      <div id="filtroExamenDropdown"></div>
    </div>
    <div id="filtroAnioMirWrap" style="display:none">
      <div id="filtroAnioMirSelectWrap">
        <div id="filtroAnioMirTrigger"><svg></svg></div>
        <span id="filtroAnioMirLabel"></span>
      </div>
      <div id="filtroAnioMirDropdown"></div>
    </div>
  `;
}

describe('examBankFilter (con deps inyectadas, DOM vía jsdom)', () => {
  let state;
  let api;

  beforeEach(() => {
    makeFilterDom();
    state = { examen: 'todos', anio: 'todos' };
    api = configureExamBankFilter({
      getPreguntas: () => [
        { examen: 'CABA', anio: 2020 },
        { examen: 'CABA', anio: 2021 },
        { examen: 'EU', anio: 2019 },
        { examen: 'PBA', anio: 2018 }
      ],
      getFiltroExamenValue: () => state.examen,
      setFiltroExamenValue: (v) => { state.examen = v; },
      getFiltroAnioMirValue: () => state.anio,
      setFiltroAnioMirValue: (v) => { state.anio = v; }
    });
  });

  it('cargarFiltros arma el <select> y el dropdown con "Todos los exámenes" primero', () => {
    api.cargarFiltros();
    const select = document.getElementById('filtroExamen');
    expect(select.innerHTML).toContain('Todos los exámenes');
    expect(select.innerHTML).toContain('CABA');
  });

  it('cargarAniosMir oculta el wrap de año cuando el banco es "todos"', () => {
    api.cargarAniosMir(null);
    expect(document.getElementById('filtroAnioMirWrap').style.display).toBe('none');
    expect(state.anio).toBe('todos');
  });

  it('cargarAniosMir muestra el wrap y lista los años de ese banco, ordenados descendente', () => {
    api.cargarAniosMir('CABA');
    const wrap = document.getElementById('filtroAnioMirWrap');
    expect(wrap.style.display).not.toBe('none');
    const dd = document.getElementById('filtroAnioMirDropdown');
    const years = [...dd.querySelectorAll('.custom-select-option')].map(el => el.textContent.trim());
    expect(years).toEqual(['Todos los años', '2021', '2020']);
  });

  it('selectExamen actualiza el estado, dispara change y recarga años', () => {
    api.cargarFiltros(); // popula las <option> del <select>, requisito para poder asignar su .value
    const select = document.getElementById('filtroExamen');
    let changeFired = false;
    select.addEventListener('change', () => { changeFired = true; });

    api.selectExamen('CABA', 'CABA');
    expect(state.examen).toBe('CABA');
    expect(select.value).toBe('CABA');
    expect(changeFired).toBe(true);
    expect(document.getElementById('filtroAnioMirWrap').style.display).not.toBe('none');
  });

  it('selectAnioMir actualiza el estado y el label', () => {
    api.selectAnioMir('2020', '2020');
    expect(state.anio).toBe('2020');
    expect(document.getElementById('filtroAnioMirLabel').textContent).toBe('2020');
  });

  it('toggleCustomSelect y toggleAnioMirSelect alternan la clase "open"', () => {
    const examDd = document.getElementById('filtroExamenDropdown');
    api.toggleCustomSelect();
    expect(examDd.classList.contains('open')).toBe(true);
    api.toggleCustomSelect();
    expect(examDd.classList.contains('open')).toBe(false);

    const anioDd = document.getElementById('filtroAnioMirDropdown');
    api.toggleAnioMirSelect();
    expect(anioDd.classList.contains('open')).toBe(true);
  });

  it('un click fuera del dropdown de examen lo cierra', () => {
    const examDd = document.getElementById('filtroExamenDropdown');
    api.toggleCustomSelect();
    expect(examDd.classList.contains('open')).toBe(true);

    document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(examDd.classList.contains('open')).toBe(false);
  });

  it('no rompe si faltan elementos del DOM', () => {
    document.body.innerHTML = '';
    expect(() => api.cargarFiltros()).not.toThrow();
    expect(() => api.cargarAniosMir('CABA')).not.toThrow();
    expect(() => api.selectExamen('CABA', 'CABA')).not.toThrow();
    expect(() => api.toggleCustomSelect()).not.toThrow();
  });
});
