// RESIAR — Wrapper liviano de code-splitting para el módulo de Desafíos/Arena.
//
// La implementación real (challengesImpl.js, ~62 KB) solo se importa
// dinámicamente la primera vez que el usuario interactúa de verdad con la
// función de desafíos (abrir, crear, unirse, etc.), no al arrancar la app.
//
// IMPORTANTE: detenerRealtimeDesafio() se llama también desde el flujo de
// "iniciar examen normal" (como limpieza defensiva de cualquier desafío
// activo), lo que la convierte en el path MÁS frecuente que toca este
// módulo. Por eso es la única función que se queda sincrónica y hace un
// no-op si el módulo real todavía no cargó: si nunca se cargó, no puede
// haber ninguna suscripción realtime de desafío activa que cancelar, así
// que no tiene sentido disparar el import solo para no hacer nada.

let implPromise = null;
let realImpl = null;
let pendingDeps = {};
let loaded = false;

function ensureImpl() {
  if (!implPromise) {
    implPromise = import('./challengesImpl.js').then((mod) => {
      realImpl = mod;
      mod.configureChallenges(pendingDeps);
      loaded = true;
    });
  }
  return implPromise;
}

export function configureChallenges(options = {}) {
  pendingDeps = { ...pendingDeps, ...options };
  if (realImpl) realImpl.configureChallenges(pendingDeps);
}

export async function abrirDesafio(...args) {
  await ensureImpl();
  return realImpl.abrirDesafio(...args);
}

export async function switchChallengeTab(...args) {
  await ensureImpl();
  return realImpl.switchChallengeTab(...args);
}

export async function cargarHistorialDesafios(...args) {
  await ensureImpl();
  return realImpl.cargarHistorialDesafios(...args);
}

export async function crearDesafio(...args) {
  await ensureImpl();
  return realImpl.crearDesafio(...args);
}

export async function copiarCodigo(...args) {
  await ensureImpl();
  return realImpl.copiarCodigo(...args);
}

export async function copiarLinkDesafio(...args) {
  await ensureImpl();
  return realImpl.copiarLinkDesafio(...args);
}

export async function unirseDesafio(...args) {
  await ensureImpl();
  return realImpl.unirseDesafio(...args);
}

export async function guardarResultadoDesafio(...args) {
  await ensureImpl();
  return realImpl.guardarResultadoDesafio(...args);
}

export function detenerRealtimeDesafio(...args) {
  if (!loaded) return; // nada que cancelar: nunca se abrió un desafío real
  return realImpl.detenerRealtimeDesafio(...args);
}
