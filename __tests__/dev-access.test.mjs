import test from 'node:test';
import assert from 'node:assert/strict';

import { isDeveloperEmail as isBackendDeveloperEmail } from '../backend/src/devAccess.js';
import { isDeveloperEmail as isFrontendDeveloperEmail } from '../src/core/utils/devAccess.js';

test('backend reconhece plus alias de email de desenvolvedor', () => {
  assert.equal(isBackendDeveloperEmail('nagcode.contact+smoke-auth@gmail.com'), true);
});

test('frontend reconhece plus alias de email de desenvolvedor', () => {
  assert.equal(isFrontendDeveloperEmail('nagcode.contact+smoke-auth@gmail.com'), true);
});

