/*
 * ResiAR — billing, precios y estado de plan.
 *
 * Mantiene separado el dominio de precios/upgrade/pagos sin cambiar la
 * estructura visual existente ni el backend actual de Supabase/Mercado Pago.
 */

let deps = {};
let configured = false;
let returnDetectionInstalled = false;
let modalClickInstalled = false;

// Caché de precios para no consultar dos veces.
let _precios = null;
let _enLanzamiento = false;
let _prosCount = 0;

const TRAMO_LABELS = {
  1: { cupo: 25,  label: '🚀 LANZAMIENTO',     sub: (r) => `${r} lugar${r !== 1 ? 'es' : ''} disponibles` },
  2: { cupo: 50,  label: '⚡ PRECIO ESPECIAL',  sub: (r) => `${r} lugar${r !== 1 ? 'es' : ''} disponibles` },
  3: { cupo: 75,  label: '⚡ PRECIO ESPECIAL',  sub: (r) => `${r} lugar${r !== 1 ? 'es' : ''} disponibles` },
  4: { cupo: null, label: '',                  sub: () => '' },
};

function getSupabase() {
  return deps.getSupabase?.() || window.sb || null;
}

function getSupabaseUrl() {
  return deps.getSupabaseUrl?.() || window.SUPA_URL || '';
}

function getCurrentUser() {
  return deps.getCurrentUser?.() || null;
}

function getCurrentProfile() {
  return deps.getCurrentProfile?.() || null;
}

function setCurrentProfile(profile) {
  if (typeof deps.setCurrentProfile === 'function') deps.setCurrentProfile(profile);
}

function notify(message, duration) {
  if (typeof deps.mostrarToast === 'function') deps.mostrarToast(message, duration);
}

function openAuth() {
  if (typeof deps.abrirAuth === 'function') deps.abrirAuth();
}

function rerenderUser() {
  if (typeof deps.renderUserUI === 'function') deps.renderUserUI();
}

function updateOptionsSummary() {
  if (typeof deps.sbUpdateOpcionesSummary === 'function') deps.sbUpdateOpcionesSummary();
}

export function configureBilling(options = {}) {
  deps = { ...deps, ...options };
  configured = true;

  installUpgradeModalDismiss();
  detectMercadoPagoReturn();
  cargarPrecios();
}

export function invalidatePricing() {
  _precios = null;
}

export function getPricingState() {
  return {
    precios: _precios,
    enLanzamiento: _enLanzamiento,
    prosCount: _prosCount
  };
}

export async function cargarPrecios() {
  const sb = getSupabase();
  if (!sb || typeof sb.rpc !== 'function') return;

  try {
    const { data, error } = await sb.rpc('get_precios_actuales');

    if (error || !data) {
      console.warn('cargarPrecios: error al llamar get_precios_actuales.', error?.message);
      return;
    }

    _prosCount = Number(data.pros_count) || 0;
    _enLanzamiento = Number(data.tramo) < 4;

    _precios = {
      mensual: { precio: data.mensual?.precio },
      anual: {
        precio: data.anual?.precio,
        precio_anual_equiv: data.anual?.precio_anual_equiv
      },
      _tramo: Number(data.tramo) || 4
    };

    aplicarPreciosDOM();
  } catch (e) {
    console.warn('cargarPrecios error:', e.message);
  }
}

