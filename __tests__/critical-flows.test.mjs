import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateLoads } from '../src/core/usecases/calculateLoads.js';
import { exportAppBackup, importAppBackup } from '../src/core/usecases/backupData.js';
import { importPRsFromCSV } from '../src/core/usecases/importPRsFromCSV.js';
import { parseMultiWeekPdf } from '../src/adapters/pdf/customPdfParser.js';

test('calcula cargas para treino válido', () => {
  const workout = {
    day: 'Segunda',
    sections: [
      { lines: ['BACK SQUAT', '3x5 @80'] },
    ],
  };
  const prs = { 'BACK SQUAT': 100 };
  const preferences = { showLbsConversion: false };

  const result = calculateLoads(workout, prs, preferences);
  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.data));
  assert.equal(result.totalLines, 2);
});

test('backup roundtrip preserva dados essenciais', () => {
  const state = {
    prs: { 'BACK SQUAT': 120 },
    preferences: { showEmojis: true },
    weeks: [{ weekNumber: 19, workouts: [{ day: 'Segunda', blocks: [] }] }],
    activeWeekNumber: 19,
    currentDay: 'Segunda',
  };

  const exported = exportAppBackup(state);
  assert.equal(exported.success, true);

  const imported = importAppBackup(exported.json);
  assert.equal(imported.success, true);
  assert.equal(imported.data.activeWeekNumber, 19);
  assert.equal(imported.data.currentDay, 'Segunda');
  assert.equal(imported.data.prs['BACK SQUAT'], 120);
});

test('importa PRs de CSV', () => {
  const csv = 'Exercício,Carga (kg)\nBACK SQUAT,140\nDEADLIFT,180';
  const result = importPRsFromCSV(csv);
  assert.equal(result.success, true);
  assert.equal(result.imported, 2);
  assert.equal(result.data['BACK SQUAT'], 140);
});

test('parser multi-semana identifica semanas por texto', () => {
  const text = `
SEMANA 19
SEGUNDA
BACK SQUAT
3x5 @80
SEMANA 20
TERÇA
DEADLIFT
3x3 @85
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  assert.equal(Array.isArray(weeks), true);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].weekNumber, 19);
  assert.equal(weeks[1].weekNumber, 20);
});

test('parser rico preserva compatibilidade e adiciona metadados de sessão/carga', () => {
  const text = `
SEMANA 19
QUARTA
MANHÃ
WOD
4X
10 SINGLE DB BOX STEP OVER (50-60CM) 50-35LBS
20 WBs 20-14lbs
80 DUs
3' RECOVERY ROW
1' REST TOTAL
OBJETIVO = Sub 3'30 por round
TARDE
WOD
12' AMRAP
10 ALT DB POWER SNATCH 50-35lbs
10m SINGLE DB OH WALKING LUNGE (alt como quiser)
5 MUs (ou 5 BMU)
OBJETIVO = acima de 7 rounds
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].workouts.length, 1);

  const workout = weeks[0].workouts[0];
  assert.equal(workout.day, 'Quarta');
  assert.equal(Array.isArray(workout.blocks), true);
  assert.equal(workout.blocks.length, 2);
  assert.equal(workout.blocks[0].period, 'manhã');
  assert.equal(workout.blocks[1].period, 'tarde');
  assert.equal(workout.blocks[0].lines.includes("4X"), true);
  assert.equal(workout.blocks[0].parsed.rounds, 4);
  assert.equal(workout.blocks[1].parsed.format, 'amrap');
  assert.equal(workout.blocks[1].parsed.timeCapMinutes, 12);
  assert.equal(workout.blocks[0].parsed.goal, "Sub 3'30 por round");

  const firstMovement = workout.blocks[0].parsed.items.find((item) => item.type === 'movement');
  assert.equal(firstMovement.load.maleLb, 50);
  assert.equal(firstMovement.load.femaleLb, 35);
  assert.equal(firstMovement.load.maleKg, 22.7);
  assert.equal(firstMovement.boxHeightCm.min, 50);
  assert.equal(firstMovement.boxHeightCm.max, 60);
});

