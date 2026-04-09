import {
  confirmSignUp,
  signIn,
  signInWithTrustedDevice,
  signInWithGoogle,
  startGoogleRedirect,
  signOut,
  requestSignUpVerification,
  signUp,
  refreshSession,
  requestPasswordReset,
  confirmPasswordReset,
  getPasswordResetSupportStatus,
  confirmPasswordResetSupport,
  getStoredProfile,
} from '../core/services/authService.js';
import { activateCoachSubscription, approvePasswordResetSupportRequest, createManualPasswordReset, deleteAccountNow, denyPasswordResetSupportRequest, getAdminOpsHealth, getAdminOverview, reprocessBillingClaim, requestAccountDeletion, retryEmailJob } from '../core/services/adminService.js';
import { openCheckout, getSubscriptionStatus, getEntitlements, activateMockSubscription } from '../core/services/subscriptionService.js';
import {
  addGymMember,
  createGym,
  createGymGroup,
  getAccessContext,
  getAthleteResultsSummary,
  getAthleteSummary,
  getAthleteWorkoutsRecent,
  getAppStateSnapshot,
  getImportedPlanSnapshot,
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
  saveAppStateSnapshot,
  saveImportedPlanSnapshot,
  deleteImportedPlanSnapshot,
} from '../core/services/gymService.js';
import { getBenchmarks } from '../core/services/benchmarkService.js';
import { getRuntimeConfig, setRuntimeConfig } from '../config/runtime.js';

export function createRemoteHandlers({
  syncCoachWorkoutFeed,
  clearCoachWorkoutFeed,
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

    async handleSignInWithTrustedDevice(payload) {
      return signInWithTrustedDevice(payload);
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

    async handleGetPasswordResetSupportStatus(payload) {
      return getPasswordResetSupportStatus(payload);
    },

    async handleConfirmPasswordResetSupport(payload) {
      return confirmPasswordResetSupport(payload);
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

    async handleApprovePasswordResetSupportRequest(requestId) {
      const data = await approvePasswordResetSupportRequest(requestId);
      return { success: true, data };
    },

    async handleDenyPasswordResetSupportRequest(requestId) {
      const data = await denyPasswordResetSupportRequest(requestId);
      return { success: true, data };
    },

    async handleRequestAccountDeletion(userId) {
      const data = await requestAccountDeletion(userId);
      return { success: true, data };
    },

    async handleDeleteAccountNow(userId) {
      const data = await deleteAccountNow(userId);
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

    async handleGetAthleteSummary(params = {}) {
      const data = await getAthleteSummary({ ...params, sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleGetAthleteResultsSummary(params = {}) {
      const data = await getAthleteResultsSummary({ ...params, sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleGetAthleteWorkoutsRecent(params = {}) {
      const data = await getAthleteWorkoutsRecent({ ...params, sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleGetImportedPlanSnapshot() {
      const data = await getImportedPlanSnapshot();
      return { success: true, data };
    },

    async handleGetAppStateSnapshot() {
      const data = await getAppStateSnapshot({ sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleSaveAppStateSnapshot(payload) {
      const data = await saveAppStateSnapshot(payload, { sportType: getCurrentSportType() });
      return { success: true, data };
    },

    async handleSaveImportedPlanSnapshot(payload) {
      const data = await saveImportedPlanSnapshot(payload);
      return { success: true, data };
    },

    async handleDeleteImportedPlanSnapshot() {
      const data = await deleteImportedPlanSnapshot();
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
  };
}
