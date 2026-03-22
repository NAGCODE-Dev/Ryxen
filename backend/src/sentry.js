import * as Sentry from '@sentry/node';

import { APP_ENV, APP_RELEASE, SENTRY_DSN } from './config.js';

let sentryReady = false;

export function initBackendErrorMonitoring() {
  if (!SENTRY_DSN || sentryReady) return false;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV || 'development',
    release: APP_RELEASE || undefined,
    tracesSampleRate: 0,
  });

  sentryReady = true;
  return true;
}

export function captureBackendError(error, context = {}) {
  if (!sentryReady) return;

  Sentry.withScope((scope) => {
    const tags = context?.tags || {};
    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        scope.setTag(key, String(value));
      }
    });

    if (context?.request) {
      scope.setContext('request', sanitize(context.request));
    }

    const extra = { ...context };
    delete extra.tags;
    delete extra.request;
    if (Object.keys(extra).length) {
      scope.setContext('backend', sanitize(extra));
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    Sentry.captureMessage(String(error || 'unknown_backend_error'));
  });
}

function sanitize(value) {
  try {
    return JSON.parse(JSON.stringify(value || {}));
  } catch {
    return { note: 'unserializable_context' };
  }
}
