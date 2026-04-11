import { getAppBridge } from '../../../src/app/bridge.js';

let activeWorkoutTimer = null;
const TIMER_POPUP_LAYOUT_KEY = 'ryxen-workout-timer-popup-v1';
const TIMER_LAST_CUSTOM_CONFIG_KEY = 'ryxen-workout-timer-last-config-v1';
const MIN_TIMER_POPUP_WIDTH = 280;
const MIN_TIMER_POPUP_HEIGHT = 360;
const TIMER_PRESET_LIBRARY = Object.freeze([
  { id: 'countdown-60', label: '60s', config: { kind: 'countdown', label: '60 segundos', detail: 'Contagem regressiva', totalSeconds: 60, prepSeconds: 0 } },
  { id: 'rest-90', label: '90s', config: { kind: 'countdown', label: 'Descanso 90s', detail: 'Descanso', totalSeconds: 90, prepSeconds: 0 } },
  { id: 'cap-20', label: '20 min', config: { kind: 'countdown', label: '20 minutos', detail: 'Cap', totalSeconds: 20 * 60, prepSeconds: 10 } },
  { id: 'tabata', label: '8x20/10', config: { kind: 'interval', label: '8x20/10', detail: 'Tabata', rounds: 8, workSeconds: 20, restSeconds: 10, prepSeconds: 10 } },
  { id: 'interval-10x45', label: '10x45/15', config: { kind: 'interval', label: '10x45/15', detail: 'Intervalado', rounds: 10, workSeconds: 45, restSeconds: 15, prepSeconds: 10 } },
  { id: 'countup-free', label: 'Livre', config: { kind: 'countup', label: 'Cronômetro livre', detail: 'Livre', capSeconds: 0, prepSeconds: 0 } },
]);

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

export const scrollToWorkoutLine = scrollToLine;

export function clearWorkoutTimer() {
  if (activeWorkoutTimer?.destroy) {
    activeWorkoutTimer.destroy(false);
    activeWorkoutTimer = null;
  }
}

export function startRestTimer(totalSeconds, toast, options = {}) {
  return startWorkoutTimer({
    label: 'Timer de descanso',
    detail: 'Descanso',
    totalSeconds,
    kind: 'countdown',
    completionMessage: 'Descanso finalizado',
    prepSeconds: 0,
    autoStart: options.startInConfig ? false : true,
  }, toast, options);
}

