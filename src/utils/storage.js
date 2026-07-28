/*
 * ResiAR — helpers seguros de almacenamiento local.
 * Centraliza localStorage para evitar try/catch repetidos y facilitar
 * cambios futuros de persistencia.
 */

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

export function readText(key, fallback = null) {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const value = storage.getItem(key);
    return value == null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

export function writeText(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, String(value));
    return true;
  } catch (_) {
    return false;
  }
}

export function readJson(key, fallback = null) {
  const raw = readText(key, null);
  if (raw == null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}

export function writeJson(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

export function removeStorage(key) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}
