import test from 'node:test';
import assert from 'node:assert/strict';

import { canManageMembership, isMembershipActive } from '../backend/src/access.js';

test('isMembershipActive só aceita memberships ativas', () => {
  assert.equal(isMembershipActive({ status: 'active' }), true);
  assert.equal(isMembershipActive({ status: 'inactive' }), false);
  assert.equal(isMembershipActive({ status: 'invited' }), false);
});

test('canManageMembership exige role de gestão e status ativo', () => {
  assert.equal(canManageMembership({ role: 'owner', status: 'active' }), true);
  assert.equal(canManageMembership({ role: 'coach', status: 'active' }), true);
  assert.equal(canManageMembership({ role: 'coach', status: 'inactive' }), false);
  assert.equal(canManageMembership({ role: 'athlete', status: 'active' }), false);
});