test('parser rico reconhece strength, accessories, gymnastics e engine com mais precisão', () => {
  const text = `
SEMANA 19
QUARTA
LOW INTENSITY ROW
3X
15 MIN
3 MIN REST
Frequência cardíaca jamais acima de 180 - idade
TARDE
*Treinos de ginástica são por qualidade e não por tempo
GYMNASTICS 1
4X
5 STRICT PULL UPS PEGADA SUPINADA
10 GHD SIT UPs
5 BMUs
RECOVERY ROW(O TEMPO QUE FOR NECESSÁRIO)
CLEAN PULL + LOW HANG SQUAT CLEAN + PUSH PRESS
1+1+1@?
1+1+1@?
FRONT SQUAT + DB VERTICAL JUMP
9@?+2
REST 3'
ACESSORIOS
BULGARIAN DL (não precisa ser pesado) 3x10
ROWER HAMSTRING BRIDGES 3x15
SUPINO PEGADA FECHADA 4x8
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  const workout = weeks[0].workouts[0];

  const engineBlock = workout.blocks.find((block) => block.type === 'ENGINE');
  assert.ok(engineBlock);
  assert.equal(engineBlock.parsed.engine.rounds, 3);
  assert.equal(engineBlock.parsed.engine.workMinutes, 15);
  assert.equal(engineBlock.parsed.engine.restMinutes, 3);
  assert.equal(engineBlock.parsed.engine.constraints[0].formula, '180 - age');

  const gymnasticsBlock = workout.blocks.find((block) => block.type === 'GYMNASTICS');
  assert.ok(gymnasticsBlock);
  assert.equal(gymnasticsBlock.parsed.gymnastics.rounds, 4);
  assert.equal(gymnasticsBlock.parsed.gymnastics.movements[0].reps, 5);

  const strengthBlocks = workout.blocks.filter((block) => block.type === 'STRENGTH');
  assert.equal(strengthBlocks.length >= 2, true);
  assert.equal(strengthBlocks[0].parsed.strength.sets[0].scheme, '1+1+1');
  assert.equal(strengthBlocks[1].parsed.strength.sets[0].pairedReps, 2);

  const accessoriesBlock = workout.blocks.find((block) => block.type === 'ACCESSORIES');
  assert.ok(accessoriesBlock);
  assert.equal(accessoriesBlock.parsed.accessories.length, 3);
  assert.equal(accessoriesBlock.parsed.accessories[0].sets, 3);
  assert.equal(accessoriesBlock.parsed.accessories[0].reps, 10);
});

test('parser rico reconhece formatos emom e for time com cap', () => {
  const text = `
SEMANA 21
SEXTA
WOD
18' EMOM
2 POWER CLEAN
WOD 2
FOR TIME
CAP 9'
21-15-9 THRUSTERS
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  const workout = weeks[0].workouts[0];

  assert.equal(workout.blocks[0].parsed.format, 'emom');
  assert.equal(workout.blocks[0].parsed.timeCapMinutes, 18);
  assert.equal(workout.blocks[1].parsed.format, 'for_time');
  assert.equal(workout.blocks[1].parsed.timeCapMinutes, 9);
});

test('parser rico normaliza siglas comuns de movimentos para nomes canônicos', () => {
  const text = `
SEMANA 22
QUARTA
WOD
12' AMRAP
20 WBs 20-14lbs
80 DUs
5 MUs (ou 5 BMU)
10 ALT DB POWER SNATCH 50-35lbs
ACESSORIOS
SUPINO PEGADA FECHADA 4x8
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  const workout = weeks[0].workouts[0];
  const wodBlock = workout.blocks.find((block) => block.type === 'WOD');
  const accessoriesBlock = workout.blocks.find((block) => block.type === 'ACCESSORIES');

  const movements = wodBlock.parsed.items.filter((item) => item.type === 'movement');
  assert.equal(movements[0].name, 'wall ball');
  assert.equal(movements[0].canonicalSlug, 'wall-ball');
  assert.equal(movements[1].name, 'double unders');
  assert.equal(movements[2].name, 'muscle-up');
  assert.equal(movements[2].alternatives[0], 'bar muscle-up');
  assert.equal(movements[3].name, 'alternating dumbbell power snatch');

  assert.equal(accessoriesBlock.parsed.accessories[0].name, 'supino pegada fechada');
  assert.equal(accessoriesBlock.parsed.accessories[0].canonicalSlug, 'supino-pegada-fechada');
});

test('parser lida melhor com padrões reais do pdf 7 da bsb strong', () => {
  const text = `
SEMANA 19
SEGUNDA
WOD
(5x)
4 WALL WALKS
10 CTBs
10 KB SWING 24/16kg
Objetivo=approx 8 min

WOD 2
(3x)
75 DUs
20 GHD SIT UPs
3 ROPE CLIMBS
REST 3\`
Objetivo=approx 3\` min por round

TERÇA
SQUAT SNATCH
A CADA 60 SEC
1@85% (x5)

SEX
SQUAT CLEAN + JERK
EVERY 60 seg (x3)
1+1@85%
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  const monday = weeks[0].workouts.find((workout) => workout.day === 'Segunda');
  const tuesday = weeks[0].workouts.find((workout) => workout.day === 'Terça');
  const friday = weeks[0].workouts.find((workout) => workout.day === 'Sexta');

  assert.equal(monday.blocks[0].parsed.rounds, 5);
  assert.equal(monday.blocks[0].parsed.items[2].name, 'chest-to-bar pull-up');
  assert.equal(monday.blocks[0].parsed.items[3].load.maleKg, 24);
  assert.equal(monday.blocks[0].parsed.items[3].load.femaleKg, 16);
  assert.equal(monday.blocks[1].parsed.rounds, 3);
  assert.equal(monday.blocks[1].parsed.items.some((item) => item.type === 'rest'), true);

  assert.equal(tuesday.blocks[0].type, 'STRENGTH');
  assert.equal(tuesday.blocks[0].parsed.format, 'emom');
  assert.equal(tuesday.blocks[0].parsed.strength.cadenceSeconds, 60);
  assert.equal(tuesday.blocks[0].parsed.strength.sets[0].percent, 85);
  assert.equal(tuesday.blocks[0].parsed.strength.sets[0].repeatCount, 5);

  assert.equal(friday.blocks[0].type, 'STRENGTH');
  assert.equal(friday.blocks[0].parsed.strength.cadenceRepeats, 3);
});

test('parser lida com ondas de reps e linhas de acumular do pdf 7', () => {
  const text = `
SEMANA 19
QUI
WOD 2
(4-4-4)(8-8-8))(12-12-12)(8-8-8)(4-4-4)
THRUSTERS 95-65lbs
SHUTTLE RUN(7.5m = 1 rep)
BURPEE FACING BAR

SEX
STRICT HSPU
Acumular 40 reps quebrando o mínimo possível
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  const thursday = weeks[0].workouts.find((workout) => workout.day === 'Quinta');
  const friday = weeks[0].workouts.find((workout) => workout.day === 'Sexta');

  assert.equal(thursday.blocks[0].parsed.items[0].type, 'rep_wave');
  assert.match(thursday.blocks[0].parsed.items[0].text, /12-12-12/);
  assert.equal(friday.blocks[0].parsed.items[1].type, 'accumulation');
  assert.equal(friday.blocks[0].parsed.items[1].reps, 40);
});

