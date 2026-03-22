import { renderAppShell, renderAll } from './render.js';
import { setupActions } from './actions.js';
import { bindAppEvents } from './events.js';
import { getAppBridge } from '../app/bridge.js';

export async function mountUI({ root }) {
  if (!root) throw new Error('mountUI: root é obrigatório');

  ensureStylesheet('./src/ui/styles.css');
  ensureBg();

  root.innerHTML = renderAppShell();

  const { toast } = ensureToast();

  const { createStorage } = await import('../adapters/storage/storageFactory.js');
  const uiStorage = createStorage('ui-state', 5000);

  // Estado de UI (não depende do core)
  let uiState = normalizeUiState((await uiStorage.get('state')) || {});
  let uiBusy = false;
  await uiStorage.set('state', uiState);

  const getUiState = () => uiState;

  const setUiState = async (next) => {
    uiState = normalizeUiState({ ...uiState, ...(next || {}) });
    await uiStorage.set('state', uiState);
  };

  const patchUiState = async (fn) => {
    const current = normalizeUiState((await uiStorage.get('state')) || uiState);
    const updated = normalizeUiState((fn && fn(current)) || current);
    uiState = updated;
    await uiStorage.set('state', updated);
  };

  const setBusy = (isBusy, message) => {
    uiBusy = !!isBusy;
    const loadingEl = document.getElementById('loading-screen');
    if (!loadingEl) return;
    loadingEl.classList.toggle('hide', !isBusy);
    document.body.classList.toggle('ui-busy', !!isBusy);
    if (isBusy && message) toast(message);
  };

  const refs = getRefs(root);
  const pushEventLine = createEventLog(refs.events);

  let renderQueued = false;
  let renderInflight = null;
  let lastRenderAt = 0;

  const performRender = async () => {
    const state = safeGetState();

    // Injeta estado de UI para o render (sem tocar no core)
    state.__ui = buildUiForRender(state, uiState, uiBusy);

    document.body.dataset.page = state.__ui.currentPage || 'today';

    const view = renderAll(state);

    setHTML(refs.headerAccount, view.headerAccountHtml);
    setHTML(refs.main, view.mainHtml);
    setHTML(refs.bottomNav, view.bottomNavHtml);
    setHTML(refs.modals, view.modalsHtml);

    // Contador de PR (se existir no shell)
    if (refs.prsCount) {
      const count = Object.keys(state?.prs || {}).length;
      setText(refs.prsCount, `${count} PRs`);
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
  });

  setupActions({
    root,
    toast,
    rerender: () => rerender(),
    getUiState,
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
      try { destroyEvents?.(); } catch (e) { console.warn('destroyEvents falhou', e); }
    },
  };
}

