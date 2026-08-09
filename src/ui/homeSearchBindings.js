// Handlers de búsqueda de la home (especialidad/tema) + wrapper que los
// reinstala cada vez que se vuelve a renderizar la home. Extraído de
// main.js siguiendo el patrón configure(): main.js sigue siendo dueño de
// los bindings reasignables (resiarRenderHome, mostrarPantallaBienvenida,
// irAConfigurarNuevoExamen) y los expone acá vía `setFunction`, el mismo
// tipo de puente get/set que ya usa configureViewStateController más
// abajo en main.js.

const deps = {
  // Por default lee/escribe solo en window, igual que el comportamiento
  // original para cualquier nombre. main.js pisa esto para además
  // sincronizar sus propios bindings de función reasignables.
  setFunction: (name, fn) => { window[name] = fn; }
};

export function configureHomeSearchBindings(overrides = {}) {
  Object.assign(deps, overrides || {});
  install();
}

function q(id) { return document.getElementById(id); }

function installSearchHandlers() {
  const esp = q('homeEspSearch');
  if (esp && !esp.__resiarHomeSearchHandler) {
    esp.__resiarHomeSearchHandler = true;
    esp.addEventListener('input', function () {
      if (typeof window.resiarHomeRefreshSpecialties === 'function') window.resiarHomeRefreshSpecialties();
    });
  }
  const topic = q('homeTemaInput');
  if (topic && !topic.__resiarHomeSearchHandler) {
    topic.__resiarHomeSearchHandler = true;
    topic.addEventListener('input', function () {
      if (typeof window.resiarHomeSetTopic === 'function') window.resiarHomeSetTopic(topic.value);
    });
  }
}

function wrapAfterRender(name) {
  const fn = window[name];
  if (typeof fn !== 'function' || fn.__resiarHomeSearchWrapped) return;
  const wrapped = function () {
    const out = fn.apply(this, arguments);
    Promise.resolve(out).finally(function () { requestAnimationFrame(installSearchHandlers); });
    return out;
  };
  wrapped.__resiarHomeSearchWrapped = true;
  deps.setFunction(name, wrapped);
}

function install() {
  if (window.__resiarHomeSearchBindingsInstalled) return;
  window.__resiarHomeSearchBindingsInstalled = true;

  installSearchHandlers();
  ['resiarRenderHome', 'mostrarPantallaBienvenida', 'irAConfigurarNuevoExamen'].forEach(wrapAfterRender);
}