export function formatPrecio(num) {
  return Number(num || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

export function aplicarPreciosDOM() {
  if (!_precios) return;

  const m = _precios.mensual;
  const a = _precios.anual;
  const tramo = _precios._tramo || 3;
  const ti = TRAMO_LABELS[tramo];

  // Badge del plan popular en landing y tab (mensual + trimestral).
  const popularEl = document.querySelector('.lp-plan-popular');
  const popularTrimEl = document.getElementById('lpPopularTrimestral');

  if (tramo < 4 && ti) {
    const cupoMax = tramo === 1 ? 25 : tramo === 2 ? 50 : 75;
    const restantes = Math.max(0, cupoMax - _prosCount);
    const badgeText = tramo === 1 ? 'Precio de lanzamiento' : tramo === 2 ? 'Precio especial E2' : 'Precio especial E3';
    const badgeHTML = `
      <span style="font-size:.72rem;letter-spacing:0">🚀</span>
      <span style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <span>${badgeText}</span>
        <span style="font-size:.52rem;font-weight:600;opacity:.9;letter-spacing:.03em;text-transform:none;">
          Faltan <strong style="font-weight:800;">${restantes}</strong> cupo${restantes !== 1 ? 's' : ''} para el siguiente precio
        </span>
      </span>`;

    if (popularEl) {
      popularEl.style.display = 'flex';
      popularEl.style.padding = '6px 18px';
      popularEl.innerHTML = badgeHTML;
    }

    if (popularTrimEl) {
      popularTrimEl.style.display = 'flex';
      popularTrimEl.style.padding = '6px 18px';
      popularTrimEl.innerHTML = badgeHTML;
    }
  } else {
    if (popularEl) popularEl.style.display = 'none';
    if (popularTrimEl) popularTrimEl.style.display = 'none';
  }

  if (m) {
    const pmStr = '$' + formatPrecio(m.precio);

    const lpM = document.getElementById('lpPrecioMensual');
    if (lpM) lpM.innerHTML = pmStr + '<span> /mes</span>';

    const upM = document.getElementById('upgradePrecioMensual');
    if (upM) upM.innerHTML = pmStr + '<span>/mes</span>';

    const tabM = document.getElementById('tabPrecioMensual');
    if (tabM) tabM.innerHTML = pmStr + '<span>/mes</span>';

    const tabMEquiv = document.getElementById('tabPrecioMensualEquiv');
    if (tabMEquiv) {
      tabMEquiv.textContent = tramo < 4 ? (
        tramo === 1 ? 'Precio de lanzamiento — primeros 25 usuarios' :
        tramo === 2 ? 'Precio especial — usuarios 26 a 50' :
        'Precio especial — usuarios 51 a 75'
      ) : '';
    }
  }

  if (a) {
    const paStr = '$' + formatPrecio(a.precio);

    const lpA = document.getElementById('lpPrecioAnual');
    if (lpA) lpA.innerHTML = paStr + '<span> /trimestre</span>';

    const upA = document.getElementById('upgradePrecioAnual');
    if (upA) upA.innerHTML = paStr + '<span>/trimestre</span>';

    const tabA = document.getElementById('tabPrecioAnual');
    if (tabA) tabA.innerHTML = paStr + '<span>/trimestre</span>';

    if (a.precio_anual_equiv) {
      const equiv = document.getElementById('tabPrecioAnualEquiv');
      if (equiv) equiv.textContent = '≈ $' + formatPrecio(a.precio_anual_equiv) + ' / mes';
    }
  }

  actualizarEscalonesDOM();
}

function actualizarEscalonesDOM() {
  if (!_precios) return;

  const escalon = _precios._tramo || 4;
  const prosCount = _prosCount || 0;

  const bar = document.getElementById('lp-pros-bar');
  const countEl = document.getElementById('lp-pros-count');
  if (bar) bar.style.width = Math.min(100, prosCount) + '%';
  if (countEl) countEl.textContent = prosCount;

  for (let e = 1; e <= 4; e++) {
    const block = document.getElementById('lp-stair-e' + e);
    const label = document.getElementById('lp-e' + e + '-label');
    if (!block) continue;

    block.classList.remove('is-current', 'is-past');
    block.style.opacity = '';

    if (e < escalon) {
      block.classList.add('is-past');
      block.style.opacity = '0.45';
      if (label) label.textContent = 'E' + e;
    } else if (e === escalon) {
      block.classList.add('is-current');
      if (label) label.textContent = 'E' + e;
    } else if (label) {
      label.textContent = 'E' + e;
    }
  }
}

export function abrirUpgrade() {
  if (!getCurrentUser()) {
    openAuth();
    return;
  }

  aplicarPreciosDOM();
  document.getElementById('modalUpgrade')?.classList.add('vis');
}

export function cerrarUpgrade() {
  document.getElementById('modalUpgrade')?.classList.remove('vis');
}

function installUpgradeModalDismiss() {
  if (modalClickInstalled) return;
  const modal = document.getElementById('modalUpgrade');
  if (!modal) return;

  modalClickInstalled = true;
  modal.addEventListener('click', function(e) {
    if (e.target === this) cerrarUpgrade();
  });
}

export async function iniciarPago(plan) {
  const currentUser = getCurrentUser();
  const currentProfile = getCurrentProfile();
  const sb = getSupabase();

  if (!currentUser) {
    cerrarUpgrade();
    openAuth();
    return;
  }

  const btnId = plan === 'mensual' ? 'btnPagarMensual' : 'btnPagarAnual';
  const btn = document.getElementById(btnId);
  const originalText = btn?.textContent || '';

  if (btn) {
    btn.classList.add('loading');
    btn.textContent = 'Preparando';
    btn.disabled = true;
  }

  try {
    const appOrigin = window.location.origin;

    const { data, error } = await sb.functions.invoke('create-payment', {
      body: {
        plan,
        back_url: appOrigin
      }
    });

    if (error) throw new Error(error.message || 'Error al crear pago');
    if (!data?.init_point) throw new Error('No se recibió URL de pago');

    sessionStorage.setItem('resar_era_pro', currentProfile?.plan === 'pro' ? '1' : '0');
    window.location.href = data.init_point;
  } catch (e) {
    if (btn) {
      btn.classList.remove('loading');
      btn.textContent = originalText;
      btn.disabled = false;
    }
    notify('❌ Error: ' + e.message);
  }
}

function detectMercadoPagoReturn() {
  if (returnDetectionInstalled) return;
  returnDetectionInstalled = true;

  const params = new URLSearchParams(window.location.search);
  const pago = params.get('pago');
  if (!pago) return;

  history.replaceState({}, '', window.location.pathname);

  if (pago === 'success') {
    const planRetorno = params.get('plan') || null;
    notify('✅ ¡Pago procesado! Activando tu plan Pro...');

    let intentos = 0;
    let fallbackYaLlamado = false;

    const activarUI = (data) => {
      const eraProAntes = sessionStorage.getItem('resar_era_pro') === '1';
      sessionStorage.removeItem('resar_era_pro');

      const mergedProfile = { ...(getCurrentProfile() || {}), ...data };
      setCurrentProfile(mergedProfile);

      rerenderUser();
      document.getElementById('upgradeBanner')?.classList.remove('vis');
      document.getElementById('btnSmartExam')?.classList.remove('btn-pro-locked');
      document.getElementById('btnRepaso')?.classList.remove('btn-pro-locked');

      const smartBtn = document.getElementById('btnSmartExam');
      if (smartBtn) smartBtn.disabled = false;

      updateOptionsSummary();

      const msg = eraProAntes
        ? '🔄 Plan Pro renovado. ¡Seguís con acceso ilimitado!'
        : '🎉 ¡Plan Pro activado! Ahora tenés acceso ilimitado.';
      notify(msg);
      cerrarUpgrade();
    };

    const verificar = setInterval(async () => {
      intentos++;
      const currentUser = getCurrentUser();
      const sb = getSupabase();
      if (!currentUser) {
        clearInterval(verificar);
        return;
      }

      try {
        const { data } = await sb.from('profiles')
          .select('plan, plan_expira_at, plan_subtipo')
          .eq('id', currentUser.id)
          .single();

        if (data?.plan === 'pro') {
          clearInterval(verificar);
          activarUI(data);
          return;
        }

        if (intentos === 5 && planRetorno && !fallbackYaLlamado) {
          fallbackYaLlamado = true;
          try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.access_token) {
              const fbRes = await fetch(getSupabaseUrl() + '/functions/v1/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + session.access_token,
                },
                body: JSON.stringify({ plan: planRetorno }),
              });
              const fbData = await fbRes.json();
              if (fbData.ok) {
                intentos = 5;
              } else {
                console.warn('[retorno MP] fallback respondió:', fbData.reason);
              }
            }
          } catch (fe) {
            console.warn('[retorno MP] fallback error:', fe.message);
          }
        }

        if (intentos >= 10) {
          clearInterval(verificar);
          notify('⏳ El pago fue procesado. Si el plan no se activó en 1 min, recargá la página.');
        }
      } catch (_) {
        clearInterval(verificar);
      }
    }, 3000);
  } else if (pago === 'failure') {
    setTimeout(() => notify('❌ El pago no pudo procesarse. Podés intentarlo de nuevo.'), 1000);
  } else if (pago === 'pending') {
    setTimeout(() => notify('⏳ Pago pendiente. Te avisaremos cuando se acredite.'), 1000);
  }
}

