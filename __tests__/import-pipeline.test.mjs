import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyUniversalImportFile } from '../src/app/importFileTypes.js';
import { parseTextIntoWeeks } from '../src/app/workoutHelpers.js';
import { cleanOcrWorkoutText, isImageFile, mergeOcrTextVariants } from '../src/adapters/media/ocrReader.js';
import {
  isVideoFile,
  mergeDistinctOcrChunks,
  normalizeOcrChunk,
  resolveMaxVideoFrames,
} from '../src/adapters/media/videoTextReader.js';
import { importWorkoutAsWeeks } from '../src/core/usecases/exportWorkout.js';

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

test('OCR de screenshot parcial usa o dia atual como fallback e normaliza ruído comum', () => {
  const text = `
REST AS NECLESSANT
woD
4X
10 SINGLE DB BOX STEP OVER (50-60CM) 50-35LBS
20 WBs 20-14lbs
80 DUs
20 WBs
10 SINGLE DB BOX STEP OVER (50-60CM) 50-35LBS
3° RECOVERY ROW
1º REST TOTAL
OBJETIVO = Sub 3°30 por round
[TARDE]
WOD
12° AMRAP
10 ALT DB POWER SNATCH 50-35Ibs
10m SINGLE DB OH WALKING LUNGE(alt como quiser)
5 MUs (ou 5 BMU)
OBJETIVO = acima de 7 rounds
  `.trim();

  const weeks = parseTextIntoWeeks(text, 19, { fallbackDay: 'Quarta' });

  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].workouts.length, 1);
  assert.equal(weeks[0].workouts[0].day, 'Quarta');

  const blocks = weeks[0].workouts[0].blocks;
  assert.equal(blocks.length >= 2, true);

  const morningWod = blocks.find((block) => block.type === 'WOD' && !block.period);
  const afternoonWod = blocks.find((block) => block.type === 'WOD' && block.period === 'tarde');

  assert.ok(morningWod);
  assert.ok(afternoonWod);
  assert.equal(morningWod.parsed.rounds, 4);
  assert.equal(morningWod.parsed.goal, "Sub 3'30 por round");
  assert.equal(afternoonWod.parsed.format, 'amrap');
  assert.equal(afternoonWod.parsed.timeCapMinutes, 12);
  assert.equal(afternoonWod.parsed.goal, 'acima de 7 rounds');
});

