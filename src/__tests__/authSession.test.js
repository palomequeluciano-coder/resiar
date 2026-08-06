import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureAuthSession } from '../services/authSession.js';

// authSession.js gobierna qué le pasa a un usuario según su nivel de acceso
// al loguearse (quién puede rendir, quién ve avisos de trial, quién queda
// bloqueado) y el watchdog que cierra la sesión si la cuenta se usa en otro
// dispositivo. No tenía ningún test pese a ser lógica de negocio central.

function ensureAuthDom() {
  document.body.innerHTML = `
    <div id="authSection"></div>
    <div id="userSection"></div>
    <div id="modalAuth"></div>
    <div id="authErr"></div>
  `;
}

// onLogin puede arrancar iniciarVerificacionSesion(), que crea un
// setInterval real de 10s. Sin fake timers ese intervalo queda colgado
// después de cada test y puede trabar la corrida completa de Vitest.
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// onLogin siempre consulta sb.from('profiles')...maybeSingle(), incluso si
// ya hay un perfil cacheado en memoria — hay que mockearlo siempre.
function makeSbWithProfile(profile, rpcImpl = async () => ({ data: null, error: null })) {
  return {
    rpc: vi.fn(rpcImpl),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null })
        })
      })
    })
  };
}

function makeDeps(overrides = {}) {
  const calls = {
    cargarPreguntas: [],
    mostrarToast: [],
    mostrarPantallaBloqueo: [],
    activarModoTrialLimitado: [],
    filtrarPreguntasParaTrial: [],
  };

  const deps = {
    getSb: () => overrides.sb,
    getCurrentUser: () => overrides.currentUser ?? null,
    setCurrentUser: vi.fn(),
    getCurrentProfile: () => overrides.currentProfile ?? null,
    setCurrentProfile: vi.fn(),
    setServerAccess: vi.fn(),
    setServerIsPro: vi.fn(),
    verificarAccesoServidor: overrides.verificarAccesoServidor || vi.fn(async () => ({ acceso: 'pro' })),
    cargarPreguntas: vi.fn(async () => { calls.cargarPreguntas.push(true); }),
    activarPublicidadTrial: vi.fn(),
    filtrarPreguntasParaTrial: vi.fn(() => { calls.filtrarPreguntasParaTrial.push(true); }),
    activarModoTrialLimitado: vi.fn(() => { calls.activarModoTrialLimitado.push(true); }),
    mostrarToast: vi.fn((msg) => calls.mostrarToast.push(msg)),
    mostrarPantallaBloqueo: vi.fn((acceso) => calls.mostrarPantallaBloqueo.push(acceso)),
    cerrarLoginReq: vi.fn(),
    checkAdminReportesBtn: vi.fn(),
    readText: vi.fn(() => null),
    writeText: vi.fn(),
    removeStorage: vi.fn(),
    socialStopRealtime: vi.fn(),
    socialStartRealtime: vi.fn(),
    cargarSocialSidebar: vi.fn(),
    resetExamStateAfterLogout: vi.fn(),
    clearReportesEnviados: vi.fn(),
    ...overrides.deps
  };

  return { deps, calls };
}

