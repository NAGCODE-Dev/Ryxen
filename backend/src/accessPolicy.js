import { canManageGym } from './access.js';

export function buildEntitlements({ subscription, gymContexts }) {
  const entitlements = [];
  const contexts = gymContexts || [];

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

  if (contexts.some((ctx) => ctx?.access?.ownerSubscription?.accessTier === 'grace')) {
    entitlements.push('grace_period');
  }

  if (contexts.some((ctx) => ctx?.access?.ownerSubscription?.accessTier === 'blocked')) {
    entitlements.push('billing_blocked');
  }

  return Array.from(new Set(entitlements));
}
