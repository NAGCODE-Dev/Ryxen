import { normalizeEmail } from './devAccess.js';
import {
  KIWIFY_PRODUCT_ATHLETE_PLUS_ID,
  KIWIFY_PRODUCT_PERFORMANCE_ID,
  KIWIFY_PRODUCT_PRO_ID,
  KIWIFY_PRODUCT_STARTER_ID,
  KIWIFY_WEBHOOK_TOKEN,
} from './config.js';
import { normalizeSubscriptionPlanId } from './utils/subscriptionBilling.js';

export function isValidKiwifyToken(req) {
  if (!KIWIFY_WEBHOOK_TOKEN) return false;

  const headerAuth = String(req.headers.authorization || '').trim();
  const bearerToken = headerAuth.toLowerCase().startsWith('bearer ')
    ? headerAuth.slice(7).trim()
    : '';

  const candidates = [
    req.headers['x-kiwify-webhook-token'],
    req.headers['x-kiwify-token'],
    req.headers['x-webhook-token'],
    bearerToken,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return candidates.includes(KIWIFY_WEBHOOK_TOKEN);
}

export function extractKiwifyEventType(payload) {
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

export function normalizeKiwifyPayload(body) {
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

export function isApprovedKiwifyEvent(eventType) {
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

export function getKiwifyReversalStatus(eventType) {
  const normalizedEvent = normalizeText(eventType);
  if (normalizedEvent.includes('reembolso') || normalizedEvent.includes('refund')) {
    return 'refunded';
  }
  if (normalizedEvent.includes('chargeback')) {
    return 'chargeback';
  }
  if (normalizedEvent.includes('cancel')) {
    return 'canceled';
  }
  if (normalizedEvent.includes('atras') || normalizedEvent.includes('late') || normalizedEvent.includes('overdue')) {
    return 'past_due';
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

  if (statusCandidates.some((value) => value.includes('refund') || value.includes('reembolso'))) {
    return 'refunded';
  }
  if (statusCandidates.some((value) => value.includes('chargeback'))) {
    return 'chargeback';
  }
  if (statusCandidates.some((value) => value.includes('cancel'))) {
    return 'canceled';
  }
  if (statusCandidates.some((value) => value.includes('atras') || value.includes('late') || value.includes('overdue') || value === 'past_due')) {
    return 'past_due';
  }

  return '';
}

export function getKiwifyBillingAction(eventType) {
  if (getKiwifyReversalStatus(...arguments)) return 'reversal';
  if (isApprovedKiwifyEvent(...arguments)) return 'grant';
  return 'ignore';
}

export function extractKiwifyCustomerEmail() {
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

export function extractKiwifyExternalRef(eventType) {
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

export function resolveKiwifyPlanId() {
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

export function extractKiwifySaleId(payload) {
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

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
