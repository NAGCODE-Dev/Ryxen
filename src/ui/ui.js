import { renderAppShell, renderAll } from './render.js';
import { setupActions } from './actions.js';
import { bindAppEvents } from './events.js';
import { normalizeMeasurementEntries } from './profileMeasurements.js';

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

    // Training mode vira classe global (UX)
    document.body.classList.toggle('ui-trainingMode', !!state.__ui.trainingMode);
    document.body.dataset.page = state.__ui.currentPage || 'today';

    const view = renderAll(state);

    setHTML(refs.headerAccount, view.headerAccountHtml);
    setHTML(refs.main, view.mainHtml);
    setHTML(refs.bottomNav, view.bottomNavHtml);
    setHTML(refs.sidebarNav, view.sidebarNavHtml);
    setHTML(refs.sidebarMeta, view.sidebarMetaHtml);
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

  if (typeof next.trainingMode !== 'boolean') next.trainingMode = false;
  next.currentPage = ['today', 'history', 'competitions', 'account'].includes(next.currentPage) ? next.currentPage : 'today';
  next.modal = next.modal || null; // 'prs' | 'settings' | null

  next.wod = next.wod && typeof next.wod === 'object' ? next.wod : {};

  // Preferências simples (Config)
  next.settings = next.settings && typeof next.settings === 'object' ? next.settings : {};
  if (typeof next.settings.showLbsConversion !== 'boolean') next.settings.showLbsConversion = true;
  if (typeof next.settings.showEmojis !== 'boolean') next.settings.showEmojis = true;
  if (typeof next.settings.showObjectivesInWods !== 'boolean') next.settings.showObjectivesInWods = true;
  next.authMode = next.authMode === 'signup' ? 'signup' : 'signin';
  if (typeof next.authSubmitting !== 'boolean') next.authSubmitting = false;
  next.passwordReset = next.passwordReset && typeof next.passwordReset === 'object' ? next.passwordReset : {};
  next.importFlow = next.importFlow && typeof next.importFlow === 'object' ? next.importFlow : {};
  if (typeof next.passwordReset.open !== 'boolean') next.passwordReset.open = false;
  if (typeof next.passwordReset.requesting !== 'boolean') next.passwordReset.requesting = false;
  if (typeof next.passwordReset.confirming !== 'boolean') next.passwordReset.confirming = false;
  if (typeof next.importFlow.isProcessing !== 'boolean') next.importFlow.isProcessing = false;
  if (typeof next.importFlow.returnPage !== 'string') next.importFlow.returnPage = 'today';
  if (!next.importFlow.lastReview || typeof next.importFlow.lastReview !== 'object') next.importFlow.lastReview = null;
  if (typeof next.importFlow.lastError !== 'string') next.importFlow.lastError = '';
  if (!next.importFlow.draft || typeof next.importFlow.draft !== 'object') next.importFlow.draft = null;
  if (typeof next.importFlow.pendingKind !== 'string') next.importFlow.pendingKind = '';
  if (!next.importFlow.pendingBenefits || typeof next.importFlow.pendingBenefits !== 'object') next.importFlow.pendingBenefits = null;
  if (typeof next.importFlow.pendingFileName !== 'string') next.importFlow.pendingFileName = '';
  if (typeof next.importFlow.pendingFileSize !== 'number') next.importFlow.pendingFileSize = 0;
  next.admin = next.admin && typeof next.admin === 'object' ? next.admin : { overview: null, health: null, manualReset: null };
  next.benchmarkBrowser = next.benchmarkBrowser && typeof next.benchmarkBrowser === 'object'
    ? next.benchmarkBrowser
    : {
        items: [],
        pagination: { total: 0, page: 1, limit: 12, pages: 1 },
        category: 'girls',
        query: '',
        sort: 'year_desc',
        loading: false,
        selectedSlug: '',
        selectedBenchmark: null,
        leaderboard: [],
        currentUserResult: null,
        leaderboardLoading: false,
      };
  next.competitionBrowser = next.competitionBrowser && typeof next.competitionBrowser === 'object'
    ? next.competitionBrowser
    : {
        items: [],
        loading: false,
        selectedCompetitionId: null,
        selectedEventId: null,
        competitionLeaderboard: null,
        eventLeaderboard: null,
      };
  next.athleteProfile = next.athleteProfile && typeof next.athleteProfile === 'object'
    ? next.athleteProfile
    : {
        measurements: [],
      };
  next.athleteOverview = next.athleteOverview && typeof next.athleteOverview === 'object'
    ? next.athleteOverview
    : { detailLevel: 'none', stats: null, recentResults: [], upcomingCompetitions: [], recentWorkouts: [], gymAccess: [], athleteBenefits: null };
  next.coachPortal = next.coachPortal && typeof next.coachPortal === 'object'
    ? next.coachPortal
    : {
        subscription: null,
        entitlements: [],
        gymAccess: [],
        gyms: [],
        selectedGymId: null,
      };
  if (typeof next.athleteOverview.detailLevel !== 'string') next.athleteOverview.detailLevel = 'none';
  if (!Array.isArray(next.athleteOverview.recentResults)) next.athleteOverview.recentResults = [];
  if (!Array.isArray(next.athleteOverview.upcomingCompetitions)) next.athleteOverview.upcomingCompetitions = [];
  if (!Array.isArray(next.athleteOverview.recentWorkouts)) next.athleteOverview.recentWorkouts = [];
  if (!Array.isArray(next.athleteOverview.gymAccess)) next.athleteOverview.gymAccess = [];
  if (!next.athleteOverview.athleteBenefits || typeof next.athleteOverview.athleteBenefits !== 'object') next.athleteOverview.athleteBenefits = null;
  if (!Array.isArray(next.coachPortal.gyms)) next.coachPortal.gyms = [];
  if (!Array.isArray(next.coachPortal.gymAccess)) next.coachPortal.gymAccess = [];
  if (!Array.isArray(next.coachPortal.entitlements)) next.coachPortal.entitlements = [];
  if (typeof next.coachPortal.selectedGymId !== 'number') next.coachPortal.selectedGymId = next.coachPortal.selectedGymId || null;
  if (!Array.isArray(next.benchmarkBrowser.items)) next.benchmarkBrowser.items = [];
  if (!next.benchmarkBrowser.pagination || typeof next.benchmarkBrowser.pagination !== 'object') {
    next.benchmarkBrowser.pagination = { total: 0, page: 1, limit: 12, pages: 1 };
  }
  if (!Array.isArray(next.benchmarkBrowser.leaderboard)) next.benchmarkBrowser.leaderboard = [];
  if (!next.benchmarkBrowser.currentUserResult || typeof next.benchmarkBrowser.currentUserResult !== 'object') next.benchmarkBrowser.currentUserResult = null;
  if (typeof next.benchmarkBrowser.category !== 'string') next.benchmarkBrowser.category = 'girls';
  if (typeof next.benchmarkBrowser.query !== 'string') next.benchmarkBrowser.query = '';
  if (typeof next.benchmarkBrowser.sort !== 'string') next.benchmarkBrowser.sort = 'year_desc';
  if (typeof next.benchmarkBrowser.selectedSlug !== 'string') next.benchmarkBrowser.selectedSlug = '';
  if (typeof next.benchmarkBrowser.loading !== 'boolean') next.benchmarkBrowser.loading = false;
  if (typeof next.benchmarkBrowser.leaderboardLoading !== 'boolean') next.benchmarkBrowser.leaderboardLoading = false;
  if (!Array.isArray(next.competitionBrowser.items)) next.competitionBrowser.items = [];
  if (typeof next.competitionBrowser.loading !== 'boolean') next.competitionBrowser.loading = false;
  if (typeof next.competitionBrowser.selectedCompetitionId !== 'number') next.competitionBrowser.selectedCompetitionId = next.competitionBrowser.selectedCompetitionId || null;
  if (typeof next.competitionBrowser.selectedEventId !== 'number') next.competitionBrowser.selectedEventId = next.competitionBrowser.selectedEventId || null;
  if (!next.competitionBrowser.competitionLeaderboard || typeof next.competitionBrowser.competitionLeaderboard !== 'object') next.competitionBrowser.competitionLeaderboard = null;
  if (!next.competitionBrowser.eventLeaderboard || typeof next.competitionBrowser.eventLeaderboard !== 'object') next.competitionBrowser.eventLeaderboard = null;
  next.athleteProfile.measurements = normalizeMeasurementEntries(next.athleteProfile.measurements);

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
    trainingMode: uiState.trainingMode,
    isBusy: uiBusy,
    settings: uiState.settings,
    authMode: uiState.authMode,
    authSubmitting: uiState.authSubmitting,
    auth: {
      profile: safeGetProfile(),
      submitting: !!uiState.authSubmitting,
    },
    passwordReset: uiState.passwordReset,
    importFlow: uiState.importFlow,
    admin: uiState.admin,
    benchmarkBrowser: uiState.benchmarkBrowser,
    competitionBrowser: uiState.competitionBrowser,
    athleteOverview: uiState.athleteOverview,
    athleteProfile: uiState.athleteProfile,
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
    sidebarNav: q('#ui-sidebarNav'),
    sidebarMeta: q('#ui-sidebarMeta'),
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
    return window.__APP__?.getState ? window.__APP__.getState() : {};
  } catch {
    return {};
  }
}

function safeGetProfile() {
  try {
    const result = window.__APP__?.getProfile?.();
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
