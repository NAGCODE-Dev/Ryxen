import * as Sentry from '@sentry/browser';

let sentryReady = false;

export function initErrorMonitoring(config = {}) {
  const dsn = String(config?.dsn || '').trim();
  if (!dsn || sentryReady) return false;

  Sentry.init({
    dsn,
    environment: String(config?.environment || 'development').trim(),
    release: String(config?.release || '').trim() || undefined,
    sampleRate: 1,
  });

  sentryReady = true;
  return true;
}

export function captureAppError(error, context = {}) {
  if (!sentryReady) return;

  Sentry.withScope((scope) => {
    const tags = context?.tags || {};
    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        scope.setTag(key, String(value));
      }
    });

    const extra = { ...context };
    delete extra.tags;
    if (Object.keys(extra).length) {
      scope.setContext('app', sanitize(extra));
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    Sentry.captureMessage(String(error || 'unknown_error'));
  });
}

export function setErrorMonitorUser(user = null) {
  if (!sentryReady) return;
  if (!user?.email && !user?.id) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user?.id ? String(user.id) : undefined,
    email: user?.email || undefined,
    username: user?.name || undefined,
  });
}

function sanitize(value) {
  try {
    return JSON.parse(JSON.stringify(value || {}));
  } catch {
    return { note: 'unserializable_context' };
  }
}
