import { isDeveloperEmail, isDeveloperProfile } from '../../../../src/core/utils/devAccess.js';
import { consumeAthleteImport } from '../../../../src/core/services/athleteBenefitUsage.js';
import {
  handleAthleteAccountHistoryAction,
  handleAthleteAuthAction,
  handleAthleteBillingAction,
} from '../account/actions.js';
import { normalizeCheckoutPlan } from '../account/services.js';
import { handleAthleteModalAction } from '../../actions/modalActions.js';
import { handleAthleteTodayAction } from '../today/actions.js';
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
import { handleExerciseHelpAction } from './router.js';
import { createAthleteClickContext } from './setupClickContext.js';
import { routeAthleteClickAction } from './setupHelpers.js';

export function createAthleteSetupClickBindings({
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
}) {
  return {
    routeAthleteClickAction,
    clickContext: createAthleteClickContext({
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
    }),
  };
}