export function startWorkoutTimer(config, toast, options = {}) {
  const normalized = normalizeTimerConfig(config, options);
  if (!normalized) return null;

  clearWorkoutTimer();

  let currentConfig = normalized;
  const state = createTimerState(currentConfig);
  let intervalId = null;
  let popupLayout = normalizeTimerPopupLayout(readTimerPopupLayout());
  let lastCustomConfig = readLastTimerCustomConfig();
  let configOpen = Boolean(options.startInConfig);
  let dragState = null;
  let resizeState = null;

  const modal = document.createElement('div');
  modal.className = `timer-modal ${currentConfig.mode === 'fullscreen' ? 'is-fullscreen' : 'is-popup'}`;
  modal.dataset.nativePopup = isNativeTimerSurface() ? 'true' : 'false';
  modal.innerHTML = `
    <div class="timer-content timer-content-workout">
      <div class="timer-topbar">
        <div class="timer-dragArea" data-timer-drag-handle>
          <div class="timer-kicker">${escapeHtml(normalized.label)}</div>
          <div class="timer-title">${escapeHtml(normalized.detail)}</div>
        </div>
        <div class="timer-topbarActions">
          <button class="btn-timer-mode" type="button" data-timer-config-toggle>Ajustes</button>
          <button class="btn-timer-close" type="button" data-timer-close>Fechar</button>
        </div>
      </div>
      <div class="timer-phase" data-timer-phase></div>
      <div class="timer-time" data-timer-time>${formatTime(readDisplaySeconds(state))}</div>
      <div class="timer-progress">
        <div class="timer-progressBar" data-timer-progress></div>
      </div>
      <div class="timer-meta" data-timer-meta></div>
      <div class="timer-summary" data-timer-summary></div>
      <div class="timer-actions timer-actions-main" data-timer-main-actions>
        <button class="btn-timer-primary" type="button" data-timer-start>${normalized.prepSeconds > 0 ? `Começar em ${normalized.prepSeconds}s` : 'Começar'}</button>
      </div>
      <div class="timer-actions" data-timer-live-actions hidden>
        <button class="btn-timer-secondary" type="button" data-timer-minus>−30s</button>
        <button class="btn-timer-primary" type="button" data-timer-toggle>Pausar</button>
        <button class="btn-timer-secondary" type="button" data-timer-plus>+30s</button>
      </div>
      <div class="timer-actions timer-actions-modes">
        <button class="btn-timer-mode ${normalized.mode === 'popup' ? 'is-active' : ''}" type="button" data-timer-mode="popup">Mini</button>
        <button class="btn-timer-mode ${normalized.mode === 'fullscreen' ? 'is-active' : ''}" type="button" data-timer-mode="fullscreen">Tela</button>
      </div>
      <section class="timer-config" data-timer-config-panel hidden>
        <div class="timer-presets" data-timer-presets>
          ${TIMER_PRESET_LIBRARY.map((preset) => `
            <button class="btn-timer-preset" type="button" data-timer-preset="${preset.id}">${preset.label}</button>
          `).join('')}
        </div>
        <div class="timer-configGrid">
          <label class="timer-field">
            <span>Tipo</span>
            <select class="timer-input" data-timer-config-kind>
              <option value="countdown">Contagem regressiva</option>
              <option value="countup">Cronômetro livre</option>
              <option value="interval">Intervalado</option>
              <option value="sequence">Sequência</option>
            </select>
          </label>
          <label class="timer-field">
            <span>Preparação (s)</span>
            <input class="timer-input" data-timer-config-prep type="number" min="0" step="1">
          </label>
          <label class="timer-field timer-fieldWide">
            <span>Nome</span>
            <input class="timer-input" data-timer-config-label type="text" maxlength="60">
          </label>
          <label class="timer-field timer-fieldWide">
            <span>Detalhe</span>
            <input class="timer-input" data-timer-config-detail type="text" maxlength="120">
          </label>
          <label class="timer-field" data-timer-config-countdown>
            <span>Tempo total (s)</span>
            <input class="timer-input" data-timer-config-total type="number" min="5" step="5">
          </label>
          <label class="timer-field" data-timer-config-cap>
            <span>Cap (s)</span>
            <input class="timer-input" data-timer-config-cap-input type="number" min="0" step="5">
          </label>
          <label class="timer-field" data-timer-config-rounds>
            <span>Rounds</span>
            <input class="timer-input" data-timer-config-rounds-input type="number" min="1" step="1">
          </label>
          <label class="timer-field" data-timer-config-work>
            <span>Trabalho (s)</span>
            <input class="timer-input" data-timer-config-work-input type="number" min="5" step="5">
          </label>
          <label class="timer-field" data-timer-config-rest>
            <span>Pausa (s)</span>
            <input class="timer-input" data-timer-config-rest-input type="number" min="0" step="5">
          </label>
          <label class="timer-field timer-fieldWide" data-timer-config-sequence>
            <span>Sequência</span>
            <textarea class="timer-input timer-textarea" data-timer-config-sequence-input rows="5" placeholder="work:60:Bike&#10;rest:30:Descanso&#10;work:45:Burpee"></textarea>
          </label>
        </div>
        <p class="timer-configNote" data-timer-config-note></p>
        <div class="timer-actions timer-actions-config">
          <button class="btn-timer-secondary" type="button" data-timer-config-reset>Usar base do treino</button>
          <button class="btn-timer-secondary" type="button" data-timer-popup-reset>Resetar janela</button>
          <button class="btn-timer-primary" type="button" data-timer-config-apply>Aplicar</button>
        </div>
      </section>
      <button class="timer-resizeHandle" type="button" data-timer-resize aria-label="Redimensionar timer"></button>
    </div>
  `;

  document.body.appendChild(modal);

  const content = modal.querySelector('.timer-content');
  const display = modal.querySelector('[data-timer-time]');
  const phase = modal.querySelector('[data-timer-phase]');
  const progress = modal.querySelector('[data-timer-progress]');
  const meta = modal.querySelector('[data-timer-meta]');
  const summary = modal.querySelector('[data-timer-summary]');
  const toggleButton = modal.querySelector('[data-timer-toggle]');
  const modeButtons = Array.from(modal.querySelectorAll('[data-timer-mode]'));
  const startButton = modal.querySelector('[data-timer-start]');
  const mainActions = modal.querySelector('[data-timer-main-actions]');
  const liveActions = modal.querySelector('[data-timer-live-actions]');
  const configPanel = modal.querySelector('[data-timer-config-panel]');
  const configToggle = modal.querySelector('[data-timer-config-toggle]');
  const dragHandle = modal.querySelector('[data-timer-drag-handle]');
  const resizeHandle = modal.querySelector('[data-timer-resize]');
  const presetButtons = Array.from(modal.querySelectorAll('[data-timer-preset]'));
  const configFields = {
    kind: modal.querySelector('[data-timer-config-kind]'),
    prepSeconds: modal.querySelector('[data-timer-config-prep]'),
    label: modal.querySelector('[data-timer-config-label]'),
    detail: modal.querySelector('[data-timer-config-detail]'),
    totalSeconds: modal.querySelector('[data-timer-config-total]'),
    capSeconds: modal.querySelector('[data-timer-config-cap-input]'),
    rounds: modal.querySelector('[data-timer-config-rounds-input]'),
    workSeconds: modal.querySelector('[data-timer-config-work-input]'),
    restSeconds: modal.querySelector('[data-timer-config-rest-input]'),
    sequence: modal.querySelector('[data-timer-config-sequence-input]'),
    note: modal.querySelector('[data-timer-config-note]'),
  };
  const configGroups = {
    countdown: modal.querySelector('[data-timer-config-countdown]'),
    cap: modal.querySelector('[data-timer-config-cap]'),
    rounds: modal.querySelector('[data-timer-config-rounds]'),
    work: modal.querySelector('[data-timer-config-work]'),
    rest: modal.querySelector('[data-timer-config-rest]'),
    sequence: modal.querySelector('[data-timer-config-sequence]'),
  };

  const updateModeButtons = (mode) => {
    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.timerMode === mode);
    });
  };

  const updateDisplay = () => {
    const displaySeconds = readDisplaySeconds(state);
    const title = content?.querySelector('.timer-title');
    const kicker = content?.querySelector('.timer-kicker');
    if (display) display.textContent = formatTime(displaySeconds);
    if (phase) phase.textContent = describePhase(state, currentConfig);
    if (meta) meta.textContent = describeMeta(state, currentConfig);
    if (summary) summary.textContent = describeSummary(state, currentConfig);
    if (toggleButton) toggleButton.textContent = state.paused ? 'Retomar' : 'Pausar';
    if (progress) progress.style.width = `${calculateProgressPercent(state, currentConfig)}%`;
    if (title) title.textContent = currentConfig.detail;
    if (kicker) kicker.textContent = currentConfig.label;
    if (mainActions) mainActions.hidden = state.phase !== 'ready';
    if (liveActions) liveActions.hidden = state.phase === 'ready' || state.phase === 'finished';
    if (startButton) {
      startButton.textContent = currentConfig.prepSeconds > 0 ? `Começar em ${currentConfig.prepSeconds}s` : 'Começar';
    }
  };

  const applyMode = async (mode) => {
    const nextMode = mode === 'fullscreen' ? 'fullscreen' : 'popup';
    currentConfig = { ...currentConfig, mode: nextMode };
    modal.classList.toggle('is-fullscreen', nextMode === 'fullscreen');
    modal.classList.toggle('is-popup', nextMode === 'popup');
    updateModeButtons(nextMode);
    if (nextMode === 'popup') {
      popupLayout = normalizeTimerPopupLayout(popupLayout);
      applyTimerPopupLayout(modal, popupLayout);
    } else {
      modal.style.left = '';
      modal.style.top = '';
      modal.style.width = '';
      modal.style.height = '';
    }

    if (nextMode === 'fullscreen' && modal.requestFullscreen) {
      try { await modal.requestFullscreen(); } catch {}
    }

    if (nextMode === 'popup' && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  };

  const finish = () => {
    destroy(false);
    toast(currentConfig.completionMessage);
  };

  const tick = () => {
    if (state.paused) return;

    if (state.phase === 'prep') {
      state.prepRemaining -= 1;
      if (state.prepRemaining <= 0) {
        state.phase = 'running';
      }
      updateDisplay();
      return;
    }

    if (state.phase !== 'running') return;

    if (currentConfig.kind === 'countdown') {
      state.remaining = Math.max(0, state.remaining - 1);
      updateDisplay();
      if (state.remaining <= 0) finish();
      return;
    }

    if (currentConfig.kind === 'countup') {
      state.elapsed += 1;
      if (state.capSeconds) state.remaining = Math.max(0, currentConfig.capSeconds - state.elapsed);
      updateDisplay();
      if (state.capSeconds && state.elapsed >= currentConfig.capSeconds) finish();
      return;
    }

    if (currentConfig.kind === 'interval') {
      state.intervalRemaining = Math.max(0, state.intervalRemaining - 1);
      state.totalElapsed += 1;
      updateDisplay();

      if (state.intervalRemaining > 0) return;

      if (state.segment === 'work') {
        if (currentConfig.restSeconds > 0 && state.round < currentConfig.rounds) {
          state.segment = 'rest';
          state.intervalRemaining = currentConfig.restSeconds;
        } else if (state.round < currentConfig.rounds) {
          state.round += 1;
          state.segment = 'work';
          state.intervalRemaining = currentConfig.workSeconds;
        } else {
          finish();
          return;
        }
      } else if (state.round < currentConfig.rounds) {
        state.round += 1;
        state.segment = 'work';
        state.intervalRemaining = currentConfig.workSeconds;
      } else {
        finish();
        return;
      }

      updateDisplay();
      return;
    }

    if (currentConfig.kind === 'sequence') {
      state.intervalRemaining = Math.max(0, state.intervalRemaining - 1);
      state.totalElapsed += 1;
      updateDisplay();

      if (state.intervalRemaining > 0) return;

      const nextSegmentIndex = state.segmentIndex + 1;
      if (nextSegmentIndex < currentConfig.segments.length) {
        state.segmentIndex = nextSegmentIndex;
        state.intervalRemaining = currentConfig.segments[nextSegmentIndex].seconds;
        updateDisplay();
        return;
      }

      if (state.round < currentConfig.rounds) {
        state.round += 1;
        state.segmentIndex = 0;
        state.intervalRemaining = currentConfig.segments[0].seconds;
        updateDisplay();
        return;
      }

      finish();
    }
  };

  const startInterval = () => {
    intervalId = window.setInterval(tick, 1000);
  };

  function destroy(showToast = false) {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    window.removeEventListener('resize', handleWindowResize);
    if (document.fullscreenElement === modal) {
      document.exitFullscreen().catch(() => {});
    }
    modal.remove();
    if (activeWorkoutTimer?.modal === modal) activeWorkoutTimer = null;
    if (showToast) toast('Timer fechado');
  }

  function resetTimerWithConfig(nextConfig) {
    currentConfig = normalizeTimerConfig(nextConfig, { mode: currentConfig.mode }) || currentConfig;
    const nextState = createTimerState(currentConfig);
    Object.keys(state).forEach((key) => {
      delete state[key];
    });
    Object.assign(state, nextState);
    updateConfigEditor(currentConfig);
    updateDisplay();
  }

  function resetPopupWindow() {
    popupLayout = normalizeTimerPopupLayout({});
    applyTimerPopupLayout(modal, popupLayout);
    writeTimerPopupLayout(popupLayout);
  }

  function toggleConfigPanel(forceOpen) {
    configOpen = typeof forceOpen === 'boolean' ? forceOpen : !configOpen;
    if (configPanel) configPanel.hidden = !configOpen;
    if (content) content.classList.toggle('is-configOpen', configOpen);
    if (configToggle) configToggle.classList.toggle('is-active', configOpen);
    if (configOpen) {
      updateConfigEditor(lastCustomConfig || currentConfig || normalized);
    }
  }

  function updateConfigVisibility() {
    const kind = String(configFields.kind?.value || 'countdown');
    if (configGroups.countdown) configGroups.countdown.hidden = kind !== 'countdown';
    if (configGroups.cap) configGroups.cap.hidden = kind !== 'countup';
    if (configGroups.rounds) configGroups.rounds.hidden = kind !== 'interval' && kind !== 'sequence';
    if (configGroups.work) configGroups.work.hidden = kind !== 'interval';
    if (configGroups.rest) configGroups.rest.hidden = kind !== 'interval';
    if (configGroups.sequence) configGroups.sequence.hidden = kind !== 'sequence';
    if (configFields.note) {
      configFields.note.textContent = kind === 'sequence'
        ? 'Use uma linha por bloco no formato tipo:segundos:rótulo. Exemplo: work:60:Bike ou rest:30:Descanso.'
        : kind === 'interval'
          ? 'Defina rounds, trabalho e pausa para montar o bloco intervalado.'
          : kind === 'countup'
            ? 'Cap opcional. Use 0 para cronômetro livre.'
            : 'Use o tempo total para uma contagem regressiva simples.';
    }
  }

  function updateConfigEditor(configToEdit) {
    const editor = createTimerEditorConfig(configToEdit);
    if (configFields.kind) configFields.kind.value = editor.kind;
    if (configFields.prepSeconds) configFields.prepSeconds.value = String(editor.prepSeconds);
    if (configFields.label) configFields.label.value = editor.label;
    if (configFields.detail) configFields.detail.value = editor.detail;
    if (configFields.totalSeconds) configFields.totalSeconds.value = String(editor.totalSeconds || 0);
    if (configFields.capSeconds) configFields.capSeconds.value = String(editor.capSeconds || 0);
    if (configFields.rounds) configFields.rounds.value = String(editor.rounds || 1);
    if (configFields.workSeconds) configFields.workSeconds.value = String(editor.workSeconds || 60);
    if (configFields.restSeconds) configFields.restSeconds.value = String(editor.restSeconds || 0);
    if (configFields.sequence) configFields.sequence.value = editor.sequence;
    updateConfigVisibility();
  }

  function buildConfigFromEditor() {
    const kind = String(configFields.kind?.value || 'countdown');
    const nextConfig = {
      kind,
      label: String(configFields.label?.value || currentConfig.label || 'Timer do treino').trim() || 'Timer do treino',
      detail: String(configFields.detail?.value || '').trim() || describeDefaultDetail({ kind }),
      prepSeconds: Math.max(0, Number(configFields.prepSeconds?.value) || 0),
      mode: currentConfig.mode || 'popup',
      completionMessage: `${String(configFields.label?.value || currentConfig.label || 'Timer do treino').trim() || 'Timer do treino'} finalizado`,
    };

    if (kind === 'interval') {
      nextConfig.rounds = Math.max(1, Number(configFields.rounds?.value) || 1);
      nextConfig.workSeconds = Math.max(5, Number(configFields.workSeconds?.value) || 60);
      nextConfig.restSeconds = Math.max(0, Number(configFields.restSeconds?.value) || 0);
      return nextConfig;
    }

    if (kind === 'sequence') {
      nextConfig.rounds = Math.max(1, Number(configFields.rounds?.value) || 1);
      nextConfig.segments = parseSequenceConfig(configFields.sequence?.value || '');
      if (!nextConfig.segments.length) return null;
      return nextConfig;
    }

    if (kind === 'countup') {
      nextConfig.capSeconds = Math.max(0, Number(configFields.capSeconds?.value) || 0);
      return nextConfig;
    }

    nextConfig.totalSeconds = Math.max(5, Number(configFields.totalSeconds?.value) || 0);
    return nextConfig;
  }

  startButton?.addEventListener('click', () => {
    if (state.phase !== 'ready') return;
    state.phase = currentConfig.prepSeconds > 0 ? 'prep' : 'running';
    state.prepRemaining = currentConfig.prepSeconds;
    updateDisplay();
  });

  modal.querySelector('[data-timer-close]')?.addEventListener('click', () => {
    destroy(true);
  });

  modal.querySelector('[data-timer-toggle]')?.addEventListener('click', () => {
    if (state.phase === 'ready' || state.phase === 'finished') return;
    state.paused = !state.paused;
    updateDisplay();
  });

  modal.querySelector('[data-timer-minus]')?.addEventListener('click', () => {
    adjustTimer(state, currentConfig, -30);
    updateDisplay();
  });

  modal.querySelector('[data-timer-plus]')?.addEventListener('click', () => {
    adjustTimer(state, currentConfig, 30);
    updateDisplay();
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => applyMode(button.dataset.timerMode));
  });

  configToggle?.addEventListener('click', () => {
    toggleConfigPanel();
  });

  configFields.kind?.addEventListener('change', () => {
    updateConfigVisibility();
  });

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const preset = getTimerPresetConfig(button.dataset.timerPreset);
      if (!preset) return;
      updateConfigEditor({
        ...preset,
        mode: currentConfig.mode || 'popup',
      });
    });
  });

  modal.querySelector('[data-timer-config-reset]')?.addEventListener('click', () => {
    resetTimerWithConfig(normalized);
    toggleConfigPanel(true);
  });

  modal.querySelector('[data-timer-popup-reset]')?.addEventListener('click', () => {
    resetPopupWindow();
  });

  modal.querySelector('[data-timer-config-apply]')?.addEventListener('click', () => {
    const nextConfig = buildConfigFromEditor();
    if (!nextConfig) {
      toast('Revise os ajustes do timer');
      return;
    }
    lastCustomConfig = buildStoredTimerConfig(nextConfig);
    writeLastTimerCustomConfig(lastCustomConfig);
    resetTimerWithConfig(nextConfig);
    toggleConfigPanel(false);
    toast('Timer ajustado');
  });

  dragHandle?.addEventListener('pointerdown', (event) => {
    if (currentConfig.mode !== 'popup') return;
    if (event.target?.closest?.('button, input, textarea, select')) return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: popupLayout.left,
      top: popupLayout.top,
    };
    dragHandle.setPointerCapture?.(event.pointerId);
  });

  dragHandle?.addEventListener('pointermove', (event) => {
    if (!dragState || currentConfig.mode !== 'popup') return;
    popupLayout = normalizeTimerPopupLayout({
      ...popupLayout,
      left: dragState.left + (event.clientX - dragState.startX),
      top: dragState.top + (event.clientY - dragState.startY),
    });
    applyTimerPopupLayout(modal, popupLayout);
  });

  dragHandle?.addEventListener('pointerup', (event) => {
    if (!dragState) return;
    dragHandle.releasePointerCapture?.(event.pointerId);
    dragState = null;
    writeTimerPopupLayout(popupLayout);
  });

  resizeHandle?.addEventListener('pointerdown', (event) => {
    if (currentConfig.mode !== 'popup') return;
    resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: popupLayout.width,
      height: popupLayout.height,
    };
    resizeHandle.setPointerCapture?.(event.pointerId);
  });

  resizeHandle?.addEventListener('pointermove', (event) => {
    if (!resizeState || currentConfig.mode !== 'popup') return;
    popupLayout = normalizeTimerPopupLayout({
      ...popupLayout,
      width: resizeState.width + (event.clientX - resizeState.startX),
      height: resizeState.height + (event.clientY - resizeState.startY),
    });
    applyTimerPopupLayout(modal, popupLayout);
  });

  resizeHandle?.addEventListener('pointerup', (event) => {
    if (!resizeState) return;
    resizeHandle.releasePointerCapture?.(event.pointerId);
    resizeState = null;
    writeTimerPopupLayout(popupLayout);
  });

  window.addEventListener('resize', handleWindowResize);

  function handleWindowResize() {
    if (currentConfig.mode !== 'popup') return;
    popupLayout = normalizeTimerPopupLayout(popupLayout);
    applyTimerPopupLayout(modal, popupLayout);
  }

  activeWorkoutTimer = {
    modal,
    destroy,
    applyMode,
  };
  updateConfigEditor(currentConfig);
  updateDisplay();
  startInterval();
  applyMode(currentConfig.mode);
  toggleConfigPanel(configOpen);

  if (currentConfig.autoStart) {
    state.phase = currentConfig.prepSeconds > 0 ? 'prep' : 'running';
    state.prepRemaining = currentConfig.prepSeconds;
    updateDisplay();
  }

  return activeWorkoutTimer;
}

