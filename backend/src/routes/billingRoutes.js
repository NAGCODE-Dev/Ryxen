import express from 'express';

import { pool } from '../db.js';
import { BACKEND_PUBLIC_URL, DEFAULT_BILLING_CANCEL_URL, DEFAULT_BILLING_SUCCESS_URL } from '../config.js';
import { isDeveloperEmail } from '../devAccess.js';
import { getAccessContextForUser, getSubscriptionAccessState } from '../access.js';
import { buildEntitlements } from '../accessPolicy.js';
import { authRequired } from '../auth.js';
import { createMercadoPagoPreference, fetchMercadoPagoPayment, hasMercadoPagoConfigured, normalizeMercadoPagoStatus, resolveMercadoPagoPlan } from '../mercadopago.js';
import { getStripeClient, getStripeWebhookSecret, hasStripeConfigured, resolveStripePriceId } from '../stripe.js';
import { handleStripeWebhookEvent, upsertSubscriptionRecord } from '../utils/subscriptionUtils.js';

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

  router.post('/mercadopago/webhook', express.json({ limit: '256kb' }), async (req, res) => {
    try {
      if (!hasMercadoPagoConfigured()) {
        return res.status(200).json({ received: true, ignored: true });
      }

      const paymentId = resolveMercadoPagoPaymentId(req);
      if (!paymentId) {
        return res.status(200).json({ received: true, ignored: true });
      }

      const payment = await fetchMercadoPagoPayment(paymentId);
      await syncMercadoPagoPayment(payment);
      return res.json({ received: true });
    } catch (error) {
      console.error('[mercadopago:webhook] erro ao processar', error);
      return res.status(500).json({ error: 'Erro ao processar webhook Mercado Pago' });
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

    if (selectedProvider === 'mercadopago' && hasMercadoPagoConfigured()) {
      const plan = resolveMercadoPagoPlan(planId);
      if (!plan?.amount) {
        return res.status(400).json({ error: 'Preço Mercado Pago não configurado para este plano' });
      }

      const userResult = await pool.query(`SELECT id, email, name FROM users WHERE id = $1`, [req.user.userId]);
      const user = userResult.rows[0] || null;
      const externalReference = `coach:${req.user.userId}:${String(planId)}:${Date.now()}`;
      const resolvedSuccessUrl = appendProviderQuery(successUrl || DEFAULT_BILLING_SUCCESS_URL, 'mercadopago');
      const resolvedCancelUrl = appendProviderQuery(cancelUrl || DEFAULT_BILLING_CANCEL_URL, 'mercadopago');
      const notificationUrl = BACKEND_PUBLIC_URL
        ? new URL('/billing/mercadopago/webhook', BACKEND_PUBLIC_URL).toString()
        : undefined;
      const preference = await createMercadoPagoPreference({
        title: `CrossApp ${String(planId).toUpperCase()}`,
        planId,
        amount: plan.amount,
        payerEmail: user?.email || req.user.email,
        externalReference,
        successUrl: resolvedSuccessUrl,
        cancelUrl: resolvedCancelUrl,
        pendingUrl: resolvedSuccessUrl,
        notificationUrl,
        metadata: {
          userId: String(req.user.userId),
          planId: String(planId),
        },
      });

      await pool.query(
        `INSERT INTO subscriptions (
          user_id, plan_id, status, provider, mercadopago_preference_id, mercadopago_external_reference, updated_at
        ) VALUES ($1,$2,'pending','mercadopago',$3,$4,NOW())`,
        [req.user.userId, String(planId), preference.id || null, externalReference],
      );

      return res.json({
        checkoutUrl: preference.init_point || preference.sandbox_init_point,
        mode: 'mercadopago',
        preferenceId: preference.id || null,
      });
    }

    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, updated_at) VALUES ($1,$2,'pending',$3,NOW())`,
      [req.user.userId, String(planId), selectedProvider],
    );

    const checkoutUrl = `${successUrl || cancelUrl || DEFAULT_BILLING_SUCCESS_URL}`;
    return res.json({ checkoutUrl, mode: 'mock' });
  });

  router.post('/mercadopago/confirm', authRequired, async (req, res) => {
    if (!hasMercadoPagoConfigured()) {
      return res.status(400).json({ error: 'Mercado Pago não configurado' });
    }

    const paymentId = String(req.body?.paymentId || '').trim();
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId é obrigatório' });
    }

    const payment = await fetchMercadoPagoPayment(paymentId);
    const subscription = await syncMercadoPagoPayment(payment, req.user.userId);
    return res.json({
      success: true,
      paymentId,
      status: payment.status || 'unknown',
      subscription,
    });
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

function appendProviderQuery(urlString, provider) {
  try {
    const url = new URL(String(urlString || DEFAULT_BILLING_SUCCESS_URL));
    url.searchParams.set('provider', provider);
    return url.toString();
  } catch {
    return String(urlString || DEFAULT_BILLING_SUCCESS_URL);
  }
}

function resolveMercadoPagoPaymentId(req) {
  const candidates = [
    req.body?.data?.id,
    req.body?.id,
    req.query?.['data.id'],
    req.query?.id,
  ];
  const paymentId = candidates.find(Boolean);
  return paymentId ? String(paymentId).trim() : '';
}

async function syncMercadoPagoPayment(payment, expectedUserId = null) {
  const paymentId = String(payment?.id || '').trim();
  const externalReference = String(payment?.external_reference || '').trim();
  const [scope, userIdRaw, planIdRaw] = externalReference.split(':');
  const userId = Number(userIdRaw || 0);
  const planId = String(planIdRaw || payment?.metadata?.planId || 'coach');

  if (scope !== 'coach' || !userId) {
    throw new Error('Pagamento Mercado Pago sem external_reference compatível');
  }

  if (expectedUserId && Number(expectedUserId) !== userId) {
    throw new Error('Pagamento não pertence ao usuário autenticado');
  }

  const status = normalizeMercadoPagoStatus(payment?.status);
  const approvedAt = payment?.date_approved ? new Date(payment.date_approved) : new Date();
  const renewAt = status === 'active'
    ? new Date(approvedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await upsertSubscriptionRecord({
    userId,
    planId,
    status,
    provider: 'mercadopago',
    mercadopagoPaymentId: paymentId || null,
    mercadopagoPreferenceId: payment?.order?.id ? String(payment.order.id) : null,
    mercadopagoExternalReference: externalReference || null,
    renewAt,
  });

  return {
    plan: planId,
    status,
    provider: 'mercadopago',
    renewAt,
  };
}
