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

test('signIn salva grant de dispositivo confiavel quando backend devolve trustedDevice', async (t) => {
  const storage = createStorageMock();
  globalThis.localStorage = storage;
  globalThis.window = {
    location: {
      href: 'https://crossapp.com/sports/cross/index.html',
      origin: 'https://crossapp.com',
      pathname: '/sports/cross/index.html',
      search: '',
      protocol: 'https:',
      hostname: 'crossapp.com',
    },
    navigator: { userAgent: 'UnitTestBrowser/1.0' },
    localStorage: storage,
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };

  const fetchCalls = [];
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    const parsedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          token: 'token-123',
          user: { email: 'nagcode.contact@gmail.com' },
          trustedDevice: {
            deviceId: parsedBody.deviceId,
            trustedToken: 'grant-abc',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        });
      },
    };
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    delete globalThis.fetch;
  });

  const mod = await import(`../src/core/services/authService.js?test=${Date.now()}2`);
  await mod.signIn({ email: 'nagcode.contact@gmail.com', password: 'Nikolas1809@' });

  assert.equal(fetchCalls.length, 1);
  const body = JSON.parse(fetchCalls[0].options.body);
  assert.equal(body.email, 'nagcode.contact@gmail.com');
  assert.equal(typeof body.deviceId, 'string');
  assert.equal(mod.hasTrustedDeviceGrant('nagcode.contact@gmail.com'), true);
  assert.equal(mod.getLastAuthEmail(), 'nagcode.contact@gmail.com');
});

test('signInWithTrustedDevice usa grant salvo no mesmo aparelho', async (t) => {
  const storage = createStorageMock();
  storage.setItem('ryxen-trusted-device-id', 'device-123');
  storage.setItem('ryxen-trusted-device-map', JSON.stringify({
    'nagcode.contact@gmail.com': {
      trustedToken: 'grant-abc',
      deviceId: 'device-123',
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  }));

  globalThis.localStorage = storage;
  globalThis.window = {
    location: {
      href: 'https://crossapp.com/sports/cross/index.html',
      origin: 'https://crossapp.com',
      pathname: '/sports/cross/index.html',
      search: '',
      protocol: 'https:',
      hostname: 'crossapp.com',
    },
    navigator: { userAgent: 'UnitTestBrowser/1.0' },
    localStorage: storage,
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };

  let requestBody = null;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          token: 'token-456',
          user: { email: 'nagcode.contact@gmail.com' },
          trustedDevice: {
            deviceId: 'device-123',
            trustedToken: 'grant-next',
            expiresAt: '2099-01-02T00:00:00.000Z',
          },
        });
      },
    };
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    delete globalThis.fetch;
  });

  const mod = await import(`../src/core/services/authService.js?test=${Date.now()}3`);
  await mod.signInWithTrustedDevice({ email: 'nagcode.contact@gmail.com' });

  assert.equal(requestBody.email, 'nagcode.contact@gmail.com');
  assert.equal(requestBody.deviceId, 'device-123');
  assert.equal(requestBody.trustedToken, 'grant-abc');
  assert.equal(mod.hasTrustedDeviceGrant('nagcode.contact@gmail.com'), true);
});

test('getTrustedDeviceUiState ajusta a UX conforme o grant do aparelho', async (t) => {
  const storage = createStorageMock();
  storage.setItem('ryxen-trusted-device-id', 'device-123');
  storage.setItem('ryxen-trusted-device-map', JSON.stringify({
    'nagcode.contact@gmail.com': {
      trustedToken: 'grant-abc',
      deviceId: 'device-123',
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  }));

  globalThis.localStorage = storage;
  globalThis.window = {
    location: {
      href: 'https://crossapp.com/sports/cross/index.html',
      origin: 'https://crossapp.com',
      pathname: '/sports/cross/index.html',
      search: '',
      protocol: 'https:',
      hostname: 'crossapp.com',
    },
    navigator: { userAgent: 'UnitTestBrowser/1.0' },
    localStorage: storage,
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
    },
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  const { getTrustedDeviceUiState } = await import(`../apps/athlete/features/account/trustedDeviceUi.js?test=${Date.now()}4`);

  assert.equal(getTrustedDeviceUiState('').isTrusted, true);
  assert.equal(getTrustedDeviceUiState('').resolvedEmail, 'nagcode.contact@gmail.com');
  assert.equal(getTrustedDeviceUiState('').hintTitle, 'Continuar neste aparelho');
  assert.equal(getTrustedDeviceUiState('other@example.com').hintTitle, 'Primeiro acesso neste aparelho');
  assert.equal(getTrustedDeviceUiState('nagcode.contact@gmail.com').isTrusted, true);
  assert.equal(getTrustedDeviceUiState('nagcode.contact@gmail.com').submitLabel, 'Entrar com senha');
  assert.equal(getTrustedDeviceUiState('nagcode.contact@gmail.com').trustedSubmitLabel, 'Entrar sem senha neste aparelho');
});
