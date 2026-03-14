import { apiRequest } from './apiClient.js';

export async function getCompetitionCalendar(params = {}) {
  const search = new URLSearchParams();
  if (params.gymId) search.set('gymId', String(params.gymId));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/competitions/calendar${suffix}`, { method: 'GET' });
}

export async function createCompetition(gymId, payload) {
  return apiRequest(`/gyms/${gymId}/competitions`, { method: 'POST', body: payload });
}

export async function addCompetitionEvent(competitionId, payload) {
  return apiRequest(`/competitions/${competitionId}/events`, { method: 'POST', body: payload });
}

export async function submitBenchmarkResult(slug, payload) {
  return apiRequest(`/benchmarks/${slug}/results`, { method: 'POST', body: payload });
}

export async function getBenchmarkLeaderboard(slug, params = {}) {
  const search = new URLSearchParams();
  if (params.gymId) search.set('gymId', String(params.gymId));
  if (params.limit) search.set('limit', String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/leaderboards/benchmarks/${slug}${suffix}`, { method: 'GET' });
}

export async function getCompetitionLeaderboard(competitionId) {
  return apiRequest(`/leaderboards/competitions/${competitionId}`, { method: 'GET' });
}

export async function getEventLeaderboard(eventId, params = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/leaderboards/events/${eventId}${suffix}`, { method: 'GET' });
}
