import test from 'node:test';
import assert from 'node:assert/strict';

import { createAccountSyncDomain } from '../src/app/accountSyncDomain.js';

function createLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

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

test('saveRemoteAppStateSnapshot persiste envelope local e sincroniza snapshot remoto mesclado', async () => {
  const APP_STATE_SYNC_KEY = 'app-state-sync';
  const state = {
    activeWeekNumber: 3,
    currentDay: 'Quarta',
    preferences: {
      theme: 'light',
      workoutPriority: 'coach',
      showGoals: true,
      showEmojis: true,
      showLbsConversion: true,
      autoConvertLbs: true,
    },
  };
  const localStorage = createLocalStorageMock();
  const calls = [];

  const domain = createAccountSyncDomain({
    getState: () => state,
    setState: () => {},
    windowObject: { localStorage, addEventListener: () => {} },
    navigatorObject: { onLine: true },
    prefsStorage: createMemoryStorage(),
    activeWeekStorage: createMemoryStorage(),
    pdfStorage: createMemoryStorage(),
    pdfMetaStorage: createMemoryStorage(),
    dayOverrideStorage: createMemoryStorage(),
    PDF_KEY: 'pdf',
    METADATA_KEY: 'meta',
    APP_STATE_SYNC_KEY,
    SYNC_OUTBOX_KEY: 'sync-outbox',
    handleGetProfile: () => ({ data: { id: 'athlete-1' } }),
    handleGetAppStateSnapshot: async () => ({}),
    handleSaveAppStateSnapshot: async (envelope) => {
      calls.push(envelope);
      return {
        data: {
          appState: {
            snapshot: {
              core: {
                preferences: {
                  serverFlag: true,
                },
              },
            },
            updatedAt: '2026-04-06T12:00:00.000Z',
          },
        },
      };
    },
    handleGetImportedPlanSnapshot: async () => ({}),
    handleSaveImportedPlanSnapshot: async () => ({}),
    remoteHandleSyncAthleteMeasurementsSnapshot: async () => ({}),
    remoteHandleSyncAthletePrSnapshot: async () => ({}),
    loadParsedWeeks: async () => ({ success: false }),
    selectActiveWeek: async () => ({}),
    setCustomDay: async () => ({}),
    resetToAutoDay: async () => ({}),
    logDebug: () => {},
  });

  const result = await domain.saveRemoteAppStateSnapshot({
    ui: { activeScreen: 'account' },
  });

  assert.deepEqual(result, { success: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].snapshot.core.activeWeekNumber, 3);
  assert.equal(calls[0].snapshot.ui.activeScreen, 'account');

  const persisted = JSON.parse(localStorage.getItem(APP_STATE_SYNC_KEY));
  assert.equal(persisted.updatedAt, '2026-04-06T12:00:00.000Z');
  assert.equal(persisted.snapshot.core.activeWeekNumber, 3);
  assert.equal(persisted.snapshot.core.preferences.theme, 'light');
  assert.equal(persisted.snapshot.core.preferences.serverFlag, true);
});

test('syncAthletePrSnapshotWithQueue guarda snapshot na outbox quando estiver offline', async () => {
  const SYNC_OUTBOX_KEY = 'sync-outbox';
  const localStorage = createLocalStorageMock();

  const domain = createAccountSyncDomain({
    getState: () => ({ preferences: {} }),
    setState: () => {},
    windowObject: { localStorage, addEventListener: () => {} },
    navigatorObject: { onLine: false },
    prefsStorage: createMemoryStorage(),
    activeWeekStorage: createMemoryStorage(),
    pdfStorage: createMemoryStorage(),
    pdfMetaStorage: createMemoryStorage(),
    dayOverrideStorage: createMemoryStorage(),
    PDF_KEY: 'pdf',
    METADATA_KEY: 'meta',
    APP_STATE_SYNC_KEY: 'app-state-sync',
    SYNC_OUTBOX_KEY,
    handleGetProfile: () => ({ data: { id: 'athlete-1' } }),
    handleGetAppStateSnapshot: async () => ({}),
    handleSaveAppStateSnapshot: async () => ({}),
    handleGetImportedPlanSnapshot: async () => ({}),
    handleSaveImportedPlanSnapshot: async () => ({}),
    remoteHandleSyncAthleteMeasurementsSnapshot: async () => ({}),
    remoteHandleSyncAthletePrSnapshot: async () => ({ success: true }),
    loadParsedWeeks: async () => ({ success: false }),
    selectActiveWeek: async () => ({}),
    setCustomDay: async () => ({}),
    resetToAutoDay: async () => ({}),
    logDebug: () => {},
  });

  const result = await domain.syncAthletePrSnapshotWithQueue({ squat: 140 });

  assert.deepEqual(result, { success: false, queued: true });
  const outbox = JSON.parse(localStorage.getItem(SYNC_OUTBOX_KEY));
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].kind, 'pr_snapshot');
  assert.deepEqual(outbox[0].payload, { squat: 140 });
});

