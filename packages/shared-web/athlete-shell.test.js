import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadParsedWeeks, saveParsedWeeks } from '../../src/adapters/pdf/pdfRepository.js';
import {
  loadAthleteTodaySnapshot,
  persistTodaySelection,
  readTodaySelection,
} from './athlete-shell.js';

function buildWeeks() {
  return [
    {
      weekNumber: 24,
      workouts: [
        {
          day: 'Quarta',
          blocks: [
            {
              type: 'WOD',
              title: '16 MIN AMRAP',
              lines: ['15 CAL ROW', '20 CTBS', '40 DUS'],
              parsed: { goal: 'acima de 4 rounds', timeCapMinutes: 16, items: [] },
            },
          ],
        },
      ],
    },
  ];
}

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('athlete-shell', () => {
  it('hidrata o Today primeiro do plano local e respeita semana/dia persistidos', async () => {
    await saveParsedWeeks(buildWeeks(), {
      fileName: 'quadro-quarta.txt',
      source: 'text',
      weekNumbers: [24],
    });
    await persistTodaySelection({
      activeWeekNumber: 24,
      currentDay: 'Quarta',
    });

    const snapshot = await loadAthleteTodaySnapshot();

    expect(snapshot.weeks).toHaveLength(1);
    expect(snapshot.activeWeekNumber).toBe(24);
    expect(snapshot.currentDay).toBe('Quarta');
    expect(snapshot.workout?.blocks).toHaveLength(1);
    expect(snapshot.workoutMeta?.source).toBe('local-imported-plan');
  });

  it('faz fallback remoto quando não existe plano local e persiste o snapshot importado', async () => {
    localStorage.setItem('ryxen-auth-token', 'token');
    localStorage.setItem('ryxen-user-profile', JSON.stringify({
      id: 17,
      email: 'athlete@ryxen.app',
      name: 'Athlete Ryxen',
    }));

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.endsWith('/athletes/me/imported-plan')) {
        return jsonResponse({
          importedPlan: {
            weeks: buildWeeks(),
            metadata: { fileName: 'remote-plan.pdf', source: 'account' },
            activeWeekNumber: 24,
            updatedAt: '2026-04-23T20:00:00.000Z',
          },
        });
      }
      if (href.includes('/athletes/me/summary')) {
        return jsonResponse({
          stats: { activeGyms: 2, athleteTier: 'plus' },
          athleteBenefits: { tier: 'plus' },
        });
      }
      if (href.includes('/athletes/me/workouts/recent')) {
        return jsonResponse({
          recentWorkouts: [{ id: 1, title: 'Open Prep', gym_name: 'Ryxen HQ' }],
        });
      }
      if (href.endsWith('/access/context')) {
        return jsonResponse({ gyms: [{ id: 9, name: 'Ryxen HQ' }] });
      }
      throw new Error(`unhandled fetch ${href}`);
    }));

    const snapshot = await loadAthleteTodaySnapshot();
    const localPlan = await loadParsedWeeks();

    expect(snapshot.weeks).toHaveLength(1);
    expect(snapshot.workoutContext.source).toBe('remote');
    expect(snapshot.workoutContext.stats.activeGyms).toBe(2);
    expect(snapshot.importedPlanMeta.fileName).toBe('remote-plan.pdf');
    expect(localPlan.success).toBe(true);
    expect(localPlan.data.metadata.fileName).toBe('remote-plan.pdf');
  });

  it('persiste seleção de semana e dia com as mesmas chaves do shell legado', async () => {
    await persistTodaySelection({
      activeWeekNumber: 7,
      currentDay: 'Quinta',
    });

    const selection = await readTodaySelection();

    expect(selection.activeWeekNumber).toBe(7);
    expect(selection.currentDay).toBe('Quinta');
  });
});
