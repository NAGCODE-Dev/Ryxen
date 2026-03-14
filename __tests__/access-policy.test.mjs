import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEntitlements } from '../backend/src/accessPolicy.js';

test('buildEntitlements libera coach_portal e athlete_app conforme contextos do gym', () => {
  const entitlements = buildEntitlements({
    subscription: { status: 'active', plan_id: 'coach' },
    gymContexts: [
      {
        membership: { role: 'owner' },
        access: { gymAccess: { canCoachManage: true, canAthletesUseApp: true } },
      },
    ],
  });

  assert.equal(entitlements.includes('premium'), true);
  assert.equal(entitlements.includes('advanced_analytics'), true);
  assert.equal(entitlements.includes('coach_portal'), true);
  assert.equal(entitlements.includes('athlete_app'), true);
});

test('buildEntitlements nao libera athlete_app quando coach expirou', () => {
  const entitlements = buildEntitlements({
    subscription: { status: 'inactive', plan_id: 'free' },
    gymContexts: [
      {
        membership: { role: 'athlete' },
        access: { gymAccess: { canAthletesUseApp: false } },
      },
    ],
  });

  assert.deepEqual(entitlements, []);
});

test('buildEntitlements nao libera coach_portal sem permissao real de gerenciamento', () => {
  const entitlements = buildEntitlements({
    subscription: { status: 'inactive', plan_id: 'coach' },
    gymContexts: [
      {
        membership: { role: 'owner' },
        access: { gymAccess: { canCoachManage: false, canAthletesUseApp: true } },
      },
    ],
  });

  assert.equal(entitlements.includes('coach_portal'), false);
  assert.equal(entitlements.includes('athlete_app'), true);
});
