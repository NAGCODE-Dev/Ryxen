import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from './apiClient.js';
import { setErrorMonitorUser } from './errorMonitor.js';
import { getRuntimeConfig } from '../../config/runtime.js';

const PROFILE_KEY = 'ryxen-user-profile';
const LEGACY_PROFILE_KEY = 'crossapp-user-profile';
const TRUSTED_DEVICE_ID_KEY = 'ryxen-trusted-device-id';
const TRUSTED_DEVICE_MAP_KEY = 'ryxen-trusted-device-map';
const LAST_AUTH_EMAIL_KEY = 'ryxen-last-auth-email';
const AUTH_REDIRECT_PROOF_KEY = 'ryxen-auth-redirect-proof';
const AUTH_REDIRECT_PROOF_TTL_MS = 10 * 60 * 1000;
let pendingAuthRedirectProofMemory = null;

export async function signUp(payload) {
  const res = await apiRequest('/auth/signup', { method: 'POST', body: payload });
  return res;
}

export async function requestSignUpVerification(payload) {
  return apiRequest('/auth/signup/request-code', { method: 'POST', body: payload });
}

export async function confirmSignUp(payload) {
  const res = await apiRequest('/auth/signup/confirm', { method: 'POST', body: withTrustedDevicePayload(payload) });
  handleAuthResponse(res);
  return res;
}

export async function signIn(payload) {
  const res = await apiRequest('/auth/signin', { method: 'POST', body: withTrustedDevicePayload(payload) });
  handleAuthResponse(res);
  return res;
}

export async function signInWithTrustedDevice(payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const grant = getTrustedDeviceGrant(email);
  if (!grant?.trustedToken) {
    throw new Error('Dispositivo confiável não disponível para este email');
  }

  const res = await apiRequest('/auth/trusted-device/signin', {
    method: 'POST',
    body: {
      email,
      deviceId: grant.deviceId,
      trustedToken: grant.trustedToken,
      deviceLabel: getTrustedDeviceLabel(),
    },
  });
  handleAuthResponse(res);
  return res;
}

export async function signInWithGoogle(payload) {
  const res = await requestWithPathFallback(['/auth/google', '/api/auth/google'], { method: 'POST', body: withTrustedDevicePayload(payload) });
  handleAuthResponse(res);
  return res;
}

export async function startGoogleRedirect(payload = {}) {
  const returnTo = String(payload.returnTo || `${window.location.pathname}${window.location.search}`).trim() || '/sports/cross/index.html';
  const target = buildGoogleRedirectUrl();
  const nativeAppCallback = buildNativeAppAuthCallbackUrl(returnTo);
  target.searchParams.set('returnTo', returnTo);
  if (nativeAppCallback) {
    const proof = await createPendingAuthRedirectProof(returnTo);
    target.searchParams.set('appCallback', nativeAppCallback);
    target.searchParams.set('deviceId', proof.deviceId);
    target.searchParams.set('codeChallenge', proof.codeChallenge);
    target.searchParams.set('codeChallengeMethod', proof.codeChallengeMethod);
  }
  window.location.assign(target.toString());
}

export async function refreshSession() {
  const res = await apiRequest('/auth/refresh', { method: 'POST' });
  handleAuthResponse(res);
  return res;
}

export async function requestPasswordReset(payload) {
  return apiRequest('/auth/request-password-reset', { method: 'POST', body: withTrustedDevicePayload(payload) });
}

export async function confirmPasswordReset(payload) {
  return apiRequest('/auth/confirm-password-reset', { method: 'POST', body: payload });
}

export async function getPasswordResetSupportStatus(payload) {
  return apiRequest('/auth/password-reset-support-status', { method: 'POST', body: payload });
}

export async function confirmPasswordResetSupport(payload) {
  return apiRequest('/auth/confirm-password-reset-support', { method: 'POST', body: payload });
}

export function hasTrustedDeviceGrant(email) {
  return !!getTrustedDeviceGrant(email);
}

export function getLastAuthEmail() {
  try {
    const remembered = String(localStorage.getItem(LAST_AUTH_EMAIL_KEY) || '').trim().toLowerCase();
    if (remembered) return remembered;

    const currentDeviceId = getOrCreateTrustedDeviceId();
    const trustedEntries = Object.entries(getTrustedDeviceMap());
    const fallbackEmail = trustedEntries.find(([, grant]) => (
      grant
      && typeof grant === 'object'
      && String(grant.deviceId || '') === currentDeviceId
      && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > Date.now())
    ))?.[0] || '';

    if (fallbackEmail) {
      localStorage.setItem(LAST_AUTH_EMAIL_KEY, fallbackEmail);
    }

    return fallbackEmail;
  } catch {
    return '';
  }
}

