import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthDomain } from '../src/app/authDomain.js';

test('handleSignIn limpa sessão local e restaura dados quando muda a conta autenticada', async () => {
  const state = {
    ui: { activeScreen: 'account' },
  };
  const calls = {
    clearLocalUserData: [],
    clearCoachWorkoutFeed: 0,
    restoreAppStateFromAccount: [],
    restoreImportedPlanFromAccount: [],
    flushPendingAppStateSync: 0,
    flushPendingSyncOutbox: 0,
    updateCurrentDay: 0,
    applyPreferredWorkout: [],
    getWorkoutFeed: 0,
  };

  const domain = createAuthDomain({
    getState: () => state,
    setState: (patch) => {
      Object.assign(state, patch);
    },
    remoteHandlers: {
      handleSignIn: async () => ({ user: { email: 'new@ryxen.app' } }),
      handleGetWorkoutFeed: async () => {
        calls.getWorkoutFeed += 1;
      },
      handleStartGoogleRedirect: () => ({}),
      handleSignOut: async () => ({}),
    },
    handleGetProfile: () => ({ data: { email: 'old@ryxen.app' } }),
    restoreAppStateFromAccount: async (options) => {
      calls.restoreAppStateFromAccount.push(options);
    },
    restoreImportedPlanFromAccount: async (options) => {
      calls.restoreImportedPlanFromAccount.push(options);
    },
    flushPendingAppStateSync: async () => {
      calls.flushPendingAppStateSync += 1;
    },
    flushPendingSyncOutbox: async () => {
      calls.flushPendingSyncOutbox += 1;
    },
    clearLocalUserData: async (options) => {
      calls.clearLocalUserData.push(options);
    },
    clearCoachWorkoutFeed: async () => {
      calls.clearCoachWorkoutFeed += 1;
    },
    updateCurrentDay: async () => {
      calls.updateCurrentDay += 1;
    },
    applyPreferredWorkout: async (options) => {
      calls.applyPreferredWorkout.push(options);
    },
  });

  const result = await domain.handleSignIn({ email: 'new@ryxen.app', password: 'secret' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(result, { user: { email: 'new@ryxen.app' } });
  assert.deepEqual(calls.clearLocalUserData, [{ preserveAuth: true }]);
  assert.equal(calls.clearCoachWorkoutFeed, 1);
  assert.deepEqual(calls.restoreAppStateFromAccount, [{ force: true }]);
  assert.deepEqual(calls.restoreImportedPlanFromAccount, [{ force: true }]);
  assert.equal(calls.flushPendingAppStateSync, 1);
  assert.equal(calls.flushPendingSyncOutbox, 1);
  assert.equal(calls.updateCurrentDay, 1);
  assert.deepEqual(calls.applyPreferredWorkout, [{ fallbackToWelcome: true }]);
  assert.equal(calls.getWorkoutFeed, 1);
  assert.equal(state.ui.activeScreen, 'welcome');
});
