import test from 'node:test';
import assert from 'node:assert/strict';

test('getRuntimeConfig não usa fallback implícito de emulador em runtime nativo real', async () => {
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
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  try {
    const runtime = await import(`../src/config/runtime.js?native-test-device=${Date.now()}`);
    const config = runtime.getRuntimeConfig();
    assert.equal(config.apiBaseUrl, '');
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});

test('getRuntimeConfig usa fallback do emulador apenas quando target nativo é emulator', async () => {
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
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
      native: {
        target: 'emulator',
      },
    },
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  try {
    const runtime = await import(`../src/config/runtime.js?native-test-emulator=${Date.now()}`);
    const config = runtime.getRuntimeConfig();
    assert.equal(config.apiBaseUrl, 'http://10.0.2.2:8787');
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});
