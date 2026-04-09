import { getAppBridge } from '../../../src/app/bridge.js';

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

export function buildUiSnapshotSignature(value) {
  const currentPage = value?.currentPage || 'today';
  const accountView = value?.accountView || 'overview';
  const settings = value?.settings || {};
  const wod = value?.wod || {};
  const coachGymId = value?.coachPortal?.selectedGymId || null;
  const wodKeys = Object.keys(wod).sort();
  return [
    currentPage,
    accountView,
    coachGymId,
    settings.showLbsConversion ? 1 : 0,
    settings.showEmojis ? 1 : 0,
    settings.showObjectivesInWods ? 1 : 0,
    settings.showNyxHints ? 1 : 0,
    settings.theme || 'dark',
    settings.accentTone || 'blue',
    settings.interfaceDensity || 'comfortable',
    settings.reduceMotion ? 1 : 0,
    settings.workoutPriority || 'uploaded',
    wodKeys.length,
    ...wodKeys.map((key) => {
      const entry = wod[key] || {};
      return `${key}:${entry.activeLineId || ''}:${Object.keys(entry.done || {}).length}`;
    }),
  ].join('|');
}

export async function restoreUiStateFromAccount() {
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
      accountView: snapshot.ui.accountView,
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
