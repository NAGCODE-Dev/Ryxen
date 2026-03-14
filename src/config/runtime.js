/**
 * Runtime configuration for integrations.
 * Uses localStorage override + optional window.__CROSSAPP_CONFIG__.
 */

const STORAGE_KEY = 'crossapp-runtime-config';

const defaults = {
  apiBaseUrl: '/api',
  telemetryEnabled: true,
  auth: {
    googleClientId: '',
  },
  billing: {
    provider: 'stripe', // stripe | mercadopago
    successUrl: '',
    cancelUrl: '',
  },
};

export function getRuntimeConfig() {
  const fromWindow = safeWindowConfig();
  const fromStorage = safeStorageConfig();
  return deepMerge(defaults, deepMerge(fromWindow, fromStorage));
}

export function setRuntimeConfig(nextConfig) {
  const current = getRuntimeConfig();
  const merged = deepMerge(current, nextConfig || {});
  safeSetStorage(merged);
  return merged;
}

function safeWindowConfig() {
  try {
    return window.__CROSSAPP_CONFIG__ || {};
  } catch {
    return {};
  }
}

function safeStorageConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeSetStorage(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value || {}));
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
