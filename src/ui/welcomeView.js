import { escapeHTML } from '../utils/sanitize.js';

export function renderWelcome(root, state) {
  root.innerHTML = `
    <main class="migration-placeholder" data-view="${escapeHTML(state.currentView)}">
      <section class="migration-placeholder__card">
        <h1>ResiAR</h1>
        <p>Base Vite inicial lista. El próximo paso es copiar el HTML actual y migrar sin cambiar comportamiento.</p>
      </section>
    </main>
  `;
}
