import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let express;
let createAdminOpsRouter;
let createBillingRouter;
let createGymRouter;
let createLeaderboardRouter;
let createTelemetryRouter;
let hasBackendRuntime = false;

try {
  express = require('../backend/node_modules/express');
  ({ createAdminOpsRouter } = await import('../backend/src/routes/adminOpsRoutes.js'));
  ({ createBillingRouter } = await import('../backend/src/routes/billingRoutes.js'));
  ({ createGymRouter } = await import('../backend/src/routes/gymRoutes.js'));
  ({ createLeaderboardRouter } = await import('../backend/src/routes/leaderboardRoutes.js'));
  ({ createTelemetryRouter } = await import('../backend/src/routes/telemetryRoutes.js'));
  hasBackendRuntime = true;
} catch (error) {
  console.warn('[route-security-hardening] dependências do backend ausentes; testes de rota serão pulados:', error?.message || error);
}

const routeTest = hasBackendRuntime ? test : test.skip;

function allowUser(user = {}) {
  return (req, res, next) => {
    void res;
    req.user = {
      userId: 1,
      email: 'tester@example.com',
      isAdmin: false,
      ...user,
    };
    req.requestId = 'req-test-001';
    return next();
  };
}

async function withServer(router, run) {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, req, res, next) => {
    void req;
    void next;
    res.status(500).json({ error: error?.message || 'internal_error' });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

routeTest('billing webhook rejeita token enviado por query string e registra tentativa', async () => {
  const opsEvents = [];
  const router = createBillingRouter({
    logOpsEventFn: async (event) => {
      opsEvents.push(event);
      return { id: 1 };
    },
    validateWebhookTokenFn: () => false,
    describeWebhookTokenTransportFn: () => 'query',
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/kiwify/webhook?token=leaked-token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'compra_aprovada' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Token do webhook deve ser enviado por header');
  });

  assert.equal(opsEvents.length, 1);
  assert.equal(opsEvents[0].kind, 'billing_webhook');
  assert.equal(opsEvents[0].status, 'rejected_token_transport');
  assert.equal(opsEvents[0].payload.tokenTransport, 'query');
});

routeTest('billing webhook exige evento identificado antes de enfileirar qualquer claim', async () => {
  const opsEvents = [];
  const router = createBillingRouter({
    logOpsEventFn: async (event) => {
      opsEvents.push(event);
      return { id: 2 };
    },
    validateWebhookTokenFn: () => true,
    describeWebhookTokenTransportFn: () => 'header',
    queueBillingClaimFn: async () => {
      throw new Error('queueBillingClaim não deveria rodar');
    },
    queueBillingReversalClaimFn: async () => {
      throw new Error('queueBillingReversalClaim não deveria rodar');
    },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/kiwify/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kiwify-webhook-token': 'header-token',
      },
      body: JSON.stringify({ customer: { email: 'athlete@example.com' } }),
    });
    const payload = await response.json();

    assert.equal(response.status, 422);
    assert.equal(payload.error, 'Evento do webhook não identificado');
  });

  assert.equal(opsEvents.length, 1);
  assert.equal(opsEvents[0].status, 'missing_event_type');
  assert.equal(opsEvents[0].payload.tokenTransport, 'header');
});

routeTest('rota admin bloqueia processamento quando middleware nega acesso', async () => {
  let retryCalls = 0;
  const router = createAdminOpsRouter({
    adminMiddleware: (req, res) => {
      void req;
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    },
    retryEmailJobFn: async () => {
      retryCalls += 1;
      return null;
    },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/email/jobs/42/retry`, {
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error, 'Acesso restrito a administradores');
  });

  assert.equal(retryCalls, 0);
});

routeTest('rota admin registra auditoria forte em retry de email job', async () => {
  const opsEvents = [];
  const auditEvents = [];
  const router = createAdminOpsRouter({
    adminMiddleware: allowUser({
      userId: 99,
      email: 'admin@example.com',
      isAdmin: true,
    }),
    retryEmailJobFn: async (jobId) => ({
      job: {
        id: jobId,
        status: 'queued',
        email: 'athlete@example.com',
        userId: 21,
        kind: 'password_reset',
        provider: 'smtp',
        retryCount: 2,
      },
      provider: 'smtp',
      messageId: 'msg-123',
    }),
    logOpsEventFn: async (event) => {
      opsEvents.push(event);
      return { id: 3 };
    },
    auditLogger: async (event) => {
      auditEvents.push(event);
      return { id: 4 };
    },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/admin/email/jobs/42/retry`, {
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.job.id, 42);
    assert.equal(payload.delivery.messageId, 'msg-123');
  });

  assert.equal(opsEvents.length, 1);
  assert.equal(opsEvents[0].kind, 'email_job_retry');
  assert.equal(opsEvents[0].status, 'queued');
  assert.equal(opsEvents[0].userId, 21);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, 'email.job.retry');
  assert.equal(auditEvents[0].actorUserId, 99);
  assert.equal(auditEvents[0].actorEmail, 'admin@example.com');
  assert.equal(auditEvents[0].targetUserId, 21);
  assert.equal(auditEvents[0].targetEmail, 'athlete@example.com');
  assert.equal(auditEvents[0].payload.jobId, 42);
});

routeTest('rota de memberships do gym corta acesso de quem nao gerencia o gym', async () => {
  const router = createGymRouter({
    authMiddleware: allowUser({
      userId: 7,
      email: 'athlete@example.com',
    }),
    requireGymManager: async () => ({
      success: false,
      code: 403,
      error: 'Sem acesso ao gym',
    }),
    slugify: (value) => String(value || '').trim().toLowerCase(),
    enrichWorkoutWithBenchmark: (workout) => workout,
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/gyms/15/memberships`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error, 'Sem acesso ao gym');
  });
});

routeTest('leaderboard respeita contexto de permissao ao decidir dados privados', async () => {
  const capturedCalls = [];
  const router = createLeaderboardRouter({
    authMiddleware: allowUser({
      userId: 8,
      email: 'athlete@example.com',
    }),
    getMembershipForUserFn: async (gymId, userId) => ({
      gym_id: gymId,
      user_id: userId,
      role: 'athlete',
      status: 'active',
    }),
    canManageMembershipFn: (membership) => membership?.role === 'coach',
    getBenchmarkLeaderboardFn: async (args) => {
      capturedCalls.push(args);
      return { rows: [] };
    },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/leaderboards/benchmarks/fran?gymId=3&limit=12`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { rows: [] });
  });

  assert.equal(capturedCalls.length, 1);
  assert.equal(capturedCalls[0].slug, 'fran');
  assert.equal(capturedCalls[0].gymId, 3);
  assert.equal(capturedCalls[0].limit, 12);
  assert.equal(capturedCalls[0].showPrivateAthleteData, false);
});

routeTest('telemetry exige sessão autenticada antes de gravar eventos', async () => {
  const router = createTelemetryRouter({
    telemetryRateLimit: (req, res, next) => {
      void req;
      void res;
      return next();
    },
    authMiddleware: (req, res) => {
      void req;
      return res.status(401).json({ error: 'Token ausente' });
    },
  });

  await withServer(router, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ items: [{ type: 'event', name: 'boot' }] }),
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Token ausente');
  });
});
