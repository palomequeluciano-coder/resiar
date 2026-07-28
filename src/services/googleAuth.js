/*
 * ResiAR — autenticación Google/Supabase.
 *
 * Este módulo centraliza la URL de retorno y la acción OAuth. Mantiene el
 * comportamiento del monolito, pero deja la lógica fuera de main.js.
 */

let deps = {
  mostrarToast(message) {
    console.warn(message);
  }
};

export function configureGoogleAuth(options = {}) {
  deps = {
    ...deps,
    ...options
  };
}

export function getResiarAuthRedirectTo() {
  const explicitRedirect = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_REDIRECT_URL)
    ? String(import.meta.env.VITE_SUPABASE_REDIRECT_URL).trim()
    : '';
  if (explicitRedirect) {
    try { window.__resiarAuthRedirectTo = explicitRedirect; } catch (_) {}
    return explicitRedirect;
  }

  // La URL de OAuth debe coincidir exactamente con la URL local/web desde la que
  // se abrió la app. No forzamos /examenes-medicos/ en localhost porque Vite
  // puede estar sirviendo la app en / o en /examenes-medicos/ según el modo de
  // prueba. Supabase ya permite ambas en Redirect URLs.
  const current = new URL(window.location.href);
  current.search = '';
  current.hash = '';

  if (/\/index\.html$/i.test(current.pathname)) {
    current.pathname = current.pathname.replace(/\/index\.html$/i, '/');
  }

  const redirectTo = current.toString();
  try { window.__resiarAuthRedirectTo = redirectTo; } catch (_) {}
  return redirectTo;
}

function restoreGoogleLoginButton(button) {
  if (!button) return;

  button.disabled = false;
  button.innerHTML = '<svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.59-13.46-8.83l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Continuar con Google';
}

export async function loginGoogle() {
  const btn = document.getElementById('btnGoogleLogin');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Abriendo...';
  }

  try { document.body?.classList.add('resiar-auth-clicking'); } catch (_) {}

  if (!window.sb || !window.sb.auth || typeof window.sb.auth.signInWithOAuth !== 'function') {
    deps.mostrarToast('❌ Supabase no está inicializado. Reintentá en unos segundos.');
    try { document.body?.classList.remove('resiar-auth-clicking'); } catch (_) {}
    restoreGoogleLoginButton(btn);
    return;
  }

  const redirectTo = getResiarAuthRedirectTo();

  const result = window.safeSupabaseCall
    ? await window.safeSupabaseCall(() => window.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      }), { message: 'No se pudo iniciar sesión con Google.' })
    : await window.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });

  const error = result && (result.error || (result.ok === false ? result.raw : null));

  if (error || result?.ok === false) {
    try { document.body?.classList.remove('resiar-auth-clicking'); } catch (_) {}
    deps.mostrarToast('❌ Error: ' + (result.message || error?.message || 'No se pudo iniciar sesión.'));
    restoreGoogleLoginButton(btn);
  }
}

try {
  if (typeof window !== 'undefined') window.getResiarAuthRedirectTo = getResiarAuthRedirectTo;
} catch (_) {}
