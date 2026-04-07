import { init } from '../../src/app.js';
import { getAppBridge } from '../../src/app/bridge.js';
import { initAuxiliaryBrowserLayer } from '../../src/app/auxiliaryBrowser.js';
import { initNativeBackHandling } from '../../src/app/nativeBack.js';
import { mountConsentBanner } from '../../src/ui/consent.js';
import { isDeveloperProfile } from '../../src/core/utils/devAccess.js';
import { applyAuthRedirectFromLocation, applyAuthRedirectFromUrl } from '../../src/core/services/authService.js';
import { renderDebugPlaceholder, renderError } from './bootstrapDiagnostics.js';
import { getCapacitorAppPlugin, wait } from './bootstrapEnvironment.js';
import {
  registerServiceWorker,
  reportAuthRedirectOutcome,
  reportBootstrapFailure,
  setupErrorMonitoring,
  setupGlobalTelemetryHandlers,
  setupVercelObservability,
  syncErrorMonitorUser,
  trackBootstrapSuccess,
} from './bootstrapObservability.js';

export async function runAthleteBootstrapFlow() {
  initPreBootstrapLayers();

  const nativeAuthRedirect = await setupNativeAuthRedirects();
  if (nativeAuthRedirect?.handled) return;

  initPostNativeLayers();
  const authRedirect = applyAuthRedirectFromLocation();
  const initResult = await initApplication();
  if (!initResult.success) return;

  finalizeInit(authRedirect);
  if (maybeRenderDeveloperDebug()) return;

  await mountAthleteUi();
}

function initPreBootstrapLayers() {
  initAuxiliaryBrowserLayer();
  initNativeBackHandling();
}

function initPostNativeLayers() {
  setupErrorMonitoring();
  setupVercelObservability();
  setupGlobalTelemetryHandlers();
  registerServiceWorker();
  mountConsentBanner();
}

async function initApplication() {
  const result = await init();
  if (!result?.success) {
    reportBootstrapFailure(result?.error || 'init_failed');
    renderError(result?.error || 'Erro desconhecido');
    return { success: false };
  }
  return { success: true, result };
}

function finalizeInit(authRedirect) {
  trackBootstrapSuccess();
  reportAuthRedirectOutcome(authRedirect);
  syncErrorMonitorUser(getAppBridge()?.getProfile?.()?.data || null);
}

function maybeRenderDeveloperDebug() {
  const params = new URLSearchParams(window.location.search);
  const profile = getAppBridge()?.getProfile?.()?.data || null;
  if (params.get('debug') !== '1' || !isDeveloperProfile(profile)) return false;
  renderDebugPlaceholder();
  return true;
}

async function setupNativeAuthRedirects() {
  const appPlugin = getCapacitorAppPlugin();
  if (!appPlugin?.addListener) return null;

  appPlugin.addListener('appUrlOpen', ({ url } = {}) => {
    const result = applyAuthRedirectFromUrl(url || '');
    if (result?.handled) {
      redirectAfterNativeAuth(result);
    }
  });

  try {
    const launch = await appPlugin.getLaunchUrl?.();
    const result = applyAuthRedirectFromUrl(String(launch?.url || ''));
    if (result?.handled) {
      return result;
    }
  } catch {
    // no-op
  }

  return null;
}

function redirectAfterNativeAuth(result) {
  const returnTo = String(result?.returnTo || '/sports/cross/index.html').trim() || '/sports/cross/index.html';
  window.location.replace(returnTo);
}

async function mountAthleteUi() {
  const root = document.getElementById('app');
  if (!root) {
    console.error('Elemento #app não encontrado.');
    return;
  }

  if (!getAppBridge()?.getState) {
    console.warn('⚠️ getAppBridge() ainda não está disponível. Tentando novamente...');
    await wait(0);
  }

  const { mountUI } = await import('../../src/ui/ui.js');
  mountUI({ root });
}
