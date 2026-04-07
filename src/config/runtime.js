/**
 * Runtime configuration for integrations.
 * Uses localStorage override + optional window.__RYXEN_CONFIG__ with
 * legacy fallback to CrossApp globals/keys during the migration window.
 */

const STORAGE_KEY = 'ryxen-runtime-config';
const LEGACY_STORAGE_KEY = 'crossapp-runtime-config';

const defaults = {
  apiBaseUrl: '/api',
  nativeApiBaseUrl: '',
  native: {
    target: 'device',
    emulatorApiBaseUrl: 'http://10.0.2.2:8787',
  },
  telemetryEnabled: true,
  auth: {
    googleClientId: '',
  },
  observability: {
    sentry: {
      dsn: '',
      environment: 'development',
      release: '',
    },
  },
  app: {
    sport: 'cross',
    appName: 'Cross',
    appLabel: 'Ryxen Cross',
    hubUrl: '/index.html',
    rollout: {
      coreSports: ['cross'],
      betaSports: ['running', 'strength'],
      showBetaSports: false,
    },
    sports: {
      cross: '/sports/cross/index.html',
      running: '/sports/running/index.html',
      strength: '/sports/strength/index.html',
    },
  },
  billing: {
    provider: 'kiwify_link',
    successUrl: '',
    cancelUrl: '',
    links: {
      athlete_plus: '',
      starter: '',
      pro: '',
      coach: '',
      performance: '',
    },
  },
};

export function getRuntimeConfig() {
  const fromWindow = safeWindowConfig();
  const fromAppContext = safeAppContext();
  const fromStorage = safeStorageConfig();
  const merged = deepMerge(defaults, deepMerge(deepMerge(fromWindow, fromAppContext), fromStorage));
  return {
    ...merged,
    apiBaseUrl: resolveApiBaseUrl(merged),
  };
}

export function setRuntimeConfig(nextConfig) {
  const current = getRuntimeConfig();
  const merged = deepMerge(current, nextConfig || {});
  safeSetStorage(merged);
  return merged;
}

function safeWindowConfig() {
  try {
    return window.__RYXEN_CONFIG__ || window.__CROSSAPP_CONFIG__ || {};
  } catch {
    return {};
  }
}

function safeAppContext() {
  try {
    const context = window.__RYXEN_APP_CONTEXT__ || window.__CROSSAPP_APP_CONTEXT__ || {};
    if (!context || typeof context !== 'object') return {};
    return { app: context };
  } catch {
    return {};
  }
}

function safeStorageConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSetStorage(value) {
  try {
    const serialized = JSON.stringify(value || {});
    localStorage.setItem(STORAGE_KEY, serialized);
    // Keep writing the legacy key for already-installed clients during the transition.
    localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
  } catch {
    // no-op
  }
}

function deepMerge(base, override) {
  const output = { ...base };
  Object.keys(override || {}).forEach((key) => {
    const a = output[key];
    const b = override[key];
    if (isObject(a) && isObject(b)) {
      output[key] = deepMerge(a, b);
    } else {
      output[key] = b;
    }
  });
  return output;
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function resolveApiBaseUrl(config) {
  const rawApiBaseUrl = String(config?.apiBaseUrl || '').trim();
  const nativeApiBaseUrl = String(config?.nativeApiBaseUrl || '').trim();

  if (isNativePlatform()) {
    if (nativeApiBaseUrl) return nativeApiBaseUrl;
    if (isAbsoluteUrl(rawApiBaseUrl)) return rawApiBaseUrl;
    if (rawApiBaseUrl === '/api') {
      const nativeTarget = String(config?.native?.target || '').trim().toLowerCase();
      const emulatorApiBaseUrl = String(config?.native?.emulatorApiBaseUrl || '').trim();
      if (nativeTarget === 'emulator' && isAbsoluteUrl(emulatorApiBaseUrl)) {
        return emulatorApiBaseUrl;
      }
      return '';
    }
  }

  return rawApiBaseUrl;
}

function isAbsoluteUrl(value) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(String(value || '').trim());
}

function isNativePlatform() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:' || protocol === 'https:' && window.location?.hostname === 'localhost';
  } catch {
    return false;
  }
}
