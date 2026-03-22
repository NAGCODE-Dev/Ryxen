import test from 'node:test';
import assert from 'node:assert/strict';

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

function createStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('buildGoogleRedirectUrl resolve apiBaseUrl relativa no browser', async (t) => {
  const storage = createStorageMock();
  globalThis.localStorage = storage;
  globalThis.window = {
    location: {
      href: 'https://crossapp.com/sports/cross/index.html',
      origin: 'https://crossapp.com',
      pathname: '/sports/cross/index.html',
      search: '',
    },
    localStorage: storage,
    __CROSSAPP_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  const { buildGoogleRedirectUrl } = await import(`../src/core/services/authService.js?test=${Date.now()}`);
  assert.equal(buildGoogleRedirectUrl().toString(), 'https://crossapp.com/api/auth/google/start');
});
