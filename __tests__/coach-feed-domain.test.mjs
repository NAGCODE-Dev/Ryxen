import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachFeedDomain } from '../src/app/coachFeedDomain.js';

function createMemoryStorage(initialValue) {
  let value = initialValue;
  return {
    async get() {
      return value;
    },
    async set(_key, nextValue) {
      value = nextValue;
    },
    async remove() {
      value = undefined;
    },
  };
}

test('syncCoachWorkoutFeed mescla feed preservando metadados de cache e reaplica treino preferido', async () => {
  const calls = [];
  const storage = createMemoryStorage({
    updatedAt: '2026-04-05T10:00:00.000Z',
    workouts: [
      {
        gymId: 'gym-1',
        scheduledDate: '2026-04-06',
        title: 'Coach WOD',
        receivedAt: '2026-04-05T10:00:00.000Z',
        expiresAt: '2026-04-12T10:00:00.000Z',
        payload: { blocks: [{ lines: ['old'] }] },
      },
    ],
  });

  const domain = createCoachFeedDomain({
    getState: () => ({ currentDay: 'Segunda', workoutMeta: { source: 'manual' } }),
    coachWorkoutStorage: storage,
    COACH_FEED_KEY: 'coach-feed',
    pruneCoachWorkoutFeed: (items) => items,
    normalizeCoachWorkoutFeed: (items) => items.map((item) => ({
      ...item,
      receivedAt: '2026-04-06T11:00:00.000Z',
      expiresAt: '2026-04-13T11:00:00.000Z',
    })),
    resolveCoachWorkoutForDay: () => null,
    applyPreferredWorkout: async (options) => {
      calls.push(options ?? null);
    },
  });

  const result = await domain.syncCoachWorkoutFeed([
    {
      gymId: 'gym-1',
      scheduledDate: '2026-04-06',
      title: 'Coach WOD',
      payload: { blocks: [{ lines: ['new'] }] },
    },
  ]);

  const saved = await storage.get('coach-feed');

  assert.deepEqual(result, { success: true, data: { count: 1 } });
  assert.equal(saved.workouts.length, 1);
  assert.equal(saved.workouts[0].payload.blocks[0].lines[0], 'new');
  assert.equal(saved.workouts[0].receivedAt, '2026-04-05T10:00:00.000Z');
  assert.equal(saved.workouts[0].expiresAt, '2026-04-12T10:00:00.000Z');
  assert.deepEqual(calls, [null]);
});

test('clearCoachWorkoutFeed limpa storage e faz fallback apenas quando treino atual veio do coach', async () => {
  const calls = [];
  const storage = createMemoryStorage({
    workouts: [{ id: 'coach-1' }],
  });

  const domain = createCoachFeedDomain({
    getState: () => ({ workoutMeta: { source: 'coach' } }),
    coachWorkoutStorage: storage,
    COACH_FEED_KEY: 'coach-feed',
    pruneCoachWorkoutFeed: (items) => items,
    normalizeCoachWorkoutFeed: (items) => items,
    resolveCoachWorkoutForDay: () => null,
    applyPreferredWorkout: async (options) => {
      calls.push(options);
    },
  });

  const result = await domain.clearCoachWorkoutFeed();

  assert.deepEqual(result, { success: true });
  assert.equal(await storage.get('coach-feed'), undefined);
  assert.deepEqual(calls, [{ fallbackToWelcome: true }]);
});

test('clearCoachWorkoutFeed não força fallback quando treino atual não veio do coach', async () => {
  const calls = [];
  const storage = createMemoryStorage({
    workouts: [{ id: 'coach-1' }],
  });

  const domain = createCoachFeedDomain({
    getState: () => ({ workoutMeta: { source: 'manual' } }),
    coachWorkoutStorage: storage,
    COACH_FEED_KEY: 'coach-feed',
    pruneCoachWorkoutFeed: (items) => items,
    normalizeCoachWorkoutFeed: (items) => items,
    resolveCoachWorkoutForDay: () => null,
    applyPreferredWorkout: async (options) => {
      calls.push(options);
    },
  });

  const result = await domain.clearCoachWorkoutFeed();

  assert.deepEqual(result, { success: true });
  assert.equal(await storage.get('coach-feed'), undefined);
  assert.deepEqual(calls, []);
});

test('syncCoachWorkoutFeed retorna erro amigável quando persistência falha', async () => {
  const domain = createCoachFeedDomain({
    getState: () => ({ currentDay: 'Segunda', workoutMeta: { source: 'manual' } }),
    coachWorkoutStorage: {
      async get() {
        return { workouts: [] };
      },
      async set() {
        throw new Error('db unavailable');
      },
      async remove() {},
    },
    COACH_FEED_KEY: 'coach-feed',
    pruneCoachWorkoutFeed: (items) => items,
    normalizeCoachWorkoutFeed: (items) => items,
    resolveCoachWorkoutForDay: () => null,
    applyPreferredWorkout: async () => {},
  });

  const result = await domain.syncCoachWorkoutFeed([
    { gymId: 'gym-1', scheduledDate: '2026-04-06', title: 'WOD', payload: { blocks: [] } },
  ]);

  assert.equal(result.success, false);
  assert.match(result.error, /db unavailable/);
});
