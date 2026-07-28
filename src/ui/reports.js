// ResiAR — sistema de reportes de preguntas y panel admin.
// Mantiene el estado interno del módulo y recibe dependencias desde main.js.

const reportesEnviados = new Set();
let rmPreguntaId = null;
let rmMotivoSel = null;
let repFiltroActual = 'pendiente';

const MOTIVOS_LABEL = {
  respuesta_incorrecta: 'Respuesta incorrecta',
  especialidad_erronea: 'Especialidad o tema erróneo',
  pregunta_mal_redactada: 'Mal redactada',
  imagen_rota: 'Imagen rota',
  duplicada: 'Duplicada',
  otro: 'Otro'
};

let deps = {
  getSupabase: () => window.sb,
  getCurrentProfile: () => null,
  getExam: () => [],
  renderExam: () => {},
  setCurrentQuestion: () => {},
  espLabel: (p) => p?.especialidad_v2 || p?.especialidad || '',
  escapeHtml: (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch])),
  showRichToast: ({ message }) => console.warn(message)
};

function q(id) {
  return document.getElementById(id);
}

function escAttr(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function showReportToast(msg, esError = false) {
  deps.showRichToast({
    message: msg,
    type: esError ? 'error' : 'success',
    title: esError ? 'Reporte no enviado' : 'Reporte enviado',
    icon: esError ? '⚑' : '✓',
    duration: esError ? 5200 : 3600
  });
}

export function configureReports(options = {}) {
  deps = { ...deps, ...options };
}

export function clearReportesEnviados() {
  reportesEnviados.clear();
}

export function abrirModalReporte(preguntaId) {
  rmPreguntaId = preguntaId;
  rmMotivoSel = null;

  const idEl = q('rmPreguntaId');
  const desc = q('rmDesc');
  const btn = q('btnEnviarReporte');
  const modal = q('modalReporte');

  if (idEl) idEl.textContent = 'ID: ' + preguntaId;
  if (desc) desc.value = '';
  document.querySelectorAll('.reporte-motivo-opt').forEach(el => el.classList.remove('sel'));
  if (btn) btn.disabled = true;
  if (modal) modal.style.display = 'flex';
}

export function cerrarModalReporte() {
  const modal = q('modalReporte');
  if (modal) modal.style.display = 'none';
  rmPreguntaId = null;
  rmMotivoSel = null;
}

export function selMotivo(el, motivo) {
  document.querySelectorAll('.reporte-motivo-opt').forEach(e => e.classList.remove('sel'));
  if (el) el.classList.add('sel');
  rmMotivoSel = motivo;
  const btn = q('btnEnviarReporte');
  if (btn) btn.disabled = false;
}

export async function enviarReporte() {
  if (!rmPreguntaId || !rmMotivoSel) return;

  const sb = deps.getSupabase?.();
  const btn = q('btnEnviarReporte');
  const desc = q('rmDesc');

  if (!sb) {
    showReportToast('❌ Supabase no está inicializado.', true);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
  }

  try {
    const user = sb.auth?.getUser ? (await sb.auth.getUser()).data?.user : null;
    const currentProfile = deps.getCurrentProfile?.();

    const { error } = await sb
      .from('reportes_preguntas')
      .insert({
        pregunta_id: rmPreguntaId,
        user_id: user?.id || null,
        username: currentProfile?.username || null,
        motivo: rmMotivoSel,
        descripcion: desc?.value?.trim() || null
      });

    if (error) throw error;

    reportesEnviados.add(rmPreguntaId);
    cerrarModalReporte();
    deps.renderExam?.();
    showReportToast('✅ Reporte enviado. ¡Gracias por ayudar a mejorar ResiAR!');
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Enviar reporte';
    }
    showReportToast('❌ Error al enviar: ' + (e?.message || e), true);
  }
}

export function mostrarToastReporte(msg, esError = false) {
  showReportToast(msg, esError);
}

export function abrirAdminReportes() {
  q('modalAdminReportes')?.classList.add('vis');
  cargarAdminReportes('pendiente');
}

