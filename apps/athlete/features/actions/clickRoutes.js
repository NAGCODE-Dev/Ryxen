import {
  hasCheckoutAuth,
  queueCheckoutIntent,
} from '../../../../src/core/services/subscriptionService.js';
import { getAppBridge } from '../../../../src/app/bridge.js';

export async function routeAthleteModalClick(action, context) {
  return context.handleAthleteModalAction(action, {
    element: context.element,
    toast: context.toast,
    getUiState: context.getUiState,
    applyUiState: context.applyUiState,
    applyUiPatch: context.applyUiPatch,
    isImportBusy: context.isImportBusy,
  });
}

export async function routeAthleteAuthClick(action, context) {
  return context.handleAthleteAuthAction(action, {
    element: context.element,
    root: context.root,
    getUiState: context.getUiState,
    applyUiState: context.applyUiState,
    applyUiPatch: context.applyUiPatch,
    getAppBridge,
    invalidateHydrationCache: context.invalidateHydrationCache,
    shouldHydratePage: context.shouldHydratePage,
    hydratePage: context.hydratePage,
    maybeResumePendingCheckout: context.resumePendingCheckout,
    isDeveloperEmail: context.isDeveloperEmail,
  });
}

export async function routeAthleteBillingClick(action, context) {
  return context.handleAthleteBillingAction(action, {
    element: context.element,
    getUiState: context.getUiState,
    applyUiPatch: context.applyUiPatch,
    finalizeUiChange: context.finalizeUiChange,
    hydratePage: context.hydratePage,
    invalidateHydrationCache: context.invalidateHydrationCache,
    getAppBridge,
    normalizeCheckoutPlan: context.normalizeCheckoutPlan,
    hasCheckoutAuth,
    queueCheckoutIntent,
    isDeveloperProfile: context.isDeveloperProfile,
  });
}

export async function routeAthletePageClick(action, context) {
  return context.handleAthleteAccountHistoryAction(action, {
    element: context.element,
    root: context.root,
    getUiState: context.getUiState,
    applyUiState: context.applyUiState,
    applyUiPatch: context.applyUiPatch,
    finalizeUiChange: context.finalizeUiChange,
    hydratePage: context.hydratePage,
    shouldHydratePage: context.shouldHydratePage,
    invalidateHydrationCache: context.invalidateHydrationCache,
    getAppBridge,
    maybeResumePendingCheckout: context.resumePendingCheckout,
    emptyCoachPortal: context.emptyCoachPortal,
    emptyAthleteOverview: context.emptyAthleteOverview,
    emptyAdmin: context.emptyAdmin,
  });
}

export async function routeAthleteTodayClick(action, context) {
  return context.handleAthleteTodayAction(action, {
    element: context.element,
    root: context.root,
    toast: context.toast,
    getUiState: context.getUiState,
    applyUiState: context.applyUiState,
    applyUiPatch: context.applyUiPatch,
    finalizeUiChange: context.finalizeUiChange,
    renderUi: context.renderUi,
    setUiState: context.setUiState,
    getAppBridge,
    readAppState: context.readAppState,
    isImportBusy: context.isImportBusy,
    idleImportStatus: context.idleImportStatus,
    guardAthleteImport: context.guardAthleteImport,
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
    syncAthletePrIfAuthenticated: context.syncAthletePrIfAuthenticated,
    invalidateHydrationCache: context.invalidateHydrationCache,
    hydrateAthleteSummary: context.hydrateAthleteSummary,
    hydrateAthleteResultsBlock: context.hydrateAthleteResultsBlock,
    cssEscape: context.cssEscape,
    startRestTimer: context.startRestTimer,
    consumeAthleteImport: context.consumeAthleteImport,
  });
}
