import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthleteInteractionDomain } from '../src/app/athleteInteractionDomain.js';

test('handleUpdatePreferences faz merge, reprocessa e emite evento', async () => {
  const state = {
    preferences: {
      theme: 'dark',
      showGoals: true,
    },
  };
  const emitted = [];
  let reprocessCount = 0;

  const domain = createAthleteInteractionDomain({
    getState: () => state,
    setState: (patch) => {
      Object.assign(state, patch);
    },
    emit: (name, payload) => emitted.push([name, payload]),
    logDebug: () => {},
    navigatorObject: { clipboard: { writeText: async () => {} } },
    copyWorkout: () => ({ success: true, text: '' }),
    addOrUpdatePR: () => ({ success: true, data: {}, isNew: true }),
    removePR: () => ({ success: true, data: {} }),
    listAllPRs: () => [],
    reprocessActiveWeek: async () => {
      reprocessCount += 1;
    },
  });

  const result = await domain.handleUpdatePreferences({ theme: 'light' });

  assert.equal(result.success, true);
  assert.deepEqual(state.preferences, {
    theme: 'light',
    showGoals: true,
  });
  assert.equal(reprocessCount, 1);
  assert.deepEqual(emitted, [
    ['preferences:changed', { preferences: { theme: 'light', showGoals: true } }],
  ]);
});

test('handleAddPR atualiza estado, reprocessa e informa se o PR é novo', async () => {
  const state = {
    prs: { squat: 100 },
  };
  const emitted = [];
  let reprocessCount = 0;

  const domain = createAthleteInteractionDomain({
    getState: () => state,
    setState: (patch) => {
      Object.assign(state, patch);
    },
    emit: (name, payload) => emitted.push([name, payload]),
    logDebug: () => {},
    navigatorObject: { clipboard: { writeText: async () => {} } },
    copyWorkout: () => ({ success: true, text: '' }),
    addOrUpdatePR: (prs, exercise, load) => ({
      success: true,
      data: { ...prs, [exercise]: load },
      isNew: exercise !== 'squat',
    }),
    removePR: () => ({ success: true, data: {} }),
    listAllPRs: () => [],
    reprocessActiveWeek: async () => {
      reprocessCount += 1;
    },
  });

  const result = await domain.handleAddPR('deadlift', 180);

  assert.equal(result.success, true);
  assert.deepEqual(state.prs, { squat: 100, deadlift: 180 });
  assert.equal(reprocessCount, 1);
  assert.deepEqual(emitted, [
    ['pr:updated', { exercise: 'deadlift', load: 180, isNew: true }],
  ]);
});
