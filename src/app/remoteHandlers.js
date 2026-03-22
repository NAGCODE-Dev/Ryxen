import {
  confirmSignUp,
  signIn,
  signInWithGoogle,
  startGoogleRedirect,
  signOut,
  requestSignUpVerification,
  signUp,
  refreshSession,
  requestPasswordReset,
  confirmPasswordReset,
  getStoredProfile,
} from '../core/services/authService.js';
import { activateCoachSubscription, createManualPasswordReset, getAdminOpsHealth, getAdminOverview, reprocessBillingClaim, retryEmailJob } from '../core/services/adminService.js';
import { openCheckout, getSubscriptionStatus, getEntitlements, activateMockSubscription } from '../core/services/subscriptionService.js';
import { pullLatestBackupPayload, pushBackupPayload, listSyncSnapshots } from '../core/services/syncService.js';
import {
  addGymMember,
  createGym,
  createGymGroup,
  getAccessContext,
  getAthleteDashboard,
  getGymInsights,
  getMeasurementHistory,
  getMyGyms,
  getRunningHistory,
  getStrengthHistory,
  logAthletePr,
  logRunningSession,
  logStrengthSession,
  syncAthleteMeasurementsSnapshot,
  syncAthletePrSnapshot,
  getWorkoutFeed,
  listGymGroups,
  listGymMembers,
  publishGymWorkout,
} from '../core/services/gymService.js';
import { getBenchmarks } from '../core/services/benchmarkService.js';
import {
  addCompetitionEvent,
  createCompetition,
  getBenchmarkLeaderboard,
  getCompetitionLeaderboard,
  getCompetitionCalendar,
  getEventLeaderboard,
  submitBenchmarkResult,
} from '../core/services/competitionService.js';
import { getRuntimeConfig, setRuntimeConfig } from '../config/runtime.js';
import { exportAppBackup, importAppBackup } from '../core/usecases/backupData.js';

