function createTimedCache() {
  return { key: '', value: null, task: null, at: 0 };
}

function isFresh(cache, key, maxAgeMs) {
  return cache.key === key && cache.value && (Date.now() - cache.at) < maxAgeMs;
}

function emptyBlockState() {
  return { status: 'idle', error: '' };
}

export function createAthleteOverviewDomain({
  measureAsync,
  emptyAthleteOverview,
  getAthleteSummary,
  getAthleteResultsSummary,
  getAthleteWorkoutsRecent,
}) {
  let athleteSummaryCache = createTimedCache();
  let athleteResultsCache = createTimedCache();
  let athleteWorkoutsCache = createTimedCache();

  function invalidateAthleteCache() {
    athleteSummaryCache = createTimedCache();
    athleteResultsCache = createTimedCache();
    athleteWorkoutsCache = createTimedCache();
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

  async function loadAthleteSummaryBlock(profileEmail, { force = false } = {}) {
    const email = String(profileEmail || '').trim().toLowerCase();
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

  async function loadAthleteResultsBlock(profileEmail, { force = false } = {}) {
    const email = String(profileEmail || '').trim().toLowerCase();
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

  async function loadAthleteWorkoutsBlock(profileEmail, { force = false } = {}) {
    const email = String(profileEmail || '').trim().toLowerCase();
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

  return {
    buildAthleteOverviewPatch,
    invalidateAthleteCache,
    loadAthleteSummaryBlock,
    loadAthleteResultsBlock,
    loadAthleteWorkoutsBlock,
  };
}
