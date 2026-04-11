import { pool } from '../db.js';
import { canUseDeveloperTools, isDeveloperEmail } from '../devAccess.js';
import { getAccessContextForUser, getSubscriptionAccessState } from '../access.js';
import { buildEntitlements } from '../accessPolicy.js';
import { normalizeSubscriptionPlanId } from '../utils/subscriptionBilling.js';

export async function getLatestSubscription(userId) {
  const row = await pool.query(
    `SELECT plan_id, status, provider, renew_at, updated_at
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );
  return row.rows[0] || null;
}

export function serializeSubscriptionStatus(subscription) {
  const accessState = getSubscriptionAccessState(subscription);
  return {
    plan: subscription?.plan_id || 'free',
    status: subscription?.status || 'inactive',
    provider: subscription?.provider || 'mock',
    renewAt: subscription?.renew_at || null,
    updatedAt: subscription?.updated_at || null,
    accessTier: accessState.accessTier,
    isGracePeriod: accessState.isGracePeriod,
    graceUntil: accessState.graceUntil,
    daysRemaining: accessState.daysRemaining,
  };
}

export async function getBillingStatusSnapshot(userId) {
  const subscription = await getLatestSubscription(userId);
  return serializeSubscriptionStatus(subscription);
}

export async function getEntitlementsSnapshot({ userId, email, isAdmin = false }) {
  const [subscription, gymContexts] = await Promise.all([
    getLatestSubscription(userId),
    getAccessContextForUser(userId),
  ]);

  const entitlements = buildEntitlements({ subscription, gymContexts });
  if (
    canUseDeveloperTools({ email, isAdmin })
    && subscription?.status === 'active'
    && subscription?.provider === 'mock'
    && ['starter', 'pro', 'coach', 'performance'].includes(String(subscription?.plan_id || '').trim().toLowerCase())
  ) {
    entitlements.push('coach_portal');
  }

  return {
    entitlements: Array.from(new Set(entitlements)),
    subscription: serializeSubscriptionStatus(subscription),
    gymAccess: gymContexts.map((ctx) => ({
      gymId: ctx.membership.gym_id,
      gymName: ctx.membership.gym_name,
      role: ctx.membership.role,
      status: ctx.membership.status,
      canCoachManage: ctx.access?.gymAccess?.canCoachManage || false,
      canAthletesUseApp: ctx.access?.gymAccess?.canAthletesUseApp || false,
      warning: ctx.access?.gymAccess?.warning || null,
      accessTier: ctx.access?.ownerSubscription?.accessTier || 'blocked',
      daysRemaining: ctx.access?.ownerSubscription?.daysRemaining || 0,
    })),
  };
}

export async function resolveFallbackBillingPlanId({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return '';

  const latestSubscriptionRes = await pool.query(
    `SELECT s.plan_id
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE u.email = $1
     ORDER BY COALESCE(s.renew_at, NOW()) DESC, s.updated_at DESC
     LIMIT 1`,
    [normalizedEmail],
  );

  const latestSubscriptionPlan = normalizeSubscriptionPlanId(latestSubscriptionRes.rows[0]?.plan_id || '');
  if (latestSubscriptionPlan) return latestSubscriptionPlan;

  const latestClaimRes = await pool.query(
    `SELECT plan_id
     FROM billing_claims
     WHERE email = $1
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [normalizedEmail],
  );

  return normalizeSubscriptionPlanId(latestClaimRes.rows[0]?.plan_id || '');
}
