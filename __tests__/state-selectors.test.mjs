import test from 'node:test';
import assert from 'node:assert/strict';

import { getWorkoutStats } from '../src/core/state/selectors.js';
import { resetState, setState } from '../src/core/state/store.js';

test('getWorkoutStats retorna zeros sem treino carregado', () => {
  resetState();
  assert.deepEqual(getWorkoutStats(), { exercises: 0, sets: 0, sections: 0 });
});

test('getWorkoutStats calcula sections, exercises e sets em workout com blocks', () => {
  resetState();
  setState({
    currentDay: 'Segunda',
    workout: {
      day: 'Segunda',
      blocks: [
        {
          type: 'A',
          lines: [
            'BACK SQUAT',
            '5x5 @ 80%',
            '3 sets de split squat',
            'REST 90s',
          ],
        },
        {
          type: 'B',
          lines: [
            { raw: 'EMOM 10' },
            { raw: '4 rounds for quality' },
            { raw: 'every 2 min x 6' },
          ],
        },
      ],
    },
  });

  assert.deepEqual(getWorkoutStats(), {
    sections: 2,
    exercises: 7,
    sets: 28,
  });
});

