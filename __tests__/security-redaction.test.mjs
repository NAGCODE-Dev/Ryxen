import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClientPasswordResetSupportMeta } from '../backend/src/passwordResetSupportClient.js';
import { redactSensitiveValue, sanitizeUrlPath } from '../backend/src/securityRedaction.js';

test('sanitizeUrlPath remove query string sensível', () => {
  assert.equal(
    sanitizeUrlPath('/auth/google/callback?code=secret-code&state=secret-state'),
    '/auth/google/callback',
  );
  assert.equal(
    sanitizeUrlPath('https://api.example.com/account-deletions/respond?token=abc'),
    '/account-deletions/respond',
  );
});

test('redactSensitiveValue mascara segredos e normaliza urls', () => {
  const sanitized = redactSensitiveValue({
    token: 'secret-token',
    requestKey: 'secret-request-key',
    path: '/auth/google/callback?code=oauth-code&state=oauth-state',
    nested: {
      authCode: 'exchange-code',
      redirect_url: 'https://example.com/reset?token=abc123',
    },
  });

  assert.equal(sanitized.token, '[REDACTED]');
  assert.equal(sanitized.requestKey, '[REDACTED]');
  assert.equal(sanitized.path, '/auth/google/callback');
  assert.equal(sanitized.nested.authCode, '[REDACTED]');
  assert.equal(sanitized.nested.redirect_url, '/reset');
});

test('buildClientPasswordResetSupportMeta não expõe sinais internos de confiança', () => {
  const clientMeta = buildClientPasswordResetSupportMeta({
    status: 'pending',
    requestedAt: '2026-04-23T12:00:00.000Z',
    expiresAt: '2026-04-23T14:00:00.000Z',
    canRetry: false,
    retryAfterMs: 30000,
    retryAfterSeconds: 30,
    attemptCount: 2,
    trustSignals: {
      sameDeviceTrusted: true,
      trustedDeviceLabel: 'Nikolas iPhone',
    },
  });

  assert.deepEqual(clientMeta, {
    status: 'pending',
    requestedAt: '2026-04-23T12:00:00.000Z',
    expiresAt: '2026-04-23T14:00:00.000Z',
    approvedAt: '',
    deniedAt: '',
    completedAt: '',
    canRetry: false,
    retryAfterMs: 30000,
    retryAfterSeconds: 30,
    attemptCount: 2,
  });
});
