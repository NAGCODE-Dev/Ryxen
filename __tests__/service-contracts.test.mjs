import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('gymService exports getAthleteDashboard for running/strength entry points', async () => {
  const gymService = await read('src/core/services/gymService.js');
  assert.match(
    gymService,
    /export\s+async\s+function\s+getAthleteDashboard\s*\(/,
    'Expected src/core/services/gymService.js to export getAthleteDashboard()',
  );
});

test('service worker precaches the current hub entry and sport entrypoints', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /src\/hub\/main\.js/, 'Expected sw.js to precache src/hub/main.js');
  assert.match(sw, /src\/hub\/styles\.css/, 'Expected sw.js to precache src/hub/styles.css');
  assert.match(sw, /sports\/running\/main\.js/, 'Expected sw.js to precache sports/running/main.js');
  assert.match(sw, /sports\/strength\/main\.js/, 'Expected sw.js to precache sports/strength/main.js');
});

test('service worker uses a versioned cache name', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /crossapp-v\d+-\d+/, 'Expected a versioned cache name in sw.js');
});
