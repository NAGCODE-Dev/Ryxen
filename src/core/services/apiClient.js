import { getRuntimeConfig } from '../../config/runtime.js';

/**
 * Lightweight API client with auth token support.
 */
export async function apiRequest(path, options = {}) {
  const cfg = getRuntimeConfig();
  if (!cfg.apiBaseUrl) {
    throw new Error('API base URL não configurada');
  }

  const url = `${cfg.apiBaseUrl.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
  const token = getAuthToken();
  const startedAt = performance.now();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const durationMs = Number((performance.now() - startedAt).toFixed(1));
  const responseBytes = safeByteLength(text);
  trackRequestMetric({
    path: `/${String(path).replace(/^\//, '')}`,
    method: options.method || 'GET',
    status: response.status,
    ok: response.ok,
    durationMs,
    responseBytes,
  });
  const data = safeParse(text);

  if (!response.ok) {
    const error = new Error(data?.error || `Erro API (${response.status})`);
    if (data && typeof data === 'object') {
      Object.assign(error, data);
    }
    error.status = response.status;
    throw error;
  }

  return data;
}

const AUTH_TOKEN_KEY = 'ryxen-auth-token';
const LEGACY_AUTH_TOKEN_KEY = 'crossapp-auth-token';
const REQUEST_METRICS_KEY = '__RYXEN_REQUEST_METRICS__';
const LEGACY_REQUEST_METRICS_KEY = '__CROSSAPP_REQUEST_METRICS__';

export function setAuthToken(token) {
  try {
    const value = token || '';
    localStorage.setItem(AUTH_TOKEN_KEY, value);
    localStorage.setItem(LEGACY_AUTH_TOKEN_KEY, value);
  } catch {
    // no-op
  }
}

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  } catch {
    // no-op
  }
}

function safeParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function safeByteLength(text) {
  try {
    return new TextEncoder().encode(text || '').length;
  } catch {
    return String(text || '').length;
  }
}

function trackRequestMetric(entry) {
  try {
    const current = window[REQUEST_METRICS_KEY] || window[LEGACY_REQUEST_METRICS_KEY] || { recent: [], slow: [], summary: {} };
    const recent = [...(current.recent || []), { ...entry, at: new Date().toISOString() }].slice(-40);
    const slow = entry.durationMs >= 600
      ? [...(current.slow || []), { ...entry, at: new Date().toISOString() }].slice(-20)
      : (current.slow || []);
    const summary = { ...(current.summary || {}) };
    const key = `${entry.method} ${entry.path}`;
    const previous = summary[key] || { count: 0, maxMs: 0, lastMs: 0, avgMs: 0, lastStatus: 0 };
    const count = previous.count + 1;
    summary[key] = {
      count,
      maxMs: Math.max(previous.maxMs || 0, entry.durationMs),
      lastMs: entry.durationMs,
      avgMs: Number((((previous.avgMs || 0) * previous.count + entry.durationMs) / count).toFixed(1)),
      lastStatus: entry.status,
      lastBytes: entry.responseBytes,
    };
    const nextMetrics = { recent, slow, summary };
    window[REQUEST_METRICS_KEY] = nextMetrics;
    window[LEGACY_REQUEST_METRICS_KEY] = nextMetrics;
    if (entry.durationMs >= 1200) {
      console.warn('[api:slow]', entry.method, entry.path, `${entry.durationMs}ms`, `${entry.responseBytes}B`, `status=${entry.status}`);
    }
  } catch {
    // no-op
  }
}
