export async function runAppInitialization(deps) {
  const {
    logDebug,
    checkDependencies,
    loadPersistedState,
    restoreSessionIfPossible,
    updateCurrentDay,
    loadSavedWeeks,
    setupEventListeners,
    bindOnlineSyncListener,
    exposeDebugAPIs,
    emit,
    getState,
  } = deps;

  logDebug('🚀 Iniciando aplicação...');

  checkDependencies();
  await loadPersistedState();
  await restoreSessionIfPossible();
  await updateCurrentDay();
  await loadSavedWeeks();
  setupEventListeners();
  bindOnlineSyncListener();
  exposeDebugAPIs();

  emit('app:ready', { state: getState() });
  logDebug('✅ Aplicação inicializada');

  return { success: true };
}

export async function restoreSessionIfPossible(deps) {
  const {
    hasStoredSession,
    handleRefreshSession,
    remoteHandlers,
    logDebug,
  } = deps;

  if (!hasStoredSession()) return;

  try {
    await handleRefreshSession();
    logDebug('🔐 Sessão restaurada');
  } catch (error) {
    await remoteHandlers.handleSignOut();
    console.warn('Falha ao restaurar sessão:', error?.message || error);
  }
}

export function checkDependencies(deps) {
  const {
    isPdfJsAvailable,
    createStorage,
    logDebug,
  } = deps;

  if (!isPdfJsAvailable()) {
    console.warn('⚠️ PDF.js não disponível. Upload de PDF não funcionará.');
  }

  const storage = createStorage('test', 0);
  if (!storage.isAvailable()) {
    throw new Error('Nenhum storage disponível');
  }

  logDebug('✅ Dependências verificadas');
}

export async function loadPersistedState(deps) {
  const {
    prsStorage,
    prefsStorage,
    getState,
    setState,
    logDebug,
  } = deps;

  try {
    const savedPRs = await prsStorage.get('prs');
    if (savedPRs && typeof savedPRs === 'object') {
      setState({ prs: savedPRs });
      logDebug(`📊 ${Object.keys(savedPRs).length} PRs carregados`);
    }

    const savedPrefs = await prefsStorage.get('preferences');
    if (savedPrefs && typeof savedPrefs === 'object') {
      setState({
        preferences: {
          ...getState().preferences,
          ...savedPrefs,
        },
      });
      logDebug('⚙️ Preferências carregadas');
    }
  } catch (error) {
    console.warn('Erro ao carregar estado persistido:', error);
  }
}

export async function updateCurrentDay(deps) {
  const {
    dayOverrideStorage,
    getDayName,
    setState,
    logDebug,
  } = deps;

  const customDay = await dayOverrideStorage.get('custom-day');
  const dayName = customDay || getDayName();

  setState({ currentDay: dayName });

  if (customDay) {
    logDebug(`📅 Dia atual: ${dayName} (manual)`);
  } else {
    logDebug(`📅 Dia atual: ${dayName} (automático)`);
  }
}

export function setupPersistenceListeners(deps) {
  const {
    subscribe,
    savePRsToStorage,
    savePreferencesToStorage,
    syncAthletePrSnapshotWithQueue,
    scheduleAppStateSync,
    logDebug,
  } = deps;

  let prsSaveTimeout = null;
  let prsSyncTimeout = null;
  let prefsSaveTimeout = null;
  let isProcessing = false;

  subscribe((newState, oldState) => {
    if (isProcessing) return;

    if (newState.prs !== oldState.prs) {
      clearTimeout(prsSaveTimeout);
      prsSaveTimeout = setTimeout(() => {
        savePRsToStorage(newState.prs);
      }, 500);

      clearTimeout(prsSyncTimeout);
      prsSyncTimeout = setTimeout(() => {
        syncAthletePrSnapshotWithQueue(newState.prs).catch((error) => {
          console.warn('Falha ao sincronizar PRs da conta:', error?.message || error);
        });
      }, 800);
    }
  });

  subscribe((newState, oldState) => {
    if (isProcessing) return;

    if (newState.preferences !== oldState.preferences) {
      clearTimeout(prefsSaveTimeout);
      prefsSaveTimeout = setTimeout(() => {
        savePreferencesToStorage(newState.preferences);
      }, 500);
    }
  });

  subscribe((newState, oldState) => {
    if (isProcessing) return;

    if (
      newState.preferences !== oldState.preferences
      || newState.activeWeekNumber !== oldState.activeWeekNumber
      || newState.currentDay !== oldState.currentDay
    ) {
      scheduleAppStateSync();
    }
  });

  logDebug('🎧 Event listeners configurados');
}