test('parser lida melhor com intervalos em segundos e schemes de strength do pdf 6', () => {
  const text = `
SEMANA 18
SEGUNDA
WOD
(6x)
40 SEG MUs
20 SEC OFF
40 SEC ASSAULT
20 SEC OFF
40 SEC DB BURPEE(50/35lbs)
20 SEC OFF
40 SEC TTBs
20 SEC OFF
40 SEC WALL WALK
1\`20 REST
Objetivo= acima de 7 mu por round/acima de 11/14 cal assault por round/acima de 9 burpee por
round/acima de approx 20 TTB por round/3 wall walks

TERÇA
SQUAT SNATCH
A CADA 60 SEC
1@82% x4

SEX
BACK SQUATS
4x4 @82%
  `.trim();

  const weeks = parseMultiWeekPdf(text);
  const monday = weeks[0].workouts.find((workout) => workout.day === 'Segunda');
  const tuesday = weeks[0].workouts.find((workout) => workout.day === 'Terça');
  const friday = weeks[0].workouts.find((workout) => workout.day === 'Sexta');
  const mondayIntervals = monday.blocks[0].parsed.items.filter((item) => item.durationSeconds);
  const mondayRests = monday.blocks[0].parsed.items.filter((item) => item.type === 'rest');
  const mondayMovements = monday.blocks[0].parsed.items.filter((item) => item.type === 'movement');

  assert.equal(monday.blocks[0].parsed.rounds, 6);
  assert.equal(monday.blocks[0].parsed.goal.includes('round/acima de approx 20 TTB por round/3 wall walks'), true);
  assert.equal(mondayMovements[0].durationSeconds, 40);
  assert.equal(mondayMovements[0].name, 'muscle-up');
  assert.equal(mondayMovements[1].name, 'assault');
  assert.equal(mondayRests[0].durationSeconds, 20);
  assert.equal(mondayIntervals.some((item) => item.durationSeconds === 80), true);

  assert.equal(tuesday.blocks[0].type, 'STRENGTH');
  assert.equal(tuesday.blocks[0].parsed.strength.cadenceSeconds, 60);
  assert.equal(tuesday.blocks[0].parsed.strength.sets[0].reps, 1);
  assert.equal(tuesday.blocks[0].parsed.strength.sets[0].percent, 82);
  assert.equal(tuesday.blocks[0].parsed.strength.sets[0].repeatCount, 4);

  assert.equal(friday.blocks[0].type, 'STRENGTH');
  assert.equal(friday.blocks[0].parsed.strength.sets[0].sets, 4);
  assert.equal(friday.blocks[0].parsed.strength.sets[0].reps, 4);
  assert.equal(friday.blocks[0].parsed.strength.sets[0].percent, 82);
});
