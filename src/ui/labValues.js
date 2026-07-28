// RESIAR v75 — Valores normales durante el examen
// Consulta local, instantánea y sin Supabase.
// Se inserta como botón auxiliar dentro del panel derecho del examen.

const LAB_VALUES = [
  {
    category: 'Hemograma y fórmula leucocitaria',
    items: [
      { name: 'Hemoglobina', value: 'Hombres 13-17 · Mujeres 12-15', unit: 'g/dL' },
      { name: 'Hematocrito', value: 'Hombres 40-50 · Mujeres 36-44', unit: '%' },
      { name: 'Glóbulos blancos', value: '4.000-11.000', unit: '/µL' },
      { name: 'Plaquetas', value: '150.000-400.000', unit: '/µL' },
      { name: 'VCM', value: '80-100', unit: 'fL', note: 'Volumen corpuscular medio' },
      { name: 'Neutrófilos', value: '40-70', unit: '%' },
      { name: 'Linfocitos', value: '20-40', unit: '%' },
      { name: 'Monocitos', value: '2-8', unit: '%' },
      { name: 'Eosinófilos', value: '1-4', unit: '%' },
      { name: 'Basófilos', value: '0-1', unit: '%' }
    ]
  },
  {
    category: 'Metabolismo, glucemia y función renal',
    items: [
      { name: 'Glucemia en ayunas', value: '70-100', unit: 'mg/dL' },
      { name: 'Urea', value: '15-40', unit: 'mg/dL' },
      { name: 'Creatinina', value: 'Hombres 0,6-1,2 · Mujeres 0,5-1,1', unit: 'mg/dL' },
      { name: 'Ácido úrico', value: 'Hombres 3,5-7,2 · Mujeres 2,6-6,0', unit: 'mg/dL' },
      { name: 'HbA1c', value: '<5,7 normal · 5,7-6,4 prediabetes · ≥6,5 diabetes', unit: '%' }
    ]
  },
  {
    category: 'Ionograma y minerales',
    items: [
      { name: 'Sodio', value: '135-145', unit: 'mEq/L' },
      { name: 'Potasio', value: '3,5-5,0', unit: 'mEq/L' },
      { name: 'Cloro', value: '98-107', unit: 'mEq/L' },
      { name: 'Calcio', value: '8,5-10,5', unit: 'mg/dL' },
      { name: 'Fósforo', value: '2,5-4,5', unit: 'mg/dL' },
      { name: 'Magnesio', value: '1,7-2,2', unit: 'mg/dL' }
    ]
  },
  {
    category: 'Hepatograma y proteínas',
    items: [
      { name: 'ALT / TGP', value: 'Hombres 7-45 · Mujeres 7-37', unit: 'U/L' },
      { name: 'AST / TGO', value: '10-40', unit: 'U/L' },
      { name: 'Fosfatasa alcalina', value: '40-130', unit: 'U/L', note: 'Adultos' },
      { name: 'Bilirrubina total', value: '0,3-1,2', unit: 'mg/dL' },
      { name: 'Bilirrubina directa', value: '0-0,3', unit: 'mg/dL' },
      { name: 'Albúmina', value: '3,5-5,0', unit: 'g/dL' },
      { name: 'Proteínas totales', value: '6,0-8,0', unit: 'g/dL' },
      { name: 'GGT', value: 'Hombres 8-61 · Mujeres 5-36', unit: 'U/L' }
    ]
  },
  {
    category: 'Perfil lipídico',
    items: [
      { name: 'Colesterol total', value: '<200', unit: 'mg/dL', note: 'Deseable' },
      { name: 'LDL-colesterol', value: '<100 óptimo · <130 aceptable', unit: 'mg/dL' },
      { name: 'HDL-colesterol', value: 'Hombres ≥40 · Mujeres ≥50', unit: 'mg/dL' },
      { name: 'Triglicéridos', value: '<150', unit: 'mg/dL' }
    ]
  },
  {
    category: 'Función tiroidea',
    items: [
      { name: 'TSH', value: '0,27-4,20', unit: 'mIU/L' },
      { name: 'T4 libre', value: '0,8-1,8', unit: 'ng/dL', note: 'Equivale aprox. a 10-23 pmol/L' },
      { name: 'T3 libre', value: '2,3-4,2', unit: 'pg/mL', note: 'Equivale aprox. a 3,1-6,8 pmol/L' }
    ]
  },
  {
    category: 'Coagulación',
    items: [
      { name: 'Tiempo de protrombina / TP', value: '11-13', unit: 'segundos' },
      { name: 'INR', value: '0,8-1,2', unit: '' },
      { name: 'KPTT / aPTT', value: '25-35', unit: 'segundos' },
      { name: 'Fibrinógeno', value: '200-400', unit: 'mg/dL' }
    ]
  },
  {
    category: 'Inflamación, páncreas y enzimas',
    items: [
      { name: 'PCR ultrasensible', value: '<3', unit: 'mg/L' },
      { name: 'Amilasa', value: '30-110', unit: 'U/L' },
      { name: 'Lipasa', value: '10-140', unit: 'U/L' },
      { name: 'LDH', value: 'Variable según laboratorio', unit: '' }
    ]
  }
];

