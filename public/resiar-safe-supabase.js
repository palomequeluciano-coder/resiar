/*
 * ResiAR — utilidades seguras para llamadas a Supabase.
 *
 * Este puente no cambia el comportamiento actual por sí solo. Expone helpers
 * globales para ir reemplazando llamadas directas a Supabase de forma gradual,
 * con manejo uniforme de errores, estados y fallbacks.
 */
(function initResiarSafeSupabaseHelpers() {
  'use strict';

  var DEFAULT_ERROR_MESSAGE = 'Servicio temporalmente no disponible. Reintentá en unos minutos.';

  function getErrorStatus(error) {
    if (!error) return null;
    return error.status || error.code || error.statusCode || null;
  }

  function getErrorMessage(error, fallbackMessage) {
    if (!error) return fallbackMessage || DEFAULT_ERROR_MESSAGE;
    return (
      error.message ||
      error.error_description ||
      error.details ||
      error.hint ||
      fallbackMessage ||
      DEFAULT_ERROR_MESSAGE
    );
  }

  function normalizeSupabaseError(error, fallbackMessage) {
    return {
      message: getErrorMessage(error, fallbackMessage),
      status: getErrorStatus(error),
      raw: error || null
    };
  }

  function markSupabaseStatus(status, detail) {
    window.RESIAR_SUPABASE_STATUS = status;

    try {
      window.dispatchEvent(new CustomEvent('resiar:supabase-status', {
        detail: {
          status: status,
          detail: detail || null
        }
      }));
    } catch (_) {
      // No bloquear la app si CustomEvent falla.
    }
  }

  async function safeSupabaseCall(action, options) {
    var opts = options || {};
    var fallbackMessage = opts.message || DEFAULT_ERROR_MESSAGE;

    if (typeof action !== 'function') {
      var invalidActionError = normalizeSupabaseError(
        new Error('safeSupabaseCall requiere una función.'),
        fallbackMessage
      );

      return {
        ok: false,
        data: opts.fallbackData ?? null,
        error: invalidActionError.raw,
        message: invalidActionError.message,
        status: invalidActionError.status
      };
    }

    try {
      markSupabaseStatus('checking');

      var result = await action();

      if (result && result.error) {
        throw result.error;
      }

      markSupabaseStatus('ready');

      return {
        ok: true,
        data: result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result,
        error: null,
        message: null,
        status: result && result.status ? result.status : null,
        raw: result
      };
    } catch (error) {
      var normalized = normalizeSupabaseError(error, fallbackMessage);

      markSupabaseStatus('error', normalized);

      if (typeof opts.onError === 'function') {
        try {
          opts.onError(normalized);
        } catch (_) {}
      }

      if (opts.throwOnError) {
        throw error;
      }

      return {
        ok: false,
        data: opts.fallbackData ?? null,
        error: error,
        message: normalized.message,
        status: normalized.status,
        raw: null
      };
    }
  }

  async function safeSupabaseJsonFetch(url, init, options) {
    var opts = options || {};
    var fallbackMessage = opts.message || DEFAULT_ERROR_MESSAGE;

    try {
      markSupabaseStatus('checking');

      var response = await fetch(url, init || {});
      var body = await response.json().catch(function () {
        return null;
      });

      if (!response.ok) {
        var fetchError = new Error(
          (body && (body.error || body.message)) || ('HTTP ' + response.status)
        );

        fetchError.status = response.status;
        fetchError.body = body;

        throw fetchError;
      }

      markSupabaseStatus('ready');

      return {
        ok: true,
        data: body,
        error: null,
        message: null,
        status: response.status,
        response: response
      };
    } catch (error) {
      var normalized = normalizeSupabaseError(error, fallbackMessage);

      markSupabaseStatus('error', normalized);

      if (typeof opts.onError === 'function') {
        try {
          opts.onError(normalized);
        } catch (_) {}
      }

      if (opts.throwOnError) {
        throw error;
      }

      return {
        ok: false,
        data: opts.fallbackData ?? null,
        error: error,
        message: normalized.message,
        status: normalized.status || null,
        response: null
      };
    }
  }

  async function safeSupabaseSession(options) {
    return safeSupabaseCall(function () {
      if (!window.sb || !window.sb.auth || typeof window.sb.auth.getSession !== 'function') {
        throw new Error('Supabase no está inicializado.');
      }

      return window.sb.auth.getSession();
    }, Object.assign({ message: 'No se pudo verificar la sesión.' }, options || {}));
  }

  window.normalizeSupabaseError = normalizeSupabaseError;
  window.safeSupabaseCall = safeSupabaseCall;
  window.safeSupabaseJsonFetch = safeSupabaseJsonFetch;
  window.safeSupabaseSession = safeSupabaseSession;
  window.markSupabaseStatus = markSupabaseStatus;

  markSupabaseStatus(window.RESIAR_SUPABASE_READY ? 'ready' : 'unknown');
})();