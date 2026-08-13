import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  configureBilling,
  invalidatePricing,
  getPricingState,
  cargarPrecios,
  formatPrecio,
  aplicarPreciosDOM,
  abrirUpgrade,
  cerrarUpgrade,
  iniciarPago,
  iniciarPagoDesdeTab,
  renderPlanStatus
} from '../ui/billing.js';

// billing.js maneja precios, tramos de lanzamiento (cupos con precio
// creciente) y el flujo de pago con Mercado Pago -- es el módulo con más
// riesgo directo de plata del proyecto y no tenía ningún test.

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function makeSb(overrides = {}) {
  return {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    functions: { invoke: vi.fn(async () => ({ data: { init_point: 'https://mp.example/pay' }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null }))
    })),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    ...overrides
  };
}

function fullPricingRpcData(overrides = {}) {
  return {
    pros_count: 10,
    tramo: 1,
    mensual: { precio: 9999 },
    anual: { precio: 24999, precio_anual_equiv: 8333 },
    ...overrides
  };
}

function baseDom() {
  document.body.innerHTML = `
    <div class="lp-plan-popular"></div>
    <div id="lpPopularTrimestral"></div>
    <div id="lpPrecioMensual"></div>
    <div id="upgradePrecioMensual"></div>
    <div id="tabPrecioMensual"></div>
    <div id="tabPrecioMensualEquiv"></div>
    <div id="lpPrecioAnual"></div>
    <div id="upgradePrecioAnual"></div>
    <div id="tabPrecioAnual"></div>
    <div id="tabPrecioAnualEquiv"></div>
    <div id="lp-pros-bar"></div>
    <div id="lp-pros-count"></div>
    <div id="lp-stair-e1"></div><div id="lp-e1-label"></div>
    <div id="lp-stair-e2"></div><div id="lp-e2-label"></div>
    <div id="lp-stair-e3"></div><div id="lp-e3-label"></div>
    <div id="lp-stair-e4"></div><div id="lp-e4-label"></div>
    <div id="modalUpgrade"></div>
    <div id="planStatusSection"></div>
    <div id="upgradeBanner" class="vis"></div>
    <button id="btnSmartExam" class="btn-pro-locked"></button>
    <button id="btnRepaso" class="btn-pro-locked"></button>
    <button id="btnPagarMensual">Pagar mensual</button>
    <button id="btnPagarAnual">Pagar anual</button>
    <div id="upgradeDescAnual"></div>
  `;
}

describe('formatPrecio (pura)', () => {
  it('formatea con separador de miles es-AR y sin decimales', () => {
    expect(formatPrecio(9999)).toBe('9.999');
    expect(formatPrecio(1234567)).toBe('1.234.567');
  });

  it('trata null/undefined/NaN como 0', () => {
    expect(formatPrecio(null)).toBe('0');
    expect(formatPrecio(undefined)).toBe('0');
    expect(formatPrecio(NaN)).toBe('0');
  });
});

describe('cargarPrecios / getPricingState / invalidatePricing', () => {
  beforeEach(() => { baseDom(); invalidatePricing(); });
  afterEach(() => { invalidatePricing(); });

  it('sin cliente de supabase, no rompe y no setea precios', async () => {
    configureBilling({ getSupabase: () => null });
    await cargarPrecios();
    expect(getPricingState().precios).toBeNull();
  });

  it('carga precios, tramo y prosCount desde get_precios_actuales', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData(), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();

    const state = getPricingState();
    expect(state.precios.mensual.precio).toBe(9999);
    expect(state.precios.anual.precio).toBe(24999);
    expect(state.precios._tramo).toBe(1);
    expect(state.prosCount).toBe(10);
    expect(sb.rpc).toHaveBeenCalledWith('get_precios_actuales');
  });

  it('tramo 4 significa que ya no está en lanzamiento', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ tramo: 4 }), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();
    expect(getPricingState().enLanzamiento).toBe(false);
  });

  it('tramo 1-3 significa que está en lanzamiento', async () => {
    for (const tramo of [1, 2, 3]) {
      invalidatePricing();
      const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ tramo }), error: null })) });
      configureBilling({ getSupabase: () => sb });
      await cargarPrecios();
      expect(getPricingState().enLanzamiento).toBe(true);
    }
  });

  it('si el RPC devuelve error, no pisa el estado de precios existente', async () => {
    const sbOk = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData(), error: null })) });
    configureBilling({ getSupabase: () => sbOk });
    await cargarPrecios();
    expect(getPricingState().precios).not.toBeNull();

    const sbFail = makeSb({ rpc: vi.fn(async () => ({ data: null, error: { message: 'boom' } })) });
    configureBilling({ getSupabase: () => sbFail });
    await cargarPrecios();
    expect(getPricingState().precios.mensual.precio).toBe(9999);
  });

  it('invalidatePricing limpia el caché', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData(), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();
    expect(getPricingState().precios).not.toBeNull();
    invalidatePricing();
    expect(getPricingState().precios).toBeNull();
  });
});