function normalizeUiState(s) {
  const next = { ...(s || {}) };

  next.currentPage = ['today', 'history', 'account'].includes(next.currentPage) ? next.currentPage : 'today';
  next.modal = next.modal || null; // 'prs' | 'settings' | null

  next.wod = next.wod && typeof next.wod === 'object' ? next.wod : {};

  // Preferências simples (Config)
  next.settings = next.settings && typeof next.settings === 'object' ? next.settings : {};
  if (typeof next.settings.showLbsConversion !== 'boolean') next.settings.showLbsConversion = true;
  if (typeof next.settings.showEmojis !== 'boolean') next.settings.showEmojis = true;
  if (typeof next.settings.showObjectivesInWods !== 'boolean') next.settings.showObjectivesInWods = true;
  next.authMode = next.authMode === 'signup' ? 'signup' : 'signin';
  next.passwordReset = next.passwordReset && typeof next.passwordReset === 'object' ? next.passwordReset : {};
  next.signupVerification = next.signupVerification && typeof next.signupVerification === 'object' ? next.signupVerification : {};
  next.admin = next.admin && typeof next.admin === 'object' ? next.admin : { overview: null };
  next.athleteOverview = next.athleteOverview && typeof next.athleteOverview === 'object'
    ? next.athleteOverview
    : {
        detailLevel: 'none',
        stats: null,
        recentResults: [],
        recentWorkouts: [],
        benchmarkHistory: [],
        prHistory: [],
        prCurrent: {},
        measurements: [],
        runningHistory: [],
        strengthHistory: [],
        gymAccess: [],
        personalSubscription: null,
        athleteBenefits: null,
        blocks: {
          summary: { status: 'idle', error: '' },
          results: { status: 'idle', error: '' },
          workouts: { status: 'idle', error: '' },
        },
      };
  next.coachPortal = next.coachPortal && typeof next.coachPortal === 'object'
    ? next.coachPortal
    : {
        subscription: null,
        entitlements: [],
        gymAccess: [],
        gyms: [],
        selectedGymId: null,
        status: 'idle',
        error: '',
      };
  if (typeof next.athleteOverview.detailLevel !== 'string') next.athleteOverview.detailLevel = 'none';
  if (!Array.isArray(next.athleteOverview.recentResults)) next.athleteOverview.recentResults = [];
  if (!Array.isArray(next.athleteOverview.recentWorkouts)) next.athleteOverview.recentWorkouts = [];
  if (!Array.isArray(next.athleteOverview.benchmarkHistory)) next.athleteOverview.benchmarkHistory = [];
  if (!Array.isArray(next.athleteOverview.prHistory)) next.athleteOverview.prHistory = [];
  if (!next.athleteOverview.prCurrent || typeof next.athleteOverview.prCurrent !== 'object') next.athleteOverview.prCurrent = {};
  if (!Array.isArray(next.athleteOverview.measurements)) next.athleteOverview.measurements = [];
  if (!Array.isArray(next.athleteOverview.runningHistory)) next.athleteOverview.runningHistory = [];
  if (!Array.isArray(next.athleteOverview.strengthHistory)) next.athleteOverview.strengthHistory = [];
  if (!Array.isArray(next.athleteOverview.gymAccess)) next.athleteOverview.gymAccess = [];
  if (!next.athleteOverview.personalSubscription || typeof next.athleteOverview.personalSubscription !== 'object') next.athleteOverview.personalSubscription = null;
  if (!next.athleteOverview.athleteBenefits || typeof next.athleteOverview.athleteBenefits !== 'object') next.athleteOverview.athleteBenefits = null;
  next.athleteOverview.blocks = next.athleteOverview.blocks && typeof next.athleteOverview.blocks === 'object'
    ? next.athleteOverview.blocks
    : {};
  for (const key of ['summary', 'results', 'workouts']) {
    const current = next.athleteOverview.blocks[key];
    next.athleteOverview.blocks[key] = current && typeof current === 'object'
      ? { status: typeof current.status === 'string' ? current.status : 'idle', error: String(current.error || '') }
      : { status: 'idle', error: '' };
  }
  if (!Array.isArray(next.coachPortal.gyms)) next.coachPortal.gyms = [];
  if (!Array.isArray(next.coachPortal.gymAccess)) next.coachPortal.gymAccess = [];
  if (!Array.isArray(next.coachPortal.entitlements)) next.coachPortal.entitlements = [];
  if (typeof next.coachPortal.selectedGymId !== 'number') next.coachPortal.selectedGymId = next.coachPortal.selectedGymId || null;
  if (typeof next.coachPortal.status !== 'string') next.coachPortal.status = 'idle';
  if (typeof next.coachPortal.error !== 'string') next.coachPortal.error = '';

  return next;
}

function buildUiForRender(state, uiState, uiBusy = false) {
  const key = workoutKey(state);
  const wod = uiState.wod[key] || { activeLineId: null, done: {} };

  const lineIds = computeLineIdsFromState(state);
  const doneCount = lineIds.reduce((acc, id) => acc + (wod.done?.[id] ? 1 : 0), 0);

  return {
    modal: uiState.modal,
    currentPage: uiState.currentPage,
    isBusy: uiBusy,
    settings: uiState.settings,
    authMode: uiState.authMode,
    auth: {
      profile: safeGetProfile(),
    },
    passwordReset: uiState.passwordReset,
    signupVerification: uiState.signupVerification,
    admin: uiState.admin,
    athleteOverview: uiState.athleteOverview,
    coachPortal: uiState.coachPortal,

    wodKey: key,
    activeLineId: wod.activeLineId,
    done: wod.done || {},
    progress: { doneCount, totalCount: lineIds.length },
  };
}

function computeLineIdsFromState(state) {
  const blocks = state?.workoutOfDay?.blocks || state?.workout?.blocks || [];
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
    headerAccount: q('#ui-headerAccount'),
    main: q('#ui-main'),
    bottomNav: q('#ui-bottomNav'),
    modals: q('#ui-modals'),
    prsCount: q('#ui-prsCount'),
  };
}

function setText(el, value) {
  if (!el) return;
  const next = String(value ?? '');
  if (el.textContent === next) return;
  el.textContent = next;
}

function setHTML(el, html) {
  if (!el) return;
  const next = String(html ?? '');
  if (el.innerHTML === next) return;
  el.innerHTML = next;
}

function safeGetState() {
  try {
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
