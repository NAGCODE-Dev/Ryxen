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
import { getAppBridge } from '../app/bridge.js';
import { handleAthleteAccountHistoryAction } from '../../apps/athlete/actions/accountHistoryActions.js';
import { handleAthleteBillingAction } from '../../apps/athlete/actions/billingActions.js';
import { handleAthleteAuthAction, handleAthleteAuthEnterKey } from '../../apps/athlete/actions/authActions.js';
import {
  handleAthleteModalAction,
  handleAthleteModalEscapeKey,
  handleAthleteModalOverlayClick,
} from '../../apps/athlete/actions/modalActions.js';
import { handleAthleteTodayAction, handleAthleteTodayChange } from '../../apps/athlete/actions/todayActions.js';
import {
  explainImportFailure,
  formatBytes,
  idleImportStatus,
  IMAGE_COMPRESS_THRESHOLD_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_TARGET_MAX_BYTES,
  IMPORT_HARD_MAX_BYTES,
  pickJsonFile,
  pickPdfFile,
  pickUniversalFile,
  prepareImportFileForClientUse,
} from '../../apps/athlete/services/importFiles.js';
import {
  cssEscape,
  getActiveLineIdFromUi,
  getLineIdsFromDOM,
  pickNextId,
  pickPrevId,
  scrollToLine,
  startRestTimer,
  workoutKeyFromAppState,
} from '../../apps/athlete/services/workoutUi.js';
import {
  createEmptyAthleteOverviewState,
  createEmptyCoachPortalState,
} from '../../apps/athlete/uiState.js';
import {
  maybePrimeCheckoutIntentFromUrl,
  maybeResumePendingCheckout,
  normalizeCheckoutPlan,
} from '../../apps/athlete/services/checkoutFlow.js';
import { createAthleteHydrationBindings } from '../../apps/athlete/services/athleteHydration.js';

