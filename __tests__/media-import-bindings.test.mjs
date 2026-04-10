import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthleteMediaImportBindings } from '../apps/athlete/features/events/importMediaBindings.js';

test('media:error libera o app para nova navegação/importação', () => {
  const statuses = [];
  const busyCalls = [];
  const toasts = [];
  const rerenders = [];

  const bindings = createAthleteMediaImportBindings({
    busy: (value, message) => busyCalls.push([value, message || '']),
    updateImportStatus: (payload) => statuses.push(payload),
    pushEventLine: () => {},
    toast: (message) => toasts.push(message),
    rerender: () => rerenders.push(true),
    stepForImportProgress: () => 'ocr',
  });

  const mediaErrorHandler = new Map(bindings).get('media:error');
  mediaErrorHandler({ error: 'OCR travou', fileName: 'foto.png' });

  assert.deepEqual(busyCalls.at(-1), [false, '']);
  assert.equal(statuses.at(-1).active, false);
  assert.equal(statuses.at(-1).tone, 'error');
  assert.equal(statuses.at(-1).fileName, 'foto.png');
  assert.deepEqual(toasts, ['OCR travou']);
  assert.equal(rerenders.length, 1);
});
