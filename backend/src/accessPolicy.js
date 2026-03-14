export const ATHLETE_BENEFIT_ORDER = ['base', 'starter', 'pro', 'performance'];

export const ATHLETE_BENEFIT_MATRIX = {
  base: {
    tier: 'base',
    coachPlan: 'none',
    label: 'Base',
    planLabel: 'Sem coach com plano ativo',
    importsPerMonth: 5,
    historyDays: 30,
    competitionAccess: 'full',
    premiumFeatures: false,
  },
  starter: {
    tier: 'starter',
    coachPlan: 'starter',
    label: 'Coach Starter',
    planLabel: 'Coach Starter',
    importsPerMonth: 12,
    historyDays: 90,
    competitionAccess: 'full',
    premiumFeatures: true,
  },
  pro: {
    tier: 'pro',
    coachPlan: 'pro',
    label: 'Coach Pro',
    planLabel: 'Coach Pro',
    importsPerMonth: 30,
    historyDays: 365,
    competitionAccess: 'full',
    premiumFeatures: true,
  },
  performance: {
    tier: 'performance',
    coachPlan: 'performance',
    label: 'Coach Performance',
    planLabel: 'Coach Performance',
    importsPerMonth: null,
    historyDays: null,
    competitionAccess: 'full',
    premiumFeatures: true,
  },
};

export function resolveCoachPlanTier(planId) {
  const raw = String(planId || '').trim().toLowerCase();
  if (!raw || raw === 'free') return 'base';
  if (raw === 'starter' || raw === 'coach') return 'starter';
  if (raw === 'pro') return 'pro';
  if (raw === 'performance' || raw === 'elite' || raw === 'max') return 'performance';
  return 'base';
}

export function getAthleteBenefitProfile({ ownerSubscription, canAthletesUseApp } = {}) {
  if (!canAthletesUseApp) {
    return {
      ...ATHLETE_BENEFIT_MATRIX.base,
      inherited: false,
      accessBlocked: true,
    };
  }

  const tier = resolveCoachPlanTier(ownerSubscription?.plan_id);
  const base = ATHLETE_BENEFIT_MATRIX[tier] || ATHLETE_BENEFIT_MATRIX.base;
  return {
    ...base,
    inherited: tier !== 'base',
    accessBlocked: false,
  };
}

export function selectEffectiveAthleteBenefits(gymContexts = []) {
  const profiles = (gymContexts || [])
    .map((ctx) => {
      const profile = ctx?.access?.athleteBenefits || null;
      if (!profile) return null;
      return {
        ...profile,
        gymId: ctx?.membership?.gym_id ?? ctx?.gymId ?? null,
        gymName: ctx?.membership?.gym_name ?? ctx?.gymName ?? null,
      };
    })
    .filter(Boolean);

  if (!profiles.length) {
    return {
      ...ATHLETE_BENEFIT_MATRIX.base,
      inherited: false,
      accessBlocked: false,
      gymId: null,
      gymName: null,
    };
  }

  return profiles.reduce((best, current) => {
    const bestRank = ATHLETE_BENEFIT_ORDER.indexOf(best.tier);
    const currentRank = ATHLETE_BENEFIT_ORDER.indexOf(current.tier);
    return currentRank > bestRank ? current : best;
  });
}

export function buildEntitlements({ subscription, gymContexts }) {
  const entitlements = [];
  const contexts = gymContexts || [];
  const canManageGym = (role) => role === 'owner' || role === 'coach';

  if (subscription?.status === 'active') {
    entitlements.push('premium');
    if (subscription.plan_id === 'pro' || subscription.plan_id === 'coach') {
      entitlements.push('advanced_analytics');
    }
  }

  if (contexts.some((ctx) => canManageGym(ctx.membership.role) && ctx?.access?.gymAccess?.canCoachManage)) {
    entitlements.push('coach_portal');
  }

  if (contexts.some((ctx) => ctx?.access?.gymAccess?.canAthletesUseApp)) {
    entitlements.push('athlete_app');
  }

  const athleteBenefits = selectEffectiveAthleteBenefits(contexts);
  if (athleteBenefits?.tier && athleteBenefits.tier !== 'base') {
    entitlements.push(`athlete_${athleteBenefits.tier}`);
  }

  if (contexts.some((ctx) => ctx?.access?.ownerSubscription?.accessTier === 'grace')) {
    entitlements.push('grace_period');
  }

  if (contexts.some((ctx) => ctx?.access?.ownerSubscription?.accessTier === 'blocked')) {
    entitlements.push('billing_blocked');
  }

  return Array.from(new Set(entitlements));
}
