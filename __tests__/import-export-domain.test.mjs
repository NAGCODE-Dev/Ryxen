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
    previewMultiWeekPdf: async () => ({ success: false, error: 'not used' }),
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

test('handleUniversalImport mantém sucesso local mesmo com falha de sync remoto', async () => {
  const parsedWeeks = [
    {
      weekNumber: 4,
      workouts: [{ day: 'Segunda', sections: [{ type: 'warmup', lines: ['row 8 min'] }] }],
    },
  ];
  const { domain } = createDomain({
    syncImportedPlanToAccount: async () => {
      throw new Error('remote timeout');
    },
  });

  const file = {
    name: 'week-4.json',
    type: 'application/json',
    size: 120,
    async text() {
      return JSON.stringify({
        version: '1.0.0',
        weekNumber: 4,
        day: 'Segunda',
        sections: [{ type: 'warmup', lines: ['row 8 min'] }],
      });
    },
  };

  const result = await domain.handleUniversalImport(file);

  assert.equal(result.success, true);
  assert.equal(result.preview, true);
  assert.equal(result.source, 'structured-json');
  assert.equal(result.review.weeksCount, 1);
  assert.deepEqual(result.review.weekNumbers, [4]);
});

test('preview e confirmação de importação salvam semanas apenas após confirmar', async () => {
  const parsedWeeks = [
    {
      weekNumber: 19,
      workouts: [{ day: 'Quarta', blocks: [{ type: 'WOD', lines: ['12 AMRAP'] }] }],
    },
  ];
  const savedPayloads = [];
  const selected = [];
  const { domain, emitted } = createDomain({
    previewMultiWeekPdf: async () => ({
      success: true,
      data: {
        parsedWeeks,
        metadata: {
          fileName: '7.pdf',
          fileSize: 321,
          source: 'pdf',
        },
        reviewText: 'SEMANA 19\nQUARTA\nMANHA\nWOD\n12 AMRAP',
      },
    }),
    saveParsedWeeks: async (weeks, metadata) => {
      savedPayloads.push({ weeks, metadata });
      return {
        success: true,
        data: {
          parsedWeeks: weeks,
          metadata,
        },
      };
    },
    selectActiveWeek: async (weekNumber) => {
      selected.push(weekNumber);
      return { success: true };
    },
  });

  const previewResult = await domain.previewMultiWeekPdfUpload({
    name: '7.pdf',
    size: 321,
  });

  assert.equal(previewResult.success, true);
  assert.equal(savedPayloads.length, 0);
  assert.equal(previewResult.review.weeksCount, 1);
  assert.match(previewResult.review.reviewText, /SEMANA 19/i);

  const commitResult = await domain.commitPendingImportReview();

  assert.equal(commitResult.success, true);
  assert.equal(savedPayloads.length, 1);
  assert.deepEqual(selected, [19]);
  assert.equal(emitted.some(([name]) => name === 'pdf:review'), true);
  assert.equal(emitted.some(([name]) => name === 'pdf:uploaded'), true);
});

test('review ativo permite reprocessar texto corrigido antes de salvar', async () => {
  const parseCalls = [];
  const { domain, emitted } = createDomain({
    parseTextIntoWeeks: (text, activeWeekNumber, options = {}) => {
      parseCalls.push({ text, activeWeekNumber, options });
      if (/quinta/i.test(text)) {
        return [{
          weekNumber: 24,
          workouts: [{ day: 'Quinta', blocks: [{ type: 'OPTIONAL', lines: ['800m SWIM'] }] }],
        }];
      }
      return [{
        weekNumber: 24,
        workouts: [{ day: 'Quarta', blocks: [{ type: 'WOD', lines: ['12 AMRAP'] }] }],
      }];
    },
  });

  const previewResult = await domain.previewUniversalImport({
    name: 'RX.2P.24semanas+2.BSBSTRONG.pdf.txt',
    type: 'text/plain',
    size: 180,
    async text() {
      return 'RX.2P.24semanas+2.BSBSTRONG.pdf\nQUARTA\nMANHA\nWOD\n12 AMRAP';
    },
  });

  assert.equal(previewResult.success, true);
  assert.doesNotMatch(previewResult.review.reviewText, /RX\.2P/i);
  assert.equal(parseCalls[0].options.fileName, 'RX.2P.24semanas+2.BSBSTRONG.pdf.txt');

  const reparseResult = await domain.reparsePendingImportReview('QUINTA\nTARDE\nOPTIONAL\n800m SWIM');

  assert.equal(reparseResult.success, true);
  assert.match(reparseResult.review.reviewText, /^QUINTA$/m);
  assert.equal(reparseResult.review.days.some((day) => day.day === 'Quinta'), true);
  assert.equal(emitted.filter(([name]) => name === 'media:review').length, 2);
});

