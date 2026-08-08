import { describe, it, expect, beforeEach } from 'vitest';
import { configureChecklistEspecialidades, buildNumeroMap } from '../ui/checklistEspecialidades.js';

describe('buildNumeroMap (pura)', () => {
  it('agrupa por examen+año y asigna rank 1-based ordenado por num_original', () => {
    const pregs = [
      { examen: 'CABA', anio: 2020, num_original: 3 },
      { examen: 'CABA', anio: 2020, num_original: 1 },
      { examen: 'CABA', anio: 2020, num_original: 2 }
    ];
    buildNumeroMap(pregs);
    expect(pregs.find(p => p.num_original === 1)._resiarOriginalGroupRank).toBe(1);
    expect(pregs.find(p => p.num_original === 2)._resiarOriginalGroupRank).toBe(2);
    expect(pregs.find(p => p.num_original === 3)._resiarOriginalGroupRank).toBe(3);
  });

  it('cada grupo examen+año arranca en 1 de forma independiente', () => {
    const pregs = [
      { examen: 'CABA', anio: 2020, num_original: 5 },
      { examen: 'CABA', anio: 2021, num_original: 5 },
      { examen: 'ERES', anio: 2020, num_original: 5 }
    ];
    buildNumeroMap(pregs);
    expect(pregs.every(p => p._resiarOriginalGroupRank === 1)).toBe(true);
  });

  it('usa "Sin examen" para preguntas sin campo examen', () => {
    const pregs = [{ num_original: 1 }, { num_original: 2 }];
    expect(() => buildNumeroMap(pregs)).not.toThrow();
    expect(pregs[0]._resiarOriginalGroupRank).toBe(1);
    expect(pregs[1]._resiarOriginalGroupRank).toBe(2);
  });

  it('no falla con lista vacía o no-array', () => {
    expect(() => buildNumeroMap([])).not.toThrow();
    expect(() => buildNumeroMap(null)).not.toThrow();
    expect(() => buildNumeroMap(undefined)).not.toThrow();
  });
});

describe('cargarChecklist (con deps inyectadas, DOM vía jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="checklistEspecialidades"></div>';
  });

  it('renderiza un checkbox por especialidad con su conteo', () => {
    const pool = [
      { especialidad: 'Cardiologia' },
      { especialidad: 'Cardiologia' },
      { especialidad: 'Neurologia' }
    ];
    const { cargarChecklist } = configureChecklistEspecialidades({
      getUnfilteredPool: () => pool
    });
    cargarChecklist();
    const el = document.getElementById('checklistEspecialidades');
    const checks = el.querySelectorAll('.espCheck');
    expect(checks.length).toBe(2);
    expect(el.textContent).toContain('2');
    expect(el.textContent).toContain('1');
  });

  it('agrupa variantes equivalentes de especialidad bajo la misma clave', () => {
    const pool = [
      { especialidad: 'Medicina_familiar' },
      { especialidad: 'Medicina Familiar' }
    ];
    const { cargarChecklist } = configureChecklistEspecialidades({
      getUnfilteredPool: () => pool
    });
    cargarChecklist();
    const el = document.getElementById('checklistEspecialidades');
    expect(el.querySelectorAll('.espCheck').length).toBe(1);
    expect(el.textContent).toContain('2');
  });

  it('preserva los checks previos al volver a renderizar', () => {
    const pool = [{ especialidad: 'Cardiologia' }, { especialidad: 'Neurologia' }];
    const { cargarChecklist } = configureChecklistEspecialidades({
      getUnfilteredPool: () => pool
    });
    cargarChecklist();
    const el = document.getElementById('checklistEspecialidades');
    el.querySelector('.espCheck').checked = true;

    cargarChecklist();
    const checkedCount = el.querySelectorAll('.espCheck:checked').length;
    expect(checkedCount).toBe(1);
  });

  it('no rompe si el pool está vacío', () => {
    const { cargarChecklist } = configureChecklistEspecialidades({
      getUnfilteredPool: () => []
    });
    expect(() => cargarChecklist()).not.toThrow();
    expect(document.getElementById('checklistEspecialidades').querySelectorAll('.espCheck').length).toBe(0);
  });

  it('no rompe si el elemento checklistEspecialidades no existe en el DOM', () => {
    document.body.innerHTML = '';
    const { cargarChecklist } = configureChecklistEspecialidades({
      getUnfilteredPool: () => [{ especialidad: 'Cardiologia' }]
    });
    expect(() => cargarChecklist()).not.toThrow();
  });
});
