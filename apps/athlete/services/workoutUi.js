import { getAppBridge } from '../../../src/app/bridge.js';

let activeRestTimer = null;

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

export function startRestTimer(totalSeconds, toast, options = {}) {
  const initialSeconds = Math.max(1, Number(totalSeconds) || 0);
  const initialMode = options.mode === 'fullscreen' ? 'fullscreen' : 'popup';

  if (activeRestTimer?.destroy) {
    activeRestTimer.destroy(false);
    activeRestTimer = null;
  }

  let remaining = initialSeconds;
  let paused = false;
  let intervalId = null;

  const modal = document.createElement('div');
  modal.className = `timer-modal ${initialMode === 'fullscreen' ? 'is-fullscreen' : 'is-popup'}`;
  modal.innerHTML = `
    <div class="timer-content">
      <div class="timer-topbar">
        <div class="timer-kicker">Timer de descanso</div>
        <button class="btn-timer-close" type="button" data-timer-close>Fechar</button>
      </div>
      <div class="timer-time" data-timer-time>${formatTime(remaining)}</div>
      <div class="timer-progress">
        <div class="timer-progressBar" data-timer-progress></div>
      </div>
      <div class="timer-meta" data-timer-meta>${Math.ceil(remaining / 60)} min restantes</div>
      <div class="timer-actions">
        <button class="btn-timer-secondary" type="button" data-timer-minus>−30s</button>
        <button class="btn-timer-primary" type="button" data-timer-toggle>${paused ? 'Retomar' : 'Pausar'}</button>
        <button class="btn-timer-secondary" type="button" data-timer-plus>+30s</button>
      </div>
      <div class="timer-actions timer-actions-modes">
        <button class="btn-timer-mode ${initialMode === 'popup' ? 'is-active' : ''}" type="button" data-timer-mode="popup">Popup</button>
        <button class="btn-timer-mode ${initialMode === 'fullscreen' ? 'is-active' : ''}" type="button" data-timer-mode="fullscreen">Tela cheia</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const display = modal.querySelector('[data-timer-time]');
  const progress = modal.querySelector('[data-timer-progress]');
  const meta = modal.querySelector('[data-timer-meta]');
  const toggleButton = modal.querySelector('[data-timer-toggle]');
  const modeButtons = Array.from(modal.querySelectorAll('[data-timer-mode]'));

  const updateModeButtons = (mode) => {
    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.timerMode === mode);
    });
  };

  const updateDisplay = () => {
    if (display) display.textContent = formatTime(remaining);
    if (meta) meta.textContent = paused
      ? `Pausado em ${formatTime(remaining)}`
      : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} restantes`;
    if (progress) {
      const ratio = Math.max(0, Math.min(1, remaining / initialSeconds));
      progress.style.width = `${ratio * 100}%`;
    }
    if (toggleButton) toggleButton.textContent = paused ? 'Retomar' : 'Pausar';
  };

  const applyMode = async (mode) => {
    const nextMode = mode === 'fullscreen' ? 'fullscreen' : 'popup';
    modal.classList.toggle('is-fullscreen', nextMode === 'fullscreen');
    modal.classList.toggle('is-popup', nextMode === 'popup');
    updateModeButtons(nextMode);

    if (nextMode === 'fullscreen' && modal.requestFullscreen) {
      try { await modal.requestFullscreen(); } catch {}
    }

    if (nextMode === 'popup' && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  };

  const tick = () => {
    if (paused) return;
    remaining -= 1;
    updateDisplay();

    if (remaining <= 0) {
      destroy(true);
      toast('Descanso finalizado');
    }
  };

  const startInterval = () => {
    intervalId = window.setInterval(tick, 1000);
  };

  function destroy(showToast = true) {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (document.fullscreenElement === modal) {
      document.exitFullscreen().catch(() => {});
    }
    modal.remove();
    if (activeRestTimer?.modal === modal) activeRestTimer = null;
    if (!showToast) return;
  }

  modal.querySelector('[data-timer-close]')?.addEventListener('click', () => {
    destroy(false);
    toast('Timer fechado');
  });

  modal.querySelector('[data-timer-toggle]')?.addEventListener('click', () => {
    paused = !paused;
    updateDisplay();
  });

  modal.querySelector('[data-timer-minus]')?.addEventListener('click', () => {
    remaining = Math.max(5, remaining - 30);
    updateDisplay();
  });

  modal.querySelector('[data-timer-plus]')?.addEventListener('click', () => {
    remaining += 30;
    updateDisplay();
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => applyMode(button.dataset.timerMode));
  });

  activeRestTimer = { modal, destroy, applyMode };
  updateDisplay();
  startInterval();
  applyMode(initialMode);
}

export function cssEscape(value) {
  return String(value || '').replace(/[\"\\]/g, '\\$&');
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
