export const RESIAR_PLAN_ACCESS = Object.freeze({
  SIN_ACCESO: 'sin_acceso',
  TRIAL: 'trial',
  TRIAL_ACTIVO: 'trial_activo',
  TRIAL_LIMITADO: 'trial_limitado',
  PRO: 'pro',
  ADMIN: 'admin'
});

export function normalizeResiarPlan(value) {
  return String(value || '').trim().toLowerCase();
}

export function planHasFullQuestionAccess(plan) {
  const p = normalizeResiarPlan(plan);
  return p === RESIAR_PLAN_ACCESS.ADMIN || p === RESIAR_PLAN_ACCESS.PRO || p === RESIAR_PLAN_ACCESS.TRIAL_ACTIVO;
}

export function planUsesTrialQuestionCache(plan) {
  const p = normalizeResiarPlan(plan);
  return p === RESIAR_PLAN_ACCESS.TRIAL || p === RESIAR_PLAN_ACCESS.TRIAL_LIMITADO;
}

export function planHasNoQuestionAccess(plan) {
  const p = normalizeResiarPlan(plan);
  return !p || p === RESIAR_PLAN_ACCESS.SIN_ACCESO;
}

export function planAccessDescription(plan) {
  const p = normalizeResiarPlan(plan);
  if (p === RESIAR_PLAN_ACCESS.ADMIN) return 'Acceso total administrador.';
  if (p === RESIAR_PLAN_ACCESS.PRO) return 'Acceso completo mientras el plan esté activo.';
  if (p === RESIAR_PLAN_ACCESS.TRIAL_ACTIVO) return 'Acceso completo mientras el trial esté activo.';
  if (p === RESIAR_PLAN_ACCESS.TRIAL || p === RESIAR_PLAN_ACCESS.TRIAL_LIMITADO) {
    return 'Acceso limitado: EU completo + preguntas incluidas en preguntas_trial_cache para el resto de exámenes.';
  }
  return 'Sin acceso a preguntas.';
}

