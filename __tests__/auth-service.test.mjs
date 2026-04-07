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
    __RYXEN_CONFIG__: {
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

test('applyAuthRedirectFromUrl le auth em querystring de callback nativo', async (t) => {
  const storage = createStorageMock();
  globalThis.localStorage = storage;
  globalThis.window = {
    location: {
      href: 'https://crossapp.com/sports/cross/index.html',
      origin: 'https://crossapp.com',
      pathname: '/sports/cross/index.html',
      search: '',
    },
    atob(value) {
      return Buffer.from(value, 'base64').toString('utf8');
    },
    history: { replaceState() {} },
    localStorage: storage,
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  const authUser = Buffer.from(JSON.stringify({ email: 'athlete@test.local' }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const { applyAuthRedirectFromUrl, getStoredProfile } = await import(`../src/core/services/authService.js?test=${Date.now()}1`);
  const result = applyAuthRedirectFromUrl(`crossapp://auth/callback?returnTo=%2Fsports%2Fcross%2Findex.html&authToken=abc123&authUser=${authUser}`);

  assert.equal(result.handled, true);
  assert.equal(result.success, true);
  assert.equal(result.returnTo, '/sports/cross/index.html');
  assert.equal(storage.getItem('ryxen-auth-token'), 'abc123');
  assert.equal(storage.getItem('crossapp-auth-token'), 'abc123');
  assert.deepEqual(JSON.parse(storage.getItem('ryxen-user-profile')), { email: 'athlete@test.local' });
  assert.deepEqual(getStoredProfile(), { email: 'athlete@test.local' });
});
