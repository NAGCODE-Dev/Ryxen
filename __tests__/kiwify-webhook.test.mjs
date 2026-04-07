import test from 'node:test';
import assert from 'node:assert/strict';

process.env.KIWIFY_WEBHOOK_TOKEN = 'secret-header-token';

const {
  extractKiwifyCustomerEmail,
  getKiwifyBillingAction,
  getKiwifyReversalStatus,
  extractKiwifyEventType,
  extractKiwifyExternalRef,
  isApprovedKiwifyEvent,
  isValidKiwifyToken,
  normalizeKiwifyPayload,
  resolveKiwifyPlanId,
} = await import('../backend/src/kiwifyWebhook.js');

test('kiwify webhook auth accepts header token and rejects query/body token', () => {
  assert.equal(isValidKiwifyToken({
    headers: { 'x-kiwify-webhook-token': 'secret-header-token' },
    query: {},
    body: {},
  }), true);

  assert.equal(isValidKiwifyToken({
    headers: {},
    query: { token: 'secret-header-token' },
    body: {},
  }), false);

  assert.equal(isValidKiwifyToken({
    headers: {},
    query: {},
    body: { token: 'secret-header-token' },
  }), false);
});

test('kiwify webhook contract resolves compra_aprovada payload', () => {
  const payload = normalizeKiwifyPayload({
    event: 'compra_aprovada',
    sale_id: 'sale-pro-001',
    product_name: 'Ryxen Coach — Pro',
    customer: { email: 'nagcode.contact@gmail.com' },
    status: 'approved',
  });

  assert.equal(extractKiwifyEventType(payload), 'compra_aprovada');
  assert.equal(isApprovedKiwifyEvent('compra_aprovada', payload), true);
  assert.equal(extractKiwifyCustomerEmail(payload), 'nagcode.contact@gmail.com');
  assert.equal(resolveKiwifyPlanId(payload), 'pro');
  assert.equal(extractKiwifyExternalRef('compra_aprovada', payload), 'compra_aprovada:sale-pro-001');
});

test('kiwify webhook contract resolves assinatura_renovada payload', () => {
  const payload = normalizeKiwifyPayload({
    event: 'assinatura_renovada',
    subscription_id: 'renew-performance-001',
    product: { name: 'Ryxen Coach — Performance' },
    customer: { email: 'athlete@example.com' },
    status: 'approved',
  });

  assert.equal(extractKiwifyEventType(payload), 'assinatura_renovada');
  assert.equal(isApprovedKiwifyEvent('assinatura_renovada', payload), true);
  assert.equal(extractKiwifyCustomerEmail(payload), 'athlete@example.com');
  assert.equal(resolveKiwifyPlanId(payload), 'performance');
  assert.equal(extractKiwifyExternalRef('assinatura_renovada', payload), 'assinatura_renovada:renew-performance-001');
});

test('kiwify webhook contract resolves reembolso as reversal', () => {
  const payload = normalizeKiwifyPayload({
    event: 'reembolso',
    sale_id: 'sale-pro-refund-001',
    product_name: 'Ryxen Coach — Pro',
    customer: { email: 'nagcode.contact@gmail.com' },
    status: 'refunded',
  });

  assert.equal(getKiwifyReversalStatus('reembolso', payload), 'refunded');
  assert.equal(getKiwifyBillingAction('reembolso', payload), 'reversal');
  assert.equal(resolveKiwifyPlanId(payload), 'pro');
});

test('kiwify webhook contract resolves chargeback and late events as reversals', () => {
  const chargebackPayload = normalizeKiwifyPayload({
    event: 'chargeback',
    subscription_id: 'chargeback-performance-001',
    product: { name: 'Ryxen Coach — Performance' },
    customer: { email: 'athlete@example.com' },
    status: 'chargeback',
  });

  const latePayload = normalizeKiwifyPayload({
    event: 'assinatura_atrasada',
    subscription_id: 'late-starter-001',
    product: { name: 'Ryxen Coach — Starter' },
    customer: { email: 'athlete@example.com' },
    status: 'past_due',
  });

  assert.equal(getKiwifyReversalStatus('chargeback', chargebackPayload), 'chargeback');
  assert.equal(getKiwifyBillingAction('chargeback', chargebackPayload), 'reversal');
  assert.equal(getKiwifyReversalStatus('assinatura_atrasada', latePayload), 'past_due');
  assert.equal(getKiwifyBillingAction('assinatura_atrasada', latePayload), 'reversal');
});