export function configureTrialAccess(options = {}) {
  const getPreguntas = typeof options.getPreguntas === 'function' ? options.getPreguntas : () => [];
  const buildNumeroMap = typeof options.buildNumeroMap === 'function' ? options.buildNumeroMap : () => {};
  const cargarFiltros = typeof options.cargarFiltros === 'function' ? options.cargarFiltros : () => {};
  const cargarChecklist = typeof options.cargarChecklist === 'function' ? options.cargarChecklist : () => {};
  const getServerAccess = typeof options.getServerAccess === 'function' ? options.getServerAccess : () => null;
  const setServerAccess = typeof options.setServerAccess === 'function' ? options.setServerAccess : () => {};
  const getCurrentProfile = typeof options.getCurrentProfile === 'function' ? options.getCurrentProfile : () => null;
  const setCurrentProfile = typeof options.setCurrentProfile === 'function' ? options.setCurrentProfile : () => {};
  const getCurrentUser = typeof options.getCurrentUser === 'function' ? options.getCurrentUser : () => null;
  const getSupabase = typeof options.getSupabase === 'function' ? options.getSupabase : () => null;
  const renderUserUI = typeof options.renderUserUI === 'function' ? options.renderUserUI : () => {};
  const renderPlanStatus = typeof options.renderPlanStatus === 'function' ? options.renderPlanStatus : () => {};
  const cargarPreguntas = typeof options.cargarPreguntas === 'function' ? options.cargarPreguntas : async () => {};
  const mostrarToast = typeof options.mostrarToast === 'function' ? options.mostrarToast : () => {};

  const TRIAL_DIAS_FULL = 2;

  function currentPlan() {
    return normalizeResiarPlan(getServerAccess() || getCurrentProfile()?.plan || '');
  }

  function shouldDebugPlanAccess() {
    return Boolean(window?.RESIAR_DEBUG_PLAN_ACCESS);
  }

  function summarizeVisibleQuestions(list) {
    const porExamen = {};
    (Array.isArray(list) ? list : []).forEach(p => {
      const key = String(p?.examen || p?.tipo || 'Sin examen');
      porExamen[key] = (porExamen[key] || 0) + 1;
    });
    return porExamen;
  }

  function filtrarPreguntasParaTrial() {
    const preguntas = getPreguntas();
    if (!Array.isArray(preguntas) || !preguntas.length) return;

    // Fuente de verdad: RLS de Supabase en public.preguntas mediante
    // pregunta_visible_para_usuario(examen, id).
    // No se aplica ningún subconjunto local: para trial/trial_limitado Supabase
    // ya devuelve EU completo + preguntas_trial_cache para el resto.
    buildNumeroMap(preguntas);
    cargarFiltros();
    cargarChecklist();

    if (shouldDebugPlanAccess()) {
      const plan = currentPlan();
      const porExamen = summarizeVisibleQuestions(preguntas);
      console.log('[ResiAR Plan Access] Plan:', plan || '(sin plan)');
      console.log('[ResiAR Plan Access] Regla:', planAccessDescription(plan));
      console.log('[ResiAR Plan Access] Preguntas visibles recibidas desde Supabase/RLS:', porExamen);
      console.log(`[ResiAR Plan Access] Total visible: ${preguntas.length} preguntas`);
    }
  }

  function estaEnTrialLimitado() {
    return currentPlan() === RESIAR_PLAN_ACCESS.TRIAL_LIMITADO;
  }

  function activarModoTrialLimitado() {
    const banner = document.getElementById('upgradeBanner');
    if (banner) banner.classList.add('vis');

    const btnSmart  = document.getElementById('btnSmartExam');
    const btnRepaso = document.getElementById('btnRepaso');

    if (btnSmart) {
      btnSmart.disabled = true;
      btnSmart.classList.add('btn-pro-locked');
      btnSmart.title = '🔒 Disponible en el plan Pro';
    }
    if (btnRepaso) {
      btnRepaso.disabled = true;
      btnRepaso.classList.add('btn-pro-locked');
      btnRepaso.title = '🔒 Disponible en el plan Pro';
    }
  }

  function activarPublicidadTrial() {
    const plan = currentPlan();
    const esTrial = [RESIAR_PLAN_ACCESS.TRIAL, RESIAR_PLAN_ACCESS.TRIAL_ACTIVO, RESIAR_PLAN_ACCESS.TRIAL_LIMITADO].includes(plan);
    document.getElementById('adSidebar')?.classList.toggle('vis', esTrial);
    document.getElementById('adInterstitial')?.classList.toggle('vis', esTrial);
  }

  async function activarTrialPremium() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      mostrarToast('⚠ Necesitás iniciar sesión primero.');
      return;
    }

    const btns = document.querySelectorAll('[data-action="activate-trial-premium"]');
    btns.forEach(b => { b.disabled = true; b.textContent = 'Activando…'; });

    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase no está inicializado.');

      const { data: rpcData, error } = await sb.rpc('activar_trial');
      if (error) throw error;
      if (rpcData?.ok === false) throw new Error(rpcData.error || 'No se pudo activar el trial');

      const { data: perfil } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
      if (perfil) {
        setCurrentProfile(perfil);
        setServerAccess(perfil.plan);
      }

      renderUserUI();
      renderPlanStatus();

      mostrarToast('🎉 Trial activado · Cargando banco completo…');
      await cargarPreguntas();
      mostrarToast('✅ ¡Listo! Ahora tenés acceso a todas las preguntas por 2 días');
    } catch (e) {
      console.error('activarTrialPremium:', e);
      mostrarToast('⛔ No se pudo activar el trial: ' + (e?.message || 'error desconocido'));
      btns.forEach(b => { b.disabled = false; b.textContent = 'Activar cuando quiera →'; });
    }
  }

  return {
    TRIAL_DIAS_FULL,
    RESIAR_PLAN_ACCESS,
    normalizeResiarPlan,
    planHasFullQuestionAccess,
    planUsesTrialQuestionCache,
    planHasNoQuestionAccess,
    planAccessDescription,
    filtrarPreguntasParaTrial,
    estaEnTrialLimitado,
    activarModoTrialLimitado,
    activarPublicidadTrial,
    activarTrialPremium
  };
}
