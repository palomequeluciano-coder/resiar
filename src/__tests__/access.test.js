import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { configureAccess, canUseCustomSounds, getSoundPlanLabel, verificarAccesoServidor } from '../services/access.js';

// access.js es el gate de acceso pago (admin/pro/trial) de ResiAR: decide si
// un usuario puede rendir exámenes, con fallbacks para conectividad caída,
// sesiones locales viejas y recuperación de admin. Es el módulo con más
// impacto de negocio del proyecto y no tenía ningún test.

function makeStorage() {
  const store = new Map();
  return {
    store,
    writeText: (key, value) => { store.set(key, value); return true; },
    readText: (key, fallback = null) => (store.has(key) ? store.get(key) : fallback),
    removeStorage: (key) => store.delete(key)
  };
}

function makeSb({ session = { access_token: 'tok-123' }, rpcImpl = async () => ({}) } = {}) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      refreshSession: vi.fn(async () => ({ data: { session } }))
    },
    rpc: vi.fn(rpcImpl)
  };
}

describe('access.js — labels de plan (sin red)', () => {
  it('canUseCustomSounds es true solo para admin/pro/trial_activo', () => {
    configureAccess({ getServerAccess: () => 'admin' });
    expect(canUseCustomSounds()).toBe(true);

    configureAccess({ getServerAccess: () => 'pro' });
    expect(canUseCustomSounds()).toBe(true);

    configureAccess({ getServerAccess: () => 'trial_activo' });
    expect(canUseCustomSounds()).toBe(true);

    configureAccess({ getServerAccess: () => 'trial' });
    expect(canUseCustomSounds()).toBe(false);

    configureAccess({ getServerAccess: () => 'bloqueado' });
    expect(canUseCustomSounds()).toBe(false);
  });

  it('getSoundPlanLabel mapea cada estado de acceso a su etiqueta', () => {
    const casos = [
      ['admin', 'ADMIN'],
      ['pro', 'PRO'],
      ['trial_activo', 'TRIAL+'],
      ['trial', 'TRIAL'],
      ['trial_limitado', 'LIMITADO'],
      ['bloqueado', 'SIN ACCESO'],
      [null, 'SIN ACCESO']
    ];
    for (const [acceso, esperado] of casos) {
      configureAccess({ getServerAccess: () => acceso });
      expect(getSoundPlanLabel()).toBe(esperado);
    }
  });
});

describe('verificarAccesoServidor — camino feliz', () => {
  let storage, sb, setAccessCalls, setProCalls;

  beforeEach(() => {
    storage = makeStorage();
    setAccessCalls = [];
    setProCalls = [];
    sb = makeSb();
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ acceso: 'pro', esPro: true, sessionId: 'sess-abc' })
    }));
    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => null,
      setServerAccess: (v) => setAccessCalls.push(v),
      setServerIsPro: (v) => setProCalls.push(v)
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('con sesión válida, guarda el acceso, el sessionId y registra la sesión en DB', async () => {
    const json = await verificarAccesoServidor();

    expect(json.acceso).toBe('pro');
    expect(setAccessCalls).toEqual(['pro']);
    expect(setProCalls).toEqual([true]);
    expect(storage.store.get('resiar_session_id_v1')).toBe('sess-abc');
    expect(sb.rpc).toHaveBeenCalledWith('register_session', { p_token: 'sess-abc' });
  });

  it('envía el Bearer token de la sesión actual al endpoint de verificación', async () => {
    await verificarAccesoServidor();
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer tok-123');
  });
});

describe('verificarAccesoServidor — recuperación de session_id local viejo (v120)', () => {
  it('si el server bloquea con un session_id viejo pero el perfil tiene un plan válido, limpia y reintenta sin sessionId', async () => {
    const storage = makeStorage();
    storage.store.set('resiar_session_id_v1', 'session-vieja');
    const sb = makeSb();

    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        // Primer intento: el server rechaza por session_id viejo/stale
        return { ok: true, json: async () => ({ acceso: 'bloqueado' }) };
      }
      // Reintento sin sessionId: el server ahora reconoce el acceso pro real
      return { ok: true, json: async () => ({ acceso: 'pro', esPro: true, sessionId: 'session-nueva' }) };
    });

    const setAccessCalls = [];
    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => ({ plan: 'pro' }),
      setServerAccess: (v) => setAccessCalls.push(v),
      setServerIsPro: () => {}
    });

    const json = await verificarAccesoServidor();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(json.acceso).toBe('pro');
    expect(json.recoveredFromStaleLocalSession).toBe(true);
    expect(setAccessCalls).toEqual(['pro']);
  });
});