function createTimerEditorConfig(config = {}) {
  return {
    kind: config.kind || 'countdown',
    prepSeconds: Math.max(0, Number(config.prepSeconds) || 0),
    label: String(config.label || 'Timer do treino').trim(),
    detail: String(config.detail || describeDefaultDetail(config)).trim(),
    totalSeconds: Math.max(0, Number(config.totalSeconds) || 0),
    capSeconds: Math.max(0, Number(config.capSeconds) || 0),
    rounds: Math.max(1, Number(config.rounds) || 1),
    workSeconds: Math.max(5, Number(config.workSeconds) || 60),
    restSeconds: Math.max(0, Number(config.restSeconds) || 0),
    sequence: serializeSequenceConfig(config.segments || []),
  };
}

function parseSequenceConfig(rawValue) {
  return String(rawValue || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [kindPart = 'work', secondsPart = '0', ...labelParts] = line.split(':');
      const kind = String(kindPart || 'work').trim().toLowerCase() === 'rest' ? 'rest' : 'work';
      const seconds = Math.max(1, Number(secondsPart) || 0);
      const label = String(labelParts.join(':') || (kind === 'rest' ? 'Descanso' : 'Trabalho')).trim();
      return { kind, seconds, label };
    })
    .filter((segment) => segment.seconds > 0);
}

