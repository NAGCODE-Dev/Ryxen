import {
  createEmptyAdminState,
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from './uiEmptyStates.js';

export function normalizeAthleteSettings(settings) {
  const next = settings && typeof settings === 'object' ? settings : {};
  if (typeof next.showLbsConversion !== 'boolean') next.showLbsConversion = true;
  if (typeof next.showEmojis !== 'boolean') next.showEmojis = true;
  if (typeof next.showObjectivesInWods !== 'boolean') next.showObjectivesInWods = true;
  if (typeof next.showNyxHints !== 'boolean') next.showNyxHints = true;
  if (!['dark', 'light'].includes(next.theme)) next.theme = 'dark';
  if (!['blue', 'sage', 'sand', 'rose'].includes(next.accentTone)) next.accentTone = 'blue';
  if (!['comfortable', 'compact'].includes(next.interfaceDensity)) next.interfaceDensity = 'comfortable';
  if (typeof next.reduceMotion !== 'boolean') next.reduceMotion = false;
  if (!['uploaded', 'coach'].includes(next.workoutPriority)) next.workoutPriority = 'uploaded';
  return next;
}

export function normalizeAthleteGuideState(guide) {
  const next = guide && typeof guide === 'object' ? guide : {};
  const step = Number(next.step);
  next.step = Number.isInteger(step) && step >= 0 && step <= 3 ? step : 0;
  return next;
}

export function normalizeAthleteImportStatus(importStatus) {
  const next = importStatus && typeof importStatus === 'object'
    ? importStatus
    : { active: false, tone: 'idle', title: '', message: '', fileName: '', step: 'idle', review: null };
  if (typeof next.step !== 'string') next.step = 'idle';
  next.review = next.review && typeof next.review === 'object' ? next.review : null;
  return next;
}

export function normalizeAthleteAdminState(admin) {
  const next = admin && typeof admin === 'object' ? admin : createEmptyAdminState();
  if (typeof next.query !== 'string') next.query = '';
  return next;
}

export function normalizeAthleteOverviewState(athleteOverview) {
  const next = athleteOverview && typeof athleteOverview === 'object'
    ? athleteOverview
    : createEmptyAthleteOverviewState();

  if (typeof next.detailLevel !== 'string') next.detailLevel = 'none';
  if (!Array.isArray(next.recentResults)) next.recentResults = [];
  if (!Array.isArray(next.recentWorkouts)) next.recentWorkouts = [];
  if (!Array.isArray(next.benchmarkHistory)) next.benchmarkHistory = [];
  if (!Array.isArray(next.prHistory)) next.prHistory = [];
  if (!next.prCurrent || typeof next.prCurrent !== 'object') next.prCurrent = {};
  if (!Array.isArray(next.measurements)) next.measurements = [];
  if (!Array.isArray(next.runningHistory)) next.runningHistory = [];
  if (!Array.isArray(next.strengthHistory)) next.strengthHistory = [];
  if (!Array.isArray(next.gymAccess)) next.gymAccess = [];
  if (!next.personalSubscription || typeof next.personalSubscription !== 'object') next.personalSubscription = null;
  if (!next.athleteBenefits || typeof next.athleteBenefits !== 'object') next.athleteBenefits = null;

  next.blocks = next.blocks && typeof next.blocks === 'object' ? next.blocks : {};
  for (const key of ['summary', 'results', 'workouts']) {
    const current = next.blocks[key];
    next.blocks[key] = current && typeof current === 'object'
      ? { status: typeof current.status === 'string' ? current.status : 'idle', error: String(current.error || '') }
      : { status: 'idle', error: '' };
  }

  return next;
}

export function normalizeCoachPortalState(coachPortal) {
  const next = coachPortal && typeof coachPortal === 'object'
    ? coachPortal
    : createEmptyCoachPortalState();

  if (!Array.isArray(next.gyms)) next.gyms = [];
  if (!Array.isArray(next.gymAccess)) next.gymAccess = [];
  if (!Array.isArray(next.entitlements)) next.entitlements = [];
  if (typeof next.selectedGymId !== 'number') next.selectedGymId = next.selectedGymId || null;
  if (typeof next.status !== 'string') next.status = 'idle';
  if (typeof next.error !== 'string') next.error = '';

  return next;
}

export function normalizeAthleteWodState(wod) {
  const next = wod && typeof wod === 'object' ? wod : {};

  Object.keys(next).forEach((key) => {
    const entry = next[key];
    if (!entry || typeof entry !== 'object') {
      delete next[key];
      return;
    }
    next[key] = {
      activeLineId: typeof entry.activeLineId === 'string' ? entry.activeLineId : null,
      done: entry.done && typeof entry.done === 'object' ? entry.done : {},
    };
  });

  return next;
}