test('confirmação de importação reposiciona o Hoje sem gravar override manual quando o dia atual não existe no arquivo', async () => {
  const parsedWeeks = [
    {
      weekNumber: 19,
      workouts: [
        { day: 'Quarta', blocks: [{ type: 'WOD', lines: ['12 AMRAP'] }] },
        { day: 'Quinta', blocks: [{ type: 'Strength', lines: ['Back squat'] }] },
      ],
    },
  ];
  const selected = [];
  const dayOverrideStorage = createMemoryStorage();
  const { domain, state, emitted } = createDomain({
    state: {
      weeks: [],
      prs: {},
      preferences: { theme: 'dark' },
      activeWeekNumber: 2,
      currentDay: 'Segunda',
    },
    dayOverrideStorage,
    previewMultiWeekPdf: async () => ({
      success: true,
      data: {
        parsedWeeks,
        metadata: {
          fileName: '7.pdf',
          fileSize: 321,
          source: 'pdf',
        },
      },
    }),
    saveParsedWeeks: async (weeks, metadata) => ({
      success: true,
      data: {
        parsedWeeks: weeks,
        metadata,
      },
    }),
    selectActiveWeek: async (weekNumber) => {
      selected.push(weekNumber);
      return { success: true };
    },
  });

  await domain.previewMultiWeekPdfUpload({
    name: '7.pdf',
    size: 321,
  });

  const commitResult = await domain.commitPendingImportReview();

  assert.equal(commitResult.success, true);
  assert.equal(state.currentDay, 'Quarta');
  assert.deepEqual(selected, [19]);
  assert.equal(await dayOverrideStorage.get('custom-day'), undefined);
  assert.equal(
    emitted.some(([name, payload]) => name === 'day:changed' && payload?.dayName === 'Quarta' && payload?.reason === 'import-fallback-auto' && payload?.manual === false),
    true,
  );
});

test('cancelar preview de importação limpa pendência sem salvar', async () => {
  const parsedWeeks = [
    {
      weekNumber: 7,
      workouts: [{ day: 'Segunda', blocks: [{ type: 'WOD', lines: ['row 10 min'] }] }],
    },
  ];
  const savedPayloads = [];
  const { domain, emitted } = createDomain({
    previewMultiWeekPdf: async () => ({
      success: true,
      data: {
        parsedWeeks,
        metadata: {
          fileName: '6.pdf',
          fileSize: 111,
          source: 'pdf',
        },
      },
    }),
    saveParsedWeeks: async (weeks, metadata) => {
      savedPayloads.push({ weeks, metadata });
      return {
        success: true,
        data: {
          parsedWeeks: weeks,
          metadata,
        },
      };
    },
  });

  await domain.previewMultiWeekPdfUpload({ name: '6.pdf', size: 111 });
  const cancelResult = await domain.cancelPendingImportReview();
  const commitAfterCancel = await domain.commitPendingImportReview();

  assert.equal(cancelResult.success, true);
  assert.equal(savedPayloads.length, 0);
  assert.equal(commitAfterCancel.success, false);
  assert.equal(emitted.some(([name]) => name === 'import:review-cleared'), true);
});
