import test from 'node:test';
import assert from 'node:assert/strict';

import { buildImportReview } from '../src/app/importReview.js';
import { parseTextIntoWeeksWithReview } from '../src/app/workoutHelpers.js';
import { calculateLoads } from '../src/core/usecases/calculateLoads.js';

const SAMPLE_TEXT = `
SEMANA 19
SEGUNDA
BACK SQUAT
5x5 @ 80%
TERCA
FRAN
21-15-9
Thruster
Pull-up
`.trim();

test('review de importação resume origem, semanas e confiança', () => {
  const parsed = parseTextIntoWeeksWithReview(SAMPLE_TEXT, 19);
  const review = buildImportReview({
    file: { name: 'treino.xlsx' },
    source: 'spreadsheet',
    reader: 'spreadsheet',
    rawText: parsed.cleanedText,
    weeks: parsed.weeks,
    analysis: { confidenceScore: 91, sheetCount: 2, rowCount: 14 },
  });

  assert.equal(review.sourceLabel, 'Planilha');
  assert.equal(review.weekCount, 1);
  assert.equal(review.dayCount, 2);
  assert.equal(review.confidenceLabel, 'alta');
  assert.match(review.summary, /2 aba\(s\)/i);
});

test('cálculo de cargas retorna revisão de confiança e PR faltante', () => {
  const workout = {
    day: 'Segunda',
    sections: [
      { lines: ['BACK SQUAT', '5x5 @80', 'STRICT PRESS', '3x3 @75'] },
    ],
  };
  const prs = { 'BACK SQUAT': 120 };
  const result = calculateLoads(workout, prs, { showLbsConversion: false });

  assert.equal(result.success, true);
  assert.equal(result.review.linesWithPercent, 2);
  assert.equal(result.missingPRs.includes('STRICT PRESS'), true);
  assert.equal(result.data.some((line) => line?.confidenceLabel), true);
});
