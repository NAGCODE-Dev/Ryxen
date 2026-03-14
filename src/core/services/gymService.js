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

export async function publishGymWorkout(gymId, payload) {
  return apiRequest(`/gyms/${gymId}/workouts`, { method: 'POST', body: payload });
}

export async function getWorkoutFeed() {
  return apiRequest('/workouts/feed', { method: 'GET' });
}

export async function getAccessContext() {
  return apiRequest('/access/context', { method: 'GET' });
}
