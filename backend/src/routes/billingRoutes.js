import express from 'express';

import { pool } from '../db.js';
import { DEFAULT_BILLING_CANCEL_URL, DEFAULT_BILLING_SUCCESS_URL } from '../config.js';
import { isDeveloperEmail } from '../devAccess.js';
import { getAccessContextForUser, getSubscriptionAccessState } from '../access.js';
import { buildEntitlements } from '../accessPolicy.js';
import { authRequired } from '../auth.js';
import { getStripeClient, getStripeWebhookSecret, hasStripeConfigured, resolveStripePriceId } from '../stripe.js';
import { handleStripeWebhookEvent } from '../utils/subscriptionUtils.js';

export function createBillingWebhookRouter() {
  const router = express.Router();

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripeClient();
    const sig = req.headers['stripe-signature'];

    if (!stripe || !sig || !getStripeWebhookSecret()) {
      return res.status(400).send('Stripe não configurado');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, getStripeWebhookSecret());
    } catch (error) {
      console.error('[stripe:webhook] assinatura inválida', error?.message || error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      await handleStripeWebhookEvent(event);
      return res.json({ received: true });
    } catch (error) {
      console.error('[stripe:webhook] erro ao processar evento', error);
      return res.status(500).json({ error: 'Erro ao processar webhook Stripe' });
    }
  });

  return router;
}

export function createBillingRouter() {
  const router = express.Router();

  router.get('/status', authRequired, async (req, res) => {
    const row = await pool.query(
      `SELECT plan_id, status, provider, renew_at, updated_at FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`,
      [req.user.userId],
    );
    const latest = row.rows[0] || null;
    const accessState = getSubscriptionAccessState(latest);
    return res.json({
      plan: latest?.plan_id || 'free',
      status: latest?.status || 'inactive',
      provider: latest?.provider || 'mock',
      renewAt: latest?.renew_at || null,
      updatedAt: latest?.updated_at || null,
      accessTier: accessState.accessTier,
      isGracePeriod: accessState.isGracePeriod,
      graceUntil: accessState.graceUntil,
      daysRemaining: accessState.daysRemaining,
    });
  });

  router.post('/checkout', authRequired, async (req, res) => {
    const { planId, provider, successUrl, cancelUrl } = req.body || {};
    if (!planId) {
      return res.status(400).json({ error: 'planId é obrigatório' });
    }

    const selectedProvider = provider || 'mock';
    if (selectedProvider === 'stripe' && hasStripeConfigured()) {
      const stripe = getStripeClient();
      const priceId = resolveStripePriceId(planId);
      if (!priceId) {
        return res.status(400).json({ error: 'Preço Stripe não configurado para este plano' });
      }

      const userResult = await pool.query(`SELECT id, email, name FROM users WHERE id = $1`, [req.user.userId]);
      const user = userResult.rows[0];
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: successUrl || DEFAULT_BILLING_SUCCESS_URL,
        cancel_url: cancelUrl || DEFAULT_BILLING_CANCEL_URL,
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user?.email || req.user.email,
        allow_promotion_codes: true,
        metadata: {
          userId: String(req.user.userId),
          planId: String(planId),
        },
        subscription_data: {
          metadata: {
            userId: String(req.user.userId),
            planId: String(planId),
          },
        },
      });

      await pool.query(
        `INSERT INTO subscriptions (user_id, plan_id, status, provider, stripe_price_id, updated_at)
         VALUES ($1,$2,'pending','stripe',$3,NOW())`,
        [req.user.userId, String(planId), priceId],
      );

      return res.json({ checkoutUrl: session.url, mode: 'stripe', sessionId: session.id });
    }

    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, updated_at) VALUES ($1,$2,'pending',$3,NOW())`,
      [req.user.userId, String(planId), selectedProvider],
    );

    const checkoutUrl = `${successUrl || cancelUrl || DEFAULT_BILLING_SUCCESS_URL}`;
    return res.json({ checkoutUrl, mode: 'mock' });
  });

  router.get('/entitlements', authRequired, async (req, res) => {
    const row = await pool.query(
      `SELECT plan_id, status, provider, renew_at, updated_at FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`,
      [req.user.userId],
    );
    const sub = row.rows[0];
    const gymContexts = await getAccessContextForUser(req.user.userId);
    const entitlements = buildEntitlements({ subscription: sub, gymContexts });
    const accessState = getSubscriptionAccessState(sub);

    return res.json({
      entitlements: Array.from(new Set(entitlements)),
      subscription: {
        plan: sub?.plan_id || 'free',
        status: sub?.status || 'inactive',
        provider: sub?.provider || 'mock',
        renewAt: sub?.renew_at || null,
        updatedAt: sub?.updated_at || null,
        accessTier: accessState.accessTier,
        isGracePeriod: accessState.isGracePeriod,
        graceUntil: accessState.graceUntil,
        daysRemaining: accessState.daysRemaining,
      },
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
    });
  });

  router.post('/mock/activate', authRequired, async (req, res) => {
    if (!isDeveloperEmail(req.user.email)) {
      return res.status(403).json({ error: 'Acesso restrito ao ambiente de desenvolvimento' });
    }

    const { planId = 'coach', provider = 'mock' } = req.body || {};
    const renewAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, renew_at, updated_at)
       VALUES ($1,$2,'active',$3,$4,NOW())`,
      [req.user.userId, planId, provider, renewAt],
    );
    return res.json({ success: true });
  });

  return router;
}
