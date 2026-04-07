import { apiRequest } from './apiClient.js';
import { hasStoredSession } from './authService.js';
import { getRuntimeConfig } from '../../config/runtime.js';

// Keep legacy storage key for backward compatibility with pending checkout resumes.
const CHECKOUT_INTENT_KEY = 'crossapp-pending-checkout-v1';

/**
 * Billing orchestration for Kiwify link checkout and local mock activation.
 */
export async function getSubscriptionStatus() {
  return apiRequest('/billing/status', { method: 'GET' });
}

export async function createCheckoutSession(planId) {
  const cfg = getRuntimeConfig();
  if ((cfg.billing?.provider || 'kiwify_link') === 'kiwify_link') {
    const checkoutUrl = resolveKiwifyCheckoutUrl(planId, cfg);
    if (!checkoutUrl) {
      throw new Error('Link da Kiwify não configurado para este plano');
    }
    return {
      checkoutUrl,
      mode: 'kiwify_link',
    };
  }

  const payload = {
    planId,
    provider: cfg.billing?.provider || 'kiwify_link',
    successUrl: cfg.billing?.successUrl || window.location.href,
    cancelUrl: cfg.billing?.cancelUrl || window.location.href,
  };
  return apiRequest('/billing/checkout', { method: 'POST', body: payload });
}

export async function openCheckout(planId) {
  const res = await createCheckoutSession(planId);
  if (!res?.checkoutUrl) {
    throw new Error('Checkout URL não retornada pelo backend');
  }
  window.location.href = res.checkoutUrl;
}

export function hasCheckoutAuth() {
  return hasStoredSession();
}

export function queueCheckoutIntent(planId, options = {}) {
  const next = {
    planId: String(planId || '').trim().toLowerCase(),
    source: String(options?.source || 'app').trim().toLowerCase(),
    returnTo: String(options?.returnTo || '').trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }

  return next;
}

export function peekCheckoutIntent() {
  try {
    const raw = localStorage.getItem(CHECKOUT_INTENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?.planId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent() {
  try {
    localStorage.removeItem(CHECKOUT_INTENT_KEY);
  } catch {
    // no-op
  }
}

export function consumeCheckoutIntent() {
  const current = peekCheckoutIntent();
  clearCheckoutIntent();
  return current;
}

export function buildCheckoutAuthUrl(planId, options = {}) {
  const cfg = getRuntimeConfig();
  const appUrl = cfg?.app?.sports?.cross || '/sports/cross/index.html';
  const params = new URLSearchParams();
  params.set('checkoutPlan', String(planId || '').trim().toLowerCase());
  if (options?.returnTo) params.set('returnTo', String(options.returnTo).trim());
  return `${appUrl}?${params.toString()}`;
}

export async function getEntitlements() {
  return apiRequest('/billing/entitlements', { method: 'GET' });
}

export async function activateMockSubscription(planId = 'coach') {
  return apiRequest('/billing/mock/activate', {
    method: 'POST',
    body: { planId, provider: 'mock' },
  });
}

function resolveKiwifyCheckoutUrl(planId, cfg) {
  const links = cfg?.billing?.links || {};
  const key = String(planId || 'coach').trim().toLowerCase();
  return links[key] || '';
}
