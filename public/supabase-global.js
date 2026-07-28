/*
 * ResiAR — puente global de Supabase.
 *
 * Este archivo mantiene compatibilidad con el HTML monolítico actual:
 * expone SUPA_URL, SUPA_KEY y sb como globales, pero concentra la
 * inicialización en un único lugar para poder migrarla luego a módulos ES.
 */

var SUPA_URL = (window.RESIAR_ENV && window.RESIAR_ENV.SUPABASE_URL) || '';
var SUPA_KEY = (window.RESIAR_ENV && window.RESIAR_ENV.SUPABASE_ANON_KEY) || '';
var RESIAR_SUPABASE_READY = false;
var sb = null;

(function initSupabaseGlobalBridge() {
  var hasMissingEnv =
    !SUPA_URL ||
    !SUPA_KEY ||
    SUPA_URL.indexOf('%VITE_') !== -1 ||
    SUPA_KEY.indexOf('%VITE_') !== -1;

  if (hasMissingEnv) {
    console.warn('[ResiAR] Faltan variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
    window.SUPA_URL = SUPA_URL;
    window.SUPA_KEY = SUPA_KEY;
    window.sb = sb;
    window.RESIAR_SUPABASE_READY = RESIAR_SUPABASE_READY;
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('[ResiAR] El SDK de Supabase no está disponible. Revisá el script CDN.');
    window.SUPA_URL = SUPA_URL;
    window.SUPA_KEY = SUPA_KEY;
    window.sb = sb;
    window.RESIAR_SUPABASE_READY = RESIAR_SUPABASE_READY;
    return;
  }

  sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  });

  RESIAR_SUPABASE_READY = true;

  window.SUPA_URL = SUPA_URL;
  window.SUPA_KEY = SUPA_KEY;
  window.sb = sb;
  window.RESIAR_SUPABASE_READY = RESIAR_SUPABASE_READY;
})();