test('OCR de screenshot longo preserva MANHA/TARDE e recupera blocos reais da foto', () => {
  const morningHintText = `
MANHA
SNATCH PULL + HANG SQUAT SNATCH +SQUAT SNATCH
STRICT PULL UP
  `.trim();
  const morningBodyText = `
SNATCH PULL + HANG SQUAT SNATCH +SQUAT SNATCH
1+141@ 50%
1+1+1@ 55%
1+141@ 60%
14141@ 65%
1+141@ 70% x3
SNATCH PULL
3@80% x3
STRICT PULL UP
4x8
STRICT PULL UP (SUPINADA)
4x8
  `.trim();
  const afternoonHintText = `
GHD HIP EXTENSION
[ARDE
CLEAN AND JERK COMPLEX
  `.trim();
  const afternoonBodyText = `
GHD HIP EXTENSION
4x12
https. //www.youtube com/watch?v=7X075Hr5IE
CLEAN AND JERK COMPLEX
CLEAN PULL + HANG SQUAT CLEAN + SQUAT CLEAN + JERK
1+141+1@ 50%
1+14141@ 55%
1+1+1+41@ 60%
1+1+41+1@ 65%
1414141@ 70% x 2
CLEAN PULL
3@80% x 3
FRONT SQUATS
10@60%
REST 3
8@65%
REST 3
8@70%
BACK LOADED WALKING LUNGE
3x12 passadas (6 cada perna)
https www youtube com/watch?v=wpeSpPmbhz0
DOUBLE DB BULGARIAN SQUATS
3x8
https: /iwww. youtube com/watch?v=r3jzv)t-0I8
STRICT HSPU
4x12
SUPINO PEGADA FECHADA
4x10
  `.trim();

  const morningMerged = mergeOcrTextVariants(morningHintText, morningBodyText);
  const afternoonMerged = mergeOcrTextVariants(afternoonHintText, afternoonBodyText);
  const weeks = parseTextIntoWeeks(`${morningMerged}\n${afternoonMerged}`, 24, { fallbackDay: 'Quarta' });

  assert.match(morningMerged, /^MANHA$/m);
  assert.match(afternoonMerged, /\nTARDE\nCLEAN AND JERK COMPLEX/);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].workouts.length, 1);

  const workout = weeks[0].workouts[0];
  const morningStrength = workout.blocks.find((block) => block.period === 'manhã' && block.title.includes('SNATCH PULL + HANG SQUAT SNATCH'));
  const pullUpAccessory = workout.blocks.find((block) => block.period === 'manhã' && block.title === 'STRICT PULL UP');
  const ghdAccessory = workout.blocks.find((block) => block.period === 'manhã' && block.title === 'GHD HIP EXTENSION');
  const afternoonComplex = workout.blocks.find((block) => block.period === 'tarde' && block.title === 'CLEAN AND JERK COMPLEX');
  const frontSquats = workout.blocks.find((block) => block.period === 'tarde' && block.title === 'FRONT SQUATS');
  const walkingLunge = workout.blocks.find((block) => block.period === 'tarde' && block.title === 'BACK LOADED WALKING LUNGE');

  assert.ok(morningStrength);
  assert.deepEqual(morningStrength.parsed.strength.sets[0].sequenceReps, [1, 1, 1]);
  assert.equal(morningStrength.parsed.strength.sets.at(-1).repeatCount, 3);

  assert.ok(pullUpAccessory);
  assert.equal(pullUpAccessory.parsed.accessories[0].sets, 4);
  assert.equal(pullUpAccessory.parsed.accessories[0].reps, 8);

  assert.ok(ghdAccessory);
  assert.equal(ghdAccessory.parsed.accessories[0].sets, 4);
  assert.equal(ghdAccessory.parsed.accessories[0].reps, 12);
  assert.equal(ghdAccessory.references.length, 1);

  assert.ok(afternoonComplex);
  assert.deepEqual(afternoonComplex.parsed.strength.sets[0].sequenceReps, [1, 1, 1, 1]);
  assert.equal(afternoonComplex.parsed.strength.sets.at(-1).repeatCount, 2);

  assert.ok(frontSquats);
  assert.equal(frontSquats.parsed.items.filter((item) => item.type === 'rest').length, 2);

  assert.ok(walkingLunge);
  assert.equal(walkingLunge.parsed.accessories[0].sets, 3);
  assert.equal(walkingLunge.parsed.accessories[0].reps, 12);
  assert.match(walkingLunge.parsed.accessories[0].notes, /passadas/i);
});

test('OCR de screenshot de pdf limpa chrome, corrige headings sujos e preserva blocos de quinta', () => {
  const rawOcr = `
18:52
RX.2P.24semanas+2.BSBSTRONG...
QUARTA
MANHA
W0D
(3-3)(5-5)(7-7)(9-9)(7-7)(5-5)(3-3)
MUs (ou BMU)
DL 225-155Ibs
0bjetivo- sub 10
TAR0E
W0D
16 MIN AMRAP
15 CAL ROW
20 CTBS
15 GHD SIT UPs
40 DUS
Objetivo Acima de 4 rounds
QU1NTA
MANA
www.bsbstrong.com
BSB
STRONG
LOW INTENSITY MIX
(6x)
3 MIN RUN SUAVES
1 MIN ROW MODERADO
Direto para
(5x)
3 MIN ROW SUAVES
1 MIN RUN MODERADO
TARDE
OPICIONAL
800m SWIM
  `.trim();

  const cleaned = cleanOcrWorkoutText(rawOcr);
  const weeks = parseTextIntoWeeks(cleaned, 24);

  assert.doesNotMatch(cleaned, /^18:52$/m);
  assert.doesNotMatch(cleaned, /^RX\.2P/m);
  assert.match(cleaned, /^QUINTA$/m);
  assert.match(cleaned, /^OPTIONAL$/m);
  assert.match(cleaned, /^OBJETIVO= sub 10$/mi);
  assert.match(cleaned, /^OBJETIVO= Acima de 4 rounds$/mi);

  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].workouts.length, 2);

  const wednesday = weeks[0].workouts.find((workout) => workout.day === 'Quarta');
  const thursday = weeks[0].workouts.find((workout) => workout.day === 'Quinta');

  assert.ok(wednesday);
  assert.ok(thursday);

  const morningWod = wednesday.blocks.find((block) => block.type === 'WOD' && block.period === 'manhã');
  const afternoonWod = wednesday.blocks.find((block) => block.type === 'WOD' && block.period === 'tarde');
  const engine = thursday.blocks.find((block) => block.type === 'ENGINE');
  const optional = thursday.blocks.find((block) => block.type === 'OPTIONAL');

  assert.ok(morningWod);
  assert.ok(afternoonWod);
  assert.equal(morningWod.parsed.goal, 'sub 10');
  assert.equal(afternoonWod.parsed.format, 'amrap');
  assert.equal(afternoonWod.parsed.timeCapMinutes, 16);
  assert.equal(afternoonWod.parsed.goal, 'Acima de 4 rounds');

  assert.ok(engine);
  assert.equal(engine.parsed.engine.rounds, 6);
  assert.equal(engine.parsed.engine.movements.some((item) => item.name === 'run' && item.durationMinutes === 3), true);
  assert.equal(engine.parsed.engine.movements.some((item) => item.name === 'row' && item.durationMinutes === 1), true);

  assert.ok(optional);
  assert.equal(optional.parsed.optional.modality, 'swim');
  assert.equal(optional.parsed.optional.segments.some((segment) => segment.distanceMeters === 800), true);
});

