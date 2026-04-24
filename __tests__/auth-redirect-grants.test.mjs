import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computePkceCodeChallenge,
  validateAuthRedirectExchange,
} from '../backend/src/authRedirectGrantCrypto.js';

const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';

test('validateAuthRedirectExchange aceita proof S256 no mesmo dispositivo', () => {
  const challenge = computePkceCodeChallenge(verifier, 'S256');
  const result = validateAuthRedirectExchange({
    grant: {
      payload: {
        deviceId: 'device-123',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      },
    },
    deviceId: 'device-123',
    authVerifier: verifier,
  });

  assert.equal(result.ok, true);
});

test('validateAuthRedirectExchange rejeita replay em dispositivo diferente', () => {
  const challenge = computePkceCodeChallenge(verifier, 'S256');
  const result = validateAuthRedirectExchange({
    grant: {
      payload: {
        deviceId: 'device-123',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      },
    },
    deviceId: 'device-999',
    authVerifier: verifier,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /dispositivo/i);
});

test('validateAuthRedirectExchange rejeita verifier incorreto', () => {
  const challenge = computePkceCodeChallenge(verifier, 'S256');
  const result = validateAuthRedirectExchange({
    grant: {
      payload: {
        deviceId: 'device-123',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      },
    },
    deviceId: 'device-123',
    authVerifier: `${verifier.slice(0, -1)}A`,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /inválido|expirado/i);
});
