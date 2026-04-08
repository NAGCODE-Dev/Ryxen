import {
  handleAthleteAuthEnterKey,
  handleAthleteModalEscapeKey,
  handleAthleteModalOverlayClick,
} from '../../actions/modalActions.js';
import {
  handleAthleteTodayChange,
} from '../today/actions.js';
import { filterAthletePrs } from '../prs/services.js';
import { createAthleteSetupBindings } from './setupBindings.js';
import { queueAthleteCheckoutBootstrap } from './setupBootstrap.js';
import {
  registerAthleteSetupListeners,
} from './setupListeners.js';

export function setupAthleteActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');
  const {
    finalizeUiChange,
    applyUiPatch,
    isImportBusy,
    resumePendingCheckout,
    clickContext,
    routeAthleteClickAction,
    getEnsureGoogleSignInUi,
  } = createAthleteSetupBindings({
    root,
    toast,
    rerender,
    getUiState,
    setUiState,
    patchUiState,
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
    getEnsureGoogleSignInUi,
    maybeResumePendingCheckout: resumePendingCheckout,
  });
}
