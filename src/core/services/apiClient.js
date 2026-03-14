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
  const data = safeParse(text);

  if (!response.ok) {
    throw new Error(data?.error || `Erro API (${response.status})`);
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
