import { createHydrationController } from '../../../src/app/hydration.js';

export function createAthleteHydrationBindings(deps) {
  const {
    getUiState,
    patchUiState,
    rerender,
    measureAsync,
    emptyCoachPortal,
    emptyAthleteOverview,
    getAppBridge,
  } = deps;

  const hydration = createHydrationController({
    getUiState,
    patchUiState,
    rerender,
    measureAsync,
    emptyCoachPortal,
    emptyAthleteOverview,
    getProfile: () => getAppBridge()?.getProfile?.()?.data || null,
    getSubscriptionStatus: () => getAppBridge()?.getSubscriptionStatus?.(),
    getEntitlements: () => getAppBridge()?.getEntitlements?.(),
    getMyGyms: () => getAppBridge()?.getMyGyms?.(),
    getAthleteSummary: () => getAppBridge()?.getAthleteSummary?.(),
    getAthleteResultsSummary: () => getAppBridge()?.getAthleteResultsSummary?.(),
    getAthleteWorkoutsRecent: () => getAppBridge()?.getAthleteWorkoutsRecent?.(),
  });

  async function syncAthletePrIfAuthenticated() {
    const profile = getAppBridge()?.getProfile?.()?.data || null;
    if (!profile?.email) return null;

    try {
      const currentPrs = getAppBridge()?.getState?.()?.prs || {};
      const syncResult = await getAppBridge()?.syncAthletePrSnapshot?.(currentPrs);
      const syncQueued = Boolean(syncResult?.queued) || !navigator.onLine;
      if (!syncQueued) {
        hydration.invalidateHydrationCache({ coach: false, athlete: true, account: true });
        await hydration.hydrateAthleteSummary(profile, { force: true });
        await hydration.hydrateAthleteResultsBlock(profile, { force: true });
      }
      return getUiState?.()?.athleteOverview || null;
    } catch {
      return null;
    }
  }

  return {
    ...hydration,
    syncAthletePrIfAuthenticated,
  };
}