describe('aplicarPreciosDOM — precios y badge de tramo en pantalla', () => {
  beforeEach(async () => {
    baseDom();
    invalidatePricing();
  });

  it('no rompe si todavía no hay precios cargados', () => {
    expect(() => aplicarPreciosDOM()).not.toThrow();
  });

  it('muestra el badge de lanzamiento con los cupos restantes cuando tramo < 4', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ tramo: 1, pros_count: 10 }), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();

    const badge = document.querySelector('.lp-plan-popular');
    expect(badge.style.display).toBe('flex');
    expect(badge.innerHTML).toContain('15'); // 25 - 10 = 15 cupos restantes
  });

  it('oculta el badge de lanzamiento cuando tramo === 4', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ tramo: 4 }), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();

    expect(document.querySelector('.lp-plan-popular').style.display).toBe('none');
  });

  it('escribe el precio mensual y anual formateados en todos los elementos del DOM', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ mensual: { precio: 12345 } }), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();

    expect(document.getElementById('lpPrecioMensual').innerHTML).toContain('$12.345');
    expect(document.getElementById('upgradePrecioMensual').innerHTML).toContain('$12.345');
    expect(document.getElementById('tabPrecioMensual').innerHTML).toContain('$12.345');
  });

  it('la barra de escalones refleja prosCount y marca el escalón actual', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ tramo: 2, pros_count: 30 }), error: null })) });
    configureBilling({ getSupabase: () => sb });
    await cargarPrecios();

    expect(document.getElementById('lp-pros-bar').style.width).toBe('30%');
    expect(document.getElementById('lp-pros-count').textContent).toBe('30');
    expect(document.getElementById('lp-stair-e1').classList.contains('is-past')).toBe(true);
    expect(document.getElementById('lp-stair-e2').classList.contains('is-current')).toBe(true);
    expect(document.getElementById('lp-stair-e3').classList.contains('is-current')).toBe(false);
    expect(document.getElementById('lp-stair-e3').classList.contains('is-past')).toBe(false);
  });
});

describe('abrirUpgrade / cerrarUpgrade', () => {
  beforeEach(() => { baseDom(); invalidatePricing(); });

  it('sin usuario logueado, abre el login en vez del modal de upgrade', () => {
    const abrirAuth = vi.fn();
    configureBilling({ getCurrentUser: () => null, abrirAuth });
    abrirUpgrade();
    expect(abrirAuth).toHaveBeenCalled();
    expect(document.getElementById('modalUpgrade').classList.contains('vis')).toBe(false);
  });

  it('con usuario logueado, abre el modal de upgrade', () => {
    configureBilling({ getCurrentUser: () => ({ id: 'u1' }) });
    abrirUpgrade();
    expect(document.getElementById('modalUpgrade').classList.contains('vis')).toBe(true);
  });

  it('cerrarUpgrade quita la clase vis', () => {
    configureBilling({ getCurrentUser: () => ({ id: 'u1' }) });
    abrirUpgrade();
    cerrarUpgrade();
    expect(document.getElementById('modalUpgrade').classList.contains('vis')).toBe(false);
  });
});

