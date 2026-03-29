import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const GYM_SERVICE_PATH = new URL('../src/core/services/gymService.js', import.meta.url);
const SW_PATH = new URL('../sw.js', import.meta.url);

test('gymService exporta getAthleteDashboard', async () => {
  const gymService = await import(GYM_SERVICE_PATH.href);
  assert.equal(typeof gymService.getAthleteDashboard, 'function');
});

test('service worker referencia entrypoints atuais dos esportes', async () => {
  const swSource = await readFile(SW_PATH, 'utf8');

  const requiredEntries = [
    './src/hub/main.js',
    './src/hub/styles.css',
    './sports/running/main.js',
    './sports/strength/main.js',
    './sports/cross/index.html',
    './sports/running/index.html',
    './sports/strength/index.html',
  ];

  for (const entry of requiredEntries) {
    assert.ok(swSource.includes(entry), `Entry ausente no sw.js: ${entry}`);
  }
});

test('service worker aplica fallback de navegação por esporte', async () => {
  const swSource = await readFile(SW_PATH, 'utf8');

  const requiredFallbacks = [
    "pathname.startsWith('/sports/running')",
    "pathname.startsWith('/sports/strength')",
    "pathname.startsWith('/sports/cross')",
    "return './sports/running/index.html'",
    "return './sports/strength/index.html'",
    "return './sports/cross/index.html'",
  ];

  for (const snippet of requiredFallbacks) {
    assert.ok(swSource.includes(snippet), `Fallback ausente no sw.js: ${snippet}`);
  }
});
