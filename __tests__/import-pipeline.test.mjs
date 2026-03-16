import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyUniversalImportFile } from '../src/app/importFileTypes.js';
import { parseTextIntoWeeks } from '../src/app/workoutHelpers.js';
import { isImageFile } from '../src/adapters/media/ocrReader.js';
import { isVideoFile } from '../src/adapters/media/videoTextReader.js';

function fakeFile({ name, type }) {
  return { name, type };
}

test('matriz de formatos: pdf, texto, imagem e vídeo entram no pipeline esperado', () => {
  const cases = [
    { file: fakeFile({ name: 'treino.pdf', type: 'application/pdf' }), source: 'pdf', reader: 'pdf' },
    { file: fakeFile({ name: 'treino.txt', type: 'text/plain' }), source: 'text', reader: 'text' },
    { file: fakeFile({ name: 'treino.md', type: 'text/markdown' }), source: 'text', reader: 'text' },
    { file: fakeFile({ name: 'treino.csv', type: 'text/csv' }), source: 'text', reader: 'text' },
    { file: fakeFile({ name: 'treino.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), source: 'spreadsheet', reader: 'spreadsheet' },
    { file: fakeFile({ name: 'treino.xls', type: 'application/vnd.ms-excel' }), source: 'spreadsheet', reader: 'spreadsheet' },
    { file: fakeFile({ name: 'treino.ods', type: 'application/vnd.oasis.opendocument.spreadsheet' }), source: 'spreadsheet', reader: 'spreadsheet' },
    { file: fakeFile({ name: 'foto.png', type: 'image/png' }), source: 'image', reader: 'ocr-image' },
    { file: fakeFile({ name: 'quadro.jpg', type: 'image/jpeg' }), source: 'image', reader: 'ocr-image' },
    { file: fakeFile({ name: 'video.mp4', type: 'video/mp4' }), source: 'video', reader: 'ocr-video' },
    { file: fakeFile({ name: 'aula.mov', type: 'video/quicktime' }), source: 'video', reader: 'ocr-video' },
  ];

  cases.forEach(({ file, source, reader }) => {
    const result = classifyUniversalImportFile(file);
    assert.equal(result.supported, true);
    assert.equal(result.source, source);
    assert.equal(result.reader, reader);
  });
});

test('matriz de formatos: docx continua fora do pipeline universal', () => {
  const cases = [
    fakeFile({ name: 'treino.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  ];

  cases.forEach((file) => {
    const result = classifyUniversalImportFile(file);
    assert.equal(result.supported, false);
    assert.match(result.error, /Formato não suportado/i);
  });
});

test('leitores simples identificam imagem e vídeo por mime type', () => {
  assert.equal(isImageFile(fakeFile({ name: 'foto.png', type: 'image/png' })), true);
  assert.equal(isImageFile(fakeFile({ name: 'treino.pdf', type: 'application/pdf' })), false);
  assert.equal(isVideoFile(fakeFile({ name: 'video.mp4', type: 'video/mp4' })), true);
  assert.equal(isVideoFile(fakeFile({ name: 'foto.png', type: 'image/png' })), false);
});

test('processamento de texto livre transforma treino textual em semanas importáveis', () => {
  const text = `
SEMANA 19
SEGUNDA
BACK SQUAT
5x5 @ 80%
TERÇA
FRAN
21-15-9
Thruster
Pull-up
  `.trim();

  const weeks = parseTextIntoWeeks(text, 19);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].weekNumber, 19);
  assert.equal(weeks[0].workouts.length, 2);
  assert.equal(weeks[0].workouts[0].day, 'Segunda');
});

test('json cru de treino salvo não entra no parser textual universal', () => {
  const json = JSON.stringify({
    weekNumber: 19,
    workouts: [{ day: 'Segunda', blocks: [{ type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%'] }] }],
  });

  const weeks = parseTextIntoWeeks(json, 19);
  assert.equal(weeks.length, 0);
});
