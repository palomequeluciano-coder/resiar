import { ESP_CANONICAL, formatEsp as formatEspCatalog, normEspecialidadKey } from '../utils/text.js';

let cfg = {
  getSupabase: () => window.sb,
  getCurrentUser: () => null,
  getCurrentProfile: () => null,
  setCurrentProfile: () => {},
  openAuth: () => {},
  renderUserUI: () => {},
  renderPlanStatus: () => {},
  applyPricingDom: () => {},
  splitEspecialidades: (value) => String(value || '').split(',').map(x => x.trim()).filter(Boolean),
  formatEsp: (value) => String(value || '')
};

export function configureProfile(options = {}) {
  cfg = { ...cfg, ...options };
}

function q(id) {
  return document.getElementById(id);
}

function currentUser() {
  return cfg.getCurrentUser?.() || null;
}

function currentProfile() {
  return cfg.getCurrentProfile?.() || null;
}

function sb() {
  return cfg.getSupabase?.() || window.sb;
}

function colPct(pct) {
  const n = Number(pct) || 0;
  return n >= 70 ? 'var(--green)' : n >= 50 ? 'var(--amber)' : 'var(--red)';
}

function setUsernameMessage(msg, txt, ok) {
  if (!msg) return;
  msg.textContent = txt;
  msg.style.display = 'block';
  msg.style.background = ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)';
  msg.style.border = ok ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(248,113,113,0.25)';
  msg.style.color = ok ? 'var(--green)' : 'var(--red)';
}


