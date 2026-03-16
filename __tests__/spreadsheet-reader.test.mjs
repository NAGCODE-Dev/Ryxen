import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { extractTextFromSpreadsheetFile, isSpreadsheetFile } from '../src/adapters/spreadsheet/spreadsheetReader.js';
import { parseTextIntoWeeks } from '../src/app/workoutHelpers.js';

const fixturesDir = path.resolve('/home/nagc/Downloads/CrossApp/__tests__/fixtures/imports');

const CASES = [
  { name: 'treino-exemplo.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { name: 'treino-exemplo.xls', type: 'application/vnd.ms-excel' },
  { name: 'treino-exemplo.ods', type: 'application/vnd.oasis.opendocument.spreadsheet' },
  { name: 'treino-sujo-multiplas-abas.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { name: 'treino-sujo-cabecalho-ruim.xls', type: 'application/vnd.ms-excel' },
  { name: 'treino-sujo-colunas-soltas.ods', type: 'application/vnd.oasis.opendocument.spreadsheet' },
];

for (const testCase of CASES) {
  test(`reader de planilha extrai texto e gera treino importável de ${testCase.name}`, async () => {
    const file = await loadFixture(testCase.name, testCase.type);
    assert.equal(isSpreadsheetFile(file), true);

    const text = await extractTextFromSpreadsheetFile(file);
    assert.match(text, /SEMANA 19/i);
    assert.match(text, /BACK SQUAT/i);

    const weeks = parseTextIntoWeeks(text, 19);
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0].weekNumber, 19);
    assert.equal(weeks[0].workouts.length >= 2, true);
  });
}

async function loadFixture(name, type) {
  const buffer = await fs.readFile(path.join(fixturesDir, name));
  return {
    name,
    type,
    async arrayBuffer() {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
  };
}
