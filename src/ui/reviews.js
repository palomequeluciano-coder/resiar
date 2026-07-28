function defaultEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function installReviews(options = {}) {
  if (window.__resiarReviewsInstalled) return;
  window.__resiarReviewsInstalled = true;

  const getSupabase = typeof options.getSupabase === 'function' ? options.getSupabase : () => window.sb;
  const escHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : defaultEscapeHtml;

  let selectedStars = 0;
  const stars = document.querySelectorAll('#starSelector span');

  function paintStars(n) {
    stars.forEach(function paintStar(star, i) {
      star.style.opacity = i < n ? '1' : '0.3';
      star.style.color = i < n ? 'var(--amber)' : '';
    });
  }

  stars.forEach(function bindStar(star) {
    star.addEventListener('mouseenter', function onMouseEnter() {
      paintStars(+star.dataset.v || 0);
    });

    star.addEventListener('mouseleave', function onMouseLeave() {
      paintStars(selectedStars);
    });

    star.addEventListener('click', function onClick() {
      selectedStars = +star.dataset.v || 0;
      paintStars(selectedStars);
    });
  });

  const textArea = document.getElementById('reviewText');
  const charCount = document.getElementById('reviewCharCount');

  if (textArea && charCount) {
    textArea.addEventListener('input', function onReviewTextInput() {
      charCount.textContent = textArea.value.length + ' / 400';
    });
  }

  let carouselReviews = [];
  let carouselIdx = 0;
  let carouselTimer = null;

  function renderCarousel() {
    if (!carouselReviews.length) return;

    const inner = document.getElementById('reviewCarouselInner');
    const dots = document.getElementById('reviewDots');
    if (!inner || !dots) return;

    const review = carouselReviews[carouselIdx];

    inner.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px 28px;max-width:560px;margin:0 auto;transition:opacity .3s;">' +
      '<div style="color:var(--amber);font-size:1.1rem;margin-bottom:8px;">★★★★★</div>' +
      '<div style="font-size:0.95rem;color:var(--text);line-height:1.6;margin-bottom:14px;">"' + escHtml(review.text) + '"</div>' +
      '<div style="font-size:0.82rem;color:var(--text3);">— ' + escHtml(review.name) + '</div>' +
    '</div>';

    dots.innerHTML = carouselReviews.map(function renderDot(_, i) {
      return '<span style="width:7px;height:7px;border-radius:50%;background:' + (i === carouselIdx ? 'var(--accent)' : 'var(--border)') + ';display:inline-block;cursor:pointer;transition:background .2s;" data-action="review-go-index" data-index="' + i + '"></span>';
    }).join('');

    clearInterval(carouselTimer);
    carouselTimer = setInterval(function advanceCarousel() {
      carouselIdx = (carouselIdx + 1) % carouselReviews.length;
      renderCarousel();
    }, 5000);
  }

  async function submitReview() {
    const supabase = getSupabase();
    const btn = document.getElementById('reviewSubmitBtn');
    const msg = document.getElementById('reviewMsg');
    const nameInput = document.getElementById('reviewName');
    const name = (nameInput?.value || '').trim();
    const text = (textArea?.value || '').trim();

    if (!msg) return;

    if (!selectedStars) {
      msg.style.color = 'var(--amber)';
      msg.textContent = 'Por favor seleccioná una calificación.';
      return;
    }

    if (text.length < 10) {
      msg.style.color = 'var(--amber)';
      msg.textContent = 'El comentario debe tener al menos 10 caracteres.';
      return;
    }

    if (!supabase || !supabase.from) {
      msg.style.color = '#f87171';
      msg.textContent = 'No se pudo conectar con el servicio. Intentá de nuevo.';
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }

    msg.style.color = 'var(--text2)';
    msg.textContent = 'Enviando...';

    try {
      const payload = {
        stars: selectedStars,
        name: name || 'Anónimo',
        text,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('reviews').insert([payload]);
      if (error) throw error;

      msg.style.color = 'var(--green)';
      msg.textContent = '¡Gracias por tu opinión! 🙌';

      if (textArea) textArea.value = '';
      if (nameInput) nameInput.value = '';
      selectedStars = 0;
      paintStars(0);
      if (charCount) charCount.textContent = '0 / 400';
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
      loadReviews();
    } catch (_) {
      msg.style.color = '#f87171';
      msg.textContent = 'Ocurrió un error. Intentá de nuevo.';
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }

  async function loadReviews() {
    const supabase = getSupabase();
    if (!supabase || !supabase.from) return;

    try {
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('stars', 5)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data || !data.length) return;
      carouselReviews = data;
      renderCarousel();
      const carousel = document.getElementById('reviewCarousel');
      if (carousel) carousel.style.display = 'block';
    } catch (_) {}
  }

  function goReview(index) {
    const nextIndex = Number(index);
    if (!Number.isFinite(nextIndex) || nextIndex < 0 || nextIndex >= carouselReviews.length) return;
    carouselIdx = nextIndex;
    renderCarousel();
  }

  window.submitReview = submitReview;
  window.loadReviews = loadReviews;
  window.goReview = goReview;

  setTimeout(function loadInitialReviews() {
    if (document.getElementById('welcome')) loadReviews();
  }, 1000);
}
