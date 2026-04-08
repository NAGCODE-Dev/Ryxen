import test from 'node:test';
import assert from 'node:assert/strict';

import { renderAll, renderImportModal } from '../apps/athlete/features/render/shell.js';

test('modal de importação expõe as opções realmente suportadas na apresentação', () => {
  const html = renderImportModal();
  assert.match(html, /Planilha em PDF/i);
  assert.match(html, /Imagem, vídeo, planilha ou texto/i);
  assert.match(html, /Arquivo salvo/i);
  assert.match(html, /Escolha o tipo de arquivo/i);
  assert.doesNotMatch(html, /Exportar treino atual/i);
});

test('modal de importação oferece exportar quando já existe treino atual', () => {
  const html = renderImportModal({
    workout: {
      blocks: [{ lines: ['BACK SQUAT'] }],
    },
  });

  assert.match(html, /Exportar treino atual/i);
});

test('modal de importação trava ações enquanto arquivo está sendo processado', () => {
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
    const html = renderImportModal({
      __ui: {
        importStatus: {
          active: true,
          tone: 'working',
          title: 'Importando vídeo',
          message: 'Lendo texto do vídeo...',
          fileName: 'teste.mp4',
          step: 'read',
        },
      },
    });

    assert.match(html, /Estamos processando seu arquivo/i);
    assert.match(html, /Importando vídeo/i);
    assert.match(html, /disabled aria-disabled="true"/i);
  } finally {
    globalThis.document = previousDocument;
  }
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
        auth: { profile: { email: 'athlete@test.local' } },
        coachPortal: { gymAccess: [] },
      },
    });
    const html = view.mainHtml;

    assert.match(html, /Segunda/i);
    assert.match(html, /Semana .* Segunda/i);
    assert.match(html, /BACK SQUAT/i);
    assert.match(html, /5x5 @ 80%/i);
    assert.match(html, /Automático/i);
    assert.match(html, /Copiar treino/i);
    assert.doesNotMatch(html, /Modo treino/i);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('auth reaproveita email da recuperação e mostra status após redefinir senha', () => {
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
      __ui: {
        currentPage: 'today',
        modal: 'auth',
        authMode: 'signin',
        passwordReset: {
          open: false,
          email: 'athlete@test.local',
          message: 'Senha atualizada. Entre com a nova senha.',
        },
      },
    });

    const html = view.modalsHtml;
    assert.match(html, /athlete@test\.local/i);
    assert.match(html, /Senha atualizada\. Entre com a nova senha\./i);
  } finally {
    globalThis.document = previousDocument;
  }
});
