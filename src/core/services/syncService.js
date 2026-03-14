import { apiRequest } from './apiClient.js';

/**
 * Cross-device sync service.
 * Uses backup payload shape to simplify restore on any device.
 */
export async function pushBackupPayload(payload) {
  return apiRequest('/sync/push', {
    method: 'POST',
    body: { payload },
  });
}

export async function pullLatestBackupPayload() {
  return apiRequest('/sync/pull', { method: 'GET' });
}

export async function listSyncSnapshots() {
  return apiRequest('/sync/snapshots', { method: 'GET' });
}
