function createTimedCache() {
  return { key: '', value: null, task: null, at: 0 };
}

function isFresh(cache, key, maxAgeMs) {
  return cache.key === key && cache.value && (Date.now() - cache.at) < maxAgeMs;
}

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
  let coachCache = createTimedCache();
  let athleteSummaryCache = createTimedCache();
  let athleteResultsCache = createTimedCache();
  let athleteWorkoutsCache = createTimedCache();

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

  function emptyBlockState() {
    return { status: 'idle', error: '' };
  }

  function buildAthleteOverviewPatch(currentOverview, partial = {}, block, status = 'ready', error = '') {
    const current = currentOverview && typeof currentOverview === 'object'
      ? currentOverview
      : emptyAthleteOverview();
    const nextBlocks = {
      summary: emptyBlockState(),
      results: emptyBlockState(),
      workouts: emptyBlockState(),
      ...(current.blocks || {}),
    };
    if (block) {
      nextBlocks[block] = { status, error: error || '' };
    }

    const next = {
      ...current,
      ...partial,
      blocks: nextBlocks,
    };

    const summaryReady = nextBlocks.summary.status === 'ready';
    const resultsReady = nextBlocks.results.status === 'ready';
    next.detailLevel = resultsReady ? 'full' : (summaryReady ? 'lite' : 'none');

    if (!Array.isArray(next.recentResults)) next.recentResults = [];
    if (!Array.isArray(next.recentWorkouts)) next.recentWorkouts = [];
    if (!Array.isArray(next.benchmarkHistory)) next.benchmarkHistory = [];
    if (!Array.isArray(next.prHistory)) next.prHistory = [];
    if (!Array.isArray(next.measurements)) next.measurements = [];
    if (!Array.isArray(next.runningHistory)) next.runningHistory = [];
    if (!Array.isArray(next.strengthHistory)) next.strengthHistory = [];
    if (!Array.isArray(next.gymAccess)) next.gymAccess = [];
    if (!next.prCurrent || typeof next.prCurrent !== 'object') next.prCurrent = {};
    if (!next.athleteBenefits || typeof next.athleteBenefits !== 'object') next.athleteBenefits = null;

    return next;
  }

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
      coachCache = createTimedCache();
    }
    if (athlete || account) {
      athleteSummaryCache = createTimedCache();
      athleteResultsCache = createTimedCache();
      athleteWorkoutsCache = createTimedCache();
    }
  }

  async function loadCoachSnapshot(profile, selectedGymId, { force = false } = {}) {
    const email = getProfileEmail(profile);
    if (!email) {
      return { ...emptyCoachPortal(), status: 'ready', error: '' };
    }

    const cacheKey = `${email}::${selectedGymId || 'default'}`;
    if (!force && isFresh(coachCache, cacheKey, 15000)) return coachCache.value;
    if (!force && coachCache.key === cacheKey && coachCache.task) return coachCache.task;

    coachCache.key = cacheKey;
    coachCache.task = (async () => {
      const [subscriptionResult, entitlementsResult, gymsResult] = await Promise.all([
        measureAsync('account.subscription', () => getSubscriptionStatus()),
        measureAsync('account.entitlements', () => getEntitlements()),
        measureAsync('account.gyms', () => getMyGyms()),
      ]);

      const gyms = gymsResult?.data?.gyms || [];
      const value = {
        subscription: subscriptionResult?.data || null,
        entitlements: entitlementsResult?.data?.entitlements || [],
        gymAccess: entitlementsResult?.data?.gymAccess || [],
        gyms,
        selectedGymId: selectedGymId || gyms[0]?.id || null,
        status: 'ready',
        error: '',
      };
      coachCache = { key: cacheKey, value, task: null, at: Date.now() };
      return value;
    })();

    return coachCache.task;
  }

  async function loadAthleteSummaryBlock(profile, { force = false } = {}) {
    const email = getProfileEmail(profile);
    if (!email) {
      return {
        stats: null,
        athleteBenefits: null,
        personalSubscription: null,
        gymAccess: [],
      };
    }
    const cacheKey = `${email}::summary`;
    if (!force && isFresh(athleteSummaryCache, cacheKey, 15000)) return athleteSummaryCache.value;
    if (!force && athleteSummaryCache.key === cacheKey && athleteSummaryCache.task) return athleteSummaryCache.task;

    athleteSummaryCache.key = cacheKey;
    athleteSummaryCache.task = (async () => {
      const result = await measureAsync('account.summary', () => getAthleteSummary());
      const value = result?.data || {
        stats: null,
        athleteBenefits: null,
        personalSubscription: null,
        gymAccess: [],
      };
      athleteSummaryCache = { key: cacheKey, value, task: null, at: Date.now() };
      return value;
    })();
    return athleteSummaryCache.task;
  }

  async function loadAthleteResultsBlock(profile, { force = false } = {}) {
    const email = getProfileEmail(profile);
    if (!email) {
      return {
        recentResults: [],
        benchmarkHistory: [],
        prHistory: [],
        prCurrent: {},
        measurements: [],
        runningHistory: [],
        strengthHistory: [],
      };
    }
    const cacheKey = `${email}::results`;
    if (!force && isFresh(athleteResultsCache, cacheKey, 15000)) return athleteResultsCache.value;
    if (!force && athleteResultsCache.key === cacheKey && athleteResultsCache.task) return athleteResultsCache.task;

    athleteResultsCache.key = cacheKey;
    athleteResultsCache.task = (async () => {
      const result = await measureAsync('account.results', () => getAthleteResultsSummary());
      const value = result?.data || {
        recentResults: [],
        benchmarkHistory: [],
        prHistory: [],
        prCurrent: {},
        measurements: [],
        runningHistory: [],
        strengthHistory: [],
      };
      athleteResultsCache = { key: cacheKey, value, task: null, at: Date.now() };
      return value;
    })();
    return athleteResultsCache.task;
  }

  async function loadAthleteWorkoutsBlock(profile, { force = false } = {}) {
    const email = getProfileEmail(profile);
    if (!email) return { recentWorkouts: [] };
    const cacheKey = `${email}::workouts`;
    if (!force && isFresh(athleteWorkoutsCache, cacheKey, 15000)) return athleteWorkoutsCache.value;
    if (!force && athleteWorkoutsCache.key === cacheKey && athleteWorkoutsCache.task) return athleteWorkoutsCache.task;

    athleteWorkoutsCache.key = cacheKey;
    athleteWorkoutsCache.task = (async () => {
      const result = await measureAsync('account.workouts', () => getAthleteWorkoutsRecent());
      const value = result?.data || { recentWorkouts: [] };
      athleteWorkoutsCache = { key: cacheKey, value, task: null, at: Date.now() };
      return value;
    })();
    return athleteWorkoutsCache.task;
  }

  async function loadAdminSnapshot() {
    return { overview: null, query: '' };
  }

  async function hydrateCoachBlock(profile, selectedGymId = null, { force = false } = {}) {
    if (!profile?.email) return emptyCoachPortal();
    const current = getUiState?.()?.coachPortal || {};
    if (!force && current?.status === 'ready' && current?.subscription) return current;
    await patchCoachBlock('loading');
    try {
      const coachPortal = await loadCoachSnapshot(profile, selectedGymId, { force });
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
      const summary = await loadAthleteSummaryBlock(profile, { force });
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
      const results = await loadAthleteResultsBlock(profile, { force });
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
      const workouts = await loadAthleteWorkoutsBlock(profile, { force });
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
      nextState.coachPortal = await loadCoachSnapshot(profile, selectedGymId, { force: !!options.force });
    }

    if (options.includeAthlete !== false) {
      const summary = await loadAthleteSummaryBlock(profile, { force: !!options.force });
      nextState.athleteOverview = buildAthleteOverviewPatch(nextState.athleteOverview, summary, 'summary', 'ready');
      if (options.includeAthleteResults) {
        const results = await loadAthleteResultsBlock(profile, { force: !!options.force });
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
