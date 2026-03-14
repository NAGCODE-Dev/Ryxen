import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateLoads } from '../src/core/usecases/calculateLoads.js';
import { exportAppBackup, importAppBackup } from '../src/core/usecases/backupData.js';
import { importPRsFromCSV } from '../src/core/usecases/importPRsFromCSV.js';
import { parseMultiWeekPdf } from '../src/adapters/pdf/customPdfParser.js';

test('calcula cargas para treino válido', () => {
  const workout = {
    day: 'Segunda',
    sections: [
      { lines: ['BACK SQUAT', '3x5 @80'] },
    ],
  };
  const prs = { 'BACK SQUAT': 100 };
  const preferences = { showLbsConversion: false };

  const result = calculateLoads(workout, prs, preferences);
  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.data));
  assert.equal(result.totalLines, 2);
});

test('backup roundtrip preserva dados essenciais', () => {
  const state = {
    prs: { 'BACK SQUAT': 120 },
    preferences: { showEmojis: true },
    weeks: [{ weekNumber: 19, workouts: [{ day: 'Segunda', blocks: [] }] }],
    activeWeekNumber: 19,
    currentDay: 'Segunda',
  };

  const exported = exportAppBackup(state);
  assert.equal(exported.success, true);

  const imported = importAppBackup(exported.json);
  assert.equal(imported.success, true);
  assert.equal(imported.data.activeWeekNumber, 19);
  assert.equal(imported.data.currentDay, 'Segunda');
  assert.equal(imported.data.prs['BACK SQUAT'], 120);
});

test('importa PRs de CSV', () => {
  const csv = 'Exercício,Carga (kg)\nBACK SQUAT,140\nDEADLIFT,180';
  const result = importPRsFromCSV(csv);
  assert.equal(result.success, true);
  assert.equal(result.imported, 2);
  assert.equal(result.data['BACK SQUAT'], 140);
});

test('parser multi-semana identifica semanas por texto', () => {
  const text = `
SEMANA 19
SEGUNDA
BACK SQUAT
3x5 @80
SEMANA 20
TERÇA
DEADLIFT
3x3 @85
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  assert.equal(Array.isArray(weeks), true);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].weekNumber, 19);
  assert.equal(weeks[1].weekNumber, 20);
});
