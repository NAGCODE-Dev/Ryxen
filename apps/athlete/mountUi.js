import {
  renderHeaderAccount,
  renderMainContent,
  renderBottomNav,
  renderModals,
} from './features/render/shell.js';
import { setupAthleteActions } from './features/actions/setup.js';
import { bindAthleteAppEvents } from './features/events/bindings.js';
import { prepareAthleteLayoutRoot, ensureAthleteToast, setLayoutHtml, setLayoutText } from './layoutShell.js';
import {
  createAthleteEventLog,
  createAthleteUiStateController,
} from './services/uiController.js';
import { createAthleteRenderController } from './services/renderController.js';
import { markBootstrapStep } from './bootstrapObservability.js';

export async function mountUI({ root }) {
  if (!root) throw new Error('mountUI: root é obrigatório');

  const refs = prepareAthleteLayoutRoot(root);
  const { toast } = ensureAthleteToast();

  const { createStorage } = await import('../../src/adapters/storage/storageFactory.js');
  const uiController = await createAthleteUiStateController({ createStorage });
  const { getUiState, setImportStatus, setUiState, patchUiState } = uiController;
  let uiBusy = false;
  let uiBusyMessage = '';
  let loadingHideTimer = null;
  let loadingHiddenReported = false;
  const clearPendingLoadingHide = () => {
    if (loadingHideTimer == null) return;
    clearTimeout(loadingHideTimer);
    loadingHideTimer = null;
  };

  const setBusy = (isBusy, message) => {
    uiBusy = !!isBusy;
    uiBusyMessage = isBusy ? String(message || 'Carregando...') : '';
    const loadingEl = document.getElementById('loading-screen');
    if (!loadingEl) return;
    const labelEl = loadingEl.querySelector('[data-loading-label]');
    clearPendingLoadingHide();
    if (isBusy) {
      loadingEl.hidden = false;
      loadingEl.removeAttribute('aria-hidden');
    }
    loadingEl.classList.toggle('hide', !isBusy);
    document.body.classList.toggle('ui-busy', !!isBusy);
    if (labelEl) {
      labelEl.textContent = uiBusyMessage || 'Carregando...';
    }
    if (!isBusy) {
      loadingHideTimer = window.setTimeout(() => {
        loadingEl.hidden = true;
        loadingEl.setAttribute('aria-hidden', 'true');
        if (!loadingHiddenReported) {
          loadingHiddenReported = true;
          markBootstrapStep('loading_hidden');
        }
        loadingHideTimer = null;
      }, 28);
    }
  };

  const pushEventLine = createAthleteEventLog(refs.events);
  const { rerender } = createAthleteRenderController({
    refs,
    getUiState,
    getUiBusy: () => uiBusy,
    renderHeaderAccount,
    renderMainContent,
    renderBottomNav,
    renderModals,
    setLayoutHtml,
    setLayoutText,
  });

  const destroyEvents = bindAthleteAppEvents({
    pushEventLine,
    rerender: () => rerender(),
    toast,
    setBusy,
    setImportStatus,
  });

  setupAthleteActions({
    root,
    toast,
    rerender: () => rerender(),
    getUiState,
    setUiState,
    patchUiState,
    setImportStatus,
  });

  // Primeira renderização: some com loading inicial
  setBusy(false);
  pushEventLine('UI montada');
  await rerender();

  return {
    rerender,
    destroy() {
      uiController.destroy();
      try { destroyEvents?.(); } catch (e) { console.warn('destroyEvents falhou', e); }
    },
  };
}