const SEARCH_ALIASES = {
  hemoglobina: ['hb', 'anemia'],
  hematocrito: ['hto', 'hcto'],
  'glóbulos blancos': ['globulos blancos', 'leucocitos', 'gb'],
  plaquetas: ['plaq', 'trombocitos'],
  vcm: ['volumen corpuscular medio', 'microcitosis', 'macrocitosis'],
  glucemia: ['glucosa', 'azucar', 'diabetes'],
  creatinina: ['renal', 'riñon', 'rinon'],
  sodio: ['na', 'natremia', 'hiponatremia', 'hipernatremia'],
  potasio: ['k', 'kalemia', 'hipokalemia', 'hiperkalemia'],
  cloro: ['cl'],
  calcio: ['ca'],
  fósforo: ['fosforo', 'p'],
  magnesio: ['mg'],
  'alt / tgp': ['alt', 'tgp', 'transaminasa'],
  'ast / tgo': ['ast', 'tgo', 'transaminasa'],
  'fosfatasa alcalina': ['fal', 'fa'],
  'bilirrubina total': ['bt'],
  'bilirrubina directa': ['bd'],
  'ggt': ['gamma gt'],
  'ldl-colesterol': ['ldl'],
  'hdl-colesterol': ['hdl'],
  triglicéridos: ['trigliceridos', 'tg'],
  tsh: ['tirotrofina'],
  't4 libre': ['t4l', 'tiroxina'],
  't3 libre': ['t3l'],
  inr: ['rango internacional normalizado'],
  'kptt / aptt': ['kptt', 'aptt', 'ttpa'],
  fibrinógeno: ['fibrinogeno'],
  'pcr ultrasensible': ['pcr', 'proteina c reactiva'],
  ldh: ['lactato deshidrogenasa']
};

let installed = false;
let modalBuilt = false;
let lastQuery = '';

function normalize(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9µ/.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flatValues() {
  return LAB_VALUES.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      category: group.category,
      searchText: normalize([
        group.category,
        item.name,
        item.value,
        item.unit,
        item.note,
        ...(SEARCH_ALIASES[normalize(item.name)] || SEARCH_ALIASES[String(item.name).toLowerCase()] || [])
      ].join(' '))
    }))
  );
}

const FLAT_VALUES = flatValues();

