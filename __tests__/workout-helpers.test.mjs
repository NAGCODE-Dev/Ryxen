import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isCalculatedLine,
  normalizeWorkoutBlocks,
  toWorkoutBlocks,
  toWorkoutSections,
} from '../src/app/workoutHelpers.js';

test('toWorkoutBlocks converte sections para blocks', () => {
  const workout = {
    day: 'Segunda',
    sections: [
      { type: 'A', lines: ['BACK SQUAT'] },
    ],
  };

  const result = toWorkoutBlocks(workout);
  assert.equal(result.day, 'Segunda');
  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].type, 'A');
});

test('toWorkoutSections converte blocks para sections', () => {
  const workout = {
    day: 'Terca',
    blocks: [
      { type: 'B', lines: ['DEADLIFT'] },
    ],
  };

  const result = toWorkoutSections(workout);
  assert.equal(result.day, 'Terca');
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].type, 'B');
});

test('normalizeWorkoutBlocks preserva linhas calculadas e normaliza objetos simples', () => {
  const blocks = [
    {
      type: 'DEFAULT',
      lines: [
        { raw: 'BACK SQUAT', calculated: '80kg' },
        { raw: '3x5 @80' },
        'REST 2\'',
      ],
    },
  ];

  const result = normalizeWorkoutBlocks(blocks);
  assert.equal(result[0].lines[0].calculated, '80kg');
  assert.equal(result[0].lines[1], '3x5 @80');
  assert.equal(result[0].lines[2], "REST 2'");
});

test('isCalculatedLine detecta somente linhas calculadas', () => {
  assert.equal(isCalculatedLine({ raw: 'A', calculated: '10kg' }), true);
  assert.equal(isCalculatedLine({ raw: 'A' }), false);
  assert.equal(isCalculatedLine('A'), false);
});
