import { isDeveloperEmail, isDeveloperProfile } from '../../../../src/core/utils/devAccess.js';
import { consumeAthleteImport } from '../../../../src/core/services/athleteBenefitUsage.js';
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
  normalizeCheckoutPlan,
} from '../account/services.js';
import { createGoogleSignInHelpers } from '../account/googleSignIn.js';
import {
  routeAthleteClickAction,
} from './setupHelpers.js';
import { createAthleteClickContext } from './setupClickContext.js';
import { queueAthleteCheckoutBootstrap } from './setupBootstrap.js';
import { createAthleteSetupFlowBindings } from './setupFlowBindings.js';
import { createAthleteImportBindings } from './setupImportBindings.js';
import {
  registerAthleteAuthKeyListeners,
  registerAthleteChangeListeners,
  registerAthleteClickListeners,
  registerAthleteInputListeners,
  registerAthleteModalListeners,
} from './setupListeners.js';
import { createAthleteUiActions } from './setupUiHelpers.js';

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

  const { guardAthleteImport, isImportBusy } = createAthleteImportBindings({ getUiState });

  const {
    shouldHydratePage,
    invalidateHydrationCache,
    hydratePage,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
    syncAthletePrIfAuthenticated,
    resumePendingCheckout,
  } = createAthleteSetupFlowBindings({
    getUiState,
    patchUiState,
    toast,
    renderUi,
    emptyCoachPortal: createEmptyCoachPortalState,
    emptyAthleteOverview: createEmptyAthleteOverviewState,
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

  registerAthleteInputListeners({
    root,
    filterAthletePrs,
  });

  registerAthleteAuthKeyListeners({
    root,
    getUiState,
    handleAthleteAuthEnterKey,
  });

  const clickContext = createAthleteClickContext({
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

  registerAthleteClickListeners({
    root,
    toast,
    clickContext,
    routeAthleteClickAction,
  });

  registerAthleteChangeListeners({
    root,
    toast,
    applyUiPatch,
    finalizeUiChange,
    handleAthleteTodayChange,
  });

  queueAthleteCheckoutBootstrap({
    applyUiPatch,
    getEnsureGoogleSignInUi: () => ensureGoogleSignInUi,
    maybeResumePendingCheckout: resumePendingCheckout,
  });

  registerAthleteModalListeners({
    root,
    toast,
    getUiState,
    applyUiPatch,
    isImportBusy,
    handleAthleteModalOverlayClick,
    handleAthleteModalEscapeKey,
  });
}
