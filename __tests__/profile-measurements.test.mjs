import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMeasurementEntry,
  formatMeasurementValue,
  normalizeMeasurementEntries,
  summarizeMeasurements,
} from '../src/ui/profileMeasurements.js';

test('buildMeasurementEntry normaliza medida corporal válida', () => {
  const result = buildMeasurementEntry({
    type: 'weight',
    value: 81.45,
    recordedAt: '2026-03-10',
    notes: 'jejum',
  });

  assert.equal(result.type, 'weight');
  assert.equal(result.label, 'Peso');
  assert.equal(result.unit, 'kg');
  assert.equal(result.value, 81.45);
});

test('normalizeMeasurementEntries ordena por data mais recente', () => {
  const result = normalizeMeasurementEntries([
    { id: 'a', type: 'weight', value: 82, recordedAt: '2026-03-01' },
    { id: 'b', type: 'waist', value: 79, recordedAt: '2026-03-12' },
  ]);

  assert.equal(result[0].id, 'b');
  assert.equal(result[1].id, 'a');
});

test('summarizeMeasurements mantém a medida mais recente por tipo', () => {
  const result = summarizeMeasurements([
    { id: 'a', type: 'weight', value: 82, recordedAt: '2026-03-01' },
    { id: 'b', type: 'weight', value: 81, recordedAt: '2026-03-12' },
    { id: 'c', type: 'waist', value: 79, recordedAt: '2026-03-10' },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.type === 'weight')?.value, 81);
});

test('formatMeasurementValue formata unidade corretamente', () => {
  assert.equal(formatMeasurementValue({ value: 81, unit: 'kg' }), '81 kg');
  assert.equal(formatMeasurementValue({ value: 12.5, unit: '%' }), '12,5 %');
});