test('parse textual ignora nome de arquivo/título de pdf quando ele entra no texto', () => {
  const text = `
RX.2P.24semanas+2.BSBSTRONG.pdf
SEMANA 24
QUARTA
MANHA
WOD
12 AMRAP
10 WALL BALL
20 DUS
  `.trim();

  const weeks = parseTextIntoWeeks(text, 24, {
    fileName: 'RX.2P.24semanas+2.BSBSTRONG.pdf',
  });

  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].weekNumber, 24);
  assert.equal(weeks[0].workouts.length, 1);
  assert.equal(weeks[0].workouts[0].day, 'Quarta');
  assert.equal(weeks[0].workouts[0].blocks[0].parsed.format, 'amrap');
  assert.equal(weeks[0].workouts[0].blocks[0].parsed.timeCapMinutes, 12);
});

test('json cru de treino salvo não entra no parser textual universal', () => {
  const json = JSON.stringify({
    weekNumber: 19,
    workouts: [{ day: 'Segunda', blocks: [{ type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%'] }] }],
  });

  const weeks = parseTextIntoWeeks(json, 19);
  assert.equal(weeks.length, 0);
});

test('json estruturado de treino salvo pode virar semana no fluxo universal', () => {
  const json = JSON.stringify({
    version: '1.0.0',
    weekNumber: 19,
    day: 'Segunda',
    sections: [{ type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%'] }],
  });

  const result = importWorkoutAsWeeks(json, 7);
  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].weekNumber, 19);
  assert.equal(result.data[0].workouts.length, 1);
  assert.equal(result.data[0].workouts[0].day, 'Segunda');
});

test('json estruturado com workouts e blocks também pode virar semana no fluxo universal', () => {
  const json = JSON.stringify({
    version: '1.0.0',
    weekNumber: 19,
    workouts: [
      {
        day: 'Segunda',
        blocks: [{ type: 'DEFAULT', lines: ['BACK SQUAT', '5x5 @ 80%'] }],
      },
    ],
  });

  const result = importWorkoutAsWeeks(json, 7);
  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].weekNumber, 19);
  assert.equal(result.data[0].workouts.length, 1);
  assert.equal(result.data[0].workouts[0].sections[0].lines[0], 'BACK SQUAT');
});

test('OCR de vídeo remove frames duplicados antes do parser', () => {
  const chunks = [
    'SEMANA 19\nSEGUNDA\nBACK SQUAT',
    'SEMANA 19\nSEGUNDA\nBACK SQUAT',
    'SEMANA 19\nTERÇA\nFRAN',
    'SEMANA 19\nTERÇA\nFRAN',
    '',
  ];

  const result = mergeDistinctOcrChunks(chunks);
  assert.deepEqual(result, [
    'SEMANA 19\nSEGUNDA\nBACK SQUAT',
    'SEMANA 19\nTERÇA\nFRAN',
  ]);
});

test('normalização de OCR de vídeo compara chunks equivalentes', () => {
  assert.equal(normalizeOcrChunk('  Semana 19 \n Segunda '), 'SEMANA 19 SEGUNDA');
});

test('amostragem de vídeo reduz frames por padrão conforme duração', () => {
  assert.equal(resolveMaxVideoFrames(4), 4);
  assert.equal(resolveMaxVideoFrames(15), 6);
  assert.equal(resolveMaxVideoFrames(40), 8);
  assert.equal(resolveMaxVideoFrames(120), 12);
  assert.equal(resolveMaxVideoFrames(40, 3), 3);
});
