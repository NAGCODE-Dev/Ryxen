import test from 'node:test';
import assert from 'node:assert/strict';

test('getRuntimeConfig usa fallback do emulador Android quando runtime nativo mantém /api', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => true,
    },
    location: {
      protocol: 'https:',
      hostname: 'localhost',
    },
    __CROSSAPP_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  try {
    const runtime = await import(`../src/config/runtime.js?native-test=${Date.now()}`);
    const config = runtime.getRuntimeConfig();
    assert.equal(config.apiBaseUrl, 'http://10.0.2.2:8787');
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});

