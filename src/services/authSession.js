import { RESIAR_SESSION_ID_KEY, LEGACY_SESSION_ID_KEYS } from '../utils/storageKeys.js';

async function generarClientFingerprint() {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      String(navigator.hardwareConcurrency || ''),
      String(navigator.deviceMemory || ''),
    ].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('resiarFP:' + components));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function configureAuthSession(deps = {}) {
  let loginInProgress = false;
  let manualLogout = false;
  let _sessionWatchdog = null;
  let _sessionVisibilityHandler = null;

  const TRIAL_AVAILABLE_NOTICE = '🔓 Trial disponible · Para activarlo, entrá a Usuario y tocá “Activar trial”. Tenés 2 días de acceso completo.';
  const TRIAL_AVAILABLE_NOTICE_DURATION_MS = 11000;

  function showTrialAvailableNotice() {
    deps.mostrarToast?.(TRIAL_AVAILABLE_NOTICE, TRIAL_AVAILABLE_NOTICE_DURATION_MS);
  }

  const getSb = () => (typeof deps.getSb === 'function' ? deps.getSb() : window.sb);
  const getCurrentUser = () => (typeof deps.getCurrentUser === 'function' ? deps.getCurrentUser() : null);
  const setCurrentUser = (value) => { if (typeof deps.setCurrentUser === 'function') deps.setCurrentUser(value); };
  const getCurrentProfile = () => (typeof deps.getCurrentProfile === 'function' ? deps.getCurrentProfile() : null);
  const setCurrentProfile = (value) => { if (typeof deps.setCurrentProfile === 'function') deps.setCurrentProfile(value); };
  const setServerAccess = (value) => { if (typeof deps.setServerAccess === 'function') deps.setServerAccess(value); };
  const setServerIsPro = (value) => { if (typeof deps.setServerIsPro === 'function') deps.setServerIsPro(!!value); };
  const resetServerAccess = () => {
    if (typeof deps.resetServerAccess === 'function') deps.resetServerAccess();
    else { setServerAccess(null); setServerIsPro(false); }
  };

  const safeCall = (fn, fallback) => {
    try { return typeof fn === 'function' ? fn() : fallback; } catch (_) { return fallback; }
  };

  const initialLandingHtml = (() => {
    try {
      window.__resiarInitialLandingHTML = window.__resiarInitialLandingHTML || (document.getElementById('preguntaBox') ? document.getElementById('preguntaBox').innerHTML : '');
      return window.__resiarInitialLandingHTML || '';
    } catch (_) {
      return '';
    }
  })();

  function resiarForcePublicLandingStateFallback() {
    if (typeof deps.forcePublicLandingFallback === 'function') return deps.forcePublicLandingFallback();
    try {
      if (!document.body) return;
      document.body.dataset.resiarView = 'landing';
      document.body.classList.add('resiar-public-landing', 'sb-collapsed');
      document.body.classList.remove('resiar-user-authenticated', 'resiar-in-simulator', 'resiar-config-home', 'resiar-exam-ended');
    } catch(_) {}
  }

  function resiarShowPublicLandingAfterLogout() {
    if (typeof deps.restorePublicLandingAfterLogout === 'function') {
      return deps.restorePublicLandingAfterLogout({ fallbackHtml: initialLandingHtml });
    }
    resiarForcePublicLandingStateFallback();
  }

  async function initAuth() {
    const sb = getSb();

    if (!sb || !sb.auth) {
      console.warn('[ResiAR] Supabase Auth no está disponible al iniciar. Se mantiene la landing pública.');
      resiarForcePublicLandingStateFallback();
      return;
    }

    try {
      const sessionResult = typeof window.safeSupabaseSession === 'function'
        ? await window.safeSupabaseSession({ fallbackData: { session: null } })
        : await (async function fallbackGetSession() {
            try {
              const directResult = await sb.auth.getSession();
              return { ok: true, data: directResult?.data || { session: null } };
            } catch (error) {
              return { ok: false, data: { session: null }, error };
            }
          })();

      const session = sessionResult?.data?.session || null;

      if (session?.user) {
        await onLogin(session.user);
      } else if (sessionResult && sessionResult.ok === false) {
        console.warn('[ResiAR] No se pudo verificar la sesión inicial:', sessionResult.message || sessionResult.error);
        resiarForcePublicLandingStateFallback();
      }
    } catch (error) {
      console.warn('[ResiAR] Error durante initAuth:', error);
      resiarForcePublicLandingStateFallback();
    }

    try {
      sb.auth.onAuthStateChange(async (event, session) => {
        const currentUser = getCurrentUser();

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          if (!currentUser || currentUser.id !== session.user.id) {
            await onLogin(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          if (!manualLogout) onLogout();
          else manualLogout = false;
        } else if (event === 'TOKEN_REFRESH_FAILED') {
          console.warn('Token refresh failed — limpiando sesión');
          setCurrentUser(null);
          setCurrentProfile(null);
          resetServerAccess();
          loginInProgress = false;
          renderUserUI();
        }
      });
    } catch (error) {
      console.warn('[ResiAR] No se pudo registrar onAuthStateChange:', error);
    }
  }

  async function onLogin(user) {
    const sb = getSb();
    const currentUser = getCurrentUser();

    if (loginInProgress || currentUser?.id === user.id) return;
    loginInProgress = true;
    setCurrentUser(user);

    try {
      let { data: profile, error } = await sb.from('profiles')
        .select('*').eq('id', user.id).maybeSingle();

      if (error) throw new Error('Error al cargar perfil: ' + error.message);

      if (!profile) {
        const username = (user.user_metadata?.full_name || user.email?.split('@')[0] || 'usuario')
          .replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 20);
        const { data: _sd } = await sb.auth.getSession();
        const session = _sd?.session ?? null;
        if (!session) throw new Error('No se pudo obtener la sesión para crear el perfil');
        const clientFingerprint = await generarClientFingerprint();
        const res = await fetch(deps.getEdgeVerifyUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token
          },
          body: JSON.stringify({
            newUser: true,
            username,
            avatar_url: typeof deps.resiarPickUserAvatarUrl === 'function' ? deps.resiarPickUserAvatarUrl(user) || null : null,
            clientFingerprint
          })
        });
        if (!res.ok) throw new Error('Error al crear perfil en servidor');
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const { data: createdProfile } = await sb.from('profiles').select('*').eq('id', user.id).single();
        setCurrentProfile(createdProfile);

        if (json.sessionId) {
          deps.writeText?.(RESIAR_SESSION_ID_KEY, json.sessionId);
          try { await sb.rpc('register_session', { p_token: json.sessionId }); } catch(_) {}
        }

        const acceso = json.acceso;
        renderUserUI();
        cerrarAuth();
        deps.cerrarLoginReq?.();

        if (['admin','pro','trial','trial_activo','trial_limitado'].includes(acceso)) {
          await deps.cargarPreguntas?.();
          iniciarVerificacionSesion();
          deps.activarPublicidadTrial?.();
          if (acceso === 'trial_activo') deps.mostrarToast?.('🎉 Bienvenido · Trial Premium activo por 2 días completos');
          if (acceso === 'trial') showTrialAvailableNotice();
        } else {
          if (json.razon) deps.mostrarToast?.('🚫 ' + json.razon, 8000);
          deps.mostrarPantallaBloqueo?.(acceso);
        }
        return;
      }

      setCurrentProfile(profile);

      const { acceso } = await deps.verificarAccesoServidor();

      renderUserUI();
      cerrarAuth();
      deps.cerrarLoginReq?.();
      deps.checkAdminReportesBtn?.();

      if (acceso === 'admin' || acceso === 'pro') {
        await deps.cargarPreguntas?.();
        iniciarVerificacionSesion();
        deps.activarPublicidadTrial?.();
      } else if (acceso === 'trial') {
        await deps.cargarPreguntas?.();
        iniciarVerificacionSesion();
        deps.activarPublicidadTrial?.();
        deps.filtrarPreguntasParaTrial?.();
        showTrialAvailableNotice();
      } else if (acceso === 'trial_activo') {
        await deps.cargarPreguntas?.();
        iniciarVerificacionSesion();
        deps.activarPublicidadTrial?.();
        const currentProfile = getCurrentProfile();
        const expira = currentProfile?.plan_expira_at;
        const diasRestantes = expira ? Math.ceil((new Date(expira) - new Date()) / (1000 * 60 * 60 * 24)) : 2;
        deps.mostrarToast?.('🎉 Trial activo · Acceso completo por ' + Math.max(1, diasRestantes) + ' día' + (diasRestantes > 1 ? 's' : '') + ' más');
      } else if (acceso === 'trial_limitado') {
        await deps.cargarPreguntas?.();
        iniciarVerificacionSesion();
        deps.activarPublicidadTrial?.();
        deps.filtrarPreguntasParaTrial?.();
        deps.mostrarToast?.('⏱️ Tu trial venció · Seguís con acceso limitado. Entrá a Usuario para suscribirte y recuperar el acceso completo.');
        deps.activarModoTrialLimitado?.();
      } else if (acceso === 'expirado') {
        deps.mostrarPantallaBloqueo?.('pro_expirado');
        deps.mostrarToast?.('⚠️ Tu plan Pro venció. Renovalo para seguir practicando.');
      } else {
        deps.mostrarToast?.('🔒 Tu cuenta no tiene acceso activo. Escribinos a resiar.soporte@gmail.com si creés que es un error.', 8000);
        deps.mostrarPantallaBloqueo?.(acceso);
      }
    } catch(e) {
      deps.mostrarToast?.('❌ ' + e.message);
      setCurrentUser(null);
      setCurrentProfile(null);
      resetServerAccess();
      renderUserUI();
    } finally {
      loginInProgress = false;
    }
  }

  function onLogout() {
    if (_sessionWatchdog) {
      clearInterval(_sessionWatchdog);
      _sessionWatchdog = null;
    }
    if (_sessionVisibilityHandler) {
      document.removeEventListener('visibilitychange', _sessionVisibilityHandler);
      _sessionVisibilityHandler = null;
    }

    deps.removeStorage?.(RESIAR_SESSION_ID_KEY);
    LEGACY_SESSION_ID_KEYS.forEach((key) => deps.removeStorage?.(key));

    setCurrentUser(null);
    setCurrentProfile(null);
    deps.socialStopRealtime?.();
    try {
      if (deps.socialState) {
        deps.socialState.loaded = false;
        deps.socialState.friends = [];
        deps.socialState.incoming = [];
        deps.socialState.outgoing = [];
        deps.socialState.profiles = {};
      }
    } catch (_) {}
    try { deps.questionChatDisconnect?.(); } catch (_) {}
    resetServerAccess();
    loginInProgress = false;

    deps.resetExamStateAfterLogout?.();

    if (typeof resiarShowPublicLandingAfterLogout === 'function') {
      resiarShowPublicLandingAfterLogout();
    } else {
      const box = document.getElementById('preguntaBox');
      if (box && initialLandingHtml) box.innerHTML = initialLandingHtml;
      else if (box) box.innerHTML = '<div class="welcome-simple"><div class="wicon">🧠</div><div class="wtitle">Sesión cerrada</div><div class="wsub">Volvé a iniciar sesión cuando quieras practicar.</div></div>';
    }

    renderUserUI();
  }

  function renderUserUI() {
    const currentUser = getCurrentUser();
    const currentProfile = getCurrentProfile();
    const authSec = document.getElementById('authSection');
    const userSec = document.getElementById('userSection');
    const sideBar = document.querySelector('aside');
    if (!authSec || !userSec) return;

    if (currentUser) {
      authSec.style.display = 'none';
      userSec.style.display = 'block';

      if (typeof window.resiarSyncViewState === 'function') {
        window.resiarSyncViewState();
      } else {
        const publicLandingVisible = (() => {
          try {
            if (window.resiarIsPublicLandingVisible) return !!window.resiarIsPublicLandingVisible();
            const box = document.getElementById('preguntaBox');
            return !!(box && box.querySelector('#welcome:not(.home-sim), .lp-nav, .lp-hero'));
          } catch(_) { return false; }
        })();
        if (sideBar && !publicLandingVisible) sideBar.classList.add('visible');
        else if (sideBar) sideBar.classList.remove('visible');
      }

      const chip = document.getElementById('userAvatarChip');
      const nameChip = document.getElementById('userNameChip');
      const planChip = document.getElementById('userPlanChip');

      if (chip && typeof deps.resiarAvatarHtml === 'function') {
        chip.outerHTML = deps.resiarAvatarHtml({
          username: currentProfile?.username || currentUser?.email?.split('@')?.[0] || 'Usuario',
          avatar_url: currentProfile?.avatar_url || (typeof deps.resiarPickUserAvatarUrl === 'function' ? deps.resiarPickUserAvatarUrl(currentUser) : null)
        }, 'sb-chip-avatar', 'div');
      }

      if (nameChip) {
        nameChip.textContent = currentProfile?.username || currentUser.email?.split('@')[0] || 'Usuario';
      }

      if (planChip && currentProfile) {
        const plan = currentProfile.plan || 'free';
        planChip.className = 'sb-chip-plan';
        let label = 'Activo';
        if (plan === 'pro' || plan === 'admin') {
          planChip.classList.add('plan-pro');
          label = plan === 'admin' ? 'Admin' : 'Pro';
        } else if (plan === 'trial_activo') {
          planChip.classList.add('plan-trial');
          const expT = currentProfile.plan_expira_at ? new Date(currentProfile.plan_expira_at) : null;
          const diasT = expT ? Math.max(0, Math.ceil((expT - new Date()) / 86400000)) : 2;
          label = `Trial · ${diasT}d`;
        } else if (plan === 'trial_limitado') {
          planChip.classList.add('plan-trial');
          label = 'Trial limitado';
        } else if (plan === 'trial') {
          planChip.classList.add('plan-trial');
          label = 'Trial';
        }
        planChip.textContent = label;
      }

      try { deps.sbUpdateCuentaSummary?.(nameChip?.textContent || ''); } catch (_) {}
      deps.socialStartRealtime?.();
      try {
        if (deps.socialState) deps.socialState.loaded = false;
      } catch (_) {}
      deps.cargarSocialSidebar?.(true);
      try { deps.resiarEnsureModernConfigHome?.('renderUserUI'); } catch (_) {}
    } else {
      authSec.style.display = 'block';
      userSec.style.display = 'none';
      if (typeof window.resiarSyncViewState === 'function') window.resiarSyncViewState();
      else if (sideBar) sideBar.classList.remove('visible');
      try { deps.sbUpdateCuentaSummary?.(''); } catch (_) {}
      deps.socialStopRealtime?.();
      try {
        if (deps.socialState) deps.socialState.loaded = false;
      } catch (_) {}
      deps.cargarSocialSidebar?.(false);
    }

    try { deps.renderUserUIAfterSync?.(); } catch (_) {}
  }

  function iniciarVerificacionSesion() {
    const sb = getSb();

    if (_sessionWatchdog) clearInterval(_sessionWatchdog);
    if (_sessionVisibilityHandler) {
      document.removeEventListener('visibilitychange', _sessionVisibilityHandler);
    }

    const userId = getCurrentUser()?.id;
    if (!userId) return;

    async function verificarSesionAhora() {
      const currentUser = getCurrentUser();
      if (!currentUser || currentUser.id !== userId) {
        clearInterval(_sessionWatchdog);
        document.removeEventListener('visibilitychange', _sessionVisibilityHandler);
        return;
      }

      try {
        let sessionId = deps.readText?.(RESIAR_SESSION_ID_KEY, null);
        if (!sessionId) {
          for (const key of LEGACY_SESSION_ID_KEYS) {
            const legacy = deps.readText?.(key, null);
            if (legacy) {
              sessionId = legacy;
              deps.writeText?.(RESIAR_SESSION_ID_KEY, legacy);
              break;
            }
          }
        }
        if (!sessionId) {
          try {
            const refreshed = typeof deps.verificarAccesoServidor === 'function'
              ? await deps.verificarAccesoServidor()
              : null;
            if (refreshed?.sessionId) sessionId = refreshed.sessionId;
          } catch (_) {}
        }
        if (!sessionId) return;

        const { data: valid, error } = await sb.rpc('validate_session', { p_token: sessionId });
        if (error) {
          const { data } = await sb.from('profiles').select('active_session_id').eq('id', userId).single();
          if (data?.active_session_id && data.active_session_id !== sessionId) {
            clearInterval(_sessionWatchdog);
            document.removeEventListener('visibilitychange', _sessionVisibilityHandler);
            deps.mostrarToast?.('⚠️ Tu cuenta fue iniciada en otro dispositivo. Cerrando sesión...');
            setTimeout(async () => { await sb.auth.signOut(); onLogout(); }, 3000);
          }
          return;
        }
        if (valid === false) {
          clearInterval(_sessionWatchdog);
          document.removeEventListener('visibilitychange', _sessionVisibilityHandler);
          deps.mostrarToast?.('⚠️ Tu cuenta fue iniciada en otro dispositivo. Cerrando sesión...');
          setTimeout(async () => { await sb.auth.signOut(); onLogout(); }, 3000);
        }
      } catch(e) {}
    }

    _sessionWatchdog = setInterval(verificarSesionAhora, 10000);
    _sessionVisibilityHandler = () => {
      if (document.visibilityState === 'visible') verificarSesionAhora();
    };
    document.addEventListener('visibilitychange', _sessionVisibilityHandler);
    setTimeout(verificarSesionAhora, 1000);
  }

  async function logout() {
    manualLogout = true;
    deps.clearReportesEnviados?.();
    const wrap = document.getElementById('btnAdminReportesWrap');
    if (wrap) wrap.style.display = 'none';

    const sb = getSb();
    try { await sb.rpc('logout_session'); } catch(_) {}
    onLogout();
    deps.mostrarToast?.('👋 Sesión cerrada');
    await sb.auth.signOut();
    setTimeout(() => { manualLogout = false; }, 2000);
  }

  function abrirAuth() {
    document.getElementById('modalAuth')?.classList.add('vis');
  }

  function cerrarAuth() {
    document.getElementById('modalAuth')?.classList.remove('vis');
  }

  function showAuthErr(msg) {
    const el = document.getElementById('authErr');
    if (el) {
      el.textContent = msg;
      el.classList.toggle('vis', !!msg);
    }
  }

  return {
    initAuth,
    onLogin,
    onLogout,
    renderUserUI,
    iniciarVerificacionSesion,
    logout,
    abrirAuth,
    cerrarAuth,
    showAuthErr,
    resiarForcePublicLandingStateFallback,
    resiarShowPublicLandingAfterLogout
  };
}