export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');

  let googleScriptPromise = null;
  let googleInitializedClientId = '';

  const readAppState = () => {
    try {
      if (getAppBridge()?.getStateSnapshot) return getAppBridge().getStateSnapshot();
      if (getAppBridge()?.getState) return getAppBridge().getState();
      return {};
    } catch {
      return {};
    }
  };

  const renderUi = async () => {
    if (typeof rerender === 'function') await rerender();
  };

  async function finalizeUiChange({
    render = true,
    toastMessage = '',
    ensureGoogle = false,
    focusSelector = '',
  } = {}) {
    if (toastMessage) toast(toastMessage);
    if (render) await renderUi();
    if (ensureGoogle) await ensureGoogleSignInUi();
    if (focusSelector) root.querySelector(focusSelector)?.focus();
  }

  async function applyUiState(next, options = {}) {
    await setUiState(next);
    await finalizeUiChange(options);
  }

  async function applyUiPatch(updater, options = {}) {
    await patchUiState(updater);
    await finalizeUiChange(options);
  }

  function resolveAthleteBenefits(uiState, accessContext = null) {
    const overviewBenefits = uiState?.athleteOverview?.athleteBenefits || null;
    const accessBenefits = accessContext?.data?.athleteBenefits || accessContext?.athleteBenefits || null;
    return normalizeAthleteBenefits(overviewBenefits || accessBenefits || null);
  }

  function isNativeAppRuntime() {
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
      const protocol = String(window.location?.protocol || '').toLowerCase();
      return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
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
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    if (!navigator.onLine) {
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    if (isNativeAppRuntime()) {
      shell.style.display = '';
      shell.innerHTML = `
        <button class="btn-secondary auth-googleNativeButton auth-googleCta" data-action="auth:google-redirect" type="button">
          <span class="auth-googleMark" aria-hidden="true">G</span>
          <span>Continuar com Google</span>
        </button>
      `;
      return;
    }

    const googleApi = await loadGoogleScript();
    if (!googleApi?.accounts?.id) {
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
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
            await applyUiState(
              { modal: null, authMode: 'signin' },
              { toastMessage: 'Login com Google efetuado' },
            );
            const currentPage = getUiState?.()?.currentPage || 'today';
            if (shouldHydratePage(currentPage)) {
              hydratePage(signedProfile, currentPage, null);
            }
            if (await resumePendingCheckout()) return;
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

  function getImportStatusState() {
    return getUiState?.()?.importStatus || {};
  }

  function isImportBusy() {
    return !!getImportStatusState()?.active;
  }

  async function measureAsync(name, fn, meta = {}) {
    const startedAt = performance.now();
    try {
      return await fn();
    } finally {
      recordPerfMetric(name, Number((performance.now() - startedAt).toFixed(1)), meta);
    }
  }

  const hydration = createAthleteHydrationBindings({
    getUiState,
    patchUiState,
    rerender: renderUi,
    measureAsync,
    emptyCoachPortal: createEmptyCoachPortalState,
    emptyAthleteOverview: createEmptyAthleteOverviewState,
    getAppBridge,
  });
  const {
    shouldHydratePage,
    invalidateHydrationCache,
    hydratePage,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
    syncAthletePrIfAuthenticated,
  } = hydration;
  const resumePendingCheckout = () => maybeResumePendingCheckout({
    consumeCheckoutIntent,
    hasCheckoutAuth,
    getAppBridge,
    toast,
    queueCheckoutIntent,
  });

  // Busca de PRs (filtra em tempo real)
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || t.id !== 'ui-prsSearch') return;
    filterPrs(root, t.value);
  });

  root.addEventListener('keydown', async (e) => {
    handleAthleteAuthEnterKey(e, {
      root,
      getUiState,
    });
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
        default: {
          const handledByAthleteModal = await handleAthleteModalAction(action, {
            element: el,
            toast,
            getUiState,
            applyUiState,
            applyUiPatch,
            isImportBusy,
          });
          if (handledByAthleteModal) return;

          const handledByAthleteAuth = await handleAthleteAuthAction(action, {
            element: el,
            root,
            getUiState,
            applyUiState,
            applyUiPatch,
            getAppBridge,
            invalidateHydrationCache,
            shouldHydratePage,
            hydratePage,
            maybeResumePendingCheckout: resumePendingCheckout,
            isDeveloperEmail,
          });
          if (handledByAthleteAuth) return;

          const handledByAthleteBilling = await handleAthleteBillingAction(action, {
            element: el,
            getUiState,
            applyUiPatch,
            finalizeUiChange,
            hydratePage,
            invalidateHydrationCache,
            getAppBridge,
            normalizeCheckoutPlan,
            hasCheckoutAuth,
            queueCheckoutIntent,
            isDeveloperProfile,
          });
          if (handledByAthleteBilling) return;

          const handledByAthletePage = await handleAthleteAccountHistoryAction(action, {
            element: el,
            root,
            getUiState,
            applyUiState,
            applyUiPatch,
            finalizeUiChange,
            hydratePage,
            shouldHydratePage,
            invalidateHydrationCache,
            getAppBridge,
            maybeResumePendingCheckout: resumePendingCheckout,
            emptyCoachPortal: createEmptyCoachPortalState,
            emptyAthleteOverview: createEmptyAthleteOverviewState,
          });
          if (handledByAthletePage) return;

          const handledByAthleteToday = await handleAthleteTodayAction(action, {
            element: el,
            root,
            toast,
            getUiState,
            applyUiState,
            applyUiPatch,
            finalizeUiChange,
            renderUi,
            setUiState,
            getAppBridge,
            readAppState,
            isImportBusy,
            idleImportStatus,
            guardAthleteImport,
            prepareImportFileForClientUse,
            pickJsonFile,
            pickPdfFile,
            pickUniversalFile,
            explainImportFailure,
            formatBytes,
            IMPORT_HARD_MAX_BYTES,
            IMAGE_COMPRESS_THRESHOLD_BYTES,
            IMAGE_TARGET_MAX_BYTES,
            IMAGE_MAX_DIMENSION,
            workoutKeyFromAppState,
            getActiveLineIdFromUi,
            getLineIdsFromDOM,
            pickNextId,
            pickPrevId,
            scrollToLine,
            syncAthletePrIfAuthenticated,
            invalidateHydrationCache,
            hydrateAthleteSummary,
            hydrateAthleteResultsBlock,
            startRestTimer,
            consumeAthleteImport,
          });
          if (handledByAthleteToday) return;
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
    await handleAthleteTodayChange(e, {
      root,
      toast,
      applyUiPatch,
      finalizeUiChange,
      getAppBridge,
    });
  });

  queueMicrotask(async () => {
    try {
      await maybePrimeCheckoutIntentFromUrl({
        getAppBridge,
        hasCheckoutAuth,
        queueCheckoutIntent,
        normalizeCheckoutPlan,
        maybeResumePendingCheckout: resumePendingCheckout,
        applyUiPatch,
      });
      await ensureGoogleSignInUi();
      if (peekCheckoutIntent() && hasCheckoutAuth() && getAppBridge()?.getProfile?.()?.data?.email) {
        await resumePendingCheckout();
      }
    } catch (error) {
      console.warn('Falha ao preparar checkout pendente:', error?.message || error);
    }
  });

  // Clique fora do modal fecha
  root.addEventListener('click', async (e) => {
    await handleAthleteModalOverlayClick(e, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });

  // Esc fecha modal
  document.addEventListener('keydown', async (e) => {
    await handleAthleteModalEscapeKey(e, {
      toast,
      getUiState,
      applyUiPatch,
      isImportBusy,
    });
  });

  root.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target?.closest?.('#ui-authForm')) return;
    if (target.tagName === 'BUTTON' || target.type === 'button') return;
    e.preventDefault();

    handleAthleteAuthEnterKey(e, {
      root,
      getUiState,
    });
  });
}