function ensureProfileWideUiPatch() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('resiar-profile-wide-ui-v74')) return;

  const style = document.createElement('style');
  style.id = 'resiar-profile-wide-ui-v74';
  style.textContent = `
    :root {
      --resiar-profile-wide: min(1120px, calc(100vw - 44px));
    }

    #modalPerfil.vis,
    #modalPerfil {
      align-items: center !important;
      justify-content: center !important;
    }

    #modalPerfil > .modal-inner,
    #modalPerfil > .modal-card,
    #modalPerfil > .modal-content,
    #modalPerfil > .mcard,
    #modalPerfil > .modal-box,
    #modalPerfil > div:not(.modal-backdrop):not(.backdrop),
    #modalPerfil #modalInner,
    #modalPerfil .profile-modal,
    #modalPerfil .profile-card {
      width: var(--resiar-profile-wide) !important;
      max-width: var(--resiar-profile-wide) !important;
    }

    #modalPerfil .modal-inner,
    #modalPerfil .modal-card,
    #modalPerfil .modal-content,
    #modalPerfil .mcard,
    #modalPerfil .modal-box,
    #modalPerfil #modalInner,
    #modalPerfil .profile-modal,
    #modalPerfil .profile-card {
      border-radius: 28px !important;
    }

    #modalPerfil #profileContent {
      max-width: none !important;
    }

    #modalPerfil .sgrid {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 14px !important;
    }

    #modalPerfil .best-worst {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 14px !important;
    }

    #modalPerfil .sessions-chart {
      min-height: 88px !important;
    }

    #modalPerfil .bw-card,
    #modalPerfil .scard {
      min-width: 0 !important;
    }

    #modalPerfil .profile-tabs,
    #modalPerfil .profile-username-box,
    #modalPerfil .plan-info-card {
      max-width: none !important;
    }

    @media (max-width: 860px) {
      :root {
        --resiar-profile-wide: calc(100vw - 22px);
      }

      #modalPerfil > .modal-inner,
      #modalPerfil > .modal-card,
      #modalPerfil > .modal-content,
      #modalPerfil > .mcard,
      #modalPerfil > .modal-box,
      #modalPerfil > div:not(.modal-backdrop):not(.backdrop),
      #modalPerfil #modalInner,
      #modalPerfil .profile-modal,
      #modalPerfil .profile-card {
        width: var(--resiar-profile-wide) !important;
        max-width: var(--resiar-profile-wide) !important;
      }

      #modalPerfil .sgrid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      #modalPerfil .best-worst {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}



function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pctFrom(correctas, total) {
  const t = safeNumber(total);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((safeNumber(correctas) / t) * 100)));
}

function compactTime(ms) {
  const n = safeNumber(ms, 0);
  if (!n) return '';
  if (n < 1000) return Math.round(n) + ' ms';
  return Math.round(n / 1000) + ' s';
}

function formatExamDuration(ms) {
  const n = safeNumber(ms, 0);
  if (!n) return '';
  const totalSeconds = Math.max(0, Math.round(n / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function modeLabel(mode) {
  const raw = String(mode || '').trim().toLowerCase();
  if (!raw || raw === 'exam') return 'Examen';
  if (raw.includes('weak')) return 'Debilidades';
  if (raw.includes('error') || raw.includes('mistake')) return 'Errores';
  if (raw.includes('challenge')) return 'Desafío';
  if (raw.includes('arena')) return 'Arena';
  return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeExamPart(value) {
  const text = String(value == null ? '' : value).trim();
  return text || '';
}

function readAnswerExamInfo(answer) {
  const metadata = answer && typeof answer.metadata === 'object' && !Array.isArray(answer.metadata)
    ? answer.metadata
    : {};

  const examen = normalizeExamPart(
    metadata.examen ??
    metadata.exam ??
    metadata.banco ??
    metadata.bank ??
    answer?.examen ??
    answer?.exam
  );

  const anio = normalizeExamPart(
    metadata.anio ??
    metadata.year ??
    answer?.anio ??
    answer?.year
  );

  const tipo = normalizeExamPart(
    metadata.tipo ??
    metadata.type ??
    answer?.tipo ??
    answer?.type
  );

  if (!examen && !anio && !tipo) return null;

  return {
    examen,
    anio,
    tipo,
    key: `${examen.toUpperCase()}::${anio}::${tipo.toLowerCase()}`,
    label: formatSpecificExamLabel({ examen, anio, tipo })
  };
}

function formatSpecificExamLabel(info) {
  const examen = normalizeExamPart(info?.examen);
  const anio = normalizeExamPart(info?.anio);
  const tipo = normalizeExamPart(info?.tipo);

  const parts = [];
  if (examen) parts.push(examen.toUpperCase());
  if (anio) parts.push(anio);
  if (tipo) parts.push(tipo);

  return parts.length ? parts.join(' · ') : 'Examen específico';
}

function buildSessionExamInfo(examSet) {
  const items = Array.from(examSet || [])
    .map((raw) => {
      try { return JSON.parse(raw); } catch (_) { return null; }
    })
    .filter(Boolean);

  if (items.length !== 1) {
    return {
      is_single_exam: false,
      exam_label: '',
      exam_key: ''
    };
  }

  return {
    is_single_exam: true,
    exam_label: items[0].label || formatSpecificExamLabel(items[0]),
    exam_key: items[0].key || ''
  };
}


function isCompleteExamSession(row) {
  const total = safeNumber(row?.total, 0);
  const respondidas = safeNumber(row?.respondidas ?? row?.total, total);

  // Para "mejor/peor examen completo" solo cuentan sesiones de un banco/examen específico.
  // Se excluyen exámenes armados con múltiples bancos, debilidades, errores o mezclas.
  if (row?.source !== 'exam_sessions') return false;
  if (row?.is_single_exam !== true) return false;

  return total >= 50 && respondidas >= Math.min(total, 50);
}

function compareBestExam(a, b) {
  return safeNumber(b?.pct, 0) - safeNumber(a?.pct, 0)
    || safeNumber(b?.total, 0) - safeNumber(a?.total, 0)
    || String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
}

function compareWorstExam(a, b) {
  return safeNumber(a?.pct, 0) - safeNumber(b?.pct, 0)
    || safeNumber(b?.total, 0) - safeNumber(a?.total, 0)
    || String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
}

function renderCompleteExamCard(row, kind = 'best') {
  if (!row) return '';

  const pct = Math.round(safeNumber(row.pct, 0));
  const total = safeNumber(row.total, 0);
  const correctas = safeNumber(row.correctas, 0);
  const incorrectas = Math.max(0, total - correctas);
  const fecha = row.created_at
    ? new Date(row.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—';
  const duration = formatExamDuration(row.duration_ms);
  const color = kind === 'best' ? 'var(--green)' : 'var(--red)';
  const tag = kind === 'best' ? '🏆 Mejor examen completo' : '📉 Peor examen completo';

  return `
    <div class="bw-card" style="text-align:left;min-width:0;">
      <div class="bw-tag" style="color:${color};display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <span>${tag}</span>
        <span>${fecha}</span>
      </div>
      <div class="bw-name" style="margin-top:8px;line-height:1.18;">${escapeHtml(row.exam_label || 'Examen específico')}</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:8px;">
        <div class="bw-pct" style="color:${color};margin:0;">${pct}%</div>
        <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.62rem;color:var(--text2);">${correctas}/${total} correctas</div>
      </div>
      <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.58rem;color:var(--text3);margin-top:6px;letter-spacing:.06em;text-transform:uppercase;display:flex;gap:10px;flex-wrap:wrap;">
        <span>${escapeHtml(modeLabel(row.mode))}</span>
        <span>${incorrectas} incorrectas</span>
        ${duration ? `<span>⏱ ${escapeHtml(duration)}</span>` : ''}
      </div>
      <div style="margin-top:10px;background:var(--border);border-radius:99px;height:4px;overflow:hidden;">
        <div style="height:100%;border-radius:99px;background:${color};width:${Math.max(3, Math.min(100, pct))}%;"></div>
      </div>
    </div>`;
}

const FRONTEND_SPECIALTY_KEYS = new Set(
  Object.values(ESP_CANONICAL)
    .map((value) => normEspecialidadKey(value))
    .filter(Boolean)
);

function frontendSpecialtyLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const label = (cfg.formatEsp?.(raw) || formatEspCatalog(raw) || raw).trim();
  const key = normEspecialidadKey(label);

  if (!key || !FRONTEND_SPECIALTY_KEYS.has(key)) return '';

  return label;
}

export async function abrirPerfil() {
  ensureProfileWideUiPatch();

  const user = currentUser();
  const profile = currentProfile();

  if (!user) {
    cfg.openAuth?.();
    return;
  }

  q('modalPerfil')?.classList.add('vis');
  const usernameEl = q('profileUsername');
  if (usernameEl) usernameEl.textContent = profile?.username || '—';

  const input = q('usernameInput');
  if (input) input.value = profile?.username || '';

  const msg = q('usernameMsg');
  if (msg) {
    msg.style.display = 'none';
    msg.textContent = '';
  }

  try {
    const client = sb();
    const { data: pData } = await client.from('profiles')
      .select('username_changed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (pData && profile) {
      const nextProfile = { ...profile, username_changed_at: pData.username_changed_at };
      cfg.setCurrentProfile?.(nextProfile);
    }
  } catch (_) {}

  actualizarCooldownUI();
  switchProfileTab('stats');
  await cargarPerfil();
}

export function switchProfileTab(tab) {
  ['stats', 'plan'].forEach((name) => {
    const suffix = name.charAt(0).toUpperCase() + name.slice(1);
    q('tabBtn' + suffix)?.classList.toggle('active', name === tab);
    q('tabPane' + suffix)?.classList.toggle('active', name === tab);
  });

  if (tab === 'plan') {
    cfg.renderPlanStatus?.();
    cfg.applyPricingDom?.();
  }
}

export async function guardarUsername() {
  const user = currentUser();
  let profile = currentProfile();
  if (!user) return;

  const input = q('usernameInput');
  const btn = input?.parentElement?.querySelector('button');
  const msg = q('usernameMsg');
  const val = (input?.value || '').trim();

  if (!val) { setUsernameMessage(msg, 'El nombre no puede estar vacío', false); return; }
  if (val.length < 3) { setUsernameMessage(msg, 'Mínimo 3 caracteres', false); return; }
  if (val.length > 20) { setUsernameMessage(msg, 'Máximo 20 caracteres', false); return; }

  if (profile?.username_changed_at) {
    const diasTranscurridos = (Date.now() - new Date(profile.username_changed_at)) / (1000 * 60 * 60 * 24);
    const diasRestantes = Math.ceil(30 - diasTranscurridos);
    if (diasRestantes > 0) {
      setUsernameMessage(msg, `⏳ Podés cambiar tu username en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`, false);
      return;
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const { error } = await sb().rpc('cambiar_username', {
      uid: user.id,
      nuevo_username: val
    });

    if (error) throw error;

    profile = {
      ...(profile || {}),
      username: val,
      username_changed_at: new Date().toISOString()
    };
    cfg.setCurrentProfile?.(profile);

    cfg.renderUserUI?.();
    const usernameEl = q('profileUsername');
    if (usernameEl) usernameEl.textContent = val;
    actualizarCooldownUI();
    setUsernameMessage(msg, '✓ Nombre actualizado', true);
    setTimeout(() => { if (msg) msg.style.display = 'none'; }, 3000);
  } catch (error) {
    const cleanMessage = error.message
      ?.replace('ERROR: ', '')
      .replace(/\s*\(SQLSTATE.*\)/, '')
      .trim();
    setUsernameMessage(msg, cleanMessage || 'Error al guardar', false);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
}

function actualizarCooldownUI() {
  const input = q('usernameInput');
  const btn = input?.parentElement?.querySelector('button');
  const msg = q('usernameMsg');
  const profile = currentProfile();

  if (!input || !profile) return;

  if (profile.username_changed_at) {
    const diasTranscurridos = (Date.now() - new Date(profile.username_changed_at)) / (1000 * 60 * 60 * 24);
    const diasRestantes = Math.ceil(30 - diasTranscurridos);

    if (diasRestantes > 0) {
      input.disabled = true;
      input.style.opacity = '0.5';
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }
      if (msg) {
        msg.textContent = `⏳ Próximo cambio disponible en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`;
        msg.style.display = 'block';
        msg.style.background = 'rgba(251,191,36,0.08)';
        msg.style.border = '1px solid rgba(251,191,36,0.25)';
        msg.style.color = 'var(--amber)';
      }
      return;
    }
  }

  input.disabled = false;
  input.style.opacity = '1';
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

export function toggleFaq(btn) {
  const item = btn?.closest?.('.lp-faq-item');
  if (!item) return;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.lp-faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

export function enviarContacto() {
  const nombre = q('contactNombre')?.value?.trim();
  const email = q('contactEmail')?.value?.trim();
  const msg = q('contactMensaje')?.value?.trim();

  if (!nombre || !email || !msg) {
    alert('Por favor completá todos los campos.');
    return;
  }

  const fb = q('contactFeedback');
  if (fb) fb.style.display = 'block';

  setTimeout(() => {
    if (q('contactNombre')) q('contactNombre').value = '';
    if (q('contactEmail')) q('contactEmail').value = '';
    if (q('contactMensaje')) q('contactMensaje').value = '';
  }, 500);
}


async function cargarResultadosLegacyPerfil(user, beforeDate = '', limit = 50) {
  const safeLimit = Math.max(1, Number(limit || 50));
  let query = sb()
    .from('resultados')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (beforeDate) {
    query = query.lt('created_at', beforeDate);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[ResiAR] No se pudieron cargar resultados legacy para perfil:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function cargarResultadosPerfil(user) {
  const { data: sessions, error: sessionsError } = await sb()
    .from('exam_sessions')
    .select('id, created_at, total, correctas, incorrectas, respondidas, porcentaje, mode, duration_ms, metadata')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (sessionsError) {
    console.warn('[ResiAR] No se pudieron cargar exam_sessions para perfil:', sessionsError);
    return cargarResultadosLegacyPerfil(user, '', 50);
  }

  const normalizedSessions = Array.isArray(sessions) ? sessions : [];

  if (!normalizedSessions.length) {
    return cargarResultadosLegacyPerfil(user, '', 50);
  }

  const sessionIds = normalizedSessions
    .map((session) => session?.id)
    .filter(Boolean);

  const especialidadesPorSesion = new Map();
  const examenesPorSesion = new Map();

  if (sessionIds.length) {
    const { data: answers, error: answersError } = await sb()
      .from('exam_answers')
      .select('session_id, especialidad, metadata')
      .eq('user_id', user.id)
      .in('session_id', sessionIds);

    if (answersError) {
      console.warn('[ResiAR] No se pudieron cargar exam_answers para perfil:', answersError);
    } else {
      (answers || []).forEach((answer) => {
        const sessionId = answer?.session_id;
        const especialidad = String(answer?.especialidad || 'General').trim() || 'General';

        if (!sessionId) return;

        if (!especialidadesPorSesion.has(sessionId)) {
          especialidadesPorSesion.set(sessionId, new Set());
        }

        especialidadesPorSesion.get(sessionId).add(especialidad);

        const examInfo = readAnswerExamInfo(answer);
        if (examInfo?.key) {
          if (!examenesPorSesion.has(sessionId)) {
            examenesPorSesion.set(sessionId, new Set());
          }
          examenesPorSesion.get(sessionId).add(JSON.stringify(examInfo));
        }
      });
    }
  }

  const rowsNuevos = normalizedSessions.map((session) => {
    const especialidades = Array.from(
      especialidadesPorSesion.get(session.id) || ['General']
    );

    const total = Number(session.total || session.respondidas || 0);
    const correctas = Number(session.correctas || 0);
    const pct = Number.isFinite(Number(session.porcentaje))
      ? Number(session.porcentaje)
      : (total ? Math.round((correctas / total) * 100) : 0);

    const sessionExamInfo = buildSessionExamInfo(examenesPorSesion.get(session.id));

    return {
      id: session.id,
      created_at: session.created_at,
      especialidad: especialidades.join(', '),
      correctas,
      total,
      respondidas: Number(session.respondidas || total || 0),
      pct,
      mode: session.mode || 'exam',
      duration_ms: Number(session.duration_ms || 0),
      source: 'exam_sessions',
      exam_label: sessionExamInfo.exam_label,
      exam_key: sessionExamInfo.exam_key,
      is_single_exam: sessionExamInfo.is_single_exam
    };
  });

  const oldestNewDate = rowsNuevos.reduce((oldest, row) => {
    const date = String(row.created_at || '');
    if (!date) return oldest;
    return !oldest || date < oldest ? date : oldest;
  }, '');

  const legacyLimit = Math.max(0, 50 - rowsNuevos.length);
  const rowsLegacy = legacyLimit > 0
    ? await cargarResultadosLegacyPerfil(user, oldestNewDate, legacyLimit)
    : [];

  return [...rowsNuevos, ...rowsLegacy]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 50);
}


function normalizeGlobalProfileSummary(row) {
  if (!row || typeof row !== 'object') return null;

  const totalPreguntas = safeNumber(row.total_preguntas, 0);
  const totalCorrectas = safeNumber(row.total_correctas, 0);

  if (totalPreguntas <= 0 && safeNumber(row.sesiones, 0) <= 0) return null;

  return {
    user_id: row.user_id || '',
    username: row.username || '',
    sesiones: safeNumber(row.sesiones, 0),
    total_preguntas: totalPreguntas,
    total_correctas: totalCorrectas,
    pct_historico: Number.isFinite(Number(row.pct_historico))
      ? safeNumber(row.pct_historico, 0)
      : pctFrom(totalCorrectas, totalPreguntas),
    mejor_pct: safeNumber(row.mejor_pct, 0),
    mejor_total: safeNumber(row.mejor_total, 0),
    mejor_correctas: safeNumber(row.mejor_correctas, 0)
  };
}

async function cargarResumenGlobalPerfil(user) {
  if (!user?.id) return null;

  try {
    const { data, error } = await sb().rpc('get_user_profile_summary', {
      target_user_id: user.id
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const summary = normalizeGlobalProfileSummary(row);
    if (summary) return summary;
  } catch (error) {
    console.warn('[ResiAR] No se pudo cargar resumen global del perfil:', error);
  }

  // Fallback de compatibilidad: si la migración nueva todavía no está aplicada,
  // se toma la misma fuente que el ranking y se filtra el usuario actual.
  try {
    const { data, error } = await sb().rpc('get_ranking_global');
    if (error) throw error;

    const row = (Array.isArray(data) ? data : [])
      .find((item) => item?.user_id === user.id);

    return normalizeGlobalProfileSummary(row);
  } catch (error) {
    console.warn('[ResiAR] No se pudo usar get_ranking_global como fallback del perfil:', error);
    return null;
  }
}


function normalizeTopicRow(row) {
  const especialidad = String(row?.especialidad || 'General').trim() || 'General';
  const tema = String(row?.tema || '').trim();
  const total = safeNumber(row?.total ?? row?.t ?? row?.respondidas, 0);
  const correctas = safeNumber(row?.correctas ?? row?.c, 0);
  const porcentaje = Number.isFinite(Number(row?.porcentaje))
    ? Number(row.porcentaje)
    : pctFrom(correctas, total);
  const incorrectas = Number.isFinite(Number(row?.incorrectas))
    ? Number(row.incorrectas)
    : Math.max(0, total - correctas);

  if (!tema || total <= 0) return null;

  return {
    especialidad,
    tema,
    label: `${especialidad} · ${tema}`,
    total,
    correctas,
    incorrectas,
    porcentaje: Math.round(porcentaje),
    avg_time_ms: safeNumber(row?.avg_time_ms, 0),
    last_answer_at: row?.last_answer_at || row?.created_at || ''
  };
}

function aggregateTopicRowsFromAnswers(rows) {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || row.is_answered === false || row.is_annulled === true) return;

    const especialidad = String(row.especialidad || 'General').trim() || 'General';
    const tema = String(row.tema || '').trim();
    if (!tema) return;

    const key = `${especialidad}::${tema}`;
    if (!map.has(key)) {
      map.set(key, {
        especialidad,
        tema,
        total: 0,
        correctas: 0,
        incorrectas: 0,
        time_total: 0,
        time_count: 0,
        last_answer_at: ''
      });
    }

    const item = map.get(key);
    item.total += 1;
    if (row.is_correct === true || row.is_correct === 'true' || row.is_correct === 1) item.correctas += 1;
    else item.incorrectas += 1;

    const time = safeNumber(row.time_ms, 0);
    if (time > 0) {
      item.time_total += time;
      item.time_count += 1;
    }

    const created = String(row.created_at || '');
    if (created && (!item.last_answer_at || created > item.last_answer_at)) item.last_answer_at = created;
  });

  return Array.from(map.values()).map((item) => normalizeTopicRow({
    ...item,
    avg_time_ms: item.time_count ? item.time_total / item.time_count : 0
  })).filter(Boolean);
}

async function cargarTemasPerfil(user) {
  try {
    const { data, error } = await sb()
      .from('user_topic_performance')
      .select('user_id, especialidad, tema, total, correctas, incorrectas, porcentaje, avg_time_ms, last_answer_at')
      .eq('user_id', user.id);

    if (error) throw error;

    const rows = (Array.isArray(data) ? data : [])
      .map(normalizeTopicRow)
      .filter(Boolean);

    if (rows.length) return rows;
  } catch (error) {
    console.warn('[ResiAR] No se pudo cargar user_topic_performance para perfil:', error);
  }

  try {
    const { data, error } = await sb()
      .from('exam_answers')
      .select('especialidad, tema, is_correct, is_answered, is_annulled, time_ms, created_at')
      .eq('user_id', user.id)
      .eq('is_answered', true)
      .order('created_at', { ascending: false })
      .limit(3000);

    if (error) throw error;
    return aggregateTopicRowsFromAnswers(data || []);
  } catch (error) {
    console.warn('[ResiAR] No se pudieron cargar exam_answers para temas del perfil:', error);
    return [];
  }
}

function renderTopicCard(item, tone = 'red') {
  const pct = safeNumber(item?.porcentaje, 0);
  const color = tone === 'green' ? 'var(--green)' : pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
  const timeLabel = compactTime(item?.avg_time_ms);
  const safeEsp = escapeHtml(cfg.formatEsp(item?.especialidad || 'General'));
  const safeTema = escapeHtml(item?.tema || 'Tema');
  const safeCorrectas = escapeHtml(`${safeNumber(item?.correctas)}/${safeNumber(item?.total)}`);

  return `
    <div class="bw-card" style="text-align:left;min-width:0;">
      <div class="bw-tag" style="color:${color};display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <span>${tone === 'green' ? '✅ Fuerte' : '📌 Revisar'}</span>
        <span>${Math.round(pct)}%</span>
      </div>
      <div class="bw-name" style="margin-top:8px;line-height:1.22;">${safeTema}</div>
      <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.56rem;color:var(--text3);margin-top:5px;letter-spacing:.06em;text-transform:uppercase;">${safeEsp}</div>
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;">
        <span style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.62rem;color:var(--text2);">${safeCorrectas} correctas</span>
        ${timeLabel ? `<span style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.58rem;color:var(--text3);">⏱ ${escapeHtml(timeLabel)}</span>` : ''}
      </div>
      <div style="margin-top:8px;background:var(--border);border-radius:99px;height:4px;overflow:hidden;">
        <div style="height:100%;border-radius:99px;background:${color};width:${Math.max(3, Math.min(100, Math.round(pct)))}%;"></div>
      </div>
    </div>`;
}

function renderTopicDashboard(topicRows) {
  const rows = (Array.isArray(topicRows) ? topicRows : [])
    .filter((item) => item && safeNumber(item.total) > 0);

  if (!rows.length) return '';

  const hasQualified = rows.some((item) => safeNumber(item.total) >= 3);
  const minTotal = hasQualified ? 3 : 1;
  const qualified = rows.filter((item) => safeNumber(item.total) >= minTotal);

  const weak = qualified
    .filter((item) => safeNumber(item.porcentaje) < 70)
    .sort((a, b) => safeNumber(a.porcentaje) - safeNumber(b.porcentaje) || safeNumber(b.total) - safeNumber(a.total))
    .slice(0, 6);

  const strong = qualified
    .filter((item) => safeNumber(item.porcentaje) >= 70)
    .sort((a, b) => safeNumber(b.porcentaje) - safeNumber(a.porcentaje) || safeNumber(b.total) - safeNumber(a.total))
    .slice(0, 4);

  const weakestFallback = !weak.length
    ? qualified
      .slice()
      .sort((a, b) => safeNumber(a.porcentaje) - safeNumber(b.porcentaje) || safeNumber(b.total) - safeNumber(a.total))
      .slice(0, 4)
    : [];

  const caption = hasQualified
    ? 'Calculado desde respuestas individuales · mínimo 3 respuestas por tema'
    : 'Muestra inicial desde respuestas individuales · faltan más respuestas para consolidar tendencias';

  return `
    <div class="ssec-title">Temas detectados por rendimiento</div>
    <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.58rem;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin:-2px 0 10px;">
      ${caption}
    </div>
    ${(weak.length || weakestFallback.length) ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px;">
        ${(weak.length ? weak : weakestFallback).map((item) => renderTopicCard(item, 'red')).join('')}
      </div>` : ''}
    ${strong.length ? `
      <div class="ssec-title" style="margin-top:12px;">Temas fuertes</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px;">
        ${strong.map((item) => renderTopicCard(item, 'green')).join('')}
      </div>` : ''}
  `;
}


