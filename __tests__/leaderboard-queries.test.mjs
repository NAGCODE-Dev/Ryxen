import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLeaderboardDisplayName,
  formatLeaderboardResult,
  parseBenchmarkScoreValue,
} from '../backend/src/queries/leaderboardQueries.js';

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

test('buildLeaderboardDisplayName reduz identidade em rankings públicos', () => {
  assert.equal(
    buildLeaderboardDisplayName({ name: 'Maria Silva', email: 'maria@example.com' }, { revealIdentity: false, rank: 1 }),
    'Maria S.',
  );
  assert.equal(
    buildLeaderboardDisplayName({ name: '', email: 'ma@example.com' }, { revealIdentity: false, rank: 2 }),
    'ma***@example.com',
  );
});

test('formatLeaderboardResult só expõe identidade completa para gestor autorizado', () => {
  const row = {
    id: 10,
    gym_id: 5,
    gym_name: 'Ryxen',
    score_display: '8:31',
    score_value: 511,
    tiebreak_seconds: null,
    created_at: '2026-04-23T10:00:00.000Z',
    name: 'João Pedro',
    email: 'joao@example.com',
  };

  const publicView = formatLeaderboardResult(row, 0, { showPrivateAthleteData: false });
  assert.equal(publicView.name, 'João P.');
  assert.equal(publicView.identityVisibility, 'redacted');
  assert.equal('email' in publicView, false);
  assert.equal(publicView.gym_name, null);
  assert.equal(publicView.score_value, null);
  assert.equal(publicView.created_at, null);

  const scopedView = formatLeaderboardResult(row, 0, { showPrivateAthleteData: false, scopedToGym: true });
  assert.equal(scopedView.identityVisibility, 'gym_member');
  assert.equal(scopedView.gym_name, 'Ryxen');
  assert.equal(scopedView.score_value, 511);
  assert.equal(scopedView.created_at, '2026-04-23T10:00:00.000Z');

  const managerView = formatLeaderboardResult(row, 0, { showPrivateAthleteData: true });
  assert.equal(managerView.name, 'João Pedro');
  assert.equal(managerView.identityVisibility, 'gym_manager');
});
