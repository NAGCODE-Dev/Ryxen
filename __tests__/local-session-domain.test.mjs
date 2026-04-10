import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalSessionDomain } from '../src/app/localSessionDomain.js';

function createStorageMock(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values.entries());
    },
  };
}

test('clearLocalUserData preserva grants do dispositivo confiável mesmo após limpar sessão', async () => {
  const localStorage = createStorageMock({
    'ryxen-auth-token': 'token-123',
    'ryxen-user-profile': '{"email":"athlete@ryxen.app"}',
    'ryxen-trusted-device-id': 'device-abc',
    'ryxen-trusted-device-map': '{"athlete@ryxen.app":{"trustedToken":"grant"}}',
    'ryxen-last-auth-email': 'athlete@ryxen.app',
    'ryxen-consent': 'accepted',
  });

  const domain = createLocalSessionDomain({
    windowObject: { localStorage },
    clearAllStorages: async () => {
      for (const key of Object.keys(localStorage.dump())) {
        localStorage.removeItem(key);
      }
    },
    PRESERVED_LOCAL_KEYS: [
      ['ryxen-consent'],
      'ryxen-trusted-device-id',
      'ryxen-trusted-device-map',
      'ryxen-last-auth-email',
    ],
    AUTH_TOKEN_KEY: ['ryxen-auth-token'],
    PROFILE_KEY: ['ryxen-user-profile'],
    CHECKOUT_INTENT_KEY: [],
    PR_HISTORY_KEY: 'pr_history',
    ATHLETE_USAGE_KEY: [],
    TELEMETRY_QUEUE_KEY: [],
    APP_STATE_SYNC_KEY: [],
    SYNC_OUTBOX_KEY: [],
  });

  await domain.clearLocalUserData({ preserveAuth: false });

  assert.equal(localStorage.getItem('ryxen-auth-token'), null);
  assert.equal(localStorage.getItem('ryxen-user-profile'), null);
  assert.equal(localStorage.getItem('ryxen-trusted-device-id'), 'device-abc');
  assert.equal(localStorage.getItem('ryxen-trusted-device-map'), '{"athlete@ryxen.app":{"trustedToken":"grant"}}');
  assert.equal(localStorage.getItem('ryxen-last-auth-email'), 'athlete@ryxen.app');
  assert.equal(localStorage.getItem('ryxen-consent'), 'accepted');
});
