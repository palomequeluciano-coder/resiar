import { RESIAR_SESSION_ID_KEY, LEGACY_SESSION_ID_KEYS } from '../utils/storageKeys.js';
let accessDeps = {
  getSb: () => window.sb || null,
  getVerifyUrl: () => '',
  writeText: () => {},
  readText: () => null,
  removeStorage: () => false,
  getCurrentProfile: () => null,
  getServerAccess: () => null,
  setServerAccess: () => {},
  setServerIsPro: () => {}
};

export function configureAccess(deps = {}) {
  accessDeps = { ...accessDeps, ...deps };
  return {
    canUseCustomSounds,
    getSoundPlanLabel,
    verificarAccesoServidor
  };
}

function getServerAccess() {
  return typeof accessDeps.getServerAccess === 'function' ? accessDeps.getServerAccess() : null;
}

export function canUseCustomSounds() {
  return ['admin', 'pro', 'trial_activo'].includes(getServerAccess());
}

export function getSoundPlanLabel() {
  const access = getServerAccess();
  if (access === 'admin') return 'ADMIN';
  if (access === 'pro') return 'PRO';
  if (access === 'trial_activo') return 'TRIAL+';
  if (access === 'trial') return 'TRIAL';
  if (access === 'trial_limitado') return 'LIMITADO';
  return 'SIN ACCESO';
}

function isLocalDevOrigin() {
  try {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  } catch (_) {
    return false;
  }
}

function accessFromProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const plan = String(profile.plan || '').trim();
  const now = Date.now();
  const expRaw = profile.plan_expira_at || profile.current_period_end || null;
  const expMs = expRaw ? new Date(expRaw).getTime() : null;
  const vigente = !expMs || Number.isNaN(expMs) || expMs > now;

  if (plan === 'admin') return { acceso: 'admin', esPro: true };
  if (plan === 'pro') return vigente
    ? { acceso: 'pro', esPro: true }
    : { acceso: 'expirado', esPro: false };
  if (plan === 'trial_activo') return vigente
    ? { acceso: 'trial_activo', esPro: false }
    : { acceso: 'trial_limitado', esPro: false };
  if (plan === 'trial' || plan === 'trial_limitado') return { acceso: plan, esPro: false };
  return null;
}

function maybeLocalProfileFallback(reason, original = null) {
  if (!isLocalDevOrigin()) return null;
  const profile = typeof accessDeps.getCurrentProfile === 'function'
    ? accessDeps.getCurrentProfile()
    : null;
  const fallback = accessFromProfile(profile);
  if (!fallback || fallback.acceso === 'bloqueado') return null;
  accessDeps.setServerAccess?.(fallback.acceso);
  accessDeps.setServerIsPro?.(!!fallback.esPro);
  try {
    window.__resiarLastAccessFallback = {
      reason: String(reason || ''),
      original,
      fallback,
      profilePlan: profile?.plan || null,
      at: new Date().toISOString()
    };
  } catch (_) {}
  console.warn('[ResiAR] Usando fallback local de acceso para desarrollo:', reason, fallback);
  return fallback;
}

// Red de contención por FALLA DE CONECTIVIDAD (no por decisión del servidor).
// Se usa únicamente cuando el round-trip a verificar-acceso no pudo completarse
// (sin sesión hidratada todavía, fetch caído, timeout de red móvil, etc.).
// Nunca se usa cuando el servidor SÍ respondió con una decisión explícita de
// bloqueo (esa rama sigue gobernada solo por adminFallback/maybeLocalProfileFallback
// más arriba, para no romper la regla comercial de "el servidor manda").
// El plan que se repite acá ya estaba guardado en `profiles` (leído con RLS,
// el cliente no lo elige), así que como máximo se repite el último acceso que
// el propio servidor ya le había otorgado a esta cuenta.
function connectivityFallback(reason, error) {
  const profile = typeof accessDeps.getCurrentProfile === 'function'
    ? accessDeps.getCurrentProfile()
    : null;
  const fallback = accessFromProfile(profile);
  if (!fallback || !accessIsUsable(fallback.acceso)) return null;
  accessDeps.setServerAccess?.(fallback.acceso);
  accessDeps.setServerIsPro?.(!!fallback.esPro);
  try {
    window.__resiarLastAccessFallback = {
      reason: String(reason || ''),
      error: error?.message || null,
      fallback,
      profilePlan: profile?.plan || null,
      at: new Date().toISOString()
    };
  } catch (_) {}
  console.warn('[ResiAR] Verificación de acceso falló por conectividad; se mantiene el último plan conocido de profiles:', reason, fallback);
  return fallback;
}

