import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadParsedWeeks } from '../../src/adapters/pdf/pdfRepository.js';
import { createAthleteImportReviewAdapter } from './athlete-import-review.js';

beforeEach(() => {
  localStorage.clear();
});

describe('athlete-import-review', () => {
  it('gera preview editável, reprocessa o texto e salva o plano final', async () => {
    const syncImportedPlan = vi.fn(async () => ({ success: true }));
    const adapter = createAthleteImportReviewAdapter({
      getActiveWeekNumber: () => 24,
      getFallbackDay: () => 'Quarta',
      syncImportedPlan,
    });

    const file = new File([
      `SEMANA 24
QUARTA
WOD
16 MIN AMRAP
15 CAL ROW
20 CTBS
40 DUS
Objetivo= acima de 4 rounds`,
    ], 'quadro.txt', { type: 'text/plain' });

    const preview = await adapter.previewImportFromFile(file);
    expect(preview.success).toBe(true);
    expect(preview.review.canEditText).toBe(true);
    expect(preview.review.weeksCount).toBe(1);

    const reparsed = await adapter.reparseImportReview(`
SEMANA 24
QUARTA
WOD
18 MIN AMRAP
12 CAL ROW
18 CTBS
30 DUS
Objetivo= acima de 5 rounds
    `);
    expect(reparsed.success).toBe(true);
    expect(reparsed.review.reviewText).toMatch(/18 MIN AMRAP/);

    const committed = await adapter.commitImportReview();
    expect(committed.success).toBe(true);
    expect(syncImportedPlan).toHaveBeenCalledTimes(1);

    const stored = await loadParsedWeeks();
    expect(stored.success).toBe(true);
    expect(stored.data.weeks[0].workouts[0].blocks[0].lines[0]).toContain('18 MIN AMRAP');
  });

  it('cancela a revisão pendente sem deixar estado residual', async () => {
    const adapter = createAthleteImportReviewAdapter({
      getActiveWeekNumber: () => 24,
      getFallbackDay: () => 'Quarta',
    });

    const file = new File([
      'SEMANA 24\nQUARTA\nWOD\nFOR TIME\n30 WALL BALLS',
    ], 'simple.txt', { type: 'text/plain' });

    await adapter.previewImportFromFile(file);
    expect(adapter.getPendingReview()).not.toBeNull();

    const cancelled = await adapter.cancelImportReview();
    expect(cancelled.success).toBe(true);
    expect(adapter.getPendingReview()).toBeNull();
  });
});
