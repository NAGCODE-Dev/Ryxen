import test from 'node:test';
import assert from 'node:assert/strict';

import { getWorkoutTimerConfig } from '../apps/athlete/renderers/workoutTimerConfig.js';

test('getWorkoutTimerConfig cria timer countdown para amrap', () => {
  const config = getWorkoutTimerConfig({
    type: 'WOD',
    title: 'WOD',
    lines: ["12' AMRAP", '10 BURPEES'],
    parsed: { format: 'amrap', timeCapMinutes: 12 },
  });

  assert.equal(config.kind, 'countdown');
  assert.equal(config.totalSeconds, 720);
  assert.equal(config.detail, 'AMRAP 12min');
});

test('getWorkoutTimerConfig cria timer intervalado para engine', () => {
  const config = getWorkoutTimerConfig({
    type: 'ENGINE',
    title: 'LOW INTENSITY ROW',
    parsed: {
      engine: {
        rounds: 3,
        workMinutes: 15,
        restMinutes: 3,
      },
    },
  });

  assert.equal(config.kind, 'interval');
  assert.equal(config.rounds, 3);
  assert.equal(config.workSeconds, 900);
  assert.equal(config.restSeconds, 180);
});

test('getWorkoutTimerConfig cria cronômetro livre para for time sem cap', () => {
  const config = getWorkoutTimerConfig({
    type: 'WOD',
    title: 'Final',
    lines: ['FOR TIME', '21-15-9'],
    parsed: { format: 'for_time', timeCapMinutes: null },
  });

  assert.equal(config.kind, 'countup');
  assert.equal(config.detail, 'Cronômetro livre até completar o treino');
});

test('getWorkoutTimerConfig cria timer de sequência para blocos intervalados por segundos', () => {
  const config = getWorkoutTimerConfig({
    type: 'WOD',
    title: 'Intervalado',
    parsed: {
      rounds: 6,
      items: [
        { type: 'movement', durationSeconds: 40, displayName: 'MUs' },
        { type: 'rest', durationSeconds: 20 },
        { type: 'movement', durationSeconds: 40, displayName: 'ASSAULT' },
        { type: 'rest', durationSeconds: 20 },
      ],
    },
  });

  assert.equal(config.kind, 'sequence');
  assert.equal(config.rounds, 6);
  assert.equal(config.segments.length, 4);
  assert.equal(config.segments[0].label, 'MUs');
  assert.equal(config.segments[1].kind, 'rest');
});
