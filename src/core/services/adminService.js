import { apiRequest } from './apiClient.js';

export async function getAdminOverview(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.verify) search.set('verify', '1');
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/admin/overview${suffix}`, { method: 'GET' });
}

export async function activateCoachSubscription(userId, planId, renewDays = 30) {
  return apiRequest('/admin/subscriptions/activate', {
    method: 'POST',
    body: { userId, planId, renewDays },
  });
}

export async function reprocessBillingClaim(claimId) {
  return apiRequest(`/admin/billing/claims/${Number(claimId)}/reprocess`, {
    method: 'POST',
  });
}

export async function retryEmailJob(jobId) {
  return apiRequest(`/admin/email/jobs/${Number(jobId)}/retry`, {
    method: 'POST',
  });
}

export async function createManualPasswordReset(userId) {
  return apiRequest(`/admin/users/${Number(userId)}/password-reset/manual`, {
    method: 'POST',
  });
}

export async function requestAccountDeletion(userId) {
  return apiRequest(`/admin/users/${Number(userId)}/account-deletion/request`, {
    method: 'POST',
  });
}

export async function deleteAccountNow(userId) {
  return apiRequest(`/admin/users/${Number(userId)}/account-deletion/delete-now`, {
    method: 'POST',
  });
}

export async function getAdminOpsHealth(params = {}) {
  const search = new URLSearchParams();
  if (params.verify) search.set('verify', '1');
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/admin/ops/health${suffix}`, {
    method: 'GET',
  });
}
