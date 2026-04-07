import { flushTelemetry, trackError, trackEvent } from '../../src/core/services/telemetryService.js';
import { captureAppError, initErrorMonitoring, setErrorMonitorUser } from '../../src/core/services/errorMonitor.js';
import { getRuntimeConfig } from '../../src/config/runtime.js';
import { isNativePlatform } from './bootstrapEnvironment.js';

export function setupErrorMonitoring() {
  const config = getRuntimeConfig();
  const sentry = config?.observability?.sentry || {};
  initErrorMonitoring(sentry);
}

export function setupVercelObservability() {
  if (window.__CROSSAPP_VERCEL_OBSERVABILITY__ || !navigator.onLine) return;
  window.__CROSSAPP_VERCEL_OBSERVABILITY__ = true;
}

export function setupGlobalTelemetryHandlers() {
  window.addEventListener('error', (event) => {
    captureAppError(event?.error || event?.message || 'window_error', {
      tags: { layer: 'frontend', source: 'window.error' },
      source: event?.filename || null,
      line: event?.lineno || null,
      column: event?.colno || null,
    });
    trackError(event?.error || event?.message || 'window_error', {
      source: event?.filename || null,
      line: event?.lineno || null,
      column: event?.colno || null,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureAppError(event?.reason || 'unhandled_rejection', {
      tags: { layer: 'frontend', source: 'unhandledrejection' },
    });
    trackError(event?.reason || 'unhandled_rejection', { source: 'promise' });
  });
}

export function registerServiceWorker() {
  if (isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        trackEvent('service_worker_registered', { scope: registration.scope });
      })
      .catch((error) => {
        trackError(error, { stage: 'service_worker_register' });
        console.error('Erro no Service Worker:', error);
      });
  });
}

export function trackBootstrapSuccess() {
  trackEvent('app_initialized', { success: true });
  flushTelemetry().catch(() => {});
}

export function reportBootstrapFailure(errorMessage) {
  trackError(errorMessage || 'init_failed', { stage: 'bootstrap' });
}

export function reportAuthRedirectOutcome(authRedirect) {
  if (!authRedirect?.handled) return;
  if (authRedirect.success) {
    trackEvent('auth_redirect_applied', { provider: 'google' });
    return;
  }
  if (authRedirect.error) {
    trackError(authRedirect.error, { stage: 'auth_redirect' });
    console.warn('Falha no retorno do Google:', authRedirect.error);
  }
}

export function syncErrorMonitorUser(profile) {
  setErrorMonitorUser(profile || null);
}