function getPendingAuthRedirectProof() {
  try {
    const raw = getAuthRedirectProofStorage().getItem(AUTH_REDIRECT_PROOF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const deviceId = String(parsed.deviceId || '').trim();
    const verifier = String(parsed.verifier || '').trim();
    const codeChallenge = String(parsed.codeChallenge || '').trim();
    const codeChallengeMethod = String(parsed.codeChallengeMethod || '').trim().toUpperCase();
    const createdAt = Number(parsed.createdAt || 0);
    if (!deviceId || !verifier || !codeChallenge || !createdAt) return null;
    if (deviceId !== getOrCreateTrustedDeviceId()) return null;
    if ((Date.now() - createdAt) > AUTH_REDIRECT_PROOF_TTL_MS) return null;
    return {
      deviceId,
      verifier,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod === 'PLAIN' ? 'PLAIN' : 'S256',
      createdAt,
    };
  } catch {
    return null;
  }
}

function savePendingAuthRedirectProof(proof) {
  try {
    getAuthRedirectProofStorage().setItem(AUTH_REDIRECT_PROOF_KEY, JSON.stringify(proof || null));
  } catch {
    // no-op
  }
}

function clearPendingAuthRedirectProof() {
  try {
    getAuthRedirectProofStorage().removeItem(AUTH_REDIRECT_PROOF_KEY);
    localStorage.removeItem(AUTH_REDIRECT_PROOF_KEY);
  } catch {
    // no-op
  }
}

function getAuthRedirectProofStorage() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    // no-op
  }

  return {
    getItem() {
      return pendingAuthRedirectProofMemory;
    },
    setItem(_key, value) {
      pendingAuthRedirectProofMemory = String(value || '');
    },
    removeItem() {
      pendingAuthRedirectProofMemory = null;
    },
  };
}

async function createPendingAuthRedirectProof(returnTo) {
  const deviceId = getOrCreateTrustedDeviceId();
  const verifier = createUrlSafeRandomString(64);
  const challenge = await buildPkceCodeChallenge(verifier);
  const proof = {
    deviceId,
    verifier,
    codeChallenge: challenge.codeChallenge,
    codeChallengeMethod: challenge.codeChallengeMethod,
    createdAt: Date.now(),
    returnTo: normalizeReturnTo(returnTo),
  };
  savePendingAuthRedirectProof(proof);
  return proof;
}

async function buildPkceCodeChallenge(verifier) {
  const normalizedVerifier = String(verifier || '').trim();
  if (!normalizedVerifier) {
    throw new Error('Verifier de autenticação inválido');
  }

  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      return {
        codeChallenge: normalizedVerifier,
        codeChallengeMethod: 'PLAIN',
      };
    }

    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(normalizedVerifier));
    return {
      codeChallenge: bytesToBase64Url(new Uint8Array(digest)),
      codeChallengeMethod: 'S256',
    };
  } catch {
    return {
      codeChallenge: normalizedVerifier,
      codeChallengeMethod: 'PLAIN',
    };
  }
}

