import { pool } from './db.js';
import { getAthleteBenefitProfile } from './accessPolicy.js';

export async function getUserMemberships(userId) {
  const result = await pool.query(
    `SELECT
      gm.id,
      gm.gym_id,
      gm.role,
      gm.status,
      gm.pending_email,
      gm.created_at,
      g.name AS gym_name,
      g.slug AS gym_slug,
      g.owner_user_id
     FROM gym_memberships gm
     JOIN gyms g ON g.id = gm.gym_id
     WHERE gm.user_id = $1
     ORDER BY gm.created_at ASC`,
    [userId],
  );

  return result.rows;
}

export async function getGymById(gymId) {
  const result = await pool.query(`SELECT * FROM gyms WHERE id = $1`, [gymId]);
  return result.rows[0] || null;
}

export async function getMembershipForUser(gymId, userId) {
  const result = await pool.query(
    `SELECT * FROM gym_memberships WHERE gym_id = $1 AND user_id = $2 LIMIT 1`,
    [gymId, userId],
  );
  return result.rows[0] || null;
}

export async function getActiveSubscriptionForUser(userId) {
  const result = await pool.query(
    `SELECT id, plan_id, status, provider, renew_at, updated_at
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );

  const sub = result.rows[0] || null;
  if (!sub) return null;

  const accessState = getSubscriptionAccessState(sub);
  return {
    ...sub,
    ...accessState,
  };
}

function buildDefaultOwnerSubscription() {
  return {
    plan_id: 'free',
    status: 'inactive',
    provider: 'mock',
    renew_at: null,
    updated_at: null,
    isActive: false,
    isExpired: true,
    isGracePeriod: false,
    graceUntil: null,
    accessTier: 'blocked',
    daysRemaining: 0,
  };
}

function buildGymAccessContext(gym, ownerSubscription) {
  const resolvedOwnerSubscription = ownerSubscription || buildDefaultOwnerSubscription();
  return {
    gym,
    ownerSubscription: resolvedOwnerSubscription,
    gymAccess: {
      canCoachManage: resolvedOwnerSubscription.accessTier === 'active',
      canAthletesUseApp: true,
      warning: resolveGymWarning(resolvedOwnerSubscription),
    },
    athleteBenefits: getAthleteBenefitProfile({
      ownerSubscription: resolvedOwnerSubscription,
      canAthletesUseApp: true,
    }),
  };
}

export async function getAccessContextsForGymIds(gymIds = []) {
  const uniqueGymIds = Array.from(new Set(
    (Array.isArray(gymIds) ? gymIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)),
  ));
  if (!uniqueGymIds.length) return new Map();

  const gymsRes = await pool.query(
    `SELECT id, name, slug, owner_user_id
     FROM gyms
     WHERE id = ANY($1::int[])`,
    [uniqueGymIds],
  );
  if (!gymsRes.rows.length) return new Map();

  const ownerUserIds = Array.from(new Set(
    gymsRes.rows
      .map((gym) => Number(gym.owner_user_id))
      .filter((value) => Number.isFinite(value)),
  ));
  const subscriptionsByOwnerId = new Map();

  if (ownerUserIds.length) {
    const subsRes = await pool.query(
      `SELECT DISTINCT ON (user_id)
         user_id,
         id,
         plan_id,
         status,
         provider,
         renew_at,
         updated_at
       FROM subscriptions
       WHERE user_id = ANY($1::int[])
       ORDER BY user_id, updated_at DESC`,
      [ownerUserIds],
    );

    for (const row of subsRes.rows) {
      subscriptionsByOwnerId.set(row.user_id, {
        ...row,
        ...getSubscriptionAccessState(row),
      });
    }
  }

  return new Map(
    gymsRes.rows.map((gym) => [
      gym.id,
      buildGymAccessContext(gym, subscriptionsByOwnerId.get(gym.owner_user_id) || null),
    ]),
  );
}

export async function getAccessContextForGym(gymId) {
  const contexts = await getAccessContextsForGymIds([gymId]);
  return contexts.get(Number(gymId)) || null;
}

export async function getAccessContextForUser(userId) {
  const memberships = await getUserMemberships(userId);
  const accessByGymId = await getAccessContextsForGymIds(memberships.map((membership) => membership.gym_id));
  return memberships.map((membership) => ({
    membership,
    access: accessByGymId.get(membership.gym_id) || null,
  }));
}

export function canManageGym(role) {
  return role === 'owner' || role === 'coach';
}

export function getSubscriptionAccessState(subscription) {
  if (!subscription) {
    return {
      isActive: false,
      isExpired: true,
      isGracePeriod: false,
      graceUntil: null,
      accessTier: 'blocked',
      daysRemaining: 0,
    };
  }

  const renewAt = subscription.renew_at ? new Date(subscription.renew_at) : null;
  const now = Date.now();
  const renewTime = renewAt?.getTime() || null;
  const statusActive = subscription.status === 'active';
  const isRenewValid = !renewTime || renewTime >= now;
  const graceUntilTime = renewTime ? renewTime + 7 * 24 * 60 * 60 * 1000 : null;
  const isGracePeriod = !isRenewValid && !!graceUntilTime && graceUntilTime >= now;
  const daysRemaining = renewTime ? Math.max(0, Math.ceil((renewTime - now) / (24 * 60 * 60 * 1000))) : 0;

  return {
    isActive: statusActive && isRenewValid,
    isExpired: !statusActive || !isRenewValid,
    isGracePeriod,
    graceUntil: graceUntilTime ? new Date(graceUntilTime).toISOString() : null,
    accessTier: statusActive && isRenewValid ? 'active' : (isGracePeriod ? 'grace' : 'blocked'),
    daysRemaining,
  };
}

function resolveGymWarning(ownerSubscription) {
  if (!ownerSubscription) {
    return 'Assinatura do coach inativa ou expirada';
  }

  if (ownerSubscription.accessTier === 'active') {
    return ownerSubscription.daysRemaining > 0 && ownerSubscription.daysRemaining <= 7
      ? `Assinatura vence em ${ownerSubscription.daysRemaining} dia(s)`
      : null;
  }

  if (ownerSubscription.accessTier === 'grace') {
    return 'Coach em período de graça. Atletas seguem usando o app normalmente.';
  }

  return 'Assinatura do coach inativa ou expirada. Atletas seguem com acesso ao app.';
}
