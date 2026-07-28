/*
 * ResiAR — Sidebar UI.
 *
 * Módulo visual de acordeón y resúmenes de sidebar. No contiene lógica de
 * filtros ni generación de exámenes.
 */

export function sbToggle(id) {
  const allowed = new Set(['social', 'usuario']);
  if (!allowed.has(id)) return;

  const panels = document.querySelectorAll('.sb-accordion > .sb-panel');

  panels.forEach((panel) => {
    if (panel.id === `panel-${id}`) {
      const wasOpen = panel.classList.contains('open');
      panel.classList.remove('expanded');

      if (wasOpen) {
        panel.classList.remove('open');
        return;
      }

      panel.classList.add('open');
      setTimeout(() => {
        if (panel.classList.contains('open')) {
          panel.classList.add('expanded');
        }
      }, 340);
      return;
    }

    panel.classList.remove('open', 'expanded');
  });
}

export function installSidebarAccordion() {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sb-accordion > .sb-panel.open').forEach((panel) => {
      setTimeout(() => panel.classList.add('expanded'), 50);
    });
  });
}

export function sbUpdateSummary() {
  // Los filtros ya no pertenecen a la sidebar. El estado operativo vive en la home principal.
}

export function sbUpdateCuentaSummary(nombre, profile) {
  const summary = document.getElementById('summary-usuario');
  const dot = document.querySelector('#panel-usuario .sb-trigger-dot');

  if (!summary) return;

  summary.className = 'sb-trigger-summary';
  if (dot) dot.classList.remove('state-warn', 'state-pro');

  if (!nombre) {
    summary.textContent = 'Iniciar';
    summary.classList.add('var-warn');
    if (dot) dot.classList.add('state-warn');
    return;
  }

  if (profile) {
    const plan = profile.plan;

    if (plan === 'pro' || plan === 'admin') {
      summary.textContent = plan === 'admin' ? 'Admin' : 'Pro';
      summary.classList.add('var-pro');
      if (dot) dot.classList.add('state-pro');
      return;
    }

    if (plan === 'trial') {
      summary.textContent = 'Trial';
      summary.classList.add('var-warn');
      return;
    }
  }

  const first = String(nombre || '').split(' ')[0] || String(nombre || '');
  summary.textContent = first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

export function sbUpdateOpcionesSummary() {
  // Las acciones de práctica/generación ya no pertenecen a la sidebar.
}
