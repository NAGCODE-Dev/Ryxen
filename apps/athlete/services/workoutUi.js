import { getAppBridge } from '../../../src/app/bridge.js';

let activeWorkoutTimer = null;

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
    detail: 'Descanso guiado',
    totalSeconds,
    kind: 'countdown',
    completionMessage: 'Descanso finalizado',
    prepSeconds: 0,
    autoStart: true,
  }, toast, options);
}

export function startWorkoutTimer(config, toast, options = {}) {
  const normalized = normalizeTimerConfig(config, options);
  if (!normalized) return null;

  clearWorkoutTimer();

  const state = createTimerState(normalized);
  let intervalId = null;

  const modal = document.createElement('div');
  modal.className = `timer-modal ${normalized.mode === 'fullscreen' ? 'is-fullscreen' : 'is-popup'}`;
  modal.innerHTML = `
    <div class="timer-content timer-content-workout">
      <div class="timer-topbar">
        <div>
          <div class="timer-kicker">${escapeHtml(normalized.label)}</div>
          <div class="timer-title">${escapeHtml(normalized.detail)}</div>
        </div>
        <button class="btn-timer-close" type="button" data-timer-close>Fechar</button>
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
    </div>
  `;

  document.body.appendChild(modal);

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

  const updateModeButtons = (mode) => {
    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.timerMode === mode);
    });
  };

  const updateDisplay = () => {
    const displaySeconds = readDisplaySeconds(state);
    if (display) display.textContent = formatTime(displaySeconds);
    if (phase) phase.textContent = describePhase(state, normalized);
    if (meta) meta.textContent = describeMeta(state, normalized);
    if (summary) summary.textContent = describeSummary(state, normalized);
    if (toggleButton) toggleButton.textContent = state.paused ? 'Retomar' : 'Pausar';
    if (progress) progress.style.width = `${calculateProgressPercent(state, normalized)}%`;
    if (mainActions) mainActions.hidden = state.phase !== 'ready';
    if (liveActions) liveActions.hidden = state.phase === 'ready' || state.phase === 'finished';
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

  const finish = () => {
    destroy(false);
    toast(normalized.completionMessage);
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

    if (normalized.kind === 'countdown') {
      state.remaining = Math.max(0, state.remaining - 1);
      updateDisplay();
      if (state.remaining <= 0) finish();
      return;
    }

    if (normalized.kind === 'countup') {
      state.elapsed += 1;
      if (state.capSeconds) state.remaining = Math.max(0, normalized.capSeconds - state.elapsed);
      updateDisplay();
      if (state.capSeconds && state.elapsed >= normalized.capSeconds) finish();
      return;
    }

    if (normalized.kind === 'interval') {
      state.intervalRemaining = Math.max(0, state.intervalRemaining - 1);
      state.totalElapsed += 1;
      updateDisplay();

      if (state.intervalRemaining > 0) return;

      if (state.segment === 'work') {
        if (normalized.restSeconds > 0 && state.round < normalized.rounds) {
          state.segment = 'rest';
          state.intervalRemaining = normalized.restSeconds;
        } else if (state.round < normalized.rounds) {
          state.round += 1;
          state.segment = 'work';
          state.intervalRemaining = normalized.workSeconds;
        } else {
          finish();
          return;
        }
      } else if (state.round < normalized.rounds) {
        state.round += 1;
        state.segment = 'work';
        state.intervalRemaining = normalized.workSeconds;
      } else {
        finish();
        return;
      }

      updateDisplay();
      return;
    }

    if (normalized.kind === 'sequence') {
      state.intervalRemaining = Math.max(0, state.intervalRemaining - 1);
      state.totalElapsed += 1;
      updateDisplay();

      if (state.intervalRemaining > 0) return;

      const nextSegmentIndex = state.segmentIndex + 1;
      if (nextSegmentIndex < normalized.segments.length) {
        state.segmentIndex = nextSegmentIndex;
        state.intervalRemaining = normalized.segments[nextSegmentIndex].seconds;
        updateDisplay();
        return;
      }

      if (state.round < normalized.rounds) {
        state.round += 1;
        state.segmentIndex = 0;
        state.intervalRemaining = normalized.segments[0].seconds;
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
    if (document.fullscreenElement === modal) {
      document.exitFullscreen().catch(() => {});
    }
    modal.remove();
    if (activeWorkoutTimer?.modal === modal) activeWorkoutTimer = null;
    if (showToast) toast('Timer fechado');
  }

  startButton?.addEventListener('click', () => {
    if (state.phase !== 'ready') return;
    state.phase = normalized.prepSeconds > 0 ? 'prep' : 'running';
    state.prepRemaining = normalized.prepSeconds;
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
    adjustTimer(state, normalized, -30);
    updateDisplay();
  });

  modal.querySelector('[data-timer-plus]')?.addEventListener('click', () => {
    adjustTimer(state, normalized, 30);
    updateDisplay();
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => applyMode(button.dataset.timerMode));
  });

  activeWorkoutTimer = { modal, destroy, applyMode };
  updateDisplay();
  startInterval();
  applyMode(normalized.mode);

  if (normalized.autoStart) {
    state.phase = normalized.prepSeconds > 0 ? 'prep' : 'running';
    state.prepRemaining = normalized.prepSeconds;
    updateDisplay();
  }

  return activeWorkoutTimer;
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
