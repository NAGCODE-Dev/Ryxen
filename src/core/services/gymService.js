import { apiRequest } from './apiClient.js';

export async function createGym(payload) {
  return apiRequest('/gyms', { method: 'POST', body: payload });
}

export async function getMyGyms() {
  return apiRequest('/gyms/me', { method: 'GET' });
}

export async function addGymMember(gymId, payload) {
  return apiRequest(`/gyms/${gymId}/memberships`, { method: 'POST', body: payload });
}

export async function listGymMembers(gymId) {
  return apiRequest(`/gyms/${gymId}/memberships`, { method: 'GET' });
}

export async function listGymGroups(gymId, params = {}) {
  const search = new URLSearchParams();
  if (params?.sportType) search.set('sportType', params.sportType);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/gyms/${gymId}/groups${suffix}`, { method: 'GET' });
}

export async function createGymGroup(gymId, payload) {
  return apiRequest(`/gyms/${gymId}/groups`, { method: 'POST', body: payload });
}

export async function publishGymWorkout(gymId, payload) {
  return apiRequest(`/gyms/${gymId}/workouts`, { method: 'POST', body: payload });
}

export async function getWorkoutFeed(params = {}) {
  const search = new URLSearchParams();
  if (params?.sportType) search.set('sportType', params.sportType);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/workouts/feed${suffix}`, { method: 'GET' });
}

export async function getAccessContext() {
  return apiRequest('/access/context', { method: 'GET' });
}

export async function getAthleteSummary(params = {}) {
  const search = new URLSearchParams();
  if (params?.sportType) search.set('sportType', params.sportType);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/athletes/me/summary${suffix}`, { method: 'GET' });
}

export async function getAthleteResultsSummary(params = {}) {
  const search = new URLSearchParams();
  if (params?.sportType) search.set('sportType', params.sportType);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/athletes/me/results/summary${suffix}`, { method: 'GET' });
}

export async function getAthleteWorkoutsRecent(params = {}) {
  const search = new URLSearchParams();
  if (params?.sportType) search.set('sportType', params.sportType);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/athletes/me/workouts/recent${suffix}`, { method: 'GET' });
}

export async function getGymInsights(gymId, params = {}) {
  const search = new URLSearchParams();
  if (params?.sportType) search.set('sportType', params.sportType);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiRequest(`/gyms/${gymId}/insights${suffix}`, { method: 'GET' });
}

export async function logAthletePr(payload) {
  return apiRequest('/athletes/me/prs', { method: 'POST', body: payload });
}

export async function syncAthletePrSnapshot(prs) {
  return apiRequest('/athletes/me/prs/snapshot', { method: 'POST', body: { prs } });
}

export async function getMeasurementHistory() {
  return apiRequest('/athletes/me/measurements/history', { method: 'GET' });
}

export async function syncAthleteMeasurementsSnapshot(measurements) {
  return apiRequest('/athletes/me/measurements/snapshot', {
    method: 'POST',
    body: { measurements },
  });
}

export async function logRunningSession(payload) {
  return apiRequest('/athletes/me/running/logs', { method: 'POST', body: payload });
}

export async function getRunningHistory() {
  return apiRequest('/athletes/me/running/history', { method: 'GET' });
}

export async function logStrengthSession(payload) {
  return apiRequest('/athletes/me/strength/logs', { method: 'POST', body: payload });
}

export async function getStrengthHistory() {
  return apiRequest('/athletes/me/strength/history', { method: 'GET' });
}
