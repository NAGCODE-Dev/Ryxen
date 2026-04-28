export function buildAthleteAccountPageState(state, helpers) {
  const {
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    isDeveloperEmail,
    normalizeAthleteBenefits,
    getAthleteImportUsage,
  } = helpers;

  const profile = state?.__ui?.auth?.profile || null;
  const coachPortal = state?.__ui?.coachPortal || {};
  const subscription = coachPortal?.subscription || null;
  const planKey = subscription?.plan || subscription?.plan_id || 'free';
  const planName = formatSubscriptionPlanName(planKey);
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const canUseDeveloperTools = isDeveloperEmail(profile?.email) || !!profile?.isAdmin || !!profile?.is_admin;
  const isBusy = !!state?.__ui?.isBusy;
  const athleteBenefits = normalizeAthleteBenefits(state?.__ui?.athleteOverview?.athleteBenefits || null);
  const athleteBlocks = state?.__ui?.athleteOverview?.blocks || {};
  const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
  const accessEntitlements = coachPortal?.entitlements || [];
  const canCoachManage = accessEntitlements.includes('coach_portal');
  const gyms = coachPortal?.gyms || [];
  const gymAccess = coachPortal?.gymAccess || [];
  const athleteStats = state?.__ui?.athleteOverview?.stats || {};
  const athleteBenefitSource = describeAthleteBenefitSource(athleteBenefits);
  const athleteResults = state?.__ui?.athleteOverview?.recentResults || [];
  const athleteWorkouts = state?.__ui?.athleteOverview?.recentWorkouts || [];
  const athleteOverview = state?.__ui?.athleteOverview || {};
  const preferences = state?.preferences || {};
  const accountView = ['overview', 'preferences', 'data'].includes(state?.__ui?.accountView)
    ? state.__ui.accountView
    : 'overview';
  const isSummaryLoading = coachPortal?.status === 'loading' || athleteBlocks?.summary?.status === 'loading';
  const isWorkoutsLoading = athleteBlocks?.workouts?.status === 'loading';
  const isResultsLoading = athleteBlocks?.results?.status === 'loading';
  const showSnapshotNotice = (
    coachPortal?.status === 'ready'
    && (coachPortal?.stale || coachPortal?.source === 'snapshot')
  ) || (
    athleteBlocks?.summary?.status === 'ready'
    && (athleteOverview?.stale || athleteOverview?.source === 'snapshot')
  );

  return {
    profile,
    coachPortal,
    planName,
    planStatus,
    renewAt,
    canUseDeveloperTools,
    isBusy,
    athleteBenefits,
    importUsage,
    canCoachManage,
    gyms,
    gymAccess,
    athleteStats,
    athleteBenefitSource,
    athleteResults,
    athleteWorkouts,
    preferences,
    accountView,
    isSummaryLoading,
    isWorkoutsLoading,
    isResultsLoading,
    showSnapshotNotice,
  };
}
