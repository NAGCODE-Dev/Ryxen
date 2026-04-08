import { getAppBridge } from '../../../src/app/bridge.js';
import {
  createMeasurementSyncScheduler,
  getMeasurementSyncHash,
} from '../features/measurements/services.js';
import { normalizeAthleteUiState } from '../state/uiState.js';

export async function createAthleteUiStateController({ createStorage }) {
  const uiStorage = createStorage('ui-state', 5000);

  let uiState = normalizeAthleteUiState((await uiStorage.get('state')) || {});
  let uiSyncTimeout = null;
  let uiPersistTimeout = null;
  const measurementSync = createMeasurementSyncScheduler({
    getAppBridge,
    initialHash: getMeasurementSyncHash(uiState?.athleteOverview?.measurements),
  });
  await uiStorage.set('state', uiState);

  const remoteUiState = await restoreUiStateFromAccount();
  if (remoteUiState) {
    uiState = normalizeAthleteUiState({ ...uiState, ...remoteUiState });
    await uiStorage.set('state', uiState);
  }

  function scheduleUiStatePersist(nextState) {
    clearTimeout(uiPersistTimeout);
    uiPersistTimeout = window.setTimeout(() => {
      void uiStorage.set('state', nextState);
    }, 80);
  }

  function scheduleUiStateSync(previous, next) {
    if (buildUiSnapshotSignature(previous) === buildUiSnapshotSignature(next)) {
      return;
    }

    clearTimeout(uiSyncTimeout);
    uiSyncTimeout = window.setTimeout(() => {
      getAppBridge()?.saveAppStateSnapshot?.({
        ui: {
          currentPage: next?.currentPage || 'today',
          settings: next?.settings || {},
          wod: next?.wod || {},
          coachPortal: {
            selectedGymId: next?.coachPortal?.selectedGymId || null,
          },
        },
      });
    }, 300);
  }

  const getUiState = () => uiState;

  const setImportStatus = (nextStatus) => {
    uiState = normalizeAthleteUiState({
      ...uiState,
      importStatus: nextStatus && typeof nextStatus === 'object'
        ? { ...uiState.importStatus, ...nextStatus }
        : null,
    });
    scheduleUiStatePersist(uiState);
  };

  const setUiState = async (next) => {
    const previous = uiState;
    uiState = normalizeAthleteUiState({ ...uiState, ...(next || {}) });
    scheduleUiStatePersist(uiState);
    scheduleUiStateSync(previous, uiState);
    measurementSync.schedule(previous, uiState);
  };

  const patchUiState = async (fn) => {
    const current = uiState;
    const updated = normalizeAthleteUiState((fn && fn(current)) || current);
    uiState = updated;
    scheduleUiStatePersist(updated);
    scheduleUiStateSync(current, updated);
    measurementSync.schedule(current, updated);
  };

  return {
    getUiState,
    setImportStatus,
    setUiState,
    patchUiState,
    destroy() {
      clearTimeout(uiSyncTimeout);
      clearTimeout(uiPersistTimeout);
      measurementSync.clear();
    },
  };
}

export function safeGetAthleteAppState() {
  try {
    if (getAppBridge()?.getStateSnapshot) return getAppBridge().getStateSnapshot();
    return getAppBridge()?.getState ? getAppBridge().getState() : {};
  } catch {
    return {};
  }
}

export function safeGetAthleteProfile() {
  try {
    const result = getAppBridge()?.getProfile?.();
    return result?.data || null;
  } catch {
    return null;
  }
}

export function createAthleteEventLog(containerEl) {
  const lines = [];
  return (message) => {
    const time = new Date().toLocaleTimeString('pt-BR');
    lines.unshift(`${time}: ${message}`);
    if (lines.length > 10) lines.pop();
    if (containerEl) {
      containerEl.innerHTML = lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
    }
  };
}

function buildUiSnapshotSignature(value) {
  const currentPage = value?.currentPage || 'today';
  const settings = value?.settings || {};
  const wod = value?.wod || {};
  const coachGymId = value?.coachPortal?.selectedGymId || null;
  const wodKeys = Object.keys(wod).sort();
  return [
    currentPage,
    coachGymId,
    settings.showLbsConversion ? 1 : 0,
    settings.showEmojis ? 1 : 0,
    settings.showObjectivesInWods ? 1 : 0,
    wodKeys.length,
    ...wodKeys.map((key) => {
      const entry = wod[key] || {};
      return `${key}:${entry.activeLineId || ''}:${Object.keys(entry.done || {}).length}`;
    }),
  ].join('|');
}

async function restoreUiStateFromAccount() {
  const localProfile = safeGetAthleteProfile();
  if (!localProfile?.email) {
    return null;
  }

  try {
    const response = await getAppBridge()?.getAppStateSnapshot?.();
    const snapshot = response?.data?.appState?.snapshot || null;
    if (!snapshot?.ui || typeof snapshot.ui !== 'object') return null;
    return {
      currentPage: snapshot.ui.currentPage,
      settings: snapshot.ui.settings,
      wod: snapshot.ui.wod,
      coachPortal: snapshot.ui.coachPortal,
    };
  } catch {
    return null;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
