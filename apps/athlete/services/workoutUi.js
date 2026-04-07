import { getAppBridge } from '../../../src/app/bridge.js';

export function workoutKeyFromAppState() {
  const bridge = getAppBridge?.();
  const state = bridge?.getStateSnapshot ? bridge.getStateSnapshot() : (bridge?.getState?.() || {});
  const week = state?.activeWeekNumber ?? '0';
  const day = state?.currentDay ?? 'Hoje';
  return `${week}:${String(day).toLowerCase()}`;
}

export function getActiveLineIdFromUi(uiState, key) {
  try {
    const wod = uiState?.wod?.[key];
    return wod?.activeLineId || null;
  } catch {
    return null;
  }
}

export function getLineIdsFromDOM(root) {
  return Array.from(root.querySelectorAll('[data-line-id]'))
    .map((element) => element.getAttribute('data-line-id'))
    .filter(Boolean);
}

export function pickNextId(ids, doneMap, currentId) {
  const done = doneMap || {};
  const start = Math.max(0, ids.indexOf(currentId));
  for (let index = start + 1; index < ids.length; index++) if (!done[ids[index]]) return ids[index];
  for (let index = 0; index < ids.length; index++) if (!done[ids[index]]) return ids[index];
  return ids[Math.min(start + 1, ids.length - 1)] || ids[0];
}

export function pickPrevId(ids, currentId) {
  const index = ids.indexOf(currentId);
  if (index <= 0) return ids[0];
  return ids[index - 1];
}

export function scrollToLine(root, lineId) {
  const element = root.querySelector(`[data-line-id="${cssEscape(lineId)}"]`);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function startRestTimer(totalSeconds, toast) {
  let remaining = totalSeconds;

  const modal = document.createElement('div');
  modal.className = 'timer-modal';
  modal.innerHTML = `
    <div class="timer-content">
      <div class="timer-time" id="timer-time">${formatTime(remaining)}</div>
      <button class="btn-timer-cancel" id="timer-cancel">Cancelar</button>
    </div>
  `;

  document.body.appendChild(modal);

  const display = document.getElementById('timer-time');
  const cancel = document.getElementById('timer-cancel');

  const interval = setInterval(() => {
    remaining--;
    display.textContent = formatTime(remaining);

    if (remaining <= 0) {
      clearInterval(interval);
      document.body.removeChild(modal);
      toast('✅ Descanso finalizado!');
    }
  }, 1000);

  cancel.onclick = () => {
    clearInterval(interval);
    document.body.removeChild(modal);
    toast('⏹️ Timer cancelado');
  };
}

export function cssEscape(value) {
  return String(value || '').replace(/[\"\\]/g, '\\$&');
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