function createUrlSafeRandomString(length = 64) {
  const targetLength = Math.max(Number(length) || 64, 43);
  try {
    const bytes = new Uint8Array(Math.ceil((targetLength * 3) / 4));
    globalThis.crypto?.getRandomValues?.(bytes);
    const encoded = bytesToBase64Url(bytes);
    if (encoded.length >= targetLength) {
      return encoded.slice(0, targetLength);
    }
  } catch {
    // no-op
  }

  let fallback = '';
  while (fallback.length < targetLength) {
    fallback += `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
  return fallback.replace(/[^A-Za-z0-9\-._~]/g, 'a').slice(0, targetLength);
}

function bytesToBase64Url(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function signOut() {
  try {
    await apiRequest('/auth/signout', { method: 'POST', body: withTrustedDevicePayload({}) });
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

export async function applyAuthRedirectFromLocation() {
  return applyAuthRedirectFromUrl(window.location.href, { cleanupCurrentLocation: true });
}

export async function applyAuthRedirectFromUrl(urlString, { cleanupCurrentLocation = false } = {}) {
  try {
    const url = new URL(urlString, window.location.href);
    const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));
    const searchParams = new URLSearchParams(url.search || '');
    const token = String(hashParams.get('authToken') || searchParams.get('authToken') || '').trim();
    const authCode = String(hashParams.get('authCode') || searchParams.get('authCode') || '').trim();
    const encodedUser = String(hashParams.get('authUser') || searchParams.get('authUser') || '').trim();
    let authError = String(hashParams.get('authError') || searchParams.get('authError') || '').trim();
    let returnTo = normalizeReturnTo(searchParams.get('returnTo'));

    if (!token && !authCode && !encodedUser && !authError) {
      return { success: false, handled: false };
    }

    let user = null;
    if (encodedUser) {
      user = parseBase64UrlJson(encodedUser);
    }

    let resolvedToken = token;
    let resolvedUser = user;
    if (authCode && !resolvedToken && !authError) {
      const proof = getPendingAuthRedirectProof();
      if (!proof?.verifier || !proof?.deviceId) {
        clearPendingAuthRedirectProof();
        authError = 'Sessão de autenticação expirada. Inicie o login novamente.';
      }
    }

    if (authCode && !resolvedToken && !authError) {
      try {
        const proof = getPendingAuthRedirectProof();
        const exchange = await requestWithPathFallback(['/auth/redirect/exchange'], {
          method: 'POST',
          body: withTrustedDevicePayload({
            authCode,
            authVerifier: proof?.verifier || '',
            deviceId: proof?.deviceId || getOrCreateTrustedDeviceId(),
          }),
        });
        handleAuthResponse(exchange);
        clearPendingAuthRedirectProof();
        resolvedToken = String(exchange?.token || '').trim();
        resolvedUser = exchange?.user || null;
        if (exchange?.returnTo) {
          returnTo = normalizeReturnTo(exchange.returnTo);
        }
      } catch (error) {
        if (Number(error?.status) >= 400 && Number(error?.status) < 500) {
          clearPendingAuthRedirectProof();
        }
        authError = String(error?.message || 'Não foi possível concluir a autenticação').trim();
      }
    } else {
      if (resolvedToken) setAuthToken(resolvedToken);
      if (resolvedUser) {
        saveStoredProfile(resolvedUser);
        saveLastAuthEmail(resolvedUser.email);
        setErrorMonitorUser(resolvedUser);
      }
    }

    if (cleanupCurrentLocation) {
      url.hash = '';
      url.searchParams.delete('authCode');
      url.searchParams.delete('authToken');
      url.searchParams.delete('authUser');
      url.searchParams.delete('authError');
      url.searchParams.delete('returnTo');
      window.history.replaceState({}, '', url.toString());
    }

    return {
      success: !authError,
      handled: true,
      token: resolvedToken,
      user: resolvedUser,
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
    saveLastAuthEmail(res.user.email);
    setErrorMonitorUser(res.user);
  }
  if (res?.trustedDevice && res?.user?.email) {
    saveTrustedDeviceGrant(res.user.email, res.trustedDevice);
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

function saveLastAuthEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;
  try {
    localStorage.setItem(LAST_AUTH_EMAIL_KEY, normalizedEmail);
  } catch {
    // no-op
  }
}

function withTrustedDevicePayload(payload = {}) {
  return {
    ...(payload || {}),
    deviceId: getOrCreateTrustedDeviceId(),
    deviceLabel: getTrustedDeviceLabel(),
  };
}

function getOrCreateTrustedDeviceId() {
  try {
    const existing = localStorage.getItem(TRUSTED_DEVICE_ID_KEY);
    if (existing) return existing;
    const next = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 190);
    localStorage.setItem(TRUSTED_DEVICE_ID_KEY, next);
    return next;
  } catch {
    return `device-${Date.now()}`;
  }
}

function getTrustedDeviceLabel() {
  try {
    const platform = isNativePlatform() ? 'mobile-app' : 'browser';
    const ua = String(window.navigator?.userAgent || '').trim();
    return `${platform}:${ua}`.slice(0, 160);
  } catch {
    return 'browser';
  }
}

function getTrustedDeviceMap() {
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveTrustedDeviceGrant(email, grant) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !grant?.trustedToken || !grant?.deviceId) return;
  try {
    const next = getTrustedDeviceMap();
    next[normalizedEmail] = {
      trustedToken: String(grant.trustedToken || ''),
      deviceId: String(grant.deviceId || ''),
      expiresAt: String(grant.expiresAt || ''),
      label: String(grant.label || ''),
    };
    localStorage.setItem(TRUSTED_DEVICE_MAP_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

function getTrustedDeviceGrant(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const grant = getTrustedDeviceMap()[normalizedEmail];
  if (!grant || typeof grant !== 'object') return null;
  if (String(grant.deviceId || '') !== getOrCreateTrustedDeviceId()) return null;
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) return null;
  return grant;
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
  const callbackBaseUrl = getNativeAppCallbackBaseUrl();
  if (!callbackBaseUrl) return '';
  const callback = new URL(callbackBaseUrl);
  callback.searchParams.set('returnTo', normalizeReturnTo(returnTo));
  return callback.toString();
}

function getNativeAppCallbackBaseUrl() {
  const cfg = getRuntimeConfig();
  const appLinkBaseUrl = String(cfg?.auth?.appLinkBaseUrl || '').trim();
  if (appLinkBaseUrl) {
    try {
      const parsed = new URL(appLinkBaseUrl);
      if (parsed.protocol === 'https:' && parsed.pathname === '/auth/callback') {
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
      }
    } catch {
      // fallback below
    }
  }

  return 'ryxen://auth/callback';
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
