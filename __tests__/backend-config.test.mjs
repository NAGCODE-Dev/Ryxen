import test from 'node:test';
import assert from 'node:assert/strict';

const config = await import(`../backend/src/config.js?backend-config-test=${Date.now()}`);

test('isAllowedOrigin aceita origins padrão do app nativo', () => {
  assert.equal(config.isAllowedOrigin('capacitor://localhost'), true);
  assert.equal(config.isAllowedOrigin('https://localhost'), true);
  assert.equal(config.isAllowedOrigin('http://localhost'), true);
});

