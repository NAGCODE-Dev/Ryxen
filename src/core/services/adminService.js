import { apiRequest } from './apiClient.js';

export async function getAdminOverview(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.limit) search.set('limit', String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/admin/overview${suffix}`, { method: 'GET' });
}
