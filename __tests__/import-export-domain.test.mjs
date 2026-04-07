import test from 'node:test';
import assert from 'node:assert/strict';

import { createImportExportDomain } from '../src/app/importExportDomain.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };
}

function createDomain(overrides = {}) {
  const state = overrides.state || {
    weeks: [],
    prs: {},
    preferences: { theme: 'dark' },
    activeWeekNumber: 2,
    currentDay: 'Segunda',
  };
  const emitted = [];
  const downloads = [];
  const applyWorkoutCalls = [];

  const domain = createImportExportDomain({
    getState: () => state,
    setState: (patch) => {
      Object.assign(state, patch);
    },
    emit: (name, payload) => emitted.push([name, payload]),
    logDebug: () => {},
    downloadFile: (content, filename, mimeType) => {
      downloads.push({ content, filename, mimeType });
    },
    saveMultiWeekPdf: async () => ({ success: false, error: 'not used' }),
    saveParsedWeeks: async () => ({ success: false, error: 'not used' }),
    isImageFile: () => false,
    extractTextFromImageFile: async () => '',
    isVideoFile: () => false,
    extractTextFromVideoFile: async () => '',
    isSpreadsheetFile: () => false,
    extractTextFromSpreadsheetFile: async () => '',
    isPdfImportFile: () => false,
    isTextLikeImportFile: () => true,
    classifyUniversalImportFile: () => ({ source: 'text' }),
    parseTextIntoWeeks: () => [],
    toWorkoutBlocks: (workout) => workout.sections.map((section) => ({ ...section })),
    toWorkoutSections: (workout) => workout,
    captureAppError: () => {},
    prsStorage: createMemoryStorage(),
    prefsStorage: createMemoryStorage(),
    activeWeekStorage: createMemoryStorage(),
    dayOverrideStorage: createMemoryStorage(),
    pdfStorage: createMemoryStorage(),
    pdfMetaStorage: createMemoryStorage(),
    PDF_KEY: 'pdf',
    METADATA_KEY: 'meta',
    selectActiveWeek: async () => ({ success: true }),
    syncImportedPlanToAccount: async () => ({ success: true }),
    applyWorkoutToState: async (blocks, meta) => {
      applyWorkoutCalls.push({ blocks, meta });
      state.workout = { blocks };
    },
    applyPreferredWorkout: async () => ({ success: true }),
    reprocessActiveWeek: async () => {},
    ...overrides,
  });

  return { state, emitted, downloads, applyWorkoutCalls, domain };
}

test('handleExportBackup gera arquivo JSON e emite evento com contagem do estado atual', async () => {
  const { domain, downloads, emitted } = createDomain({
    state: {
      weeks: [{ weekNumber: 1 }],
      prs: { squat: 120, clean: 90 },
      preferences: { theme: 'dark' },
      activeWeekNumber: 1,
      currentDay: 'Segunda',
    },
  });

  const result = await domain.handleExportBackup();

  assert.equal(result.success, true);
  assert.match(result.filename, /^ryxen-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].mimeType, 'application/json');
  assert.match(downloads[0].filename, /^ryxen-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual(emitted, [[
    'backup:exported',
    {
      filename: result.filename,
      weeksCount: 1,
      prsCount: 2,
    },
  ]]);
});

test('handleImportWorkout aplica treino importado, ajusta semana ativa e emite evento', async () => {
  const { domain, state, emitted, applyWorkoutCalls } = createDomain();

  const file = {
    name: 'week-2.json',
    async text() {
      return JSON.stringify({
        version: '1.0.0',
        weekNumber: 5,
        day: 'Segunda',
        sections: [
          {
            type: 'warmup',
            lines: ['bike 10 min'],
          },
        ],
      });
    },
  };

  const result = await domain.handleImportWorkout(file);

  assert.deepEqual(result, { success: true });
  assert.equal(state.activeWeekNumber, 5);
  assert.equal(applyWorkoutCalls.length, 1);
  assert.equal(applyWorkoutCalls[0].meta.source, 'manual');
  assert.equal(applyWorkoutCalls[0].meta.weekNumber, 5);
  assert.equal(applyWorkoutCalls[0].meta.title, 'week-2.json');
  assert.deepEqual(emitted, [[
    'workout:imported',
    {
      workout: {
        day: 'Segunda',
        sections: [
          {
            type: 'warmup',
            lines: ['bike 10 min'],
          },
        ],
      },
    },
  ]]);
});

test('handleImportWorkout falha com JSON inválido sem alterar estado nem emitir evento', async () => {
  const { domain, state, emitted, applyWorkoutCalls } = createDomain();
  const originalWeek = state.activeWeekNumber;

  const file = {
    name: 'broken.json',
    async text() {
      return '{"invalid": true}';
    },
  };

  const result = await domain.handleImportWorkout(file);

  assert.equal(result.success, false);
  assert.match(result.error, /Formato de treino inválido/);
  assert.equal(state.activeWeekNumber, originalWeek);
  assert.equal(applyWorkoutCalls.length, 0);
  assert.deepEqual(emitted, []);
});

test('handleImportBackup sem arquivo retorna erro amigável e não altera estado', async () => {
  const { domain, state, emitted } = createDomain();
  const initialState = structuredClone(state);

  const result = await domain.handleImportBackup(null);

  assert.deepEqual(result, { success: false, error: 'Arquivo não fornecido' });
  assert.deepEqual(state, initialState);
  assert.deepEqual(emitted, []);
});
