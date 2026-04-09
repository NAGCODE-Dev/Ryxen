import { registerAthleteAuthKeyListeners } from './setupAuthKeyListeners.js';
import { registerAthleteChangeListeners } from './setupChangeListeners.js';
import { registerAthleteClickListeners } from './setupClickListener.js';
import { registerAthleteInputListeners } from './setupInputListeners.js';
import { registerAthleteModalListeners } from './setupModalListeners.js';

export function registerAthleteSetupListeners({
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
}) {
  registerAthleteInputListeners({
    root,
    filterAthletePrs,
  });

  registerAthleteAuthKeyListeners({
    root,
    getUiState,
    handleAthleteAuthEnterKey,
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
    getUiState,
    applyUiPatch,
    finalizeUiChange,
    handleAthleteTodayChange,
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
