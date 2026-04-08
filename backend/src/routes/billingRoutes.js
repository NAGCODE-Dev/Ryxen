import express from 'express';

import { pool } from '../db.js';
import {
  DEFAULT_BILLING_SUCCESS_URL,
  KIWIFY_PRODUCT_ATHLETE_PLUS_ID,
  KIWIFY_PRODUCT_PERFORMANCE_ID,
  KIWIFY_PRODUCT_PRO_ID,
  KIWIFY_PRODUCT_STARTER_ID,
  KIWIFY_WEBHOOK_TOKEN,
} from '../config.js';
import { isDeveloperEmail, normalizeEmail } from '../devAccess.js';
import { authRequired } from '../auth.js';
import { getKiwifySaleById, isKiwifyNativeApiConfigured } from '../kiwifyApi.js';
import { getBillingStatusSnapshot, getEntitlementsSnapshot, resolveFallbackBillingPlanId } from '../queries/billingQueries.js';
import {
  extractKiwifyCustomerEmail as extractWebhookCustomerEmail,
  getKiwifyBillingAction as getWebhookBillingAction,
  getKiwifyReversalStatus as getWebhookReversalStatus,
  extractKiwifyEventType as extractWebhookEventType,
  extractKiwifyExternalRef as extractWebhookExternalRef,
  extractKiwifySaleId as extractWebhookSaleId,
  isApprovedKiwifyEvent as isApprovedWebhookEvent,
  isValidKiwifyToken as isValidWebhookToken,
  normalizeKiwifyPayload as normalizeWebhookPayload,
  resolveKiwifyPlanId as resolveWebhookPlanId,
} from '../kiwifyWebhook.js';
import {
  grantSubscriptionToUser,
  normalizeSubscriptionPlanId,
  queueBillingClaim,
  queueBillingReversalClaim,
} from '../utils/subscriptionBilling.js';
import { logOpsEvent } from '../opsEvents.js';

