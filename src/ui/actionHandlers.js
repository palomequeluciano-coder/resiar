/* ResiAR — global delegated action handlers.
 * This module centralizes DOM event delegation and keeps feature logic injected from main.js.
 */

export function installGlobalActionHandlers(deps = {}) {
  const {
    loginGoogle, cerrarLoginReq, toggleFaq, enviarContacto, abrirModalLegal, cerrarModalLegal,
    abrirSoundPanel, cerrarSoundPanel, toggleTheme, sbToggle, cargarSocialSidebar, abrirPerfil,
    abrirLeaderboard, abrirDesafio, abrirAdminReportes, filtrarReportes, selMotivo,
    cerrarModalReporte, enviarReporte, logout, toggleFiltroMarcadas, toggleSidebar,
    toggleNotaDesdePanel, abrirReporteActual, cerrarModal, abrirReview, exportarPDF,
    irAConfigurarNuevoExamen, cerrarModalStats, cerrarUpgrade, iniciarPago, cerrarReview,
    exitExamReviewMode, setReviewFilter, cerrarBuscador, cerrarAuth, setLbFilter, switchChallengeTab, crearDesafio,
    copiarCodigo, copiarLinkDesafio, unirseDesafio, switchProfileTab, guardarUsername,
    iniciarExamenInteligente, iniciarRepaso, iniciar, abrirBuscador, resiarRefreshQuestionBank, resiarHomeMixedClear,
    resiarHomeClearSpecialties, resiarHomeClearTopic, resiarHomeMixedToggleBank,
    resiarHomeMixedToggle, resiarHomeToggleSpecialty, resiarHomeSetTopic, activarTrialPremium,
    previewSlotFile, eliminarYrenderizar, previewSlot, resetYrenderizar, goReview,
    mixedExamFilterClear, mixedExamFilterToggleBank, mixedExamFilterToggle, selectExamen,
    selectAnioMir, irAReportePregunta, iniciarPagoDesdeTab, socialCloseFriendProfile,
    responderSolicitudSocial, socialOpenFriendProfile, eliminarAmigoSocial, enviarSolicitudSocial,
    irAPregunta, irAPreguntaDesde, iniciarExamenDesdeBusqueda, irDesdeNav, toggleMarcada, responder, prev, next,
    confirmarFinalizar, pedirExplicacion, votarExplicacion, questionChatToggle, questionChatClose,
    questionChatSetScope, questionInviteToggle, questionInviteClose, questionInviteSendToFriend,
    questionInviteOpenPayload, questionChatSend, questionChatMaybeSend, socialScheduleSearch, guardarNotaDesdePanel,
    buscarPreguntas, questionChatHandleTypingInput, resiarHomeRefreshSpecialties, toggleSonido,
    actualizarEstadoReporte, handleMultiUpload, buscarUsuariosSocial, setActual, render
  } = deps;
  if (window.__resiarAuthActionHandlersReady) return;
  window.__resiarAuthActionHandlersReady = true;

  function callLatestGlobal(name, fallback, ...args) {
    try {
      const fn = window && typeof window[name] === 'function' ? window[name] : fallback;
      if (typeof fn === 'function') return fn(...args);
    } catch (error) {
      console.warn('[ResiAR] action handler failed:', name, error);
    }
    return undefined;
  }

  document.addEventListener('click', (event) => {
    const actionTrigger = event.target.closest('[data-action]');
    if (!actionTrigger) return;

    const action = actionTrigger.dataset.action;

    if (action === 'login-google') {
      event.preventDefault();
      loginGoogle();
      return;
    }

    if (action === 'close-login-req-and-login') {
      event.preventDefault();
      if (typeof cerrarLoginReq === 'function') cerrarLoginReq();
      loginGoogle();
      return;
    }

    if (action === 'scroll-pricing') {
      event.preventDefault();
      document.getElementById('lp-pricing')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (action === 'toggle-faq') {
      event.preventDefault();
      if (typeof toggleFaq === 'function') toggleFaq(actionTrigger);
      return;
    }

    if (action === 'submit-review') {
      event.preventDefault();
      if (typeof window.submitReview === 'function') window.submitReview();
      return;
    }

    if (action === 'send-contact') {
      event.preventDefault();
      if (typeof enviarContacto === 'function') enviarContacto();
      return;
    }

    if (action === 'open-legal') {
      event.preventDefault();
      if (typeof abrirModalLegal === 'function') abrirModalLegal(actionTrigger.dataset.legal);
      return;
    }

    if (action === 'close-legal-modal') {
      event.preventDefault();
      if (typeof cerrarModalLegal === 'function') cerrarModalLegal();
      return;
    }

    if (action === 'close-legal-on-overlay') {
      if (event.target !== actionTrigger) return;
      event.preventDefault();
      if (typeof cerrarModalLegal === 'function') cerrarModalLegal();
      return;
    }

    if (action === 'open-sound-panel') {
      event.preventDefault();
      if (typeof abrirSoundPanel === 'function') abrirSoundPanel();
      return;
    }

    if (action === 'close-sound-panel') {
      event.preventDefault();
      if (typeof cerrarSoundPanel === 'function') cerrarSoundPanel();
      return;
    }

    if (action === 'close-sound-on-overlay') {
      if (event.target !== actionTrigger) return;
      event.preventDefault();
      if (typeof cerrarSoundPanel === 'function') cerrarSoundPanel();
      return;
    }

    if (action === 'toggle-theme') {
      event.preventDefault();
      if (typeof toggleTheme === 'function') toggleTheme();
      return;
    }

    if (action === 'toggle-social-panel') {
      event.preventDefault();
      if (typeof sbToggle === 'function') sbToggle('social');
      if (typeof cargarSocialSidebar === 'function') cargarSocialSidebar();
      return;
    }

    if (action === 'toggle-user-panel') {
      event.preventDefault();
      if (typeof sbToggle === 'function') sbToggle('usuario');
      return;
    }

    if (action === 'open-profile') {
      event.preventDefault();
      if (typeof abrirPerfil === 'function') abrirPerfil();
      return;
    }

    if (action === 'open-leaderboard') {
      event.preventDefault();
      if (typeof abrirLeaderboard === 'function') abrirLeaderboard();
      return;
    }

    if (action === 'open-challenge') {
      event.preventDefault();
      if (typeof abrirDesafio === 'function') abrirDesafio();
      return;
    }

    if (action === 'open-admin-reports') {
      event.preventDefault();
      if (typeof abrirAdminReportes === 'function') abrirAdminReportes();
      return;
    }

    if (action === 'filter-reports') {
      event.preventDefault();
      if (typeof filtrarReportes === 'function') filtrarReportes(actionTrigger.dataset.status, actionTrigger);
      return;
    }

    if (action === 'select-report-reason') {
      event.preventDefault();
      if (typeof selMotivo === 'function') selMotivo(actionTrigger, actionTrigger.dataset.reason);
      return;
    }

    if (action === 'close-report-modal') {
      event.preventDefault();
      if (typeof cerrarModalReporte === 'function') cerrarModalReporte();
      return;
    }

    if (action === 'close-report-on-overlay') {
      if (event.target !== actionTrigger) return;
      event.preventDefault();
      if (typeof cerrarModalReporte === 'function') cerrarModalReporte();
      return;
    }

    if (action === 'send-report') {
      event.preventDefault();
      if (typeof enviarReporte === 'function') enviarReporte();
      return;
    }

    if (action === 'logout') {
      event.preventDefault();
      if (typeof logout === 'function') logout();
      return;
    }

    if (action === 'toggle-marked-filter') {
      event.preventDefault();
      if (typeof toggleFiltroMarcadas === 'function') toggleFiltroMarcadas();
      return;
    }

    if (action === 'toggle-sidebar') {
      event.preventDefault();
      if (typeof toggleSidebar === 'function') toggleSidebar();
      return;
    }

    if (action === 'toggle-note-panel') {
      event.preventDefault();
      if (typeof toggleNotaDesdePanel === 'function') toggleNotaDesdePanel();
      return;
    }

    if (action === 'open-current-report') {
      event.preventDefault();
      if (typeof abrirReporteActual === 'function') abrirReporteActual();
      return;
    }

    if (action === 'close-final-and-open-review') {
      event.preventDefault();
      if (typeof exitExamReviewMode === 'function') exitExamReviewMode();
      if (typeof cerrarModal === 'function') cerrarModal();
      if (typeof abrirReview === 'function') abrirReview();
      return;
    }

    if (action === 'export-pdf') {
      event.preventDefault();
      if (typeof exportarPDF === 'function') exportarPDF();
      return;
    }

    if (action === 'configure-new-exam') {
      event.preventDefault();
      if (typeof irAConfigurarNuevoExamen === 'function') irAConfigurarNuevoExamen();
      return;
    }

    if (action === 'close-stats-modal') {
      event.preventDefault();
      if (typeof cerrarModalStats === 'function') cerrarModalStats();
      return;
    }

    if (action === 'close-upgrade') {
      event.preventDefault();
      if (typeof cerrarUpgrade === 'function') cerrarUpgrade();
      return;
    }

    if (action === 'start-payment') {
      event.preventDefault();
      if (typeof iniciarPago === 'function') iniciarPago(actionTrigger.dataset.plan);
      return;
    }

    if (action === 'close-review-and-show-final') {
      event.preventDefault();
      if (typeof cerrarReview === 'function') cerrarReview();
      if (typeof exitExamReviewMode === 'function') exitExamReviewMode();
      document.getElementById('modalFinal')?.classList.add('vis');
      return;
    }

    if (action === 'close-review') {
      event.preventDefault();
      if (typeof cerrarReview === 'function') cerrarReview();
      return;
    }

    if (action === 'set-review-filter') {
      event.preventDefault();
      if (typeof setReviewFilter === 'function') setReviewFilter(actionTrigger.dataset.filter, actionTrigger);
      return;
    }

    if (action === 'close-search-modal') {
      event.preventDefault();
      if (typeof cerrarBuscador === 'function') cerrarBuscador();
      return;
    }

    if (action === 'close-login-required') {
      event.preventDefault();
      if (typeof cerrarLoginReq === 'function') cerrarLoginReq();
      return;
    }

    if (action === 'close-auth-modal') {
      event.preventDefault();
      if (typeof cerrarAuth === 'function') cerrarAuth();
      return;
    }

    if (action === 'close-modal') {
      event.preventDefault();
      document.getElementById(actionTrigger.dataset.modalId)?.classList.remove('vis');
      return;
    }

    if (action === 'set-leaderboard-filter') {
      event.preventDefault();
      if (typeof setLbFilter === 'function') setLbFilter(actionTrigger.dataset.filter, actionTrigger);
      return;
    }

    if (action === 'switch-challenge-tab') {
      event.preventDefault();
      if (typeof switchChallengeTab === 'function') switchChallengeTab(actionTrigger.dataset.tab);
      return;
    }

    if (action === 'create-challenge') {
      event.preventDefault();
      if (typeof crearDesafio === 'function') crearDesafio();
      return;
    }

    if (action === 'copy-challenge-code') {
      event.preventDefault();
      if (typeof copiarCodigo === 'function') copiarCodigo();
      return;
    }

    if (action === 'copy-challenge-link') {
      event.preventDefault();
      if (typeof copiarLinkDesafio === 'function') copiarLinkDesafio();
      return;
    }

    if (action === 'join-challenge') {
      event.preventDefault();
      if (typeof unirseDesafio === 'function') unirseDesafio();
      return;
    }

    if (action === 'switch-profile-tab') {
      event.preventDefault();
      if (typeof switchProfileTab === 'function') switchProfileTab(actionTrigger.dataset.tab);
      return;
    }

    if (action === 'save-username') {
      event.preventDefault();
      if (typeof guardarUsername === 'function') guardarUsername();
      return;
    }

    if (action === 'start-smart-exam') {
      event.preventDefault();
      if (typeof iniciarExamenInteligente === 'function') iniciarExamenInteligente();
      return;
    }

    if (action === 'start-review-errors') {
      event.preventDefault();
      if (typeof iniciarRepaso === 'function') iniciarRepaso();
      return;
    }

    if (action === 'home-start-exam') {
      event.preventDefault();
      callLatestGlobal('iniciar', iniciar);
      return;
    }

    if (action === 'home-open-search') {
      event.preventDefault();
      if (typeof abrirBuscador === 'function') abrirBuscador();
      return;
    }

    if (action === 'refresh-question-bank') {
      event.preventDefault();
      callLatestGlobal('resiarRefreshQuestionBank', resiarRefreshQuestionBank);
      return;
    }

    if (action === 'home-mixed-clear') {
      event.preventDefault();
      callLatestGlobal('resiarHomeMixedClear', resiarHomeMixedClear);
      return;
    }

    if (action === 'home-clear-specialties') {
      event.preventDefault();
      callLatestGlobal('resiarHomeClearSpecialties', resiarHomeClearSpecialties);
      return;
    }

    if (action === 'home-clear-topic') {
      event.preventDefault();
      callLatestGlobal('resiarHomeClearTopic', resiarHomeClearTopic);
      return;
    }

    if (action === 'home-mixed-toggle-bank') {
      event.preventDefault();
      callLatestGlobal('resiarHomeMixedToggleBank', resiarHomeMixedToggleBank, actionTrigger.dataset.bank);
      return;
    }

    if (action === 'home-mixed-toggle') {
      event.preventDefault();
      callLatestGlobal('resiarHomeMixedToggle', resiarHomeMixedToggle, actionTrigger.dataset.key);
      return;
    }

    if (action === 'home-toggle-specialty') {
      event.preventDefault();
      callLatestGlobal('resiarHomeToggleSpecialty', resiarHomeToggleSpecialty, Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'home-set-topic') {
      event.preventDefault();
      callLatestGlobal('resiarHomeSetTopic', resiarHomeSetTopic, actionTrigger.dataset.topic || '', true);
      return;
    }

    if (action === 'activate-trial-premium') {
      event.preventDefault();
      if (typeof activarTrialPremium === 'function') activarTrialPremium();
      return;
    }

    if (action === 'sound-preview-file') {
      event.preventDefault();
      if (typeof previewSlotFile === 'function') previewSlotFile(actionTrigger.dataset.slot, Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'sound-delete-file') {
      event.preventDefault();
      if (typeof eliminarYrenderizar === 'function') eliminarYrenderizar(actionTrigger.dataset.slot, Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'sound-preview-slot') {
      event.preventDefault();
      if (typeof previewSlot === 'function') previewSlot(actionTrigger.dataset.slot);
      return;
    }

    if (action === 'sound-open-file') {
      event.preventDefault();
      document.getElementById('sp-file-' + actionTrigger.dataset.slot)?.click();
      return;
    }

    if (action === 'sound-reset-slot') {
      event.preventDefault();
      if (typeof resetYrenderizar === 'function') resetYrenderizar(actionTrigger.dataset.slot);
      return;
    }

    if (action === 'review-go-index') {
      event.preventDefault();
      if (typeof goReview === 'function') goReview(Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'mixed-filter-clear') {
      event.preventDefault();
      callLatestGlobal('mixedExamFilterClear', mixedExamFilterClear);
      return;
    }

    if (action === 'mixed-filter-toggle-bank') {
      event.preventDefault();
      callLatestGlobal('mixedExamFilterToggleBank', mixedExamFilterToggleBank, actionTrigger.dataset.bank);
      return;
    }

    if (action === 'mixed-filter-toggle') {
      event.preventDefault();
      callLatestGlobal('mixedExamFilterToggle', mixedExamFilterToggle, actionTrigger.dataset.key);
      return;
    }

    if (action === 'select-exam-filter') {
      event.preventDefault();
      callLatestGlobal('selectExamen', selectExamen, actionTrigger.dataset.value, actionTrigger.dataset.label);
      return;
    }

    if (action === 'select-mir-year-filter') {
      event.preventDefault();
      callLatestGlobal('selectAnioMir', selectAnioMir, actionTrigger.dataset.value, actionTrigger.dataset.label);
      return;
    }

    if (action === 'go-report-question') {
      event.preventDefault();
      if (typeof irAReportePregunta === 'function') irAReportePregunta(actionTrigger.dataset.questionId);
      return;
    }

    if (action === 'start-profile-payment') {
      event.preventDefault();
      if (typeof iniciarPagoDesdeTab === 'function') iniciarPagoDesdeTab(actionTrigger.dataset.plan);
      return;
    }

    if (action === 'close-social-profile') {
      event.preventDefault();
      if (typeof socialCloseFriendProfile === 'function') socialCloseFriendProfile();
      return;
    }

    if (action === 'social-respond-request') {
      event.preventDefault();
      if (typeof responderSolicitudSocial === 'function') responderSolicitudSocial(actionTrigger.dataset.requestId, actionTrigger.dataset.status);
      return;
    }

    if (action === 'open-social-profile') {
      event.preventDefault();
      if (typeof socialOpenFriendProfile === 'function') socialOpenFriendProfile(actionTrigger.dataset.userId);
      return;
    }

    if (action === 'remove-social-friend') {
      event.preventDefault();
      if (typeof eliminarAmigoSocial === 'function') eliminarAmigoSocial(actionTrigger.dataset.userId);
      return;
    }

    if (action === 'social-send-request') {
      event.preventDefault();
      if (typeof enviarSolicitudSocial === 'function') enviarSolicitudSocial(actionTrigger.dataset.userId);
      return;
    }

    if (action === 'scroll-social-incoming') {
      event.preventDefault();
      document.getElementById('socialIncomingList')?.scrollIntoView({ block: 'nearest' });
      return;
    }


    if (action === 'review-open-question') {
      event.preventDefault();
      if (typeof irAPregunta === 'function') irAPregunta(Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'search-open-question') {
      event.preventDefault();
      if (typeof irAPreguntaDesde === 'function') {
        irAPreguntaDesde(Number(actionTrigger.dataset.index), actionTrigger.dataset.inExam === 'true');
      }
      return;
    }

    if (action === 'search-start-matches') {
      event.preventDefault();
      if (typeof iniciarExamenDesdeBusqueda === 'function') iniciarExamenDesdeBusqueda(Number(actionTrigger.dataset.index || 0));
      else if (typeof window.iniciarExamenDesdeBusqueda === 'function') window.iniciarExamenDesdeBusqueda(Number(actionTrigger.dataset.index || 0));
      return;
    }

    if (action === 'exam-go-question') {
      event.preventDefault();
      if (typeof irDesdeNav === 'function') irDesdeNav(Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'exam-toggle-marked') {
      event.preventDefault();
      if (typeof toggleMarcada === 'function') toggleMarcada(Number(actionTrigger.dataset.index));
      return;
    }

    if (action === 'exam-answer') {
      event.preventDefault();
      if (typeof responder === 'function') responder(actionTrigger.dataset.answer);
      return;
    }

    if (action === 'exam-prev') {
      event.preventDefault();
      if (typeof prev === 'function') prev();
      return;
    }

    if (action === 'exam-next') {
      event.preventDefault();
      if (typeof next === 'function') next();
      return;
    }

    if (action === 'exam-finish') {
      event.preventDefault();
      if (typeof confirmarFinalizar === 'function') confirmarFinalizar();
      return;
    }

    if (action === 'exam-request-explanation') {
      event.preventDefault();
      if (typeof pedirExplicacion === 'function') pedirExplicacion();
      return;
    }

    if (action === 'explanation-vote') {
      event.preventDefault();
      if (typeof votarExplicacion === 'function') {
        votarExplicacion(
          Number(actionTrigger.dataset.vote),
          actionTrigger.dataset.questionId,
          Number(actionTrigger.dataset.promptVersion)
        );
      }
      return;
    }

    if (action === 'final-go-question') {
      event.preventDefault();
      if (typeof cerrarModal === 'function') cerrarModal();
      if (typeof setActual === 'function') setActual(Number(actionTrigger.dataset.index));
      if (typeof render === 'function') render();
      return;
    }


    if (action === 'question-chat-toggle') {
      event.preventDefault();
      if (typeof questionChatToggle === 'function') questionChatToggle();
      return;
    }

    if (action === 'question-chat-close') {
      event.preventDefault();
      if (typeof questionChatClose === 'function') questionChatClose();
      return;
    }

    if (action === 'question-chat-set-scope') {
      event.preventDefault();
      if (typeof questionChatSetScope === 'function') questionChatSetScope(actionTrigger.dataset.scope);
      return;
    }

    if (action === 'question-invite-toggle') {
      event.preventDefault();
      if (typeof questionInviteToggle === 'function') questionInviteToggle();
      return;
    }

    if (action === 'question-invite-close') {
      event.preventDefault();
      if (typeof questionInviteClose === 'function') questionInviteClose();
      return;
    }

    if (action === 'question-invite-send') {
      event.preventDefault();
      if (typeof questionInviteSendToFriend === 'function') questionInviteSendToFriend(actionTrigger.dataset.friendId, actionTrigger.dataset.inviteType);
      return;
    }

    if (action === 'question-invite-open-payload') {
      event.preventDefault();
      if (typeof questionInviteOpenPayload === 'function') questionInviteOpenPayload(actionTrigger.dataset.inviteId);
      return;
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-submit-action]');
    if (!form) return;

    const action = form.dataset.submitAction;

    if (action === 'question-chat-send') {
      event.preventDefault();
      if (typeof questionChatSend === 'function') questionChatSend(event);
      return;
    }
  });

  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-input-action]');
    if (!input) return;

    const action = input.dataset.inputAction;

    if (action === 'challenge-code-uppercase') {
      input.value = String(input.value || '').toUpperCase();
      return;
    }

    if (action === 'social-search') {
      if (typeof socialScheduleSearch === 'function') socialScheduleSearch();
      return;
    }

    if (action === 'save-question-note') {
      if (typeof guardarNotaDesdePanel === 'function') guardarNotaDesdePanel(input.value);
      return;
    }

    if (action === 'search-questions') {
      if (typeof buscarPreguntas === 'function') buscarPreguntas(input.value);
      return;
    }

    if (action === 'question-chat-typing') {
      if (typeof questionChatHandleTypingInput === 'function') questionChatHandleTypingInput();
      return;
    }

    if (action === 'home-topic') {
      if (typeof resiarHomeSetTopic === 'function') resiarHomeSetTopic(input.value);
      return;
    }

    if (action === 'home-specialties-refresh') {
      if (typeof resiarHomeRefreshSpecialties === 'function') resiarHomeRefreshSpecialties();
      return;
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-change-action]');
    if (!input) return;

    const action = input.dataset.changeAction;

    if (action === 'toggle-sound') {
      if (typeof toggleSonido === 'function') toggleSonido();
      return;
    }
    if (action === 'update-report-status') {
      if (typeof actualizarEstadoReporte === 'function') actualizarEstadoReporte(input.dataset.reportId, input.value);
      return;
    }

    if (action === 'sound-upload-slot') {
      if (typeof handleMultiUpload === 'function') handleMultiUpload(input.dataset.slot, input);
      return;
    }

  });

  document.addEventListener('keydown', (event) => {
    const keydownTarget = event.target.closest('[data-keydown-action]');
    if (keydownTarget) {
      const keydownAction = keydownTarget.dataset.keydownAction;
      if (keydownAction === 'question-chat-maybe-send') {
        if (typeof questionChatMaybeSend === 'function') questionChatMaybeSend(event);
        return;
      }
    }

    const input = event.target.closest('[data-enter-action]');
    if (!input || event.key !== 'Enter') return;

    const action = input.dataset.enterAction;

    if (action === 'social-search-submit') {
      event.preventDefault();
      if (typeof buscarUsuariosSocial === 'function') buscarUsuariosSocial();
      return;
    }

    if (action === 'save-username') {
      event.preventDefault();
      if (typeof guardarUsername === 'function') guardarUsername();
      return;
    }
  });

  document.addEventListener('focusin', (event) => {
    const input = event.target.closest('[data-focus-border="username-input"]');
    if (input) input.style.borderColor = 'var(--accent)';
  });

  document.addEventListener('focusout', (event) => {
    const input = event.target.closest('[data-focus-border="username-input"]');
    if (input) input.style.borderColor = 'var(--border)';
  });

  document.addEventListener('mouseover', (event) => {
    const button = event.target.closest('[data-hover-bg="username-save"]');
    if (button) button.style.background = 'var(--accent2)';
  });

  document.addEventListener('mouseout', (event) => {
    const button = event.target.closest('[data-hover-bg="username-save"]');
    if (button) button.style.background = 'var(--accent)';
  });
}
