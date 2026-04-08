import { renderAppShell, renderHeaderAccount, renderMainContent, renderBottomNav, renderModals } from './render.js';
import { setupActions } from './actions.js';
import { bindAppEvents } from './events.js';
import { getAppBridge } from '../app/bridge.js';
import { prepareAthleteLayoutRoot, ensureAthleteToast, setLayoutHtml, setLayoutText } from '../../apps/athlete/layoutShell.js';
import { buildAthleteUiForRender, normalizeAthleteUiState } from '../../apps/athlete/state/uiState.js';
import {
  createMeasurementSyncScheduler,
  getMeasurementSyncHash,
} from '../../apps/athlete/features/measurements/services.js';

export async function mountUI({ root }) {
  if (!root) throw new Error('mountUI: root é obrigatório');

  const refs = prepareAthleteLayoutRoot(root);
  const { toast } = ensureAthleteToast();

  const { createStorage } = await import('../adapters/storage/storageFactory.js');
  const uiStorage = createStorage('ui-state', 5000);

  // Estado de UI (não depende do core)
  let uiState = normalizeAthleteUiState((await uiStorage.get('state')) || {});
  let uiBusy = false;
  let uiBusyMessage = '';
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

  async function restoreUiStateFromAccount() {
    const localProfile = safeGetProfile();
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

  const setBusy = (isBusy, message) => {
    uiBusy = !!isBusy;
    uiBusyMessage = isBusy ? String(message || 'Carregando...') : '';
    const loadingEl = document.getElementById('loading-screen');
    if (!loadingEl) return;
    const labelEl = loadingEl.querySelector('[data-loading-label]');
    loadingEl.classList.toggle('hide', !isBusy);
    document.body.classList.toggle('ui-busy', !!isBusy);
    if (labelEl) {
      labelEl.textContent = uiBusyMessage || 'Carregando...';
    }
  };

  const pushEventLine = createEventLog(refs.events);
  const objectIds = new WeakMap();
  let nextObjectId = 1;
  let lastRendered = {
    headerSignature: '',
    headerHtml: '',
    mainSignature: '',
    mainHtml: '',
    bottomSignature: '',
    bottomHtml: '',
    modalSignature: '',
    modalHtml: '',
  };

  let renderQueued = false;
  let renderInflight = null;
  let lastRenderAt = 0;

  const getObjectIdentity = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return String(value ?? '');
    }
    let id = objectIds.get(value);
    if (!id) {
      id = nextObjectId++;
      objectIds.set(value, id);
    }
    return `#${id}`;
  };

  const buildHeaderSignature = (state) => getObjectIdentity(state?.__ui?.auth?.profile || null);
  const buildBottomSignature = (state) => String(state?.__ui?.currentPage || 'today');
  const buildModalSignature = (state) => [
    state?.__ui?.modal || '',
    state?.__ui?.authMode || '',
    getObjectIdentity(state?.__ui?.passwordReset || null),
    getObjectIdentity(state?.__ui?.signupVerification || null),
    getObjectIdentity(state?.__ui?.importStatus || null),
    getObjectIdentity(state?.__ui?.admin || null),
    getObjectIdentity(state?.__ui?.athleteOverview || null),
    getObjectIdentity(state?.__ui?.coachPortal || null),
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    state?.__ui?.isBusy ? '1' : '0',
  ].join('|');
  const buildMainSignature = (state) => [
    state?.__ui?.currentPage || 'today',
    state?.activeWeekNumber ?? '',
    state?.currentDay ?? '',
    getObjectIdentity(state?.weeks || null),
    getObjectIdentity(state?.workout || null),
    getObjectIdentity(state?.workoutOfDay || null),
    getObjectIdentity(state?.workoutContext || null),
    getObjectIdentity(state?.preferences || null),
    getObjectIdentity(state?.prs || null),
    getObjectIdentity(state?.__ui?.settings || null),
    getObjectIdentity(state?.__ui?.athleteOverview || null),
    getObjectIdentity(state?.__ui?.coachPortal || null),
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    state?.__ui?.isBusy ? '1' : '0',
  ].join('|');

  const performRender = async () => {
    const state = safeGetState();

    // Injeta estado de UI para o render (sem tocar no core)
    state.__ui = buildAthleteUiForRender({
      state,
      uiState,
      uiBusy,
      profile: safeGetProfile(),
    });

    document.body.dataset.page = state.__ui.currentPage || 'today';
    const headerSignature = buildHeaderSignature(state);
    if (headerSignature !== lastRendered.headerSignature) {
      lastRendered.headerSignature = headerSignature;
      lastRendered.headerHtml = renderHeaderAccount(state);
      setLayoutHtml(refs.headerAccount, lastRendered.headerHtml);
    }

    const mainSignature = buildMainSignature(state);
    if (mainSignature !== lastRendered.mainSignature) {
      lastRendered.mainSignature = mainSignature;
      lastRendered.mainHtml = renderMainContent(state);
      setLayoutHtml(refs.main, lastRendered.mainHtml);
    }

    const bottomSignature = buildBottomSignature(state);
    if (bottomSignature !== lastRendered.bottomSignature) {
      lastRendered.bottomSignature = bottomSignature;
      lastRendered.bottomHtml = renderBottomNav(state);
      setLayoutHtml(refs.bottomNav, lastRendered.bottomHtml);
    }

    const modalSignature = buildModalSignature(state);
    if (modalSignature !== lastRendered.modalSignature) {
      lastRendered.modalSignature = modalSignature;
      lastRendered.modalHtml = renderModals(state);
      setLayoutHtml(refs.modals, lastRendered.modalHtml);
    }

    // Contador de PR (se existir no shell)
    if (refs.prsCount) {
      const count = Object.keys(state?.prs || {}).length;
      setLayoutText(refs.prsCount, `${count} PRs`);
    }
  };

  const rerender = () => {
    if (renderInflight) return renderInflight;

    renderInflight = new Promise((resolve, reject) => {
      const flush = () => {
        renderQueued = false;
        Promise.resolve()
          .then(() => performRender())
          .then(() => {
            lastRenderAt = Date.now();
            resolve();
          })
          .catch(reject)
          .finally(() => {
            renderInflight = null;
          });
      };

      if (renderQueued || Date.now() - lastRenderAt < 12) {
        renderQueued = true;
        window.requestAnimationFrame(flush);
        return;
      }

      flush();
    });

    return renderInflight;
  };

  const destroyEvents = bindAppEvents({
    pushEventLine,
    rerender: () => rerender(),
    toast,
    setBusy,
    setImportStatus,
  });

  setupActions({
    root,
    toast,
    rerender: () => rerender(),
    getUiState,
    setUiState,
    patchUiState,
    setImportStatus,
  });

  // Primeira renderização: some com loading inicial
  setBusy(false);
  pushEventLine('UI montada');
  await rerender();

  return {
    rerender,
    destroy() {
      measurementSync.clear();
      try { destroyEvents?.(); } catch (e) { console.warn('destroyEvents falhou', e); }
    },
  };
}


function safeGetState() {
  try {
    if (getAppBridge()?.getStateSnapshot) return getAppBridge().getStateSnapshot();
    return getAppBridge()?.getState ? getAppBridge().getState() : {};
  } catch {
    return {};
  }
}

function safeGetProfile() {
  try {
    const result = getAppBridge()?.getProfile?.();
    return result?.data || null;
  } catch {
    return null;
  }
}

function createEventLog(containerEl) {
  const lines = [];
  const push = (msg) => {
    const time = new Date().toLocaleTimeString('pt-BR');
    lines.unshift(`${time}: ${msg}`);
    if (lines.length > 10) lines.pop();
    if (containerEl) {
      containerEl.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
    }
  };
  return push;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

