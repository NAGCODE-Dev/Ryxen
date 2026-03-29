import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const GYM_SERVICE_PATH = new URL('../src/core/services/gymService.js', import.meta.url);
const SW_PATH = new URL('../sw.js', import.meta.url);

async function loadServiceWorkerContracts() {
  const swSource = await readFile(SW_PATH, 'utf8');
  const script = `${swSource}\n;globalThis.__SW_TEST__ = { CORE_ASSETS, resolveNavigationFallback };`;
  const listeners = new Map();
  const self = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    location: { origin: 'https://crossapp.local' },
    skipWaiting() {},
    clients: { claim() {} },
  };
  const context = vm.createContext({
    self,
    URL,
    Response,
    caches: {
      open: async () => ({ match: async () => null, put: async () => null, add: async () => null }),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => ({ status: 200, type: 'basic', clone() { return this; } }),
  });
  vm.runInContext(script, context);
  return context.__SW_TEST__;
}

test('gymService exporta getAthleteDashboard', async () => {
  const gymService = await import(GYM_SERVICE_PATH.href);
  assert.equal(typeof gymService.getAthleteDashboard, 'function');
});

test('service worker referencia entrypoints atuais dos esportes', async () => {
  const { CORE_ASSETS } = await loadServiceWorkerContracts();

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
    assert.ok(CORE_ASSETS.includes(entry), `Entry ausente no CORE_ASSETS: ${entry}`);
  }
});

test('service worker aplica fallback de navegação por esporte', async () => {
  const { resolveNavigationFallback } = await loadServiceWorkerContracts();
  assert.equal(resolveNavigationFallback('/sports/running'), './sports/running/index.html');
  assert.equal(resolveNavigationFallback('/sports/strength/history'), './sports/strength/index.html');
  assert.equal(resolveNavigationFallback('/sports/cross/wod'), './sports/cross/index.html');
  assert.equal(resolveNavigationFallback('/'), './index.html');
});