function avgPctFromRows(rows) {
  const arr = (Array.isArray(rows) ? rows : []).filter(Boolean);
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, row) => s + safeNumber(row.pct ?? row.porcentaje, 0), 0) / arr.length);
}

function stdPctFromRows(rows) {
  const arr = (Array.isArray(rows) ? rows : []).filter(Boolean);
  if (arr.length < 2) return 0;
  const avg = arr.reduce((s, row) => s + safeNumber(row.pct ?? row.porcentaje, 0), 0) / arr.length;
  const variance = arr.reduce((s, row) => {
    const v = safeNumber(row.pct ?? row.porcentaje, 0) - avg;
    return s + v * v;
  }, 0) / arr.length;
  return Math.round(Math.sqrt(variance));
}

function getStudyLevel(pct) {
  const n = safeNumber(pct, 0);
  if (n >= 85) return { label: 'Muy alto', tone: 'green', text: 'El foco principal debería ser sostener ritmo, repasar errores finos y simular presión de examen.' };
  if (n >= 70) return { label: 'Competitivo', tone: 'green', text: 'Ya hay una base fuerte. Conviene atacar temas débiles puntuales y hacer exámenes completos frecuentes.' };
  if (n >= 55) return { label: 'Intermedio', tone: 'amber', text: 'Hay base, pero todavía existen huecos que pueden definir el resultado. El estudio debe priorizar errores repetidos.' };
  if (n >= 40) return { label: 'Inestable', tone: 'red', text: 'El rendimiento sugiere conocimientos fragmentados. Conviene consolidar temas troncales antes de aumentar dificultad.' };
  return { label: 'Base frágil', tone: 'red', text: 'La prioridad es reconstruir conceptos centrales y repetir bloques cortos con corrección inmediata.' };
}

