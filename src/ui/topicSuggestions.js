/*
 * ResiAR — sugerencias de temas del buscador nativo.
 *
 * Mantiene compatibilidad con el monolito mediante window._todosLosTemas
 * y window.resiarTopicQuestionCount, pero concentra la lógica de render,
 * filtrado y eventos en un único módulo.
 */
export function configureTopicSuggestions(options = {}) {
  const {
    getQuestions = () => [],
    inputEl = null,
    suggestionsEl = null,
    escapeHtml = value => String(value ?? ''),
    normalizeSearchText = value => String(value ?? '').toLowerCase(),
    temaRaw = item => item?.tema || '',
    debounce = fn => fn
  } = options;

  let allTopics = [];
  let installed = false;

  function syncGlobals() {
    try { window._todosLosTemas = allTopics; } catch (_) {}
  }

  function getAllTopics() {
    return allTopics.slice();
  }

  function setAllTopics(topics) {
    allTopics = Array.isArray(topics) ? topics.slice() : [];
    syncGlobals();
    return getAllTopics();
  }

  function clearTopics() {
    allTopics = [];
    syncGlobals();
  }

  function resiarTopicQuestionCount(topic) {
    const key = normalizeSearchText(topic);
    if (!key) return 0;

    try {
      const list = Array.isArray(getQuestions()) ? getQuestions() : [];
      return list.reduce((acc, p) => acc + (normalizeSearchText(temaRaw(p)) === key ? 1 : 0), 0);
    } catch (_) {
      return 0;
    }
  }

  function renderSugs(lista) {
    if (!suggestionsEl || !inputEl) return;

    suggestionsEl.innerHTML = '';
    if (!lista || !lista.length) return;

    const fragment = document.createDocumentFragment();

    lista.forEach(topic => {
      const item = document.createElement('div');
      item.className = 'sugerencia-item';

      const count = resiarTopicQuestionCount(topic);
      item.innerHTML = `<span class="sugerencia-label">${escapeHtml(topic)}</span>${count ? `<span class="sugerencia-count">${count}</span>` : ''}`;

      item.addEventListener('mousedown', event => {
        event.preventDefault();
      });

      item.addEventListener('click', () => {
        inputEl.value = topic;
        suggestionsEl.innerHTML = '';
      });

      fragment.appendChild(item);
    });

    suggestionsEl.appendChild(fragment);
  }

  function clearIfClickOutside(event) {
    if (!suggestionsEl) return;
    if (!event.target.closest('#buscadorTema') && !event.target.closest('#sugerenciasTemas')) {
      suggestionsEl.innerHTML = '';
    }
  }

  function handleInput() {
    if (!suggestionsEl || !inputEl) return;

    const text = normalizeSearchText(inputEl.value);

    if (!text) {
      renderSugs(allTopics);
      return;
    }

    const matches = allTopics.filter(topic => normalizeSearchText(topic).includes(text));

    if (!matches.length) {
      suggestionsEl.innerHTML = '<div class="sugerencia-item" style="cursor:default;opacity:0.4;">Sin resultados</div>';
      return;
    }

    renderSugs(matches);
  }

  function showAllIfAvailable() {
    if (!allTopics.length) return;
    renderSugs(allTopics);
  }

  function install() {
    if (installed) return;
    installed = true;

    syncGlobals();

    try {
      window.resiarTopicQuestionCount = resiarTopicQuestionCount;
    } catch (_) {}

    if (!inputEl || !suggestionsEl) return;

    document.addEventListener('click', clearIfClickOutside);
    inputEl.addEventListener('input', debounce(handleInput, 80));
    inputEl.addEventListener('focus', showAllIfAvailable);
    inputEl.addEventListener('click', () => {
      if (!suggestionsEl.innerHTML && allTopics.length) showAllIfAvailable();
    });
  }

  return {
    install,
    renderSugs,
    setAllTopics,
    clearTopics,
    getAllTopics,
    resiarTopicQuestionCount
  };
}