describe('iniciarPago — flujo de pago con Mercado Pago', () => {
  beforeEach(() => { baseDom(); invalidatePricing(); });

  it('sin usuario, cierra el modal y abre el login sin llamar a create-payment', async () => {
    const abrirAuth = vi.fn();
    const sb = makeSb();
    configureBilling({ getCurrentUser: () => null, getSupabase: () => sb, abrirAuth });
    await iniciarPago('mensual');
    expect(abrirAuth).toHaveBeenCalled();
    expect(sb.functions.invoke).not.toHaveBeenCalled();
  });

  it('con usuario, invoca create-payment con el plan y redirige a init_point', async () => {
    const sb = makeSb();
    configureBilling({ getCurrentUser: () => ({ id: 'u1' }), getCurrentProfile: () => ({ plan: 'trial' }), getSupabase: () => sb });

    vi.stubGlobal('location', { origin: 'https://resiarg.com.ar', href: '', search: '', pathname: '/' });

    await iniciarPago('mensual');

    expect(sb.functions.invoke).toHaveBeenCalledWith('create-payment', {
      body: { plan: 'mensual', back_url: 'https://resiarg.com.ar' }
    });
    expect(window.location.href).toBe('https://mp.example/pay');
  });

  it('guarda si el usuario ya era pro antes de pagar (para distinguir activación de renovación)', async () => {
    const sb = makeSb();
    configureBilling({ getCurrentUser: () => ({ id: 'u1' }), getCurrentProfile: () => ({ plan: 'pro' }), getSupabase: () => sb });
    vi.stubGlobal('location', { origin: 'https://resiarg.com.ar', href: '', search: '', pathname: '/' });

    await iniciarPago('anual');
    expect(sessionStorage.getItem('resar_era_pro')).toBe('1');
  });

  it('si create-payment falla, restaura el botón y notifica el error sin redirigir', async () => {
    const notify = vi.fn();
    const sb = makeSb({ functions: { invoke: vi.fn(async () => ({ data: null, error: { message: 'rechazado' } })) } });
    configureBilling({ getCurrentUser: () => ({ id: 'u1' }), getCurrentProfile: () => ({}), getSupabase: () => sb, mostrarToast: notify });

    const btn = document.getElementById('btnPagarMensual');
    await iniciarPago('mensual');

    expect(btn.classList.contains('loading')).toBe(false);
    expect(btn.disabled).toBe(false);
    expect(notify).toHaveBeenCalled();
    expect(notify.mock.calls[0][0]).toContain('rechazado');
  });

  it('iniciarPagoDesdeTab delega en iniciarPago con el mismo plan', async () => {
    const sb = makeSb();
    configureBilling({ getCurrentUser: () => ({ id: 'u1' }), getCurrentProfile: () => ({}), getSupabase: () => sb });
    vi.stubGlobal('location', { origin: 'https://resiarg.com.ar', href: '', search: '', pathname: '/' });

    await iniciarPagoDesdeTab('anual');
    expect(sb.functions.invoke).toHaveBeenCalledWith('create-payment', expect.objectContaining({ body: expect.objectContaining({ plan: 'anual' }) }));
  });
});

