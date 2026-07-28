import { normalizeQuestionAnswerSchema } from '../utils/answerOptions.js';

const QUESTION_BANK_DB = 'resiar_question_bank_cache_v1';
const QUESTION_BANK_STORE = 'banks';
const QUESTION_BANK_DB_VERSION = 1;
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000;
const STALE_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

// RESIAR v69A
// El banco completo de preguntas no debe persistirse en IndexedDB.
// Mantenerlo desactivado reduce extracción desde DevTools/Application/Cache.
// La app sigue usando memoria de pestaña hasta migrar selección/corrección a backend por sesión.
const PERSISTENT_QUESTION_BANK_CACHE_ENABLED = false;
let _persistentCachePurgeStarted = false;

function isPersistentQuestionBankCacheEnabled() {
  try {
    return PERSISTENT_QUESTION_BANK_CACHE_ENABLED === true
      || window.__RESIAR_ENABLE_PERSISTENT_QUESTION_BANK_CACHE === true;
  } catch (_) {
    return PERSISTENT_QUESTION_BANK_CACHE_ENABLED === true;
  }
}

function nowMs() {
  return Date.now();
}

function safeString(value) {
  return String(value ?? '').trim();
}

function normalizePlanPart(value) {
  return safeString(value).replace(/[^a-zA-Z0-9:_\-.]/g, '_') || 'none';
}

function isBrowserIndexedDbAvailable() {
  return isPersistentQuestionBankCacheEnabled()
    && typeof window !== 'undefined'
    && typeof window.indexedDB !== 'undefined';
}

function openDb() {
  if (!isBrowserIndexedDbAvailable()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(QUESTION_BANK_DB, QUESTION_BANK_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUESTION_BANK_STORE)) {
        db.createObjectStore(QUESTION_BANK_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir cache IndexedDB'));
  });
}


function deleteQuestionBankDatabase() {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.deleteDatabase(QUESTION_BANK_DB);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

function purgePersistentQuestionBankCacheOnce() {
  if (_persistentCachePurgeStarted) return;
  _persistentCachePurgeStarted = true;
  deleteQuestionBankDatabase().then((ok) => {
    try {
      window.__resiarQuestionBankPersistentCache = {
        enabled: isPersistentQuestionBankCacheEnabled(),
        purged: !!ok,
        dbName: QUESTION_BANK_DB,
        at: new Date().toISOString(),
      };
    } catch (_) {}
  }).catch(() => {});
}

function withStore(mode, handler) {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUESTION_BANK_STORE, mode);
      const store = tx.objectStore(QUESTION_BANK_STORE);
      let settled = false;
      const done = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      tx.oncomplete = () => done(undefined);
      tx.onerror = () => reject(tx.error || new Error('Error de cache IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('Transacción de cache abortada'));
      try {
        const result = handler(store, done);
        if (result !== undefined) done(result);
      } catch (error) {
        reject(error);
      }
    }).finally(() => {
      try { db.close(); } catch (_) {}
    });
  });
}

export function buildQuestionBankCacheKey({ userId, serverAccess, profile, questionBankVersion } = {}) {
  const bankVersion = normalizePlanPart(questionBankVersion || 'bootstrap');
  const uid = normalizePlanPart(userId);
  const access = normalizePlanPart(serverAccess || profile?.plan || 'unknown');
  const plan = normalizePlanPart(profile?.plan || 'unknown');
  const subtype = normalizePlanPart(profile?.plan_subtipo || 'none');
  const expires = normalizePlanPart(profile?.plan_expira_at || profile?.current_period_end || 'none');
  return `qb:${bankVersion}:${uid}:${access}:${plan}:${subtype}:${expires}`;
}

export async function readQuestionBankCache(cacheKey, { ttlMs = DEFAULT_TTL_MS, staleFallbackTtlMs = STALE_FALLBACK_TTL_MS } = {}) {
  if (!isPersistentQuestionBankCacheEnabled()) {
    purgePersistentQuestionBankCacheOnce();
    return null;
  }
  if (!cacheKey) return null;
  try {
    const entry = await withStore('readonly', (store, done) => {
      const req = store.get(cacheKey);
      req.onsuccess = () => done(req.result || null);
      req.onerror = () => done(null);
    });
    if (!entry || !Array.isArray(entry.questions) || !entry.questions.length) return null;
    const age = nowMs() - Number(entry.savedAt || 0);
    if (age <= ttlMs) return { ...entry, stale: false, age };
    if (age <= staleFallbackTtlMs) return { ...entry, stale: true, age };
    return null;
  } catch (_) {
    return null;
  }
}

