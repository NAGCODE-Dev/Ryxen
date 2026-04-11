import { getAppBridge } from '../../../../src/app/bridge.js';

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
    ...nextUiState
  } = {}) {
    const {
    render = true,
    toastMessage = '',
    ensureGoogle = false,
    focusSelector = '',
    } = nextUiState;
    const uiPatch = { ...nextUiState };
    delete uiPatch.render;
    delete uiPatch.toastMessage;
    delete uiPatch.ensureGoogle;
    delete uiPatch.focusSelector;

    if (Object.keys(uiPatch).length) {
      await setUiState(uiPatch);
    }
    if (toastMessage) toast(toastMessage);
    if (render) await renderUi();
    if (ensureGoogle) await getEnsureGoogleSignInUi?.()?.();
    if (focusSelector) {
      const focusTarget = root.querySelector(focusSelector);
      if (focusTarget?.scrollIntoView) {
        focusTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
      if (focusTarget?.focus) {
        focusTarget.focus({ preventScroll: true });
      }
    }
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
