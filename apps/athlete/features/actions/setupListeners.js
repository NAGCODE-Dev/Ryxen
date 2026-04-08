import { getAppBridge } from '../../../../src/app/bridge.js';
import { registerAthleteClickListeners } from './setupClickListener.js';

export function registerAthleteInputListeners({ root, filterAthletePrs }) {
  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!target || target.id !== 'ui-prsSearch') return;
    filterAthletePrs(root, target.value);
  });
}

export function registerAthleteAuthKeyListeners({ root, getUiState, handleAthleteAuthEnterKey }) {
  root.addEventListener('keydown', async (event) => {
    handleAthleteAuthEnterKey(event, {
      root,
      getUiState,
    });
  });

  root.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!target?.closest?.('#ui-authForm')) return;
    if (target.tagName === 'BUTTON' || target.type === 'button') return;
    event.preventDefault();

    handleAthleteAuthEnterKey(event, {
      root,
      getUiState,
    });
  });
}

export function registerAthleteChangeListeners({
  root,
  toast,
  applyUiPatch,
  finalizeUiChange,
  handleAthleteTodayChange,
}) {
  root.addEventListener('change', async (event) => {
    await handleAthleteTodayChange(event, {
      root,
      toast,
      applyUiPatch,
      finalizeUiChange,
      getAppBridge,
    });
  });
}

export function registerAthleteModalListeners({
  root,
  toast,
  getUiState,
  applyUiPatch,
  isImportBusy,
  handleAthleteModalOverlayClick,
  handleAthleteModalEscapeKey,
}) {
  root.addEventListener('click', async (event) => {
    await handleAthleteModalOverlayClick(event, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });

  document.addEventListener('keydown', async (event) => {
    await handleAthleteModalEscapeKey(event, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });
}

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
