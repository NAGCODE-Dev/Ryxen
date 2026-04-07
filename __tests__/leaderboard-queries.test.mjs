import test from 'node:test';
import assert from 'node:assert/strict';

import { parseBenchmarkScoreValue } from '../backend/src/queries/leaderboardQueries.js';

test('parseBenchmarkScoreValue converte for_time em segundos', () => {
  assert.equal(parseBenchmarkScoreValue('02:31', 'for_time'), 151);
  assert.equal(parseBenchmarkScoreValue('1:02:03', 'for_time'), 3723);
});

test('parseBenchmarkScoreValue converte rounds_reps em valor ordenável', () => {
  assert.equal(parseBenchmarkScoreValue('10+12', 'rounds_reps'), 10012);
});

test('parseBenchmarkScoreValue mantém numéricos simples para score types diretos', () => {
  assert.equal(parseBenchmarkScoreValue('125', 'reps'), 125);
  assert.equal(parseBenchmarkScoreValue('87.5 kg', 'load'), 87.5);
});
