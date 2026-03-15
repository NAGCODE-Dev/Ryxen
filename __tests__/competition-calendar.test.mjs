import test from 'node:test';
import assert from 'node:assert/strict';

const { buildCompetitionCalendarScope } = await import('../backend/src/routes/competitionRoutes.js');

test('competition calendar keeps public scope even when athlete has no gyms', () => {
  const scope = buildCompetitionCalendarScope([]);
  assert.equal(scope.includePublic, true);
  assert.equal(scope.gymIdsParam, null);
});

test('competition calendar passes gym ids when memberships exist', () => {
  const scope = buildCompetitionCalendarScope([12, '18', null, undefined, 'x']);
  assert.deepEqual(scope.gymIdsParam, [12, 18]);
  assert.equal(scope.includePublic, true);
});
