export const ATHLETE_BENEFIT_ORDER = ['base', 'athlete_plus', 'starter', 'pro', 'performance'];

export const ATHLETE_BENEFIT_MATRIX = {
  base: {
    tier: 'base',
    coachPlan: 'none',
    source: 'base',
    label: 'Liberado',
    planLabel: 'Atleta liberado',
    importsPerMonth: null,
    historyDays: null,
    premiumFeatures: true,
  },
  athlete_plus: {
    tier: 'athlete_plus',
    coachPlan: 'athlete_plus',
    source: 'personal',
    label: 'Liberado',
    planLabel: 'Atleta liberado',
    importsPerMonth: null,
    historyDays: null,
    premiumFeatures: true,
  },
  starter: {
    tier: 'starter',
    coachPlan: 'starter',
    source: 'coach',
    label: 'Liberado',
    planLabel: 'Atleta liberado',
    importsPerMonth: null,
    historyDays: null,
    premiumFeatures: true,
  },
  pro: {
    tier: 'pro',
    coachPlan: 'pro',
    source: 'coach',
    label: 'Liberado',
    planLabel: 'Atleta liberado',
    importsPerMonth: null,
    historyDays: null,
    premiumFeatures: true,
  },
  performance: {
    tier: 'performance',
    coachPlan: 'performance',
    source: 'coach',
    label: 'Liberado',
    planLabel: 'Atleta liberado',
    importsPerMonth: null,
    historyDays: null,
    premiumFeatures: true,
  },
};

export function resolveSubscriptionPlanTier(planId) {
  const raw = String(planId || '').trim().toLowerCase();
  if (!raw || raw === 'free') return 'base';
  if (raw === 'athlete_plus' || raw === 'athlete-plus' || raw === 'athlete plus' || raw === 'athleteplus' || raw === 'plus') {
    return 'athlete_plus';
  }
  if (raw === 'starter') return 'starter';
  if (raw === 'coach' || raw === 'pro') return 'pro';
  if (raw === 'performance' || raw === 'elite' || raw === 'max') return 'performance';
  return 'base';
}

export function resolveCoachPlanTier(planId) {
  const tier = resolveSubscriptionPlanTier(planId);
  return ['starter', 'pro', 'performance'].includes(tier) ? tier : 'base';
}

export function resolvePersonalAthleteTier(planId) {
  const tier = resolveSubscriptionPlanTier(planId);
  return tier === 'athlete_plus' ? tier : 'base';
}

export function getAthleteBenefitProfile({ ownerSubscription, canAthletesUseApp } = {}) {
  const tier = resolveCoachPlanTier(ownerSubscription?.plan_id);
  const base = ATHLETE_BENEFIT_MATRIX[tier] || ATHLETE_BENEFIT_MATRIX.base;
  return {
    ...base,
    inherited: tier !== 'base',
    personal: false,
    accessBlocked: false,
  };
}

export function getPersonalAthleteBenefitProfile(subscription = null) {
  const tier = resolvePersonalAthleteTier(subscription?.plan_id);
  const base = ATHLETE_BENEFIT_MATRIX[tier] || ATHLETE_BENEFIT_MATRIX.base;
  return {
    ...base,
    inherited: false,
    personal: tier !== 'base',
    accessBlocked: false,
  };
}

export function selectEffectiveAthleteBenefits(input = [], personalSubscription = null) {
  const gymContexts = Array.isArray(input) ? input : (input?.gymContexts || []);
  const personal = Array.isArray(input) ? personalSubscription : (input?.personalSubscription || null);

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

  const personalProfile = getPersonalAthleteBenefitProfile(personal);
  if (personalProfile?.tier && personalProfile.tier !== 'base') {
    profiles.push({
      ...personalProfile,
      gymId: null,
      gymName: null,
    });
  }

  if (!profiles.length) {
    return {
      ...ATHLETE_BENEFIT_MATRIX.base,
      inherited: false,
      personal: false,
      accessBlocked: false,
      gymId: null,
      gymName: null,
    };
  }

  return profiles.reduce((best, current) => {
    const bestRank = ATHLETE_BENEFIT_ORDER.indexOf(best.tier);
    const currentRank = ATHLETE_BENEFIT_ORDER.indexOf(current.tier);
    if (currentRank > bestRank) return current;
    if (currentRank === bestRank && current.personal && !best.personal) return current;
    return best;
  });
}

export function buildEntitlements({ subscription, gymContexts }) {
  const entitlements = ['athlete_app'];
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

  const athleteBenefits = selectEffectiveAthleteBenefits({ gymContexts: contexts, personalSubscription: subscription });
  if (athleteBenefits?.tier && athleteBenefits.tier !== 'base') {
    entitlements.push(athleteBenefits.tier === 'athlete_plus' ? 'athlete_plus' : `athlete_${athleteBenefits.tier}`);
  }

  return Array.from(new Set(entitlements));
}
