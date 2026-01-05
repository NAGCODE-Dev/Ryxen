import { renderAppShell, renderAll } from './render.js';
import { setupActions } from './actions.js';
import { bindAppEvents } from './events.js';

export async function mountUI({ root }) {
  if (!root) throw new Error('mountUI: root é obrigatório');

  ensureStylesheet('./src/ui/styles.css');
  ensureBg();

  root.innerHTML = renderAppShell();

  const { toast } = ensureToast();

  const { createStorage } = await import('../adapters/storage/storageFactory.js');
  const uiStorage = createStorage('ui-state', 5000);

  // Estado de UI (não depende do core)
  let uiState = (await uiStorage.get('state')) || {};
  uiState = normalizeUiState(uiState);

  const setUiState = async (next) => {
    uiState = normalizeUiState({ ...uiState, ...next });
    await uiStorage.set('state', uiState);
  };

  const patchUiState = async (fn) => {
    const current = normalizeUiState((await uiStorage.get('state')) || uiState);
    const updated = normalizeUiState(fn(current) || current);
    uiState = updated;
    await uiStorage.set('state', updated);
  };

  const setBusy = (isBusy, message) => {
    const loadingEl = document.getElementById('loading-screen');
    if (!loadingEl) return;
    loadingEl.classList.toggle('hide', !isBusy);
    if (isBusy && message) toast(message);
  };

  const pushEventLine = createEventLog(root.querySelector('#ui-events'));

  const rerender = async () => {
    const state = safeGetState();

    // Injeta estado de UI para o render (sem tocar no core)
    const ui = await buildUiForRender(state, uiState);
    state.__ui = ui;

    // Training mode vira classe global (UX)
    document.body.classList.toggle('ui-trainingMode', !!ui.trainingMode);

    const view = renderAll(state);

    const refs = getRefs(root);
    setText(refs.subtitle, view.subtitle);
    setHTML(refs.weekChips, view.weekChipsHtml);
    setHTML(refs.main, view.mainHtml);
    setHTML(refs.modals, view.modalsHtml);

    // Contador de PR (se existir no shell)
    if (refs.prsCount) {
      const count = Object.keys(state?.prs || {}).length;
      refs.prsCount.textContent = `${count} PRs`;
    }
  };

  const destroyEvents = bindAppEvents({
    pushEventLine,
    rerender: () => rerender(),
    toast,
    setBusy,
  });

  setupActions({
    root,
    toast,
    rerender: () => rerender(),
    getUiState: () => uiState,
    setUiState,
    patchUiState,
  });

  // Primeira renderização: some com loading inicial
  setBusy(false);
  pushEventLine('UI montada');
  await rerender();

  return {
    rerender,
    destroy() {
      try {
        destroyEvents?.();
      } catch (e) {
        console.warn('destroyEvents falhou', e);
      }
    },
  };
}

function normalizeUiState(s) {
  const next = { ...(s || {}) };
  if (typeof next.trainingMode !== 'boolean') next.trainingMode = false;
  next.modal = next.modal || null; // 'prs' | 'settings' | null
  next.wod = next.wod && typeof next.wod === 'object' ? next.wod : {};
  return next;
}

async function buildUiForRender(state, uiState) {
  const key = workoutKey(state);

  const wod = uiState.wod[key] || { activeLineId: null, done: {} };
  const lineIds = computeLineIdsFromState(state);
  const doneCount = lineIds.reduce((acc, id) => acc + (wod.done?.[id] ? 1 : 0), 0);

  return {
    modal: uiState.modal,
    trainingMode: uiState.trainingMode,
    wodKey: key,
    activeLineId: wod.activeLineId,
    done: wod.done || {},
    progress: { doneCount, totalCount: lineIds.length },
  };
}

function computeLineIdsFromState(state) {
  const blocks = state?.workoutOfDay?.blocks || [];
  const ids = [];
  blocks.forEach((block, b) => {
    const lines = block?.lines || [];
    lines.forEach((_, i) => ids.push(`b${b}-l${i}`));
  });
  return ids;
}

function workoutKey(state) {
  const week = state?.activeWeekNumber ?? '0';
  const day = state?.currentDay ?? 'Hoje';
  return `${week}:${String(day).toLowerCase()}`;
}

function getRefs(root) {
  const q = (sel) => root.querySelector(sel);
  return {
    subtitle: q('#ui-subtitle'),
    weekChips: q('#ui-weekChips'),
    main: q('#ui-main'),
    modals: q('#ui-modals'),
    prsCount: q('#ui-prsCount'),
  };
}

function setText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? '');
}

function setHTML(el, html) {
  if (!el) return;
  el.innerHTML = String(html ?? '');
}

function safeGetState() {
  try {
    return window.__APP__?.getState ? window.__APP__.getState() : {};
  } catch {
    return {};
  }
}

function ensureStylesheet(href) {
  const id = 'ui-styles';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureBg() {
  document.documentElement.classList.add('ui-bg');
  document.body.classList.add('ui-bg');
}

function ensureToast() {
  let el = document.getElementById('ui-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ui-toast';
    el.className = 'ui-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  let timeout = null;
  const toast = (message) => {
    el.textContent = String(message ?? '');
    el.classList.add('ui-toastShow');
    clearTimeout(timeout);
    timeout = setTimeout(() => el.classList.remove('ui-toastShow'), 2200);
  };

  return { el, toast };
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