test('restoreImportedPlanFromAccount restaura plano remoto mais novo e seleciona semana ativa', async () => {
  const state = {
    currentDay: 'Segunda',
    weeks: [],
    activeWeekNumber: null,
    preferences: {},
  };
  const pdfStorage = createMemoryStorage();
  const pdfMetaStorage = createMemoryStorage();
  const activeWeekStorage = createMemoryStorage();
  const selectedWeeks = [];

  const remoteWeeks = [
    {
      weekNumber: 7,
      workouts: [{ day: 'Segunda', sections: [{ type: 'warmup', lines: ['row 10 min'] }] }],
    },
  ];

  const domain = createAccountSyncDomain({
    getState: () => state,
    setState: (patch) => {
      Object.assign(state, patch);
    },
    windowObject: { localStorage: createLocalStorageMock(), addEventListener: () => {} },
    navigatorObject: { onLine: true },
    prefsStorage: createMemoryStorage(),
    activeWeekStorage,
    pdfStorage,
    pdfMetaStorage,
    dayOverrideStorage: createMemoryStorage(),
    PDF_KEY: 'pdf',
    METADATA_KEY: 'meta',
    APP_STATE_SYNC_KEY: 'app-state-sync',
    SYNC_OUTBOX_KEY: 'sync-outbox',
    handleGetProfile: () => ({ data: { id: 'athlete-1' } }),
    handleGetAppStateSnapshot: async () => ({}),
    handleSaveAppStateSnapshot: async () => ({}),
    handleGetImportedPlanSnapshot: async () => ({
      data: {
        importedPlan: {
          weeks: remoteWeeks,
          activeWeekNumber: 7,
          updatedAt: '2026-04-06T13:00:00.000Z',
          metadata: {
            uploadedAt: '2026-04-06T13:00:00.000Z',
            source: 'coach-sync',
          },
        },
      },
    }),
    handleSaveImportedPlanSnapshot: async () => ({}),
    remoteHandleSyncAthleteMeasurementsSnapshot: async () => ({}),
    remoteHandleSyncAthletePrSnapshot: async () => ({}),
    loadParsedWeeks: async () => ({
      success: true,
      data: {
        metadata: {
          uploadedAt: '2026-04-05T13:00:00.000Z',
        },
      },
    }),
    selectActiveWeek: async (weekNumber) => {
      selectedWeeks.push(weekNumber);
      state.activeWeekNumber = weekNumber;
      return { success: true };
    },
    setCustomDay: async () => ({}),
    resetToAutoDay: async () => ({}),
    logDebug: () => {},
  });

  const result = await domain.restoreImportedPlanFromAccount();

  assert.deepEqual(result, { success: true, restored: true });
  assert.deepEqual(state.weeks, remoteWeeks);
  assert.equal(state.activeWeekNumber, 7);
  assert.deepEqual(selectedWeeks, [7]);
  assert.deepEqual(await pdfStorage.get('pdf'), remoteWeeks);
  assert.equal((await pdfMetaStorage.get('meta')).remoteSynced, true);
  assert.equal(await activeWeekStorage.get('active-week'), 7);
});

test('flushPendingSyncOutbox envia snapshots pendentes quando a rede volta e limpa a fila', async () => {
  const SYNC_OUTBOX_KEY = 'sync-outbox';
  const localStorage = createLocalStorageMock({
    [SYNC_OUTBOX_KEY]: JSON.stringify([
      { kind: 'pr_snapshot', payload: { squat: 155 } },
      { kind: 'measurement_snapshot', payload: [{ type: 'weight', value: 82 }] },
    ]),
  });
  const calls = {
    prs: [],
    measurements: [],
  };

  const domain = createAccountSyncDomain({
    getState: () => ({ preferences: {} }),
    setState: () => {},
    windowObject: { localStorage, addEventListener: () => {} },
    navigatorObject: { onLine: true },
    prefsStorage: createMemoryStorage(),
    activeWeekStorage: createMemoryStorage(),
    pdfStorage: createMemoryStorage(),
    pdfMetaStorage: createMemoryStorage(),
    dayOverrideStorage: createMemoryStorage(),
    PDF_KEY: 'pdf',
    METADATA_KEY: 'meta',
    APP_STATE_SYNC_KEY: 'app-state-sync',
    SYNC_OUTBOX_KEY,
    handleGetProfile: () => ({ data: { id: 'athlete-1' } }),
    handleGetAppStateSnapshot: async () => ({}),
    handleSaveAppStateSnapshot: async () => ({}),
    handleGetImportedPlanSnapshot: async () => ({}),
    handleSaveImportedPlanSnapshot: async () => ({}),
    remoteHandleSyncAthleteMeasurementsSnapshot: async (payload) => {
      calls.measurements.push(payload);
      return { success: true };
    },
    remoteHandleSyncAthletePrSnapshot: async (payload) => {
      calls.prs.push(payload);
      return { success: true };
    },
    loadParsedWeeks: async () => ({ success: false }),
    selectActiveWeek: async () => ({}),
    setCustomDay: async () => ({}),
    resetToAutoDay: async () => ({}),
    logDebug: () => {},
  });

  const result = await domain.flushPendingSyncOutbox();

  assert.deepEqual(result, { success: true });
  assert.deepEqual(calls.prs, [{ squat: 155 }]);
  assert.deepEqual(calls.measurements, [[{ type: 'weight', value: 82 }]]);
  assert.deepEqual(JSON.parse(localStorage.getItem(SYNC_OUTBOX_KEY)), []);
});
