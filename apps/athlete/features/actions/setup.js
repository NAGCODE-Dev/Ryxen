import { isDeveloperEmail, isDeveloperProfile } from '../../../../src/core/utils/devAccess.js';
import {
  canConsumeAthleteImport,
  consumeAthleteImport,
  getAthleteImportUsage,
  normalizeAthleteBenefits,
} from '../../../../src/core/services/athleteBenefitUsage.js';
import {
  consumeCheckoutIntent,
  hasCheckoutAuth,
  queueCheckoutIntent,
} from '../../../../src/core/services/subscriptionService.js';
import { getAppBridge } from '../../../../src/app/bridge.js';
import {
  handleAthleteAccountHistoryAction,
  handleAthleteAuthAction,
  handleAthleteAuthEnterKey,
  handleAthleteBillingAction,
} from '../account/actions.js';
import {
  handleAthleteModalAction,
  handleAthleteModalEscapeKey,
  handleAthleteModalOverlayClick,
} from '../../actions/modalActions.js';
import {
  handleAthleteTodayAction,
  handleAthleteTodayChange,
} from '../today/actions.js';
import { filterAthletePrs } from '../prs/services.js';
import { handleExerciseHelpAction } from './router.js';
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
} from '../import/services.js';
import {
  createAthleteImportGuard,
  createImportBusyChecker,
} from '../import/guards.js';
import {
  cssEscape,
  getActiveLineIdFromUi,
  getLineIdsFromDOM,
  pickNextId,
  pickPrevId,
  scrollToLine,
  startRestTimer,
  workoutKeyFromAppState,
} from '../today/services.js';
import {
  createEmptyAdminState,
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from '../../state/uiState.js';
import {
  maybeResumePendingCheckout,
  normalizeCheckoutPlan,
} from '../account/services.js';
import { createAthleteHydrationBindings } from '../account/services.js';
import { measureUiAsync } from '../account/metrics.js';
import { createGoogleSignInHelpers } from '../account/googleSignIn.js';
import {
  createAthleteUiActions,
  queueAthleteCheckoutBootstrap,
  readAthleteAppState,
  routeAthleteClickAction,
} from './setupHelpers.js';

export function setupAthleteActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');
  let ensureGoogleSignInUi = async () => {};

  const {
    renderUi,
    finalizeUiChange,
    applyUiState,
    applyUiPatch,
  } = createAthleteUiActions({
    root,
    toast,
    rerender,
    setUiState,
    patchUiState,
    getEnsureGoogleSignInUi: () => ensureGoogleSignInUi,
  });

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
  ({ ensureGoogleSignInUi } = createGoogleSignInHelpers({
    root,
    getUiState,
    getAppBridge,
    applyUiState,
    toast,
    invalidateHydrationCache,
    shouldHydratePage,
    hydratePage,
    resumePendingCheckout,
  }));

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
      const handled = await routeAthleteClickAction(action, {
        element: el,
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
        emptyCoachPortal: createEmptyCoachPortalState,
        emptyAthleteOverview: createEmptyAthleteOverviewState,
        emptyAdmin: createEmptyAdminState,
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

  queueAthleteCheckoutBootstrap({
    applyUiPatch,
    getEnsureGoogleSignInUi: () => ensureGoogleSignInUi,
    maybeResumePendingCheckout: resumePendingCheckout,
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