function getReliabilityLevel(totalResp, sessionsCount, topicsCount) {
  const t = safeNumber(totalResp, 0);
  const n = safeNumber(sessionsCount, 0);
  const topicN = safeNumber(topicsCount, 0);

  if (t >= 500 && n >= 8 && topicN >= 15) return { label: 'Alta', detail: 'Muestra suficiente para orientar el estudio con bastante confianza.' };
  if (t >= 200 && n >= 4) return { label: 'Media', detail: 'Muestra útil, aunque algunas conclusiones por tema todavía pueden cambiar.' };
  if (t >= 50) return { label: 'Inicial', detail: 'Ya permite detectar tendencias, pero conviene sumar más exámenes completos.' };
  return { label: 'Baja', detail: 'Faltan respuestas para separar debilidades reales de variación por azar.' };
}

function studyToneColor(tone) {
  if (tone === 'green') return 'var(--green)';
  if (tone === 'amber') return 'var(--amber)';
  if (tone === 'violet') return 'var(--violet, #8b5cf6)';
  return 'var(--red)';
}

function renderMiniAnalysisCard(title, value, detail, tone = 'violet') {
  const color = studyToneColor(tone);
  return `
    <div class="bw-card" style="text-align:left;min-width:0;">
      <div class="bw-tag" style="color:${color};">${escapeHtml(title)}</div>
      <div class="bw-name" style="margin-top:8px;line-height:1.15;">${escapeHtml(value)}</div>
      <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.6rem;color:var(--text3);margin-top:7px;line-height:1.35;letter-spacing:.02em;">${escapeHtml(detail)}</div>
    </div>`;
}

