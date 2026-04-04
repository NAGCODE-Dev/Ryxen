import { apiRequest } from './apiClient.js';

async function callCrossAI(path, payload) {
  const response = await apiRequest(path, {
    method: 'POST',
    body: payload,
  });

  return normalizeCrossAiEnvelope(response);
}

function normalizeCrossAiEnvelope(response) {
  return {
    ok: Boolean(response?.ok),
    mode: response?.mode || null,
    version: response?.version || 'v1',
    data: response?.data || {},
    meta: response?.meta || {},
    usage: response?.usage || null,
    responseId: response?.responseId || null,
    preset: response?.preset || null,
  };
}

export function getCrossAiMeta() {
  return apiRequest('/ai/meta', { method: 'GET' });
}

export function explainWorkout(payload) {
  return callCrossAI('/ai/explain-workout', payload);
}

export function getWorkoutStrategy(payload) {
  return callCrossAI('/ai/strategy', payload);
}

export function adaptWorkout(payload) {
  return callCrossAI('/ai/adapt-workout', payload);
}

export function analyzeWorkoutResult(payload) {
  return callCrossAI('/ai/analyze-result', payload);
}

export function importWorkoutWithAI(payload) {
  return callCrossAI('/ai/import-workout', payload);
}

export function compareWorkoutHistory(payload) {
  return callCrossAI('/ai/compare-history', payload);
}

export function buildCompetitionPlan(payload) {
  return callCrossAI('/ai/competition-plan', payload);
}

export function checkRecoveryRisk(payload) {
  return callCrossAI('/ai/recovery-check', payload);
}

export function getCoachReview(payload) {
  return callCrossAI('/ai/coach-review', payload);
}

export function chatWithCoach(payload) {
  return callCrossAI('/ai/chat-coach', payload);
}

export function getResearchAnswer(payload) {
  return callCrossAI('/ai/research-answer', payload);
}

export function verifyStudy(payload) {
  return callCrossAI('/ai/verify-study', payload);
}
