import test from 'node:test';
import assert from 'node:assert/strict';

import {
  maybeResumePendingCheckout,
  normalizeCheckoutPlan,
} from '../apps/athlete/services/checkoutFlow.js';

test('normalizeCheckoutPlan aceita apenas planos conhecidos', () => {
  assert.equal(normalizeCheckoutPlan(' Coach '), 'coach');
  assert.equal(normalizeCheckoutPlan('PRO'), 'pro');
  assert.equal(normalizeCheckoutPlan('enterprise'), '');
});

test('maybeResumePendingCheckout reencaminha para checkout quando há intenção e auth válidas', async () => {
  const calls = {
    consume: 0,
    openCheckout: [],
    queue: [],
    toast: [],
  };

  const resumed = await maybeResumePendingCheckout({
    consumeCheckoutIntent: () => {
      calls.consume += 1;
      return { planId: 'coach', source: 'pricing' };
    },
    hasCheckoutAuth: () => true,
    getAppBridge: () => ({
      openCheckout: async (planId) => {
        calls.openCheckout.push(planId);
      },
    }),
    toast: (message) => calls.toast.push(message),
    queueCheckoutIntent: (planId, payload) => calls.queue.push({ planId, payload }),
  });

  assert.equal(resumed, true);
  assert.equal(calls.consume, 1);
  assert.deepEqual(calls.openCheckout, ['coach']);
  assert.deepEqual(calls.toast, ['Continuando para o checkout...']);
  assert.deepEqual(calls.queue, []);
});
