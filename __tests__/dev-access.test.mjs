import test from 'node:test';
import assert from 'node:assert/strict';

import { isDeveloperEmail as isFrontendDeveloperEmail } from '../src/core/utils/devAccess.js';

test('backend reconhece plus alias de email de desenvolvedor configurado explicitamente', async () => {
  const previousDevEmails = process.env.DEV_EMAILS;
  process.env.DEV_EMAILS = 'nagcode.contact@gmail.com';
  try {
    const { isDeveloperEmail: isBackendDeveloperEmail } = await import(`../backend/src/devAccess.js?dev-access-test=${Date.now()}`);
    assert.equal(isBackendDeveloperEmail('nagcode.contact+smoke-auth@gmail.com'), true);
  } finally {
    if (previousDevEmails === undefined) {
      delete process.env.DEV_EMAILS;
    } else {
      process.env.DEV_EMAILS = previousDevEmails;
    }
  }
});

test('frontend reconhece plus alias de email de desenvolvedor', () => {
  assert.equal(isFrontendDeveloperEmail('nagcode.contact+smoke-auth@gmail.com'), true);
});
