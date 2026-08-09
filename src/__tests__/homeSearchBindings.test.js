import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureHomeSearchBindings } from '../ui/homeSearchBindings.js';

function resetGlobals() {
  delete window.__resiarHomeSearchBindingsInstalled;
  delete window.resiarRenderHome;
  delete window.mostrarPantallaBienvenida;
  delete window.irAConfigurarNuevoExamen;
  delete window.resiarHomeRefreshSpecialties;
  delete window.resiarHomeSetTopic;
}

describe('homeSearchBindings', () => {
  beforeEach(() => {
    resetGlobals();
    document.body.innerHTML = `
      <input id="homeEspSearch">
      <input id="homeTemaInput">
    `;
  });

  it('envuelve las 3 funciones de render de la home y las expone via setFunction', () => {
    window.resiarRenderHome = () => 'home';
    window.mostrarPantallaBienvenida = () => 'bienvenida';
    window.irAConfigurarNuevoExamen = () => 'configurar';

    const setCalls = {};
    configureHomeSearchBindings({
      setFunction: (name, fn) => { window[name] = fn; setCalls[name] = fn; }
    });

    expect(typeof setCalls.resiarRenderHome).toBe('function');
    expect(typeof setCalls.mostrarPantallaBienvenida).toBe('function');
    expect(typeof setCalls.irAConfigurarNuevoExamen).toBe('function');
    // el wrapper preserva el resultado de la función original
    expect(window.resiarRenderHome()).toBe('home');
  });

  it('no envuelve dos veces la misma función (evita wrappers anidados)', () => {
    window.resiarRenderHome = () => 'home';
    let setCount = 0;
    configureHomeSearchBindings({
      setFunction: (name, fn) => { window[name] = fn; if (name === 'resiarRenderHome') setCount++; }
    });
    // reinstalar manualmente no debería volver a envolver porque ya está marcado
    delete window.__resiarHomeSearchBindingsInstalled;
    configureHomeSearchBindings({
      setFunction: (name, fn) => { window[name] = fn; if (name === 'resiarRenderHome') setCount++; }
    });
    expect(setCount).toBe(1);
  });

  it('no instala dos veces si __resiarHomeSearchBindingsInstalled ya está seteado', () => {
    window.__resiarHomeSearchBindingsInstalled = true;
    let called = false;
    configureHomeSearchBindings({ setFunction: () => { called = true; } });
    expect(called).toBe(false);
  });

  it('instala el listener de "input" en el buscador de especialidad y llama a resiarHomeRefreshSpecialties', () => {
    const refresh = vi.fn();
    window.resiarHomeRefreshSpecialties = refresh;
    configureHomeSearchBindings({ setFunction: (name, fn) => { window[name] = fn; } });

    document.getElementById('homeEspSearch').dispatchEvent(new window.Event('input'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('instala el listener de "input" en el buscador de tema y llama a resiarHomeSetTopic con el valor', () => {
    const setTopic = vi.fn();
    window.resiarHomeSetTopic = setTopic;
    configureHomeSearchBindings({ setFunction: (name, fn) => { window[name] = fn; } });

    const topicInput = document.getElementById('homeTemaInput');
    topicInput.value = 'cardiología';
    topicInput.dispatchEvent(new window.Event('input'));
    expect(setTopic).toHaveBeenCalledWith('cardiología');
  });

  it('no rompe si los elementos de búsqueda no existen en el DOM', () => {
    document.body.innerHTML = '';
    expect(() => configureHomeSearchBindings({ setFunction: () => {} })).not.toThrow();
  });

  it('no rompe si window[name] no es una función (no hay nada que envolver)', () => {
    expect(() => configureHomeSearchBindings({ setFunction: () => {} })).not.toThrow();
  });
});
