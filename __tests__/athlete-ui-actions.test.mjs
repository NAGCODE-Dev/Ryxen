import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthleteUiActions } from '../apps/athlete/features/actions/setupUiHelpers.js';

test('finalizeUiChange aplica patch de UI antes de renderizar', async () => {
  const calls = [];
  const root = {
    querySelector(selector) {
      calls.push(['querySelector', selector]);
      return null;
    },
  };

  const uiActions = createAthleteUiActions({
    root,
    toast(message) {
      calls.push(['toast', message]);
    },
    async rerender() {
      calls.push(['rerender']);
    },
    async setUiState(next) {
      calls.push(['setUiState', next]);
    },
    async patchUiState() {
      calls.push(['patchUiState']);
    },
    getEnsureGoogleSignInUi() {
      return async () => {
        calls.push(['ensureGoogle']);
      };
    },
  });

  await uiActions.finalizeUiChange({
    modal: null,
    importStatus: { active: false, review: null },
    toastMessage: 'Treino importado',
  });

  assert.deepEqual(calls, [
    ['setUiState', { modal: null, importStatus: { active: false, review: null } }],
    ['toast', 'Treino importado'],
    ['rerender'],
  ]);
});

