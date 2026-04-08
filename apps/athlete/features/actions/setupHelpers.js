import {
  hasCheckoutAuth,
  peekCheckoutIntent,
  queueCheckoutIntent,
} from '../../../../src/core/services/subscriptionService.js';
import { getAppBridge } from '../../../../src/app/bridge.js';
import {
  maybePrimeCheckoutIntentFromUrl,
  normalizeCheckoutPlan,
} from '../account/services.js';

export function readAthleteAppState() {
  try {
    if (getAppBridge()?.getStateSnapshot) return getAppBridge().getStateSnapshot();
    if (getAppBridge()?.getState) return getAppBridge().getState();
    return {};
  } catch {
    return {};
  }
}

export function createAthleteUiActions({
  root,
  toast,
  rerender,
  setUiState,
  patchUiState,
  getEnsureGoogleSignInUi,
}) {
  const renderUi = async () => {
    if (typeof rerender === 'function') await rerender();
  };

  async function finalizeUiChange({
    render = true,
    toastMessage = '',
    ensureGoogle = false,
    focusSelector = '',
  } = {}) {
    if (toastMessage) toast(toastMessage);
    if (render) await renderUi();
    if (ensureGoogle) await getEnsureGoogleSignInUi?.()?.();
    if (focusSelector) root.querySelector(focusSelector)?.focus();
  }

  async function applyUiState(next, options = {}) {
    await setUiState(next);
    await finalizeUiChange(options);
  }

  async function applyUiPatch(updater, options = {}) {
    await patchUiState(updater);
    await finalizeUiChange(options);
  }

  return {
    renderUi,
    finalizeUiChange,
    applyUiState,
    applyUiPatch,
  };
}

export function queueAthleteCheckoutBootstrap({
  applyUiPatch,
  getEnsureGoogleSignInUi,
  maybeResumePendingCheckout,
}) {
  queueMicrotask(async () => {
    try {
      await maybePrimeCheckoutIntentFromUrl({
        getAppBridge,
        hasCheckoutAuth,
        queueCheckoutIntent,
        normalizeCheckoutPlan,
        maybeResumePendingCheckout,
        applyUiPatch,
      });
      await getEnsureGoogleSignInUi?.()?.();
      if (peekCheckoutIntent() && hasCheckoutAuth() && getAppBridge()?.getProfile?.()?.data?.email) {
        await maybeResumePendingCheckout();
      }
    } catch (error) {
      console.warn('Falha ao preparar checkout pendente:', error?.message || error);
    }
  });
}

export async function routeAthleteClickAction(action, context) {
  const {
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
  } = context;

  if (action === 'exercise:help') {
    context.handleExerciseHelpAction(element);
    return true;
  }

  const handledByAthleteModal = await context.handleAthleteModalAction(action, {
    element,
    toast,
    getUiState,
    applyUiState,
    applyUiPatch,
    isImportBusy,
  });
  if (handledByAthleteModal) return true;

  const handledByAthleteAuth = await context.handleAthleteAuthAction(action, {
    element,
    root,
    getUiState,
    applyUiState,
    applyUiPatch,
    getAppBridge,
    invalidateHydrationCache,
    shouldHydratePage,
    hydratePage,
    maybeResumePendingCheckout: resumePendingCheckout,
    isDeveloperEmail: context.isDeveloperEmail,
  });
  if (handledByAthleteAuth) return true;

  const handledByAthleteBilling = await context.handleAthleteBillingAction(action, {
    element,
    getUiState,
    applyUiPatch,
    finalizeUiChange,
    hydratePage,
    invalidateHydrationCache,
    getAppBridge,
    normalizeCheckoutPlan: context.normalizeCheckoutPlan,
    hasCheckoutAuth,
    queueCheckoutIntent,
    isDeveloperProfile: context.isDeveloperProfile,
  });
  if (handledByAthleteBilling) return true;

  const handledByAthletePage = await context.handleAthleteAccountHistoryAction(action, {
    element,
    root,
    getUiState,
    applyUiState,
    applyUiPatch,
    finalizeUiChange,
    hydratePage,
    shouldHydratePage,
    invalidateHydrationCache,
    getAppBridge,
    maybeResumePendingCheckout: resumePendingCheckout,
    emptyCoachPortal,
    emptyAthleteOverview,
    emptyAdmin,
  });
  if (handledByAthletePage) return true;

  return context.handleAthleteTodayAction(action, {
    element,
    root,
    toast,
    getUiState,
    applyUiState,
    applyUiPatch,
    finalizeUiChange,
    renderUi,
    setUiState,
    getAppBridge,
    readAppState: readAthleteAppState,
    isImportBusy,
    idleImportStatus: context.idleImportStatus,
    guardAthleteImport,
    prepareImportFileForClientUse: context.prepareImportFileForClientUse,
    pickJsonFile: context.pickJsonFile,
    pickPdfFile: context.pickPdfFile,
    pickUniversalFile: context.pickUniversalFile,
    explainImportFailure: context.explainImportFailure,
    formatBytes: context.formatBytes,
    IMPORT_HARD_MAX_BYTES: context.IMPORT_HARD_MAX_BYTES,
    IMAGE_COMPRESS_THRESHOLD_BYTES: context.IMAGE_COMPRESS_THRESHOLD_BYTES,
    IMAGE_TARGET_MAX_BYTES: context.IMAGE_TARGET_MAX_BYTES,
    IMAGE_MAX_DIMENSION: context.IMAGE_MAX_DIMENSION,
    workoutKeyFromAppState: context.workoutKeyFromAppState,
    getActiveLineIdFromUi: context.getActiveLineIdFromUi,
    getLineIdsFromDOM: context.getLineIdsFromDOM,
    pickNextId: context.pickNextId,
    pickPrevId: context.pickPrevId,
    scrollToLine: context.scrollToLine,
    syncAthletePrIfAuthenticated,
    invalidateHydrationCache,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
    cssEscape: context.cssEscape,
    startRestTimer: context.startRestTimer,
    consumeAthleteImport: context.consumeAthleteImport,
  });
}
