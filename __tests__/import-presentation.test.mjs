import test from 'node:test';
import assert from 'node:assert/strict';

import { renderTodayPage } from '../src/ui/render-domains/today.js';
import { renderImportModal } from '../src/ui/render-domains/modals.js';

test('modal de importação expõe as opções realmente suportadas na apresentação', () => {
  const html = renderImportModal();
  assert.match(html, /PDF do treino/i);
  assert.match(html, /Excel, ODS, foto ou vídeo/i);
  assert.match(html, /Treino salvo/i);
  assert.match(html, /usa seus registros salvos para sugerir cargas/i);
});

test('modal de importação mostra revisão editável antes de salvar', () => {
  const html = renderImportModal({
    lastReview: {
      summary: '1 semana • confiança média',
      sourceLabel: 'Vídeo',
      confidenceLabel: 'média',
      weekCount: 1,
      warnings: ['Revise o conteúdo'],
    },
    draft: {
      weeks: [
        {
          weekNumber: 19,
          workouts: [
            { day: 'Segunda', text: 'BACK SQUAT\n5x5 @ 80%', enabled: true },
          ],
        },
      ],
    },
  });

  assert.match(html, /Revisão antes de salvar/i);
  assert.match(html, /Salvar treino/i);
  assert.match(html, /Descartar revisão/i);
  assert.match(html, /Revise o dia/i);
});

test('página Hoje apresenta treino importado de forma direta', () => {
  const html = renderTodayPage({
    currentDay: 'Segunda',
    weeks: [{ weekNumber: 19 }],
    workout: {
      day: 'Segunda',
      title: 'Segunda',
      blocks: [
        { type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%', { raw: '-> 80kg', calculated: '80kg' }] },
      ],
    },
    __ui: {
      currentPage: 'today',
      progress: { doneCount: 0, totalCount: 2 },
      trainingMode: false,
      auth: { profile: { email: 'athlete@test.local' } },
      coachPortal: { gymAccess: [] },
    },
  }, {
    renderPageHero: ({ title, subtitle, actions, footer }) => `<section><h1>${title}</h1><p>${subtitle}</p>${actions}${footer || ''}</section>`,
    renderSummaryTile: () => '',
    renderWorkoutBlock: (block) => `<article>${block.lines.map((line) => typeof line === 'string' ? line : (line.raw || line.text || '')).join(' | ')}</article>`,
    renderBottomTools: () => '<footer>tools</footer>',
    formatDay: (day) => day,
    formatSubtitle: () => 'Semana 19',
    escapeHtml: (value) => String(value ?? ''),
  });

  assert.match(html, /Treino do dia/i);
  assert.match(html, /Train • Segunda/i);
  assert.match(html, /BACK SQUAT/i);
  assert.match(html, /5x5 @ 80%/i);
  assert.match(html, /Modo treino/i);
});
