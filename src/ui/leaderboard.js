let deps = {
  getSupabase: () => window.sb,
  getCurrentUser: () => null,
  abrirAuth: () => {},
  escapeHtml: (value) => String(value ?? '')
};

let lbFilterVal = 'historico';

export function configureLeaderboard(options = {}) {
  deps = { ...deps, ...options };
}


function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanLeaderboardName(value, fallbackId = '') {
  const raw = String(value ?? '').trim();
  const invalid = !raw || raw === '-' || raw === '—' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined';
  if (!invalid) return raw;

  const id = String(fallbackId || '').trim();
  return id ? `Usuario ${id.slice(0, 4)}` : 'Usuario';
}

function initialsFromName(value) {
  const name = cleanLeaderboardName(value);
  const parts = name
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function colPct(pct) {
  const p = Number(pct) || 0;
  return p >= 70 ? 'var(--green)' : p >= 50 ? 'var(--amber)' : 'var(--red)';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export async function abrirLeaderboard() {
  const currentUser = deps.getCurrentUser?.();
  if (!currentUser) {
    deps.abrirAuth?.();
    return;
  }

  const modal = document.getElementById('modalLeaderboard');
  if (modal) modal.classList.add('vis');

  lbFilterVal = 'historico';
  document.querySelectorAll('.lb-filter').forEach((button, index) => {
    button.classList.toggle('active', index === 0);
  });

  await cargarLeaderboard();
}

export function setLbFilter(filter, button) {
  lbFilterVal = filter || 'historico';

  document.querySelectorAll('.lb-filter').forEach((item) => {
    item.classList.remove('active');
  });

  if (button) button.classList.add('active');
  cargarLeaderboard();
}

export async function cargarLeaderboard() {
  const sb = deps.getSupabase?.();
  const currentUser = deps.getCurrentUser?.();
  const escapeHtml = deps.escapeHtml || ((value) => String(value ?? ''));

  const list = document.getElementById('lbList');
  const subtitle = document.getElementById('lbSubtitle');
  const colA = document.getElementById('lbColA');
  const colB = document.getElementById('lbColB');
  const colC = document.getElementById('lbColC');

  if (!list) return;
  list.innerHTML = '<div class="lb-empty">Cargando...</div>';

  if (!sb || typeof sb.from !== 'function') {
    list.innerHTML = '<div class="lb-empty">No se pudo conectar con Supabase.</div>';
    return;
  }

  try {
    const { data, error } = await sb.rpc('get_ranking_global');

    if (error) throw error;
    if (!data?.length) {
      list.innerHTML = '<div class="lb-empty">Sin resultados aún</div>';
      return;
    }

    const usuarios = data.map((u) => {
      const isCurrent = u.user_id === currentUser?.id;
      const currentFallback = isCurrent
        ? (currentUser?.user_metadata?.username || currentUser?.email?.split('@')?.[0] || '')
        : '';

      return {
        user_id: u.user_id,
        username: cleanLeaderboardName(u.username || u.display_name || currentFallback, u.user_id),
        sesiones: toNumber(u.sesiones),
        totalPregs: toNumber(u.total_preguntas),
        totalCorrects: toNumber(u.total_correctas),
        pctHistorico: toNumber(u.pct_historico),
        mejorPct: toNumber(u.mejor_pct),
        mejorTotal: toNumber(u.mejor_total),
        mejorCorrectas: toNumber(u.mejor_correctas)
      };
    });

    let sorted;

    if (lbFilterVal === 'historico') {
      sorted = usuarios.filter((u) => u.totalPregs >= 5).sort((a, b) => {
        if (b.pctHistorico !== a.pctHistorico) return b.pctHistorico - a.pctHistorico;
        if (b.totalPregs !== a.totalPregs) return b.totalPregs - a.totalPregs;
        return b.sesiones - a.sesiones;
      });
      if (subtitle) subtitle.textContent = 'Rendimiento histórico global · % correctas acumuladas (mín. 5 preguntas)';
      if (colA) colA.textContent = '% global';
      if (colB) colB.textContent = 'Respondidas';
      if (colC) colC.textContent = 'Sesiones';
    } else if (lbFilterVal === 'sesiones') {
      sorted = usuarios.sort((a, b) => {
        if (b.sesiones !== a.sesiones) return b.sesiones - a.sesiones;
        return b.totalPregs - a.totalPregs;
      });
      if (subtitle) subtitle.textContent = 'Ranking por cantidad de sesiones completadas';
      if (colA) colA.textContent = 'Sesiones';
      if (colB) colB.textContent = 'Respondidas';
      if (colC) colC.textContent = '% global';
    } else if (lbFilterVal === 'preguntas') {
      sorted = usuarios.sort((a, b) => {
        if (b.totalPregs !== a.totalPregs) return b.totalPregs - a.totalPregs;
        return b.pctHistorico - a.pctHistorico;
      });
      if (subtitle) subtitle.textContent = 'Ranking por total de preguntas respondidas';
      if (colA) colA.textContent = 'Respondidas';
      if (colB) colB.textContent = 'Correctas';
      if (colC) colC.textContent = '% global';
    } else if (lbFilterVal === 'mejor') {
      sorted = usuarios.filter((u) => u.mejorTotal >= 5).sort((a, b) => {
        if (b.mejorPct !== a.mejorPct) return b.mejorPct - a.mejorPct;
        return b.mejorTotal - a.mejorTotal;
      });
      if (subtitle) subtitle.textContent = 'Mejor sesión · ajustada por confianza estadística (mín. 5 preguntas)';
      if (colA) colA.textContent = 'Mejor sesión';
      if (colB) colB.textContent = 'Respondidas';
      if (colC) colC.textContent = '% global';
    } else {
      sorted = usuarios.sort((a, b) => {
        if (b.pctHistorico !== a.pctHistorico) return b.pctHistorico - a.pctHistorico;
        return b.totalPregs - a.totalPregs;
      });
    }

    sorted = sorted.slice(0, 30);

    list.innerHTML = sorted.map((u, index) => {
      const rank = index + 1;
      const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const topCls = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
      const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      const isMe = u.user_id === currentUser?.id;
      const initials = initialsFromName(u.username || '?');

      let valA;
      let valB;
      let valC;
      let barPct;
      let barColor;

      if (lbFilterVal === 'historico') {
        barPct = u.pctHistorico;
        barColor = colPct(u.pctHistorico);
        valA = `<strong style="color:${colPct(u.pctHistorico)}">${u.pctHistorico}%</strong>`;
        valB = u.totalPregs.toLocaleString();
        valC = u.sesiones;
      } else if (lbFilterVal === 'sesiones') {
        barPct = Math.min(100, Math.round(u.sesiones / (sorted[0]?.sesiones || 1) * 100));
        barColor = 'var(--accent)';
        valA = `<strong style="color:var(--accent)">${u.sesiones}</strong>`;
        valB = u.totalPregs.toLocaleString();
        valC = `<span style="color:${colPct(u.pctHistorico)}">${u.pctHistorico}%</span>`;
      } else if (lbFilterVal === 'preguntas') {
        barPct = Math.min(100, Math.round(u.totalPregs / (sorted[0]?.totalPregs || 1) * 100));
        barColor = 'var(--accent)';
        valA = `<strong style="color:var(--accent)">${u.totalPregs.toLocaleString()}</strong>`;
        valB = u.totalCorrects.toLocaleString();
        valC = `<span style="color:${colPct(u.pctHistorico)}">${u.pctHistorico}%</span>`;
      } else {
        barPct = u.mejorPct;
        barColor = colPct(u.mejorPct);
        const ctx = u.mejorTotal > 0
          ? `<div style="font-size:0.6rem;color:var(--text3);margin-top:1px;">${u.mejorCorrectas}/${u.mejorTotal}</div>`
          : '';
        valA = `<strong style="color:${colPct(u.mejorPct)}">${u.mejorPct}%</strong>${ctx}`;
        valB = u.totalPregs.toLocaleString();
        valC = `<span style="color:${colPct(u.pctHistorico)}">${u.pctHistorico}%</span>`;
      }

      return `<div class="lb-row ${topCls} ${isMe ? 'me' : ''}">
        <div class="lb-rank ${rankCls}">${rankIcon}</div>
        <div class="lb-user-cell">
          <div class="lb-avatar">${escapeHtml(initials)}</div>
          <div class="lb-user-info">
            <div class="lb-name">${escapeHtml(u.username || '—')}${isMe ? '<span class="lb-yo-tag">yo</span>' : ''}</div>
            <div class="lb-bar-wrap"><div class="lb-bar-fill" data-w="${Number(barPct) || 0}" style="width:0%;background:${barColor};"></div></div>
          </div>
        </div>
        <div class="lb-n">${valA}</div>
        <div class="lb-n">${valB}</div>
        <div class="lb-n right">${valC}</div>
      </div>`;
    }).join('');

    setTimeout(() => {
      list.querySelectorAll('.lb-bar-fill[data-w]').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    }, 60);

    if (!sorted.length) {
      list.innerHTML = '<div class="lb-empty">Sin datos suficientes aún</div>';
    }
  } catch (error) {
    list.innerHTML = `<div class="lb-empty">Error al cargar: ${escapeHtml(error.message || 'Error desconocido')}</div>`;
  }
}
