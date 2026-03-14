import test from 'node:test';
import assert from 'node:assert/strict';

import { getSubscriptionAccessState } from '../backend/src/access.js';

test('getSubscriptionAccessState marca subscription ativa com dias restantes', () => {
  const renewAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const result = getSubscriptionAccessState({
    status: 'active',
    renew_at: renewAt,
  });

  assert.equal(result.accessTier, 'active');
  assert.equal(result.isGracePeriod, false);
  assert.ok(result.daysRemaining >= 2);
});

test('getSubscriptionAccessState entra em grace após vencimento recente', () => {
  const renewAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const result = getSubscriptionAccessState({
    status: 'active',
    renew_at: renewAt,
  });

  assert.equal(result.accessTier, 'grace');
  assert.equal(result.isGracePeriod, true);
});

test('getSubscriptionAccessState bloqueia subscription vencida fora da janela de grace', () => {
  const renewAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const result = getSubscriptionAccessState({
    status: 'active',
    renew_at: renewAt,
  });

  assert.equal(result.accessTier, 'blocked');
  assert.equal(result.isGracePeriod, false);
});