// Reintenta obtener la sesión de Supabase antes de asumir "sin sesión".
// En mobile, justo después del redirect de OAuth (o al volver de background),
// el SDK puede tardar en hidratar la sesión desde storage. Un solo fallo acá
// no debería alcanzar para mostrar "Acceso restringido".
async function getSessionConReintento(sb) {
  let { data } = await sb.auth.getSession();
  if (data?.session?.access_token) return data.session;

  try { await sb.auth.refreshSession(); } catch (_) {}
  await new Promise((resolve) => setTimeout(resolve, 400));

  ({ data } = await sb.auth.getSession());
  return data?.session || null;
}

// Reintenta el fetch una vez si falla por red (no si el servidor respondió
// con un HTTP de error, eso ya es una respuesta real y no se reintenta acá).
async function fetchConReintento(url, options) {
  try {
    return await fetch(url, options);
  } catch (networkError) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return fetch(url, options);
  }
}


function removeLocalAccessSessionIds() {
  try { accessDeps.removeStorage?.(RESIAR_SESSION_ID_KEY); } catch (_) {}
  try {
    for (const key of LEGACY_SESSION_ID_KEYS) accessDeps.removeStorage?.(key);
  } catch (_) {}
}

function isBlockedAccess(value) {
  return value === 'bloqueado' || value === 'expirado' || value === 'sin_acceso' || value === 'sin acceso';
}

function accessIsUsable(value) {
  return ['admin', 'pro', 'trial', 'trial_activo', 'trial_limitado'].includes(String(value || '').trim());
}

function accessIsAdminFromProfile() {
  const profile = typeof accessDeps.getCurrentProfile === 'function'
    ? accessDeps.getCurrentProfile()
    : null;
  const fromProfile = accessFromProfile(profile);
  return fromProfile?.acceso === 'admin' ? fromProfile : null;
}

