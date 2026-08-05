// RESIAR — Wrapper liviano de code-splitting para el módulo de Bibliografía 2026.
//
// La implementación real (bibliografia2026Impl.js, ~88 KB) solo se importa
// dinámicamente la primera vez que el usuario efectivamente abre esta
// sección (abrirBibliografia2026), no al arrancar la app.

let implPromise = null;
let realImpl = null;
let pendingDeps = {};

function ensureImpl() {
  if (!implPromise) {
    implPromise = import('./bibliografia2026Impl.js').then((mod) => {
      realImpl = mod;
      mod.configureBibliografia2026(pendingDeps);
    });
  }
  return implPromise;
}

export function configureBibliografia2026(options = {}) {
  pendingDeps = { ...pendingDeps, ...options };
  // Si el módulo real ya está cargado (poco probable en el arranque, pero
  // por si se vuelve a llamar configure más adelante), le pasamos los deps
  // actualizados directamente.
  if (realImpl) realImpl.configureBibliografia2026(pendingDeps);
}

export async function abrirBibliografia2026() {
  await ensureImpl();
  return realImpl.abrirBibliografia2026();
}