export function createRemoteHandlers({
  getState,
  setState,
  selectActiveWeek,
  syncCoachWorkoutFeed,
  clearCoachWorkoutFeed,
  applyImportedBackupData,
}) {
  function getCurrentSportType() {
    return getRuntimeConfig()?.app?.sport || 'cross';
  }

  return {
    async handleSignUp(credentials) {
      return signUp(credentials);
    },

    async handleRequestSignUpVerification(payload) {
      return requestSignUpVerification(payload);
    },

    async handleConfirmSignUp(payload) {
      return confirmSignUp(payload);
    },

    async handleSignIn(credentials) {
      return signIn(credentials);
    },

    async handleSignInWithGoogle(payload) {
      return signInWithGoogle(payload);
    },

    handleStartGoogleRedirect(payload) {
      return startGoogleRedirect(payload);
    },

    async handleRefreshSession() {
      return refreshSession();
    },

    async handleRequestPasswordReset(payload) {
      return requestPasswordReset(payload);
    },

    async handleConfirmPasswordReset(payload) {
      return confirmPasswordReset(payload);
    },

    async handleSignOut() {
      await signOut();
      await clearCoachWorkoutFeed?.();
      return { success: true };
    },

    handleGetProfile() {
      return { success: true, data: getStoredProfile() };
    },

    async handleGetAdminOverview(params) {
      const data = await getAdminOverview(params);
      return { success: true, data };
    },

    async handleActivateCoachSubscription(userId, planId, renewDays = 30) {
      const data = await activateCoachSubscription(userId, planId, renewDays);
      return { success: true, data };
    },

    async handleGetAdminOpsHealth(params) {
      const data = await getAdminOpsHealth(params);
      return { success: true, data };
    },

    async handleReprocessBillingClaim(claimId) {
      const data = await reprocessBillingClaim(claimId);
      return { success: true, data };
    },

    async handleRetryEmailJob(jobId) {
      const data = await retryEmailJob(jobId);
      return { success: true, data };
    },

    async handleCreateManualPasswordReset(userId) {
      const data = await createManualPasswordReset(userId);
      return { success: true, data };
    },

    async handleOpenCheckout(planId) {
      await openCheckout(planId);
      return { success: true };
    },

    async handleGetSubscriptionStatus() {
      const data = await getSubscriptionStatus();
      return { success: true, data };
    },

    async handleGetEntitlements() {
      const data = await getEntitlements();
      return { success: true, data };
    },

    async handleActivateMockSubscription(planId) {
      const data = await activateMockSubscription(planId);
      return { success: true, data };
    },

    async handleSyncPush() {
      const state = getState();
      const backup = exportAppBackup(state, { mode: 'sync-push' });
      if (!backup.success) return backup;
      const data = await pushBackupPayload(backup.data);
      return { success: true, data };
    },

    async handleSyncPull() {
      const pulled = await pullLatestBackupPayload();
      const payload = pulled?.payload || pulled?.data?.payload;
      if (!payload) {
        return { success: false, error: 'Nenhum snapshot remoto disponível' };
      }

      const parsed = importAppBackup(JSON.stringify(payload));
      if (!parsed.success) {
        return { success: false, error: parsed.error };
      }

      const backup = parsed.data;
      await applyImportedBackupData?.(backup, {
        fileName: 'remote-sync',
        source: 'sync-pull',
      });

      return { success: true, data: backup };
    },

    async handleListSyncSnapshots() {
      const data = await listSyncSnapshots();
      return { success: true, data };
    },

    handleGetRuntimeConfig() {
      return { success: true, data: getRuntimeConfig() };
    },

    handleSetRuntimeConfig(config) {
      const data = setRuntimeConfig(config || {});
      return { success: true, data };
    },

    async handleCreateGym(payload) {
      const data = await createGym(payload);
      return { success: true, data };
    },

    async handleGetMyGyms() {
      const data = await getMyGyms();
      return { success: true, data };
    },

    async handleAddGymMember(gymId, payload) {
      const data = await addGymMember(gymId, payload);
      return { success: true, data };
    },

    async handleListGymMembers(gymId) {
      const data = await listGymMembers(gymId);
      return { success: true, data };
    },

    async handleListGymGroups(gymId) {
      const data = await listGymGroups(gymId, { sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleCreateGymGroup(gymId, payload) {
      const data = await createGymGroup(gymId, {
        ...(payload || {}),
        sportType: payload?.sportType || getCurrentSportType(),
      });
      return { success: true, data };
    },

    async handlePublishGymWorkout(gymId, payload) {
      const data = await publishGymWorkout(gymId, {
        ...(payload || {}),
        sportType: payload?.sportType || getCurrentSportType(),
      });
      return { success: true, data };
    },

    async handleGetWorkoutFeed() {
      const data = await getWorkoutFeed({ sportType: getCurrentSportType() });
      await syncCoachWorkoutFeed?.(data?.workouts || []);
      return { success: true, data };
    },

    async handleGetAccessContext() {
      const data = await getAccessContext();
      return { success: true, data };
    },

    async handleGetAthleteDashboard(params = {}) {
      const data = await getAthleteDashboard({ ...params, sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleGetGymInsights(gymId) {
      const data = await getGymInsights(gymId, { sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleLogAthletePr(payload) {
      const data = await logAthletePr(payload);
      return { success: true, data };
    },

    async handleSyncAthletePrSnapshot(prs) {
      const data = await syncAthletePrSnapshot(prs);
      return { success: true, data };
    },

    async handleGetMeasurementHistory() {
      const data = await getMeasurementHistory();
      return { success: true, data };
    },

    async handleSyncAthleteMeasurementsSnapshot(measurements) {
      const data = await syncAthleteMeasurementsSnapshot(measurements);
      return { success: true, data };
    },

    async handleLogRunningSession(payload) {
      const data = await logRunningSession(payload);
      return { success: true, data };
    },

    async handleGetRunningHistory() {
      const data = await getRunningHistory();
      return { success: true, data };
    },

    async handleLogStrengthSession(payload) {
      const data = await logStrengthSession(payload);
      return { success: true, data };
    },

    async handleGetStrengthHistory() {
      const data = await getStrengthHistory();
      return { success: true, data };
    },

    async handleGetBenchmarks(params) {
      const data = await getBenchmarks(params);
      return { success: true, data };
    },

    async handleGetCompetitionCalendar(params) {
      const data = await getCompetitionCalendar({
        ...(params || {}),
        sportType: params?.sportType || getCurrentSportType(),
      });
      return { success: true, data };
    },

    async handleCreateCompetition(gymId, payload) {
      const data = await createCompetition(gymId, {
        ...(payload || {}),
        sportType: payload?.sportType || getCurrentSportType(),
      });
      return { success: true, data };
    },

    async handleAddCompetitionEvent(competitionId, payload) {
      const data = await addCompetitionEvent(competitionId, payload);
      return { success: true, data };
    },

    async handleSubmitBenchmarkResult(slug, payload) {
      const data = await submitBenchmarkResult(slug, {
        ...(payload || {}),
        sportType: payload?.sportType || getCurrentSportType(),
      });
      return { success: true, data };
    },

    async handleGetBenchmarkLeaderboard(slug, params) {
      const data = await getBenchmarkLeaderboard(slug, {
        ...(params || {}),
        sportType: params?.sportType || getCurrentSportType(),
      });
      return { success: true, data };
    },

    async handleGetCompetitionLeaderboard(competitionId) {
      const data = await getCompetitionLeaderboard(competitionId);
      return { success: true, data };
    },

    async handleGetEventLeaderboard(eventId, params) {
      const data = await getEventLeaderboard(eventId, params);
      return { success: true, data };
    },
  };
}
