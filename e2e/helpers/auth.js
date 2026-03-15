import { expect } from '@playwright/test';

export const E2E_API_BASE_URL = process.env.E2E_API_BASE_URL || 'https://crossapp-znmj.onrender.com';

export async function signInViaApi(request, { email, password }) {
  const response = await request.post(`${E2E_API_BASE_URL}/auth/signin`, {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.token).toBeTruthy();
  expect(body.user?.email).toBeTruthy();
  return body;
}

export async function hydrateAuthenticatedSession(context, authResult, runtimeOverrides = {}) {
  await context.addInitScript(({ token, user, apiBaseUrl, overrides }) => {
    localStorage.setItem('crossapp-auth-token', token);
    localStorage.setItem('crossapp-user-profile', JSON.stringify(user));
    if (apiBaseUrl || Object.keys(overrides || {}).length) {
      const current = (() => {
        try {
          return JSON.parse(localStorage.getItem('crossapp-runtime-config') || '{}');
        } catch {
          return {};
        }
      })();
      const next = {
        ...current,
        ...(apiBaseUrl ? { apiBaseUrl } : {}),
        ...(overrides || {}),
      };
      localStorage.setItem('crossapp-runtime-config', JSON.stringify(next));
    }
  }, {
    token: authResult.token,
    user: authResult.user,
    apiBaseUrl: E2E_API_BASE_URL,
    overrides: runtimeOverrides,
  });
}

export async function signUpViaApi(request, { name, email, password }) {
  const response = await request.post(`${E2E_API_BASE_URL}/auth/signup`, {
    data: { name, email, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.token).toBeTruthy();
  expect(body.user?.email).toBeTruthy();
  return body;
}

export function buildE2ETestEmail(prefix = 'athlete') {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}.${stamp}@crossapp.local`;
}