export function createBillingRouter() {
  const router = express.Router();

  router.get('/status', authRequired, async (req, res) => {
    const status = await getBillingStatusSnapshot(req.user.userId);
    return res.json(status);
  });

  router.post('/checkout', authRequired, async (req, res) => {
    const { planId, provider } = req.body || {};
    if (!planId) {
      return res.status(400).json({ error: 'planId é obrigatório' });
    }

    const selectedProvider = String(provider || 'mock').trim().toLowerCase();
    if (selectedProvider !== 'mock') {
      return res.status(400).json({
        error: 'Provider não suportado no backend atual. Use kiwify_link no frontend ou mock em desenvolvimento.',
      });
    }

    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, updated_at) VALUES ($1,$2,'pending',$3,NOW())`,
      [req.user.userId, String(planId), selectedProvider],
    );

    return res.json({ checkoutUrl: DEFAULT_BILLING_SUCCESS_URL, mode: 'mock' });
  });

  router.post('/kiwify/webhook', async (req, res) => {
    if (!isValidWebhookToken(req)) {
      await logOpsEvent({
        kind: 'billing_webhook',
        status: 'invalid_token',
        payload: { path: '/billing/kiwify/webhook' },
      });
      return res.status(401).json({ error: 'Token do webhook inválido' });
    }

    const payload = normalizeWebhookPayload(req.body);
    const eventType = extractWebhookEventType(payload);
    const verifiedSale = await tryVerifyKiwifySale(payload);
    const billingAction = getWebhookBillingAction(eventType, payload, verifiedSale);
    if (billingAction === 'ignore') {
      await logOpsEvent({
        kind: 'billing_webhook',
        status: 'ignored_non_approved',
        payload: { eventType },
      });
      return res.json({ ok: true, ignored: true, reason: 'Evento não-aprovado' });
    }

    const sources = [payload, verifiedSale].filter(Boolean);
    const email = extractWebhookCustomerEmail(...sources);
    const resolvedPlanId = resolveWebhookPlanId(...sources);
    const planId = resolvedPlanId || await resolveFallbackBillingPlanId({ email });
    const externalRef = extractWebhookExternalRef(eventType, ...sources);

    if (!email || !planId || !externalRef) {
      console.warn('[kiwify:webhook] payload incompleto', {
        eventType,
        email,
        planId,
        externalRef,
      });
      await logOpsEvent({
        kind: 'billing_webhook',
        status: 'failed_incomplete_payload',
        email,
        payload: { eventType, planId, externalRef },
      });
      return res.status(422).json({
        error: 'Não foi possível identificar email, plano ou referência externa',
      });
    }

    const result = billingAction === 'reversal'
      ? await queueBillingReversalClaim({
        provider: 'kiwify',
        externalRef,
        email,
        planId,
        payload: {
          ...payload,
          verifiedSale,
          eventType,
        },
        subscriptionStatus: getWebhookReversalStatus(eventType, payload, verifiedSale) || 'canceled',
      })
      : await queueBillingClaim({
        provider: 'kiwify',
        externalRef,
        email,
        planId,
        renewDays: 30,
        payload: {
          ...payload,
          verifiedSale,
          eventType,
        },
      });

    await logOpsEvent({
      kind: 'billing_webhook',
      status: billingAction === 'reversal'
        ? (result.applied ? 'reversed' : 'queued_reversal')
        : (result.applied ? 'applied' : 'queued'),
      email,
      payload: { eventType, planId, externalRef, billingAction },
    });

    return res.json({
      ok: true,
      applied: result.applied,
      planId,
      billingAction,
      email: normalizeEmail(email),
      externalRef,
    });
  });

  router.get('/entitlements', authRequired, async (req, res) => {
    const snapshot = await getEntitlementsSnapshot({
      userId: req.user.userId,
      email: req.user.email,
    });
    return res.json(snapshot);
  });

  router.post('/mock/activate', authRequired, async (req, res) => {
    if (!isDeveloperEmail(req.user.email)) {
      return res.status(403).json({ error: 'Acesso restrito ao ambiente de desenvolvimento' });
    }

    const { planId = 'coach', provider = 'mock' } = req.body || {};
    await grantSubscriptionToUser({
      userId: req.user.userId,
      planId,
      provider,
      renewDays: 30,
    });
    return res.json({ success: true });
  });

  return router;
}

function isValidKiwifyToken(req) {
  if (!KIWIFY_WEBHOOK_TOKEN) return false;

  const headerAuth = String(req.headers.authorization || '').trim();
  const bearerToken = headerAuth.toLowerCase().startsWith('bearer ')
    ? headerAuth.slice(7).trim()
    : '';

  const candidates = [
    req.headers['x-kiwify-webhook-token'],
    req.headers['x-kiwify-token'],
    req.headers['x-webhook-token'],
    req.query?.token,
    req.body?.token,
    req.body?.webhook_token,
    bearerToken,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return candidates.includes(KIWIFY_WEBHOOK_TOKEN);
}

function extractKiwifyEventType(payload) {
  return String(
    payload?.event
    || payload?.type
    || payload?.webhook_event_type
    || payload?.event_type
    || payload?.data?.event
    || payload?.data?.type
    || '',
  ).trim();
}

function normalizeKiwifyPayload(body) {
  const payload = body && typeof body === 'object' ? { ...body } : {};

  for (const key of ['data', 'payload']) {
    if (typeof payload[key] === 'string') {
      try {
        payload[key] = JSON.parse(payload[key]);
      } catch {
        // keep original string when not valid JSON
      }
    }
  }

  return payload;
}

function isApprovedKiwifyEvent(eventType) {
  const normalizedEvent = normalizeText(eventType);
  if (normalizedEvent.includes('aprov') || normalizedEvent.includes('approved')) {
    return true;
  }

  const statusCandidates = Array.from(arguments).slice(1).flatMap((source) => [
    source?.status,
    source?.order_status,
    source?.payment_status,
    source?.sale_status,
    source?.data?.status,
    source?.data?.order_status,
    source?.data?.payment_status,
    source?.sale?.status,
    source?.sale?.order_status,
    source?.sale?.payment_status,
  ])
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return statusCandidates.some((value) => value.includes('aprov') || value === 'paid' || value === 'approved');
}

function extractKiwifyCustomerEmail(payload) {
  const candidates = Array.from(arguments).flatMap((source) => [
    source?.customer?.email,
    source?.Customer?.email,
    source?.buyer?.email,
    source?.Buyer?.email,
    source?.subscriber?.email,
    source?.Subscription?.subscriber_email,
    source?.order?.customer?.email,
    source?.data?.customer?.email,
    source?.data?.Customer?.email,
    source?.sale?.customer_email,
    source?.sale?.customer?.email,
    source?.sale?.buyer?.email,
    source?.sale?.email,
    source?.email,
  ]);

  return candidates
    .map((value) => normalizeEmail(value))
    .find(Boolean) || '';
}

function extractKiwifyExternalRef(eventType) {
  const candidates = Array.from(arguments).slice(1).flatMap((source) => [
    source?.transaction_id,
    source?.payment_id,
    source?.sale_id,
    source?.invoice_id,
    source?.subscription_id,
    source?.id,
    source?.data?.transaction_id,
    source?.data?.payment_id,
    source?.data?.sale_id,
    source?.data?.invoice_id,
    source?.order_id,
    source?.order?.id,
    source?.data?.order_id,
    source?.data?.id,
    source?.sale?.id,
    source?.sale?.sale_id,
    source?.sale?.order_id,
  ])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (candidates[0]) return `${normalizeText(eventType) || 'event'}:${candidates[0]}`;
  return '';
}

function resolveKiwifyPlanId() {
  const productIds = Array.from(arguments).flatMap((source) => [
    source?.product_id,
    source?.product?.id,
    source?.Product?.id,
    source?.order?.product?.id,
    source?.data?.product?.id,
    source?.sale?.product_id,
    source?.sale?.product?.id,
  ])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const productId of productIds) {
    if (KIWIFY_PRODUCT_ATHLETE_PLUS_ID && productId === KIWIFY_PRODUCT_ATHLETE_PLUS_ID) return 'athlete_plus';
    if (KIWIFY_PRODUCT_STARTER_ID && productId === KIWIFY_PRODUCT_STARTER_ID) return 'starter';
    if (KIWIFY_PRODUCT_PRO_ID && productId === KIWIFY_PRODUCT_PRO_ID) return 'pro';
    if (KIWIFY_PRODUCT_PERFORMANCE_ID && productId === KIWIFY_PRODUCT_PERFORMANCE_ID) return 'performance';
  }

  const productNames = Array.from(arguments).flatMap((source) => [
    source?.product_name,
    source?.product?.name,
    source?.Product?.name,
    source?.order?.product?.name,
    source?.data?.product?.name,
    source?.offer_name,
    source?.sale?.product_name,
    source?.sale?.product?.name,
  ])
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const name of productNames) {
    if (name.includes('atleta plus') || name.includes('athlete plus')) return 'athlete_plus';
    if (name.includes('starter')) return 'starter';
    if (name.includes('performance') || name.includes('perfomance')) return 'performance';
    if (name.includes('coach pro') || name.endsWith(' pro') || name.includes(' pro ')) return 'pro';
  }

  return normalizeSubscriptionPlanId(productNames[0] || '');
}

async function tryVerifyKiwifySale(payload) {
  if (!isKiwifyNativeApiConfigured()) return null;

  const saleId = extractWebhookSaleId(payload);
  if (!saleId) return null;

  try {
    return await getKiwifySaleById(saleId);
  } catch (error) {
    console.warn('[kiwify:verify] falha ao validar venda na API nativa', error?.message || error);
    return null;
  }
}

function extractKiwifySaleId(payload) {
  return [
    payload?.sale_id,
    payload?.data?.sale_id,
    payload?.id,
    payload?.data?.id,
    payload?.order?.id,
    payload?.order_id,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
