import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from './apiClient.js';
import { setErrorMonitorUser } from './errorMonitor.js';
import { getRuntimeConfig } from '../../config/runtime.js';

const PROFILE_KEY = 'ryxen-user-profile';
const LEGACY_PROFILE_KEY = 'crossapp-user-profile';

export async function signUp(payload) {
  const res = await apiRequest('/auth/signup', { method: 'POST', body: payload });
  return res;
}

export async function requestSignUpVerification(payload) {
  return apiRequest('/auth/signup/request-code', { method: 'POST', body: payload });
}

export async function confirmSignUp(payload) {
  const res = await apiRequest('/auth/signup/confirm', { method: 'POST', body: payload });
  handleAuthResponse(res);
  return res;
}

export async function signIn(payload) {
  const res = await apiRequest('/auth/signin', { method: 'POST', body: payload });
  handleAuthResponse(res);
  return res;
}

export async function signInWithGoogle(payload) {
  const res = await requestWithPathFallback(['/auth/google', '/api/auth/google'], { method: 'POST', body: payload });
  handleAuthResponse(res);
  return res;
}

export function startGoogleRedirect(payload = {}) {
  const returnTo = String(payload.returnTo || `${window.location.pathname}${window.location.search}`).trim() || '/sports/cross/index.html';
  const target = buildGoogleRedirectUrl();
  const nativeAppCallback = buildNativeAppAuthCallbackUrl(returnTo);
  target.searchParams.set('returnTo', returnTo);
  if (nativeAppCallback) {
    target.searchParams.set('appCallback', nativeAppCallback);
  }
  window.location.assign(target.toString());
}

export async function refreshSession() {
  const res = await apiRequest('/auth/refresh', { method: 'POST' });
  handleAuthResponse(res);
  return res;
}

export async function requestPasswordReset(payload) {
  return apiRequest('/auth/request-password-reset', { method: 'POST', body: payload });
}

export async function confirmPasswordReset(payload) {
  return apiRequest('/auth/confirm-password-reset', { method: 'POST', body: payload });
}

export async function signOut() {
  try {
    await apiRequest('/auth/signout', { method: 'POST' });
  } catch {
    // logout local mesmo se backend falhar
  } finally {
    clearAuthToken();
    clearStoredProfile();
    setErrorMonitorUser(null);
  }
}

export function getStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY) || localStorage.getItem(LEGACY_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasStoredSession() {
  return !!getAuthToken();
}

export function applyAuthRedirectFromLocation() {
  return applyAuthRedirectFromUrl(window.location.href, { cleanupCurrentLocation: true });
}

export function applyAuthRedirectFromUrl(urlString, { cleanupCurrentLocation = false } = {}) {
  try {
    const url = new URL(urlString, window.location.href);
    const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));
    const searchParams = new URLSearchParams(url.search || '');
    const token = String(hashParams.get('authToken') || searchParams.get('authToken') || '').trim();
    const encodedUser = String(hashParams.get('authUser') || searchParams.get('authUser') || '').trim();
    const authError = String(hashParams.get('authError') || searchParams.get('authError') || '').trim();
    const returnTo = normalizeReturnTo(searchParams.get('returnTo'));

    if (!token && !encodedUser && !authError) {
      return { success: false, handled: false };
    }

    let user = null;
    if (encodedUser) {
      user = parseBase64UrlJson(encodedUser);
    }

    if (token) setAuthToken(token);
    if (user) {
      saveStoredProfile(user);
      setErrorMonitorUser(user);
    }

    if (cleanupCurrentLocation) {
      url.hash = '';
      url.searchParams.delete('authToken');
      url.searchParams.delete('authUser');
      url.searchParams.delete('authError');
      url.searchParams.delete('returnTo');
      window.history.replaceState({}, '', url.toString());
    }

    return {
      success: !authError,
      handled: true,
      token,
      user,
      error: authError || '',
      returnTo,
    };
  } catch {
    return { success: false, handled: false };
  }
}

function handleAuthResponse(res) {
  if (res?.token) setAuthToken(res.token);
  if (res?.user) {
    saveStoredProfile(res.user);
    setErrorMonitorUser(res.user);
  }
}

function saveStoredProfile(profile) {
  try {
    const serialized = JSON.stringify(profile || null);
    localStorage.setItem(PROFILE_KEY, serialized);
    localStorage.setItem(LEGACY_PROFILE_KEY, serialized);
  } catch {
    // no-op
  }
}

function clearStoredProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(LEGACY_PROFILE_KEY);
  } catch {
    // no-op
  }
}

async function requestWithPathFallback(paths, options) {
  let lastError = null;

  for (const path of paths) {
    try {
      return await apiRequest(path, options);
    } catch (error) {
      lastError = error;
      if (Number(error?.status) !== 404) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Endpoint de autenticação indisponível');
}

function parseBase64UrlJson(value) {
  try {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function buildGoogleRedirectUrl() {
  const cfg = getRuntimeConfig();
  const apiBaseUrl = String(cfg.apiBaseUrl || '').trim();
  if (!apiBaseUrl) {
    throw new Error('API base URL não configurada');
  }

  const origin = String(window.location?.origin || '').trim();
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const base = /^[a-z][a-z\d+\-.]*:/i.test(normalizedBase)
    ? normalizedBase
    : new URL(normalizedBase, origin || window.location.href).toString();

  return new URL('auth/google/start', base);
}

function buildNativeAppAuthCallbackUrl(returnTo) {
  if (!isNativePlatform()) return '';
  const callback = new URL('ryxen://auth/callback');
  callback.searchParams.set('returnTo', normalizeReturnTo(returnTo));
  return callback.toString();
}

function normalizeReturnTo(value) {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/sports/cross/index.html';
  }
  return raw;
}

function isNativePlatform() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
  } catch {
    return false;
  }
}
