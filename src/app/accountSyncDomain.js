export function createAccountSyncDomain({
  getState,
  setState,
  windowObject,
  navigatorObject,
  prefsStorage,
  activeWeekStorage,
  pdfStorage,
  pdfMetaStorage,
  dayOverrideStorage,
  PDF_KEY,
  METADATA_KEY,
  APP_STATE_SYNC_KEY,
  SYNC_OUTBOX_KEY,
  handleGetProfile,
  handleGetAppStateSnapshot,
  handleSaveAppStateSnapshot,
  handleGetImportedPlanSnapshot,
  handleSaveImportedPlanSnapshot,
  remoteHandleSyncAthleteMeasurementsSnapshot,
  remoteHandleSyncAthletePrSnapshot,
  loadParsedWeeks,
  selectActiveWeek,
  setCustomDay,
  resetToAutoDay,
  logDebug,
}) {
  let appStateSyncTimer = null;
  let onlineSyncListenerBound = false;

  async function syncImportedPlanToAccount(weeks, metadata = {}) {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id || !Array.isArray(weeks) || !weeks.length) {
      return { success: false, skipped: true };
    }

    try {
      const currentState = getState();
      await handleSaveImportedPlanSnapshot({
        weeks,
        metadata,
        activeWeekNumber: currentState.activeWeekNumber || weeks[0]?.weekNumber || null,
      });
      return { success: true };
    } catch (error) {
      console.warn('Falha ao sincronizar plano importado para a conta:', error?.message || error);
      return { success: false, error };
    }
  }

  function bindOnlineSyncListener() {
    if (onlineSyncListenerBound || !windowObject) return;
    onlineSyncListenerBound = true;
    windowObject.addEventListener('online', () => {
      Promise.allSettled([
        flushPendingAppStateSync(),
        flushPendingSyncOutbox(),
      ]).catch(() => {});
    });
  }

  function scheduleAppStateSync(partial = null) {
    clearTimeout(appStateSyncTimer);
    appStateSyncTimer = setTimeout(() => {
      saveRemoteAppStateSnapshot(partial).catch((error) => {
        console.warn('Falha ao sincronizar estado do app:', error?.message || error);
      });
    }, 350);
  }

  function buildCurrentAppStateSnapshot(partial = null) {
    const state = getState();
    const normalizedPartial = partial && typeof partial === 'object' ? partial : {};
    return {
      core: {
        activeWeekNumber: state.activeWeekNumber || null,
        currentDay: state.currentDay || null,
        daySource: hasCustomDayOverride() ? 'manual' : 'auto',
        preferences: {
          showLbsConversion: state.preferences?.showLbsConversion !== false,
          autoConvertLbs: state.preferences?.autoConvertLbs !== false,
          showEmojis: state.preferences?.showEmojis !== false,
          showGoals: state.preferences?.showGoals !== false,
          workoutPriority: String(state.preferences?.workoutPriority || 'uploaded'),
          theme: String(state.preferences?.theme || 'dark'),
        },
      },
      ...(normalizedPartial.ui && typeof normalizedPartial.ui === 'object'
        ? { ui: normalizedPartial.ui }
        : {}),
    };
  }

  async function saveRemoteAppStateSnapshot(partial = null) {
    const profile = handleGetProfile()?.data || null;
    const snapshot = mergeAppStateSnapshot(loadLocalAppStateEnvelope()?.snapshot || {}, buildCurrentAppStateSnapshot(partial));
    const envelope = {
      snapshot,
      updatedAt: new Date().toISOString(),
    };

    persistLocalAppStateEnvelope(envelope);

    if (!profile?.id || !navigatorObject?.onLine) {
      return { success: false, queued: true };
    }

    const result = await handleSaveAppStateSnapshot(envelope);
    persistLocalAppStateEnvelope({
      snapshot: mergeAppStateSnapshot(snapshot, result?.data?.appState?.snapshot || {}),
      updatedAt: result?.data?.appState?.updatedAt || envelope.updatedAt,
    });
    return { success: true };
  }

  async function restoreAppStateFromAccount(options = {}) {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id) {
      return { success: false, skipped: true };
    }

    const localEnvelope = loadLocalAppStateEnvelope();

    try {
      const response = await handleGetAppStateSnapshot();
      const remoteAppState = response?.data?.appState || null;

      if (!remoteAppState?.snapshot) {
        if (localEnvelope?.snapshot && navigatorObject?.onLine) {
          await flushPendingAppStateSync();
        }
        return { success: true, restored: false };
      }

      const localUpdatedAt = Date.parse(localEnvelope?.updatedAt || 0);
      const remoteUpdatedAt = Date.parse(remoteAppState.updatedAt || 0);
      const shouldRestore = options.force === true
        || !localEnvelope?.snapshot
        || (Number.isFinite(remoteUpdatedAt) && remoteUpdatedAt >= localUpdatedAt);

      if (!shouldRestore) {
        await flushPendingAppStateSync();
        return { success: true, restored: false, keptLocal: true };
      }

      await applyRemoteAppStateSnapshot(remoteAppState.snapshot || {});
      persistLocalAppStateEnvelope({
        snapshot: mergeAppStateSnapshot(localEnvelope?.snapshot || {}, remoteAppState.snapshot || {}),
        updatedAt: remoteAppState.updatedAt || new Date().toISOString(),
      });
      return { success: true, restored: true };
    } catch (error) {
      console.warn('Falha ao restaurar estado sincronizado da conta:', error?.message || error);
      return { success: false, error };
    }
  }

  async function applyRemoteAppStateSnapshot(snapshot = {}) {
    const core = snapshot?.core && typeof snapshot.core === 'object' ? snapshot.core : {};
    const preferences = core.preferences && typeof core.preferences === 'object' ? core.preferences : null;

    if (preferences) {
      const mergedPreferences = {
        ...getState().preferences,
        ...preferences,
      };
      setState({ preferences: mergedPreferences });
      await prefsStorage.set('preferences', mergedPreferences);
    }

    const remoteWeek = Number(core.activeWeekNumber) || null;
    if (remoteWeek) {
      await activeWeekStorage.set('active-week', remoteWeek);
      if (getState().weeks?.length) {
        await selectActiveWeek(remoteWeek);
      } else {
        setState({ activeWeekNumber: remoteWeek });
      }
    }

    const remoteDay = String(core.currentDay || '').trim();
    const daySource = String(core.daySource || 'auto').trim().toLowerCase();
    if (daySource === 'manual' && remoteDay) {
      await setCustomDay(remoteDay);
    } else if (daySource === 'auto') {
      await resetToAutoDay();
    }
  }

  async function flushPendingAppStateSync() {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id || !navigatorObject?.onLine) return { success: false, skipped: true };
    const envelope = loadLocalAppStateEnvelope();
    if (!envelope?.snapshot) return { success: false, skipped: true };

    const result = await handleSaveAppStateSnapshot(envelope);
    persistLocalAppStateEnvelope({
      snapshot: mergeAppStateSnapshot(envelope.snapshot, result?.data?.appState?.snapshot || {}),
      updatedAt: result?.data?.appState?.updatedAt || envelope.updatedAt,
    });
    return { success: true };
  }

  async function syncAthletePrSnapshotWithQueue(prs) {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id) return { success: false, skipped: true };
    const payload = prs && typeof prs === 'object' ? prs : {};

    if (!navigatorObject?.onLine) {
      queueSyncOutboxItem('pr_snapshot', payload);
      return { success: false, queued: true };
    }

    try {
      const result = await remoteHandleSyncAthletePrSnapshot(payload);
      dequeueSyncOutboxItem('pr_snapshot');
      return result;
    } catch (error) {
      queueSyncOutboxItem('pr_snapshot', payload);
      return { success: false, queued: true, error };
    }
  }

  async function syncAthleteMeasurementsSnapshotWithQueue(measurements) {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id) return { success: false, skipped: true };
    const payload = Array.isArray(measurements) ? measurements : [];

    if (!navigatorObject?.onLine) {
      queueSyncOutboxItem('measurement_snapshot', payload);
      return { success: false, queued: true };
    }

    try {
      const result = await remoteHandleSyncAthleteMeasurementsSnapshot(payload);
      dequeueSyncOutboxItem('measurement_snapshot');
      return result;
    } catch (error) {
      queueSyncOutboxItem('measurement_snapshot', payload);
      return { success: false, queued: true, error };
    }
  }

  async function flushPendingSyncOutbox() {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id || !navigatorObject?.onLine) return { success: false, skipped: true };

    const outbox = readSyncOutbox();
    const prSnapshot = outbox.find((item) => item.kind === 'pr_snapshot');
    const measurementSnapshot = outbox.find((item) => item.kind === 'measurement_snapshot');

    if (!prSnapshot && !measurementSnapshot) {
      return { success: false, skipped: true };
    }

    if (prSnapshot) {
      await remoteHandleSyncAthletePrSnapshot(prSnapshot.payload || {});
      dequeueSyncOutboxItem('pr_snapshot');
    }

    if (measurementSnapshot) {
      await remoteHandleSyncAthleteMeasurementsSnapshot(Array.isArray(measurementSnapshot.payload) ? measurementSnapshot.payload : []);
      dequeueSyncOutboxItem('measurement_snapshot');
    }

    return { success: true };
  }

  async function restoreImportedPlanFromAccount(options = {}) {
    const profile = handleGetProfile()?.data || null;
    if (!profile?.id) {
      return { success: false, skipped: true };
    }

    try {
      const response = await handleGetImportedPlanSnapshot();
      const importedPlan = response?.data?.importedPlan || null;
      if (!importedPlan?.weeks?.length) {
        return { success: true, restored: false };
      }

      const localResult = await loadParsedWeeks();
      const localMetadata = localResult.success ? (localResult.data?.metadata || {}) : {};
      const localUpdatedAt = Date.parse(localMetadata?.uploadedAt || 0);
      const remoteUpdatedAt = Date.parse(importedPlan.updatedAt || importedPlan.metadata?.uploadedAt || 0);
      const shouldRestore = options.force === true
        || !localResult.success
        || (Number.isFinite(remoteUpdatedAt) && remoteUpdatedAt > localUpdatedAt);

      if (!shouldRestore) {
        return { success: true, restored: false, skipped: true };
      }

      const metadata = {
        ...(importedPlan.metadata || {}),
        uploadedAt: importedPlan.updatedAt || importedPlan.metadata?.uploadedAt || new Date().toISOString(),
        source: importedPlan.metadata?.source || 'account-sync',
        remoteSynced: true,
      };

      await pdfStorage.set(PDF_KEY, importedPlan.weeks);
      await pdfMetaStorage.set(METADATA_KEY, metadata);

      const preferredWeek = importedPlan.activeWeekNumber || importedPlan.weeks[0]?.weekNumber || null;
      if (preferredWeek) {
        await activeWeekStorage.set('active-week', preferredWeek);
      } else {
        await activeWeekStorage.remove('active-week');
      }

      setState({
        weeks: importedPlan.weeks,
        activeWeekNumber: preferredWeek,
      });

      if (getState().currentDay) {
        await selectActiveWeek(preferredWeek || importedPlan.weeks[0]?.weekNumber);
      }

      return { success: true, restored: true };
    } catch (error) {
      console.warn('Falha ao restaurar plano importado da conta:', error?.message || error);
      return { success: false, error };
    }
  }

  function readSyncOutbox() {
    try {
      const raw = windowObject.localStorage.getItem(SYNC_OUTBOX_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeSyncOutbox(items) {
    try {
      windowObject.localStorage.setItem(SYNC_OUTBOX_KEY, JSON.stringify(Array.isArray(items) ? items : []));
    } catch {
      // no-op
    }
  }

  function queueSyncOutboxItem(kind, payload) {
    const items = readSyncOutbox().filter((item) => item?.kind !== kind);
    items.push({
      kind,
      payload,
      updatedAt: new Date().toISOString(),
    });
    writeSyncOutbox(items);
  }

  function dequeueSyncOutboxItem(kind) {
    const items = readSyncOutbox().filter((item) => item?.kind !== kind);
    writeSyncOutbox(items);
  }

  function loadLocalAppStateEnvelope() {
    try {
      const raw = windowObject.localStorage.getItem(APP_STATE_SYNC_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function persistLocalAppStateEnvelope(envelope) {
    try {
      windowObject.localStorage.setItem(APP_STATE_SYNC_KEY, JSON.stringify(envelope || {}));
    } catch {
      // no-op
    }
  }

  function mergeAppStateSnapshot(base = {}, override = {}) {
    const output = { ...(base || {}) };
    Object.keys(override || {}).forEach((key) => {
      const baseValue = output[key];
      const nextValue = override[key];
      if (isPlainObject(baseValue) && isPlainObject(nextValue)) {
        output[key] = mergeAppStateSnapshot(baseValue, nextValue);
      } else {
        output[key] = nextValue;
      }
    });
    return output;
  }

  function hasCustomDayOverride() {
    try {
      return windowObject.localStorage.getItem('day-override:custom-day') !== null;
    } catch {
      return false;
    }
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    syncImportedPlanToAccount,
    bindOnlineSyncListener,
    scheduleAppStateSync,
    saveRemoteAppStateSnapshot,
    restoreAppStateFromAccount,
    applyRemoteAppStateSnapshot,
    flushPendingAppStateSync,
    syncAthletePrSnapshotWithQueue,
    syncAthleteMeasurementsSnapshotWithQueue,
    flushPendingSyncOutbox,
    restoreImportedPlanFromAccount,
  };
}