function renderPriorityList(items, options = {}) {
  const {
    empty = 'Sin datos suficientes.',
    max = 5,
    type = 'topic'
  } = options;

  const arr = (Array.isArray(items) ? items : []).slice(0, max);
  if (!arr.length) return `<div class="lb-empty" style="padding:14px;margin:0;">${escapeHtml(empty)}</div>`;

  return `
    <div style="display:grid;gap:8px;">
      ${arr.map((item, idx) => {
        const pct = Math.round(safeNumber(item.porcentaje ?? item.pct, 0));
        const total = safeNumber(item.total ?? item.t, 0);
        const correctas = safeNumber(item.correctas ?? item.c, 0);
        const incorrectas = safeNumber(item.incorrectas, Math.max(0, total - correctas));
        const title = type === 'specialty'
          ? cfg.formatEsp(item.e || item.especialidad || 'Especialidad')
          : `${item.tema || 'Tema'}${item.especialidad ? ` · ${cfg.formatEsp(item.especialidad)}` : ''}`;

        return `
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.14);border-radius:16px;padding:10px 12px;">
            <div style="width:26px;height:26px;border-radius:10px;display:grid;place-items:center;background:rgba(148,163,184,.13);font-family:'Space Grotesk','DM Mono',monospace;font-size:.68rem;color:var(--text2);">${idx + 1}</div>
            <div style="min-width:0;">
              <div style="font-weight:800;color:var(--text);font-size:.86rem;line-height:1.18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title)}</div>
              <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:.57rem;color:var(--text3);margin-top:3px;text-transform:uppercase;letter-spacing:.06em;">${correctas}/${total} correctas · ${incorrectas} errores</div>
            </div>
            <div style="font-family:'Playfair Display',serif;font-weight:800;font-size:1.18rem;color:${colPct(pct)};">${pct}%</div>
          </div>`;
      }).join('')}
    </div>`;
}

function buildStudyPrescription({ pctG, trendDiff, volatility, weakTopics, weakSpecialties, totalResp, completeExamSessions }) {
  const actions = [];

  if (weakTopics.length) {
    const first = weakTopics[0];
    actions.push(`Priorizar ${first.tema} (${cfg.formatEsp(first.especialidad)}): repasar teoría breve y resolver 15-25 preguntas dirigidas.`);
  }

  if (weakSpecialties.length) {
    actions.push(`Hacer un bloque específico de ${cfg.formatEsp(weakSpecialties[0].e)} hasta superar 65-70%.`);
  }

  if (safeNumber(pctG, 0) < 60) {
    actions.push('Usar bloques cortos con corrección inmediata: 20-30 preguntas, revisar errores y repetir el tema el mismo día.');
  } else {
    actions.push('Alternar exámenes completos con bloques de debilidades para evitar estudiar solo lo cómodo.');
  }

  if (trendDiff <= -3) {
    actions.push('La tendencia reciente bajó: conviene reducir mezcla de temas y volver a bloques por especialidad durante 3-4 días.');
  } else if (trendDiff >= 3) {
    actions.push('La tendencia reciente mejora: mantener volumen y agregar simulacros completos para consolidar.');
  }

  if (volatility >= 18) {
    actions.push('Rendimiento muy variable: revisar condiciones de simulacro, cansancio y temas que generan caídas bruscas.');
  }

  if (safeNumber(totalResp, 0) < 200 || safeNumber(completeExamSessions?.length, 0) < 2) {
    actions.push('Sumar más exámenes completos: todavía falta muestra para medir rendimiento real de examen.');
  }

  return actions.slice(0, 6);
}