function serializeSequenceConfig(segments = []) {
  return segments
    .map((segment) => `${segment?.kind === 'rest' ? 'rest' : 'work'}:${Math.max(1, Number(segment?.seconds) || 0)}:${String(segment?.label || (segment?.kind === 'rest' ? 'Descanso' : 'Trabalho')).trim()}`)
    .join('\n');
}

function getTimerViewport() {
  const width = Math.max(320, window.innerWidth || document.documentElement?.clientWidth || 390);
  const height = Math.max(420, window.innerHeight || document.documentElement?.clientHeight || 720);
  return { width, height };
}

function normalizeTimerPopupLayout(layout = {}) {
  const viewport = getTimerViewport();
  const reservedBottom = isNativeTimerSurface() ? 124 : 96;
  const reservedTop = isNativeTimerSurface() ? 74 : 8;
  const maxWidth = Math.max(MIN_TIMER_POPUP_WIDTH, viewport.width - 16);
  const maxHeight = Math.max(MIN_TIMER_POPUP_HEIGHT, viewport.height - 16);
  const width = clampNumber(Number(layout.width) || Math.min(360, viewport.width - 24), MIN_TIMER_POPUP_WIDTH, maxWidth);
  const height = clampNumber(Number(layout.height) || Math.min(440, viewport.height - reservedBottom), MIN_TIMER_POPUP_HEIGHT, maxHeight);
  const left = clampNumber(
    Number(layout.left),
    8,
    Math.max(8, viewport.width - width - 8),
    Math.max(8, viewport.width - width - 12),
  );
  const top = clampNumber(
    Number(layout.top),
    reservedTop,
    Math.max(reservedTop, viewport.height - height - 8),
    Math.max(reservedTop, viewport.height - height - reservedBottom),
  );

  return { width, height, left, top };
}

