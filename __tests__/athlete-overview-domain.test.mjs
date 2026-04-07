import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthleteOverviewDomain } from '../src/app/athleteOverviewDomain.js';

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

test('buildAthleteOverviewPatch normaliza coleções e sobe detailLevel quando summary/results ficam prontos', async () => {
  const domain = createAthleteOverviewDomain({
    measureAsync: async (_name, fn) => fn(),
    emptyAthleteOverview,
    getAthleteSummary: async () => ({ data: null }),
    getAthleteResultsSummary: async () => ({ data: null }),
    getAthleteWorkoutsRecent: async () => ({ data: null }),
  });

  const summaryReady = domain.buildAthleteOverviewPatch(null, {
    stats: { resultsLogged: 2 },
    recentResults: null,
    measurements: null,
    prCurrent: null,
  }, 'summary', 'ready');

  const fullReady = domain.buildAthleteOverviewPatch(summaryReady, {
    benchmarkHistory: [{ slug: 'fran' }],
    runningHistory: null,
    strengthHistory: null,
  }, 'results', 'ready');

  assert.equal(summaryReady.detailLevel, 'lite');
  assert.deepEqual(summaryReady.recentResults, []);
  assert.deepEqual(summaryReady.measurements, []);
  assert.deepEqual(summaryReady.prCurrent, {});

  assert.equal(fullReady.detailLevel, 'full');
  assert.deepEqual(fullReady.benchmarkHistory, [{ slug: 'fran' }]);
  assert.deepEqual(fullReady.runningHistory, []);
  assert.deepEqual(fullReady.strengthHistory, []);
});
