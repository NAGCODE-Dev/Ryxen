import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from './apiClient.js';
import { setErrorMonitorUser } from './errorMonitor.js';

const PROFILE_KEY = 'crossapp-user-profile';

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
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasStoredSession() {
  return !!getAuthToken();
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
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile || null));
  } catch {
    // no-op
  }
}

function clearStoredProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
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
