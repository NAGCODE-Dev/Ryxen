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
import { createHydrationController } from '../app/hydration.js';
import { getAppBridge } from '../app/bridge.js';

export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');

  const IMPORT_HARD_MAX_BYTES = 50 * 1024 * 1024;
  const IMAGE_COMPRESS_THRESHOLD_BYTES = 8 * 1024 * 1024;
  const IMAGE_TARGET_MAX_BYTES = 4 * 1024 * 1024;
  const IMAGE_MAX_DIMENSION = 2200;

  let googleScriptPromise = null;
  let googleInitializedClientId = '';

  const emptyCoachPortal = () => ({
    subscription: null,
    entitlements: [],
    gymAccess: [],
    gyms: [],
    selectedGymId: null,
    status: 'idle',
    error: '',
  });

  const emptyAthleteOverview = () => ({
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
  });

  function resolveAthleteBenefits(uiState, accessContext = null) {
    const overviewBenefits = uiState?.athleteOverview?.athleteBenefits || null;
    const accessBenefits = accessContext?.data?.athleteBenefits || accessContext?.athleteBenefits || null;
    return normalizeAthleteBenefits(overviewBenefits || accessBenefits || null);
  }

  function isNativeAppRuntime() {
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
      const protocol = String(window.location?.protocol || '').toLowerCase();
      return protocol === 'capacitor:' || protocol === 'file:';
    } catch {
      return false;
    }
  }

  async function loadGoogleScript() {
    if (!navigator.onLine) {
      throw new Error('Google Sign-In indisponível offline');
    }
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

    const profile = getAppBridge()?.getProfile?.()?.data || null;
    if (profile?.email) {
      shell.style.display = 'none';
      return;
    }

    const runtime = getAppBridge()?.getRuntimeConfig?.()?.data || {};
    const clientId = String(runtime?.auth?.googleClientId || '').trim();
    if (!clientId) {
      shell.innerHTML = '<p class="account-hint auth-googleHint">Google Sign-In não configurado.</p>';
      return;
    }
    if (!navigator.onLine) {
      shell.innerHTML = '<p class="account-hint auth-googleHint">Google Sign-In disponível quando houver internet.</p>';
      return;
    }
    if (isNativeAppRuntime()) {
      shell.innerHTML = `
        <button class="btn-secondary auth-googleNativeButton" data-action="auth:google-redirect" type="button">
          Entrar com Google
        </button>
        <p class="account-hint auth-googleHint">No app Android, o login do Google abre no navegador para concluir com segurança.</p>
      `;
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
            const result = await getAppBridge()?.signInWithGoogle?.({ credential: response.credential });
            if (!result?.token && !result?.user) {
              throw new Error('Falha ao autenticar com Google');
            }

            const signedProfile = result?.user || getAppBridge()?.getProfile?.()?.data || null;
            invalidateHydrationCache();
            await setUiState({ modal: null, authMode: 'signin' });
            toast('Login com Google efetuado');
            await rerender();
            const currentPage = getUiState?.()?.currentPage || 'today';
            if (shouldHydratePage(currentPage)) {
              hydratePage(signedProfile, currentPage, null);
            }
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
  }

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
      await getAppBridge()?.openCheckout?.(pending.planId);
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

      if (hasCheckoutAuth() && getAppBridge()?.getProfile?.()?.data?.email) {
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
    const profile = getAppBridge()?.getProfile?.()?.data || null;
    const accessContext = profile?.email ? await getAppBridge()?.getAccessContext?.() : null;
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
      if (durationMs >= 1500) {
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

  const hydration = createHydrationController({
    getUiState,
    patchUiState,
    rerender,
    measureAsync,
    emptyCoachPortal,
    emptyAthleteOverview,
    getProfile: () => getAppBridge()?.getProfile?.()?.data || null,
    getSubscriptionStatus: () => getAppBridge()?.getSubscriptionStatus?.(),
    getEntitlements: () => getAppBridge()?.getEntitlements?.(),
    getMyGyms: () => getAppBridge()?.getMyGyms?.(),
    getAthleteSummary: () => getAppBridge()?.getAthleteSummary?.(),
    getAthleteResultsSummary: () => getAppBridge()?.getAthleteResultsSummary?.(),
    getAthleteWorkoutsRecent: () => getAppBridge()?.getAthleteWorkoutsRecent?.(),
  });
  const {
    shouldHydratePage,
    invalidateHydrationCache,
    hydratePage,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
  } = hydration;

  async function syncAthletePrIfAuthenticated() {
    const profile = getAppBridge()?.getProfile?.()?.data || null;
    if (!profile?.email) return null;

    try {
      const currentPrs = getAppBridge()?.getState?.()?.prs || {};
      const syncResult = await getAppBridge()?.syncAthletePrSnapshot?.(currentPrs);
      const syncQueued = Boolean(syncResult?.queued) || !navigator.onLine;
      if (!syncQueued) {
        invalidateHydrationCache({ coach: false, athlete: true, account: true });
        await hydrateAthleteSummary(profile, { force: true });
        await hydrateAthleteResultsBlock(profile, { force: true });
      }
      return getUiState?.()?.athleteOverview || null;
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
          const selectedFile = await pickPdfFile();
          const file = await prepareImportFileForClientUse(selectedFile, {
            hardMaxBytes: IMPORT_HARD_MAX_BYTES,
            imageCompressThresholdBytes: IMAGE_COMPRESS_THRESHOLD_BYTES,
            imageTargetMaxBytes: IMAGE_TARGET_MAX_BYTES,
            imageMaxDimension: IMAGE_MAX_DIMENSION,
          });
          if (!file) return;
          const result = await getAppBridge().uploadMultiWeekPdf(file);
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
          const selectedFile = await pickUniversalFile();
          const file = await prepareImportFileForClientUse(selectedFile, {
            hardMaxBytes: IMPORT_HARD_MAX_BYTES,
            imageCompressThresholdBytes: IMAGE_COMPRESS_THRESHOLD_BYTES,
            imageTargetMaxBytes: IMAGE_TARGET_MAX_BYTES,
            imageMaxDimension: IMAGE_MAX_DIMENSION,
          });
          if (!file) return;

          if (typeof getAppBridge()?.importFromFile !== 'function') {
            throw new Error('Importação universal não disponível');
          }

          const result = await getAppBridge().importFromFile(file);
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao importar arquivo');
          }

          if (selectedFile && file !== selectedFile) {
            toast(`Imagem reduzida de ${formatBytes(selectedFile.size)} para ${formatBytes(file.size)}`);
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

          const result = await getAppBridge().clearAllPdfs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao limpar PDFs');

          toast('Todos os PDFs removidos');
          await rerender();
          return;
        }

        case 'week:select': {
          const week = Number(el.dataset.week);
          if (!Number.isFinite(week)) return;

          await getAppBridge().selectWeek(week);
          await rerender();
          return;
        }

        case 'day:auto': {
          if (typeof getAppBridge()?.resetDay === 'function') {
            const result = await getAppBridge().resetDay();
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          } else if (typeof getAppBridge()?.setDay === 'function') {
            const result = await getAppBridge().setDay('');
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          }
          toast('Dia automático');
          await rerender();
          return;
        }

        case 'workout:source': {
          const source = String(el.dataset.source || 'uploaded').trim().toLowerCase();
          const nextPriority = source === 'coach' ? 'coach' : 'uploaded';

          if (typeof getAppBridge()?.setPreferences !== 'function') {
            throw new Error('Alternância de treino indisponível');
          }

          const result = await getAppBridge().setPreferences({ workoutPriority: nextPriority });
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao alternar fonte do treino');
          }

          toast(nextPriority === 'coach' ? 'Mostrando treino do coach' : 'Mostrando planilha enviada');
          await rerender();
          return;
        }

        case 'workout:copy': {
          const st = getAppBridge()?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = await getAppBridge().copyWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao copiar');

          toast('Treino copiado');
          return;
        }

        case 'workout:export': {
          await setUiState({ modal: null });
          const st = getAppBridge()?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = getAppBridge().exportWorkout();
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
              const result = await getAppBridge().importWorkout(file);
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
          if (typeof getAppBridge()?.exportBackup !== 'function') {
            throw new Error('Backup não disponível nesta versão');
          }

          const result = await getAppBridge().exportBackup();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar backup');

          toast('Backup exportado');
          return;
        }

        case 'backup:import': {
          if (typeof getAppBridge()?.importBackup !== 'function') {
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
              const result = await getAppBridge().importBackup(file);
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
            await patchUiState((s) => ({
              ...s,
              modal,
              passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '' },
            }));
            await rerender();
            await ensureGoogleSignInUi();
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
          if (page === 'account' || page === 'history') {
            const profile = getAppBridge()?.getProfile?.()?.data || null;
            const ui = getUiState?.() || {};
            hydratePage(profile, page, ui?.coachPortal?.selectedGymId || null);
          }
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

          if (typeof getAppBridge()?.setPreferences === 'function') {
            const corePrefsResult = await getAppBridge().setPreferences({
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

        case 'auth:google-redirect': {
          await getAppBridge()?.startGoogleSignInRedirect?.({
            returnTo: `${window.location.pathname}${window.location.search}`,
          });
          return;
        }

        case 'auth:signup-request-code': {
          const name = String(root.querySelector('#auth-name')?.value || '').trim();
          const email = String(root.querySelector('#auth-email')?.value || '').trim().toLowerCase();
          const password = String(root.querySelector('#auth-password')?.value || '');

          if (!name) throw new Error('Informe seu nome');
          if (!email) throw new Error('Informe seu email');
          if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');

          const result = await getAppBridge().requestSignUpVerification({ name, email, password });
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
            result = await getAppBridge().confirmSignUp({ email, code });
          } else {
            if (!email) throw new Error('Informe seu email');
            if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');
            result = await getAppBridge().signIn({ email, password });
          }

          if (!result?.token && !result?.user) {
            throw new Error('Falha ao autenticar');
          }

          const profile = result?.user || getAppBridge()?.getProfile?.()?.data || null;
          invalidateHydrationCache();
          await setUiState({ modal: null, authMode: 'signin', signupVerification: {} });
          toast(mode === 'signup' ? 'Conta criada' : 'Login efetuado');
          await rerender();
          const currentPage = getUiState?.()?.currentPage || 'today';
          if (shouldHydratePage(currentPage)) {
            hydratePage(profile, currentPage, null);
          }
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
          const currentReset = getUiState?.()?.passwordReset || {};
          const cooldownUntil = Number(currentReset?.cooldownUntil || 0);
          const remainingMs = cooldownUntil - Date.now();
          if (remainingMs > 0) {
            throw new Error(`Aguarde ${Math.ceil(remainingMs / 1000)}s para gerar outro código`);
          }

          const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
          if (!email) throw new Error('Informe o email da conta');

          const result = await getAppBridge().requestPasswordReset({ email });
          const showDeveloperPreview = isDeveloperEmail(email);
          const requestedAt = Date.now();
          await patchUiState((s) => ({
            ...s,
            passwordReset: {
              ...(s.passwordReset || {}),
              open: true,
              email,
              code: '',
              requestedAt: new Date(requestedAt).toISOString(),
              deliveryStatus: result?.deliveryStatus || 'sent',
              message: showDeveloperPreview && result?.previewCode
                ? 'Código gerado em preview.'
                : 'Código enviado para seu email. Use o mais recente.',
              cooldownUntil: requestedAt + 30_000,
              previewCode: showDeveloperPreview ? (result?.previewCode || '') : '',
              previewUrl: showDeveloperPreview ? (result?.delivery?.previewUrl || '') : '',
              supportEmail: result?.supportEmail || '',
            },
          }));
          toast(showDeveloperPreview && result?.previewCode ? 'Código gerado' : 'Código enviado para seu email');
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

          const result = await getAppBridge().confirmPasswordReset({ email, code, newPassword });
          if (!result?.success) throw new Error(result?.error || 'Falha ao redefinir senha');

          await patchUiState((s) => ({
            ...s,
            passwordReset: {
              open: false,
              email: '',
              code: '',
              previewCode: '',
              previewUrl: '',
              supportEmail: '',
              message: '',
              requestedAt: '',
              cooldownUntil: 0,
              deliveryStatus: '',
            },
          }));
          toast('Senha atualizada');
          await rerender();
          await ensureGoogleSignInUi();
          return;
        }

        case 'auth:refresh': {
          const result = await getAppBridge().refreshSession();
          if (!result?.token && !result?.user) {
            throw new Error('Falha ao atualizar sessão');
          }
          const profile = result?.user || getAppBridge()?.getProfile?.()?.data || null;
          const ui = getUiState?.() || {};
          invalidateHydrationCache();
          toast('Sessão atualizada');
          await rerender();
          if (shouldHydratePage(ui?.currentPage || 'today')) {
            hydratePage(profile, ui?.currentPage || 'today', ui?.coachPortal?.selectedGymId || null);
          }
          if (await maybeResumePendingCheckout()) return;
          return;
        }

        case 'billing:checkout': {
          const plan = normalizeCheckoutPlan(el.dataset.plan || 'coach') || 'coach';
          const profile = getAppBridge()?.getProfile?.()?.data || null;
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
          await getAppBridge().openCheckout(plan);
          return;
        }

        case 'billing:activate-local': {
          const profile = getAppBridge()?.getProfile?.()?.data || null;
          if (!isDeveloperProfile(profile)) {
            throw new Error('Recurso restrito ao ambiente de desenvolvimento');
          }

          const plan = el.dataset.plan || 'coach';
          await getAppBridge().activateMockSubscription(plan);
          invalidateHydrationCache({ coach: true, athlete: false, account: true });
          const ui = getUiState?.() || {};
          await hydratePage(profile, 'account', ui?.coachPortal?.selectedGymId || null, { force: true });
          toast('Plano Coach local ativado');
          return;
        }

        case 'auth:signout': {
          await getAppBridge().signOut();
          invalidateHydrationCache();
          await setUiState({ modal: null, authMode: 'signin', coachPortal: emptyCoachPortal(), athleteOverview: emptyAthleteOverview(), admin: { overview: null, query: '' } });
          toast('Sessão encerrada');
          await rerender();
          return;
        }

        case 'admin:refresh': {
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
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

          await getAppBridge().activateCoachSubscription(userId, planId, 30);
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
          await setUiState({ admin: { overview: result?.data || null, query } });
          toast(`Plano ${planId} ativado`);
          await rerender();
          return;
        }

        case 'admin:request-delete': {
          const userId = Number(el.dataset.userId);
          const userEmail = String(el.dataset.userEmail || '').trim();
          if (!Number.isFinite(userId) || userId <= 0) {
            throw new Error('Usuário inválido');
          }

          const confirmed = confirm(`Solicitar exclusão da conta ${userEmail || `#${userId}`}?\n\nUm email será enviado. Se a pessoa não responder em até 15 dias, a conta e os dados serão excluídos automaticamente.`);
          if (!confirmed) return;

          const deletion = await getAppBridge().requestAccountDeletion(userId);
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
          await setUiState({ admin: { overview: result?.data || null, query } });
          toast(deletion?.data?.reused ? 'Exclusão já estava pendente' : 'Email de exclusão enviado');
          await rerender();
          return;
        }

        case 'admin:delete-now': {
          const userId = Number(el.dataset.userId);
          const userEmail = String(el.dataset.userEmail || '').trim();
          if (!Number.isFinite(userId) || userId <= 0) {
            throw new Error('Usuário inválido');
          }

          const confirmed = confirm(`Excluir agora a conta ${userEmail || `#${userId}`}?\n\nIsso remove a conta e os dados derivados permanentemente.`);
          if (!confirmed) return;

          await getAppBridge().deleteAccountNow(userId);
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
          await setUiState({ admin: { overview: result?.data || null, query } });
          toast('Conta excluída permanentemente');
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
          const result = await getAppBridge().addPR(exercise, value);
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

          const result = await getAppBridge().addPR(ex, value);
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

          const result = await getAppBridge().removePR(ex);
          if (!result?.success) throw new Error(result?.error || 'Falha ao remover PR');
          const currentPrs = getAppBridge()?.getState?.()?.prs || {};
          if (getAppBridge()?.getProfile?.()?.data) {
            await getAppBridge()?.syncAthletePrSnapshot?.(currentPrs);
            const profile = getAppBridge()?.getProfile?.()?.data || null;
            invalidateHydrationCache({ coach: false, athlete: true, account: true });
            await hydrateAthleteSummary(profile, { force: true });
            await hydrateAthleteResultsBlock(profile, { force: true });
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
              const result = getAppBridge().importPRs(text);
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
          const result = getAppBridge().exportPRs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar PRs');
          toast('PRs exportados');
          return;
        }

        case 'prs:import': {
          const json = prompt('Cole aqui o JSON de PRs (ex: {"BACK SQUAT":120})');
          if (!json) return;

          const result = getAppBridge().importPRs(json);
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
      const result = await getAppBridge().setDay(dayName);
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
      if (peekCheckoutIntent() && hasCheckoutAuth() && getAppBridge()?.getProfile?.()?.data?.email) {
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
  const s = getAppBridge()?.getState?.() || {};
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

async function prepareImportFileForClientUse(file, {
  hardMaxBytes,
  imageCompressThresholdBytes,
  imageTargetMaxBytes,
  imageMaxDimension,
}) {
  if (!file) return null;

  if (file.size <= hardMaxBytes && (!isImageFile(file) || file.size <= imageCompressThresholdBytes)) {
    return file;
  }

  if (isImageFile(file)) {
    const compressed = await compressImageFile(file, {
      targetMaxBytes: Math.min(imageTargetMaxBytes, hardMaxBytes),
      maxDimension: imageMaxDimension,
    });
    if (compressed.size <= hardMaxBytes) {
      return compressed;
    }
  }

  throw new Error(
    `Arquivo acima do limite de ${formatBytes(hardMaxBytes)}. Reduza o arquivo antes de importar.`,
  );
}

function isImageFile(file) {
  return String(file?.type || '').toLowerCase().startsWith('image/');
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

async function compressImageFile(file, { targetMaxBytes, maxDimension }) {
  const image = await loadImageFromFile(file);
  const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Não foi possível preparar a imagem para importação');
  }
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob.size > targetMaxBytes && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  const nextName = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
  return new File([blob], nextName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler a imagem selecionada'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível reduzir a imagem'));
        return;
      }
      resolve(blob);
    }, type, quality);
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
