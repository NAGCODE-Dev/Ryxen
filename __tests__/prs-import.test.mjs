import test from 'node:test';
import assert from 'node:assert/strict';

import { importFromJSON } from '../src/core/services/prsService.js';
import { importPRs, validatePRsFile } from '../src/core/usecases/importPRs.js';

test('importFromJSON aceita mapa simples com números em string', () => {
  const result = importFromJSON(JSON.stringify({
    'Back Squat': '155',
    Clean: '92.5',
  }));

  assert.deepEqual(result, {
    'BACK SQUAT': 155,
    CLEAN: 92.5,
  });
});

test('importFromJSON aceita backup do app contendo data.prs', () => {
  const result = importFromJSON(JSON.stringify({
    type: 'ryxen-backup',
    data: {
      prs: {
        Deadlift: 210,
        Snatch: '75',
      },
      preferences: { theme: 'dark' },
    },
  }));

  assert.deepEqual(result, {
    DEADLIFT: 210,
    SNATCH: 75,
  });
});

test('importPRs faz merge com payload legado e preserva PRs atuais', () => {
  const result = importPRs(JSON.stringify({
    prs: {
      'Front Squat': '130',
    },
  }), {
    'BACK SQUAT': 155,
  });

  assert.equal(result.success, true);
  assert.equal(result.imported, 1);
  assert.deepEqual(result.data, {
    'BACK SQUAT': 155,
    'FRONT SQUAT': 130,
  });
});

test('validatePRsFile contabiliza PRs a partir de formatos legados', () => {
  const validation = validatePRsFile(JSON.stringify({
    data: {
      prs: {
        Jerk: '110',
        Clean: 95,
      },
    },
  }));

  assert.deepEqual(validation, {
    valid: true,
    count: 2,
    exercises: ['JERK', 'CLEAN'],
  });
});
