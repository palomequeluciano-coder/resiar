const DEFAULT_COUNTER_ERROR = 'No se pudieron actualizar los contadores públicos de la landing.';

// Fallback estático sincronizado con Supabase al momento de esta versión.
// La fuente real sigue siendo Supabase; estos valores solo evitan mostrar números viejos
// durante los primeros milisegundos de carga o si la red falla.
const PUBLIC_COUNTER_FALLBACK = Object.freeze({
  questions: 9039,
  specialties: 43,
  registeredUsers: 51
});

function formatQuestionCount(n, { withPlus = true } = {}) {
  const value = Number(n || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const formatted = value >= 1000
    ? Math.floor(value / 1000) + '.' + String(value % 1000).padStart(3, '0')
    : String(value);
  return withPlus ? '+' + formatted : formatted;
}


function formatRegisteredUsersCount(n, { withPlus = false } = {}) {
  const value = Number(n || 0);
  if (!Number.isFinite(value) || value < 0) return '';
  const formatted = value >= 1000
    ? Math.floor(value / 1000) + '.' + String(value % 1000).padStart(3, '0')
    : String(value);
  return withPlus && value > 0 ? '+' + formatted : formatted;
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setTextAll(selector, value) {
  document.querySelectorAll(selector).forEach((el) => { el.textContent = value; });
}

function fallbackSafeCallFactory() {
  return async function fallbackSafeCall(action) {
    try {
      const data = await action();
      return { ok: true, data, error: null };
    } catch (error) {
      return { ok: false, data: null, error };
    }
  };
}

function rpcValue(result) {
  if (!result || result.status !== 'fulfilled') return null;
  const payload = result.value;
  if (!payload || payload.error) return null;
  return payload.data;
}

function landingCountersFromPayload(payload) {
  if (typeof payload === 'number') return { questions: null, specialties: null, registeredUsers: Number.isFinite(payload) && payload > 0 ? payload : null, updatedAt: null };
  if (!payload || typeof payload !== 'object') return null;
  const questions = Number(payload.questions ?? payload.preguntas ?? 0);
  const specialties = Number(payload.specialties ?? payload.especialidades ?? 0);
  const registeredUsers = Number(payload.registered_users ?? payload.registeredUsers ?? payload.users ?? payload.usuarios ?? 0);
  return {
    questions: Number.isFinite(questions) && questions > 0 ? questions : null,
    specialties: Number.isFinite(specialties) && specialties > 0 ? specialties : null,
    registeredUsers: Number.isFinite(registeredUsers) && registeredUsers >= 0 ? registeredUsers : null,
    updatedAt: payload.updated_at || payload.updatedAt || null
  };
}

export function configurePublicCounters(options = {}) {
  const getSupabase = typeof options.getSupabase === 'function'
    ? options.getSupabase
    : () => window.sb;
  const getSafeSupabaseCall = typeof options.getSafeSupabaseCall === 'function'
    ? options.getSafeSupabaseCall
    : () => window.safeSupabaseCall;
  const invalidatePricing = typeof options.invalidatePricing === 'function'
    ? options.invalidatePricing
    : () => {};
  const cargarPrecios = typeof options.cargarPrecios === 'function'
    ? options.cargarPrecios
    : () => {};
  const logger = options.logger || console;

  function aplicarContadorPreguntas(n) {
    const value = Number(n || 0);
    if (!Number.isFinite(value) || value <= 0) return;

    window._nPreguntas = value;
    window.__resiarPublicQuestionCount = value;

    const fmt = formatQuestionCount(value, { withPlus: true });
    const plain = formatQuestionCount(value, { withPlus: false });

    setTextById('lpStatPreguntas', fmt);
    setTextById('lpHeroPreguntas', plain);
    setTextById('lpStatPreguntasFooter', plain);
    setTextById('lpStatPreguntasUpgrade', plain);
    setTextAll('[data-public-counter="questions"]', plain);
    setTextAll('[data-public-counter="questions-plus"]', fmt);
  }

  function aplicarContadorEspecialidades(n) {
    const value = Number(n || 0);
    if (!Number.isFinite(value) || value <= 0) return;

    const text = String(value);
    window.__resiarPublicSpecialtyCount = value;
    setTextById('lpStatEspecialidades', text);
    setTextById('lpStatEspecialidadesFooter', text);
    setTextAll('[data-public-counter="specialties"]', text);
  }

  function aplicarContadorUsuariosRegistrados(n) {
    const value = Number(n || 0);
    // Nunca mostrar 0 en la landing pública salvo que Supabase confirme realmente 0.
    // En producción hay usuarios registrados; si llega 0 por cache/RPC fallida, se conserva el último valor válido.
    if (!Number.isFinite(value) || value <= 0) {
      const current = Number(window.__resiarPublicRegisteredUsersCount || PUBLIC_COUNTER_FALLBACK.registeredUsers || 0);
      if (current > 0) return aplicarContadorUsuariosRegistrados(current);
      return;
    }

    const plain = formatRegisteredUsersCount(value, { withPlus: false });
    const plus = formatRegisteredUsersCount(value, { withPlus: true });
    window.__resiarPublicRegisteredUsersCount = value;

    // Landing principal: número real sin plus para reemplazar el antiguo +2.400 falso.
    setTextById('lpRegisteredUsersCount', plain);
    setTextAll('[data-public-counter="registered-users"]', plain);

    // Compatibilidad con marcas antiguas si quedaron en HTML viejo o cacheado.
    setTextById('lpRegisteredUsersCountPlus', plus);
    setTextAll('[data-public-counter="registered-users-plus"]', plus);
  }

  function aplicarFallbackInicial() {
    aplicarContadorPreguntas(PUBLIC_COUNTER_FALLBACK.questions);
    aplicarContadorEspecialidades(PUBLIC_COUNTER_FALLBACK.specialties);
    aplicarContadorUsuariosRegistrados(PUBLIC_COUNTER_FALLBACK.registeredUsers);
  }

  async function refrescarContadoresLanding() {
    const sb = getSupabase();
    if (!sb || typeof sb.rpc !== 'function') {
      aplicarFallbackInicial();
      return;
    }

    let nPreg = null;
    let nEsp = null;
    let nUsers = null;

    // Fuente canónica nueva: una sola RPC agregada y pública.
    try {
      const { data, error } = await sb.rpc('get_public_landing_counters');
      if (!error) {
        const counters = landingCountersFromPayload(data);
        nPreg = counters?.questions ?? null;
        nEsp = counters?.specialties ?? null;
        nUsers = counters?.registeredUsers ?? null;
        if (counters?.updatedAt) window.__resiarPublicCountersUpdatedAt = counters.updatedAt;
      }
    } catch (_) {}

    // Compatibilidad: si la RPC agregada no existe o llega cacheada, pedir cada contador por separado.
    if (nPreg == null || nEsp == null || nUsers == null || Number(nUsers) <= 0) {
      const calls = [
        nPreg == null ? sb.rpc('count_preguntas_publico') : Promise.resolve({ data: nPreg }),
        nEsp == null ? sb.rpc('count_especialidades_publico') : Promise.resolve({ data: nEsp }),
        (nUsers == null || Number(nUsers) <= 0) ? sb.rpc('get_registered_users_count') : Promise.resolve({ data: nUsers })
      ];
      const [preguntasResult, especialidadesResult, registeredUsersResult] = await Promise.allSettled(calls);

      if (nPreg == null) nPreg = rpcValue(preguntasResult);
      if (nEsp == null) nEsp = rpcValue(especialidadesResult);
      const directUsers = rpcValue(registeredUsersResult);
      if (directUsers != null && Number(directUsers) > 0) nUsers = directUsers;
    }

    if (nPreg != null && Number(nPreg) > 0) aplicarContadorPreguntas(Number(nPreg));
    if (nEsp != null && Number(nEsp) > 0) aplicarContadorEspecialidades(Number(nEsp));
    if (nUsers != null && Number(nUsers) > 0) aplicarContadorUsuariosRegistrados(Number(nUsers));
    else aplicarContadorUsuariosRegistrados(PUBLIC_COUNTER_FALLBACK.registeredUsers);

    if (nPreg == null || nEsp == null || nUsers == null) {
      const safeCall = typeof getSafeSupabaseCall() === 'function'
        ? getSafeSupabaseCall()
        : fallbackSafeCallFactory();
      await safeCall(function () {
        return Promise.resolve({ data: { preguntas: nPreg, especialidades: nEsp, registered_users: nUsers } });
      }, {
        message: DEFAULT_COUNTER_ERROR,
        fallbackData: null
      });
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[ResiAR] Contadores públicos parcialmente actualizados.', { preguntas: nPreg, especialidades: nEsp, usuarios: nUsers });
      }
    }
  }

  let publicCountersPollingTimer = null;
  let listenersStarted = false;

  function startCounterPolling() {
    clearInterval(publicCountersPollingTimer);
    publicCountersPollingTimer = setInterval(refrescarContadoresLanding, 5 * 60 * 1000);
    if (listenersStarted) return;
    listenersStarted = true;
    window.addEventListener('focus', refrescarContadoresLanding, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refrescarContadoresLanding();
    }, { passive: true });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refrescarContadoresLanding, { once: true });
    } else {
      setTimeout(refrescarContadoresLanding, 0);
    }
  }

  function initRealtime() {
    aplicarFallbackInicial();
    startCounterPolling();
    const sb = getSupabase();

    if (!sb || typeof sb.channel !== 'function') {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('[ResiAR] Realtime no inicializado: Supabase no disponible.');
      }
      return;
    }

    // No escuchar profiles desde la landing: profiles ahora expone solo perfil propio/admin.
    // Los cambios públicos de precios/cupos deben venir de planes, que sí es lectura pública.
    sb.channel('rt-planes-public')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planes' },
        function () {
          invalidatePricing();
          cargarPrecios();
        }
      )
      .subscribe();

    sb.channel('rt-preguntas-contadores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'preguntas' },
        function () {
          refrescarContadoresLanding();
        }
      )
      .subscribe();
  }

  aplicarFallbackInicial();

  return {
    aplicarContadorPreguntas,
    aplicarContadorEspecialidades,
    aplicarContadorUsuariosRegistrados,
    refrescarContadoresLanding,
    initRealtime
  };
}
