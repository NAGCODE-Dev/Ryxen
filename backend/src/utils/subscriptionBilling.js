import { pool } from '../db.js';
import { normalizeEmail } from '../devAccess.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeSubscriptionPlanId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'coach') return 'pro';
  if (raw === 'athlete plus' || raw === 'athlete-plus' || raw === 'athleteplus' || raw === 'plus') {
    return 'athlete_plus';
  }
  if (['starter', 'pro', 'performance', 'athlete_plus'].includes(raw)) return raw;
  return '';
}

export function normalizeCoachPlanId(value) {
  const normalized = normalizeSubscriptionPlanId(value);
  return ['starter', 'pro', 'performance'].includes(normalized) ? normalized : '';
}

export function computeRenewAt({ currentRenewAt = null, renewDays = 30 } = {}) {
  const now = Date.now();
  const currentTime = currentRenewAt ? new Date(currentRenewAt).getTime() : 0;
  const baseTime = Number.isFinite(currentTime) && currentTime > now ? currentTime : now;
  return new Date(baseTime + renewDays * DAY_MS).toISOString();
}

export async function grantSubscriptionToUser({
  userId,
  planId,
  provider,
  renewDays = 30,
  claimId = null,
  client = null,
}) {
  const normalizedPlanId = normalizeSubscriptionPlanId(planId);
  if (!normalizedPlanId) {
    throw new Error('planId inválido');
  }

  const db = client || pool;
  const latestRes = await db.query(
    `SELECT renew_at
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY COALESCE(renew_at, NOW()) DESC, updated_at DESC
     LIMIT 1`,
    [userId],
  );

  const renewAt = computeRenewAt({
    currentRenewAt: latestRes.rows[0]?.renew_at || null,
    renewDays,
  });

  const inserted = await db.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, provider, renew_at, updated_at)
     VALUES ($1,$2,'active',$3,$4,NOW())
     RETURNING id, user_id, plan_id, status, provider, renew_at, updated_at`,
    [userId, normalizedPlanId, String(provider || 'manual'), renewAt],
  );

  const subscription = inserted.rows[0];

  if (claimId) {
    await db.query(
      `UPDATE billing_claims
       SET status = 'applied',
           applied_user_id = $2,
           applied_subscription_id = $3,
           renew_at = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [claimId, userId, subscription.id, renewAt],
    );
  }

  return subscription;
}

export async function attachPendingBillingClaimsToUser(userId, email, client = null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  const db = client || pool;
  const pendingRes = await db.query(
    `SELECT *
     FROM billing_claims
     WHERE email = $1 AND status = 'pending'
     ORDER BY created_at ASC`,
    [normalized],
  );

  const applied = [];
  for (const claim of pendingRes.rows) {
    const result = await applyBillingClaimRecord(claim, {
      userIdOverride: userId,
      client: db,
    });
    if (result.subscription) {
      applied.push(result.subscription);
    }
  }

  return applied;
}