describe('renderPlanStatus — texto y días restantes por tipo de plan', () => {
  beforeEach(() => { baseDom(); invalidatePricing(); });

  it('no rompe si no existe #planStatusSection', () => {
    document.body.innerHTML = '';
    configureBilling({ getCurrentProfile: () => ({ plan: 'pro' }) });
    expect(() => renderPlanStatus()).not.toThrow();
  });

  it('admin: acceso total, sin fecha de vencimiento', () => {
    configureBilling({ getCurrentProfile: () => ({ plan: 'admin' }) });
    renderPlanStatus();
    const html = document.getElementById('planStatusSection').innerHTML;
    expect(html).toContain('Admin');
    expect(html).toContain('Sin restricciones');
  });

  it('pro con fecha futura: calcula los días restantes correctamente', () => {
    const expira = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    configureBilling({ getCurrentProfile: () => ({ plan: 'pro', plan_expira_at: expira, plan_subtipo: 'mensual' }) });
    renderPlanStatus();
    const html = document.getElementById('planStatusSection').innerHTML;
    expect(html).toContain('10 días restantes');
  });

  it('pro vencido (fecha pasada): muestra "Vencido"', () => {
    const expira = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    configureBilling({ getCurrentProfile: () => ({ plan: 'pro', plan_expira_at: expira }) });
    renderPlanStatus();
    const html = document.getElementById('planStatusSection').innerHTML;
    expect(html).toContain('Vencido');
  });

  it('pro sin fecha de expiración: Activo, sin días restantes', () => {
    configureBilling({ getCurrentProfile: () => ({ plan: 'pro' }) });
    renderPlanStatus();
    expect(document.getElementById('planStatusSection').innerHTML).toContain('Activo');
  });

  it('trial_activo con fecha futura: muestra días restantes de trial premium', () => {
    const expira = new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000).toISOString();
    configureBilling({ getCurrentProfile: () => ({ plan: 'trial_activo', plan_expira_at: expira }) });
    renderPlanStatus();
    const html = document.getElementById('planStatusSection').innerHTML;
    expect(html).toContain('Trial Premium');
    expect(html).toContain('restante');
  });

  it('trial_activo vencido: pasó a trial limitado', () => {
    const expira = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    configureBilling({ getCurrentProfile: () => ({ plan: 'trial_activo', plan_expira_at: expira }) });
    renderPlanStatus();
    expect(document.getElementById('planStatusSection').innerHTML).toContain('Vencido');
  });

  it('trial_limitado: mensaje de acceso parcial', () => {
    configureBilling({ getCurrentProfile: () => ({ plan: 'trial_limitado' }) });
    renderPlanStatus();
    expect(document.getElementById('planStatusSection').innerHTML).toContain('Trial vencido');
  });

  it('trial (gratuito, sin activar premium): muestra el CTA para activar el trial premium', () => {
    configureBilling({ getCurrentProfile: () => ({ plan: 'trial' }) });
    renderPlanStatus();
    const html = document.getElementById('planStatusSection').innerHTML;
    expect(html).toContain('Trial gratuito');
    expect(html).toContain('data-action="activate-trial-premium"');
  });

  it('sin plan: mensaje de "sin plan activo"', () => {
    configureBilling({ getCurrentProfile: () => null });
    renderPlanStatus();
    expect(document.getElementById('planStatusSection').innerHTML).toContain('Sin plan activo');
  });

  it('el badge de ahorro % se calcula desde precio mensual vs anual/3', async () => {
    const sb = makeSb({ rpc: vi.fn(async () => ({ data: fullPricingRpcData({ mensual: { precio: 10000 }, anual: { precio: 24000, precio_anual_equiv: 8000 } }), error: null })) });
    configureBilling({ getSupabase: () => sb, getCurrentProfile: () => ({ plan: 'trial' }) });
    await cargarPrecios();
    document.body.innerHTML += '<span class="plan-opt-badge"></span>';
    renderPlanStatus();
    expect(document.querySelector('.plan-opt-badge').textContent).toBe('Ahorrás 20%');
  });
});

