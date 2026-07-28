// RESIAR v74 — Arena: cancelar búsqueda de rival
// Overlay defensivo: agrega un botón de cancelación sin tocar la lógica interna de challenges.js.
// Además bloquea respuestas tardías de /arena-find-match después de cancelar para que no arranquen partidas ya canceladas.

let installed = false;
let arenaFetchPatched = false;
let cancelledUntil = 0;
let lastCancelAt = 0;
let observer = null;

function now() {
  return Date.now();
}

function isFindMatchUrl(url) {
  return String(url || '').includes('/functions/v1/arena-find-match');
}

function isCancelBody(init) {
  try {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    return body?.action === 'cancel';
  } catch (_) {
    return false;
  }
}

function suppressSearch(ms = 120000) {
  cancelledUntil = now() + ms;
  lastCancelAt = now();
}

function clearSuppress() {
  cancelledUntil = 0;
}

function shouldSuppressFind(init) {
  return cancelledUntil > now() && !isCancelBody(init);
}

function getSupabaseUrl() {
  const explicit = String(window.SUPA_URL || window.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;

  try {
    const stored = window.localStorage?.getItem('supabase.auth.token') || '';
    if (stored.includes('.supabase.co')) {
      const match = stored.match(/https:\/\/[^"']+\.supabase\.co/);
      if (match) return match[0].replace(/\/$/, '');
    }
  } catch (_) {}

  const scripts = Array.from(document.scripts || []);
  for (const script of scripts) {
    const txt = script.textContent || '';
    const match = txt.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
    if (match) return match[0].replace(/\/$/, '');
  }

  return '';
}

async function getAccessToken() {
  try {
    const sb = window.sb || window.supabaseClient || null;
    const sessionResult = await sb?.auth?.getSession?.();
    const token = sessionResult?.data?.session?.access_token;
    if (token) return token;
  } catch (_) {}
  return '';
}

async function sendArenaCancel() {
  const base = getSupabaseUrl();
  if (!base) return false;

  const token = await getAccessToken();
  try {
    await fetch(`${base}/functions/v1/arena-find-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action: 'cancel' })
    });
    return true;
  } catch (_) {
    return false;
  }
}

function patchFetch() {
  if (arenaFetchPatched || typeof window.fetch !== 'function') return;
  arenaFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const input = args[0];
    const init = args[1] || {};
    const url = typeof input === 'string' ? input : input?.url || '';

    if (isFindMatchUrl(url) && shouldSuppressFind(init)) {
      return new Response(JSON.stringify({
        ok: true,
        matched: false,
        cancelled: true,
        resiar_cancelled_locally: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si el usuario vuelve a buscar, se libera la supresión.
    if (isFindMatchUrl(url) && !isCancelBody(init) && cancelledUntil <= now()) {
      clearSuppress();
    }

    return originalFetch(...args);
  };
}

function isSearching() {
  const btn = document.getElementById('arenaFindMatchBtn');
  const info = document.getElementById('desafioInfoLine');
  const text = `${btn?.textContent || ''} ${info?.textContent || ''}`.toLowerCase();
  return Boolean(
    btn?.classList.contains('is-searching') ||
    text.includes('buscando rival') ||
    text.includes('buscando contrincante') ||
    text.includes('matchmaking') ||
    info?.querySelector?.('.arena-lobby-card.searching')
  );
}

function resetArenaUiAfterCancel() {
  const findBtn = document.getElementById('arenaFindMatchBtn');
  if (findBtn) {
    findBtn.disabled = false;
    findBtn.classList.remove('is-searching');
    findBtn.textContent = '🔎 Buscar partida ahora';
  }

  const createBtn = document.getElementById('btnCrearDesafio');
  if (createBtn) createBtn.disabled = false;

  const info = document.getElementById('desafioInfoLine');
  if (info) {
    info.innerHTML = `
      <div class="arena-lobby-card searching arena-search-cancelled" style="border-color:rgba(16,185,129,.28);background:linear-gradient(135deg,rgba(16,185,129,.10),rgba(148,163,184,.06));">
        <div class="arena-lobby-top">
          <div>
            <div class="arena-status-kicker">Arena</div>
            <div class="arena-status-title">Búsqueda cancelada</div>
          </div>
          <div class="arena-code-pill">OK</div>
        </div>
        <div class="arena-lobby-note">Podés volver a buscar rival o crear un código de Arena.</div>
      </div>`;
  }

  document.getElementById('arenaInlineNotice')?.remove();
  document.getElementById('arenaCancelSearchBtn')?.remove();
}

function buildCancelButton() {
  let btn = document.getElementById('arenaCancelSearchBtn');
  if (btn) return btn;

  btn = document.createElement('button');
  btn.id = 'arenaCancelSearchBtn';
  btn.type = 'button';
  btn.className = 'mbsec arena-cancel-search-btn';
  btn.textContent = 'Cancelar búsqueda';
  btn.style.cssText = [
    'width:100%',
    'margin:8px 0 0',
    'min-height:44px',
    'border-radius:14px',
    'font-weight:800',
    'border:1px solid rgba(248,113,113,.28)',
    'background:linear-gradient(135deg,rgba(248,113,113,.10),rgba(148,163,184,.05))',
    'color:var(--red,#f43f5e)'
  ].join(';');

  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    suppressSearch();
    btn.disabled = true;
    btn.textContent = 'Cancelando...';

    await sendArenaCancel();
    resetArenaUiAfterCancel();

    btn.disabled = false;
    btn.textContent = 'Cancelar búsqueda';
    btn.remove();
  });

  return btn;
}

function ensureCancelButton() {
  const findBtn = document.getElementById('arenaFindMatchBtn');
  if (!findBtn) return;

  // Si el usuario hace click en buscar, se libera una cancelación anterior.
  // Esto permite que el botón vuelva a aparecer recién en una nueva búsqueda.
  if (!findBtn.dataset.resiarCancelHooked) {
    findBtn.dataset.resiarCancelHooked = '1';
    findBtn.addEventListener('click', () => {
      if (now() - lastCancelAt > 400) {
        clearSuppress();
      }
      setTimeout(ensureCancelButton, 120);
      setTimeout(ensureCancelButton, 650);
    }, true);
  }

  const existing = document.getElementById('arenaCancelSearchBtn');

  // Después de cancelar, no reinsertar el botón aunque el DOM todavía conserve
  // textos viejos como "buscando rival". Se habilita de nuevo solo cuando
  // el usuario toca otra vez "Buscar partida ahora".
  if (cancelledUntil > now()) {
    if (existing) existing.remove();
    return;
  }

  if (!isSearching()) {
    if (existing) existing.remove();
    return;
  }

  const cancelBtn = buildCancelButton();
  if (!cancelBtn.isConnected) {
    findBtn.insertAdjacentElement('afterend', cancelBtn);
  }
}

function installStyle() {
  if (document.getElementById('resiar-arena-cancel-style-v74')) return;
  const style = document.createElement('style');
  style.id = 'resiar-arena-cancel-style-v74';
  style.textContent = `
    #modalDesafio #arenaCancelSearchBtn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(248,113,113,.14);
    }
    #modalDesafio #arenaCancelSearchBtn:disabled {
      opacity: .65;
      cursor: wait;
    }
  `;
  document.head.appendChild(style);
}

export function installArenaCancelSearchPatch() {
  if (installed) return;
  installed = true;

  patchFetch();
  installStyle();

  const tick = () => {
    try { ensureCancelButton(); } catch (_) {}
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target?.id === 'arenaFindMatchBtn') {
      setTimeout(tick, 0);
      setTimeout(tick, 150);
      setTimeout(tick, 700);
    }
  }, true);

  observer = new MutationObserver(tick);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'disabled']
  });

  setInterval(tick, 1200);

  try {
    window.resiarCancelArenaSearch = async () => {
      suppressSearch();
      await sendArenaCancel();
      resetArenaUiAfterCancel();
      document.getElementById('arenaCancelSearchBtn')?.remove();
    };
  } catch (_) {}
}

export default installArenaCancelSearchPatch;