export async function filtrarReportes(estado, btn) {
  document.querySelectorAll('.rep-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  repFiltroActual = estado;
  cargarAdminReportes(estado);
}

export async function cargarAdminReportes(estado = repFiltroActual) {
  const sb = deps.getSupabase?.();
  const box = q('adminReportesBody');

  if (!box) return;
  box.innerHTML = '<div class="lb-empty">Cargando...</div>';

  if (!sb) {
    box.innerHTML = '<div class="lb-empty">Supabase no está inicializado.</div>';
    return;
  }

  try {
    let query = sb
      .from('reportes_preguntas')
      .select('*, preguntas(pregunta, especialidad, especialidad_v2, tema, tema_v2, examen)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (estado !== 'todos') query = query.eq('estado', estado);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || !data.length) {
      box.innerHTML = '<div class="lb-empty">No hay reportes en este estado.</div>';
      return;
    }

    box.innerHTML = data.map(r => {
      const fecha = new Date(r.created_at).toLocaleDateString('es', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const pregTxt = r.preguntas?.pregunta || r.pregunta_id;
      const esp = r.preguntas ? deps.espLabel(r.preguntas) : '';
      return `
        <div class="rep-card" id="repcard_${escAttr(r.id)}">
          <div class="rep-card-head">
            <div>
              <span style="font-size:0.78rem;font-weight:600;color:var(--text)">${MOTIVOS_LABEL[r.motivo] || deps.escapeHtml(r.motivo)}</span>
              ${esp ? `<span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--accent);margin-left:8px;">${deps.escapeHtml(esp)}</span>` : ''}
            </div>
            <span class="rep-badge ${deps.escapeHtml(r.estado)}">${deps.escapeHtml(r.estado)}</span>
          </div>
          <div class="rep-pregunta-txt">${deps.escapeHtml(pregTxt)}</div>
          ${r.descripcion ? `<div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px;font-style:italic;">"${deps.escapeHtml(r.descripcion)}"</div>` : ''}
          <div class="rep-meta">
            ${r.username ? `👤 ${deps.escapeHtml(r.username)} · ` : ''}🕐 ${fecha} · ID: ${deps.escapeHtml(r.pregunta_id)}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <select class="rep-estado-sel" data-change-action="update-report-status" data-report-id="${escAttr(r.id)}">
              <option value="pendiente"  ${r.estado === 'pendiente' ? 'selected' : ''}>🟡 Pendiente</option>
              <option value="revisado"   ${r.estado === 'revisado' ? 'selected' : ''}>🟣 Revisado</option>
              <option value="resuelto"   ${r.estado === 'resuelto' ? 'selected' : ''}>🟢 Resuelto</option>
              <option value="descartado" ${r.estado === 'descartado' ? 'selected' : ''}>⬜ Descartado</option>
            </select>
            <a href="#" data-action="go-report-question" data-question-id="${escAttr(r.pregunta_id)}" style="font-size:0.75rem;color:var(--accent);">Ver pregunta →</a>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<div class="lb-empty">Error: ${deps.escapeHtml(e?.message || e)}</div>`;
  }
}

export async function actualizarEstadoReporte(reporteId, nuevoEstado) {
  const sb = deps.getSupabase?.();

  if (!sb) {
    showReportToast('❌ Supabase no está inicializado.', true);
    return;
  }

  const { error } = await sb
    .from('reportes_preguntas')
    .update({ estado: nuevoEstado })
    .eq('id', reporteId);

  if (error) {
    showReportToast('❌ Error al actualizar: ' + error.message, true);
  } else {
    showReportToast('✅ Estado actualizado');
    const card = q('repcard_' + reporteId);
    if (card) {
      const badge = card.querySelector('.rep-badge');
      if (badge) {
        badge.className = 'rep-badge ' + nuevoEstado;
        badge.textContent = nuevoEstado;
      }
    }
  }
}

export function irAReportePregunta(preguntaId) {
  const examen = deps.getExam?.() || [];
  if (!examen.length) {
    showReportToast('No hay examen activo', true);
    return;
  }

  const idx = examen.findIndex(q => String(q.id) === String(preguntaId));
  if (idx === -1) {
    showReportToast('Pregunta no está en el examen actual', true);
    return;
  }

  q('modalAdminReportes')?.classList.remove('vis');
  deps.setCurrentQuestion?.(idx);
}

export function checkAdminReportesBtn() {
  const wrap = q('btnAdminReportesWrap');
  const currentProfile = deps.getCurrentProfile?.();
  if (wrap) wrap.style.display = (currentProfile?.plan === 'admin') ? 'block' : 'none';
}
