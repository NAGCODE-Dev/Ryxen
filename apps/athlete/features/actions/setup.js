import {
  handleAthleteAuthEnterKey,
  handleAthleteModalEscapeKey,
  handleAthleteModalOverlayClick,
} from '../../actions/modalActions.js';
import {
  handleAthleteTodayChange,
} from '../today/actions.js';
import { filterAthletePrs } from '../prs/services.js';
import {
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from '../../state/uiState.js';
import { queueAthleteCheckoutBootstrap } from './setupBootstrap.js';
import { createAthleteSetupClickBindings } from './setupClickBindings.js';
import { createAthleteSetupFlowBindings } from './setupFlowBindings.js';
import { createAthleteGoogleBindings } from './setupGoogleBindings.js';
import { createAthleteImportBindings } from './setupImportBindings.js';
import {
  registerAthleteSetupListeners,
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

  registerAthleteSetupListeners({
    root,
    toast,
    getUiState,
    filterAthletePrs,
    handleAthleteAuthEnterKey,
    clickContext,
    routeAthleteClickAction,
    applyUiPatch,
    finalizeUiChange,
    handleAthleteTodayChange,
    isImportBusy,
    handleAthleteModalOverlayClick,
    handleAthleteModalEscapeKey,
  });

  queueAthleteCheckoutBootstrap({
    applyUiPatch,
    getEnsureGoogleSignInUi: () => ensureGoogleSignInUi,
    maybeResumePendingCheckout: resumePendingCheckout,
  });
}