describe('verificarAccesoServidor — fallback de admin', () => {
  it('si falla la verificación por red y el perfil local dice admin, no bloquea al admin', async () => {
    const storage = makeStorage();
    const sb = makeSb();
    global.fetch = vi.fn(async () => { throw new Error('network down'); });

    const setAccessCalls = [];
    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => ({ plan: 'admin' }),
      setServerAccess: (v) => setAccessCalls.push(v),
      setServerIsPro: () => {}
    });

    const json = await verificarAccesoServidor();

    expect(json.acceso).toBe('admin');
    expect(json.adminLocalRecovery).toBe(true);
    expect(setAccessCalls).toEqual(['admin']);
  });

  it('si el server responde bloqueado explícitamente pero el perfil es admin, se recupera igual (regla admin acotada)', async () => {
    const storage = makeStorage();
    const sb = makeSb();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ acceso: 'bloqueado' }) }));

    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => ({ plan: 'admin' }),
      setServerAccess: () => {},
      setServerIsPro: () => {}
    });

    const json = await verificarAccesoServidor();
    expect(json.acceso).toBe('admin');
    expect(json.adminLocalRecovery).toBe(true);
  });
});

describe('verificarAccesoServidor — fallback de conectividad (no es decisión del server)', () => {
  // isLocalDevOrigin() mira window.location.hostname; en jsdom por defecto es
  // "localhost", lo que activaría maybeLocalProfileFallback (una rama pensada
  // solo para desarrollo local, que no descarta planes "expirado"). Para
  // probar el comportamiento real de producción, forzamos un hostname no local.
  let originalLocation;
  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = new URL('https://resiarg.com.ar/examenes-medicos/');
  });
  afterEach(() => { window.location = originalLocation; });

  it('con fetch caído y un perfil pro vigente, repite el último acceso conocido en vez de bloquear', async () => {
    const storage = makeStorage();
    const sb = makeSb();
    global.fetch = vi.fn(async () => { throw new Error('timeout'); });

    const setAccessCalls = [];
    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => ({ plan: 'pro', plan_expira_at: new Date(Date.now() + 86400000).toISOString() }),
      setServerAccess: (v) => setAccessCalls.push(v),
      setServerIsPro: () => {}
    });

    const json = await verificarAccesoServidor();

    expect(json.acceso).toBe('pro');
    expect(json.connectivityFallback).toBe(true);
    expect(setAccessCalls).toEqual(['pro']);
  });

  it('con fetch caído y un plan pro YA EXPIRADO, no usa el fallback de conectividad (no repite un acceso que ya no es válido)', async () => {
    const storage = makeStorage();
    const sb = makeSb();
    global.fetch = vi.fn(async () => { throw new Error('timeout'); });

    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => ({ plan: 'pro', plan_expira_at: new Date(Date.now() - 86400000).toISOString() }),
      setServerAccess: () => {},
      setServerIsPro: () => {}
    });

    const json = await verificarAccesoServidor();
    expect(json.acceso).toBe('bloqueado');
  });
});

describe('verificarAccesoServidor — sin ningún fallback posible', () => {
  it('sin sesión, sin perfil y con fetch caído, bloquea (no hay nada legítimo que repetir)', async () => {
    const storage = makeStorage();
    const sb = makeSb();
    global.fetch = vi.fn(async () => { throw new Error('timeout'); });

    const setAccessCalls = [];
    const setProCalls = [];
    configureAccess({
      getSb: () => sb,
      getVerifyUrl: () => 'https://example.com/verify',
      ...storage,
      getCurrentProfile: () => null,
      setServerAccess: (v) => setAccessCalls.push(v),
      setServerIsPro: (v) => setProCalls.push(v)
    });

    const json = await verificarAccesoServidor();

    expect(json).toEqual({ acceso: 'bloqueado', esPro: false });
    expect(setAccessCalls).toEqual(['bloqueado']);
    expect(setProCalls).toEqual([false]);
  });

  it('sin Supabase Auth disponible, bloquea de forma segura en vez de tirar una excepción sin capturar', async () => {
    configureAccess({
      getSb: () => null,
      getVerifyUrl: () => 'https://example.com/verify',
      ...makeStorage(),
      getCurrentProfile: () => null,
      setServerAccess: () => {},
      setServerIsPro: () => {}
    });

    const json = await verificarAccesoServidor();
    expect(json.acceso).toBe('bloqueado');
  });
});
