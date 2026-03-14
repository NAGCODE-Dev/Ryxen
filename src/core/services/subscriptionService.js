import { apiRequest } from './apiClient.js';
import { getRuntimeConfig } from '../../config/runtime.js';

/**
 * Billing orchestration (Stripe / Mercado Pago) via backend.
 */
export async function getSubscriptionStatus() {
  return apiRequest('/billing/status', { method: 'GET' });
}

export async function createCheckoutSession(planId) {
  const cfg = getRuntimeConfig();
  const payload = {
    planId,
    provider: cfg.billing?.provider || 'stripe',
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

export async function getEntitlements() {
  return apiRequest('/billing/entitlements', { method: 'GET' });
}

export async function activateMockSubscription(planId = 'coach') {
  return apiRequest('/billing/mock/activate', {
    method: 'POST',
    body: { planId, provider: 'mock' },
  });
}