function renderStudyAnalysis({ data, topicRows, esps, pctG, totalResp, totalCorr, tendTxt, bestCompleteExam, worstCompleteExam }) {
  const sessions = Array.isArray(data) ? data : [];
  const topics = (Array.isArray(topicRows) ? topicRows : [])
    .filter((item) => item && safeNumber(item.total, 0) > 0);

  const qualifiedTopicMin = topics.some((item) => safeNumber(item.total, 0) >= 3) ? 3 : 1;
  const qualifiedTopics = topics
    .filter((item) => safeNumber(item.total, 0) >= qualifiedTopicMin);

  const weakTopics = qualifiedTopics
    .filter((item) => safeNumber(item.porcentaje, 0) < 70)
    .sort((a, b) => {
      const scoreA = safeNumber(a.incorrectas, 0) * 4 + (100 - safeNumber(a.porcentaje, 0)) + Math.min(20, safeNumber(a.total, 0));
      const scoreB = safeNumber(b.incorrectas, 0) * 4 + (100 - safeNumber(b.porcentaje, 0)) + Math.min(20, safeNumber(b.total, 0));
      return scoreB - scoreA;
    });

  const fragileTopics = qualifiedTopics
    .slice()
    .sort((a, b) => safeNumber(a.porcentaje, 0) - safeNumber(b.porcentaje, 0) || safeNumber(b.total, 0) - safeNumber(a.total, 0));

  const strongTopics = qualifiedTopics
    .filter((item) => safeNumber(item.porcentaje, 0) >= 75)
    .sort((a, b) => safeNumber(b.porcentaje, 0) - safeNumber(a.porcentaje, 0) || safeNumber(b.total, 0) - safeNumber(a.total, 0));

  const specialties = (Array.isArray(esps) ? esps : [])
    .filter((item) => item && safeNumber(item.t, 0) > 0);

  const weakSpecialties = specialties
    .filter((item) => safeNumber(item.t, 0) >= 3)
    .sort((a, b) => safeNumber(a.pct, 0) - safeNumber(b.pct, 0) || safeNumber(b.t, 0) - safeNumber(a.t, 0));

  const strongSpecialties = specialties
    .filter((item) => safeNumber(item.t, 0) >= 3)
    .sort((a, b) => safeNumber(b.pct, 0) - safeNumber(a.pct, 0) || safeNumber(b.t, 0) - safeNumber(a.t, 0));

  const recent = sessions.slice(0, Math.min(5, sessions.length));
  const previous = sessions.slice(Math.min(5, sessions.length), Math.min(10, sessions.length));
  const recentAvg = recent.length ? avgPctFromRows(recent) : safeNumber(pctG, 0);
  const previousAvg = previous.length ? avgPctFromRows(previous) : recentAvg;
  const trendDiff = Math.round(recentAvg - previousAvg);
  const volatility = stdPctFromRows(sessions.slice(0, Math.min(10, sessions.length)));
  const level = getStudyLevel(pctG);
  const reliability = getReliabilityLevel(totalResp, sessions.length, qualifiedTopics.length);
  const completeExamSessions = sessions.filter(isCompleteExamSession);
  const prescription = buildStudyPrescription({
    pctG,
    trendDiff,
    volatility,
    weakTopics: weakTopics.length ? weakTopics : fragileTopics,
    weakSpecialties,
    totalResp,
    completeExamSessions
  });

  const diagnostic = [
    `Rendimiento global: ${Math.round(safeNumber(pctG, 0))}% (${safeNumber(totalCorr, 0).toLocaleString()} correctas de ${safeNumber(totalResp, 0).toLocaleString()}).`,
    `Tendencia reciente: ${trendDiff > 0 ? '+' : ''}${trendDiff}% comparando las últimas ${recent.length || 0} sesiones contra las previas.`,
    `Variabilidad reciente: ${volatility}% de dispersión aproximada entre sesiones.`,
    `Confianza del análisis: ${reliability.label.toLowerCase()}. ${reliability.detail}`
  ];

  const examComment = bestCompleteExam && worstCompleteExam
    ? `Mejor examen específico completo: ${bestCompleteExam.exam_label || '—'} (${Math.round(safeNumber(bestCompleteExam.pct, 0))}%). Peor examen específico completo: ${worstCompleteExam.exam_label || '—'} (${Math.round(safeNumber(worstCompleteExam.pct, 0))}%).`
    : 'Todavía faltan exámenes específicos completos para comparar rendimiento real por banco.';

  return `
    <div class="ssec-title">Análisis exhaustivo para orientar el estudio</div>
    <div style="border:1px solid rgba(148,163,184,.18);background:linear-gradient(135deg,rgba(139,92,246,.08),rgba(16,185,129,.05));border-radius:24px;padding:16px;margin-bottom:18px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">
        ${renderMiniAnalysisCard('Nivel actual', level.label, level.text, level.tone)}
        ${renderMiniAnalysisCard('Tendencia reciente', `${trendDiff > 0 ? '+' : ''}${trendDiff}%`, tendTxt || 'Comparación contra sesiones previas', trendDiff > 2 ? 'green' : trendDiff < -2 ? 'red' : 'amber')}
        ${renderMiniAnalysisCard('Confiabilidad', reliability.label, reliability.detail, reliability.label === 'Alta' ? 'green' : reliability.label === 'Media' ? 'amber' : 'red')}
        ${renderMiniAnalysisCard('Exámenes completos', String(completeExamSessions.length), examComment, completeExamSessions.length ? 'green' : 'amber')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
        <div class="bw-card" style="text-align:left;">
          <div class="bw-tag" style="color:var(--red);">Prioridad por temas</div>
          <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:.58rem;color:var(--text3);margin:5px 0 10px;text-transform:uppercase;letter-spacing:.06em;">Ordenado por impacto de errores y bajo rendimiento</div>
          ${renderPriorityList(weakTopics.length ? weakTopics : fragileTopics, { max: 5, empty: 'No hay temas débiles claros todavía.' })}
        </div>

        <div class="bw-card" style="text-align:left;">
          <div class="bw-tag" style="color:var(--amber);">Especialidades a atacar</div>
          <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:.58rem;color:var(--text3);margin:5px 0 10px;text-transform:uppercase;letter-spacing:.06em;">Mínimo 3 respuestas por especialidad</div>
          ${renderPriorityList(weakSpecialties, { max: 5, type: 'specialty', empty: 'Aún no hay especialidades débiles con muestra suficiente.' })}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:12px;">
        <div class="bw-card" style="text-align:left;">
          <div class="bw-tag" style="color:var(--green);">Fortalezas aprovechables</div>
          <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:.58rem;color:var(--text3);margin:5px 0 10px;text-transform:uppercase;letter-spacing:.06em;">Usalas para sostener puntaje, no para esconder debilidades</div>
          ${renderPriorityList(strongTopics.length ? strongTopics : strongSpecialties, { max: 4, type: strongTopics.length ? 'topic' : 'specialty', empty: 'Todavía no hay fortalezas consistentes.' })}
        </div>

        <div class="bw-card" style="text-align:left;">
          <div class="bw-tag" style="color:var(--violet,#8b5cf6);">Plan sugerido inmediato</div>
          <div style="display:grid;gap:8px;margin-top:10px;">
            ${prescription.map((line, idx) => `
              <div style="display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:start;">
                <span style="width:24px;height:24px;border-radius:9px;display:grid;place-items:center;background:rgba(139,92,246,.12);color:var(--violet,#8b5cf6);font-weight:900;font-size:.68rem;">${idx + 1}</span>
                <span style="font-size:.82rem;line-height:1.38;color:var(--text2);">${escapeHtml(line)}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div style="margin-top:12px;padding:12px 14px;border-radius:18px;background:rgba(15,23,42,.04);border:1px solid rgba(148,163,184,.14);">
        <div class="bw-tag" style="color:var(--text2);">Lectura rápida</div>
        <ul style="margin:8px 0 0 18px;padding:0;color:var(--text2);font-size:.82rem;line-height:1.45;">
          ${diagnostic.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
          <li>${escapeHtml(examComment)}</li>
        </ul>
      </div>
    </div>`;
}


export async function cargarPerfil() {
  const user = currentUser();
  const profile = currentProfile();
  const box = q('profileContent');
  const sub = q('profileUsername');

  if (!user) return;
  if (box) box.innerHTML = '<div class="lb-empty">Cargando...</div>';

  try {
    const [data, topicRows, globalSummary] = await Promise.all([
      cargarResultadosPerfil(user),
      cargarTemasPerfil(user),
      cargarResumenGlobalPerfil(user)
    ]);

    const recentRows = Array.isArray(data) ? data : [];
    const recentCount = recentRows.length;
    const fallbackTotalResp = recentRows.reduce((s, r) => s + Number(r.total || 0), 0);
    const fallbackTotalCorr = recentRows.reduce((s, r) => s + Number(r.correctas || 0), 0);

    const sessionCount = safeNumber(globalSummary?.sesiones, recentCount);
    const totalResp = safeNumber(globalSummary?.total_preguntas, fallbackTotalResp);
    const totalCorr = safeNumber(globalSummary?.total_correctas, fallbackTotalCorr);
    const pctG = Number.isFinite(Number(globalSummary?.pct_historico))
      ? safeNumber(globalSummary.pct_historico, pctFrom(totalCorr, totalResp))
      : pctFrom(totalCorr, totalResp);

    if (sub) {
      sub.textContent = (profile?.username || '') + ' · ' + (sessionCount === 0
        ? 'Sin sesiones'
        : sessionCount + ' sesión' + (sessionCount > 1 ? 'es' : '') + ' completada' + (sessionCount > 1 ? 's' : ''));
    }

    if (!sessionCount && !recentCount && totalResp <= 0) {
      if (box) box.innerHTML = `<div class="empty-stats"><span class="empty-icon">📋</span><p>Completá tu primer examen<br>para ver tus estadísticas</p></div>`;
      return;
    }

    const recentBest = recentRows.length
      ? recentRows.reduce((best, item) => Number(item.pct || 0) > Number(best.pct || 0) ? item : best, recentRows[0])
      : null;

    const bestSessionPct = Number.isFinite(Number(globalSummary?.mejor_pct))
      ? safeNumber(globalSummary.mejor_pct, 0)
      : safeNumber(recentBest?.pct, 0);
    const bestSessionTotal = Number.isFinite(Number(globalSummary?.mejor_total))
      ? safeNumber(globalSummary.mejor_total, 0)
      : safeNumber(recentBest?.total, 0);
    const bestSessionCorrectas = Number.isFinite(Number(globalSummary?.mejor_correctas))
      ? safeNumber(globalSummary.mejor_correctas, 0)
      : safeNumber(recentBest?.correctas, 0);
    const bestMatchesRecent = recentBest
      && bestSessionPct === safeNumber(recentBest.pct, 0)
      && bestSessionTotal === safeNumber(recentBest.total, 0)
      && bestSessionCorrectas === safeNumber(recentBest.correctas, 0);
    const bestSessionMeta = [
      bestSessionTotal > 0 ? `${bestSessionCorrectas}/${bestSessionTotal} correctas` : '',
      bestMatchesRecent && recentBest?.created_at
        ? new Date(recentBest.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : ''
    ].filter(Boolean).join(' · ');

    const completeExamSessions = recentRows.filter(isCompleteExamSession);
    const bestCompleteExam = completeExamSessions.slice().sort(compareBestExam)[0] || null;
    const worstCompleteExam = completeExamSessions.slice().sort(compareWorstExam)[0] || null;

    let tendCls = 'flat';
    let tendTxt = '→ Estable';
    if (recentCount >= 4) {
      const recientes = recentRows.slice(0, Math.min(5, recentCount));
      const anteriores = recentRows.slice(Math.min(5, recentCount), Math.min(10, recentCount));
      const avgRecientes = recientes.reduce((s, x) => s + Number(x.pct || 0), 0) / recientes.length;
      const avgAnteriores = anteriores.length ? anteriores.reduce((s, x) => s + Number(x.pct || 0), 0) / anteriores.length : avgRecientes;
      const diff = Math.round(avgRecientes - avgAnteriores);
      if (diff > 2) { tendCls = 'up'; tendTxt = '↑ +' + diff + '% vs antes'; }
      else if (diff < -2) { tendCls = 'down'; tendTxt = '↓ ' + diff + '% vs antes'; }
    }

    const espsMap = {};
    recentRows.forEach((row) => {
      const esps = cfg.splitEspecialidades(row.especialidad)
        .map(frontendSpecialtyLabel)
        .filter(Boolean);

      if (!esps.length) return;

      esps.forEach((especialidad) => {
        if (!espsMap[especialidad]) espsMap[especialidad] = { c: 0, t: 0 };
        const partes = esps.length || 1;
        espsMap[especialidad].c += Math.round(Number(row.correctas || 0) / partes);
        espsMap[especialidad].t += Math.round(Number(row.total || 0) / partes);
      });
    });

    const esps = Object.entries(espsMap)
      .filter(([, value]) => value.t >= 3)
      .map(([e, value]) => ({
        e,
        pct: Math.round(value.c / value.t * 100),
        c: value.c,
        t: value.t
      }))
      .sort((a, b) => b.pct - a.pct);

    const mejorEsp = esps[0];
    const peorEsp = esps[esps.length - 1];
    const ult = recentRows.slice(0, 20).reverse();
    const bars = ult.map((session) => {
      const pct = Number(session.pct || 0);
      const height = Math.max(4, Math.round(pct / 100 * 56));
      const fecha = new Date(session.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
      return `<div class="session-bar-wrap"><div class="session-bar" style="height:${height}px;background:${colPct(pct)}" data-tip="${pct}% · ${fecha}"></div></div>`;
    }).join('');

    const planInfo = renderProfilePlanInfo(profile);

    if (box) box.innerHTML = `
      ${planInfo}
      <div class="sgrid">
        <div class="scard c-accent"><div class="sc-val" style="color:var(--accent)">${sessionCount}</div><div class="sc-lbl">Sesiones</div></div>
        <div class="scard c-accent"><div class="sc-val" style="color:var(--text)">${totalResp.toLocaleString()}</div><div class="sc-lbl">Preguntas</div></div>
        <div class="scard c-green"><div class="sc-val" style="color:var(--green)">${totalCorr.toLocaleString()}</div><div class="sc-lbl">Correctas</div></div>
        <div class="scard c-red"><div class="sc-val" style="color:var(--red)">${(totalResp - totalCorr).toLocaleString()}</div><div class="sc-lbl">Incorrectas</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:22px;align-items:stretch;">
        <div class="scard c-violet" style="text-align:left;padding:18px 20px;">
          <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
            <span style="font-family:'Playfair Display',serif;font-weight:700;font-size:2.4rem;color:${colPct(pctG)}">${pctG}%</span>
            <span class="trend ${tendCls}">${tendTxt}</span>
          </div>
          <div class="sc-lbl" style="margin-top:6px;">Rendimiento global histórico</div>
          <div style="margin-top:10px;background:var(--border);border-radius:99px;height:5px;overflow:hidden;">
            <div id="gBar" style="height:100%;border-radius:99px;background:${colPct(pctG)};width:0%;transition:width 1.2s cubic-bezier(.16,1,.3,1);"></div>
          </div>
        </div>
        <div class="scard c-amber" style="text-align:center;padding:16px;min-width:105px;">
          <div class="sc-val" style="color:var(--amber);font-size:1.55rem;">${bestSessionPct}%</div>
          <div class="sc-lbl">Mejor sesión</div>
          <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.54rem;color:var(--text3);margin-top:5px;">${escapeHtml(bestSessionMeta || 'Histórico')}</div>
        </div>
      </div>
      ${completeExamSessions.length ? `
        <div class="ssec-title">Exámenes completos</div>
        <div class="best-worst" style="margin-bottom:18px;">
          ${renderCompleteExamCard(bestCompleteExam, 'best')}
          ${renderCompleteExamCard(worstCompleteExam, 'worst')}
        </div>` : `
        <div class="ssec-title">Exámenes completos</div>
        <div class="lb-empty" style="margin-bottom:18px;">Todavía no hay exámenes completos de 50 o más preguntas hechos desde un examen específico.</div>`}
      ${renderStudyAnalysis({ data: recentRows, topicRows, esps, pctG, totalResp, totalCorr, tendTxt, bestCompleteExam, worstCompleteExam })}
      ${recentCount >= 2 ? `<div class="ssec-title">Progreso — últimas ${ult.length} sesiones</div><div class="sessions-chart">${bars}</div>` : ''}
      ${esps.length >= 2 ? `
        <div class="ssec-title">Destacados por especialidad</div>
        <div class="best-worst">
          <div class="bw-card">
            <div class="bw-tag" style="color:var(--green)">🥇 Mejor</div>
            <div class="bw-name">${cfg.formatEsp(mejorEsp.e)}</div>
            <div class="bw-pct" style="color:var(--green)">${mejorEsp.pct}%</div>
            <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.56rem;color:var(--text3);margin-top:3px;">${mejorEsp.c}/${mejorEsp.t} correctas</div>
          </div>
          <div class="bw-card">
            <div class="bw-tag" style="color:var(--red)">📌 A mejorar</div>
            <div class="bw-name">${cfg.formatEsp(peorEsp.e)}</div>
            <div class="bw-pct" style="color:var(--red)">${peorEsp.pct}%</div>
            <div style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.56rem;color:var(--text3);margin-top:3px;">${peorEsp.c}/${peorEsp.t} correctas</div>
          </div>
        </div>` : ''}
      ${renderTopicDashboard(topicRows)}
      ${esps.length ? `
        <div class="ssec-title">Todas las especialidades</div>
        <div style="max-height:250px;overflow-y:auto;padding-right:2px;">
          <div class="esp-hist-row header">
            <span>Especialidad</span><span style="text-align:center">Respondidas</span>
            <span style="text-align:right">Rend.</span><span></span>
          </div>
          ${esps.map(({ e, pct, c, t }) => `
          <div class="esp-hist-row">
            <span class="esp-hist-name">${cfg.formatEsp(e)}</span>
            <span class="esp-hist-num">${c}/${t}</span>
            <span class="esp-hist-pct" style="color:${colPct(pct)}">${pct}%</span>
            <div class="esp-hist-bar"><div class="esp-hist-fill" data-fw="${pct}" style="width:0%;background:${colPct(pct)};"></div></div>
          </div>`).join('')}
        </div>` : ''}
    `;

    setTimeout(() => {
      const gb = q('gBar');
      if (gb) gb.style.width = pctG + '%';
      document.querySelectorAll('.esp-hist-fill[data-fw]').forEach(el => {
        el.style.width = el.dataset.fw + '%';
      });
    }, 80);
  } catch (error) {
    if (box) box.innerHTML = `<div class="lb-empty">Error: ${escapeHtml(error.message)}</div>`;
  }
}

function renderProfilePlanInfo(profile) {
  const plan = profile?.plan;
  const expira = profile?.plan_expira_at;
  const subtipo = profile?.plan_subtipo;
  const subtipoLabel = subtipo === 'anual' ? 'Trimestral' : subtipo === 'mensual' ? 'Mensual' : '';
  const subtipoTag = subtipoLabel
    ? `<span style="font-size:0.65rem;font-family:var(--font-mono);letter-spacing:0.1em;text-transform:uppercase;opacity:0.75;margin-left:6px;">${subtipoLabel}</span>`
    : '';

  if (plan === 'admin') return '<div class="plan-info-card admin">👑 Admin · Acceso total</div>';

  if (plan === 'pro' && expira) {
    const msRestante = new Date(expira) - new Date();
    const dias = Math.ceil(msRestante / (1000 * 60 * 60 * 24));
    if (dias <= 0) return '<div class="plan-info-card vencido">❌ Plan Pro vencido · <span style="font-size:0.72rem;opacity:0.8;">Contactá al administrador para renovar</span></div>';
    const color = dias <= 7 ? 'var(--red)' : dias <= 15 ? 'var(--amber)' : 'var(--green)';
    const fechaStr = new Date(expira).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
    return `<div class="plan-info-card pro" style="display:flex;flex-direction:column;gap:4px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span>⭐ Plan Pro${subtipoTag}</span>
        <span style="color:${color};font-weight:700;font-size:0.85rem;">${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}</span>
      </div>
      <div style="font-family:var(--font-mono);font-size:0.58rem;letter-spacing:0.08em;color:var(--text3);">Vence el ${fechaStr}</div>
      <div style="margin-top:4px;background:var(--border);border-radius:99px;height:3px;overflow:hidden;">
        <div style="height:100%;border-radius:99px;background:${color};width:${Math.min(100, Math.round(dias / 365 * 100))}%;transition:width 1s;"></div>
      </div>
    </div>`;
  }

  if (plan === 'pro') return `<div class="plan-info-card pro">⭐ Plan Pro${subtipoTag} · <span style="color:var(--green);font-weight:600;">Activo</span></div>`;
  if (plan === 'trial_activo') {
    const exp = expira ? new Date(expira) : null;
    const dias = exp ? Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24)) : 2;
    return `<div class="plan-info-card trial">🔓 Trial Premium · <span style="color:var(--green);font-weight:700;">${Math.max(0, dias)} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}</span></div>`;
  }
  if (plan === 'trial_limitado') return '<div class="plan-info-card trial">⏱️ Trial vencido · <span style="font-size:0.72rem;opacity:0.8;">Todos los exámenes (1% c/u) · acceso completo bloqueado</span></div>';
  if (plan === 'trial') return '<div class="plan-info-card trial">🔓 Trial gratuito · <span style="font-size:0.72rem;opacity:0.8;">Todos los exámenes (1% c/u) · <button data-action="activate-trial-premium" style="background:none;border:none;color:var(--amber);font-weight:600;cursor:pointer;font-size:0.72rem;padding:0;">Activar trial (2 días completos) →</button></span></div>';
  return '<div class="plan-info-card sin-acceso">🔒 Sin acceso activo · <span style="font-size:0.72rem;opacity:0.8;">Contactá al administrador</span></div>';
}
