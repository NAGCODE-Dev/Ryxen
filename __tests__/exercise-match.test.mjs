import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePRMatch } from '../src/core/services/prsService.js';
import { calculateLineLoad } from '../src/core/usecases/calculateLoads.js';

test('resolve alias comum de exercício para PR cadastrado', () => {
  const prs = {
    'STRICT PRESS': 60,
    'CLEAN & JERK': 95,
  };

  const match = resolvePRMatch(prs, 'shoulder press');

  assert.equal(match.found, true);
  assert.equal(match.matchedName, 'STRICT PRESS');
  assert.equal(match.method, 'alias');
});

test('retorna candidatos quando o match é aproximado e pode pedir revisão', () => {
  const prs = {
    'PULL UP': 20,
    'CHEST TO BAR': 15,
  };

  const match = resolvePRMatch(prs, 'chest to bar pull up');

  assert.equal(match.found, true);
  assert.ok(['alias', 'similar', 'similar-ambiguous'].includes(match.method));
  assert.ok(Array.isArray(match.candidates));
});

test('cálculo de linha carrega nota de revisão e sugestões quando o nome do exercício varia', () => {
  const prs = {
    'STRICT PRESS': 70,
  };

  const result = calculateLineLoad('SHOULDER PRESS 5x3 @70', prs, {});

  assert.equal(result.success, true);
  assert.equal(result.data.success, true);
  assert.equal(result.data.exercise, 'STRICT PRESS');
  assert.match(result.data.reviewNote, /STRICT PRESS|registro salvo/i);
});