describe('detectMercadoPagoReturn — vuelta desde Mercado Pago (vía ?pago= en la URL)', () => {
  // detectMercadoPagoReturn() tiene un guard de módulo
  // (returnDetectionInstalled) que solo permite instalarse una vez por
  // carga del módulo -- igual que en producción (no se re-arma en cada
  // configureBilling()). Para poder probar cada escenario de ?pago=
  // limpio, reseteamos el módulo y lo reimportamos en cada test.
  beforeEach(async () => {
    baseDom();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    window.history.pushState({}, '', '/');
  });

  function setUrl(query) {
    window.history.pushState({}, '', `/examenes-medicos/${query}`);
  }

  async function freshBilling() {
    return import('../ui/billing.js');
  }

  it('sin ?pago= en la URL, no notifica nada', async () => {
    setUrl('');
    const notify = vi.fn();
    const { configureBilling: freshConfigure } = await freshBilling();
    freshConfigure({ mostrarToast: notify, getSupabase: () => makeSb() });
    vi.runOnlyPendingTimers();
    expect(notify).not.toHaveBeenCalled();
  });

  it('?pago=failure notifica que el pago no se pudo procesar', async () => {
    setUrl('?pago=failure');
    const notify = vi.fn();
    const { configureBilling: freshConfigure } = await freshBilling();
    freshConfigure({ mostrarToast: notify, getSupabase: () => makeSb() });
    vi.advanceTimersByTime(1000);
    expect(notify.mock.calls.some(c => c[0].includes('no pudo procesarse'))).toBe(true);
  });

  it('?pago=pending notifica que el pago está pendiente', async () => {
    setUrl('?pago=pending');
    const notify = vi.fn();
    const { configureBilling: freshConfigure } = await freshBilling();
    freshConfigure({ mostrarToast: notify, getSupabase: () => makeSb() });
    vi.advanceTimersByTime(1000);
    expect(notify.mock.calls.some(c => c[0].includes('pendiente'))).toBe(true);
  });

  it('?pago=success activa el plan pro apenas el perfil lo confirma, y notifica activación (no renovación)', async () => {
    setUrl('?pago=success&plan=mensual');
    const notify = vi.fn();
    const setCurrentProfile = vi.fn();
    const renderUserUI = vi.fn();
    const sb = makeSb({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: { plan: 'pro', plan_expira_at: '2099-01-01' } }))
      }))
    });
    const { configureBilling: freshConfigure } = await freshBilling();
    freshConfigure({
      mostrarToast: notify,
      getSupabase: () => sb,
      getCurrentUser: () => ({ id: 'u1' }),
      getCurrentProfile: () => ({}),
      setCurrentProfile,
      renderUserUI
    });

    expect(notify.mock.calls.some(c => c[0].includes('Activando tu plan'))).toBe(true);

    await vi.advanceTimersByTimeAsync(3000);

    expect(setCurrentProfile).toHaveBeenCalledWith(expect.objectContaining({ plan: 'pro' }));
    expect(renderUserUI).toHaveBeenCalled();
    expect(notify.mock.calls.some(c => c[0].includes('activado'))).toBe(true);
  });

  it('?pago=success renovación: si ya era pro antes de pagar, el mensaje dice "renovado"', async () => {
    setUrl('?pago=success&plan=anual');
    const notify = vi.fn();
    sessionStorage.setItem('resar_era_pro', '1');
    const sb = makeSb({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: { plan: 'pro' } }))
      }))
    });
    const { configureBilling: freshConfigure } = await freshBilling();
    freshConfigure({
      mostrarToast: notify,
      getSupabase: () => sb,
      getCurrentUser: () => ({ id: 'u1' }),
      getCurrentProfile: () => ({}),
      setCurrentProfile: vi.fn(),
      renderUserUI: vi.fn()
    });

    await vi.advanceTimersByTimeAsync(3000);
    expect(notify.mock.calls.some(c => c[0].includes('renovado'))).toBe(true);
  });

  it('?pago=success sin usuario logueado: deja de sondear sin romper', async () => {
    setUrl('?pago=success');
    const sb = makeSb();
    const { configureBilling: freshConfigure } = await freshBilling();
    expect(() => {
      freshConfigure({ getSupabase: () => sb, getCurrentUser: () => null });
      vi.advanceTimersByTime(3000);
    }).not.toThrow();
  });

  it('la URL se limpia (se saca el query ?pago=) apenas se detecta', async () => {
    setUrl('?pago=failure');
    const { configureBilling: freshConfigure } = await freshBilling();
    freshConfigure({ getSupabase: () => makeSb() });
    expect(window.location.search).toBe('');
  });
});
