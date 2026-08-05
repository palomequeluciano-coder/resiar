// RESIAR — Wrapper liviano de code-splitting para el editor de preguntas de admin.
//
// La implementación real (adminQuestionEditorImpl.js, ~49 KB) solo se importa
// dinámicamente cuando el usuario logueado es admin. Para el resto de los
// usuarios (la gran mayoría) este archivo evita que ese peso entre al bundle
// inicial.

let realEditor = null;
let loadPromise = null;
let deps = {};

function isAdmin() {
  return typeof deps.isAdmin === 'function' ? !!deps.isAdmin() : false;
}

function ensureRealEditorLoaded() {
  if (!loadPromise) {
    loadPromise = import('./adminQuestionEditorImpl.js').then((mod) => {
      realEditor = mod.configureAdminQuestionEditor(deps);
      // Si en el momento en que terminó de cargar el usuario sigue con la
      // pantalla de examen abierta, forzamos un re-render para que el botón
      // real (con su editor detrás) reemplace el placeholder.
      try { deps.renderExam?.(); } catch (_) {}
    });
  }
  return loadPromise;
}

export function configureAdminQuestionEditor(config = {}) {
  deps = config || {};

  return {
    openCurrent() {
      if (realEditor) return realEditor.openCurrent();
      // No debería poder llegar acá sin ser admin (el botón que dispara esto
      // solo se renderiza para admins), pero por las dudas disparamos la
      // carga si todavía no terminó.
      ensureRealEditorLoaded();
    },
    close() {
      if (realEditor) realEditor.close();
    },
    isOpen: () => !!realEditor?.isOpen(),
    renderQuestionToolbarButton() {
      if (!isAdmin()) return '';
      if (realEditor) return realEditor.renderQuestionToolbarButton();
      // Admin, pero el módulo pesado todavía no cargó: lo disparamos en
      // segundo plano y devolvemos el botón deshabilitado por este render.
      ensureRealEditorLoaded();
      return `<button type="button" class="btn-admin-edit-question" disabled title="Cargando editor…">✎ Corregir</button>`;
    },
  };
}
