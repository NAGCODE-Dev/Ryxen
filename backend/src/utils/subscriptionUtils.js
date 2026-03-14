import { pool } from '../db.js';

export function normalizeStripeStatus(status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'inactive';
  return 'pending';
}

export async function upsertSubscriptionRecord({
  userId,
  planId,
  status,
  provider,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  renewAt,
}) {
  if (!userId) return;

  const existing = await pool.query(
    `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
    [stripeSubscriptionId],
  );

  if (existing.rows[0]?.id) {
    await pool.query(
      `UPDATE subscriptions
       SET plan_id = $2,
           status = $3,
           provider = $4,
           stripe_customer_id = $5,
           stripe_price_id = $6,
           renew_at = $7,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, planId, status, provider, stripeCustomerId, stripePriceId, renewAt],
    );
    return;
  }

  await pool.query(
    `INSERT INTO subscriptions (
      user_id,
      plan_id,
      status,
      provider,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      renew_at,
      updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [userId, planId, status, provider, stripeCustomerId, stripeSubscriptionId, stripePriceId, renewAt],
  );
}

export async function handleStripeWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription') return;
      const userId = Number(session.metadata?.userId || 0);
      const planId = String(session.metadata?.planId || 'coach');
      await upsertSubscriptionRecord({
        userId,
        planId,
        status: 'active',
        provider: 'stripe',
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        stripePriceId: null,
        renewAt: null,
      });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = Number(subscription.metadata?.userId || 0);
      const planId = String(subscription.metadata?.planId || 'coach');
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const renewAt = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      const status = normalizeStripeStatus(subscription.status);

      await upsertSubscriptionRecord({
        userId,
        planId,
        status,
        provider: 'stripe',
        stripeCustomerId: subscription.customer || null,
        stripeSubscriptionId: subscription.id || null,
        stripePriceId: priceId,
        renewAt,
      });
      return;
    }
    default:
      return;
  }
}
