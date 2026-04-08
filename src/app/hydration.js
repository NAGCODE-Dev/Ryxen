import { createCoachPortalDomain } from './coachPortalDomain.js';
import { createAthleteOverviewDomain } from './athleteOverviewDomain.js';
import { createEmptyAdminState } from '../../apps/athlete/uiState.js';

export function createHydrationController({
  getUiState,
  patchUiState,
  rerender,
  measureAsync,
  emptyCoachPortal,
  emptyAthleteOverview,
  getProfile,
  getSubscriptionStatus,
  getEntitlements,
  getMyGyms,
  getAthleteSummary,
  getAthleteResultsSummary,
  getAthleteWorkoutsRecent,
}) {
  function getProfileEmail(profile = null) {
    return String(profile?.email || '').trim().toLowerCase();
  }

  function shouldHydratePage(page) {
    return page === 'account' || page === 'history';
  }

  function resolveAuthHydrationOptions(page) {
    if (page === 'account') return { hydrateCoach: true, hydrateSummary: true };
    if (page === 'history') return { hydrateSummary: true, hydrateResults: true };
    return null;
  }

  const coachPortalDomain = createCoachPortalDomain({
    measureAsync,
    emptyCoachPortal,
    getSubscriptionStatus,
    getEntitlements,
    getMyGyms,
  });
  const athleteOverviewDomain = createAthleteOverviewDomain({
    measureAsync,
    emptyAthleteOverview,
    getAthleteSummary,
    getAthleteResultsSummary,
    getAthleteWorkoutsRecent,
  });
  const {
    invalidateCoachCache,
    loadCoachSnapshot,
  } = coachPortalDomain;
  const {
    buildAthleteOverviewPatch,
    invalidateAthleteCache,
    loadAthleteSummaryBlock,
    loadAthleteResultsBlock,
    loadAthleteWorkoutsBlock,
  } = athleteOverviewDomain;

  async function patchAthleteBlock(block, status, partial = null, error = '') {
    await patchUiState((s) => ({
      ...s,
      athleteOverview: buildAthleteOverviewPatch(s?.athleteOverview, partial || undefined, block, status, error),
    }));
    await rerender();
  }

  async function patchCoachBlock(status, partial = null, error = '') {
    await patchUiState((s) => ({
      ...s,
      coachPortal: {
        ...emptyCoachPortal(),
        ...(s?.coachPortal || {}),
        ...(partial || {}),
        status,
        error: error || '',
      },
    }));
    await rerender();
  }

  function invalidateHydrationCache({ coach = true, athlete = true, account = true } = {}) {
    if (coach || account) {
      invalidateCoachCache();
    }
    if (athlete || account) {
      invalidateAthleteCache();
    }
  }

  async function loadAdminSnapshot() {
    return createEmptyAdminState();
  }

  async function hydrateCoachBlock(profile, selectedGymId = null, { force = false } = {}) {
    if (!profile?.email) return emptyCoachPortal();
    const current = getUiState?.()?.coachPortal || {};
    if (!force && current?.status === 'ready' && current?.subscription) return current;
    await patchCoachBlock('loading');
    try {
      const coachPortal = await loadCoachSnapshot(getProfileEmail(profile), selectedGymId, { force });
      await patchCoachBlock('ready', coachPortal);
      return coachPortal;
    } catch (error) {
      const fallback = { ...emptyCoachPortal(), status: 'error', error: error?.message || 'Falha ao carregar portal do coach' };
      await patchCoachBlock('error', fallback, fallback.error);
      return fallback;
    }
  }

  async function hydrateAthleteSummary(profile, { force = false } = {}) {
    if (!profile?.email) return emptyAthleteOverview();
    const current = getUiState?.()?.athleteOverview || {};
    if (!force && current?.blocks?.summary?.status === 'ready' && current?.stats) return current;
    await patchAthleteBlock('summary', 'loading');
    try {
      const summary = await loadAthleteSummaryBlock(getProfileEmail(profile), { force });
      await patchAthleteBlock('summary', 'ready', summary);
      return summary;
    } catch (error) {
      await patchAthleteBlock('summary', 'error', null, error?.message || 'Falha ao carregar resumo');
      return current;
    }
  }

  async function hydrateAthleteResultsBlock(profile, { force = false } = {}) {
    if (!profile?.email) return emptyAthleteOverview();
    const current = getUiState?.()?.athleteOverview || {};
    if (!force && current?.blocks?.results?.status === 'ready' && Array.isArray(current?.benchmarkHistory)) return current;
    await patchAthleteBlock('results', 'loading');
    try {
      const results = await loadAthleteResultsBlock(getProfileEmail(profile), { force });
      await patchAthleteBlock('results', 'ready', results);
      return results;
    } catch (error) {
      await patchAthleteBlock('results', 'error', null, error?.message || 'Falha ao carregar resultados');
      return current;
    }
  }

  async function hydrateAthleteWorkoutsBlock(profile, { force = false } = {}) {
    if (!profile?.email) return emptyAthleteOverview();
    const current = getUiState?.()?.athleteOverview || {};
    if (!force && current?.blocks?.workouts?.status === 'ready') return current;
    await patchAthleteBlock('workouts', 'loading');
    try {
      const workouts = await loadAthleteWorkoutsBlock(getProfileEmail(profile), { force });
      await patchAthleteBlock('workouts', 'ready', workouts);
      return workouts;
    } catch (error) {
      await patchAthleteBlock('workouts', 'error', null, error?.message || 'Falha ao carregar treinos');
      return current;
    }
  }

  async function hydrateAccountSummary(profile, selectedGymId = null, { force = false } = {}) {
    if (!profile?.email) return;
    await Promise.all([
      hydrateCoachBlock(profile, selectedGymId, { force }),
      hydrateAthleteSummary(profile, { force }),
    ]);
  }

  function hydrateAccountLazyBlocks(profile, { force = false } = {}) {
    if (!profile?.email) return;
    Promise.allSettled([
      hydrateAthleteWorkoutsBlock(profile, { force }),
      hydrateAthleteResultsBlock(profile, { force }),
    ]).catch(() => {});
  }

  function hydrateHistoryLazyBlocks(profile, { force = false } = {}) {
    if (!profile?.email) return;
    Promise.resolve()
      .then(() => hydrateAthleteResultsBlock(profile, { force }))
      .catch(() => {});
  }

  async function hydratePage(profile, page, selectedGymId = null, { force = false } = {}) {
    if (!profile?.email) return;
    if (page === 'account') {
      await hydrateAccountSummary(profile, selectedGymId, { force });
      hydrateAccountLazyBlocks(profile, { force });
      return;
    }
    if (page === 'history') {
      await hydrateAthleteSummary(profile, { force });
      hydrateHistoryLazyBlocks(profile, { force });
    }
  }

  async function loadAccountSnapshot(profile, selectedGymId, options = {}) {
    const nextState = {
      coachPortal: { ...emptyCoachPortal(), status: 'idle', error: '' },
      athleteOverview: emptyAthleteOverview(),
      admin: await loadAdminSnapshot(),
    };

    if (!profile?.email) return nextState;

    if (options.includeCoach !== false) {
      nextState.coachPortal = await loadCoachSnapshot(getProfileEmail(profile), selectedGymId, { force: !!options.force });
    }

    if (options.includeAthlete !== false) {
      const summary = await loadAthleteSummaryBlock(getProfileEmail(profile), { force: !!options.force });
      nextState.athleteOverview = buildAthleteOverviewPatch(nextState.athleteOverview, summary, 'summary', 'ready');
      if (options.includeAthleteResults) {
        const results = await loadAthleteResultsBlock(getProfileEmail(profile), { force: !!options.force });
        nextState.athleteOverview = buildAthleteOverviewPatch(nextState.athleteOverview, results, 'results', 'ready');
      }
    }

    return nextState;
  }

  async function hydrateAccountSnapshotInBackground(profile, selectedGymId = null, options = {}) {
    const page = options.page || getUiState?.()?.currentPage || 'today';
    return hydratePage(profile, page, selectedGymId, { force: !!options.force });
  }

  async function hydrateAthleteOverviewFullInBackground(profile = null, options = {}) {
    const targetProfile = profile || getProfile();
    return hydrateAthleteResultsBlock(targetProfile, { force: !!options.force });
  }

  return {
    shouldHydratePage,
    resolveAuthHydrationOptions,
    invalidateHydrationCache,
    loadCoachSnapshot,
    loadAdminSnapshot,
    loadAccountSnapshot,
    hydratePage,
    hydrateCoachBlock,
    hydrateAccountSummary,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
    hydrateAthleteWorkoutsBlock,
    hydrateAccountLazyBlocks,
    hydrateHistoryLazyBlocks,
    hydrateAccountSnapshotInBackground,
    hydrateAthleteOverviewFullInBackground,
  };
}
