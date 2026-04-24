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
      nativeApiBaseUrl: 'https://api.example.com',
      auth: {
        appLinkBaseUrl: 'https://ryxen-app.vercel.app/auth/callback',
      },
    },
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  const { buildGoogleRedirectUrl } = await import(`../src/core/services/authService.js?test=${Date.now()}`);
  assert.equal(buildGoogleRedirectUrl().toString(), 'https://crossapp.com/api/auth/google/start');
});

test('startGoogleRedirect gera prova local e envia challenge efêmero no fluxo nativo', async (t) => {
  const storage = createStorageMock();
  let redirectedUrl = '';
  globalThis.localStorage = storage;
  globalThis.window = {
    location: {
      href: 'https://localhost/sports/cross/index.html',
      origin: 'https://localhost',
      pathname: '/sports/cross/index.html',
      search: '',
      protocol: 'https:',
      hostname: 'localhost',
      assign(url) {
        redirectedUrl = String(url);
      },
    },
    localStorage: storage,
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
      nativeApiBaseUrl: 'https://api.example.com',
      auth: {
        appLinkBaseUrl: 'https://ryxen-app.vercel.app/auth/callback',
      },
    },
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  const { startGoogleRedirect } = await import(`../src/core/services/authService.js?test=${Date.now()}-native-start`);
  await startGoogleRedirect({ returnTo: '/sports/cross/index.html' });

  const target = new URL(redirectedUrl);
  assert.equal(target.pathname, '/auth/google/start');
  assert.equal(target.searchParams.get('returnTo'), '/sports/cross/index.html');
  assert.equal(target.searchParams.get('appCallback'), 'https://ryxen-app.vercel.app/auth/callback?returnTo=%2Fsports%2Fcross%2Findex.html');
  assert.equal(typeof target.searchParams.get('deviceId'), 'string');
  assert.match(target.searchParams.get('codeChallenge') || '', /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(target.searchParams.get('codeChallengeMethod') || '', /^(S256|PLAIN)$/);
});

test('applyAuthRedirectFromUrl troca authCode do callback nativo sem expor JWT na URL', async (t) => {
  const storage = createStorageMock();
  globalThis.localStorage = storage;
  let redirectedUrl = '';
  globalThis.window = {
    location: {
      href: 'https://localhost/sports/cross/index.html',
      origin: 'https://localhost',
      pathname: '/sports/cross/index.html',
      search: '',
      protocol: 'https:',
      hostname: 'localhost',
      assign(url) {
        redirectedUrl = String(url);
      },
    },
    atob(value) {
      return Buffer.from(value, 'base64').toString('utf8');
    },
    history: { replaceState() {} },
    localStorage: storage,
    __RYXEN_CONFIG__: {
      apiBaseUrl: '/api',
      nativeApiBaseUrl: 'https://api.example.com',
      auth: {
        appLinkBaseUrl: 'https://ryxen-app.vercel.app/auth/callback',
      },
    },
  };
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.authCode, 'code-123');
    assert.equal(typeof body.deviceId, 'string');
    assert.match(String(body.authVerifier || ''), /^[A-Za-z0-9\-._~]{43,128}$/);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          token: 'abc123',
          user: { email: 'athlete@test.local' },
          returnTo: '/sports/cross/index.html',
        });
      },
    };
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    delete globalThis.fetch;
  });

  const mod = await import(`../src/core/services/authService.js?test=${Date.now()}1`);
  await mod.startGoogleRedirect({ returnTo: '/sports/cross/index.html' });
  assert.match(redirectedUrl, /codeChallenge=/);

  const { applyAuthRedirectFromUrl, getStoredProfile } = mod;
  const result = await applyAuthRedirectFromUrl('https://ryxen-app.vercel.app/auth/callback?returnTo=%2Fsports%2Fcross%2Findex.html&authCode=code-123');

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

test('requestPasswordReset envia contexto do aparelho junto com o email', async (t) => {
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

  let requestBody = null;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ success: true, deliveryStatus: 'admin_review_pending' });
      },
    };
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    delete globalThis.fetch;
  });

  const mod = await import(`../src/core/services/authService.js?test=${Date.now()}-reset`);
  await mod.requestPasswordReset({ email: 'nagcode.contact@gmail.com' });

  assert.equal(requestBody.email, 'nagcode.contact@gmail.com');
  assert.equal(typeof requestBody.deviceId, 'string');
  assert.match(requestBody.deviceLabel, /UnitTestBrowser/);
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

test('signOut envia contexto do aparelho para revogação server-side', async (t) => {
  const storage = createStorageMock();
  storage.setItem('ryxen-auth-token', 'token-abc');
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
        return JSON.stringify({ success: true });
      },
    };
  };

  t.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    delete globalThis.fetch;
  });

  const mod = await import(`../src/core/services/authService.js?test=${Date.now()}-signout`);
  await mod.signOut();

  assert.equal(typeof requestBody.deviceId, 'string');
  assert.equal(storage.getItem('ryxen-auth-token'), null);
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
