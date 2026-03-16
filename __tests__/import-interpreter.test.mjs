import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key';

import { shouldTryAiInterpretationFallback } from '../src/app/importInterpreterPolicy.js';
const { normalizeInterpretedWorkoutPayload, shouldUseAiImportFallback } = await import('../backend/src/importInterpreter.js');

test('heurística de fallback de IA entra quando a leitura local é fraca', () => {
  assert.equal(shouldTryAiInterpretationFallback({
    review: { score: 54, warnings: ['Pouco conteúdo encontrado'], weekCount: 1, dayCount: 1 },
    parsed: { stats: { weekCount: 1, dayCount: 1 } },
  }), true);

  assert.equal(shouldUseAiImportFallback({
    review: { score: 91, warnings: [], weekCount: 1, dayCount: 4 },
    parsed: { stats: { weekCount: 1, dayCount: 4 } },
  }), false);
});

test('normaliza saída estruturada da IA para semanas compatíveis com o parser atual', () => {
  const weeks = normalizeInterpretedWorkoutPayload({
    weeks: [
      {
        week_number: 19,
        workouts: [
          {
            day: 'terca',
            blocks: [
              { type: 'manha', lines: ['Back squat', '5x5 @ 80%'] },
              { type: 'WOD', lines: ['Fran', '21-15-9'] },
            ],
          },
          {
            day: 'sexta',
            blocks: [
              { type: 'desconhecido', lines: ['Deadlift', '3x3 @ 85%'] },
            ],
          },
        ],
      },
    ],
  }, 19);

  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].weekNumber, 19);
  assert.equal(weeks[0].workouts.length, 2);
  assert.equal(weeks[0].workouts[0].day, 'Terça');
  assert.equal(weeks[0].workouts[0].blocks[0].type, 'MANHÃ');
  assert.equal(weeks[0].workouts[1].day, 'Sexta');
  assert.equal(weeks[0].workouts[1].blocks[0].type, 'DEFAULT');
});
