import express from 'express';

import { buildRequestAuditContext } from '../adminAudit.js';
import { pool } from '../db.js';
import {
  DEFAULT_BILLING_SUCCESS_URL,
} from '../config.js';
import { canUseDeveloperTools, normalizeEmail } from '../devAccess.js';
import { authRequired } from '../auth.js';
import { getKiwifySaleById, isKiwifyNativeApiConfigured } from '../kiwifyApi.js';
import { getBillingStatusSnapshot, getEntitlementsSnapshot, resolveFallbackBillingPlanId } from '../queries/billingQueries.js';
import {
  extractKiwifyCustomerEmail as extractWebhookCustomerEmail,
  describeKiwifyTokenTransport,
  getKiwifyBillingAction as getWebhookBillingAction,
  getKiwifyReversalStatus as getWebhookReversalStatus,
  extractKiwifyEventType as extractWebhookEventType,
  extractKiwifyExternalRef as extractWebhookExternalRef,
  extractKiwifySaleId as extractWebhookSaleId,
  isValidKiwifyToken as isValidWebhookToken,
  normalizeKiwifyPayload as normalizeWebhookPayload,
  resolveKiwifyPlanId as resolveWebhookPlanId,
} from '../kiwifyWebhook.js';
import {
  grantSubscriptionToUser,
  queueBillingClaim,
  queueBillingReversalClaim,
} from '../utils/subscriptionBilling.js';
import { logOpsEvent } from '../opsEvents.js';

export function createBillingRouter({
  authMiddleware = authRequired,
  billingReadRateLimit = (_req, _res, next) => next(),
  billingWriteRateLimit = (_req, _res, next) => next(),
  billingWebhookRateLimit = (_req, _res, next) => next(),
  logOpsEventFn = logOpsEvent,
  queueBillingClaimFn = queueBillingClaim,
  queueBillingReversalClaimFn = queueBillingReversalClaim,
  resolveFallbackBillingPlanIdFn = resolveFallbackBillingPlanId,
  verifyKiwifySaleFn = tryVerifyKiwifySale,
  validateWebhookTokenFn = isValidWebhookToken,
  describeWebhookTokenTransportFn = describeKiwifyTokenTransport,
} = {}) {
  const router = express.Router();

  router.get('/status', billingReadRateLimit, authMiddleware, async (req, res) => {
    const status = await getBillingStatusSnapshot(req.user.userId);
    return res.json(status);
  });

  router.post('/checkout', billingWriteRateLimit, authMiddleware, async (req, res) => {
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

  router.post('/kiwify/webhook', billingWebhookRateLimit, async (req, res) => {
    const tokenTransport = describeWebhookTokenTransportFn(req);
    if (!validateWebhookTokenFn(req)) {
      await logOpsEventFn({
        kind: 'billing_webhook',
        status: tokenTransport === 'query' || tokenTransport === 'body' ? 'rejected_token_transport' : 'invalid_token',
        payload: {
          ...buildWebhookAuditPayload(req, { tokenTransport }),
          path: '/billing/kiwify/webhook',
        },
      });
      return res.status(401).json({
        error: tokenTransport === 'query' || tokenTransport === 'body'
          ? 'Token do webhook deve ser enviado por header'
          : 'Token do webhook inválido',
      });
    }

    const payload = normalizeWebhookPayload(req.body);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      await logOpsEventFn({
        kind: 'billing_webhook',
        status: 'invalid_payload',
        payload: buildWebhookAuditPayload(req, { tokenTransport }),
      });
      return res.status(400).json({ error: 'Payload do webhook inválido' });
    }

    const eventType = extractWebhookEventType(payload);
    if (!eventType) {
      await logOpsEventFn({
        kind: 'billing_webhook',
        status: 'missing_event_type',
        payload: buildWebhookAuditPayload(req, { tokenTransport }),
      });
      return res.status(422).json({ error: 'Evento do webhook não identificado' });
    }

    const verifiedSale = await verifyKiwifySaleFn(payload);
    const billingAction = getWebhookBillingAction(eventType, payload, verifiedSale);
    if (billingAction === 'ignore') {
      await logOpsEventFn({
        kind: 'billing_webhook',
        status: 'ignored_non_approved',
        payload: buildWebhookAuditPayload(req, {
          eventType,
          tokenTransport,
          verifiedSale: !!verifiedSale,
        }),
      });
      return res.json({ ok: true, ignored: true, reason: 'Evento não-aprovado' });
    }

    const sources = [verifiedSale, payload].filter(Boolean);
    const email = extractWebhookCustomerEmail(...sources);
    const resolvedPlanId = resolveWebhookPlanId(...sources);
    const planId = resolvedPlanId || await resolveFallbackBillingPlanIdFn({ email });
    const externalRef = extractWebhookExternalRef(eventType, ...sources);

    if (!email || !planId || !externalRef) {
      console.warn('[kiwify:webhook] payload incompleto', {
        eventType,
        email,
        planId,
        externalRef,
      });
      await logOpsEventFn({
        kind: 'billing_webhook',
        status: 'failed_incomplete_payload',
        email,
        payload: buildWebhookAuditPayload(req, {
          eventType,
          planId,
          externalRef,
          tokenTransport,
          verifiedSale: !!verifiedSale,
        }),
      });
      return res.status(422).json({
        error: 'Não foi possível identificar email, plano ou referência externa',
      });
    }

    const result = billingAction === 'reversal'
      ? await queueBillingReversalClaimFn({
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
      : await queueBillingClaimFn({
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

    await logOpsEventFn({
      kind: 'billing_webhook',
      status: billingAction === 'reversal'
        ? (result.applied ? 'reversed' : 'queued_reversal')
        : (result.applied ? 'applied' : 'queued'),
      email,
      payload: buildWebhookAuditPayload(req, {
        eventType,
        planId,
        externalRef,
        billingAction,
        tokenTransport,
        duplicate: !!result.duplicate,
        verifiedSale: !!verifiedSale,
      }),
    });

    return res.json({
      ok: true,
      applied: result.applied,
      duplicate: !!result.duplicate,
      planId,
      billingAction,
      email: normalizeEmail(email),
      externalRef,
    });
  });

  router.get('/entitlements', billingReadRateLimit, authMiddleware, async (req, res) => {
    const snapshot = await getEntitlementsSnapshot({
      userId: req.user.userId,
      email: req.user.email,
      isAdmin: !!req.user?.isAdmin,
    });
    return res.json(snapshot);
  });

  router.post('/mock/activate', billingWriteRateLimit, authMiddleware, async (req, res) => {
    if (!canUseDeveloperTools(req.user)) {
      return res.status(403).json({ error: 'Acesso restrito a admin ou ambiente de desenvolvimento' });
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

function buildWebhookAuditPayload(req, payload = {}) {
  return {
    ...buildRequestAuditContext(req),
    ...(payload || {}),
  };
}
