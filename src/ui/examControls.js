export function configureExamControls(options = {}) {
  let timerPregunta = null;
  let segPregunta = 0;
  let keyboardInstalled = false;

  const getExam = () => {
    try { return Array.isArray(options.getExam?.()) ? options.getExam() : []; }
    catch (_) { return []; }
  };
  const getAnswers = () => {
    try { return Array.isArray(options.getAnswers?.()) ? options.getAnswers() : []; }
    catch (_) { return []; }
  };
  const getCurrentIndex = () => {
    try {
      const idx = Number(options.getCurrentIndex?.());
      return Number.isFinite(idx) ? idx : 0;
    } catch (_) { return 0; }
  };
  const setCurrentIndex = (idx) => {
    try { options.setCurrentIndex?.(idx); } catch (_) {}
  };
  const getMarked = () => {
    try {
      const marked = options.getMarked?.();
      return marked instanceof Set ? marked : new Set();
    } catch (_) { return new Set(); }
  };
  const setMarked = (marked) => {
    try { options.setMarked?.(marked); } catch (_) {}
  };
  const getOnlyMarked = () => {
    try { return !!options.getOnlyMarked?.(); }
    catch (_) { return false; }
  };
  const setOnlyMarked = (value) => {
    try { options.setOnlyMarked?.(!!value); } catch (_) {}
  };
  const getQuestionTimes = () => {
    try {
      const times = options.getQuestionTimes?.();
      return Array.isArray(times) ? times : [];
    } catch (_) { return []; }
  };
  const renderExam = () => {
    try { return options.renderExam?.(); } catch (error) { console.error(error); }
  };
  const stopActiveSounds = () => {
    try { return options.stopActiveSounds?.(); } catch (_) {}
  };
  const getQuestionBox = () => {
    try { return options.getQuestionBox?.() || null; } catch (_) { return null; }
  };
  const isModalOpen = () => {
    try { return !!options.isModalOpen?.(); } catch (_) { return false; }
  };
  const notifyStateChange = (reason) => {
    try { options.onStateChange?.(reason); } catch (_) {}
  };

  function toggleMarcada(idx) {
    const marked = getMarked();
    if (marked.has(idx)) marked.delete(idx);
    else marked.add(idx);
    setMarked(marked);
    actualizarBtnMarcadas();
    renderExam();
    notifyStateChange('marked');
  }

  function actualizarBtnMarcadas() {
    const marked = getMarked();
    const btn = document.getElementById('btnFilterMarked');
    const lbl = document.getElementById('markedCountLabel');
    const desc = document.getElementById('btnFilterMarkedDesc');
    if (!btn) return;

    if (marked.size > 0) {
      btn.style.display = 'flex';
      if (desc) desc.style.display = 'block';
      if (lbl) {
        lbl.textContent = getOnlyMarked()
          ? `Mostrando ${marked.size} marcada${marked.size > 1 ? 's' : ''} · Quitar filtro`
          : `Ver ${marked.size} marcada${marked.size > 1 ? 's' : ''}`;
      }
      btn.classList.toggle('active', getOnlyMarked());
    } else {
      btn.style.display = 'none';
      if (desc) desc.style.display = 'none';
      setOnlyMarked(false);
    }
  }

  function toggleFiltroMarcadas() {
    const nextValue = !getOnlyMarked();
    setOnlyMarked(nextValue);

    if (nextValue) {
      const primera = [...getMarked()].sort((a, b) => a - b)[0];
      if (primera !== undefined) {
        setCurrentIndex(primera);
        renderExam();
      }
    }

    actualizarBtnMarcadas();
    notifyStateChange('marked-filter');
  }

  function iniciarTimerPregunta() {
    clearInterval(timerPregunta);
    const idx = getCurrentIndex();
    const times = getQuestionTimes();
    segPregunta = times[idx] || 0;

    timerPregunta = setInterval(() => {
      const currentIdx = getCurrentIndex();
      const currentTimes = getQuestionTimes();
      segPregunta++;
      currentTimes[currentIdx] = segPregunta;
    }, 1000);
  }

  function pausarTimerPregunta() {
    clearInterval(timerPregunta);
  }

  function initNavDrag() {
    const grid = document.querySelector('.qnav-grid');
    if (!grid || grid._dragInit) return;
    grid._dragInit = true;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let moved = false;

    grid.addEventListener('mousedown', event => {
      isDown = true;
      moved = false;
      startX = event.pageX - grid.offsetLeft;
      scrollLeft = grid.scrollLeft;
      grid.style.cursor = 'grabbing';
      grid.style.userSelect = 'none';
    });

    grid.addEventListener('mouseleave', () => {
      isDown = false;
      grid.style.cursor = '';
    });

    grid.addEventListener('mouseup', () => {
      isDown = false;
      grid.style.cursor = '';
      grid.style.userSelect = '';
    });

    grid.addEventListener('mousemove', event => {
      if (!isDown) return;
      event.preventDefault();
      const x = event.pageX - grid.offsetLeft;
      const walk = (x - startX) * 1.2;
      if (Math.abs(walk) > 4) moved = true;
      grid.scrollLeft = scrollLeft - walk;
    });

    let touchStartX = 0;
    let touchScrollLeft = 0;

    grid.addEventListener('touchstart', event => {
      touchStartX = event.touches[0].pageX;
      touchScrollLeft = grid.scrollLeft;
    }, { passive: true });

    grid.addEventListener('touchmove', event => {
      const dx = touchStartX - event.touches[0].pageX;
      grid.scrollLeft = touchScrollLeft + dx;
    }, { passive: true });

    grid.addEventListener('click', event => {
      if (moved) {
        moved = false;
        event.stopPropagation();
      }
    }, true);

    grid.addEventListener('wheel', event => {
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
        event.preventDefault();
        grid.scrollLeft += event.deltaY * 2.5;
      }
    }, { passive: false });
  }

  function irDesdeNav(idx) {
    const currentIdx = getCurrentIndex();
    if (idx === currentIdx) return;
    stopActiveSounds();
    pausarTimerPregunta();
    setCurrentIndex(idx);
    iniciarTimerPregunta();
    renderExam();
    notifyStateChange('nav');

    const questionBox = getQuestionBox();
    try { questionBox?.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
  }

  function next() {
    const exam = getExam();
    const currentIdx = getCurrentIndex();
    if (currentIdx < exam.length - 1) {
      stopActiveSounds();
      pausarTimerPregunta();
      setCurrentIndex(currentIdx + 1);
      iniciarTimerPregunta();
      renderExam();
      notifyStateChange('next');
    }
  }

  function prev() {
    const currentIdx = getCurrentIndex();
    if (currentIdx > 0) {
      stopActiveSounds();
      pausarTimerPregunta();
      setCurrentIndex(currentIdx - 1);
      iniciarTimerPregunta();
      renderExam();
      notifyStateChange('prev');
    }
  }

  function installKeyboardShortcuts() {
    if (keyboardInstalled) return;
    keyboardInstalled = true;

    document.addEventListener('keydown', event => {
      if (isModalOpen()) return;
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const exam = getExam();
      if (!exam || !exam.length) return;

      const idx = getCurrentIndex();
      const question = exam[idx];
      const answers = getAnswers();
      const alreadyAnswered = !!answers[idx];
      const key = String(event.key || '').toLowerCase();

      if (!alreadyAnswered && ['a', 'b', 'c', 'd', 'e'].includes(key)) {
        if (question?.opciones?.[key]) {
          event.preventDefault();
          options.answerQuestion?.(key);
        }
        return;
      }

      if (event.key === 'ArrowRight' || (alreadyAnswered && event.key === 'Enter')) {
        event.preventDefault();
        next();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
        return;
      }

      if (key === 'b') {
        event.preventDefault();
        toggleMarcada(idx);
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        options.openSearch?.();
      }
    });
  }

  return {
    toggleMarcada,
    actualizarBtnMarcadas,
    toggleFiltroMarcadas,
    iniciarTimerPregunta,
    pausarTimerPregunta,
    initNavDrag,
    irDesdeNav,
    next,
    prev,
    installKeyboardShortcuts
  };
}
