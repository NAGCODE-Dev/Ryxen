import { getAppBridge } from '../../../../src/app/bridge.js';
import { createGoogleSignInHelpers } from '../account/googleSignIn.js';

export function createAthleteGoogleBindings({
  root,
  getUiState,
  applyUiState,
  toast,
  invalidateHydrationCache,
  shouldHydratePage,
  hydratePage,
  resumePendingCheckout,
}) {
  return createGoogleSignInHelpers({
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
}