function ensureStyles() {
  if (document.getElementById('resiar-lab-values-style-v75')) return;

  const style = document.createElement('style');
  style.id = 'resiar-lab-values-style-v75';
  style.textContent = `
    .resiar-lab-values-btn {
      width: 100%;
      min-height: 42px;
      border-radius: 14px;
      border: 1px solid rgba(14,165,233,.24);
      background: linear-gradient(135deg, rgba(14,165,233,.10), rgba(148,163,184,.05));
      color: var(--text);
      font-weight: 850;
      letter-spacing: -.01em;
      cursor: pointer;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }

    .resiar-lab-values-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(14,165,233,.38);
      box-shadow: 0 12px 28px rgba(14,165,233,.13);
    }

    .resiar-lab-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(15,23,42,.46);
      backdrop-filter: blur(10px);
      z-index: 99999;
    }

    .resiar-lab-overlay.vis {
      display: flex;
    }

    .resiar-lab-panel {
      width: min(880px, calc(100vw - 28px));
      max-height: min(760px, calc(100vh - 28px));
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      border-radius: 28px;
      border: 1px solid rgba(148,163,184,.22);
      background:
        radial-gradient(circle at 10% 0%, rgba(14,165,233,.12), transparent 32%),
        var(--card, #fff);
      box-shadow: 0 28px 80px rgba(15,23,42,.24);
      overflow: hidden;
    }

    [data-theme="dark"] .resiar-lab-panel {
      background:
        radial-gradient(circle at 10% 0%, rgba(14,165,233,.14), transparent 32%),
        var(--card, #111827);
      box-shadow: 0 28px 90px rgba(0,0,0,.45);
    }

    .resiar-lab-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding: 20px 22px 12px;
    }

    .resiar-lab-kicker {
      font-family: var(--font-mono, 'Space Grotesk', monospace);
      font-size: .62rem;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: var(--accent, #0ea5e9);
      font-weight: 900;
    }

    .resiar-lab-title {
      margin-top: 4px;
      font-family: var(--font-serif, 'Playfair Display', serif);
      font-size: clamp(1.55rem, 3vw, 2.2rem);
      font-weight: 800;
      line-height: .95;
      color: var(--text, #111827);
    }

    .resiar-lab-close {
      width: 38px;
      height: 38px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(148,163,184,.08);
      color: var(--text);
      cursor: pointer;
      font-size: 1.2rem;
      font-weight: 900;
    }

    .resiar-lab-search-wrap {
      padding: 0 22px 14px;
    }

    .resiar-lab-search {
      width: 100%;
      min-height: 44px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.24);
      background: rgba(148,163,184,.08);
      color: var(--text);
      padding: 0 14px;
      outline: none;
      font-weight: 750;
    }

    .resiar-lab-search:focus {
      border-color: rgba(14,165,233,.55);
      box-shadow: 0 0 0 4px rgba(14,165,233,.10);
    }

    .resiar-lab-body {
      overflow: auto;
      padding: 0 22px 18px;
    }

    .resiar-lab-category {
      margin: 10px 0 16px;
    }

    .resiar-lab-category-title {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 8px 0;
      background: linear-gradient(180deg, var(--card, #fff) 70%, transparent);
      font-family: var(--font-mono, 'Space Grotesk', monospace);
      color: var(--text2, #64748b);
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: .65rem;
      font-weight: 900;
    }

    [data-theme="dark"] .resiar-lab-category-title {
      background: linear-gradient(180deg, var(--card, #111827) 70%, transparent);
    }

    .resiar-lab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
    }

    .resiar-lab-row {
      min-width: 0;
      border: 1px solid rgba(148,163,184,.16);
      background: rgba(148,163,184,.07);
      border-radius: 18px;
      padding: 12px 13px;
    }

    .resiar-lab-name {
      color: var(--text);
      font-weight: 900;
      font-size: .88rem;
      line-height: 1.16;
    }

    .resiar-lab-value {
      margin-top: 6px;
      color: var(--accent, #0ea5e9);
      font-family: var(--font-mono, 'Space Grotesk', monospace);
      font-size: .82rem;
      font-weight: 900;
      line-height: 1.25;
    }

    .resiar-lab-note {
      margin-top: 5px;
      color: var(--text3, #94a3b8);
      font-size: .72rem;
      line-height: 1.25;
    }

    .resiar-lab-foot {
      padding: 12px 22px 18px;
      border-top: 1px solid rgba(148,163,184,.14);
      color: var(--text3, #94a3b8);
      font-size: .72rem;
      line-height: 1.35;
    }

    .resiar-lab-empty {
      padding: 24px;
      border: 1px dashed rgba(148,163,184,.28);
      border-radius: 18px;
      color: var(--text2);
      text-align: center;
      font-weight: 750;
    }

    @media (max-width: 680px) {
      .resiar-lab-overlay {
        padding: 0;
      }

      .resiar-lab-panel {
        width: 100vw;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
      }

      .resiar-lab-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderValues(query = '') {
  const body = document.getElementById('resiarLabValuesBody');
  if (!body) return;

  const q = normalize(query);
  const matched = q
    ? FLAT_VALUES.filter((item) => item.searchText.includes(q))
    : null;

  if (q && !matched.length) {
    body.innerHTML = `<div class="resiar-lab-empty">No encontré valores para “${escapeHtml(query)}”. Probá con otro nombre o abreviatura.</div>`;
    return;
  }

  if (q) {
    const grouped = matched.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    body.innerHTML = Object.entries(grouped)
      .map(([category, items]) => renderCategory(category, items))
      .join('');
    return;
  }

  body.innerHTML = LAB_VALUES
    .map((group) => renderCategory(group.category, group.items))
    .join('');
}

function renderCategory(category, items) {
  return `
    <section class="resiar-lab-category">
      <div class="resiar-lab-category-title">${escapeHtml(category)}</div>
      <div class="resiar-lab-grid">
        ${items.map(renderItem).join('')}
      </div>
    </section>`;
}

function renderItem(item) {
  return `
    <article class="resiar-lab-row">
      <div class="resiar-lab-name">${escapeHtml(item.name)}</div>
      <div class="resiar-lab-value">${escapeHtml(item.value)}${item.unit ? ` <span style="opacity:.78">${escapeHtml(item.unit)}</span>` : ''}</div>
      ${item.note ? `<div class="resiar-lab-note">${escapeHtml(item.note)}</div>` : ''}
    </article>`;
}

function buildModal() {
  if (modalBuilt) return;
  modalBuilt = true;

  const overlay = document.createElement('div');
  overlay.id = 'resiarLabValuesOverlay';
  overlay.className = 'resiar-lab-overlay';
  overlay.innerHTML = `
    <div class="resiar-lab-panel" role="dialog" aria-modal="true" aria-labelledby="resiarLabValuesTitle">
      <div class="resiar-lab-head">
        <div>
          <div class="resiar-lab-kicker">Consulta rápida</div>
          <div id="resiarLabValuesTitle" class="resiar-lab-title">Valores normales</div>
        </div>
        <button id="resiarLabValuesClose" class="resiar-lab-close" type="button" aria-label="Cerrar valores normales">×</button>
      </div>
      <div class="resiar-lab-search-wrap">
        <input id="resiarLabValuesSearch" class="resiar-lab-search" type="search" autocomplete="off" placeholder="Buscar: plaquetas, sodio, TSH, INR..." />
      </div>
      <div id="resiarLabValuesBody" class="resiar-lab-body"></div>
      <div class="resiar-lab-foot">
        Valores orientativos para adultos. Pueden variar según laboratorio, método y contexto clínico. Usalos como referencia rápida durante el examen.
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeLabValues();
  });

  document.getElementById('resiarLabValuesClose')?.addEventListener('click', closeLabValues);
  document.getElementById('resiarLabValuesSearch')?.addEventListener('input', (event) => {
    lastQuery = event.target?.value || '';
    renderValues(lastQuery);
  });

  renderValues('');
}