export async function verificarAccesoServidor() {
  const sb = typeof accessDeps.getSb === 'function' ? accessDeps.getSb() : null;
  const verifyUrl = typeof accessDeps.getVerifyUrl === 'function' ? accessDeps.getVerifyUrl() : '';

  try {
    if (!sb || !sb.auth) throw new Error('Supabase Auth no está disponible');
    if (!verifyUrl) throw new Error('URL de verificación no configurada');

    const session = await getSessionConReintento(sb);
    if (!session?.access_token) throw new Error('Sin sesión');

    const currentSessionId = typeof accessDeps.readText === 'function'
      ? accessDeps.readText(RESIAR_SESSION_ID_KEY, null)
      : null;

    async function callVerify(sessionId, meta = {}) {
      const res = await fetchConReintento(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          sessionId: sessionId || null,
          clientRecovery: meta.clientRecovery || null
        })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }

    let json = await callVerify(currentSessionId || null);

    // v120 — recuperación de acceso móvil/cacheado.
    // Si el navegador quedó con un session_id local viejo de una etapa "bloqueada"
    // y luego la cuenta fue promovida, la Edge puede seguir recibiendo ese token
    // viejo y devolver "sin acceso". Incógnito funciona porque no tiene ese token.
    // La corrección estructural es NO persistir ese bloqueo: se limpia el token
    // local y se reintenta una vez contra el servidor sin session_id cliente.
    if (json && isBlockedAccess(json.acceso) && currentSessionId) {
      const profile = typeof accessDeps.getCurrentProfile === 'function'
        ? accessDeps.getCurrentProfile()
        : null;
      const profileAccess = accessFromProfile(profile);

      if (profileAccess && accessIsUsable(profileAccess.acceso)) {
        removeLocalAccessSessionIds();
        try {
          const retryJson = await callVerify(null, { clientRecovery: 'stale_local_session_id' });
          if (retryJson && !isBlockedAccess(retryJson.acceso)) {
            json = { ...retryJson, recoveredFromStaleLocalSession: true };
          } else if (profileAccess.acceso === 'admin') {
            // Fallback acotado: solo admin autenticado y leído desde profiles.
            // No se usa para Pro/trial para no saltar la regla comercial del servidor.
            json = { ...(retryJson || json), ...profileAccess, adminLocalRecovery: true };
          }
        } catch (retryError) {
          if (profileAccess.acceso === 'admin') {
            json = { ...json, ...profileAccess, adminLocalRecovery: true, retryError: retryError?.message || String(retryError) };
          }
        }
      }
    }

    // En local, Supabase/Edge puede quedar desfasado por redirect, CORS o sesión
    // recién creada. Si el perfil propio ya cargado demuestra un plan válido, no
    // bloqueamos el entorno de prueba local. En producción el servidor sigue
    // siendo la única fuente de verdad, salvo la recuperación admin acotada de v120.
    if (json && isBlockedAccess(json.acceso)) {
      const adminFallback = accessIsAdminFromProfile();
      if (adminFallback) {
        removeLocalAccessSessionIds();
        json = { ...json, ...adminFallback, adminLocalRecovery: true };
      } else {
        const localFallback = maybeLocalProfileFallback('edge_returned_' + json.acceso, json);
        if (localFallback) return { ...json, ...localFallback, localFallback: true };
      }
    }

    accessDeps.setServerAccess?.(json.acceso);
    accessDeps.setServerIsPro?.(!!json.esPro);

    // El servidor genera y escribe el session_id en la BD.
    // El cliente solo lo recibe y lo guarda — nunca lo elige.
    if (json.sessionId) {
      accessDeps.writeText?.(RESIAR_SESSION_ID_KEY, json.sessionId);
      // Registrar sesión única en DB para protección anti cuenta compartida.
      try { await sb.rpc('register_session', { p_token: json.sessionId }); } catch (_) {}
    }

    try {
      window.__resiarLastAccessCheck = { ok: true, json, at: new Date().toISOString() };
    } catch (_) {}

    return json;
  } catch (error) {
    console.warn('verificarAccesoServidor error:', error.message);

    const adminFallback = accessIsAdminFromProfile();
    if (adminFallback) {
      removeLocalAccessSessionIds();
      accessDeps.setServerAccess?.(adminFallback.acceso);
      accessDeps.setServerIsPro?.(!!adminFallback.esPro);
      return { ...adminFallback, adminLocalRecovery: true, error: error.message };
    }

    const localFallback = maybeLocalProfileFallback('edge_fetch_failed: ' + error.message);
    if (localFallback) return { ...localFallback, localFallback: true };

    // No es una decisión del servidor: no pudimos completar la verificación
    // (sin sesión hidratada, red móvil caída, etc.). No mostramos "Acceso
    // restringido" a una cuenta que en `profiles` sigue teniendo un plan válido.
    const fallback = connectivityFallback('edge_fetch_failed: ' + error.message, error);
    if (fallback) {
      try {
        window.__resiarLastAccessCheck = { ok: false, error: error.message, connectivityFallback: true, at: new Date().toISOString() };
      } catch (_) {}
      return { ...fallback, connectivityFallback: true, error: error.message };
    }

    accessDeps.setServerAccess?.('bloqueado');
    accessDeps.setServerIsPro?.(false);
    try {
      window.__resiarLastAccessCheck = { ok: false, error: error.message, at: new Date().toISOString() };
    } catch (_) {}
    return { acceso: 'bloqueado', esPro: false };
  }
}
