import { isDeveloperEmail, isDeveloperProfile } from '../core/utils/devAccess.js';
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

export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');

  let googleScriptPromise = null;
  let googleInitializedClientId = '';
  let googlePromptClientId = '';

  function setGoogleFallbackVisible(visible) {
    const fallbackBtn = root.querySelector('#google-signin-fallback');
    if (fallbackBtn) {
      fallbackBtn.hidden = !visible;
    }
  }

  async function promptGoogleSignIn() {
    const googleApi = window.google;
    if (!googleApi?.accounts?.id) {
      throw new Error('Google Sign-In indisponível');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Não foi possível abrir o seletor do Google. Desative o bloqueador deste site e tente novamente.'));
      }, 4000);

      googleApi.accounts.id.prompt((notification) => {
        if (settled) return;
        const skipped = notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.();
        if (!skipped) return;

        settled = true;
        window.clearTimeout(timeout);
        reject(new Error('O navegador bloqueou o login do Google. Libere cookies pop-ups/bloqueadores para este site e tente novamente.'));
      });

      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve({ success: true });
      }, 600);
    });
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

  async function loadGoogleScript() {
    if (window.google?.accounts?.id) return window.google;
    if (googleScriptPromise) return googleScriptPromise;

    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-gsi="1"]');
      if (existing) {
        const checkReady = () => {
          if (window.google?.accounts?.id) resolve(window.google);
          else window.setTimeout(checkReady, 80);
        };
        checkReady();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleGsi = '1';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Não foi possível carregar o Google Sign-In'));
      document.head.appendChild(script);
    });

    return googleScriptPromise;
  }

  async function ensureGoogleSignInUi() {
    const ui = getUiState?.() || {};
    if (ui.modal !== 'auth') return;

    const shell = root.querySelector('#google-signin-shell');
    const buttonEl = root.querySelector('#google-signin-button');
    if (!shell || !buttonEl) return;
    setGoogleFallbackVisible(false);

    const profile = window.__APP__?.getProfile?.()?.data || null;
    if (profile?.email) {
      shell.style.display = 'none';
      return;
    }

    const runtime = window.__APP__?.getRuntimeConfig?.()?.data || {};
    const clientId = String(runtime?.auth?.googleClientId || '').trim();
    if (!clientId) {
      shell.innerHTML = '<p class="account-hint auth-googleHint">Google Sign-In não configurado.</p>';
      return;
    }

    const googleApi = await loadGoogleScript();
    if (!googleApi?.accounts?.id) {
      throw new Error('Google Sign-In indisponível');
    }

    shell.style.display = '';
    buttonEl.innerHTML = '';
    if (googleInitializedClientId !== clientId) {
      googleApi.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const result = await window.__APP__?.signInWithGoogle?.({ credential: response.credential });
            if (!result?.token && !result?.user) {
              throw new Error('Falha ao autenticar com Google');
            }

            const signedProfile = result?.user || window.__APP__?.getProfile?.()?.data || null;
            await setUiState({ modal: null, authMode: 'signin' });
            toast('Login com Google efetuado');
            await rerender();
            hydrateAccountSnapshotInBackground(signedProfile);
            if (await maybeResumePendingCheckout()) return;
          } catch (error) {
            toast(error?.message || 'Erro ao entrar com Google');
            console.error(error);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });
      googleInitializedClientId = clientId;
      googlePromptClientId = clientId;
    }
    googleApi.accounts.id.renderButton(buttonEl, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      shape: 'pill',
      text: ui.authMode === 'signup' ? 'signup_with' : 'signin_with',
      logo_alignment: 'left',
      width: Math.max(220, Math.min(buttonEl.clientWidth || 320, 360)),
      locale: 'pt-BR',
    });

    window.setTimeout(() => {
      const rendered = buttonEl.childElementCount > 0;
      setGoogleFallbackVisible(!rendered);
    }, 250);
  }

  let accountSnapshotTask = null;
  let lastAccountSnapshotKey = '';
  let lastAccountSnapshotAt = 0;
  let athleteOverviewFullTask = null;

  function normalizeCheckoutPlan(planId) {
    const normalized = String(planId || '').trim().toLowerCase();
    return ['athlete_plus', 'starter', 'pro', 'coach', 'performance'].includes(normalized)
      ? normalized
      : '';
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
      return {
        ...emptyAthleteOverview(),
        ...(result?.data || {}),
        detailLevel: lite ? 'lite' : 'full',
      };
    } catch {
      return {
        ...emptyAthleteOverview(),
        detailLevel: lite ? 'lite' : 'full',
      };
    }
  }

  async function loadAccountSnapshot(profile, selectedGymId) {
    const nextState = {
      coachPortal: emptyCoachPortal(),
      athleteOverview: emptyAthleteOverview(),
      admin: { overview: null, query: '' },
    };

    if (!profile?.email) {
      return nextState;
    }

    const [coachPortal, athleteOverview] = await Promise.all([
      measureAsync('account.snapshot.coach', () => loadCoachPortalSnapshot(selectedGymId)),
      measureAsync('account.snapshot.athlete', () => loadAthleteOverview({ lite: true })),
    ]);

    nextState.coachPortal = coachPortal;
    nextState.athleteOverview = athleteOverview;
    nextState.admin = { overview: null, query: '' };

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
      await patchUiState((s) => ({ ...s, athleteOverview: mergeAthleteOverviewSnapshot(athleteOverview, s?.athleteOverview) }));
      await rerender();
    } catch (error) {
      console.warn('Falha ao carregar histórico completo do atleta:', error?.message || error);
    } finally {
      athleteOverviewFullTask = null;
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
      const athleteOverview = await loadAthleteOverview();
      await patchUiState((s) => ({ ...s, athleteOverview }));
      return athleteOverview;
    } catch {
      return null;
    }
  }

  // Busca de PRs (filtra em tempo real)
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || t.id !== 'ui-prsSearch') return;
    filterPrs(root, t.value);
  });

  function filterPrs(root, query) {
    const q = String(query || '').trim().toUpperCase();
    const table = root.querySelector('#ui-prsTable');
    if (!table) return;

    const items = Array.from(table.querySelectorAll('.pr-item'));
    let visible = 0;

    for (const item of items) {
      const ex = String(item.getAttribute('data-exercise') || '').toUpperCase();
      const show = !q || ex.includes(q);
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    }

    const countEl = root.querySelector('#ui-prsCount');
    if (countEl) countEl.textContent = `${visible} PRs`;
  }

  // Clicks (delegação)
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    try {
      switch (action) {
        // ----- PDF / semana / treino -----
        case 'pdf:pick': {
          const ui = getUiState?.() || {};
          const importPolicy = await guardAthleteImport('pdf', ui);
          await setUiState({ modal: null });
          const file = await pickPdfFile();
          if (!file) return;
          const result = await window.__APP__.uploadMultiWeekPdf(file);
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao importar PDF');
          }
          consumeAthleteImport(importPolicy.benefits, 'pdf');
          toast('PDF importado');
          await rerender();
          return;
        }

        case 'media:pick': {
          const ui = getUiState?.() || {};
          const importPolicy = await guardAthleteImport('media', ui);
          await setUiState({ modal: null });
          const file = await pickUniversalFile();
          if (!file) return;

          if (typeof window.__APP__?.importFromFile !== 'function') {
            throw new Error('Importação universal não disponível');
          }

          const result = await window.__APP__.importFromFile(file);
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao importar arquivo');
          }

          consumeAthleteImport(importPolicy.benefits, 'media');
          toast('Arquivo importado');
          await rerender();
          return;
        }

        case 'pdf:clear': {
          const ok = confirm(
            '⚠️ Limpar todos os PDFs salvos?\n\n' +
            'Isso removerá todas as semanas carregadas. Esta ação não pode ser desfeita.'
          );
          if (!ok) return;

          const result = await window.__APP__.clearAllPdfs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao limpar PDFs');

          toast('Todos os PDFs removidos');
          await rerender();
          return;
        }

        case 'week:select': {
          const week = Number(el.dataset.week);
          if (!Number.isFinite(week)) return;

          await window.__APP__.selectWeek(week);
          await rerender();
          return;
        }

        case 'day:auto': {
          if (typeof window.__APP__?.resetDay === 'function') {
            const result = await window.__APP__.resetDay();
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          } else if (typeof window.__APP__?.setDay === 'function') {
            const result = await window.__APP__.setDay('');
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          }
          toast('Dia automático');
          await rerender();
          return;
        }

        case 'workout:source': {
          const source = String(el.dataset.source || 'uploaded').trim().toLowerCase();
          const nextPriority = source === 'coach' ? 'coach' : 'uploaded';

          if (typeof window.__APP__?.setPreferences !== 'function') {
            throw new Error('Alternância de treino indisponível');
          }

          const result = await window.__APP__.setPreferences({ workoutPriority: nextPriority });
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao alternar fonte do treino');
          }

          toast(nextPriority === 'coach' ? 'Mostrando treino do coach' : 'Mostrando planilha enviada');
          await rerender();
          return;
        }

        case 'workout:copy': {
          const st = window.__APP__?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = await window.__APP__.copyWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao copiar');

          toast('Treino copiado');
          return;
        }

        case 'workout:export': {
          await setUiState({ modal: null });
          const st = window.__APP__?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = window.__APP__.exportWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar');

          toast('Exportado');
          return;
        }

        case 'workout:import': {
          await setUiState({ modal: null });
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';
          
          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;
            
            try {
              const result = await window.__APP__.importWorkout(file);
              if (result?.success) {
                toast('✅ Treino importado!'); // 🔥 ADICIONA TOAST
                await rerender();
              } else {
                toast(result?.error || 'Erro ao importar');
              }
            } catch (err) {
              toast(err?.message || 'Erro ao importar');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });
          
          document.body.appendChild(input);
          input.click();
          return;
        }

        case 'backup:export': {
          if (typeof window.__APP__?.exportBackup !== 'function') {
            throw new Error('Backup não disponível nesta versão');
          }

          const result = await window.__APP__.exportBackup();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar backup');

          toast('Backup exportado');
          return;
        }

        case 'backup:import': {
          if (typeof window.__APP__?.importBackup !== 'function') {
            throw new Error('Restauração não disponível nesta versão');
          }

          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';

          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;

            try {
              const result = await window.__APP__.importBackup(file);
              if (!result?.success) {
                throw new Error(result?.error || 'Falha ao restaurar backup');
              }
              toast('Backup restaurado');
              await rerender();
            } catch (err) {
              toast(err?.message || 'Erro ao restaurar backup');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });

          document.body.appendChild(input);
          input.click();
          return;
        }

        // ----- Modais -----
        case 'modal:open': {
          const modal = el.dataset.modal || null;
          if (modal === 'auth') {
            const profile = window.__APP__?.getProfile?.()?.data || null;
            await patchUiState((s) => ({
              ...s,
              modal,
              passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '' },
            }));
            await rerender();
            await ensureGoogleSignInUi();
            hydrateAccountSnapshotInBackground(profile);
            if (modal === 'auth') root.querySelector('#auth-email')?.focus();
            return;
          } else {
            await setUiState({ modal });
          }
          await rerender();

          if (modal === 'prs') root.querySelector('#ui-prsSearch')?.focus();
          if (modal === 'auth') root.querySelector('#auth-email')?.focus();
          return;
        }

        case 'modal:close': {
          await patchUiState((s) => ({
            ...s,
            modal: null,
            passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '' },
          }));
          await rerender();
          return;
        }

        case 'exercise:help': {
          const label = String(el.dataset.exercise || '').trim();
          const directUrl = String(el.dataset.url || '').trim();
          const fallbackUrl = label
            ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label} exercise tutorial`)}` 
            : '';
          const url = directUrl || fallbackUrl;
          if (!url) throw new Error('Vídeo de execução indisponível para este movimento');

          const popup = window.open(url, '_blank', 'noopener,noreferrer');
          if (!popup) {
            window.location.href = url;
          }
          return;
        }

        case 'page:set': {
          const page = String(el.dataset.page || 'today');
          await patchUiState((s) => ({ ...s, currentPage: page }));
          await rerender();
          if (page === 'history') {
            hydrateAthleteOverviewFullInBackground();
          }
          return;
        }

        case 'auth:google-fallback': {
          if (!googlePromptClientId) {
            await ensureGoogleSignInUi();
          }
          await promptGoogleSignIn();
          return;
        }

        case 'prs:open': {
          await setUiState({ modal: 'prs' });
          await rerender();
          root.querySelector('#ui-prsSearch')?.focus();
          return;
        }

        case 'prs:close': {
          await setUiState({ modal: null });
          await rerender();
          return;
        }

        // ----- Config -----
        case 'settings:save': {
          const showLbsConversion = !!root.querySelector('#setting-showLbsConversion')?.checked;
          const showEmojis = !!root.querySelector('#setting-showEmojis')?.checked;
          const showObjectivesInWods = !!root.querySelector('#setting-showObjectives')?.checked;

          if (typeof window.__APP__?.setPreferences === 'function') {
            const corePrefsResult = await window.__APP__.setPreferences({
              showLbsConversion,
              showEmojis,
              showGoals: showObjectivesInWods,
              autoConvertLbs: showLbsConversion,
            });

            if (!corePrefsResult?.success) {
              throw new Error(corePrefsResult?.error || 'Falha ao salvar preferências');
            }
          }

          await setUiState({
            settings: { showLbsConversion, showEmojis, showObjectivesInWods },
            modal: null,
          });

          toast('Configurações salvas');
          await rerender();
          return;
        }

        case 'auth:switch': {
          const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
          await patchUiState((s) => ({
            ...s,
            authMode: mode,
            passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '' },
            signupVerification: mode === 'signup'
              ? (s.signupVerification || {})
              : {},
          }));
          await rerender();
          await ensureGoogleSignInUi();
          root.querySelector('#auth-email')?.focus();
          return;
        }

        case 'auth:signup-request-code': {
          const name = String(root.querySelector('#auth-name')?.value || '').trim();
          const email = String(root.querySelector('#auth-email')?.value || '').trim().toLowerCase();
          const password = String(root.querySelector('#auth-password')?.value || '');

          if (!name) throw new Error('Informe seu nome');
          if (!email) throw new Error('Informe seu email');
          if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');

          const result = await window.__APP__.requestSignUpVerification({ name, email, password });
          await patchUiState((s) => ({
            ...s,
            signupVerification: {
              ...(s.signupVerification || {}),
              name,
              email,
              code: result?.previewCode || '',
              previewCode: result?.previewCode || '',
              previewUrl: result?.delivery?.previewUrl || '',
              supportEmail: result?.supportEmail || '',
              deliveryStatus: result?.deliveryStatus || '',
              requestedAt: new Date().toISOString(),
            },
          }));
          toast(result?.deliveryStatus === 'preview' ? 'Código gerado em preview' : 'Código enviado para seu email');
          await rerender();
          await ensureGoogleSignInUi();
          root.querySelector('#auth-signup-code')?.focus();
          return;
        }

        case 'auth:submit': {
          const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
          const name = String(root.querySelector('#auth-name')?.value || '').trim();
          const signupVerification = getUiState?.()?.signupVerification || {};
          const email = String(root.querySelector('#auth-email')?.value || signupVerification.email || '').trim().toLowerCase();
          const password = String(root.querySelector('#auth-password')?.value || '');

          let result;
          if (mode === 'signup') {
            const code = String(root.querySelector('#auth-signup-code')?.value || signupVerification.code || signupVerification.previewCode || '').trim();
            if (!name && !signupVerification.name) throw new Error('Informe seu nome');
            if (!email) throw new Error('Informe seu email');
            if (!code) throw new Error('Informe o código enviado ao seu email');
            result = await window.__APP__.confirmSignUp({ email, code });
          } else {
            if (!email) throw new Error('Informe seu email');
            if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');
            result = await window.__APP__.signIn({ email, password });
          }

          if (!result?.token && !result?.user) {
            throw new Error('Falha ao autenticar');
          }

          const profile = result?.user || window.__APP__?.getProfile?.()?.data || null;
          await setUiState({ modal: null, authMode: 'signin', signupVerification: {} });
          toast(mode === 'signup' ? 'Conta criada' : 'Login efetuado');
          await rerender();
          hydrateAccountSnapshotInBackground(profile);
          if (await maybeResumePendingCheckout()) return;
          return;
        }

        case 'auth:reset-toggle': {
          await patchUiState((s) => ({
            ...s,
            passwordReset: {
              ...(s.passwordReset || {}),
              open: !(s.passwordReset?.open),
            },
          }));
          await rerender();
          await ensureGoogleSignInUi();
          root.querySelector('#reset-email')?.focus();
          return;
        }

        case 'auth:reset-request': {
          const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
          if (!email) throw new Error('Informe o email da conta');

          const result = await window.__APP__.requestPasswordReset({ email });
          const showDeveloperPreview = isDeveloperEmail(email);
          await patchUiState((s) => ({
            ...s,
            passwordReset: {
              ...(s.passwordReset || {}),
              open: true,
              email,
              previewCode: showDeveloperPreview ? (result?.previewCode || '') : '',
              previewUrl: showDeveloperPreview ? (result?.delivery?.previewUrl || '') : '',
              supportEmail: result?.supportEmail || '',
            },
          }));
          toast(showDeveloperPreview && result?.previewCode ? 'Código gerado' : 'Pedido de recuperação enviado');
          await rerender();
          await ensureGoogleSignInUi();
          return;
        }

        case 'auth:reset-confirm': {
          const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
          const code = String(root.querySelector('#reset-code')?.value || '').trim();
          const newPassword = String(root.querySelector('#reset-newPassword')?.value || '');

          if (!email || !code || !newPassword) {
            throw new Error('Preencha email, código e nova senha');
          }

          const result = await window.__APP__.confirmPasswordReset({ email, code, newPassword });
          if (!result?.success) throw new Error(result?.error || 'Falha ao redefinir senha');

          await patchUiState((s) => ({
            ...s,
            passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '' },
          }));
          toast('Senha atualizada');
          await rerender();
          await ensureGoogleSignInUi();
          return;
        }

        case 'auth:refresh': {
          const result = await window.__APP__.refreshSession();
          if (!result?.token && !result?.user) {
            throw new Error('Falha ao atualizar sessão');
          }
          const profile = result?.user || window.__APP__?.getProfile?.()?.data || null;
          const ui = getUiState?.() || {};
          toast('Sessão atualizada');
          await rerender();
          hydrateAccountSnapshotInBackground(profile, ui?.coachPortal?.selectedGymId || null);
          if (await maybeResumePendingCheckout()) return;
          return;
        }

        case 'billing:checkout': {
          const plan = normalizeCheckoutPlan(el.dataset.plan || 'coach') || 'coach';
          const profile = window.__APP__?.getProfile?.()?.data || null;
          if (!profile?.email || !hasCheckoutAuth()) {
            queueCheckoutIntent(plan, {
              source: 'app',
              returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
            });
            await patchUiState((s) => ({ ...s, modal: 'auth', authMode: 'signin' }));
            toast('Entre para continuar no checkout');
            await rerender();
            return;
          }
          await window.__APP__.openCheckout(plan);
          return;
        }

        case 'billing:activate-local': {
          const profile = window.__APP__?.getProfile?.()?.data || null;
          if (!isDeveloperProfile(profile)) {
            throw new Error('Recurso restrito ao ambiente de desenvolvimento');
          }

          const plan = el.dataset.plan || 'coach';
          await window.__APP__.activateMockSubscription(plan);
          const ui = getUiState?.() || {};
          const snapshot = await loadAccountSnapshot(profile, ui?.coachPortal?.selectedGymId || null);
          await patchUiState((s) => ({
            ...s,
            ...snapshot,
            athleteOverview: mergeAthleteOverviewSnapshot(snapshot?.athleteOverview, s?.athleteOverview),
          }));
          toast('Plano Coach local ativado');
          await rerender();
          return;
        }

        case 'auth:signout': {
          await window.__APP__.signOut();
          await setUiState({ modal: null, authMode: 'signin', coachPortal: emptyCoachPortal(), athleteOverview: emptyAthleteOverview(), admin: { overview: null, query: '' } });
          toast('Sessão encerrada');
          await rerender();
          return;
        }

        case 'auth:sync-push': {
          const result = await window.__APP__.syncPush();
          if (!result?.success) throw new Error(result?.error || 'Falha ao enviar sync');
          toast('Sync enviado');
          await rerender();
          return;
        }

        case 'auth:sync-pull': {
          const result = await window.__APP__.syncPull();
          if (!result?.success) throw new Error(result?.error || 'Falha ao baixar sync');
          toast('Sync atualizado');
          await rerender();
          return;
        }

        case 'admin:refresh': {
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await window.__APP__.getAdminOverview({ q: query, limit: 25 });
          await setUiState({ admin: { overview: result?.data || null, query } });
          toast('Painel admin atualizado');
          await rerender();
          return;
        }

        case 'admin:activate-plan': {
          const userId = Number(el.dataset.userId);
          const planId = String(el.dataset.planId || '').trim().toLowerCase();
          if (!Number.isFinite(userId) || userId <= 0) {
            throw new Error('Usuário inválido');
          }
          if (!['athlete_plus', 'starter', 'pro', 'performance'].includes(planId)) {
            throw new Error('Plano inválido');
          }

          const confirmed = confirm(`Ativar plano ${planId} para este usuário por 30 dias?`);
          if (!confirmed) return;

          await window.__APP__.activateCoachSubscription(userId, planId, 30);
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await window.__APP__.getAdminOverview({ q: query, limit: 25 });
          await setUiState({ admin: { overview: result?.data || null, query } });
          toast(`Plano ${planId} ativado`);
          await rerender();
          return;
        }

        case 'wod:toggle': {
          const lineId = el.dataset.lineId;
          if (!lineId) return;

          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };
            wod.done = wod.done || {};
            wod.done[lineId] = !wod.done[lineId];
            wod.activeLineId = lineId;
            st.wod[key] = wod;
            return st;
          });

          await rerender();
          scrollToLine(root, lineId);
          return;
        }

        case 'wod:next': {
          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };
            wod.done = wod.done || {};

            const ids = getLineIdsFromDOM(root);
            if (!ids.length) return st;

            const current = wod.activeLineId;
            if (current && ids.includes(current)) wod.done[current] = true;

            const nextId = pickNextId(ids, wod.done, current);
            wod.activeLineId = nextId;

            st.wod[key] = wod;
            return st;
          });

          await rerender();
          const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
          if (id) scrollToLine(root, id);
          return;
        }

        case 'wod:prev': {
          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };

            const ids = getLineIdsFromDOM(root);
            if (!ids.length) return st;

            const current = wod.activeLineId;
            const prevId = pickPrevId(ids, current);
            wod.activeLineId = prevId;

            st.wod[key] = wod;
            return st;
          });

          await rerender();
          const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
          if (id) scrollToLine(root, id);
          return;
        }

        // ----- PRs -----
        case 'prs:add': {
          const nameEl = root.querySelector('#ui-prsNewName');
          const valueEl = root.querySelector('#ui-prsNewValue');

          const rawName = (nameEl?.value || '').trim();
          const value = Number(valueEl?.value);

          if (!rawName) throw new Error('Informe o nome do exercício');
          if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um PR válido');

          const exercise = rawName.toUpperCase();
          const result = await window.__APP__.addPR(exercise, value);
          if (!result?.success) throw new Error(result?.error || 'Falha ao adicionar PR');
          await syncAthletePrIfAuthenticated(exercise, value);

          if (nameEl) nameEl.value = '';
          if (valueEl) valueEl.value = '';

          toast('PR salvo');
          await rerender();
          return;
        }

        case 'prs:save': {
          const ex = el.dataset.exercise;
          if (!ex) return;

          const input = root.querySelector(
            `input[data-action="prs:editValue"][data-exercise="${cssEscape(ex)}"]`
          );
          const value = Number(input?.value);

          if (!Number.isFinite(value) || value <= 0) throw new Error('PR inválido');

          const result = await window.__APP__.addPR(ex, value);
          if (!result?.success) throw new Error(result?.error || 'Falha ao salvar PR');
          await syncAthletePrIfAuthenticated(ex, value);

          toast('PR atualizado');
          await rerender();
          return;
        }

        case 'prs:remove': {
          const ex = el.dataset.exercise;
          if (!ex) return;

          const ok = confirm(`Remover PR de "${ex}"?`);
          if (!ok) return;

          const result = await window.__APP__.removePR(ex);
          if (!result?.success) throw new Error(result?.error || 'Falha ao remover PR');
          const currentPrs = window.__APP__?.getState?.()?.prs || {};
          if (window.__APP__?.getProfile?.()?.data) {
            await window.__APP__?.syncAthletePrSnapshot?.(currentPrs);
            const athleteOverview = await loadAthleteOverview();
            await patchUiState((s) => ({ ...s, athleteOverview }));
          }

          toast('PR removido');
          await rerender();
          return;
        }

        case 'prs:import-file': {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';

          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;

            try {
              const text = await file.text();
              const result = window.__APP__.importPRs(text);
              if (!result?.success) throw new Error(result?.error || 'Falha ao importar');

              toast(`${result.imported} PRs importados de ${file.name}`);
              await rerender();
            } catch (err) {
              toast(err?.message || 'Erro ao ler arquivo');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });

          document.body.appendChild(input);
          input.click();
          return;
        }

        case 'prs:export': {
          const result = window.__APP__.exportPRs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar PRs');
          toast('PRs exportados');
          return;
        }

        case 'prs:import': {
          const json = prompt('Cole aqui o JSON de PRs (ex: {"BACK SQUAT":120})');
          if (!json) return;

          const result = window.__APP__.importPRs(json);
          if (!result?.success) throw new Error(result?.error || 'Falha ao importar PRs');

          toast('PRs importados');
          await rerender();
          return;
        }

        case 'timer:start': {
          const seconds = Number(el.dataset.seconds);
          if (!seconds || seconds <= 0) return;
          
          startRestTimer(seconds, toast);
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

  // Dia manual (select)
  root.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-action="day:set"]');
    if (!el) return;

    const dayName = el.value;
    if (!dayName) return;

    try {
      const result = await window.__APP__.setDay(dayName);
      if (!result?.success) throw new Error(result?.error || 'Falha ao definir dia');

      toast(`Dia manual: ${result.day || dayName}`);
      el.value = '';
      await rerender();
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  queueMicrotask(async () => {
    try {
      await maybePrimeCheckoutIntentFromUrl();
      await ensureGoogleSignInUi();
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
      await setUiState({ modal: null });
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
    if (target.tagName === 'BUTTON' || target.type === 'button') return;
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
      'text/plain',
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/*',
      'video/*',
      '.txt',
      '.md',
      '.csv',
      '.json',
      '.xls',
      '.xlsx',
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
