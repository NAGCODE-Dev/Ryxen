import {
  canConsumeAthleteImport,
  consumeAthleteImport,
  getAthleteImportUsage,
  normalizeAthleteBenefits,
} from '../core/services/athleteBenefitUsage.js';
import {
  consumeCheckoutIntent,
  hasCheckoutAuth,
  peekCheckoutIntent,
  queueCheckoutIntent,
} from '../core/services/subscriptionService.js';
import { handleDiscoveryAction } from './action-domains/discovery.js';
import { handleAuthAccountAction } from './action-domains/auth-account.js';
import { handleWorkoutAction, setupWorkoutBindings } from './action-domains/workout.js';
import { handlePrsSettingsAction, setupPrsSettingsBindings } from './action-domains/prs-settings.js';
import { handleProfileAction } from './action-domains/profile.js';

export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');

  function resetOpenModalScroll() {
    const body = root.querySelector('.modal-overlay.isOpen .modal-body');
    if (body) body.scrollTop = 0;
    const container = root.querySelector('.modal-overlay.isOpen .modal-container, .modal-overlay.isOpen .modal-container-auth');
    if (container) container.scrollTop = 0;
  }

  function scrollMainToTop() {
    try {
      root.querySelector('#ui-main')?.scrollTo?.({ top: 0, behavior: 'instant' });
    } catch {
      root.querySelector('#ui-main')?.scrollTo?.(0, 0);
    }
    window.scrollTo?.({ top: 0, behavior: 'auto' });
  }

  const emptyCoachPortal = () => ({
    subscription: null,
    entitlements: [],
    gymAccess: [],
    gyms: [],
    selectedGymId: null,
  });

  const emptyAthleteOverview = () => ({
    detailLevel: 'none',
    stats: null,
    recentResults: [],
    upcomingCompetitions: [],
    recentWorkouts: [],
    gymAccess: [],
    athleteBenefits: null,
  });

  const emptyBenchmarkBrowser = () => ({
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
  });

  const emptyCompetitionBrowser = () => ({
    items: [],
    loading: false,
    selectedCompetitionId: null,
    selectedEventId: null,
    competitionLeaderboard: null,
    eventLeaderboard: null,
  });

  const emptyAthleteProfile = () => ({
    measurements: [],
  });

  function buildAthleteProfileFromSnapshot(snapshot) {
    return {
      measurements: Array.isArray(snapshot?.measurements) ? snapshot.measurements : [],
    };
  }

  function resolveAthleteBenefits(uiState, accessContext = null) {
    const overviewBenefits = uiState?.athleteOverview?.athleteBenefits || null;
    const accessBenefits = accessContext?.data?.athleteBenefits || accessContext?.athleteBenefits || null;
    return normalizeAthleteBenefits(overviewBenefits || accessBenefits || null);
  }

  function mergeAthleteOverviewSnapshot(nextOverview, currentOverview) {
    const next = nextOverview && typeof nextOverview === 'object' ? nextOverview : emptyAthleteOverview();
    const current = currentOverview && typeof currentOverview === 'object' ? currentOverview : emptyAthleteOverview();
    if (current?.detailLevel !== 'full' || next?.detailLevel === 'full') {
      return next;
    }

    return {
      ...next,
      detailLevel: 'full',
      benchmarkHistory: Array.isArray(current?.benchmarkHistory) ? current.benchmarkHistory : [],
      prHistory: Array.isArray(current?.prHistory) ? current.prHistory : [],
      prCurrent: current?.prCurrent && typeof current.prCurrent === 'object' ? current.prCurrent : {},
      runningHistory: Array.isArray(current?.runningHistory) ? current.runningHistory : [],
      strengthHistory: Array.isArray(current?.strengthHistory) ? current.strengthHistory : [],
    };
  }

  let accountSnapshotTask = null;
  let lastAccountSnapshotKey = '';
  let lastAccountSnapshotAt = 0;
  let athleteOverviewFullTask = null;
  let benchmarkBrowserTask = null;
  let competitionBrowserTask = null;

  function normalizeCheckoutPlan(planId) {
    const normalized = String(planId || '').trim().toLowerCase();
    return ['athlete_plus', 'starter', 'pro', 'coach', 'performance'].includes(normalized)
      ? normalized
      : '';
  }

  function validatePlanActivation(userId, planId) {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new Error('Usuário inválido');
    }
    if (!['athlete_plus', 'starter', 'pro', 'performance'].includes(planId)) {
      throw new Error('Plano inválido');
    }
  }

  function stripCheckoutParamsFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('checkoutPlan') && !url.searchParams.has('returnTo')) return;
      url.searchParams.delete('checkoutPlan');
      url.searchParams.delete('returnTo');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // no-op
    }
  }

  async function maybeResumePendingCheckout() {
    const pending = consumeCheckoutIntent();
    if (!pending?.planId || !hasCheckoutAuth()) return false;
    try {
      toast('Continuando para o checkout...');
      await window.__APP__?.openCheckout?.(pending.planId);
      return true;
    } catch (error) {
      queueCheckoutIntent(pending.planId, pending);
      throw error;
    }
  }

  async function maybePrimeCheckoutIntentFromUrl() {
    try {
      const url = new URL(window.location.href);
      const planId = normalizeCheckoutPlan(url.searchParams.get('checkoutPlan'));
      const returnTo = String(url.searchParams.get('returnTo') || '').trim();
      if (!planId) return;

      queueCheckoutIntent(planId, { source: 'pricing', returnTo });
      stripCheckoutParamsFromUrl();

      if (hasCheckoutAuth() && window.__APP__?.getProfile?.()?.data?.email) {
        await maybeResumePendingCheckout();
        return;
      }

      await patchUiState((s) => ({ ...s, modal: 'auth', authMode: 'signin' }));
      toast('Entre para continuar no checkout');
      await rerender();
    } catch (error) {
      console.warn('Falha ao preparar checkout autenticado:', error?.message || error);
    }
  }

  async function guardAthleteImport(kind, uiState) {
    const profile = window.__APP__?.getProfile?.()?.data || null;
    const accessContext = profile?.email ? await window.__APP__?.getAccessContext?.() : null;
    const benefits = resolveAthleteBenefits(uiState, accessContext);
    const usage = getAthleteImportUsage(benefits, kind);

    if (!canConsumeAthleteImport(benefits, kind)) {
      throw new Error(
        usage.limit === null
          ? 'Seu plano atual não permite mais importações neste período'
          : `Limite mensal atingido: ${usage.used}/${usage.limit} importações entre PDF e mídia. Seu nível atual é ${benefits.label}.`,
      );
    }

    return { benefits, usage };
  }

  function recordPerfMetric(name, durationMs, meta = {}) {
    try {
      const current = window.__CROSSAPP_UI_METRICS__ || { recent: [], summary: {} };
      const recent = [...(current.recent || []), { name, durationMs, at: new Date().toISOString(), ...meta }].slice(-30);
      const previous = current.summary?.[name] || { count: 0, maxMs: 0, avgMs: 0, lastMs: 0 };
      const count = previous.count + 1;
      const summary = {
        ...(current.summary || {}),
        [name]: {
          count,
          maxMs: Math.max(previous.maxMs || 0, durationMs),
          avgMs: Number((((previous.avgMs || 0) * previous.count + durationMs) / count).toFixed(1)),
          lastMs: durationMs,
          ...meta,
        },
      };
      window.__CROSSAPP_UI_METRICS__ = { recent, summary };
      if (durationMs >= 800) {
        console.warn('[ui:slow]', name, `${durationMs}ms`, meta);
      }
    } catch {
      // no-op
    }
  }

  async function measureAsync(name, fn, meta = {}) {
    const startedAt = performance.now();
    try {
      return await fn();
    } finally {
      recordPerfMetric(name, Number((performance.now() - startedAt).toFixed(1)), meta);
    }
  }

  async function loadCoachPortalSnapshot(selectedGymId) {
    try {
      const [subscriptionResult, entitlementsResult, gymsResult] = await Promise.all([
        measureAsync('account.subscription', () => window.__APP__?.getSubscriptionStatus?.()),
        measureAsync('account.entitlements', () => window.__APP__?.getEntitlements?.()),
        measureAsync('account.gyms', () => window.__APP__?.getMyGyms?.()),
      ]);

      const gyms = gymsResult?.data?.gyms || [];
      const resolvedGymId = selectedGymId || gyms[0]?.id || null;
      const entitlements = entitlementsResult?.data?.entitlements || [];
      const gymAccess = entitlementsResult?.data?.gymAccess || [];

      return {
        subscription: subscriptionResult?.data || null,
        entitlements,
        gymAccess,
        gyms,
        selectedGymId: resolvedGymId,
      };
    } catch {
      return emptyCoachPortal();
    }
  }

  async function loadAthleteOverview({ lite = false } = {}) {
    try {
      const result = await measureAsync('account.athlete-dashboard', () => window.__APP__?.getAthleteDashboard?.({ lite }));
      const payload = result?.data || {};
      return {
        overview: {
        ...emptyAthleteOverview(),
        ...payload,
        detailLevel: lite ? 'lite' : 'full',
        },
        profile: buildAthleteProfileFromSnapshot(payload),
      };
    } catch {
      return {
        overview: {
          ...emptyAthleteOverview(),
          detailLevel: lite ? 'lite' : 'full',
        },
        profile: emptyAthleteProfile(),
      };
    }
  }

  async function loadAccountSnapshot(profile, selectedGymId) {
    const nextState = {
      coachPortal: emptyCoachPortal(),
      athleteOverview: emptyAthleteOverview(),
      athleteProfile: emptyAthleteProfile(),
      admin: { overview: null, health: null, manualReset: null, query: '' },
    };

    if (!profile?.email) {
      return nextState;
    }

    const [coachPortal, athleteOverview] = await Promise.all([
      measureAsync('account.snapshot.coach', () => loadCoachPortalSnapshot(selectedGymId)),
      measureAsync('account.snapshot.athlete', () => loadAthleteOverview({ lite: true })),
    ]);

    nextState.coachPortal = coachPortal;
    nextState.athleteOverview = athleteOverview.overview;
    nextState.athleteProfile = athleteOverview.profile;
    nextState.admin = { overview: null, health: null, manualReset: null, query: '' };

    return nextState;
  }

  async function hydrateAccountSnapshotInBackground(profile, selectedGymId = null) {
    try {
      if (!profile?.email) return;

      const snapshotKey = `${String(profile.email || '').toLowerCase()}::${selectedGymId || 'default'}`;
      const isFresh = accountSnapshotTask && lastAccountSnapshotKey === snapshotKey && (Date.now() - lastAccountSnapshotAt) < 15000;
      if (!isFresh) {
        lastAccountSnapshotKey = snapshotKey;
        lastAccountSnapshotAt = Date.now();
        accountSnapshotTask = measureAsync('account.snapshot.total', () => loadAccountSnapshot(profile, selectedGymId));
      }

      const snapshot = await accountSnapshotTask;
      await patchUiState((s) => ({
        ...s,
        ...snapshot,
        athleteOverview: mergeAthleteOverviewSnapshot(snapshot?.athleteOverview, s?.athleteOverview),
        athleteProfile: snapshot?.athleteProfile || s?.athleteProfile || emptyAthleteProfile(),
      }));
      await rerender();
      if ((getUiState?.()?.currentPage || 'today') === 'history') {
        hydrateAthleteOverviewFullInBackground();
      }
    } catch (error) {
      console.warn('Falha ao carregar snapshot da conta:', error?.message || error);
    } finally {
      accountSnapshotTask = null;
    }
  }

  async function hydrateAthleteOverviewFullInBackground() {
    try {
      const profile = window.__APP__?.getProfile?.()?.data || null;
      if (!profile?.email) return;

      const ui = getUiState?.() || {};
      if (ui?.athleteOverview?.detailLevel === 'full') return;
      if (!athleteOverviewFullTask) {
        athleteOverviewFullTask = measureAsync('athlete.dashboard.full', () => loadAthleteOverview({ lite: false }));
      }
      const athleteOverview = await athleteOverviewFullTask;
      await patchUiState((s) => ({
        ...s,
        athleteOverview: mergeAthleteOverviewSnapshot(athleteOverview?.overview, s?.athleteOverview),
        athleteProfile: athleteOverview?.profile || s?.athleteProfile || emptyAthleteProfile(),
      }));
      await rerender();
    } catch (error) {
      console.warn('Falha ao carregar histórico completo do atleta:', error?.message || error);
    } finally {
      athleteOverviewFullTask = null;
    }
  }

  async function loadBenchmarkBrowserSnapshot(overrides = {}) {
    const ui = getUiState?.() || {};
    const current = ui?.benchmarkBrowser || emptyBenchmarkBrowser();
    const profile = window.__APP__?.getProfile?.()?.data || null;
    if (!profile?.email) {
      return emptyBenchmarkBrowser();
    }

    const category = typeof overrides.category === 'string' ? overrides.category : current.category || 'girls';
    const page = Number(overrides.page || current.pagination?.page || 1);
    const sort = String(overrides.sort || current.sort || 'year_desc');
    const requestedSelectedSlug = typeof overrides.selectedSlug === 'string' ? overrides.selectedSlug : current.selectedSlug;

    const benchmarkResponse = await measureAsync('benchmark.browser.list', () => window.__APP__?.getBenchmarks?.({
      category: category || undefined,
      sort,
      page,
      limit: 12,
    }));
    const items = benchmarkResponse?.data?.benchmarks || [];
    const pagination = benchmarkResponse?.data?.pagination || { total: 0, page: 1, limit: 12, pages: 1 };
    const selectedSlug = requestedSelectedSlug && items.some((item) => item.slug === requestedSelectedSlug)
      ? requestedSelectedSlug
      : (items[0]?.slug || '');

    let selectedBenchmark = items.find((item) => item.slug === selectedSlug) || null;
    let leaderboard = [];
    let currentUserResult = null;

    if (selectedSlug) {
      const leaderboardResponse = await measureAsync('benchmark.browser.leaderboard', () => window.__APP__?.getBenchmarkLeaderboard?.(selectedSlug, { limit: 10 }));
      selectedBenchmark = leaderboardResponse?.data?.benchmark || selectedBenchmark;
      leaderboard = leaderboardResponse?.data?.results || [];
      currentUserResult = leaderboardResponse?.data?.currentUser || null;
    }

    return {
      items,
      pagination,
      category,
      query: '',
      sort,
      loading: false,
      selectedSlug,
      selectedBenchmark,
      leaderboard,
      currentUserResult,
      leaderboardLoading: false,
    };
  }

  async function hydrateBenchmarkBrowserInBackground(overrides = {}) {
    try {
      const profile = window.__APP__?.getProfile?.()?.data || null;
      if (!profile?.email) return;

      if (!benchmarkBrowserTask) {
        await patchUiState((s) => ({
          ...s,
          benchmarkBrowser: {
            ...(s?.benchmarkBrowser || emptyBenchmarkBrowser()),
            loading: true,
          },
        }));
        await rerender();
        benchmarkBrowserTask = loadBenchmarkBrowserSnapshot(overrides);
      }

      const nextBenchmarkBrowser = await benchmarkBrowserTask;
      await patchUiState((s) => ({ ...s, benchmarkBrowser: nextBenchmarkBrowser }));
      await rerender();
    } catch (error) {
      console.warn('Falha ao carregar biblioteca de benchmarks:', error?.message || error);
      await patchUiState((s) => ({
        ...s,
        benchmarkBrowser: {
          ...(s?.benchmarkBrowser || emptyBenchmarkBrowser()),
          loading: false,
          leaderboardLoading: false,
        },
      }));
      await rerender();
    } finally {
      benchmarkBrowserTask = null;
    }
  }

  async function loadCompetitionBrowserSnapshot(overrides = {}) {
    const ui = getUiState?.() || {};
    const current = ui?.competitionBrowser || emptyCompetitionBrowser();
    const profile = window.__APP__?.getProfile?.()?.data || null;
    if (!profile?.email) {
      return emptyCompetitionBrowser();
    }

    const calendarResponse = await measureAsync('competition.browser.calendar', () => window.__APP__?.getCompetitionCalendar?.({}));
    const items = calendarResponse?.data?.competitions || [];
    const requestedCompetitionId = Number(overrides.selectedCompetitionId || current.selectedCompetitionId || items[0]?.id || 0) || null;
    const selectedCompetition = items.find((item) => Number(item.id) === requestedCompetitionId) || items[0] || null;
    const selectedCompetitionId = Number(selectedCompetition?.id || 0) || null;
    const availableEvents = Array.isArray(selectedCompetition?.events) ? selectedCompetition.events : [];
    const requestedEventId = Number(overrides.selectedEventId || current.selectedEventId || 0) || null;
    const selectedEvent = availableEvents.find((item) => Number(item.id) === requestedEventId) || availableEvents[0] || null;
    const selectedEventId = Number(selectedEvent?.id || 0) || null;

    let competitionLeaderboard = null;
    let eventLeaderboard = null;

    if (selectedCompetitionId && availableEvents.length) {
      try {
        const res = await measureAsync('competition.browser.competition-leaderboard', () => window.__APP__?.getCompetitionLeaderboard?.(selectedCompetitionId));
        competitionLeaderboard = res?.data || null;
      } catch {
        competitionLeaderboard = null;
      }
    }

    if (selectedEventId) {
      try {
        const res = await measureAsync('competition.browser.event-leaderboard', () => window.__APP__?.getEventLeaderboard?.(selectedEventId, { limit: 20 }));
        eventLeaderboard = res?.data || null;
      } catch {
        eventLeaderboard = null;
      }
    }

    return {
      items,
      loading: false,
      selectedCompetitionId,
      selectedEventId,
      competitionLeaderboard,
      eventLeaderboard,
    };
  }

  async function hydrateCompetitionBrowserInBackground(overrides = {}) {
    try {
      const profile = window.__APP__?.getProfile?.()?.data || null;
      if (!profile?.email) return;

      if (!competitionBrowserTask) {
        await patchUiState((s) => ({
          ...s,
          competitionBrowser: {
            ...(s?.competitionBrowser || emptyCompetitionBrowser()),
            loading: true,
          },
        }));
        await rerender();
        competitionBrowserTask = loadCompetitionBrowserSnapshot(overrides);
      }

      const nextCompetitionBrowser = await competitionBrowserTask;
      await patchUiState((s) => ({ ...s, competitionBrowser: nextCompetitionBrowser }));
      await rerender();
    } catch (error) {
      console.warn('Falha ao carregar calendário de competições:', error?.message || error);
      await patchUiState((s) => ({
        ...s,
        competitionBrowser: {
          ...(s?.competitionBrowser || emptyCompetitionBrowser()),
          loading: false,
        },
      }));
      await rerender();
    } finally {
      competitionBrowserTask = null;
    }
  }

  async function syncAthletePrIfAuthenticated(exercise, value) {
    const profile = window.__APP__?.getProfile?.()?.data || null;
    if (!profile?.email) return null;

    try {
      await window.__APP__?.logAthletePr?.({
        exercise,
        value,
        unit: 'kg',
        source: 'app',
      });
      const athleteSnapshot = await loadAthleteOverview();
      await patchUiState((s) => ({
        ...s,
        athleteOverview: mergeAthleteOverviewSnapshot(athleteSnapshot?.overview, s?.athleteOverview),
        athleteProfile: athleteSnapshot?.profile || s?.athleteProfile || emptyAthleteProfile(),
      }));
      return athleteSnapshot?.overview || null;
    } catch {
      return null;
    }
  }

  function normalizeBenchmarkScoreInput(scoreType, rawValue) {
    const value = String(rawValue || '');
    const normalizedType = String(scoreType || '').trim().toLowerCase();

    if (normalizedType === 'for_time') {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      if (!digits) return '';
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
      return `${digits.slice(0, digits.length - 4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
    }

    if (normalizedType === 'rounds_reps') {
      const cleaned = value.replace(/[^\d+]/g, '');
      const [rounds = '', reps = ''] = cleaned.split('+');
      return reps ? `${rounds}+${reps.replace(/\+/g, '')}` : rounds;
    }

    if (normalizedType === 'load') {
      return value.replace(/[^0-9., kgblKGBl]/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    return value.replace(/[^\d.,-]/g, '').trim();
  }

  function validateBenchmarkScoreInput(scoreType, rawValue) {
    const value = String(rawValue || '').trim();
    const normalizedType = String(scoreType || '').trim().toLowerCase();
    if (!value) return 'Informe o seu resultado';

    if (normalizedType === 'for_time') {
      return /^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(value) ? '' : 'Use tempo no formato mm:ss ou hh:mm:ss';
    }

    if (normalizedType === 'rounds_reps') {
      return /^\d+\+\d+$/.test(value) ? '' : 'Use rounds + reps no formato 15+12';
    }

    if (normalizedType === 'load' || normalizedType === 'reps') {
      return /\d/.test(value) ? '' : 'Informe um valor numérico válido';
    }

    return '';
  }

  // Clicks (delegação)
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    try {
      const discoveryHandled = await handleDiscoveryAction(action, el, {
        root,
        getUiState,
        patchUiState,
        rerender,
        emptyBenchmarkBrowser,
        emptyCompetitionBrowser,
        hydrateAthleteOverviewFullInBackground,
        hydrateBenchmarkBrowserInBackground,
        hydrateCompetitionBrowserInBackground,
        validateBenchmarkScoreInput,
        toast,
        scrollMainToTop,
      });
      if (discoveryHandled) return;

      const workoutHandled = await handleWorkoutAction(action, el, {
        root,
        getUiState,
        setUiState,
        patchUiState,
        rerender,
        toast,
        guardAthleteImport,
        consumeAthleteImport,
        pickPdfFile,
        pickUniversalFile,
        ensureActiveLine,
        workoutKeyFromAppState,
        getLineIdsFromDOM,
        pickNextId,
        pickPrevId,
        getActiveLineIdFromUi,
        scrollToLine,
        startRestTimer,
      });
      if (workoutHandled) return;

      const prsSettingsHandled = await handlePrsSettingsAction(action, el, {
        root,
        getUiState,
        setUiState,
        patchUiState,
        rerender,
        toast,
        syncAthletePrIfAuthenticated,
        loadAthleteOverview,
        cssEscape,
      });
      if (prsSettingsHandled) return;

      const profileHandled = await handleProfileAction(action, el, {
        root,
        patchUiState,
        rerender,
        toast,
        syncAthleteMeasurementsIfAuthenticated: async () => {
          const profile = window.__APP__?.getProfile?.()?.data || null;
          if (!profile?.email) return null;
          const ui = getUiState?.() || {};
          const measurements = ui?.athleteProfile?.measurements || [];
          await window.__APP__?.syncAthleteMeasurementsSnapshot?.(measurements);
          return measurements;
        },
      });
      if (profileHandled) return;

      const authHandled = await handleAuthAccountAction(action, el, {
        root,
        getUiState,
        setUiState,
        patchUiState,
        rerender,
        resetOpenModalScroll,
        toast,
        normalizeCheckoutPlan,
        hasCheckoutAuth,
        queueCheckoutIntent,
        emptyCoachPortal,
        emptyAthleteOverview,
        emptyAthleteProfile,
        emptyCompetitionBrowser,
        loadAccountSnapshot,
        mergeAthleteOverviewSnapshot,
        maybeResumePendingCheckout,
        hydrateAccountSnapshotInBackground,
        validatePlanActivation,
      });
      if (authHandled) return;

      switch (action) {
        // ----- Modais -----
        case 'modal:open': {
          const modal = el.dataset.modal || null;
          if (modal === 'auth') {
            const profile = window.__APP__?.getProfile?.()?.data || null;
            const authMode = el.dataset.authMode === 'signup' ? 'signup' : 'signin';
            await patchUiState((s) => ({
              ...s,
              modal,
              authMode,
              authSubmitting: false,
              passwordReset: {
                ...(s.passwordReset || {}),
                open: false,
                requesting: false,
                confirming: false,
                statusMessage: '',
                statusTone: '',
              },
            }));
            await rerender();
            resetOpenModalScroll();
            hydrateAccountSnapshotInBackground(profile);
            if (modal === 'auth') root.querySelector('#auth-email')?.focus();
            return;
          } else {
            await setUiState({ modal });
          }
          await rerender();
          resetOpenModalScroll();

          if (modal === 'prs') root.querySelector('#ui-prsSearch')?.focus();
          if (modal === 'auth') root.querySelector('#auth-email')?.focus();
          return;
        }

        case 'modal:close': {
          await patchUiState((s) => ({
            ...s,
            modal: null,
            importFlow: {
              ...(s?.importFlow || {}),
              isProcessing: false,
              draft: null,
              pendingKind: '',
              pendingBenefits: null,
              pendingFileName: '',
              pendingFileSize: 0,
              lastError: '',
            },
          }));
          await rerender();
          return;
        }

        default:
          return;
      }
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  setupWorkoutBindings({ root, toast, rerender });
  setupPrsSettingsBindings({ root });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || t.id !== 'benchmark-score-input') return;
    const ui = getUiState?.() || {};
    const scoreType = ui?.benchmarkBrowser?.selectedBenchmark?.score_type || '';
    const nextValue = normalizeBenchmarkScoreInput(scoreType, t.value);
    if (nextValue !== t.value) {
      t.value = nextValue;
    }
  });

  queueMicrotask(async () => {
    try {
      await maybePrimeCheckoutIntentFromUrl();
      if (peekCheckoutIntent() && hasCheckoutAuth() && window.__APP__?.getProfile?.()?.data?.email) {
        await maybeResumePendingCheckout();
      }
    } catch (error) {
      console.warn('Falha ao preparar checkout pendente:', error?.message || error);
    }
  });

  // Clique fora do modal fecha
  root.addEventListener('click', async (e) => {
    const overlay = e.target.closest('.modal-overlay');
    if (!overlay) return;

    if (e.target === overlay) {
      await patchUiState((s) => ({
        ...s,
        modal: null,
        importFlow: {
          ...(s?.importFlow || {}),
          isProcessing: false,
          draft: null,
          pendingKind: '',
          pendingBenefits: null,
          pendingFileName: '',
          pendingFileSize: 0,
          lastError: '',
        },
      }));
      await rerender();
    }
  });

  // Esc fecha modal
  document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Escape') return;
    const ui = getUiState?.();
    if (ui?.modal) {
      await setUiState({ modal: null });
      await rerender();
    }
  });

  root.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target?.closest?.('#ui-authForm')) return;
    e.preventDefault();

    const ui = getUiState?.() || {};
    const mode = ui.authMode === 'signup' ? 'signup' : 'signin';
    const trigger = root.querySelector(`[data-action="auth:submit"][data-mode="${mode}"]`);
    trigger?.click();
  });
}

function workoutKeyFromAppState() {
  const s = window.__APP__?.getState?.() || {};
  const week = s?.activeWeekNumber ?? '0';
  const day = s?.currentDay ?? 'Hoje';
  return `${week}:${String(day).toLowerCase()}`;
}

function getActiveLineIdFromUi(uiState, key) {
  try {
    const wod = uiState?.wod?.[key];
    return wod?.activeLineId || null;
  } catch {
    return null;
  }
}

function getLineIdsFromDOM(root) {
  return Array.from(root.querySelectorAll('[data-line-id]'))
    .map((el) => el.getAttribute('data-line-id'))
    .filter(Boolean);
}

function pickNextId(ids, doneMap, currentId) {
  const done = doneMap || {};
  const start = Math.max(0, ids.indexOf(currentId));
  for (let i = start + 1; i < ids.length; i++) if (!done[ids[i]]) return ids[i];
  for (let i = 0; i < ids.length; i++) if (!done[ids[i]]) return ids[i];
  return ids[Math.min(start + 1, ids.length - 1)] || ids[0];
}

function pickPrevId(ids, currentId) {
  const idx = ids.indexOf(currentId);
  if (idx <= 0) return ids[0];
  return ids[idx - 1];
}

function scrollToLine(root, lineId) {
  const el = root.querySelector(`[data-line-id="${cssEscape(lineId)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function ensureActiveLine(root, patchUiState) {
  const ids = getLineIdsFromDOM(root);
  if (!ids.length) return;

  const key = workoutKeyFromAppState();
  await patchUiState((s) => {
    const st = { ...s };
    st.wod = st.wod || {};
    const wod = st.wod[key] || { activeLineId: null, done: {} };
    if (!wod.activeLineId) wod.activeLineId = ids[0];
    st.wod[key] = wod;
    return st;
  });

  scrollToLine(root, ids[0]);
}

function pickPdfFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

function pickUniversalFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/plain',
      'text/csv',
      'application/json',
      'image/*',
      'video/*',
      '.xlsx',
      '.xls',
      '.ods',
      '.txt',
      '.md',
      '.csv',
      '.json',
    ].join(',');
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

function cssEscape(value) {
  return String(value || '').replace(/[\"\\]/g, '\\$&');
}

function startRestTimer(totalSeconds, toast) {
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

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
