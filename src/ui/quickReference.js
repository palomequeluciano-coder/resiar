// RESIAR v95 — Guía clínica SOLO con la información aportada por el usuario
// No contiene el banco ampliado previo. Solo conserva los scores, fórmulas y criterios
// incluidos en los textos pegados por el usuario.
// Todo local. No usa Supabase.

let installed = false;
let modalBuilt = false;
let activeTab = 'lab';
let activeItemId = '';
let lastQuery = '';

let GUIDE_ITEMS = [];
let guideDataPromise = null;

function ensureGuideData() {
  if (!guideDataPromise) {
    guideDataPromise = import('./quickReferenceData.js').then((mod) => {
      GUIDE_ITEMS = mod.GUIDE_ITEMS;
      try { window.resiarClinicalGuide = GUIDE_ITEMS; } catch (_) {}
    });
  }
  return guideDataPromise;
}


function normalize(value) {
  return String(value == null ? '' : value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s/.-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function n(value) { const x = Number(value); return Number.isFinite(x) ? x : 0; }
function round(value, digits=1) { const p = 10 ** digits; return Math.round(value * p) / p; }

function itemSearchText(item) {
  return normalize([
    item.title, item.category, item.use,
    ...(item.sections || []).flatMap((s) => [
      s.title, s.text,
      ...(s.columns || []),
      ...(s.rows || []).flat()
    ])
  ].join(' '));
}

function visibleItems() {
  const q = normalize(lastQuery);
  return GUIDE_ITEMS
    .filter((item) => item.tab === activeTab)
    .filter((item) => !q || itemSearchText(item).includes(q));
}

function ensureStyles() {
  if (document.getElementById('resiar-clinical-guide-style-v94')) return;
  const style = document.createElement('style');
  style.id = 'resiar-clinical-guide-style-v94';
  style.textContent = `
    .resiar-clinical-guide-btn{width:100%;min-height:39px;border-radius:12px;border:1px solid rgba(16,185,129,.28);background:rgba(16,185,129,.055);color:var(--green,#059669);font-family:inherit;font-size:.82rem;font-weight:800;line-height:1;letter-spacing:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;box-shadow:none;transition:background .16s ease,border-color .16s ease,color .16s ease,opacity .16s ease;margin-top:8px}
    .resiar-clinical-guide-btn:hover{border-color:rgba(16,185,129,.42);background:rgba(16,185,129,.085)}
    .rcg-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.46);backdrop-filter:blur(10px);z-index:99999}
    .rcg-overlay.vis{display:flex}
    .rcg-panel{width:min(1080px,calc(100vw - 28px));max-height:min(840px,calc(100vh - 28px));display:grid;grid-template-rows:auto auto auto 1fr auto;border-radius:28px;border:1px solid rgba(148,163,184,.22);background:radial-gradient(circle at 10% 0%,rgba(16,185,129,.12),transparent 32%),var(--card,#fff);box-shadow:0 28px 80px rgba(15,23,42,.24);overflow:hidden}
    [data-theme="dark"] .rcg-panel{background:radial-gradient(circle at 10% 0%,rgba(16,185,129,.14),transparent 32%),var(--card,#111827)}
    .rcg-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:20px 22px 10px}
    .rcg-kicker{font-family:var(--font-mono,'Space Grotesk',monospace);font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:var(--green,#059669);font-weight:900}
    .rcg-title{margin-top:4px;font-family:var(--font-serif,'Playfair Display',serif);font-size:clamp(1.6rem,3vw,2.35rem);font-weight:800;line-height:.95;color:var(--text,#111827)}
    .rcg-close{width:38px;height:38px;border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.08);color:var(--text);cursor:pointer;font-size:1.2rem;font-weight:900}
    .rcg-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:0 22px 12px}
    .rcg-tab{border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.07);color:var(--text2);border-radius:999px;padding:8px 12px;font-weight:900;font-size:.72rem;cursor:pointer}
    .rcg-tab.active{border-color:rgba(16,185,129,.36);background:rgba(16,185,129,.10);color:var(--green,#059669)}
    .rcg-search-wrap{padding:0 22px 14px}
    .rcg-search{width:100%;min-height:44px;border-radius:16px;border:1px solid rgba(148,163,184,.24);background:rgba(148,163,184,.08);color:var(--text);padding:0 14px;outline:none;font-weight:750}
    .rcg-body{overflow:auto;padding:0 22px 18px}
    .rcg-category{margin:10px 0 16px}
    .rcg-category-title{position:sticky;top:0;z-index:1;padding:8px 0;background:linear-gradient(180deg,var(--card,#fff) 70%,transparent);font-family:var(--font-mono,'Space Grotesk',monospace);color:var(--text2,#64748b);text-transform:uppercase;letter-spacing:.12em;font-size:.65rem;font-weight:900}
    .rcg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:10px}
    .rcg-card{min-width:0;border:1px solid rgba(148,163,184,.16);background:rgba(148,163,184,.07);border-radius:18px;padding:13px;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}
    .rcg-card:hover{transform:translateY(-1px);border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.07)}
    .rcg-name{color:var(--text);font-weight:950;font-size:.92rem;line-height:1.16}
    .rcg-use{margin-top:6px;color:var(--text2,#64748b);font-size:.75rem;line-height:1.32}
    .rcg-type{display:inline-block;margin-top:9px;font-family:var(--font-mono,'Space Grotesk',monospace);font-size:.55rem;letter-spacing:.09em;text-transform:uppercase;color:var(--green,#059669);border:1px solid rgba(16,185,129,.22);border-radius:999px;padding:4px 8px;background:rgba(16,185,129,.08)}
    .rcg-detail{border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:16px;background:rgba(148,163,184,.06)}
    .rcg-back{border:0;background:transparent;color:var(--green,#059669);font-weight:900;cursor:pointer;padding:0;margin-bottom:10px}
    .rcg-section{border:1px solid rgba(148,163,184,.16);background:rgba(148,163,184,.06);border-radius:16px;padding:12px;margin-top:12px}
    .rcg-section-title{font-family:var(--font-mono,'Space Grotesk',monospace);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--green,#059669);font-weight:950;margin-bottom:8px}
    .rcg-table-wrap{width:100%;overflow:auto;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:rgba(255,255,255,.02)}
    .rcg-table{width:100%;border-collapse:collapse;min-width:520px;font-size:.78rem;color:var(--text2)}
    .rcg-table th{font-family:var(--font-mono,'Space Grotesk',monospace);font-size:.58rem;letter-spacing:.10em;text-transform:uppercase;color:var(--green,#059669);font-weight:950;text-align:left;background:rgba(16,185,129,.07);padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.15);white-space:nowrap}
    .rcg-table td{padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.10);vertical-align:top;line-height:1.32;font-weight:720}
    .rcg-table tr:last-child td{border-bottom:0}
    .rcg-table td:first-child{color:var(--text);font-weight:900}
    .rcg-note{color:var(--text2);font-size:.82rem;line-height:1.42;font-weight:720}
    .rcg-calc-toggle{margin-top:14px;width:100%;min-height:40px;border-radius:14px;border:1px solid rgba(16,185,129,.30);background:rgba(16,185,129,.08);color:var(--green,#059669);font-family:inherit;font-size:.82rem;font-weight:900;cursor:pointer}
    .rcg-calc-panel{display:none;margin-top:10px}
    .rcg-calc-panel.vis{display:block}
    .rcg-calc{display:grid;gap:8px;margin-top:10px}
    .rcg-option{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid rgba(148,163,184,.16);border-radius:15px;padding:10px 12px;background:rgba(255,255,255,.03)}
    .rcg-option input,.rcg-option select{accent-color:var(--green,#059669)}
    .rcg-option-text{font-size:.82rem;color:var(--text);line-height:1.25;font-weight:750}
    .rcg-field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:9px;margin-top:10px}
    .rcg-field{display:grid;gap:5px;color:var(--text2);font-size:.72rem;font-weight:850}
    .rcg-field input,.rcg-field select{min-height:38px;border-radius:12px;border:1px solid rgba(148,163,184,.24);background:rgba(148,163,184,.08);color:var(--text);padding:0 10px;font-weight:800}
    .rcg-result{margin-top:14px;padding:13px 14px;border-radius:18px;background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(59,130,246,.06));border:1px solid rgba(16,185,129,.22)}
    .rcg-result-points{font-family:var(--font-serif,'Playfair Display',serif);font-size:2rem;line-height:1;color:var(--green,#059669);font-weight:900}
    .rcg-result-text{margin-top:6px;color:var(--text2);font-size:.84rem;line-height:1.35;font-weight:700}
    .rcg-foot{padding:12px 22px 18px;border-top:1px solid rgba(148,163,184,.14);color:var(--text3,#94a3b8);font-size:.72rem;line-height:1.35}
    .rcg-empty{padding:24px;border:1px dashed rgba(148,163,184,.28);border-radius:18px;color:var(--text2);text-align:center;font-weight:750}
    @media(max-width:680px){.rcg-overlay{padding:0}.rcg-panel{width:100vw;height:100vh;max-height:100vh;border-radius:0}.rcg-grid{grid-template-columns:1fr}.rcg-table{min-width:460px}}


    /* v114 - Guía clínica: pulido oscuro, elimina fondos blancos accidentales y mejora legibilidad */
    .rcg-panel{
      --rcg-bg: var(--surface,#ffffff);
      --rcg-soft: rgba(148,163,184,.065);
      --rcg-softer: rgba(148,163,184,.045);
      --rcg-border: rgba(148,163,184,.18);
      --rcg-border-strong: rgba(148,163,184,.26);
      --rcg-head-bg: rgba(16,185,129,.095);
      --rcg-row-bg: rgba(255,255,255,.018);
      --rcg-shadow: 0 28px 80px rgba(15,23,42,.24);
      background: radial-gradient(circle at 9% 0%,rgba(16,185,129,.12),transparent 34%),var(--rcg-bg)!important;
      color: var(--text,#111827);
      box-shadow: var(--rcg-shadow)!important;
    }
    [data-theme="dark"] .rcg-panel{
      --rcg-bg: #121b28;
      --rcg-soft: rgba(148,163,184,.075);
      --rcg-softer: rgba(148,163,184,.045);
      --rcg-border: rgba(148,163,184,.17);
      --rcg-border-strong: rgba(148,163,184,.24);
      --rcg-head-bg: rgba(16,185,129,.12);
      --rcg-row-bg: rgba(255,255,255,.020);
      --rcg-shadow: 0 28px 90px rgba(0,0,0,.48);
      background: radial-gradient(circle at 9% 0%,rgba(16,185,129,.14),transparent 34%),linear-gradient(180deg,#132131 0%,#101827 100%)!important;
    }
    [data-theme="light"] .rcg-panel{
      --rcg-bg: #ffffff;
      --rcg-soft: rgba(15,23,42,.035);
      --rcg-softer: rgba(15,23,42,.022);
      --rcg-border: rgba(15,23,42,.10);
      --rcg-border-strong: rgba(15,23,42,.14);
      --rcg-head-bg: rgba(5,150,105,.075);
      --rcg-row-bg: rgba(15,23,42,.012);
    }
    .rcg-body{scrollbar-gutter:stable;background:transparent!important;}
    .rcg-body::-webkit-scrollbar{width:6px;height:6px;}
    .rcg-body::-webkit-scrollbar-thumb{background:rgba(16,185,129,.32);border-radius:999px;}
    .rcg-category-title{
      background:linear-gradient(180deg,var(--rcg-bg) 74%,rgba(18,27,40,0))!important;
      box-shadow:0 1px 0 rgba(148,163,184,.08)!important;
      backdrop-filter:blur(6px);
    }
    [data-theme="light"] .rcg-category-title{background:linear-gradient(180deg,#fff 74%,rgba(255,255,255,0))!important;}
    .rcg-detail,.rcg-section{
      background:var(--rcg-soft)!important;
      border-color:var(--rcg-border)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.035);
    }
    .rcg-card,.rcg-search,.rcg-tab,.rcg-close,.rcg-field input,.rcg-field select,.rcg-option,.rcg-result{
      border-color:var(--rcg-border)!important;
    }
    .rcg-card,.rcg-search,.rcg-tab,.rcg-option,.rcg-field input,.rcg-field select{
      background:var(--rcg-softer)!important;
    }
    .rcg-card:hover,.rcg-tab.active{
      background:rgba(16,185,129,.095)!important;
      border-color:rgba(16,185,129,.34)!important;
    }
    .rcg-search:focus{
      border-color:rgba(16,185,129,.45)!important;
      box-shadow:0 0 0 4px rgba(16,185,129,.10)!important;
    }
    .rcg-table-wrap{
      background:var(--rcg-softer)!important;
      border-color:var(--rcg-border)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
    }
    .rcg-table{color:var(--text2,#94a3b8)!important;}
    .rcg-table th{
      background:var(--rcg-head-bg)!important;
      color:var(--green,#34d399)!important;
      border-bottom-color:var(--rcg-border-strong)!important;
    }
    .rcg-table td{
      background:transparent!important;
      border-bottom-color:var(--rcg-border)!important;
    }
    .rcg-table tr:nth-child(even) td{background:var(--rcg-row-bg)!important;}
    .rcg-table td:first-child{color:var(--text,#f0f4f8)!important;}
    .rcg-foot{
      background:linear-gradient(180deg,rgba(0,0,0,0),var(--rcg-softer))!important;
      border-top-color:var(--rcg-border)!important;
    }
    .rcg-note{color:var(--text2)!important;}
    .rcg-calc-toggle{background:rgba(16,185,129,.085)!important;border-color:rgba(16,185,129,.28)!important;}
    @media(max-width:980px){
      .rcg-panel{width:calc(100vw - 18px);max-height:calc(100dvh - 18px);border-radius:22px;}
      .rcg-head{padding:17px 16px 10px;}
      .rcg-tabs,.rcg-search-wrap{padding-left:16px;padding-right:16px;}
      .rcg-body{padding-left:16px;padding-right:16px;}
      .rcg-foot{padding-left:16px;padding-right:16px;}
    }
    @media(max-width:680px){
      .rcg-overlay{align-items:stretch;justify-content:stretch;}
      .rcg-panel{width:100vw;height:100dvh;max-height:100dvh;border-radius:0;border-left:0;border-right:0;}
      .rcg-title{font-size:clamp(1.8rem,10vw,2.35rem);}
      .rcg-tabs{gap:7px;overflow:auto;flex-wrap:nowrap;padding-bottom:10px;}
      .rcg-tab{white-space:nowrap;flex:0 0 auto;}
      .rcg-table{min-width:0!important;width:100%!important;font-size:.74rem;}
      .rcg-table-wrap{overflow-x:auto;}
      .rcg-section{padding:10px;}
    }
  `;
  document.head.appendChild(style);
}

function tabLabel(tab) {
  return tab === 'lab' ? 'Laboratorio' : tab === 'scores' ? 'Scores' : tab === 'formulas' ? 'Fórmulas' : 'Criterios diagnósticos';
}

function renderGuide() {
  const body = document.getElementById('resiarClinicalGuideBody');
  if (!body) return;

  if (activeItemId) {
    const item = GUIDE_ITEMS.find((x) => x.id === activeItemId);
    if (!item) { activeItemId = ''; renderGuide(); return; }
    renderDetail(body, item);
    return;
  }

  const items = visibleItems();
  if (!items.length) {
    body.innerHTML = `<div class="rcg-empty">No hay resultados para “${escapeHtml(lastQuery)}”.</div>`;
    return;
  }

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  body.innerHTML = Object.entries(grouped).map(([category, rows]) => `
    <section class="rcg-category">
      <div class="rcg-category-title">${escapeHtml(category)}</div>
      <div class="rcg-grid">
        ${rows.map((item) => `
          <article class="rcg-card" data-rcg-id="${escapeHtml(item.id)}">
            <div class="rcg-name">${escapeHtml(item.title)}</div>
            <div class="rcg-use">${escapeHtml(item.use)}</div>
            <span class="rcg-type">${escapeHtml(tabLabel(item.tab))}</span>
          </article>`).join('')}
      </div>
    </section>`).join('');

  document.querySelectorAll('[data-rcg-id]').forEach((el) => {
    el.addEventListener('click', () => {
      activeItemId = el.dataset.rcgId || '';
      renderGuide();
    });
  });
}

function renderDetail(body, item) {
  body.innerHTML = `
    <div class="rcg-detail">
      <button class="rcg-back" id="rcgBack">← Volver</button>
      <div class="rcg-category-title" style="position:static;padding:0 0 8px;">${escapeHtml(item.category)}</div>
      <div class="rcg-name" style="font-size:1.15rem;">${escapeHtml(item.title)}</div>
      <div class="rcg-use">${escapeHtml(item.use)}</div>
      ${(item.sections || []).map(renderSection).join('')}
      ${item.calculator ? `<button type="button" class="rcg-calc-toggle" id="rcgCalcToggle">Usar como calculadora</button><div class="rcg-calc-panel" id="rcgCalcPanel">${renderCalculator(item.calculator)}</div>` : ''}
    </div>`;

  document.getElementById('rcgBack')?.addEventListener('click', () => {
    activeItemId = '';
    renderGuide();
  });

  document.getElementById('rcgCalcToggle')?.addEventListener('click', () => {
    const panel = document.getElementById('rcgCalcPanel');
    const btn = document.getElementById('rcgCalcToggle');
    const visible = panel?.classList.toggle('vis');
    if (btn) btn.textContent = visible ? 'Ocultar calculadora' : 'Usar como calculadora';
  });

  bindCalculator(item.calculator);
}

function renderSection(section) {
  if (section.type === 'note') {
    return `<section class="rcg-section"><div class="rcg-section-title">${escapeHtml(section.title)}</div><div class="rcg-note">${escapeHtml(section.text)}</div></section>`;
  }

  return `<section class="rcg-section">
    <div class="rcg-section-title">${escapeHtml(section.title)}</div>
    <div class="rcg-table-wrap">
      <table class="rcg-table">
        <thead><tr>${section.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>${section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  </section>`;
}

function renderCalculator(calc) {
  if (!calc) return '';

  if (calc.type === 'points') {
    return `<div class="rcg-calc" data-calc-type="points">
      ${calc.items.map(([label, points], idx) => `<label class="rcg-option"><input type="checkbox" data-points="${points}" data-idx="${idx}"><span class="rcg-option-text">${escapeHtml(label)}</span><span>${points > 0 ? '+' : ''}${points} p</span></label>`).join('')}
    </div><div class="rcg-result" id="rcgResult"></div>`;
  }

  if (calc.type === 'select') {
    return `<div class="rcg-calc" data-calc-type="select">
      ${calc.selects.map(([label, options], idx) => `<label class="rcg-option" style="grid-template-columns:1fr;"><span class="rcg-option-text">${escapeHtml(label)}</span><select data-select="${idx}">${options.map(([opt, points]) => `<option value="${points}">${escapeHtml(opt)} · ${points} p</option>`).join('')}</select></label>`).join('')}
    </div><div class="rcg-result" id="rcgResult"></div>`;
  }

  if (calc.type === 'checklist') {
    return `<div class="rcg-calc" data-calc-type="checklist">
      ${calc.items.map((label, idx) => `<label class="rcg-option"><input type="checkbox" data-check="${idx}"><span class="rcg-option-text">${escapeHtml(label)}</span><span>variable</span></label>`).join('')}
    </div><div class="rcg-result" id="rcgResult"></div>`;
  }

  if (calc.type === 'formula') return renderFormula(calc.formula);

  return '';
}

function renderFormula(formula) {
  const f = (key, label, unit='', type='number', extra='') => {
    if (type === 'select') return `<label class="rcg-field">${escapeHtml(label)}<select data-field="${key}">${extra}</select></label>`;
    return `<label class="rcg-field">${escapeHtml(label)}${unit ? ` (${escapeHtml(unit)})` : ''}<input type="number" step="any" data-field="${key}"></label>`;
  };

  const wrap = (inner) => `<div class="rcg-field-grid" data-calc-type="formula" data-formula="${formula}">${inner}</div><div class="rcg-result" id="rcgResult"></div>`;

  if (formula === 'gold') return wrap(
    f('fev1','VEF₁ post-BD','','select','<option value="GOLD 1">GOLD 1 ≥80%</option><option value="GOLD 2">GOLD 2 50-79%</option><option value="GOLD 3">GOLD 3 30-49%</option><option value="GOLD 4">GOLD 4 <30%</option>') +
    f('symptoms','Síntomas','','select','<option value="low">mMRC 0-1 o CAT <10</option><option value="high">mMRC ≥2 o CAT ≥10</option>') +
    f('exac','Exacerbaciones','','select','<option value="low">0-1 sin internación</option><option value="high">≥2 o ≥1 con internación</option>')
  );
  if (formula === 'kdigo') return wrap(
    f('g','TFG / G','','select','<option value="G1">G1 ≥90</option><option value="G2">G2 60-89</option><option value="G3a">G3a 45-59</option><option value="G3b">G3b 30-44</option><option value="G4">G4 15-29</option><option value="G5">G5 <15</option>') +
    f('a','Albuminuria / A','','select','<option value="A1">A1 <30</option><option value="A2">A2 30-300</option><option value="A3">A3 >300</option>')
  );
  if (formula === 'meld') return wrap(f('bili','Bilirrubina','mg/dL')+f('inr','INR')+f('creat','Creatinina','mg/dL'));
  if (formula === 'cockcroft') return wrap(f('age','Edad','años')+f('weight','Peso','kg')+f('creat','Creatinina','mg/dL')+f('sex','Sexo','','select','<option value="m">Hombre</option><option value="f">Mujer</option>'));
  if (formula === 'rts') return wrap(
    f('gcs','GCS codificado','','select','<option value="4">13-15</option><option value="3">9-12</option><option value="2">6-8</option><option value="1">4-5</option><option value="0">3</option>')+
    f('pas','PAS codificada','','select','<option value="4">>89</option><option value="3">76-89</option><option value="2">50-75</option><option value="1">1-49</option><option value="0">0</option>')+
    f('fr','FR codificada','','select','<option value="4">10-29</option><option value="3">>29</option><option value="2">6-9</option><option value="1">1-5</option><option value="0">0</option>')
  );
  if (formula === 'iss') return wrap(f('ais1','AIS 1')+f('ais2','AIS 2')+f('ais3','AIS 3'));
  if (formula === 'triss') return wrap(f('rts','RTS')+f('iss','ISS')+f('age55','Edad ≥55','','select','<option value="0">No</option><option value="1">Sí</option>')+f('mech','Mecanismo','','select','<option value="blunt">Romo</option><option value="penetrating">Penetrante</option>'));
  if (formula === 'anion') return wrap(f('na','Na','mEq/L')+f('cl','Cl','mEq/L')+f('hco3','HCO₃','mEq/L')+f('alb','Albúmina opcional','g/dL'));
  if (formula === 'sodium') return wrap(f('na','Na medido','mEq/L')+f('gluc','Glucosa','mg/dL')+f('factor','Factor','','select','<option value="1.6">1,6</option><option value="2.4">2,4</option>'));
  if (formula === 'calcium') return wrap(f('ca','Calcio medido','mg/dL')+f('alb','Albúmina','g/dL'));
  if (formula === 'osm') return wrap(f('na','Na','mEq/L')+f('gluc','Glucosa','mg/dL')+f('bun','BUN opcional','mg/dL')+f('measured','Osm medida opcional','mOsm/kg'));
  if (formula === 'water') return wrap(f('weight','Peso','kg')+f('na','Na actual','mEq/L')+f('target','Na deseado','mEq/L')+f('tbw','Factor ACT'));
  if (formula === 'fena') return wrap(f('una','Na urinario')+f('pna','Na plasmático')+f('ucr','Creatinina urinaria')+f('pcr','Creatinina plasmática'));
  if (formula === 'feurea') return wrap(f('uurea','Urea urinaria')+f('purea','Urea plasmática')+f('ucr','Creatinina urinaria')+f('pcr','Creatinina plasmática'));
  return '';
}

function getFields() {
  const root = document.querySelector('[data-calc-type="formula"]');
  const values = {};
  root?.querySelectorAll('[data-field]').forEach((el) => {
    values[el.dataset.field] = el.tagName === 'SELECT' ? el.value : Number(el.value);
  });
  return values;
}

function showResult(label, text='') {
  const el = document.getElementById('rcgResult');
  if (!el) return;
  el.innerHTML = `<div class="rcg-result-points">${escapeHtml(label)}</div>${text ? `<div class="rcg-result-text">${escapeHtml(text)}</div>` : ''}`;
}

function rangeText(ranges, total) {
  const match = (ranges || []).find(([min, max]) => total >= min && total <= max);
  return match ? match[2] : 'Interpretar según tabla.';
}

function bindCalculator(calc) {
  if (!calc) return;

  const update = () => {
    if (calc.type === 'points') {
      let total = 0;
      document.querySelectorAll('[data-points]').forEach((el) => { if (el.checked) total += Number(el.dataset.points || 0); });
      showResult(`${Number.isInteger(total) ? total : total.toFixed(1)} puntos`, rangeText(calc.ranges, total));
      return;
    }
    if (calc.type === 'select') {
      let total = 0;
      document.querySelectorAll('[data-select]').forEach((el) => { total += Number(el.value || 0); });
      showResult(`${Number.isInteger(total) ? total : total.toFixed(1)} puntos`, rangeText(calc.ranges, total));
      return;
    }
    if (calc.type === 'checklist') {
      const total = document.querySelectorAll('[data-check]').length;
      const checked = document.querySelectorAll('[data-check]:checked').length;
      showResult(`${checked}/${total}`, checked === total ? 'Completo.' : `Faltan ${total - checked}.`);
      return;
    }
    if (calc.type === 'formula') {
      const v = getFields();
      const f = calc.formula;
      if (f === 'gold') {
        const group = v.exac === 'high' ? 'E' : (v.symptoms === 'high' ? 'B' : 'A');
        showResult(`${v.fev1} · Grupo ${group}`);
      } else if (f === 'kdigo') {
        const matrix = {G1:{A1:'bajo',A2:'moderado',A3:'alto'},G2:{A1:'bajo',A2:'moderado',A3:'alto'},G3a:{A1:'moderado',A2:'alto',A3:'muy alto'},G3b:{A1:'alto',A2:'muy alto',A3:'muy alto'},G4:{A1:'muy alto',A2:'muy alto',A3:'muy alto'},G5:{A1:'muy alto',A2:'muy alto',A3:'muy alto'}};
        showResult(`${v.g} · ${v.a}`, `Riesgo ${matrix[v.g]?.[v.a] || '—'}.`);
      } else if (f === 'meld') {
        const bili = Math.max(n(v.bili)||1,1), inr = Math.max(n(v.inr)||1,1), creat = Math.min(Math.max(n(v.creat)||1,1),4);
        const meld = Math.max(6, Math.round(3.78*Math.log(bili)+11.2*Math.log(inr)+9.57*Math.log(creat)+6.43));
        showResult(`${meld} puntos`);
      } else if (f === 'cockcroft') {
        if (!n(v.age)||!n(v.weight)||!n(v.creat)) { showResult('—','Completá edad, peso y creatinina.'); return; }
        let crcl = ((140-n(v.age))*n(v.weight))/(72*n(v.creat)); if (v.sex === 'f') crcl *= 0.85;
        showResult(`${Math.round(crcl)} mL/min`);
      } else if (f === 'rts') {
        const rts = 0.9368*n(v.gcs)+0.7326*n(v.pas)+0.2908*n(v.fr);
        showResult(rts.toFixed(2));
      } else if (f === 'iss') {
        const a=n(v.ais1), b=n(v.ais2), c=n(v.ais3);
        showResult([a,b,c].some(x=>x===6) ? '75 puntos' : `${a*a+b*b+c*c} puntos`);
      } else if (f === 'triss') {
        const coeff = v.mech === 'penetrating' ? [-2.5355,0.9934,-0.0651,-1.1360] : [-0.4499,0.8085,-0.0835,-1.7430];
        const b = coeff[0]+coeff[1]*n(v.rts)+coeff[2]*n(v.iss)+coeff[3]*n(v.age55);
        const ps = 1/(1+Math.exp(-b));
        showResult(`${Math.round(ps*100)}%`, 'Probabilidad de supervivencia aproximada.');
      } else if (f === 'anion') {
        const ag = n(v.na)-(n(v.cl)+n(v.hco3));
        const corrected = v.alb ? ag + 2.5*(4-n(v.alb)) : null;
        showResult(`${round(ag)} mEq/L`, corrected != null ? `Corregido por albúmina: ${round(corrected)} mEq/L.` : '');
      } else if (f === 'sodium') {
        const corrected = n(v.na)+n(v.factor)*(n(v.gluc)-100)/100;
        showResult(`${round(corrected)} mEq/L`);
      } else if (f === 'calcium') {
        showResult(`${round(n(v.ca)+0.8*(4-n(v.alb)))} mg/dL`);
      } else if (f === 'osm') {
        const calc = 2*n(v.na)+n(v.gluc)/18+n(v.bun)/2.8;
        const eff = 2*n(v.na)+n(v.gluc)/18;
        const gap = v.measured ? n(v.measured)-calc : null;
        showResult(`${round(calc)} mOsm/kg`, `Efectiva: ${round(eff)}${gap != null ? ` · Gap: ${round(gap)}` : ''}`);
      } else if (f === 'water') {
        const target = n(v.target)||140;
        const tbw = n(v.tbw)||0.6;
        showResult(`${round(tbw*n(v.weight)*((n(v.na)/target)-1))} L`);
      } else if (f === 'fena') {
        const val = ((n(v.una)*n(v.pcr))/(n(v.pna)*n(v.ucr)))*100;
        showResult(`${round(val)}%`);
      } else if (f === 'feurea') {
        const val = ((n(v.uurea)*n(v.pcr))/(n(v.purea)*n(v.ucr)))*100;
        showResult(`${round(val)}%`);
      }
    }
  };

  document.querySelectorAll('#rcgCalcPanel input,#rcgCalcPanel select').forEach((el) => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
  update();
}

function buildModal() {
  if (modalBuilt) return;
  modalBuilt = true;

  const overlay = document.createElement('div');
  overlay.id = 'resiarClinicalGuideOverlay';
  overlay.className = 'rcg-overlay';
  overlay.innerHTML = `
    <div class="rcg-panel" role="dialog" aria-modal="true">
      <div class="rcg-head">
        <div><div class="rcg-kicker">Consulta durante examen</div><div class="rcg-title">Guía clínica</div></div>
        <button id="rcgClose" class="rcg-close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="rcg-tabs">
        <button class="rcg-tab" data-tab="lab">Laboratorio</button>
        <button class="rcg-tab" data-tab="scores">Scores</button>
        <button class="rcg-tab" data-tab="formulas">Fórmulas</button>
        <button class="rcg-tab" data-tab="criteria">Criterios diagnósticos</button>
      </div>
      <div class="rcg-search-wrap"><input id="rcgSearch" class="rcg-search" type="search" placeholder="Buscar: hemoglobina, sodio, Ranson, qSOFA, anion gap, Duke..." /></div>
      <div id="resiarClinicalGuideBody" class="rcg-body"></div>
      <div class="rcg-foot">Laboratorio recuperado de versiones previas + scores/fórmulas/criterios limitados a la información aportada por el usuario. Calculadoras solo en Scores y Fórmulas.</div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeClinicalGuide(); });
  document.getElementById('rcgClose')?.addEventListener('click', closeClinicalGuide);
  document.getElementById('rcgSearch')?.addEventListener('input', (e) => {
    lastQuery = e.target?.value || '';
    activeItemId = '';
    renderGuide();
  });
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab || 'scores';
      activeItemId = '';
      renderTabs();
      renderGuide();
    });
  });

  renderTabs();
  renderGuide();
}

function renderTabs() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
}

async function openClinicalGuide() {
  await ensureGuideData();
  ensureStyles();
  buildModal();
  renderTabs();
  renderGuide();
  document.getElementById('resiarClinicalGuideOverlay')?.classList.add('vis');
  const input = document.getElementById('rcgSearch');
  if (input) { input.value = lastQuery; setTimeout(() => input.focus(), 80); }
}

function closeClinicalGuide() {
  document.getElementById('resiarClinicalGuideOverlay')?.classList.remove('vis');
}

function findInsertionPoint() {
  const noteButton = document.getElementById('rpBtnNota');
  if (noteButton) return { mode: 'after', el: noteButton };
  const reportButton = document.getElementById('rpBtnReporte') || document.getElementById('btnReportarPregunta') || Array.from(document.querySelectorAll('button,a')).find((el) => /reportar pregunta/i.test(el.textContent || ''));
  if (reportButton) return { mode: 'before', el: reportButton };
  const rightPanel = document.getElementById('rightPanel') || document.getElementById('examRightPanel') || document.querySelector('.right-panel, .exam-side, .exam-sidebar');
  if (rightPanel) return { mode: 'append', el: rightPanel };
  return null;
}

function ensureButton() {
  let btn = document.getElementById('resiarClinicalGuideButton');
  const target = findInsertionPoint();
  if (!target) { if (btn) btn.remove(); return; }

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'resiarClinicalGuideButton';
    btn.type = 'button';
    btn.className = 'resiar-clinical-guide-btn';
    btn.textContent = '🧭 Guía clínica';
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openClinicalGuide(); });
  }

  if (!btn.isConnected) {
    if (target.mode === 'after') target.el.insertAdjacentElement('afterend', btn);
    else if (target.mode === 'before') target.el.insertAdjacentElement('beforebegin', btn);
    else target.el.appendChild(btn);
  }
}

function installShortcut() {
  document.addEventListener('keydown', (e) => {
    const tag = String(e.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if (e.key === 'Escape') { closeClinicalGuide(); return; }
    if (typing) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && String(e.key || '').toLowerCase() === 'g') {
      e.preventDefault();
      openClinicalGuide();
    }
  });
}

export function installClinicalGuide() {
  if (installed) return;
  installed = true;

  ensureStyles();
  installShortcut();

  const observer = new MutationObserver(() => { try { ensureButton(); } catch (_) {} });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { try { ensureButton(); } catch (_) {} }, 1500);

  try {
    window.resiarOpenClinicalGuide = openClinicalGuide;
  } catch (_) {}

  setTimeout(ensureButton, 100);
  setTimeout(ensureButton, 700);
  setTimeout(ensureButton, 1600);
}

export default installClinicalGuide;
