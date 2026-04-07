let cachedLineIds = { blocks: null, ids: [] };

export function createEmptyAthleteOverviewState() {
  return {
    detailLevel: 'none',
    stats: null,
    recentResults: [],
    recentWorkouts: [],
    benchmarkHistory: [],
    prHistory: [],
    prCurrent: {},
    measurements: [],
    runningHistory: [],
    strengthHistory: [],
    gymAccess: [],
    personalSubscription: null,
    athleteBenefits: null,
    blocks: {
      summary: { status: 'idle', error: '' },
      results: { status: 'idle', error: '' },
      workouts: { status: 'idle', error: '' },
    },
  };
}

export function createEmptyCoachPortalState() {
  return {
    subscription: null,
    entitlements: [],
    gymAccess: [],
    gyms: [],
    selectedGymId: null,
    status: 'idle',
    error: '',
  };
}

export function normalizeAthleteUiState(state) {
  const next = { ...(state || {}) };

  next.currentPage = ['today', 'history', 'account'].includes(next.currentPage) ? next.currentPage : 'today';
  next.modal = next.modal || null;

  next.wod = next.wod && typeof next.wod === 'object' ? next.wod : {};

  next.settings = next.settings && typeof next.settings === 'object' ? next.settings : {};
  if (typeof next.settings.showLbsConversion !== 'boolean') next.settings.showLbsConversion = true;
  if (typeof next.settings.showEmojis !== 'boolean') next.settings.showEmojis = true;
  if (typeof next.settings.showObjectivesInWods !== 'boolean') next.settings.showObjectivesInWods = true;

  next.authMode = next.authMode === 'signup' ? 'signup' : 'signin';
  next.passwordReset = next.passwordReset && typeof next.passwordReset === 'object' ? next.passwordReset : {};
  next.signupVerification = next.signupVerification && typeof next.signupVerification === 'object' ? next.signupVerification : {};
  next.importStatus = next.importStatus && typeof next.importStatus === 'object'
    ? next.importStatus
    : { active: false, tone: 'idle', title: '', message: '', fileName: '', step: 'idle' };
  if (typeof next.importStatus.step !== 'string') next.importStatus.step = 'idle';
  next.admin = next.admin && typeof next.admin === 'object' ? next.admin : { overview: null };
  next.athleteOverview = next.athleteOverview && typeof next.athleteOverview === 'object'
    ? next.athleteOverview
    : createEmptyAthleteOverviewState();
  next.coachPortal = next.coachPortal && typeof next.coachPortal === 'object'
    ? next.coachPortal
    : createEmptyCoachPortalState();

  if (typeof next.athleteOverview.detailLevel !== 'string') next.athleteOverview.detailLevel = 'none';
  if (!Array.isArray(next.athleteOverview.recentResults)) next.athleteOverview.recentResults = [];
  if (!Array.isArray(next.athleteOverview.recentWorkouts)) next.athleteOverview.recentWorkouts = [];
  if (!Array.isArray(next.athleteOverview.benchmarkHistory)) next.athleteOverview.benchmarkHistory = [];
  if (!Array.isArray(next.athleteOverview.prHistory)) next.athleteOverview.prHistory = [];
  if (!next.athleteOverview.prCurrent || typeof next.athleteOverview.prCurrent !== 'object') next.athleteOverview.prCurrent = {};
  if (!Array.isArray(next.athleteOverview.measurements)) next.athleteOverview.measurements = [];
  if (!Array.isArray(next.athleteOverview.runningHistory)) next.athleteOverview.runningHistory = [];
  if (!Array.isArray(next.athleteOverview.strengthHistory)) next.athleteOverview.strengthHistory = [];
  if (!Array.isArray(next.athleteOverview.gymAccess)) next.athleteOverview.gymAccess = [];
  if (!next.athleteOverview.personalSubscription || typeof next.athleteOverview.personalSubscription !== 'object') next.athleteOverview.personalSubscription = null;
  if (!next.athleteOverview.athleteBenefits || typeof next.athleteOverview.athleteBenefits !== 'object') next.athleteOverview.athleteBenefits = null;

  next.athleteOverview.blocks = next.athleteOverview.blocks && typeof next.athleteOverview.blocks === 'object'
    ? next.athleteOverview.blocks
    : {};
  for (const key of ['summary', 'results', 'workouts']) {
    const current = next.athleteOverview.blocks[key];
    next.athleteOverview.blocks[key] = current && typeof current === 'object'
      ? { status: typeof current.status === 'string' ? current.status : 'idle', error: String(current.error || '') }
      : { status: 'idle', error: '' };
  }

  if (!Array.isArray(next.coachPortal.gyms)) next.coachPortal.gyms = [];
  if (!Array.isArray(next.coachPortal.gymAccess)) next.coachPortal.gymAccess = [];
  if (!Array.isArray(next.coachPortal.entitlements)) next.coachPortal.entitlements = [];
  if (typeof next.coachPortal.selectedGymId !== 'number') next.coachPortal.selectedGymId = next.coachPortal.selectedGymId || null;
  if (typeof next.coachPortal.status !== 'string') next.coachPortal.status = 'idle';
  if (typeof next.coachPortal.error !== 'string') next.coachPortal.error = '';

  Object.keys(next.wod).forEach((key) => {
    const entry = next.wod[key];
    if (!entry || typeof entry !== 'object') {
      delete next.wod[key];
      return;
    }
    next.wod[key] = {
      activeLineId: typeof entry.activeLineId === 'string' ? entry.activeLineId : null,
      done: entry.done && typeof entry.done === 'object' ? entry.done : {},
    };
  });

  return next;
}

export function buildAthleteUiForRender({ state, uiState, uiBusy, profile }) {
  const key = buildAthleteWorkoutKey(state);
  const wod = uiState.wod[key] || { activeLineId: null, done: {} };
  const lineIds = computeLineIdsFromState(state);
  const doneCount = lineIds.reduce((acc, id) => acc + (wod.done?.[id] ? 1 : 0), 0);

  return {
    modal: uiState.modal,
    currentPage: uiState.currentPage,
    isBusy: uiBusy,
    settings: uiState.settings,
    authMode: uiState.authMode,
    auth: { profile },
    passwordReset: uiState.passwordReset,
    signupVerification: uiState.signupVerification,
    importStatus: uiState.importStatus,
    admin: uiState.admin,
    athleteOverview: uiState.athleteOverview,
    coachPortal: uiState.coachPortal,
    wodKey: key,
    activeLineId: wod.activeLineId,
    done: wod.done || {},
    progress: { doneCount, totalCount: lineIds.length },
  };
}

export function buildAthleteWorkoutKey(state) {
  const week = state?.activeWeekNumber ?? '0';
  const day = state?.currentDay ?? 'Hoje';
  return `${week}:${String(day).toLowerCase()}`;
}

function computeLineIdsFromState(state) {
  const blocks = state?.workoutOfDay?.blocks || state?.workout?.blocks || [];
  if (cachedLineIds.blocks === blocks) {
    return cachedLineIds.ids;
  }
  const ids = [];
  blocks.forEach((block, blockIndex) => {
    const lines = block?.lines || [];
    lines.forEach((_, lineIndex) => ids.push(`b${blockIndex}-l${lineIndex}`));
  });
  cachedLineIds = { blocks, ids };
  return ids;
}
