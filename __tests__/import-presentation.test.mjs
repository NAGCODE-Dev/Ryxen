import test from 'node:test';
import assert from 'node:assert/strict';

import { renderTodayPage } from '../src/ui/render-domains/today.js';
import { renderImportModal } from '../src/ui/render-domains/modals.js';

test('modal de importação expõe as opções realmente suportadas na apresentação', () => {
  const html = renderImportModal();
  assert.match(html, /Planilha em PDF/i);
  assert.match(html, /Excel, ODS, foto ou vídeo/i);
  assert.match(html, /Treino salvo/i);
  assert.match(html, /Se houver porcentagens e registros salvos, o app usa isso para sugerir as cargas/i);
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
