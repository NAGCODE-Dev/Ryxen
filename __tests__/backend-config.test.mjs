import test from 'node:test';
import assert from 'node:assert/strict';

const config = await import(`../backend/src/config.js?backend-config-test=${Date.now()}`);

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

test('isAllowedOrigin aceita origins padrão do app nativo', () => {
  assert.equal(config.isAllowedOrigin('capacitor://localhost'), true);
  assert.equal(config.isAllowedOrigin('https://localhost'), true);
  assert.equal(config.isAllowedOrigin('http://localhost'), true);
});

test('validateConfig falha se EXPOSE_RESET_CODE estiver ativo em produção', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousExposeResetCode = process.env.EXPOSE_RESET_CODE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousFrontendOrigin = process.env.FRONTEND_ORIGIN;

  process.env.NODE_ENV = 'production';
  process.env.EXPOSE_RESET_CODE = 'true';
  process.env.DATABASE_URL = 'postgres://example/test';
  process.env.JWT_SECRET = 'super-secret-production-value';
  process.env.FRONTEND_ORIGIN = 'https://app.example.com';

  try {
    const productionConfig = await import(`../backend/src/config.js?backend-config-production-test=${Date.now()}`);
    assert.throws(() => productionConfig.validateConfig(), /EXPOSE_RESET_CODE/);
  } finally {
    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('EXPOSE_RESET_CODE', previousExposeResetCode);
    restoreEnv('DATABASE_URL', previousDatabaseUrl);
    restoreEnv('JWT_SECRET', previousJwtSecret);
    restoreEnv('FRONTEND_ORIGIN', previousFrontendOrigin);
  }
});
