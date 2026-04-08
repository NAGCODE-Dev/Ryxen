import {
  consumeCheckoutIntent,
  hasCheckoutAuth,
  queueCheckoutIntent,
} from '../../../../src/core/services/subscriptionService.js';
import { getAppBridge } from '../../../../src/app/bridge.js';
import {
  maybeResumePendingCheckout,
} from '../account/services.js';
import { createAthleteHydrationBindings } from '../account/services.js';
import { measureUiAsync } from '../account/metrics.js';

export function createAthleteSetupFlowBindings({
  getUiState,
  patchUiState,
  renderUi,
  toast,
  emptyCoachPortal,
  emptyAthleteOverview,
}) {
  const hydration = createAthleteHydrationBindings({
    getUiState,
    patchUiState,
    rerender: renderUi,
    measureAsync: measureUiAsync,
    emptyCoachPortal,
    emptyAthleteOverview,
    getAppBridge,
  });

  const resumePendingCheckout = () => maybeResumePendingCheckout({
    consumeCheckoutIntent,
    hasCheckoutAuth,
    getAppBridge,
    toast,
    queueCheckoutIntent,
  });

  return {
    ...hydration,
    resumePendingCheckout,
  };
}
