import test from 'node:test';
import assert from 'node:assert/strict';

import { createHydrationController } from '../src/app/hydration.js';

function emptyCoachPortal() {
  return {
    subscription: null,
    entitlements: [],
    gymAccess: [],
    gyms: [],
    selectedGymId: null,
    status: 'idle',
    error: '',
  };
}

function emptyAthleteOverview() {
  return {
    detailLevel: 'none',
    stats: null,
    recentResults: [],
    recentWorkouts: [],
    benchmarkHistory: [],
    prHistory: [],
    prCurrent: {},
    measurements: [],
    runningHistory: [],
    strengthHistory: [],
    gymAccess: [],
    personalSubscription: null,
    athleteBenefits: null,
    blocks: {
      summary: { status: 'idle', error: '' },
      results: { status: 'idle', error: '' },
      workouts: { status: 'idle', error: '' },
    },
  };
}

function createControllerFixture() {
  let uiState = {
    currentPage: 'today',
    coachPortal: emptyCoachPortal(),
    athleteOverview: emptyAthleteOverview(),
  };

  const calls = {
    subscription: 0,
    entitlements: 0,
    gyms: 0,
    summary: 0,
    results: 0,
    workouts: 0,
    rerender: 0,
  };

  const controller = createHydrationController({
    getUiState: () => uiState,
    patchUiState: async (fn) => {
      uiState = fn(uiState);
    },
    rerender: async () => {
      calls.rerender += 1;
    },
    measureAsync: async (_name, fn) => fn(),
    emptyCoachPortal,
    emptyAthleteOverview,
    getProfile: () => ({ email: 'athlete@test.local' }),
    getSubscriptionStatus: async () => {
      calls.subscription += 1;
      return { data: { plan_id: 'pro', status: 'active' } };
    },
    getEntitlements: async () => {
      calls.entitlements += 1;
      return { data: { entitlements: ['athlete_app'], gymAccess: [] } };
    },
    getMyGyms: async () => {
      calls.gyms += 1;
      return { data: { gyms: [] } };
    },
    getAthleteSummary: async () => {
      calls.summary += 1;
      return {
        data: {
          stats: { resultsLogged: 3, assignedWorkouts: 2, activeGyms: 0 },
          athleteBenefits: { tier: 'base', label: 'Liberado' },
          personalSubscription: { plan_id: 'pro', status: 'active' },
          gymAccess: [],
        },
      };
    },
    getAthleteResultsSummary: async () => {
      calls.results += 1;
      return {
        data: {
          recentResults: [{ id: 1 }],
          benchmarkHistory: [{ slug: 'fran', points: [{ value: 1 }] }],
          prHistory: [{ exercise: 'BACK SQUAT', points: [{ value: 100 }], latestValue: 100 }],
          prCurrent: { 'BACK SQUAT': 100 },
          measurements: [],
          runningHistory: [],
          strengthHistory: [],
        },
      };
    },
    getAthleteWorkoutsRecent: async () => {
      calls.workouts += 1;
      return { data: { recentWorkouts: [{ id: 20 }] } };
    },
  });

  return {
    controller,
    calls,
    getUiState: () => uiState,
  };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('hydratePage em today não dispara blocos de conta', async () => {
  const { controller, calls } = createControllerFixture();

  await controller.hydratePage({ email: 'athlete@test.local' }, 'today');
  await flush();

  assert.equal(calls.summary, 0);
  assert.equal(calls.results, 0);
  assert.equal(calls.workouts, 0);
  assert.equal(calls.subscription, 0);
  assert.equal(calls.entitlements, 0);
  assert.equal(calls.gyms, 0);
});

test('hydratePage em account carrega resumo imediato e dispara blocos lazy uma vez', async () => {
  const { controller, calls, getUiState } = createControllerFixture();

  await controller.hydratePage({ email: 'athlete@test.local' }, 'account');

  assert.equal(calls.summary, 1);
  assert.equal(calls.subscription, 1);
  assert.equal(calls.entitlements, 1);
  assert.equal(calls.gyms, 1);
  assert.equal(getUiState().athleteOverview.blocks.summary.status, 'ready');
  assert.equal(getUiState().coachPortal.status, 'ready');

  await flush();

  assert.equal(calls.results, 1);
  assert.equal(calls.workouts, 1);
  assert.equal(getUiState().athleteOverview.blocks.results.status, 'ready');
  assert.equal(getUiState().athleteOverview.blocks.workouts.status, 'ready');
});

test('hydratePage em history carrega summary primeiro e só depois results', async () => {
  const { controller, calls, getUiState } = createControllerFixture();

  await controller.hydratePage({ email: 'athlete@test.local' }, 'history');

  assert.equal(calls.summary, 1);
  assert.equal(calls.results, 0);
  assert.equal(calls.workouts, 0);
  assert.equal(getUiState().athleteOverview.blocks.summary.status, 'ready');

  await flush();

  assert.equal(calls.results, 1);
  assert.equal(calls.workouts, 0);
  assert.equal(getUiState().athleteOverview.blocks.results.status, 'ready');
});

test('hydrateAthleteSummary usa cache curto e evita request duplicado', async () => {
  const { controller, calls } = createControllerFixture();
  const profile = { email: 'athlete@test.local' };

  await controller.hydrateAthleteSummary(profile);
  await controller.hydrateAthleteSummary(profile);

  assert.equal(calls.summary, 1);
});
