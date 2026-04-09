import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAthleteUiState } from '../apps/athlete/uiState.js';
import { buildUiSnapshotSignature } from '../apps/athlete/services/uiControllerHelpers.js';

test('normalizeAthleteUiState define conta e preferências novas com defaults seguros', () => {
  const normalized = normalizeAthleteUiState({
    currentPage: 'account',
    accountView: 'preferences',
    settings: {
      accentTone: 'rose',
      interfaceDensity: 'compact',
      reduceMotion: true,
    },
  });

  assert.equal(normalized.currentPage, 'account');
  assert.equal(normalized.accountView, 'preferences');
  assert.deepEqual(normalized.settings, {
    showLbsConversion: true,
    showEmojis: true,
    showObjectivesInWods: true,
    showNyxHints: true,
    theme: 'dark',
    accentTone: 'rose',
    interfaceDensity: 'compact',
    reduceMotion: true,
    workoutPriority: 'uploaded',
  });
  assert.deepEqual(normalized.guide, { step: 0 });
});

test('buildUiSnapshotSignature reage a troca de aba da conta e preferências visuais', () => {
  const base = buildUiSnapshotSignature({
    currentPage: 'account',
    accountView: 'overview',
    settings: {
      showLbsConversion: true,
      showEmojis: true,
      showObjectivesInWods: true,
      showNyxHints: true,
      theme: 'dark',
      accentTone: 'blue',
      interfaceDensity: 'comfortable',
      reduceMotion: false,
      workoutPriority: 'uploaded',
    },
    wod: {},
    coachPortal: {},
  });

  const changed = buildUiSnapshotSignature({
    currentPage: 'account',
    accountView: 'preferences',
    settings: {
      showLbsConversion: true,
      showEmojis: true,
      showObjectivesInWods: true,
      showNyxHints: false,
      theme: 'light',
      accentTone: 'sage',
      interfaceDensity: 'compact',
      reduceMotion: true,
      workoutPriority: 'coach',
    },
    wod: {},
    coachPortal: {},
  });

  assert.notEqual(base, changed);
});
