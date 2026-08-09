import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../ui/whatsappViewState.js';

describe('whatsappViewState (efecto de import: window.resiar*)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="waFloat"></div>
      <div id="streakToast" class="show"></div>
    `;
    document.body.className = '';
    delete document.body.dataset.resiarView;
  });

  afterEach(() => {
    delete window.resiarSetViewState;
    delete window.resiarSyncWhatsAppFloat;
  });

  it('expone las 3 funciones globales tras importar el módulo', () => {
    expect(typeof window.resiarSetWhatsAppVisible).toBe('function');
    expect(typeof window.resiarMarkViewState).toBe('function');
    expect(typeof window.resiarHideStreakToast).toBe('function');
  });

  describe('resiarSetWhatsAppVisible', () => {
    it('muestra el flotante de WhatsApp cuando visible=true', () => {
      window.resiarSetWhatsAppVisible(true);
      const wa = document.getElementById('waFloat');
      expect(wa.style.display).toBe('flex');
      expect(wa.style.visibility).toBe('visible');
      expect(wa.getAttribute('aria-hidden')).toBe('false');
      expect(wa.tabIndex).toBe(0);
    });

    it('oculta el flotante de WhatsApp cuando visible=false', () => {
      window.resiarSetWhatsAppVisible(false);
      const wa = document.getElementById('waFloat');
      expect(wa.style.display).toBe('none');
      expect(wa.style.visibility).toBe('hidden');
      expect(wa.getAttribute('aria-hidden')).toBe('true');
      expect(wa.tabIndex).toBe(-1);
    });

    it('no rompe si el elemento #waFloat no existe', () => {
      document.body.innerHTML = '';
      expect(() => window.resiarSetWhatsAppVisible(true)).not.toThrow();
    });
  });

  describe('resiarMarkViewState', () => {
    it('delega en window.resiarSetViewState cuando está disponible', () => {
      let called = null;
      window.resiarSetViewState = (kind) => { called = kind; };
      window.resiarMarkViewState('exam');
      expect(called).toBe('exam');
      // no debería tocar el fallback manual si delegó
      expect(document.body.dataset.resiarView).toBeUndefined();
    });

    it('sin resiarSetViewState, normaliza y aplica el estado manualmente', () => {
      window.resiarMarkViewState('EXAM_ENDED'.toLowerCase().replace('exam_ended', 'ended'));
      // usa directamente 'ended' -> mapea a 'exam-ended'
      window.resiarMarkViewState('ended');
      expect(document.body.dataset.resiarView).toBe('exam-ended');
    });

    it('mapea "home" y "blocked" a "config"', () => {
      window.resiarMarkViewState('home');
      expect(document.body.dataset.resiarView).toBe('config');
      window.resiarMarkViewState('blocked');
      expect(document.body.dataset.resiarView).toBe('config');
    });

    it('agrega la clase resiar-public-landing solo en estado landing', () => {
      window.resiarMarkViewState('landing');
      expect(document.body.classList.contains('resiar-public-landing')).toBe(true);
      window.resiarMarkViewState('exam');
      expect(document.body.classList.contains('resiar-public-landing')).toBe(false);
    });

    it('oculta WhatsApp fuera de landing y llama a resiarSyncWhatsAppFloat en landing', () => {
      let synced = false;
      window.resiarSyncWhatsAppFloat = () => { synced = true; };
      window.resiarMarkViewState('exam');
      expect(document.getElementById('waFloat').style.display).toBe('none');
      window.resiarMarkViewState('landing');
      expect(synced).toBe(true);
    });

    it('no rompe con un kind vacío o inválido', () => {
      expect(() => window.resiarMarkViewState()).not.toThrow();
      expect(document.body.dataset.resiarView).toBe('config');
    });
  });

  describe('resiarHideStreakToast', () => {
    it('quita la clase "show" del toast de racha', () => {
      window.resiarHideStreakToast();
      expect(document.getElementById('streakToast').classList.contains('show')).toBe(false);
    });

    it('no rompe si el elemento #streakToast no existe', () => {
      document.body.innerHTML = '';
      expect(() => window.resiarHideStreakToast()).not.toThrow();
    });
  });
});
