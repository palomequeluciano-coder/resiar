export function installResiarPublicLanding(options = {}) {
  if (window.__resiarPublicCarouselInstalled) return;
  window.__resiarPublicCarouselInstalled = true;

  const callbacks = {
    getCurrentUser: typeof options.getCurrentUser === 'function' ? options.getCurrentUser : () => null,
    markViewState: typeof options.markViewState === 'function' ? options.markViewState : () => {},
    forcePublicLandingStateFallback: typeof options.forcePublicLandingStateFallback === 'function' ? options.forcePublicLandingStateFallback : () => {},
    applyPricesDom: typeof options.applyPricesDom === 'function' ? options.applyPricesDom : () => {},
    loadPrices: typeof options.loadPrices === 'function' ? options.loadPrices : () => {},
    loadReviews: typeof options.loadReviews === 'function' ? options.loadReviews : () => {},
    hideStreakToast: typeof options.hideStreakToast === 'function' ? options.hideStreakToast : () => {},
    setWhatsAppVisible: typeof options.setWhatsAppVisible === 'function' ? options.setWhatsAppVisible : () => {}
  };

  const EXAMS_RESIAR = [
    { name: 'Córdoba',                    date: '2026-03-28' },
    { name: 'Río Negro',                  date: '2026-04-21' },
    { name: 'Salta',                      date: '2026-04-25' },
    { name: 'Corrientes / UNNE',          date: '2026-04-28' },
    { name: 'Neuquén',                    date: '2026-05-04' },
    { name: 'San Juan',                   date: '2026-05-28' },
    { name: 'CABA',                       date: '2026-06-10' },
    { name: 'Misiones',                   date: '2026-06-16' },
    { name: 'Santa Fe — Básicas',         date: '2026-06-17' },
    { name: 'Santa Fe — Posbásicas',      date: '2026-06-19' },
    { name: 'Nación — Equipo salud / PB', date: '2026-06-30' },
    { name: 'Jujuy',                      date: '2026-07-01' },
    { name: 'Mendoza',                    date: '2026-07-01' },
    { name: 'Entre Ríos',                 date: '2026-07-07' },
    { name: 'Nación — Medicina',          date: '2026-07-07' },
    { name: 'Provincia de Buenos Aires',  date: null }
  ];

  function daysUntil(dateStr){
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0,0,0,0);
    const exam = new Date(dateStr + 'T00:00:00');
    return Math.round((exam - now) / 86400000);
  }
  function urgency(days){
    if (days === null) return 'far';
    if (days < 0) return 'done';
    if (days <= 14) return 'hot';
    if (days <= 30) return 'near';
    if (days <= 60) return 'soon';
    return 'far';
  }
  function countdownLabel(days){
    if (days === null) return { num:'?', lbl:'por confirmar' };
    if (days < 0) return { num:'✓', lbl:'ya pasó' };
    if (days === 0) return { num:'¡HOY!', lbl:'' };
    if (days === 1) return { num:'1', lbl:'día' };
    return { num:days, lbl:'días' };
  }
  function fmtDate(dateStr){
    if (!dateStr) return 'Fecha por confirmar';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
  }
  function emojiFor(u){ return { done:'✅', hot:'🔥', near:'⚡', soon:'📅', far:'🗓️' }[u] || '📅'; }

  window.resiarInitExamCarousel = function(){
    const track = document.getElementById('examCarouselTrack');
    const dotsEl = document.getElementById('examCarouselDots');
    if (!track || !dotsEl) return;
    clearInterval(window.__resiarExamCarouselTimer);
    track.innerHTML = '';
    dotsEl.innerHTML = '';
    track.style.minHeight = '90px';

    const upcoming = EXAMS_RESIAR.map(e => ({...e, days:daysUntil(e.date)})).filter(e => e.days === null || e.days > 0);
    if (!upcoming.length) return;
    let current = 0;
    const cards = [];
    const dots = [];

    upcoming.forEach(function(ex, i){
      const u = urgency(ex.days);
      const lab = countdownLabel(ex.days);
      const card = document.createElement('div');
      card.className = 'exam-card';
      card.innerHTML = '<div class="exam-card-inner urgency-' + u + '">' +
        '<div class="exam-card-emoji">' + emojiFor(u) + '</div>' +
        '<div class="exam-card-info"><div class="exam-card-name">' + ex.name + '</div><div class="exam-card-date">' + fmtDate(ex.date) + '</div></div>' +
        '<div class="exam-card-countdown"><div class="exam-card-days">' + lab.num + '</div>' + (lab.lbl ? '<div class="exam-card-days-lbl">' + lab.lbl + '</div>' : '') + '</div>' +
      '</div>';
      track.appendChild(card); cards.push(card);
      const dot = document.createElement('button');
      dot.className = 'exam-dot';
      dot.setAttribute('aria-label', ex.name);
      dot.addEventListener('click', function(){ goTo(i); });
      dotsEl.appendChild(dot); dots.push(dot);
    });

    function update(){
      const total = cards.length;
      cards.forEach(c => c.classList.remove('active','peek-prev','peek-next'));
      dots.forEach(d => d.classList.remove('active'));
      cards[current]?.classList.add('active');
      dots[current]?.classList.add('active');
      if (total > 1) {
        cards[(current - 1 + total) % total]?.classList.add('peek-prev');
        cards[(current + 1) % total]?.classList.add('peek-next');
      }
    }
    function goTo(i){ current = (i + cards.length) % cards.length; update(); reset(); }
    function next(){ goTo(current + 1); }
    function prev(){ goTo(current - 1); }
    function reset(){ clearInterval(window.__resiarExamCarouselTimer); window.__resiarExamCarouselTimer = setInterval(next, 4500); }
    window.examCarouselNext = next;
    window.examCarouselPrev = prev;
    const prevBtn = document.getElementById('examPrev');
    const nextBtn = document.getElementById('examNext');
    if (prevBtn) prevBtn.onclick = function(e){ e.preventDefault(); prev(); };
    if (nextBtn) nextBtn.onclick = function(e){ e.preventDefault(); next(); };
    track.onmouseenter = function(){ clearInterval(window.__resiarExamCarouselTimer); };
    track.onmouseleave = reset;
    update(); reset();
  };

  window.resiarInitHeroMockupAnimation = function(){
    const mockup = document.querySelector('.lp-mockup--animated');
    if (!mockup) return;
    const cursor = mockup.querySelector('.lp-mockup-cursor');
    const optB = mockup.querySelector('.lp-mockup-opt[data-opt="b"]');
    if (!cursor || !optB) return;
    if (typeof window.__resiarMockupClear === 'function') window.__resiarMockupClear();
    let timeouts = [];
    function later(fn, ms){ const id = setTimeout(fn, ms); timeouts.push(id); }
    function clearAll(){ timeouts.forEach(clearTimeout); timeouts = []; }
    window.__resiarMockupClear = clearAll;
    function targetPos(){
      const mr = mockup.getBoundingClientRect();
      const or = optB.getBoundingClientRect();
      return { x: or.left - mr.left + or.width * 0.25, y: or.top - mr.top + or.height * 0.5 };
    }
    function run(){
      clearAll();
      mockup.classList.remove('is-running','is-revealed');
      optB.classList.remove('is-selected','is-pressed','do-ripple');
      cursor.classList.remove('cursor-visible','cursor-click');
      const rect = mockup.getBoundingClientRect();
      cursor.style.transition = 'none';
      cursor.style.left = Math.max(20, rect.width - 30) + 'px';
      cursor.style.top = Math.max(20, rect.height - 30) + 'px';
      void cursor.offsetWidth;
      later(() => cursor.classList.add('cursor-visible'), 120);
      later(() => {
        const pos = targetPos();
        cursor.style.transition = 'left 1.1s cubic-bezier(.4,0,.2,1), top 1.1s cubic-bezier(.4,0,.2,1), opacity .3s, transform .2s';
        cursor.style.left = pos.x + 'px';
        cursor.style.top = pos.y + 'px';
      }, 430);
      later(() => { cursor.classList.add('cursor-click'); optB.classList.add('is-pressed','do-ripple'); }, 1630);
      later(() => { cursor.classList.remove('cursor-click'); optB.classList.remove('is-pressed'); optB.classList.add('is-selected'); }, 1830);
      later(() => mockup.classList.add('is-revealed'), 2430);
      later(() => { cursor.style.transition = 'left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1), opacity .5s, transform .2s'; cursor.classList.remove('cursor-visible'); }, 3230);
      later(run, 10000);
    }
    mockup.addEventListener('mouseenter', clearAll, { passive:true });
    mockup.addEventListener('mouseleave', () => setTimeout(run, 800), { passive:true });
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      optB.classList.add('is-selected'); mockup.classList.add('is-revealed');
      return;
    }
    setTimeout(run, 500);
  };

  window.resiarRestorePricingBadges = function(){
    try { if (window._precios) callbacks.applyPricesDom(); } catch(_) {}
    try { callbacks.loadPrices(); } catch(_) {}
    setTimeout(function(){
      const popular = document.querySelector('.lp-plan-popular');
      const trim = document.getElementById('lpPopularTrimestral');
      [popular, trim].forEach(function(el){
        if (!el) return;
        if (!el.innerHTML.trim()) {
          el.innerHTML = '<span style="font-size:.72rem;letter-spacing:0">🚀</span><span style="display:flex;flex-direction:column;align-items:center;gap:1px;"><span>Precio de lanzamiento</span><span style="font-size:.52rem;font-weight:600;opacity:.9;letter-spacing:.03em;text-transform:none;">Cupos disponibles por tramo</span></span>';
        }
        el.style.display = 'flex';
      });
    }, 600);
  };

  window.resiarInitPublicLandingRestored = function(){
    try { callbacks.markViewState('landing'); } catch(_) { callbacks.forcePublicLandingStateFallback(); }
    try { window.resiarInitExamCarousel(); } catch(e) { console.warn('carousel restore', e); }
    try { window.resiarInitHeroMockupAnimation(); } catch(e) { console.warn('mockup restore', e); }
    try { window.resiarRestorePricingBadges(); } catch(e) { console.warn('pricing restore', e); }
    try { callbacks.loadReviews(); } catch(_) {}
    try { callbacks.hideStreakToast(); } catch(_) {}
    try { callbacks.setWhatsAppVisible(true); } catch(_) {}
  };

  function patchPublicCarouselLayout(){
    try {
      var section = document.getElementById('examCountdownSection');
      if (!section) return;
      section.style.marginLeft = 'auto';
      section.style.marginRight = 'auto';
      section.style.maxWidth = '1100px';
      var track = document.getElementById('examCarouselTrack');
      if (track) {
        track.style.marginLeft = 'auto';
        track.style.marginRight = 'auto';
      }
      if (typeof window.resiarInitExamCarousel === 'function') {
        setTimeout(function(){ try { window.resiarInitExamCarousel(); } catch(_) {} }, 0);
      }
    } catch(_) {}
  }
  window.resiarPatchPublicCarouselLayout = patchPublicCarouselLayout;
  patchPublicCarouselLayout();

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      const welcome = document.getElementById('welcome');
      if (welcome && !welcome.classList.contains('home-sim') && !callbacks.getCurrentUser()) {
        try { window.resiarInitPublicLandingRestored(); } catch(_) {}
      }
    }, 800);
  });
}
