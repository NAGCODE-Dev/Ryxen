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
import {
  routeAthleteAuthClick,
  routeAthleteBillingClick,
  routeAthleteModalClick,
  routeAthletePageClick,
  routeAthleteTodayClick,
} from './clickRoutes.js';

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

  const handledByAthleteModal = await routeAthleteModalClick(action, context);
  if (handledByAthleteModal) return true;

  const handledByAthleteAuth = await routeAthleteAuthClick(action, context);
  if (handledByAthleteAuth) return true;

  const handledByAthleteBilling = await routeAthleteBillingClick(action, context);
  if (handledByAthleteBilling) return true;

  const handledByAthletePage = await routeAthletePageClick(action, context);
  if (handledByAthletePage) return true;

  return routeAthleteTodayClick(action, {
    ...context,
    readAppState: readAthleteAppState,
  });
}