export async function queueBillingClaim({
  provider,
  externalRef,
  email,
  planId,
  renewDays = 30,
  payload = {},
}) {
  const normalized = normalizeEmail(email);
  const normalizedPlanId = normalizeSubscriptionPlanId(planId);
  if (!normalized) {
    throw new Error('email inválido');
  }
  if (!normalizedPlanId) {
    throw new Error('planId inválido');
  }
  if (!externalRef) {
    throw new Error('externalRef é obrigatório');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT *
       FROM billing_claims
       WHERE provider = $1 AND external_ref = $2
       LIMIT 1`,
      [provider, externalRef],
    );

    const duplicate = !!existingRes.rows[0];
    let claim = existingRes.rows[0] || null;

    if (!claim) {
      const insertedRes = await client.query(
        `INSERT INTO billing_claims (
           provider, external_ref, email, plan_id, renew_days, payload, status, updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW())
         RETURNING *`,
        [provider, externalRef, normalized, normalizedPlanId, renewDays, JSON.stringify(payload || {})],
      );
      claim = insertedRes.rows[0];
    }

    const { subscription: appliedSubscription } = await applyBillingClaimRecord(claim, {
      client,
    });

    await client.query('COMMIT');
    return {
      claim,
      subscription: appliedSubscription,
      applied: !!appliedSubscription || claim.status === 'applied',
      duplicate,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function queueBillingReversalClaim({
  provider,
  externalRef,
  email,
  planId,
  payload = {},
  subscriptionStatus = 'canceled',
}) {
  const normalized = normalizeEmail(email);
  const fallbackPlanId = planId || await resolveLatestPlanForEmail(normalized);
  const normalizedPlanId = normalizeSubscriptionPlanId(fallbackPlanId);

  if (!normalized) {
    throw new Error('email inválido');
  }
  if (!normalizedPlanId) {
    throw new Error('planId inválido');
  }
  if (!externalRef) {
    throw new Error('externalRef é obrigatório');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT *
       FROM billing_claims
       WHERE provider = $1 AND external_ref = $2
       LIMIT 1`,
      [provider, externalRef],
    );

    const duplicate = !!existingRes.rows[0];
    let claim = existingRes.rows[0] || null;

    if (!claim) {
      const insertedRes = await client.query(
        `INSERT INTO billing_claims (
           provider, external_ref, email, plan_id, renew_days, payload, status, updated_at
         )
         VALUES ($1,$2,$3,$4,0,$5,'pending',NOW())
         RETURNING *`,
        [
          provider,
          externalRef,
          normalized,
          normalizedPlanId,
          JSON.stringify({
            ...(payload || {}),
            billingAction: 'reversal',
            subscriptionStatus,
          }),
        ],
      );
      claim = insertedRes.rows[0];
    }

    const { subscription: appliedSubscription } = await applyBillingClaimRecord(claim, {
      client,
    });

    await client.query('COMMIT');
    return {
      claim,
      subscription: appliedSubscription,
      applied: !!appliedSubscription || claim.status === 'applied',
      duplicate,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function reprocessBillingClaim(claimId, { force = false } = {}) {
  const normalizedClaimId = Number(claimId);
  if (!Number.isFinite(normalizedClaimId) || normalizedClaimId <= 0) {
    throw new Error('claimId inválido');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const claimRes = await client.query(
      `SELECT *
       FROM billing_claims
       WHERE id = $1
       LIMIT 1`,
      [normalizedClaimId],
    );

    const claim = claimRes.rows[0] || null;
    if (!claim) {
      await client.query('ROLLBACK');
      return { claim: null, subscription: null, applied: false };
    }

    if (claim.status === 'applied' && !force) {
      const subscriptionRes = claim.applied_subscription_id
        ? await client.query(
          `SELECT id, user_id, plan_id, status, provider, renew_at, updated_at
           FROM subscriptions
           WHERE id = $1
           LIMIT 1`,
          [claim.applied_subscription_id],
        )
        : { rows: [] };
      await client.query('COMMIT');
      return {
        claim,
        subscription: subscriptionRes.rows[0] || null,
        applied: true,
      };
    }

    const result = await applyBillingClaimRecord(claim, { client });
    await client.query('COMMIT');
    return {
      claim: result.claim,
      subscription: result.subscription,
      applied: result.applied,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveLatestPlanForEmail(email, client = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return '';

  const db = client || pool;
  const latestSubscriptionRes = await db.query(
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

  const latestClaimRes = await db.query(
    `SELECT plan_id
     FROM billing_claims
     WHERE email = $1
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [normalizedEmail],
  );

  return normalizeSubscriptionPlanId(latestClaimRes.rows[0]?.plan_id || '');
}

export function isReversalClaimPayload(payload) {
  const data = normalizeClaimPayload(payload);
  return data?.billingAction === 'reversal';
}

async function applyBillingClaimRecord(claim, { userIdOverride = null, client = null } = {}) {
  const db = client || pool;
  const payload = normalizeClaimPayload(claim?.payload);
  const normalizedEmail = normalizeEmail(claim?.email);
  const normalizedPlanId = normalizeSubscriptionPlanId(claim?.plan_id);

  if (!normalizedEmail || !normalizedPlanId) {
    return { claim, subscription: null, applied: false };
  }

  const user = userIdOverride
    ? { id: userIdOverride }
    : await findUserByEmail(normalizedEmail, db);

  if (!user?.id) {
    return { claim, subscription: null, applied: false };
  }

  const subscription = isReversalClaimPayload(payload)
    ? await revokeSubscriptionForUser({
      userId: user.id,
      planId: normalizedPlanId,
      provider: 'kiwify_webhook',
      subscriptionStatus: payload?.subscriptionStatus || 'canceled',
      claimId: claim.id,
      client: db,
    })
    : await grantSubscriptionToUser({
      userId: user.id,
      planId: normalizedPlanId,
      provider: 'kiwify_webhook',
      renewDays: Number(claim.renew_days) || 30,
      claimId: claim.id,
      client: db,
    });

  const refreshedClaimRes = await db.query(
    `SELECT *
     FROM billing_claims
     WHERE id = $1
     LIMIT 1`,
    [claim.id],
  );

  return {
    claim: refreshedClaimRes.rows[0] || claim,
    subscription,
    applied: !!subscription,
  };
}

async function revokeSubscriptionForUser({
  userId,
  planId,
  provider,
  subscriptionStatus = 'canceled',
  claimId = null,
  client = null,
}) {
  const normalizedPlanId = normalizeSubscriptionPlanId(planId);
  if (!normalizedPlanId) {
    throw new Error('planId inválido');
  }

  const nextStatus = normalizeReversalSubscriptionStatus(subscriptionStatus);
  const db = client || pool;
  const latestRes = await db.query(
    `SELECT id, user_id, plan_id, status, provider, renew_at, updated_at
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY CASE WHEN plan_id = $2 THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1`,
    [userId, normalizedPlanId],
  );

  const latest = latestRes.rows[0] || null;
  const renewAt = nextStatus === 'past_due'
    ? (latest?.renew_at || new Date().toISOString())
    : new Date().toISOString();

  let subscription = null;
  if (latest?.id) {
    const updatedRes = await db.query(
      `UPDATE subscriptions
       SET status = $2,
           provider = $3,
           renew_at = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, plan_id, status, provider, renew_at, updated_at`,
      [latest.id, nextStatus, String(provider || 'manual'), renewAt],
    );
    subscription = updatedRes.rows[0] || null;
  } else {
    const insertedRes = await db.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, renew_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       RETURNING id, user_id, plan_id, status, provider, renew_at, updated_at`,
      [userId, normalizedPlanId, nextStatus, String(provider || 'manual'), renewAt],
    );
    subscription = insertedRes.rows[0] || null;
  }

  if (claimId && subscription) {
    await db.query(
      `UPDATE billing_claims
       SET status = 'applied',
           applied_user_id = $2,
           applied_subscription_id = $3,
           renew_at = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [claimId, userId, subscription.id, subscription.renew_at],
    );
  }

  return subscription;
}

async function findUserByEmail(email, db) {
  const result = await db.query(
    `SELECT id
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
  return result.rows[0] || null;
}

function normalizeClaimPayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return typeof payload === 'object' ? payload : {};
}

function normalizeReversalSubscriptionStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'refunded') return 'refunded';
  if (normalized === 'chargeback') return 'chargeback';
  if (normalized === 'past_due') return 'past_due';
  return 'canceled';
}
