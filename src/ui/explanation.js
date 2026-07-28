import { getQuestionImagePaths, getQuestionImageUrlFromPath } from '../utils/questionImages.js';
const EXPLICACION_PROMPT_VERSION = 2;

const FRASES_LOADING = [
  'Analizando los criterios diagnósticos...',
  'Revisando fisiopatología...',
  'Consultando bibliografía médica...',
  'Repasando el mecanismo de acción...',
  'Diferenciando diagnósticos posibles...',
  'Evaluando la evidencia clínica...',
  'Conectando conceptos clave...',
  'Preparando la explicación...',
  'Revisando guías y protocolos...',
  'Construyendo el razonamiento clínico...'
];

function noop() {}


function buildExplanationImagesPayload(question) {
  try {
    if (!question) return [];
    const paths = getQuestionImagePaths(question);
    if (!Array.isArray(paths) || !paths.length) return [];

    return paths
      .map((path, index) => {
        const url = getQuestionImageUrlFromPath(path);
        if (!url) return null;
        return {
          url,
          path,
          index: index + 1,
          alt: question.imagen_alt || null,
          caption: question.imagen_caption || null
        };
      })
      .filter(Boolean)
      .slice(0, 4);
  } catch (error) {
    console.warn('[ResiAR] No se pudieron preparar imágenes para explicación IA:', error);
    return [];
  }
}

function getAiButton() {
  return document.getElementById('btnExplicar');
}

function getExplanationBox() {
  return document.getElementById('explicacionBox');
}

function safeText(node, value) {
  if (node) node.textContent = value;
}

const EXPLICACION_SECCIONES_COMPACTAS = new Map([
  ['respuesta correcta', 'Respuesta correcta'],
  ['respuesta oficial', 'Respuesta oficial'],
  ['respuestas incorrectas', 'Respuestas incorrectas'],
  ['concepto clave', 'Concepto clave'],
  ['repaso', 'Repaso']
]);

function normalizarEtiquetaSeccion(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function splitInlineIncorrectas(line) {
  const text = String(line || '').trim();
  if (!text) return [];

  const match = text.match(/(^|[.!?]\s+)(Las otras opciones\b|Las demás opciones\b|El resto de las opciones\b|Las opciones incorrectas\b|Las alternativas incorrectas\b)/i);
  if (!match || typeof match.index !== 'number' || match.index <= 0) return [text];

  const start = match.index + match[1].length;
  const before = text.slice(0, start).trim();
  const after = text.slice(start).trim();
  if (!before || !after) return [text];

  return [before, `Respuestas incorrectas: ${after}`];
}

function normalizarTextoExplicacionGroq(texto) {
  const lines = String(texto || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const out = [];
  let pendingHeader = '';
  let currentSection = '';
  let hasIncorrectas = false;

  function pushLine(value, section = currentSection) {
    const parts = (section === 'Respuesta correcta' || section === 'Respuesta oficial')
      ? splitInlineIncorrectas(value)
      : [String(value || '').trim()];

    parts.forEach((part) => {
      const clean = String(part || '').trim();
      if (!clean) return;
      if (/^Respuestas incorrectas\s*:/i.test(clean)) {
        hasIncorrectas = true;
        currentSection = 'Respuestas incorrectas';
      }
      out.push(clean);
    });
  }

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+?)(?:\*\*)?\s*:\s*(.*)$/);
    if (sectionMatch) {
      const canonical = EXPLICACION_SECCIONES_COMPACTAS.get(normalizarEtiquetaSeccion(sectionMatch[1]));
      if (canonical) {
        if (pendingHeader) {
          pushLine(`${pendingHeader}:`, pendingHeader);
          pendingHeader = '';
        }

        currentSection = canonical;
        if (canonical === 'Respuestas incorrectas') hasIncorrectas = true;

        const content = sectionMatch[2].trim();
        if (content) {
          pushLine(`${canonical}: ${content}`, canonical);
        } else {
          pendingHeader = canonical;
        }
        continue;
      }
    }

    if (pendingHeader) {
      currentSection = pendingHeader;
      pushLine(`${pendingHeader}: ${line}`, pendingHeader);
      pendingHeader = '';
      continue;
    }

    pushLine(line);
  }

  if (pendingHeader) pushLine(`${pendingHeader}:`, pendingHeader);

  let normalized = out
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  if (!hasIncorrectas) {
    normalized = normalized.replace(
      /(Respuesta (?:correcta|oficial):[\s\S]*?)(^|\n)(Las otras opciones\b|Las demás opciones\b|El resto de las opciones\b|Las opciones incorrectas\b|Las alternativas incorrectas\b)/i,
      (_m, before, sep, start) => `${before.trim()}\nRespuestas incorrectas: ${start}`
    );
  }

  return normalized.trim();
}

