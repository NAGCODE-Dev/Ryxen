import {
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from '../../state/uiState.js';
import { createAthleteSetupClickBindings } from './setupClickBindings.js';
import { createAthleteSetupFlowBindings } from './setupFlowBindings.js';
import { createAthleteGoogleBindings } from './setupGoogleBindings.js';
import { createAthleteImportBindings } from './setupImportBindings.js';
import { createAthleteUiActions } from './setupUiHelpers.js';

export function createAthleteSetupBindings({
  root,
  toast,
  rerender,
  getUiState,
  setUiState,
  patchUiState,
}) {
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

  ({ ensureGoogleSignInUi } = createAthleteGoogleBindings({
    root,
    getUiState,
    applyUiState,
    toast,
    invalidateHydrationCache,
    shouldHydratePage,
    hydratePage,
    resumePendingCheckout,
  }));

  const { clickContext, routeAthleteClickAction } = createAthleteSetupClickBindings({
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
  });

  return {
    finalizeUiChange,
    applyUiPatch,
    isImportBusy,
    resumePendingCheckout,
    clickContext,
    routeAthleteClickAction,
    getEnsureGoogleSignInUi: () => ensureGoogleSignInUi,
  };
}