function applyTimerPopupLayout(modal, layout) {
  if (!modal || !layout) return;
  modal.style.left = `${layout.left}px`;
  modal.style.top = `${layout.top}px`;
  modal.style.width = `${layout.width}px`;
  modal.style.height = `${layout.height}px`;
}

function readTimerPopupLayout() {
  try {
    const raw = window.localStorage?.getItem(TIMER_POPUP_LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTimerPopupLayout(layout) {
  try {
    window.localStorage?.setItem(TIMER_POPUP_LAYOUT_KEY, JSON.stringify(layout || {}));
  } catch {
    // no-op
  }
}

export function buildStoredTimerConfig(config = {}) {
  const normalized = normalizeTimerConfig(config, { mode: config?.mode || 'popup' });
  if (!normalized) return null;
  return {
    kind: normalized.kind,
    label: normalized.label,
    detail: normalized.detail,
    prepSeconds: normalized.prepSeconds,
    totalSeconds: normalized.totalSeconds || 0,
    capSeconds: normalized.capSeconds || 0,
    rounds: normalized.rounds || 1,
    workSeconds: normalized.workSeconds || 0,
    restSeconds: normalized.restSeconds || 0,
    segments: Array.isArray(normalized.segments) ? normalized.segments.map((segment) => ({
      kind: segment.kind === 'rest' ? 'rest' : 'work',
      seconds: Math.max(1, Number(segment.seconds) || 0),
      label: String(segment.label || '').trim(),
    })) : [],
  };
}

export function getTimerPresetConfig(presetId) {
  const preset = TIMER_PRESET_LIBRARY.find((item) => item.id === presetId);
  return preset ? buildStoredTimerConfig(preset.config) : null;
}

export function readLastTimerCustomConfig(storage = window?.localStorage) {
  try {
    const raw = storage?.getItem?.(TIMER_LAST_CUSTOM_CONFIG_KEY);
    if (!raw) return null;
    return buildStoredTimerConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLastTimerCustomConfig(config, storage = window?.localStorage) {
  try {
    const nextConfig = buildStoredTimerConfig(config);
    if (!nextConfig) return false;
    storage?.setItem?.(TIMER_LAST_CUSTOM_CONFIG_KEY, JSON.stringify(nextConfig));
    return true;
  } catch {
    return false;
  }
}

function clampNumber(value, min, max, fallback = min) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function normalizeTimerConfig(config, options = {}) {
  const input = config && typeof config === 'object' ? config : { totalSeconds: Number(config) || 0 };
  const kind = ['countdown', 'countup', 'interval', 'sequence'].includes(input.kind) ? input.kind : 'countdown';
  const mode = options.mode === 'fullscreen' || input.mode === 'fullscreen' ? 'fullscreen' : 'popup';
  const prepSeconds = Math.max(0, Number(input.prepSeconds ?? 10) || 0);
  const autoStart = Boolean(input.autoStart);
  const label = String(input.label || 'Timer do treino').trim();
  const detail = String(input.detail || describeDefaultDetail(input)).trim();

  if (kind === 'interval') {
    const rounds = Math.max(1, Number(input.rounds) || 0);
    const workSeconds = Math.max(1, Number(input.workSeconds) || 0);
    const restSeconds = Math.max(0, Number(input.restSeconds) || 0);
    if (!rounds || !workSeconds) return null;
    return {
      kind,
      label,
      detail,
      mode,
      prepSeconds,
      autoStart,
      rounds,
      workSeconds,
      restSeconds,
      completionMessage: input.completionMessage || `${label} finalizado`,
    };
  }

  if (kind === 'sequence') {
    const rounds = Math.max(1, Number(input.rounds) || 0);
    const segments = Array.isArray(input.segments)
      ? input.segments
        .map((segment) => ({
          kind: segment?.kind === 'rest' ? 'rest' : 'work',
          seconds: Math.max(1, Number(segment?.seconds) || 0),
          label: String(segment?.label || (segment?.kind === 'rest' ? 'Descanso' : 'Trabalho')).trim(),
        }))
        .filter((segment) => segment.seconds > 0)
      : [];
    if (!rounds || !segments.length) return null;
    return {
      kind,
      label,
      detail,
      mode,
      prepSeconds,
      autoStart,
      rounds,
      segments,
      completionMessage: input.completionMessage || `${label} finalizado`,
    };
  }

  const totalSeconds = Math.max(0, Number(input.totalSeconds) || 0);
  const capSeconds = Math.max(0, Number(input.capSeconds ?? totalSeconds) || 0);
  if (kind === 'countup' && !capSeconds && !totalSeconds) {
    return {
      kind,
      label,
      detail,
      mode,
      prepSeconds,
      autoStart,
      totalSeconds: 0,
      capSeconds: 0,
      completionMessage: input.completionMessage || `${label} finalizado`,
    };
  }
  if (kind !== 'countup' && totalSeconds <= 0) return null;

  return {
    kind,
    label,
    detail,
    mode,
    prepSeconds,
    autoStart,
    totalSeconds,
    capSeconds,
    completionMessage: input.completionMessage || `${label} finalizado`,
  };
}

function createTimerState(config) {
  if (config.kind === 'interval') {
    return {
      phase: 'ready',
      paused: false,
      prepRemaining: config.prepSeconds,
      round: 1,
      segment: 'work',
      intervalRemaining: config.workSeconds,
      totalElapsed: 0,
    };
  }

  if (config.kind === 'sequence') {
    return {
      phase: 'ready',
      paused: false,
      prepRemaining: config.prepSeconds,
      round: 1,
      segmentIndex: 0,
      intervalRemaining: config.segments[0]?.seconds || 0,
      totalElapsed: 0,
    };
  }

  return {
    phase: 'ready',
    paused: false,
    prepRemaining: config.prepSeconds,
    remaining: config.totalSeconds,
    elapsed: 0,
    capSeconds: config.capSeconds || 0,
  };
}

function readDisplaySeconds(state) {
  if (state.phase === 'prep') return Math.max(0, state.prepRemaining);
  if (typeof state.intervalRemaining === 'number') return Math.max(0, state.intervalRemaining);
  if (typeof state.remaining === 'number' && state.remaining > 0) return state.remaining;
  if (typeof state.elapsed === 'number') return state.elapsed;
  return 0;
}

function describePhase(state, config) {
  if (state.phase === 'ready') return 'Pronto para iniciar';
  if (state.phase === 'prep') return 'Preparação';
  if (config.kind === 'interval') return state.segment === 'rest' ? `Round ${state.round}/${config.rounds} · Descanso` : `Round ${state.round}/${config.rounds} · Trabalho`;
  if (config.kind === 'sequence') {
    const currentSegment = config.segments[state.segmentIndex] || config.segments[0];
    return `Round ${state.round}/${config.rounds} · ${currentSegment?.kind === 'rest' ? 'Descanso' : (currentSegment?.label || 'Trabalho')}`;
  }
  if (config.kind === 'countup') return 'Cronômetro correndo';
  return 'Tempo correndo';
}

function describeMeta(state, config) {
  if (state.phase === 'ready') {
    if (config.kind === 'interval') return `${config.rounds} rounds · ${formatCompactSeconds(config.workSeconds)} de trabalho${config.restSeconds ? ` + ${formatCompactSeconds(config.restSeconds)} descanso` : ''}`;
    if (config.kind === 'sequence') return `${config.rounds} rounds · ${config.segments.map((segment) => `${formatCompactSeconds(segment.seconds)} ${segment.kind === 'rest' ? 'rest' : segment.label}`).join(' · ')}`;
    if (config.kind === 'countup' && config.capSeconds) return `Cap ${formatCompactSeconds(config.capSeconds)}`;
    if (config.kind === 'countup') return 'Sem cap definido';
    return `${formatCompactSeconds(config.totalSeconds)} totais`;
  }

  if (state.phase === 'prep') return `Começa em ${Math.max(0, state.prepRemaining)}s`;

  if (config.kind === 'interval') {
    return state.segment === 'rest'
      ? `Descanso antes do próximo round`
      : `Mantenha o ritmo do bloco`; 
  }

  if (config.kind === 'sequence') {
    const currentSegment = config.segments[state.segmentIndex] || config.segments[0];
    const nextSegment = config.segments[(state.segmentIndex + 1) % config.segments.length] || null;
    if (currentSegment?.kind === 'rest') return `Descanso antes de ${nextSegment?.label || 'voltar ao bloco'}`;
    return currentSegment?.label ? `Agora: ${currentSegment.label}` : 'Siga o circuito';
  }

  if (config.kind === 'countup') {
    return config.capSeconds
      ? `Cap em ${formatCompactSeconds(config.capSeconds)}`
      : 'Marcação livre até finalizar';
  }

  return `${formatCompactSeconds(Math.max(0, state.remaining))} restantes`;
}

function describeSummary(state, config) {
  if (config.kind === 'interval') {
    const totalSeconds = config.rounds * config.workSeconds + Math.max(0, config.rounds - 1) * config.restSeconds;
    const remaining = Math.max(0, totalSeconds - state.totalElapsed);
    return `Total restante: ${formatCompactSeconds(remaining)}`;
  }

  if (config.kind === 'sequence') {
    const perRound = config.segments.reduce((sum, segment) => sum + segment.seconds, 0);
    const totalSeconds = perRound * config.rounds;
    const remaining = Math.max(0, totalSeconds - state.totalElapsed);
    return `Total restante: ${formatCompactSeconds(remaining)}`;
  }

  if (config.kind === 'countup') {
    return `Decorrido: ${formatCompactSeconds(state.elapsed)}`;
  }

  return config.detail;
}

function calculateProgressPercent(state, config) {
  if (state.phase === 'ready') return 100;
  if (state.phase === 'prep') {
    const base = Math.max(1, config.prepSeconds || 1);
    return Math.max(0, Math.min(100, (state.prepRemaining / base) * 100));
  }

  if (config.kind === 'interval') {
    const base = state.segment === 'rest' ? Math.max(1, config.restSeconds || 1) : Math.max(1, config.workSeconds);
    return Math.max(0, Math.min(100, (state.intervalRemaining / base) * 100));
  }

  if (config.kind === 'sequence') {
    const currentSegment = config.segments[state.segmentIndex] || config.segments[0];
    const base = Math.max(1, currentSegment?.seconds || 1);
    return Math.max(0, Math.min(100, (state.intervalRemaining / base) * 100));
  }

  if (config.kind === 'countup') {
    if (!config.capSeconds) return 100;
    return Math.max(0, Math.min(100, ((config.capSeconds - state.elapsed) / Math.max(1, config.capSeconds)) * 100));
  }

  return Math.max(0, Math.min(100, (state.remaining / Math.max(1, config.totalSeconds)) * 100));
}

function adjustTimer(state, config, deltaSeconds) {
  if (state.phase === 'ready' || state.phase === 'finished') return;

  if (config.kind === 'interval') {
    state.intervalRemaining = Math.max(5, state.intervalRemaining + deltaSeconds);
    return;
  }

  if (config.kind === 'sequence') {
    state.intervalRemaining = Math.max(5, state.intervalRemaining + deltaSeconds);
    return;
  }

  if (config.kind === 'countup') {
    state.elapsed = Math.max(0, state.elapsed + deltaSeconds);
    if (state.capSeconds) state.remaining = Math.max(0, state.capSeconds - state.elapsed);
    return;
  }

  state.remaining = Math.max(5, state.remaining + deltaSeconds);
}

function describeDefaultDetail(config) {
  if (config.kind === 'interval') return 'Bloco intervalado';
  if (config.kind === 'sequence') return 'Circuito intervalado';
  if (config.kind === 'countup') return 'Cronômetro livre';
  return 'Contagem regressiva';
}

export function cssEscape(value) {
  return String(value || '').replace(/["\\]/g, '\\$&');
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatCompactSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (!minutes) return `${seconds}s`;
  if (!seconds) return `${minutes}min`;
  return `${minutes}m ${seconds}s`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isNativeTimerSurface() {
  try {
    return document.body?.dataset?.platformVariant === 'native' || document.body?.dataset?.nativeApp === 'true';
  } catch {
    return false;
  }
}