function openLabValues() {
  ensureStyles();
  buildModal();
  renderValues(lastQuery);

  const overlay = document.getElementById('resiarLabValuesOverlay');
  overlay?.classList.add('vis');

  const input = document.getElementById('resiarLabValuesSearch');
  if (input) {
    input.value = lastQuery;
    setTimeout(() => input.focus(), 80);
  }
}

function closeLabValues() {
  document.getElementById('resiarLabValuesOverlay')?.classList.remove('vis');
}

function findInsertionPoint() {
  const noteButton = document.getElementById('rpBtnNota');
  if (noteButton) return { mode: 'after', el: noteButton };

  const reportButton = document.getElementById('rpBtnReporte')
    || document.getElementById('btnReportarPregunta')
    || Array.from(document.querySelectorAll('button,a')).find((el) =>
      /reportar pregunta/i.test(el.textContent || '')
    );

  if (reportButton) return { mode: 'before', el: reportButton };

  const navGrid = document.getElementById('rpNavGrid');
  if (navGrid?.parentElement) return { mode: 'before', el: navGrid };

  const rightPanel = document.getElementById('rightPanel')
    || document.getElementById('examRightPanel')
    || document.querySelector('.right-panel, .exam-side, .exam-sidebar');

  if (rightPanel) return { mode: 'append', el: rightPanel };

  return null;
}

function ensureButton() {
  if (!document.body) return;

  let btn = document.getElementById('resiarLabValuesButton');
  const target = findInsertionPoint();

  if (!target) {
    if (btn) btn.remove();
    return;
  }

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'resiarLabValuesButton';
    btn.type = 'button';
    btn.className = 'resiar-lab-values-btn';
    btn.textContent = '📊 Valores normales';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openLabValues();
    });
  }

  if (!btn.isConnected) {
    if (target.mode === 'after') target.el.insertAdjacentElement('afterend', btn);
    else if (target.mode === 'before') target.el.insertAdjacentElement('beforebegin', btn);
    else target.el.appendChild(btn);
  }
}

function installKeyboardShortcut() {
  document.addEventListener('keydown', (event) => {
    const tag = String(event.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;

    if (event.key === 'Escape') {
      closeLabValues();
      return;
    }

    if (typing) return;

    // Atajo deliberadamente no invasivo: Alt + V.
    if (event.altKey && !event.ctrlKey && !event.metaKey && String(event.key || '').toLowerCase() === 'v') {
      event.preventDefault();
      openLabValues();
    }
  });
}

export function installLabValuesReference(options = {}) {
  if (installed) return;
  installed = true;

  ensureStyles();
  buildModal();
  installKeyboardShortcut();

  const observer = new MutationObserver(() => {
    try { ensureButton(); } catch (_) {}
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  setInterval(() => {
    try { ensureButton(); } catch (_) {}
  }, 1500);

  try {
    window.resiarOpenLabValues = openLabValues;
    window.resiarCloseLabValues = closeLabValues;
    window.resiarLabValues = LAB_VALUES;
  } catch (_) {}

  setTimeout(ensureButton, 100);
  setTimeout(ensureButton, 700);
  setTimeout(ensureButton, 1600);
}

export default installLabValuesReference;
