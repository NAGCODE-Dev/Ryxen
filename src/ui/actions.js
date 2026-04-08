import { isDeveloperEmail, isDeveloperProfile } from '../core/utils/devAccess.js';
import {
  canConsumeAthleteImport,
  consumeAthleteImport,
  getAthleteImportUsage,
  normalizeAthleteBenefits,
} from '../core/services/athleteBenefitUsage.js';
import {
  consumeCheckoutIntent,
  hasCheckoutAuth,
  peekCheckoutIntent,
  queueCheckoutIntent,
} from '../core/services/subscriptionService.js';
import { getAppBridge } from '../app/bridge.js';
import {
  handleAthleteAccountHistoryAction,
  handleAthleteAuthAction,
  handleAthleteAuthEnterKey,
  handleAthleteBillingAction,
} from '../../apps/athlete/features/account/actions.js';
import {
  handleAthleteModalAction,
  handleAthleteModalEscapeKey,
  handleAthleteModalOverlayClick,
} from '../../apps/athlete/actions/modalActions.js';
import {
  handleAthleteTodayAction,
  handleAthleteTodayChange,
} from '../../apps/athlete/features/today/actions.js';
import { filterAthletePrs } from '../../apps/athlete/features/prs/services.js';
import { handleExerciseHelpAction } from '../../apps/athlete/features/actions/router.js';
import {
  explainImportFailure,
  formatBytes,
  idleImportStatus,
  IMAGE_COMPRESS_THRESHOLD_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_TARGET_MAX_BYTES,
  IMPORT_HARD_MAX_BYTES,
  pickJsonFile,
  pickPdfFile,
  pickUniversalFile,
  prepareImportFileForClientUse,
} from '../../apps/athlete/features/import/services.js';
import {
  createAthleteImportGuard,
  createImportBusyChecker,
} from '../../apps/athlete/features/import/guards.js';
import {
  cssEscape,
  getActiveLineIdFromUi,
  getLineIdsFromDOM,
  pickNextId,
  pickPrevId,
  scrollToLine,
  startRestTimer,
  workoutKeyFromAppState,
} from '../../apps/athlete/features/today/services.js';
import {
  createEmptyAdminState,
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from '../../apps/athlete/state/uiState.js';
import {
  maybePrimeCheckoutIntentFromUrl,
  maybeResumePendingCheckout,
  normalizeCheckoutPlan,
} from '../../apps/athlete/features/account/services.js';
import { createAthleteHydrationBindings } from '../../apps/athlete/features/account/services.js';
import { measureUiAsync } from '../../apps/athlete/features/account/metrics.js';
import { createGoogleSignInHelpers } from '../../apps/athlete/features/account/googleSignIn.js';

export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');

  const readAppState = () => {
    try {
      if (getAppBridge()?.getStateSnapshot) return getAppBridge().getStateSnapshot();
      if (getAppBridge()?.getState) return getAppBridge().getState();
      return {};
    } catch {
      return {};
    }
  };

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
    if (ensureGoogle) await ensureGoogleSignInUi();
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

  const guardAthleteImport = createAthleteImportGuard({
    getAppBridge,
    normalizeAthleteBenefits,
    getAthleteImportUsage,
    canConsumeAthleteImport,
  });
  const isImportBusy = createImportBusyChecker(getUiState);

  const hydration = createAthleteHydrationBindings({
    getUiState,
    patchUiState,
    rerender: renderUi,
    measureAsync: measureUiAsync,
    emptyCoachPortal: createEmptyCoachPortalState,
    emptyAthleteOverview: createEmptyAthleteOverviewState,
    getAppBridge,
  });
  const {
    shouldHydratePage,
    invalidateHydrationCache,
    hydratePage,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
    syncAthletePrIfAuthenticated,
  } = hydration;
  const resumePendingCheckout = () => maybeResumePendingCheckout({
    consumeCheckoutIntent,
    hasCheckoutAuth,
    getAppBridge,
    toast,
    queueCheckoutIntent,
  });
  const { ensureGoogleSignInUi } = createGoogleSignInHelpers({
    root,
    getUiState,
    getAppBridge,
    applyUiState,
    toast,
    invalidateHydrationCache,
    shouldHydratePage,
    hydratePage,
    resumePendingCheckout,
  });

  // Busca de PRs (filtra em tempo real)
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || t.id !== 'ui-prsSearch') return;
    filterAthletePrs(root, t.value);
  });

  root.addEventListener('keydown', async (e) => {
    handleAthleteAuthEnterKey(e, {
      root,
      getUiState,
    });
  });

  // Clicks (delegação)
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    try {
      if (action === 'exercise:help') {
        handleExerciseHelpAction(el);
        return;
      }

      const handledByAthleteModal = await handleAthleteModalAction(action, {
        element: el,
        toast,
        getUiState,
        applyUiState,
        applyUiPatch,
        isImportBusy,
      });
      if (handledByAthleteModal) return;

      const handledByAthleteAuth = await handleAthleteAuthAction(action, {
        element: el,
        root,
        getUiState,
        applyUiState,
        applyUiPatch,
        getAppBridge,
        invalidateHydrationCache,
        shouldHydratePage,
        hydratePage,
        maybeResumePendingCheckout: resumePendingCheckout,
        isDeveloperEmail,
      });
      if (handledByAthleteAuth) return;

      const handledByAthleteBilling = await handleAthleteBillingAction(action, {
        element: el,
        getUiState,
        applyUiPatch,
        finalizeUiChange,
        hydratePage,
        invalidateHydrationCache,
        getAppBridge,
        normalizeCheckoutPlan,
        hasCheckoutAuth,
        queueCheckoutIntent,
        isDeveloperProfile,
      });
      if (handledByAthleteBilling) return;

      const handledByAthletePage = await handleAthleteAccountHistoryAction(action, {
        element: el,
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
        emptyCoachPortal: createEmptyCoachPortalState,
        emptyAthleteOverview: createEmptyAthleteOverviewState,
        emptyAdmin: createEmptyAdminState,
      });
      if (handledByAthletePage) return;

      const handledByAthleteToday = await handleAthleteTodayAction(action, {
        element: el,
        root,
        toast,
        getUiState,
        applyUiState,
        applyUiPatch,
        finalizeUiChange,
        renderUi,
        setUiState,
        getAppBridge,
        readAppState,
        isImportBusy,
        idleImportStatus,
        guardAthleteImport,
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
        syncAthletePrIfAuthenticated,
        invalidateHydrationCache,
        hydrateAthleteSummary,
        hydrateAthleteResultsBlock,
        cssEscape,
        startRestTimer,
        consumeAthleteImport,
      });
      if (handledByAthleteToday) return;
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  // Dia manual (select)
  root.addEventListener('change', async (e) => {
    await handleAthleteTodayChange(e, {
      root,
      toast,
      applyUiPatch,
      finalizeUiChange,
      getAppBridge,
    });
  });

  queueMicrotask(async () => {
    try {
      await maybePrimeCheckoutIntentFromUrl({
        getAppBridge,
        hasCheckoutAuth,
        queueCheckoutIntent,
        normalizeCheckoutPlan,
        maybeResumePendingCheckout: resumePendingCheckout,
        applyUiPatch,
      });
      await ensureGoogleSignInUi();
      if (peekCheckoutIntent() && hasCheckoutAuth() && getAppBridge()?.getProfile?.()?.data?.email) {
        await resumePendingCheckout();
      }
    } catch (error) {
      console.warn('Falha ao preparar checkout pendente:', error?.message || error);
    }
  });

  // Clique fora do modal fecha
  root.addEventListener('click', async (e) => {
    await handleAthleteModalOverlayClick(e, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });

  // Esc fecha modal
  document.addEventListener('keydown', async (e) => {
    await handleAthleteModalEscapeKey(e, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });

  root.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target?.closest?.('#ui-authForm')) return;
    if (target.tagName === 'BUTTON' || target.type === 'button') return;
    e.preventDefault();

    handleAthleteAuthEnterKey(e, {
      root,
      getUiState,
    });
  });
}