export function renderPlanStatus() {
  const el = document.getElementById('planStatusSection');
  if (!el) return;

  const currentProfile = getCurrentProfile();
  const plan = currentProfile?.plan;
  const expira = currentProfile?.plan_expira_at;
  const subtipo = currentProfile?.plan_subtipo;

  let cardClass = '';
  let icon = '';
  let nombre = '';
  let detalle = '';

  if (plan === 'admin') {
    cardClass = 'admin'; icon = '👑'; nombre = 'Admin';
    detalle = 'Acceso total · Sin restricciones';
  } else if (plan === 'pro' && expira) {
    const dias = Math.ceil((new Date(expira) - new Date()) / (1000 * 60 * 60 * 24));
    const fechaStr = new Date(expira).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
    if (dias <= 0) {
      cardClass = 'vencido'; icon = '❌'; nombre = 'Pro · Vencido';
      detalle = 'Tu plan venció el ' + fechaStr;
    } else {
      cardClass = 'pro'; icon = '⭐'; nombre = 'Pro' + (subtipo ? ' · ' + (subtipo === 'anual' ? 'Trimestral' : 'Mensual') : '');
      const color = dias <= 7 ? 'var(--red)' : dias <= 15 ? 'var(--amber)' : 'var(--green)';
      detalle = `Vence el ${fechaStr} · <span style="color:${color};font-weight:700;">${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}</span>`;
    }
  } else if (plan === 'pro') {
    cardClass = 'pro'; icon = '⭐'; nombre = 'Pro' + (subtipo ? ' · ' + (subtipo === 'anual' ? 'Trimestral' : 'Mensual') : '');
    detalle = 'Activo';
  } else if (plan === 'trial_activo' && expira) {
    const dias = Math.ceil((new Date(expira) - new Date()) / (1000 * 60 * 60 * 24));
    const fechaStr = new Date(expira).toLocaleDateString('es', { day: '2-digit', month: 'long' });
    if (dias <= 0) {
      cardClass = 'vencido'; icon = '⏱️'; nombre = 'Trial Premium · Vencido';
      detalle = 'Tu trial venció el ' + fechaStr + '. Pasaste a trial limitado.';
    } else {
      cardClass = 'trial'; icon = '🔓'; nombre = 'Trial Premium';
      const color = dias <= 1 ? 'var(--red)' : 'var(--green)';
      detalle = `Acceso completo hasta el ${fechaStr} · <span style="color:${color};font-weight:700;">${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}</span>`;
    }
  } else if (plan === 'trial_activo') {
    cardClass = 'trial'; icon = '🔓'; nombre = 'Trial Premium';
    detalle = 'Acceso completo por 2 días';
  } else if (plan === 'trial_limitado') {
    cardClass = 'vencido'; icon = '⏱️'; nombre = 'Trial vencido';
    detalle = 'Todos los exámenes (1% c/u) · Acceso completo bloqueado · Suscribite para acceso completo';
  } else if (plan === 'trial') {
    cardClass = 'trial'; icon = '🔓'; nombre = 'Trial gratuito';
    detalle = 'EU completo · 1% de cada otro examen disponible';
  } else {
    icon = '🔒'; nombre = 'Sin plan activo';
    detalle = 'Adquirí un plan para acceder a todas las preguntas';
  }

  const escalon = _precios?._tramo || 4;
  const cupoEscalon = escalon === 1 ? 25 : escalon === 2 ? 50 : escalon === 3 ? 75 : 100;
  const restantesEscalon = Math.max(0, cupoEscalon - _prosCount);
  const escalonLabel = escalon === 1 ? 'lanzamiento (Escalón 1/4)' : `especial (Escalón ${escalon}/4)`;
  const lanzamientoBadge = _enLanzamiento
    ? `<div style="margin:20px 0 16px;padding:14px 18px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.22);border-radius:14px;display:flex;align-items:center;gap:14px;">
        <span style="font-size:1.5rem;flex-shrink:0;line-height:1;">🚀</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--amber);margin-bottom:3px;">Precio de ${escalonLabel} activo</div>
          <div style="font-size:0.73rem;color:var(--text2);line-height:1.5;">Quedan <strong style="color:var(--amber);">${restantesEscalon} lugares</strong> en este escalón. Al completarse, el precio sube al siguiente automáticamente.</div>
        </div>
       </div>`
    : '';

  const m = _precios?.mensual;
  const a = _precios?.anual;
  const pctAhorro = (m && a) ? Math.round((1 - (a.precio / (m.precio * 3))) * 100) : 20;

  document.querySelectorAll('.plan-opt-badge, .plan-badge-ahorro').forEach(b => {
    b.textContent = `Ahorrás ${pctAhorro}%`;
  });

  const upgradeDescAnual = document.getElementById('upgradeDescAnual');
  if (upgradeDescAnual && a) {
    const equivMes = a.precio_anual_equiv ? formatPrecio(a.precio_anual_equiv) : formatPrecio(Math.round(a.precio / 3));
    upgradeDescAnual.innerHTML = `$${equivMes}/mes equiv.<br>Acceso por 3 meses.`;
  }

  const trialCtaHtml = plan === 'trial' ? `
    <div class="plan-trial-cta">
      <div class="plan-trial-cta-text">
        🎁 <strong>2 días de acceso total, gratis.</strong> El trial no arranca solo — vos elegís cuándo activarlo para aprovecharlo al máximo. Sin tarjeta de crédito.
      </div>
      <button class="plan-trial-cta-btn" data-action="activate-trial-premium">Activar cuando quiera →</button>
    </div>` : '';

  el.innerHTML =
    '<div class="plan-status-card ' + cardClass + '">' +
      '<div class="plan-status-inner">' +
        '<div class="plan-status-icon">' + icon + '</div>' +
        '<div class="plan-status-info">' +
          '<div class="plan-status-name">' + nombre + '</div>' +
          '<div class="plan-status-detail">' + detalle + '</div>' +
        '</div>' +
      '</div>' +
      trialCtaHtml +
    '</div>' +
    lanzamientoBadge;
}

export function iniciarPagoDesdeTab(plan) {
  iniciarPago(plan);
}