export async function writeQuestionBankCache(cacheKey, questions, meta = {}) {
  if (!isPersistentQuestionBankCacheEnabled()) {
    purgePersistentQuestionBankCacheOnce();
    return false;
  }
  if (!cacheKey || !Array.isArray(questions) || !questions.length) return false;
  try {
    const entry = {
      key: cacheKey,
      savedAt: nowMs(),
      version: 1,
      count: questions.length,
      meta,
      questions,
    };
    await withStore('readwrite', (store) => {
      store.put(entry);
      return undefined;
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function clearQuestionBankCache() {
  if (!isPersistentQuestionBankCacheEnabled()) {
    return deleteQuestionBankDatabase();
  }
  try {
    await withStore('readwrite', (store) => {
      store.clear();
      return undefined;
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function pruneQuestionBankCache({ keepKey, maxEntries = 3 } = {}) {
  if (!isPersistentQuestionBankCacheEnabled()) return true;
  try {
    const entries = [];
    await withStore('readonly', (store, done) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return done(entries);
        entries.push({ key: cursor.key, savedAt: Number(cursor.value?.savedAt || 0) });
        cursor.continue();
      };
      req.onerror = () => done(entries);
    });
    const removable = entries
      .filter((entry) => entry.key !== keepKey)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(Math.max(0, maxEntries - 1));
    const keep = new Set([keepKey, ...removable.map((entry) => entry.key)]);
    const toDelete = entries.filter((entry) => !keep.has(entry.key));
    if (!toDelete.length) return true;
    await withStore('readwrite', (store) => {
      toDelete.forEach((entry) => store.delete(entry.key));
      return undefined;
    });
    return true;
  } catch (_) {
    return false;
  }
}

export function getQuestionBankCacheSecurityStatus() {
  return {
    persistentCacheEnabled: isPersistentQuestionBankCacheEnabled(),
    databaseName: QUESTION_BANK_DB,
    storeName: QUESTION_BANK_STORE,
    mode: isPersistentQuestionBankCacheEnabled() ? 'persistent-indexeddb' : 'memory-only-no-indexeddb',
  };
}

// Canonicaliza el esquema de respuesta del banco local/cache.
// La base debe venir normalizada desde Supabase, pero esta capa mantiene
// tolerancia estructural ante bancos importados con arrays o claves numéricas.
function normalizeQuestionAnswerKeys(row) {
  if (!row || typeof row !== 'object') return row;
  return normalizeQuestionAnswerSchema({ ...row });
}

function applyLoadIndex(rows) {
  return rows.map((row, index) => ({ ...normalizeQuestionAnswerKeys(row), _resiarLoadIndex: index }));
}


function normalizeCatalogPayload(data) {
  if (Array.isArray(data)) return data[0] && typeof data[0] === 'object' ? data[0] : { questions: data };
  if (data && typeof data === 'object') return data;
  return { questions: [] };
}

function stripSensitiveQuestionFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.pregunta;
  delete out.opciones;
  delete out.respuesta;
  delete out.correct_answer;
  delete out.raw_correct_answer;
  return out;
}

function isMissingRpcError(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || error || '').toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || msg.includes('function') && msg.includes('not found')
    || msg.includes('could not find the function')
    || msg.includes('does not exist');
}

async function loadQuestionCatalogFromSecureRpc({ supabase, onProgress } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return null;
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  progress(8);
  const { data, error } = await supabase.rpc('get_question_catalog_v72', {
    p_question_ids: [],
    p_examen: null,
    p_anio: null,
    p_limit: 15000
  });
  if (error) {
    if (isMissingRpcError(error)) return null;
    throw error;
  }
  const payload = normalizeCatalogPayload(data);
  const rows = Array.isArray(payload.questions)
    ? payload.questions.map(stripSensitiveQuestionFields).filter(Boolean)
    : [];
  progress(92);
  return {
    source: 'supabase-rpc-catalog-v72',
    questions: applyLoadIndex(rows),
    meta: {
      count: rows.length,
      estimatedCount: Number(payload.count || payload.total_count || rows.length),
      pageSize: rows.length,
      concurrency: 1,
      loadedAt: new Date().toISOString(),
      rpc: 'get_question_catalog_v72',
      answersExposed: false,
      directTableRead: false,
    },
  };
}

export async function loadQuestionBankFromSupabase({
  supabase,
  selectColumns,
  pageSize = 1000,
  concurrency = 3,
  onProgress,
} = {}) {
  if (!supabase) throw new Error('Supabase no inicializado');
  const progress = typeof onProgress === 'function' ? onProgress : () => {};

  const secureCatalog = await loadQuestionCatalogFromSecureRpc({ supabase, onProgress: progress });
  if (secureCatalog) return secureCatalog;

  // Compatibilidad de despliegue: esta rama solo se usa antes de aplicar la migración v72.
  // Luego de revocar permisos directos sobre public.preguntas, el catálogo debe venir por RPC.
  const safePageSize = Math.max(200, Math.min(Number(pageSize) || 1000, 1500));
  const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || 3, 4));

  const { count, error: countError } = await supabase
    .from('preguntas')
    .select('id', { count: 'exact', head: true });
  if (countError) throw countError;

  const totalEst = Math.max(Number(count) || 0, 1);
  const ranges = Array.from(
    { length: Math.ceil(totalEst / safePageSize) },
    (_, i) => [i * safePageSize, (i + 1) * safePageSize - 1]
  );

  let received = 0;
  let cursor = 0;
  const chunks = new Array(ranges.length);
  progress(8);

  async function loadPage(index) {
    const [from, to] = ranges[index];
    const { data, error } = await supabase.from('preguntas')
      .select(selectColumns)
      .order('examen', { ascending: true, nullsFirst: false })
      .order('anio', { ascending: true, nullsFirst: false })
      .order('num_original', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = (data || []).map(stripSensitiveQuestionFields);
    chunks[index] = rows;
    received += rows.length;
    progress(Math.min(92, Math.round(8 + (received / totalEst) * 84)));
  }

  async function worker() {
    while (cursor < ranges.length) {
      const index = cursor;
      cursor += 1;
      await loadPage(index);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(safeConcurrency, Math.max(1, ranges.length)) },
    () => worker()
  ));

  return {
    source: 'supabase',
    questions: applyLoadIndex(chunks.flat().filter(Boolean)),
    meta: {
      count: received,
      estimatedCount: totalEst,
      pageSize: safePageSize,
      concurrency: safeConcurrency,
      loadedAt: new Date().toISOString(),
    },
  };
}

export async function loadQuestionBank({
  supabase,
  cacheKey,
  selectColumns,
  ttlMs = DEFAULT_TTL_MS,
  pageSize = 1000,
  concurrency = 3,
  onProgress,
  allowStaleFallback = true,
  bypassCache = false,
} = {}) {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  progress(3);
  if (!isPersistentQuestionBankCacheEnabled()) purgePersistentQuestionBankCacheOnce();

  const cached = bypassCache ? null : await readQuestionBankCache(cacheKey, { ttlMs });
  if (cached && !cached.stale) {
    progress(78);
    return {
      source: 'cache',
      questions: applyLoadIndex(cached.questions),
      meta: {
        ...(cached.meta || {}),
        cacheKey,
        cacheAgeMs: cached.age,
        stale: false,
      },
    };
  }

  try {
    const fresh = await loadQuestionBankFromSupabase({
      supabase,
      selectColumns,
      pageSize,
      concurrency,
      onProgress: progress,
    });
    progress(95);
    writeQuestionBankCache(cacheKey, fresh.questions, fresh.meta).then(() => {
      pruneQuestionBankCache({ keepKey: cacheKey }).catch(() => {});
    }).catch(() => {});
    return {
      ...fresh,
      meta: { ...(fresh.meta || {}), cacheKey },
    };
  } catch (error) {
    if (cached && allowStaleFallback) {
      progress(82);
      return {
        source: 'cache-stale',
        questions: applyLoadIndex(cached.questions),
        meta: {
          ...(cached.meta || {}),
          cacheKey,
          cacheAgeMs: cached.age,
          stale: true,
          refreshError: error?.message || String(error),
        },
      };
    }
    throw error;
  }
}
