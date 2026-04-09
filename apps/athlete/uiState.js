import {
  createEmptyAdminState,
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from './uiEmptyStates.js';
import { computeLineIdsFromState } from './uiLineIds.js';
import {
  normalizeAthleteAdminState,
  normalizeAthleteImportStatus,
  normalizeAthleteOverviewState,
  normalizeAthleteSettings,
  normalizeAthleteWodState,
  normalizeCoachPortalState,
} from './uiStateNormalize.js';

export {
  createEmptyAdminState,
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
};

export function normalizeAthleteUiState(state) {
  const next = { ...(state || {}) };

  next.currentPage = ['today', 'history', 'account'].includes(next.currentPage) ? next.currentPage : 'today';
  next.accountView = ['overview', 'preferences', 'data'].includes(next.accountView) ? next.accountView : 'overview';
  next.modal = next.modal || null;

  next.authMode = next.authMode === 'signup' ? 'signup' : 'signin';
  next.passwordReset = next.passwordReset && typeof next.passwordReset === 'object' ? next.passwordReset : {};
  next.signupVerification = next.signupVerification && typeof next.signupVerification === 'object' ? next.signupVerification : {};
  next.settings = normalizeAthleteSettings(next.settings);
  next.importStatus = normalizeAthleteImportStatus(next.importStatus);
  next.admin = normalizeAthleteAdminState(next.admin);
  next.athleteOverview = normalizeAthleteOverviewState(next.athleteOverview);
  next.coachPortal = normalizeCoachPortalState(next.coachPortal);
  next.wod = normalizeAthleteWodState(next.wod);

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
    accountView: uiState.accountView,
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
