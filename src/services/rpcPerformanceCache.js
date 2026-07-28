// RESIAR v68E-bis — RPC performance cache
// Objetivo:
// - Mantener validate_session agresivo, sin cachearlo.
// - Cachear/deduplicar RPC repetitivas de landing/social/ranking.
// - No persiste datos en localStorage/IndexedDB; memoria de pestaña únicamente.
// - No cambia seguridad ni permisos SQL.

const DEFAULT_TTLS = Object.freeze({
  get_public_landing_counters: 5 * 60 * 1000,
  get_registered_users_count: 5 * 60 * 1000,
  get_ranking_global: 30 * 1000,
  list_my_friends: 60 * 1000,
  list_friend_requests: 30 * 1000
});

const SOCIAL_READ_RPC = new Set([
  "list_my_friends",
  "list_friend_requests"
]);

const SOCIAL_MUTATION_RPC = new Set([
  "send_friend_request",
  "accept_friend_request",
  "reject_friend_request",
  "cancel_friend_request",
  "remove_friend"
]);

function now() {
  return Date.now();
}

function stableStringify(value) {
  if (value == null) return "";
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

async function getSessionUserKey(sb) {
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user?.id || "anon";
  } catch (_) {
    return "anon";
  }
}

async function buildCacheKey(sb, rpcName, args) {
  const scope = SOCIAL_READ_RPC.has(rpcName)
    ? await getSessionUserKey(sb)
    : "public";

  return `${scope}:${rpcName}:${stableStringify(args || {})}`;
}

function makeStore() {
  return {
    cache: new Map(),
    inFlight: new Map()
  };
}

function clearByPrefix(store, prefix) {
  for (const key of Array.from(store.cache.keys())) {
    if (!prefix || key.startsWith(prefix) || key.includes(prefix)) {
      store.cache.delete(key);
    }
  }

  for (const key of Array.from(store.inFlight.keys())) {
    if (!prefix || key.startsWith(prefix) || key.includes(prefix)) {
      store.inFlight.delete(key);
    }
  }
}

async function invalidateSocial(store, sb) {
  const userKey = await getSessionUserKey(sb);
  clearByPrefix(store, `${userKey}:list_my_friends`);
  clearByPrefix(store, `${userKey}:list_friend_requests`);
  clearByPrefix(store, "list_my_friends");
  clearByPrefix(store, "list_friend_requests");
}

function invalidateRanking(store) {
  clearByPrefix(store, "get_ranking_global");
}

export function installRpcPerformanceCache(sb, options = {}) {
  if (!sb || typeof sb.rpc !== "function") {
    console.warn("[ResiAR v68E-bis] No se pudo instalar RPC cache: Supabase client inválido.");
    return null;
  }

  if (sb.__resiarRpcPerformanceCacheInstalled) {
    return sb.__resiarRpcPerformanceCacheApi || null;
  }

  const ttlByRpc = {
    ...DEFAULT_TTLS,
    ...(options.ttlByRpc || {})
  };

  const store = makeStore();
  const originalRpc = sb.rpc.bind(sb);

  async function cachedRpc(rpcName, args, rpcOptions) {
    const ttlMs = Number(ttlByRpc[rpcName] || 0);

    if (!ttlMs || ttlMs <= 0) {
      return originalRpc(rpcName, args, rpcOptions);
    }

    const key = await buildCacheKey(sb, rpcName, args);
    const t = now();

    const cached = store.cache.get(key);
    if (cached && t - cached.at < ttlMs) {
      return cached.value;
    }

    const pending = store.inFlight.get(key);
    if (pending) {
      return pending;
    }

    const promise = Promise.resolve(originalRpc(rpcName, args, rpcOptions))
      .then((result) => {
        // No cachear errores. Devuelve el mismo shape de Supabase: { data, error }.
        if (!result?.error) {
          store.cache.set(key, {
            value: result,
            at: now()
          });
        }

        return result;
      })
      .finally(() => {
        store.inFlight.delete(key);
      });

    store.inFlight.set(key, promise);
    return promise;
  }

  sb.rpc = function resiarCachedRpc(rpcName, args, rpcOptions) {
    const name = String(rpcName || "");

    // Watchdog/sesión quedan agresivos e intactos.
    if (name === "validate_session" || name === "register_session" || name === "logout_session") {
      return originalRpc(name, args, rpcOptions);
    }

    if (Object.prototype.hasOwnProperty.call(ttlByRpc, name)) {
      return cachedRpc(name, args, rpcOptions);
    }

    const resultPromise = originalRpc(name, args, rpcOptions);

    if (SOCIAL_MUTATION_RPC.has(name)) {
      return Promise.resolve(resultPromise).then(async (result) => {
        if (!result?.error) {
          await invalidateSocial(store, sb);
        }

        return result;
      });
    }

    return resultPromise;
  };

  const api = {
    clear() {
      store.cache.clear();
      store.inFlight.clear();
    },
    invalidate(prefix = "") {
      clearByPrefix(store, prefix);
    },
    async invalidateSocial() {
      await invalidateSocial(store, sb);
    },
    invalidateRanking() {
      invalidateRanking(store);
    },
    inspect() {
      return {
        cacheKeys: Array.from(store.cache.keys()),
        inFlightKeys: Array.from(store.inFlight.keys()),
        ttlByRpc: { ...ttlByRpc }
      };
    }
  };

  sb.__resiarRpcPerformanceCacheInstalled = true;
  sb.__resiarRpcPerformanceCacheApi = api;

  try {
    window.__resiarRpcPerformanceCache = api;
  } catch (_) {}

  return api;
}

export function clearInstalledRpcPerformanceCache(sb) {
  try {
    const api = sb?.__resiarRpcPerformanceCacheApi || window.__resiarRpcPerformanceCache;
    api?.clear?.();
  } catch (_) {}
}

export default installRpcPerformanceCache;
