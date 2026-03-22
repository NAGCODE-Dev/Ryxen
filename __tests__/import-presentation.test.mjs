import test from 'node:test';
import assert from 'node:assert/strict';

import { renderAll, renderImportModal } from '../src/ui/render.js';

test('modal de importação expõe as opções realmente suportadas na apresentação', () => {
  const html = renderImportModal();
  assert.match(html, /Planilha em PDF/i);
  assert.match(html, /Imagem, vídeo, texto ou planilha/i);
  assert.match(html, /Treino salvo/i);
  assert.match(html, /Escolha o tipo de arquivo/i);
});

test('página Hoje apresenta treino importado de forma direta', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        _text: '',
        set textContent(value) { this._text = String(value ?? ''); },
        get innerHTML() { return this._text; },
      };
    },
  };

  try {
    const view = renderAll({
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
    });
    const html = view.mainHtml;

    assert.match(html, /Treino do dia/i);
    assert.match(html, /Treino • Segunda/i);
    assert.match(html, /BACK SQUAT/i);
    assert.match(html, /5x5 @ 80%/i);
    assert.match(html, /Modo treino/i);
  } finally {
    globalThis.document = previousDocument;
  }
});
