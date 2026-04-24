import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { pool } from './db.js';
import { applySecurityHeaders, attachRequestLogger, attachRequestMeta, createRateLimiter } from './middleware.js';
import {
  PORT,
  TRUST_PROXY,
  validateConfig,
  isAllowedOrigin,
} from './config.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createBillingRouter } from './routes/billingRoutes.js';
import { createTelemetryRouter } from './routes/telemetryRoutes.js';
import { createBenchmarkRouter } from './routes/benchmarkRoutes.js';
import { createLeaderboardRouter } from './routes/leaderboardRoutes.js';
import { createGymRouter } from './routes/gymRoutes.js';
import { createAthleteRouter } from './routes/athleteRoutes.js';
import { createAdminOpsRouter } from './routes/adminOpsRoutes.js';
import { requireGymManager, slugify } from './utils/gymUtils.js';
import { runMigrations } from './migrations/index.js';
import { startEmailWorker } from './mailer.js';
import { captureBackendError, initBackendErrorMonitoring } from './sentry.js';
import { startAccountDeletionWorker } from './accountDeletion.js';
import { startOperationalRetentionWorker } from './retention.js';
import { sanitizeRequestPath } from './securityRedaction.js';

initBackendErrorMonitoring();
const app = express();
const AUTH_RATE_LIMIT = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'auth', keyResolver: buildSensitiveRateLimitKey });
const RESET_RATE_LIMIT = createRateLimiter({ windowMs: 15 * 60_000, maxRequests: 8, keyPrefix: 'reset', keyResolver: buildSensitiveRateLimitKey });
const TELEMETRY_RATE_LIMIT = createRateLimiter({ windowMs: 60_000, maxRequests: 120, keyPrefix: 'telemetry' });

validateConfig();
app.set('trust proxy', TRUST_PROXY);
app.use(cors({
  origin(origin, callback) {
    return callback(null, isAllowedOrigin(origin));
  },
}));
app.use(attachRequestMeta);
app.use(attachRequestLogger);
app.use(applySecurityHeaders);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/auth', createAuthRouter({ authRateLimit: AUTH_RATE_LIMIT, resetRateLimit: RESET_RATE_LIMIT }));
app.use('/billing', createBillingRouter());
app.use('/telemetry', createTelemetryRouter({ telemetryRateLimit: TELEMETRY_RATE_LIMIT }));
app.use('/benchmarks', createBenchmarkRouter({ resolveBenchmarkOrder }));
app.use(createLeaderboardRouter());
app.use(createGymRouter({ requireGymManager, slugify, enrichWorkoutWithBenchmark }));
app.use(createAthleteRouter({ buildBenchmarkTrendSeries, buildPrTrendSeries }));
app.use(createAdminOpsRouter());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'ryxen-backend',
    status: 'online',
    health: '/health',
  });
});

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({
    ok: true,
    service: 'ryxen-backend',
    uptimeSeconds: Math.round(process.uptime()),
    now: new Date().toISOString(),
  });
});


app.use((err, req, res, _next) => {
  captureBackendError(err, {
    tags: { layer: 'backend', source: 'express' },
    request: {
      method: req?.method || null,
      path: sanitizeRequestPath(req),
      ip: req?.ip || null,
      userId: req?.user?.userId || null,
    },
  });
  console.error('[backend:error]', err);
  res.status(500).json({ error: 'Erro interno' });
});

runMigrations()
  .then(() => {
    startEmailWorker();
    startAccountDeletionWorker();
    startOperationalRetentionWorker();
    app.listen(PORT, () => {
      console.log(`[backend] running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    captureBackendError(error, {
      tags: { layer: 'backend', source: 'startup' },
    });
    console.error('[backend] failed to start', error);
    process.exit(1);
  });

function resolveBenchmarkOrder(sort) {
  switch (sort) {
    case 'name_asc':
      return 'name ASC';
    case 'name_desc':
      return 'name DESC';
    case 'year_asc':
      return 'COALESCE(year, 0) ASC, name ASC';
    case 'category_asc':
      return 'category ASC, COALESCE(year, 0) DESC, name ASC';
    case 'year_desc':
    default:
      return 'COALESCE(year, 0) DESC, name ASC';
  }
}

function buildSensitiveRateLimitKey(req) {
  const email = String(req.body?.email || req.query?.email || '').trim().toLowerCase();
  return `${req.ip || 'unknown'}:${email || 'anon'}`;
}


async function getBenchmarkBySlug(slug) {
  const result = await pool.query(`SELECT * FROM benchmark_library WHERE slug = $1 LIMIT 1`, [slug]);
  return result.rows[0] || null;
}

async function enrichWorkoutWithBenchmark(workout) {
  const slug = String(workout?.payload?.benchmarkSlug || '').trim().toLowerCase();
  if (!slug) return workout;

  const benchmark = await getBenchmarkBySlug(slug);
  return {
    ...workout,
    benchmark,
  };
}

function buildBenchmarkTrendSeries(rows = []) {
  const bySlug = new Map();

  for (const row of rows) {
    const key = row.benchmark_slug;
    if (!bySlug.has(key)) {
      bySlug.set(key, {
        slug: key,
        name: row.benchmark_name || key,
        scoreType: row.score_type || 'reps',
        points: [],
      });
    }

    bySlug.get(key).points.push({
      label: row.score_display,
      value: Number(row.score_value || 0),
      createdAt: row.created_at,
    });
  }

  return Array.from(bySlug.values())
    .map((item) => {
      const points = item.points
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-10);
      const firstValue = points[0]?.value ?? null;
      const lastValue = points[points.length - 1]?.value ?? null;
      const hasTrend = points.length > 1;
      const delta = hasTrend && firstValue !== null && lastValue !== null ? lastValue - firstValue : null;
      const improvement = item.scoreType === 'for_time'
        ? (delta !== null ? -delta : null)
        : delta;

      return {
        ...item,
        points,
        latestLabel: points[points.length - 1]?.label || null,
        latestValue: lastValue,
        delta,
        improvement,
      };
    })
    .sort((a, b) => new Date(b.points[b.points.length - 1]?.createdAt || 0) - new Date(a.points[a.points.length - 1]?.createdAt || 0))
    .slice(0, 4);
}

function buildPrTrendSeries(rows = []) {
  const byExercise = new Map();

  for (const row of rows) {
    const key = row.exercise;
    if (!byExercise.has(key)) {
      byExercise.set(key, {
        exercise: key,
        unit: row.unit || 'kg',
        points: [],
      });
    }

    byExercise.get(key).points.push({
      value: Number(row.value || 0),
      source: row.source || 'manual',
      createdAt: row.created_at,
    });
  }

  return Array.from(byExercise.values())
    .map((item) => {
      const sortedPoints = item.points
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const latestPoint = sortedPoints[sortedPoints.length - 1] || null;

      if (latestPoint?.source === 'snapshot_removed') {
        return null;
      }

      const points = sortedPoints
        .filter((point) => point.source !== 'snapshot_removed')
        .slice(-12);
      const firstValue = points[0]?.value ?? null;
      const lastValue = points[points.length - 1]?.value ?? null;
      return {
        ...item,
        points,
        latestValue: lastValue,
        delta: points.length > 1 && firstValue !== null && lastValue !== null ? lastValue - firstValue : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.points[b.points.length - 1]?.createdAt || 0) - new Date(a.points[a.points.length - 1]?.createdAt || 0))
    .slice(0, 6);
}
