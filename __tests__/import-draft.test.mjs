import test from 'node:test';
import assert from 'node:assert/strict';

import { createImportDraft, buildWeeksFromImportDraft } from '../src/app/importDraft.js';

test('draft de importação preserva semana e permite remover treino antes de salvar', () => {
  const weeks = [
    {
      weekNumber: 19,
      workouts: [
        {
          day: 'Segunda',
          blocks: [
            { type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%'] },
          ],
        },
        {
          day: 'Terça',
          blocks: [
            { type: 'DEFAULT', lines: ['FRAN', '21-15-9'] },
          ],
        },
      ],
    },
  ];

  const draft = createImportDraft(weeks);
  draft.weeks[0].workouts[1].enabled = false;
  draft.weeks[0].workouts[0].lines[1].text = '5x5 @ 82%';

  const rebuilt = buildWeeksFromImportDraft(draft);

  assert.equal(rebuilt.length, 1);
  assert.equal(rebuilt[0].workouts.length, 1);
  assert.equal(rebuilt[0].workouts[0].day, 'Segunda');
});