describe('authSession — onLogin con perfil existente (dispatch por nivel de acceso)', () => {
  beforeEach(() => { ensureAuthDom(); });

  it('admin/pro: carga preguntas y arranca el watchdog de sesión, sin avisos de trial', async () => {
    const sb = makeSbWithProfile({ plan: 'pro' });
    const { deps, calls } = makeDeps({
      sb,
      currentProfile: { plan: 'pro' },
      verificarAccesoServidor: vi.fn(async () => ({ acceso: 'pro' }))
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1', email: 'a@b.com' });

    expect(deps.setCurrentProfile).toHaveBeenCalledWith({ plan: 'pro' });
    expect(calls.cargarPreguntas).toEqual([true]);
    expect(deps.activarPublicidadTrial).toHaveBeenCalled();
    expect(calls.mostrarPantallaBloqueo).toEqual([]);
  });

  it('trial: carga preguntas filtradas y muestra el aviso de trial disponible', async () => {
    const sb = makeSbWithProfile({ plan: 'trial' });
    const { deps, calls } = makeDeps({
      sb,
      currentProfile: { plan: 'trial' },
      verificarAccesoServidor: vi.fn(async () => ({ acceso: 'trial' }))
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(calls.filtrarPreguntasParaTrial).toEqual([true]);
    expect(calls.mostrarToast.some((m) => m.includes('Trial disponible'))).toBe(true);
  });

  it('trial_activo: muestra los días restantes calculados de plan_expira_at', async () => {
    const expira = new Date(Date.now() + 3 * 86400000).toISOString();
    const sb = makeSbWithProfile({ plan: 'trial_activo', plan_expira_at: expira });
    const { deps, calls } = makeDeps({
      sb,
      currentProfile: { plan: 'trial_activo', plan_expira_at: expira },
      verificarAccesoServidor: vi.fn(async () => ({ acceso: 'trial_activo' }))
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(calls.mostrarToast.some((m) => m.includes('3 días más'))).toBe(true);
  });

  it('trial_limitado: filtra preguntas y activa el modo limitado', async () => {
    const sb = makeSbWithProfile({ plan: 'trial_limitado' });
    const { deps, calls } = makeDeps({
      sb,
      currentProfile: { plan: 'trial_limitado' },
      verificarAccesoServidor: vi.fn(async () => ({ acceso: 'trial_limitado' }))
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(calls.filtrarPreguntasParaTrial).toEqual([true]);
    expect(calls.activarModoTrialLimitado).toEqual([true]);
  });

  it('expirado: NO carga preguntas, muestra pantalla de bloqueo específica de plan vencido', async () => {
    const sb = makeSbWithProfile({ plan: 'pro' });
    const { deps, calls } = makeDeps({
      sb,
      currentProfile: { plan: 'pro' },
      verificarAccesoServidor: vi.fn(async () => ({ acceso: 'expirado' }))
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(calls.cargarPreguntas).toEqual([]);
    expect(calls.mostrarPantallaBloqueo).toEqual(['pro_expirado']);
  });

  it('sin acceso / bloqueado: NO carga preguntas y bloquea con el código de acceso tal cual', async () => {
    const sb = makeSbWithProfile({ plan: 'free' });
    const { deps, calls } = makeDeps({
      sb,
      currentProfile: { plan: 'free' },
      verificarAccesoServidor: vi.fn(async () => ({ acceso: 'bloqueado' }))
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(calls.cargarPreguntas).toEqual([]);
    expect(calls.mostrarPantallaBloqueo).toEqual(['bloqueado']);
  });

  it('si falla la carga del perfil, limpia usuario/perfil/acceso y avisa el error (no deja al usuario en un estado a medias)', async () => {
    const sb = {
      rpc: vi.fn(),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => { throw new Error('fallo de red'); }
          })
        })
      })
    };
    const { deps, calls } = makeDeps({ sb, currentProfile: null });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(deps.setCurrentUser).toHaveBeenCalledWith(null);
    expect(deps.setCurrentProfile).toHaveBeenCalledWith(null);
    expect(calls.mostrarToast.some((m) => m.includes('fallo de red'))).toBe(true);
  });
});

describe('authSession — onLogin: no reprocesa un login en curso ni el mismo usuario ya logueado', () => {
  beforeEach(() => { ensureAuthDom(); });

  it('si currentUser ya es ese mismo usuario, no vuelve a llamar a verificarAccesoServidor', async () => {
    const sb = makeSbWithProfile({ plan: 'pro' });
    const verificarAccesoServidor = vi.fn(async () => ({ acceso: 'pro' }));
    const { deps } = makeDeps({
      sb,
      currentUser: { id: 'u1' },
      currentProfile: { plan: 'pro' },
      verificarAccesoServidor
    });
    const session = configureAuthSession(deps);

    await session.onLogin({ id: 'u1' });

    expect(verificarAccesoServidor).not.toHaveBeenCalled();
  });
});

describe('authSession — onLogout', () => {
  beforeEach(() => { ensureAuthDom(); });

  it('limpia el session_id local, resetea usuario/perfil/acceso y desconecta lo social', () => {
    const { deps } = makeDeps({ sb: { rpc: vi.fn() } });
    const session = configureAuthSession(deps);

    session.onLogout();

    expect(deps.removeStorage).toHaveBeenCalledWith('resiar_session_id_v1');
    expect(deps.setCurrentUser).toHaveBeenCalledWith(null);
    expect(deps.setCurrentProfile).toHaveBeenCalledWith(null);
    expect(deps.socialStopRealtime).toHaveBeenCalled();
    expect(deps.resetExamStateAfterLogout).toHaveBeenCalled();
  });
});

describe('authSession — watchdog de sesión única (detecta cuenta compartida/otro dispositivo)', () => {
  beforeEach(() => { ensureAuthDom(); });

  it('si validate_session dice que la sesión ya no es válida, cierra sesión en este dispositivo', async () => {
    const signOut = vi.fn(async () => {});
    const sb = {
      rpc: vi.fn(async (name) => {
        if (name === 'validate_session') return { data: false, error: null };
        return { data: null, error: null };
      }),
      auth: { signOut }
    };
    const { deps } = makeDeps({
      sb,
      currentUser: { id: 'u1' },
      deps: { readText: vi.fn(() => 'session-vieja') }
    });
    const session = configureAuthSession(deps);
    deps.getCurrentUser = () => ({ id: 'u1' });

    session.iniciarVerificacionSesion();

    // dispara el chequeo inicial (setTimeout 1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    // dentro del handler, el aviso de "otro dispositivo" agenda signOut a los 3s
    await vi.advanceTimersByTimeAsync(3000);

    expect(deps.mostrarToast).toHaveBeenCalledWith(expect.stringContaining('otro dispositivo'));
    expect(signOut).toHaveBeenCalled();
  });

  it('si validate_session confirma que la sesión sigue siendo válida, no cierra sesión', async () => {
    const signOut = vi.fn(async () => {});
    const sb = {
      rpc: vi.fn(async (name) => {
        if (name === 'validate_session') return { data: true, error: null };
        return { data: null, error: null };
      }),
      auth: { signOut }
    };
    const { deps } = makeDeps({
      sb,
      currentUser: { id: 'u1' },
      deps: { readText: vi.fn(() => 'session-actual') }
    });
    const session = configureAuthSession(deps);
    deps.getCurrentUser = () => ({ id: 'u1' });

    session.iniciarVerificacionSesion();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(5000);

    expect(signOut).not.toHaveBeenCalled();
  });
});