function renderExplicacionBodyCompacta(texto, markdownToHtml) {
  return markdownToHtml(normalizarTextoExplicacionGroq(texto));
}

export function configureExplanation(deps = {}) {
  const getSupabase = typeof deps.getSupabase === 'function' ? deps.getSupabase : () => window.sb;
  const getSupabaseUrl = typeof deps.getSupabaseUrl === 'function' ? deps.getSupabaseUrl : () => window.SUPA_URL || '';
  const getCurrentQuestion = typeof deps.getCurrentQuestion === 'function' ? deps.getCurrentQuestion : () => null;
  const getCurrentAnswer = typeof deps.getCurrentAnswer === 'function' ? deps.getCurrentAnswer : () => null;
  const isTrialLimited = typeof deps.isTrialLimited === 'function' ? deps.isTrialLimited : () => false;
  const isRespuestaAnulada = typeof deps.isRespuestaAnulada === 'function' ? deps.isRespuestaAnulada : () => false;
  const isBancoMIR = typeof deps.isBancoMIR === 'function' ? deps.isBancoMIR : () => false;
  const espLabel = typeof deps.espLabel === 'function' ? deps.espLabel : () => '';
  const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : (v) => String(v ?? '');
  const markdownToHtml = typeof deps.markdownToHtml === 'function' ? deps.markdownToHtml : (v) => escapeHtml(v);
  const mostrarToast = typeof deps.mostrarToast === 'function' ? deps.mostrarToast : noop;
  const getPreguntaBox = typeof deps.getPreguntaBox === 'function' ? deps.getPreguntaBox : () => null;

  async function renderExplicacion({ texto, modelo, fromCache, preguntaId, session, promptVersion }) {
    const sb = getSupabase();
    const btn = getAiButton();
    const box = getExplanationBox();
    if (!sb || !box) return;

    const partes = String(texto || '').split(/\n(?=Referencias:)/i);
    const explicacion = (partes[0] || '').trim();
    const refTexto = partes[1] ? partes[1].trim() : '';

    let bodyHtml = renderExplicacionBodyCompacta(explicacion, markdownToHtml);
    if (refTexto) {
      bodyHtml += `<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(167,139,250,0.15);font-size:0.78rem;color:var(--text2);line-height:1.7;">
        <span style="font-family:'Space Grotesk','DM Mono',monospace;font-size:0.58rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text3);">📖 Referencias</span><br>
        ${markdownToHtml(refTexto.replace(/^Referencias:\s*/i, ''))}</div>`;
    }

    const pv = promptVersion ?? EXPLICACION_PROMPT_VERSION;
    const userId = session?.user?.id;

    const { data: votoExistente } = await sb
      .from('votos_explicacion')
      .select('voto')
      .eq('pregunta_id', preguntaId)
      .eq('prompt_version', pv)
      .eq('user_id', userId)
      .maybeSingle();

    const miVoto = votoExistente?.voto || 0;

    const { data: votosData } = await sb
      .from('votos_explicacion_score')
      .select('positivos, negativos')
      .eq('pregunta_id', preguntaId)
      .eq('prompt_version', pv)
      .maybeSingle();

    const positivos = votosData?.positivos ?? 0;
    const negativos = votosData?.negativos ?? 0;

    const esManual = modelo === 'manual';
    const modeloLabel = (() => {
      if (esManual || !modelo) return null;
      const m = String(modelo).replace(/^[^/]+\//, '');
      return m.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    })();

    box.innerHTML = `
      <div class="explicacion-box">
        <div class="exp-header">
          ${esManual ? '📝 Explicación' : '✨ Explicación · IA'}
          ${modeloLabel ? `<span class="exp-modelo-tag">${escapeHtml(modeloLabel)}</span>` : ''}
          ${esManual ? '<span style="font-size:0.6rem;opacity:0.5;margin-left:6px;font-family:var(--font-mono);">redacción manual</span>' : ''}
          ${(!esManual && fromCache) ? '<span style="font-size:0.6rem;opacity:0.5;margin-left:6px;font-family:var(--font-mono);">caché</span>' : ''}
        </div>
        <div class="exp-body">${bodyHtml}</div>
        <div class="exp-votos" id="expVotos">
          <span class="exp-votos-label">¿Te resultó útil?</span>
          <button class="btn-voto btn-voto-up ${miVoto === 1 ? 'activo' : ''}"
            id="btnVotoUp"
            data-action="explanation-vote"
            data-vote="1"
            data-question-id="${escapeHtml(String(preguntaId))}"
            data-prompt-version="${pv}">
            👍 <span id="votoUpCount">${positivos}</span>
          </button>
          <button class="btn-voto btn-voto-down ${miVoto === -1 ? 'activo' : ''}"
            id="btnVotoDown"
            data-action="explanation-vote"
            data-vote="-1"
            data-question-id="${escapeHtml(String(preguntaId))}"
            data-prompt-version="${pv}">
            👎 <span id="votoDownCount">${negativos}</span>
          </button>
        </div>
      </div>`;

    if (btn) {
      safeText(btn.querySelector('.ai-txt'), '✓ Explicación lista');
      btn.classList.remove('loading');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'default';
    }

    const preguntaBox = getPreguntaBox();
    preguntaBox?.scrollTo({ top: preguntaBox.scrollHeight, behavior: 'smooth' });
  }

  async function pedirExplicacion() {
    if (isTrialLimited()) {
      mostrarToast('🔒 La explicación con IA está disponible en el plan Pro');
      return;
    }

    const sb = getSupabase();
    const btn = getAiButton();
    const box = getExplanationBox();
    if (!sb || !btn || !box) return;

    const p = getCurrentQuestion();
    if (!p) return;

    const selUsuario = getCurrentAnswer();
    const preguntaId = p.id;

    btn.disabled = true;
    btn.classList.add('loading');
    safeText(btn.querySelector('.ai-txt'), 'Cargando...');

    let fraseIdx = Math.floor(Math.random() * FRASES_LOADING.length);
    let fraseTimer = null;

    box.innerHTML = `
      <div class="explicacion-box exp-loading-box">
        <div class="exp-loading-inner">
          <div class="exp-loading-orbs">
            <span class="exp-orb exp-orb1"></span>
            <span class="exp-orb exp-orb2"></span>
            <span class="exp-orb exp-orb3"></span>
          </div>
          <div class="exp-loading-frase" id="expLoadingFrase">${FRASES_LOADING[fraseIdx]}</div>
        </div>
      </div>`;

    function rotateFrase() {
      const el = document.getElementById('expLoadingFrase');
      if (!el) return;
      el.classList.add('exp-frase-out');
      setTimeout(() => {
        fraseIdx = (fraseIdx + 1) % FRASES_LOADING.length;
        el.textContent = FRASES_LOADING[fraseIdx];
        el.classList.remove('exp-frase-out');
      }, 350);
    }

    fraseTimer = setInterval(rotateFrase, 2400);

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) throw new Error('Necesitás iniciar sesión para usar esta función');

      const { data: cacheRows } = await sb
        .from('explicaciones_cache')
        .select('texto, modelo, prompt_version')
        .eq('pregunta_id', preguntaId)
        .order('prompt_version', { ascending: false })
        .limit(5);

      const explicacionManual = cacheRows?.find(r => r.modelo === 'manual');

      if (explicacionManual) {
        clearInterval(fraseTimer);
        await renderExplicacion({
          texto: explicacionManual.texto,
          modelo: 'manual',
          fromCache: true,
          preguntaId,
          session,
          promptVersion: explicacionManual.prompt_version
        });
        return;
      }

      safeText(btn.querySelector('.ai-txt'), 'Consultando IA');
      clearInterval(fraseTimer);

      const imagenesExplicacion = buildExplanationImagesPayload(p);
      const payload = {
        pregunta: p.pregunta,
        opciones: p.opciones,
        respuesta: p.respuesta,
        respuesta_usuario: selUsuario,
        especialidad: espLabel(p) || 'Medicina familiar',
        anulada: isRespuestaAnulada(p),
        esMIR: isBancoMIR(p.examen),
        tipo_banco: p.examen || null,
        anio: p.anio ?? p.año ?? p.year ?? null,
        imagenes: imagenesExplicacion
      };

      const supabaseUrl = getSupabaseUrl();
      if (!supabaseUrl) throw new Error('Supabase no está inicializado');

      const res = await fetch(supabaseUrl + '/functions/v1/groq-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ payload, pregunta_id: preguntaId })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody?.error || ('Error ' + res.status);
        const errObj = new Error(errMsg);
        errObj.status = res.status;
        throw errObj;
      }

      const data = await res.json();
      const texto = data.texto || '';
      if (!texto) throw new Error('Sin respuesta del servidor');

      await renderExplicacion({
        texto,
        modelo: data.modelo || null,
        fromCache: data.fromCache === true,
        preguntaId,
        session,
        promptVersion: data.promptVersion ?? EXPLICACION_PROMPT_VERSION
      });

    } catch (err) {
      clearInterval(fraseTimer);
      const message = err && err.message ? err.message : String(err || 'Error desconocido');
      const es429 = err?.status === 429 || /saturad|429|rate.?limit/i.test(message);
      const msg = es429
        ? '⏳ El servicio de IA está saturado en este momento. Esperá 1-2 minutos y reintentá.'
        : 'Error: ' + escapeHtml(message) + '. Revisá tu conexión.';
      box.innerHTML = `<div class="explicacion-box"><div class="exp-body"><span style="color:var(--red);font-size:0.82rem;">${msg}</span></div></div>`;
      btn.disabled = false;
      btn.classList.remove('loading');
      safeText(btn.querySelector('.ai-txt'), es429 ? '⏳ Reintentar en 1-2 min' : '✨ Reintentar');
    }
  }

  async function votarExplicacion(nuevoVoto, preguntaId, promptVersion) {
    const sb = getSupabase();
    if (!sb) return;

    const pv = promptVersion ?? EXPLICACION_PROMPT_VERSION;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const btnUp = document.getElementById('btnVotoUp');
    const btnDown = document.getElementById('btnVotoDown');
    const yaActivo = (nuevoVoto === 1 && btnUp?.classList.contains('activo'))
      || (nuevoVoto === -1 && btnDown?.classList.contains('activo'));

    try {
      if (yaActivo) {
        await sb.from('votos_explicacion').delete()
          .eq('pregunta_id', preguntaId)
          .eq('prompt_version', pv)
          .eq('user_id', userId);
      } else {
        await sb.from('votos_explicacion').upsert({
          pregunta_id: preguntaId,
          prompt_version: pv,
          user_id: userId,
          voto: nuevoVoto,
          created_at: new Date().toISOString()
        }, { onConflict: 'pregunta_id,prompt_version,user_id' });

        const { data: scoreData } = await sb
          .from('votos_explicacion_score')
          .select('positivos, negativos, score')
          .eq('pregunta_id', preguntaId)
          .eq('prompt_version', pv)
          .maybeSingle();

        const pos = scoreData?.positivos ?? 0;
        const neg = scoreData?.negativos ?? 0;

        if (neg >= 2 && neg > pos) {
          await sb.from('explicaciones_cache').delete()
            .eq('pregunta_id', preguntaId)
            .eq('prompt_version', pv);
        }
      }

      const { data: votosData } = await sb
        .from('votos_explicacion_score')
        .select('positivos, negativos')
        .eq('pregunta_id', preguntaId)
        .eq('prompt_version', pv)
        .maybeSingle();

      const pos = votosData?.positivos ?? 0;
      const neg = votosData?.negativos ?? 0;

      const upCount = document.getElementById('votoUpCount');
      const downCount = document.getElementById('votoDownCount');
      if (upCount) upCount.textContent = pos;
      if (downCount) downCount.textContent = neg;

      if (yaActivo) {
        btnUp?.classList.remove('activo');
        btnDown?.classList.remove('activo');
      } else {
        btnUp?.classList.toggle('activo', nuevoVoto === 1);
        btnDown?.classList.toggle('activo', nuevoVoto === -1);
      }

    } catch (e) {
      console.error('Error al votar:', e);
    }
  }

  return {
    pedirExplicacion,
    votarExplicacion,
    renderExplicacion
  };
}
