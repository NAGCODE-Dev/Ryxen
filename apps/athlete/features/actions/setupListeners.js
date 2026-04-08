import { getAppBridge } from '../../../../src/app/bridge.js';

export function registerAthleteInputListeners({ root, filterAthletePrs }) {
  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!target || target.id !== 'ui-prsSearch') return;
    filterAthletePrs(root, target.value);
  });
}

export function registerAthleteAuthKeyListeners({ root, getUiState, handleAthleteAuthEnterKey }) {
  root.addEventListener('keydown', async (event) => {
    handleAthleteAuthEnterKey(event, {
      root,
      getUiState,
    });
  });

  root.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!target?.closest?.('#ui-authForm')) return;
    if (target.tagName === 'BUTTON' || target.type === 'button') return;
    event.preventDefault();

    handleAthleteAuthEnterKey(event, {
      root,
      getUiState,
    });
  });
}

export function registerAthleteClickListeners({
  root,
  toast,
  getUiState,
  applyUiState,
  applyUiPatch,
  finalizeUiChange,
  renderUi,
  setUiState,
  invalidateHydrationCache,
  shouldHydratePage,
  hydratePage,
  hydrateAthleteSummary,
  hydrateAthleteResultsBlock,
  syncAthletePrIfAuthenticated,
  resumePendingCheckout,
  isImportBusy,
  guardAthleteImport,
  emptyCoachPortal,
  emptyAthleteOverview,
  emptyAdmin,
  handleExerciseHelpAction,
  handleAthleteModalAction,
  handleAthleteAuthAction,
  handleAthleteBillingAction,
  handleAthleteAccountHistoryAction,
  handleAthleteTodayAction,
  isDeveloperEmail,
  isDeveloperProfile,
  normalizeCheckoutPlan,
  idleImportStatus,
  prepareImportFileForClientUse,
  pickJsonFile,
  pickPdfFile,
  pickUniversalFile,
  explainImportFailure,
  formatBytes,
  IMPORT_HARD_MAX_BYTES,
  IMAGE_COMPRESS_THRESHOLD_BYTES,
  IMAGE_TARGET_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  workoutKeyFromAppState,
  getActiveLineIdFromUi,
  getLineIdsFromDOM,
  pickNextId,
  pickPrevId,
  scrollToLine,
  cssEscape,
  startRestTimer,
  consumeAthleteImport,
  routeAthleteClickAction,
}) {
  root.addEventListener('click', async (event) => {
    const element = event.target.closest('[data-action]');
    if (!element) return;

    const action = element.dataset.action;

    try {
      const handled = await routeAthleteClickAction(action, {
        element,
        root,
        toast,
        getUiState,
        applyUiState,
        applyUiPatch,
        finalizeUiChange,
        renderUi,
        setUiState,
        invalidateHydrationCache,
        shouldHydratePage,
        hydratePage,
        hydrateAthleteSummary,
        hydrateAthleteResultsBlock,
        syncAthletePrIfAuthenticated,
        resumePendingCheckout,
        isImportBusy,
        guardAthleteImport,
        emptyCoachPortal,
        emptyAthleteOverview,
        emptyAdmin,
        handleExerciseHelpAction,
        handleAthleteModalAction,
        handleAthleteAuthAction,
        handleAthleteBillingAction,
        handleAthleteAccountHistoryAction,
        handleAthleteTodayAction,
        isDeveloperEmail,
        isDeveloperProfile,
        normalizeCheckoutPlan,
        idleImportStatus,
        prepareImportFileForClientUse,
        pickJsonFile,
        pickPdfFile,
        pickUniversalFile,
        explainImportFailure,
        formatBytes,
        IMPORT_HARD_MAX_BYTES,
        IMAGE_COMPRESS_THRESHOLD_BYTES,
        IMAGE_TARGET_MAX_BYTES,
        IMAGE_MAX_DIMENSION,
        workoutKeyFromAppState,
        getActiveLineIdFromUi,
        getLineIdsFromDOM,
        pickNextId,
        pickPrevId,
        scrollToLine,
        cssEscape,
        startRestTimer,
        consumeAthleteImport,
      });
      if (handled) return;
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });
}

export function registerAthleteChangeListeners({
  root,
  toast,
  applyUiPatch,
  finalizeUiChange,
  handleAthleteTodayChange,
}) {
  root.addEventListener('change', async (event) => {
    await handleAthleteTodayChange(event, {
      root,
      toast,
      applyUiPatch,
      finalizeUiChange,
      getAppBridge,
    });
  });
}

export function registerAthleteModalListeners({
  root,
  toast,
  getUiState,
  applyUiPatch,
  isImportBusy,
  handleAthleteModalOverlayClick,
  handleAthleteModalEscapeKey,
}) {
  root.addEventListener('click', async (event) => {
    await handleAthleteModalOverlayClick(event, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });

  document.addEventListener('keydown', async (event) => {
    await handleAthleteModalEscapeKey(event, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });
}
