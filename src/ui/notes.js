const NOTES_LEGACY_KEY = 'sim_notas_v1';
const NOTES_PREFIX = 'resiar_notes_v1';

function safeUserKey(user) {
  const raw = user?.id || user?.user_id || user?.email || '';
  return String(raw || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '_');
}

function hasNotes(value) {
  return !!(value && typeof value === 'object' && Object.keys(value).length);
}

function normalizeNotes(value) {
  const out = {};
  const data = value && typeof value === 'object' ? value : {};
  Object.entries(data).forEach(([key, note]) => {
    const cleanKey = String(key || '').trim();
    const cleanNote = String(note || '');
    if (cleanKey && cleanNote.trim()) out[cleanKey] = cleanNote;
  });
  return out;
}

export function notesStorageKey(user) {
  const key = safeUserKey(user);
  return key ? `${NOTES_PREFIX}:${key}` : NOTES_LEGACY_KEY;
}

export function configureNotes(options = {}) {
  const readJson = typeof options.readJson === 'function'
    ? options.readJson
    : function fallbackReadJson(key, fallback = {}) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    };

  const writeJson = typeof options.writeJson === 'function'
    ? options.writeJson
    : function fallbackWriteJson(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    };

  const removeStorage = typeof options.removeStorage === 'function'
    ? options.removeStorage
    : function fallbackRemoveStorage(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    };

  const getExam = typeof options.getExam === 'function' ? options.getExam : () => [];
  const getActual = typeof options.getActual === 'function' ? options.getActual : () => 0;
  const getCurrentUser = typeof options.getCurrentUser === 'function' ? options.getCurrentUser : () => null;

  let notaTimer = null;
  let rightPanelNotaTimer = null;

  function getCurrentNotesKey() {
    return notesStorageKey(getCurrentUser());
  }

  function getNotas() {
    const key = getCurrentNotesKey();
    let notes = normalizeNotes(readJson(key, {}));

    // Migración única desde la clave global histórica. Se elimina luego de
    // migrar para evitar mezclar notas entre usuarios del mismo navegador.
    if (key !== NOTES_LEGACY_KEY && !hasNotes(notes)) {
      const legacy = normalizeNotes(readJson(NOTES_LEGACY_KEY, {}));
      if (hasNotes(legacy)) {
        notes = legacy;
        writeJson(key, notes);
        removeStorage(NOTES_LEGACY_KEY);
      }
    }

    return notes;
  }

  function saveNotas(notas) {
    writeJson(getCurrentNotesKey(), normalizeNotes(notas || {}));
  }

  function updateSingleNoteToggle(key, value) {
    const hint = document.getElementById(`notaHint_${key}`);
    if (hint) {
      hint.classList.add('show');
      setTimeout(() => hint.classList.remove('show'), 1800);
    }

    const btn = document.querySelector('.nota-toggle');
    if (btn) {
      btn.className = `nota-toggle ${String(value || '').trim() ? 'has-nota' : ''}`;
    }
  }

  function toggleNota(key, btn) {
    const area = document.getElementById(`notaArea_${key}`);
    if (!area) return;

    const visible = area.style.display !== 'none';
    area.style.display = visible ? 'none' : 'block';

    if (btn) {
      btn.textContent = visible
        ? (getNotas()[key] ? '📝 Ver mi nota' : '📝 Agregar nota')
        : '📝 Cerrar nota';
    }
  }

  function guardarNota(key, value) {
    clearTimeout(notaTimer);
    notaTimer = setTimeout(() => {
      const notas = getNotas();
      const cleanValue = String(value || '');

      if (cleanValue.trim()) notas[key] = cleanValue;
      else delete notas[key];

      saveNotas(notas);
      updateSingleNoteToggle(key, cleanValue);
    }, 600);
  }

  function getCurrentQuestion() {
    const exam = getExam();
    const actual = getActual();
    return Array.isArray(exam) ? exam[actual] : null;
  }

  function getCurrentNoteKey() {
    const question = getCurrentQuestion();
    if (!question) return null;
    const actual = getActual();
    return `q_${question.id ?? actual}`;
  }

  function toggleNotaDesdePanel() {
    const noteKey = getCurrentNoteKey();
    if (!noteKey) return;

    const editor = document.getElementById('rpNotaEditor');
    const textarea = document.getElementById('rpNotaTextarea');
    const btn = document.getElementById('rpBtnNota');
    if (!editor || !textarea || !btn) return;

    const notas = getNotas();
    const notaActual = notas[noteKey] || '';
    const visible = editor.style.display !== 'none';

    if (visible) {
      editor.style.display = 'none';
      btn.textContent = notaActual ? '📝 Ver mi nota' : '📝 Agregar nota';
      return;
    }

    textarea.value = notaActual;
    textarea.dataset.notaKey = noteKey;
    editor.style.display = 'block';
    btn.textContent = '📝 Cerrar nota';
    setTimeout(() => textarea.focus(), 50);
  }

  function guardarNotaDesdePanel(value) {
    const textarea = document.getElementById('rpNotaTextarea');
    if (!textarea) return;

    const key = textarea.dataset.notaKey;
    if (!key) return;

    clearTimeout(rightPanelNotaTimer);
    rightPanelNotaTimer = setTimeout(() => {
      const notas = getNotas();
      const cleanValue = String(value || '');

      if (cleanValue.trim()) notas[key] = cleanValue;
      else delete notas[key];

      saveNotas(notas);

      const hint = document.getElementById('rpNotaHint');
      if (hint) {
        hint.classList.add('show');
        setTimeout(() => hint.classList.remove('show'), 1800);
      }

      const btn = document.getElementById('rpBtnNota');
      if (btn) {
        btn.classList.toggle('has-nota', !!cleanValue.trim());
      }
    }, 600);
  }

  function getNotesStorageInfo() {
    return {
      key: getCurrentNotesKey(),
      legacyKey: NOTES_LEGACY_KEY,
      userScoped: getCurrentNotesKey() !== NOTES_LEGACY_KEY,
      count: Object.keys(getNotas()).length
    };
  }

  return {
    getNotas,
    saveNotas,
    toggleNota,
    guardarNota,
    toggleNotaDesdePanel,
    guardarNotaDesdePanel,
    getNotesStorageInfo
  };
}
