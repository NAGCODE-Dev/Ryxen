import test from 'node:test';
import assert from 'node:assert/strict';

import { generateResetCode, hashResetCode, isResetCodeExpired } from '../backend/src/passwordReset.js';

test('generateResetCode cria codigo numerico de 6 digitos', () => {
  const code = generateResetCode();
  assert.match(code, /^\d{6}$/);
});

test('hashResetCode gera hash deterministico', () => {
  const a = hashResetCode('123456');
  const b = hashResetCode('123456');
  const c = hashResetCode('654321');

  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('isResetCodeExpired detecta expiracao corretamente', () => {
  const now = new Date('2026-03-13T12:00:00.000Z').getTime();

  assert.equal(isResetCodeExpired('2026-03-13T11:59:59.000Z', now), true);
  assert.equal(isResetCodeExpired('2026-03-13T12:15:00.000Z', now), false);
});
