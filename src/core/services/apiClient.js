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

export function setAuthToken(token) {
  try {
    localStorage.setItem('crossapp-auth-token', token || '');
  } catch {
    // no-op
  }
}

export function getAuthToken() {
  try {
    return localStorage.getItem('crossapp-auth-token') || '';
  } catch {
    return '';
  }
}

export function clearAuthToken() {
  setAuthToken('');
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
    const current = window.__CROSSAPP_REQUEST_METRICS__ || { recent: [], slow: [], summary: {} };
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
    window.__CROSSAPP_REQUEST_METRICS__ = { recent, slow, summary };
    if (entry.durationMs >= 1200) {
      console.warn('[api:slow]', entry.method, entry.path, `${entry.durationMs}ms`, `${entry.responseBytes}B`, `status=${entry.status}`);
    }
  } catch {
    // no-op
  }
}
