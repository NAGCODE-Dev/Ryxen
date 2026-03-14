import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

import { pool, initDatabase } from './db.js';
import {
  canManageGym,
  getAccessContextForGym,
  getAccessContextForUser,
  getGymById,
  getMembershipForUser,
  getSubscriptionAccessState,
  getUserMemberships,
} from './access.js';
import { applySecurityHeaders, attachRequestMeta, createRateLimiter } from './middleware.js';
import { adminRequired, authRequired, decodeOptionalUserId, signToken } from './auth.js';
import { sendPasswordResetEmail } from './mailer.js';
import { buildEntitlements } from './accessPolicy.js';
import { generateResetCode, hashResetCode, isResetCodeExpired } from './passwordReset.js';
import { getStripeClient, getStripeWebhookSecret, hasStripeConfigured, resolveStripePriceId } from './stripe.js';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const ALLOWED_ORIGINS = FRONTEND_ORIGIN === '*'
  ? '*'
  : FRONTEND_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);
const SUPPORT_EMAIL = String(process.env.SUPPORT_EMAIL || 'nagcode.contact@gmail.com').toLowerCase().trim();
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || SUPPORT_EMAIL)
  .split(',')
  .map((value) => value.toLowerCase().trim())
  .filter(Boolean);
const EXPOSE_RESET_CODE = process.env.EXPOSE_RESET_CODE !== 'false';
const AUTH_RATE_LIMIT = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'auth' });
const RESET_RATE_LIMIT = createRateLimiter({ windowMs: 15 * 60_000, maxRequests: 8, keyPrefix: 'reset' });
const TELEMETRY_RATE_LIMIT = createRateLimiter({ windowMs: 60_000, maxRequests: 120, keyPrefix: 'telemetry' });

app.use(cors({
  origin(origin, callback) {
    if (ALLOWED_ORIGINS === '*') return callback(null, true);
    if (!origin) return callback(null, true);
    return callback(null, ALLOWED_ORIGINS.includes(origin));
  },
}));
app.use(attachRequestMeta);
app.use(applySecurityHeaders);
app.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripeClient();
  const sig = req.headers['stripe-signature'];

  if (!stripe || !sig || !getStripeWebhookSecret()) {
    return res.status(400).send('Stripe não configurado');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, getStripeWebhookSecret());
  } catch (error) {
    console.error('[stripe:webhook] assinatura inválida', error?.message || error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    await handleStripeWebhookEvent(event);
    return res.json({ received: true });
  } catch (error) {
    console.error('[stripe:webhook] erro ao processar evento', error);
    return res.status(500).json({ error: 'Erro ao processar webhook Stripe' });
  }
});
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({
    ok: true,
    service: 'crossapp-backend',
    uptimeSeconds: Math.round(process.uptime()),
    now: new Date().toISOString(),
  });
});

app.post('/auth/signup', AUTH_RATE_LIMIT, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }

  try {
    const normalizedEmail = String(email).toLowerCase().trim();
    const existingCount = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
    const shouldBeAdmin = existingCount.rows[0]?.total === 0 || ADMIN_EMAILS.includes(normalizedEmail);
    const hash = await bcrypt.hash(String(password), 10);
    const inserted = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_admin) VALUES ($1,$2,$3,$4) RETURNING id, email, name, is_admin`,
      [normalizedEmail, hash, name || null, shouldBeAdmin],
    );

    const user = inserted.rows[0];
    await attachPendingMembershipsToUser(user.id, user.email);
    const token = signToken(user);
    return res.json({ token, user });
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    return res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

app.post('/auth/signin', AUTH_RATE_LIMIT, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }

  const found = await pool.query(
    `SELECT id, email, name, password_hash, is_admin FROM users WHERE email = $1`,
    [String(email).toLowerCase().trim()],
  );

  const user = found.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await bcrypt.compare(String(password), user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const safeUser = { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin };
  await attachPendingMembershipsToUser(user.id, user.email);
  const token = signToken(safeUser);
  return res.json({ token, user: safeUser });
});

app.post('/auth/refresh', authRequired, async (req, res) => {
  const found = await pool.query(`SELECT id, email, name, is_admin FROM users WHERE id = $1`, [req.user.userId]);
  const user = found.rows[0];
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  const token = signToken(user);
  return res.json({ token, user });
});

app.get('/auth/me', authRequired, async (req, res) => {
  const found = await pool.query(`SELECT id, email, name, is_admin FROM users WHERE id = $1`, [req.user.userId]);
  const user = found.rows[0];
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json({ user });
});

app.post('/auth/request-password-reset', RESET_RATE_LIMIT, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: 'email é obrigatório' });
  }

  const found = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email]);
  const user = found.rows[0];

  if (!user) {
    return res.json({ success: true, message: 'Se o email existir, o código será gerado.' });
  }

  const code = generateResetCode();
  const codeHash = hashResetCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await pool.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL`, [user.id]);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at) VALUES ($1,$2,$3)`,
    [user.id, codeHash, expiresAt],
  );

  const response = {
    success: true,
    message: 'Código de recuperação gerado.',
    supportEmail: SUPPORT_EMAIL,
  };

  try {
    const mailInfo = await sendPasswordResetEmail({ to: email, code });
    response.delivery = {
      transport: mailInfo.transport,
      previewUrl: mailInfo.previewUrl,
    };
  } catch (error) {
    console.error('[reset-email] failed', error);
    response.delivery = {
      transport: 'failed',
      previewUrl: null,
    };
  }

  if (EXPOSE_RESET_CODE) {
    response.previewCode = code;
  }

  return res.json(response);
});

app.post('/auth/confirm-password-reset', RESET_RATE_LIMIT, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'email, code e newPassword são obrigatórios' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  const foundUser = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  const user = foundUser.rows[0];
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const foundToken = await pool.query(
    `SELECT id, code_hash, expires_at
     FROM password_reset_tokens
     WHERE user_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id],
  );

  const tokenRow = foundToken.rows[0];
  if (!tokenRow) {
    return res.status(400).json({ error: 'Nenhum código ativo encontrado' });
  }

  if (isResetCodeExpired(tokenRow.expires_at)) {
    return res.status(400).json({ error: 'Código expirado' });
  }

  const codeHash = hashResetCode(code);
  if (codeHash !== tokenRow.code_hash) {
    return res.status(400).json({ error: 'Código inválido' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
  await pool.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`, [tokenRow.id]);

  return res.json({ success: true });
});

app.post('/auth/signout', authRequired, async (_req, res) => {
  return res.json({ success: true });
});

app.get('/billing/status', authRequired, async (req, res) => {
  const row = await pool.query(
    `SELECT plan_id, status, provider, renew_at, updated_at FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`,
    [req.user.userId],
  );

  const latest = row.rows[0] || null;
  const accessState = getSubscriptionAccessState(latest);
  return res.json({
    plan: latest?.plan_id || 'free',
    status: latest?.status || 'inactive',
    provider: latest?.provider || 'mock',
    renewAt: latest?.renew_at || null,
    updatedAt: latest?.updated_at || null,
    accessTier: accessState.accessTier,
    isGracePeriod: accessState.isGracePeriod,
    graceUntil: accessState.graceUntil,
    daysRemaining: accessState.daysRemaining,
  });
});

app.post('/billing/checkout', authRequired, async (req, res) => {
  const { planId, provider, successUrl, cancelUrl } = req.body || {};
  if (!planId) {
    return res.status(400).json({ error: 'planId é obrigatório' });
  }

  const selectedProvider = provider || 'mock';
  if (selectedProvider === 'stripe' && hasStripeConfigured()) {
    const stripe = getStripeClient();
    const priceId = resolveStripePriceId(planId);
    if (!priceId) {
      return res.status(400).json({ error: 'Preço Stripe não configurado para este plano' });
    }

    const userResult = await pool.query(`SELECT id, email, name FROM users WHERE id = $1`, [req.user.userId]);
    const user = userResult.rows[0];
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl || 'http://localhost:8000?billing=success',
      cancel_url: cancelUrl || 'http://localhost:8000?billing=cancel',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user?.email || req.user.email,
      allow_promotion_codes: true,
      metadata: {
        userId: String(req.user.userId),
        planId: String(planId),
      },
      subscription_data: {
        metadata: {
          userId: String(req.user.userId),
          planId: String(planId),
        },
      },
    });

    await pool.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, provider, stripe_price_id, updated_at)
       VALUES ($1,$2,'pending','stripe',$3,NOW())`,
      [req.user.userId, String(planId), priceId],
    );

    return res.json({ checkoutUrl: session.url, mode: 'stripe', sessionId: session.id });
  }

  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, provider, updated_at) VALUES ($1,$2,'pending',$3,NOW())`,
    [req.user.userId, String(planId), selectedProvider],
  );

  // Modo mock (produção: trocar por criação de sessão Stripe/MP)
  const checkoutUrl = `${successUrl || cancelUrl || 'http://localhost:8000'}`;
  return res.json({ checkoutUrl, mode: 'mock' });
});

app.get('/billing/entitlements', authRequired, async (req, res) => {
  const row = await pool.query(
    `SELECT plan_id, status, provider, renew_at, updated_at FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`,
    [req.user.userId],
  );
  const sub = row.rows[0];
  const gymContexts = await getAccessContextForUser(req.user.userId);
  const entitlements = buildEntitlements({ subscription: sub, gymContexts });
  const accessState = getSubscriptionAccessState(sub);

  return res.json({
    entitlements: Array.from(new Set(entitlements)),
    subscription: {
      plan: sub?.plan_id || 'free',
      status: sub?.status || 'inactive',
      provider: sub?.provider || 'mock',
      renewAt: sub?.renew_at || null,
      updatedAt: sub?.updated_at || null,
      accessTier: accessState.accessTier,
      isGracePeriod: accessState.isGracePeriod,
      graceUntil: accessState.graceUntil,
      daysRemaining: accessState.daysRemaining,
    },
    gymAccess: gymContexts.map((ctx) => ({
      gymId: ctx.membership.gym_id,
      gymName: ctx.membership.gym_name,
      role: ctx.membership.role,
      status: ctx.membership.status,
      canCoachManage: ctx.access?.gymAccess?.canCoachManage || false,
      canAthletesUseApp: ctx.access?.gymAccess?.canAthletesUseApp || false,
      warning: ctx.access?.gymAccess?.warning || null,
      accessTier: ctx.access?.ownerSubscription?.accessTier || 'blocked',
      daysRemaining: ctx.access?.ownerSubscription?.daysRemaining || 0,
    })),
  });
});

// Endpoint utilitário para ambiente local testar assinatura ativa
app.post('/billing/mock/activate', authRequired, async (req, res) => {
  const { planId = 'pro', provider = 'mock' } = req.body || {};
  const renewAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, provider, renew_at, updated_at)
     VALUES ($1,$2,'active',$3,$4,NOW())`,
    [req.user.userId, planId, provider, renewAt],
  );
  return res.json({ success: true });
});

app.get('/benchmarks', authRequired, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim().toLowerCase();
  const officialSource = String(req.query.source || '').trim().toLowerCase();
  const sort = String(req.query.sort || 'year_desc').trim().toLowerCase();
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR LOWER(slug) LIKE $${params.length})`);
  }

  if (category) {
    params.push(category);
    where.push(`LOWER(category) = $${params.length}`);
  }

  if (officialSource) {
    params.push(officialSource);
    where.push(`LOWER(official_source) = $${params.length}`);
  }

  const orderBy = resolveBenchmarkOrder(sort);
  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM benchmark_library
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;
  const countResult = await pool.query(countSql, params);

  params.push(limit);
  params.push(offset);
  const sql = `
    SELECT *
    FROM benchmark_library
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy}
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;
  const result = await pool.query(sql, params);
  return res.json({
    benchmarks: result.rows,
    pagination: {
      total: countResult.rows[0]?.total || 0,
      page,
      limit,
      pages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / limit)),
    },
  });
});

app.get('/access/context', authRequired, async (req, res) => {
  const gyms = await getAccessContextForUser(req.user.userId);
  return res.json({
    gyms: gyms.map((ctx) => ({
      membership: ctx.membership,
      gymAccess: ctx.access?.gymAccess || null,
      ownerSubscription: ctx.access?.ownerSubscription || null,
    })),
  });
});

app.post('/gyms', authRequired, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const slug = slugify(req.body?.slug || name);
  if (!name || !slug) {
    return res.status(400).json({ error: 'name e slug são obrigatórios' });
  }

  const inserted = await pool.query(
    `INSERT INTO gyms (name, slug, owner_user_id) VALUES ($1,$2,$3) RETURNING *`,
    [name, slug, req.user.userId],
  );
  const gym = inserted.rows[0];

  await pool.query(
    `INSERT INTO gym_memberships (gym_id, user_id, role, status) VALUES ($1,$2,'owner','active')`,
    [gym.id, req.user.userId],
  );

  return res.json({ gym });
});

app.get('/gyms/me', authRequired, async (req, res) => {
  const memberships = await getAccessContextForUser(req.user.userId);
  return res.json({
    gyms: memberships.map((ctx) => ({
      id: ctx.membership.gym_id,
      name: ctx.membership.gym_name,
      slug: ctx.membership.gym_slug,
      role: ctx.membership.role,
      status: ctx.membership.status,
      access: ctx.access?.gymAccess || null,
    })),
  });
});

app.post('/gyms/:gymId/memberships', authRequired, async (req, res) => {
  const gymId = Number(req.params.gymId);
  const role = String(req.body?.role || 'athlete');
  const email = String(req.body?.email || '').toLowerCase().trim();

  if (!Number.isFinite(gymId) || !email) {
    return res.status(400).json({ error: 'gymId e email são obrigatórios' });
  }

  if (!['coach', 'athlete'].includes(role)) {
    return res.status(400).json({ error: 'role inválido' });
  }

  const membership = await requireGymManager(gymId, req.user.userId);
  if (!membership.success) {
    return res.status(membership.code).json({ error: membership.error });
  }

  const foundUser = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email]);
  const found = foundUser.rows[0] || null;

  try {
    const inserted = await pool.query(
      `INSERT INTO gym_memberships (gym_id, user_id, pending_email, role, status)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [gymId, found?.id || null, found ? null : email, role, found ? 'active' : 'invited'],
    );
    return res.json({ membership: inserted.rows[0] });
  } catch (error) {
    if (String(error?.message || '').includes('idx_gym_membership_user_unique')) {
      return res.status(409).json({ error: 'Usuário já pertence a este gym' });
    }
    return res.status(500).json({ error: 'Erro ao adicionar membro' });
  }
});

app.get('/gyms/:gymId/memberships', authRequired, async (req, res) => {
  const gymId = Number(req.params.gymId);
  const ownMembership = await getMembershipForUser(gymId, req.user.userId);
  if (!ownMembership) {
    return res.status(404).json({ error: 'Gym não encontrado para este usuário' });
  }

  const rows = await pool.query(
    `SELECT gm.*, u.email, u.name
     FROM gym_memberships gm
     LEFT JOIN users u ON u.id = gm.user_id
     WHERE gm.gym_id = $1
     ORDER BY gm.created_at ASC`,
    [gymId],
  );

  return res.json({ memberships: rows.rows });
});

app.post('/gyms/:gymId/workouts', authRequired, async (req, res) => {
  const gymId = Number(req.params.gymId);
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const scheduledDate = String(req.body?.scheduledDate || '').trim();
  const payload = req.body?.payload;

  if (!Number.isFinite(gymId) || !title || !scheduledDate || !payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'gymId, title, scheduledDate e payload são obrigatórios' });
  }

  const manager = await requireGymManager(gymId, req.user.userId);
  if (!manager.success) {
    return res.status(manager.code).json({ error: manager.error });
  }

  if (!manager.access.gymAccess.canCoachManage) {
    return res.status(402).json({ error: 'Assinatura do coach inativa. Renove para publicar treinos.' });
  }

  const inserted = await pool.query(
    `INSERT INTO workouts (gym_id, created_by_user_id, title, description, scheduled_date, payload)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [gymId, req.user.userId, title, description || null, scheduledDate, payload],
  );
  const workout = inserted.rows[0];

  const members = await pool.query(
    `SELECT id FROM gym_memberships WHERE gym_id = $1 AND status = 'active' AND role = 'athlete'`,
    [gymId],
  );

  for (const member of members.rows) {
    await pool.query(
      `INSERT INTO workout_assignments (workout_id, gym_membership_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [workout.id, member.id],
    );
  }

  return res.json({ workout, assigned: members.rows.length });
});

app.get('/workouts/feed', authRequired, async (req, res) => {
  const memberships = await getUserMemberships(req.user.userId);
  if (!memberships.length) {
    return res.json({ workouts: [] });
  }

  const gymIds = memberships.map((m) => m.gym_id);
  const rows = await pool.query(
    `SELECT w.*, g.name AS gym_name
     FROM workouts w
     JOIN gyms g ON g.id = w.gym_id
     WHERE w.gym_id = ANY($1::int[])
     ORDER BY w.scheduled_date DESC, w.created_at DESC
     LIMIT 100`,
    [gymIds],
  );

  const accessContexts = await Promise.all(rows.rows.map((workout) => getAccessContextForGym(workout.gym_id)));
  const visible = rows.rows.filter((workout, index) => accessContexts[index]?.gymAccess?.canAthletesUseApp);
  const enriched = await Promise.all(visible.map(enrichWorkoutWithBenchmark));

  return res.json({ workouts: enriched });
});

app.get('/competitions/calendar', authRequired, async (req, res) => {
  const gymId = Number(req.query.gymId || 0);
  const memberships = await getUserMemberships(req.user.userId);
  const gymIds = gymId && Number.isFinite(gymId)
    ? [gymId]
    : memberships.map((membership) => membership.gym_id);

  if (!gymIds.length) {
    return res.json({ competitions: [] });
  }

  const rows = await pool.query(
    `SELECT
      c.*,
      g.name AS gym_name,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ce.id,
            'title', ce.title,
            'eventDate', ce.event_date,
            'benchmarkSlug', ce.benchmark_slug,
            'scoreType', ce.score_type,
            'notes', ce.notes
          )
          ORDER BY ce.event_date ASC
        ) FILTER (WHERE ce.id IS NOT NULL),
        '[]'::json
      ) AS events
     FROM competitions c
     LEFT JOIN gyms g ON g.id = c.gym_id
     LEFT JOIN competition_events ce ON ce.competition_id = c.id
     WHERE c.gym_id = ANY($1::int[]) OR c.visibility = 'public'
     GROUP BY c.id, g.name
     ORDER BY c.starts_at ASC`,
    [gymIds],
  );

  return res.json({ competitions: rows.rows });
});

app.post('/gyms/:gymId/competitions', authRequired, async (req, res) => {
  const gymId = Number(req.params.gymId);
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const location = String(req.body?.location || '').trim();
  const startsAt = String(req.body?.startsAt || '').trim();
  const endsAt = String(req.body?.endsAt || '').trim();
  const visibility = String(req.body?.visibility || 'gym').trim().toLowerCase();

  if (!Number.isFinite(gymId) || !title || !startsAt) {
    return res.status(400).json({ error: 'gymId, title e startsAt são obrigatórios' });
  }

  if (!['gym', 'public'].includes(visibility)) {
    return res.status(400).json({ error: 'visibility inválida' });
  }

  const manager = await requireGymManager(gymId, req.user.userId);
  if (!manager.success) {
    return res.status(manager.code).json({ error: manager.error });
  }

  if (!manager.access.gymAccess.canCoachManage) {
    return res.status(402).json({ error: 'Assinatura do coach inativa. Renove para criar competições.' });
  }

  const inserted = await pool.query(
    `INSERT INTO competitions (gym_id, created_by_user_id, title, description, location, starts_at, ends_at, visibility)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [gymId, req.user.userId, title, description || null, location || null, startsAt, endsAt || null, visibility],
  );

  return res.json({ competition: inserted.rows[0] });
});

app.post('/competitions/:competitionId/events', authRequired, async (req, res) => {
  const competitionId = Number(req.params.competitionId);
  const title = String(req.body?.title || '').trim();
  const benchmarkSlug = String(req.body?.benchmarkSlug || '').trim().toLowerCase();
  const eventDate = String(req.body?.eventDate || '').trim();
  const notes = String(req.body?.notes || '').trim();

  if (!Number.isFinite(competitionId) || !title || !eventDate) {
    return res.status(400).json({ error: 'competitionId, title e eventDate são obrigatórios' });
  }

  const competitionResult = await pool.query(`SELECT * FROM competitions WHERE id = $1 LIMIT 1`, [competitionId]);
  const competition = competitionResult.rows[0];
  if (!competition) {
    return res.status(404).json({ error: 'Competição não encontrada' });
  }

  const manager = await requireGymManager(competition.gym_id, req.user.userId);
  if (!manager.success) {
    return res.status(manager.code).json({ error: manager.error });
  }

  let benchmark = null;
  if (benchmarkSlug) {
    benchmark = await getBenchmarkBySlug(benchmarkSlug);
    if (!benchmark) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }
  }

  const inserted = await pool.query(
    `INSERT INTO competition_events (competition_id, benchmark_slug, title, event_date, score_type, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [competitionId, benchmark?.slug || null, title, eventDate, benchmark?.score_type || null, notes || null],
  );

  return res.json({ event: inserted.rows[0] });
});

app.post('/benchmarks/:slug/results', authRequired, async (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const scoreDisplay = String(req.body?.scoreDisplay || '').trim();
  const gymId = Number(req.body?.gymId || 0);
  const competitionEventId = req.body?.competitionEventId ? Number(req.body.competitionEventId) : null;
  const notes = String(req.body?.notes || '').trim();

  if (!slug || !scoreDisplay) {
    return res.status(400).json({ error: 'slug e scoreDisplay são obrigatórios' });
  }

  const benchmark = await getBenchmarkBySlug(slug);
  if (!benchmark) {
    return res.status(404).json({ error: 'Benchmark não encontrado' });
  }

  if (gymId) {
    const membership = await getMembershipForUser(gymId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ error: 'Usuário não pertence a este gym' });
    }
  }

  const parsedScore = parseBenchmarkScore(scoreDisplay, benchmark.score_type);
  const inserted = await pool.query(
    `INSERT INTO benchmark_results (benchmark_slug, user_id, gym_id, competition_event_id, score_display, score_value, tiebreak_seconds, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [slug, req.user.userId, gymId || null, competitionEventId, scoreDisplay, parsedScore.scoreValue, parsedScore.tiebreakSeconds, notes || null],
  );

  return res.json({ result: inserted.rows[0] });
});

app.get('/leaderboards/benchmarks/:slug', authRequired, async (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const gymId = Number(req.query.gymId || 0);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  const benchmark = await getBenchmarkBySlug(slug);
  if (!benchmark) {
    return res.status(404).json({ error: 'Benchmark não encontrado' });
  }

  const where = ['br.benchmark_slug = $1'];
  const params = [slug];

  if (gymId) {
    params.push(gymId);
    where.push(`br.gym_id = $${params.length}`);
  }

  params.push(limit);
  const orderBy = resolveLeaderboardOrder(benchmark.score_type);
  const rows = await pool.query(
    `SELECT
      br.id,
      br.score_display,
      br.score_value,
      br.tiebreak_seconds,
      br.created_at,
      br.gym_id,
      u.name,
      u.email
     FROM benchmark_results br
     JOIN users u ON u.id = br.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT $${params.length}`,
    params,
  );

  return res.json({
    benchmark,
    results: rows.rows,
  });
});

app.post('/sync/push', authRequired, async (req, res) => {
  const { payload } = req.body || {};
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload inválido' });
  }

  const inserted = await pool.query(
    `INSERT INTO sync_snapshots (user_id, payload) VALUES ($1,$2) RETURNING id, created_at`,
    [req.user.userId, payload],
  );

  return res.json({ snapshotId: inserted.rows[0].id, savedAt: inserted.rows[0].created_at });
});

app.get('/sync/pull', authRequired, async (req, res) => {
  const found = await pool.query(
    `SELECT id, payload, created_at FROM sync_snapshots WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [req.user.userId],
  );

  const row = found.rows[0];
  if (!row) return res.json({ payload: null, snapshotId: null, savedAt: null });
  return res.json({ payload: row.payload, snapshotId: row.id, savedAt: row.created_at });
});

app.get('/sync/snapshots', authRequired, async (req, res) => {
  const rows = await pool.query(
    `SELECT id, created_at FROM sync_snapshots WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.userId],
  );

  return res.json({
    snapshots: rows.rows.map((r) => ({ id: r.id, savedAt: r.created_at })),
  });
});

app.get('/admin/overview', adminRequired, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const q = String(req.query.q || '').trim().toLowerCase();
  const where = q ? `WHERE LOWER(email) LIKE $1 OR LOWER(COALESCE(name, '')) LIKE $1` : '';
  const params = q ? [`%${q}%`, limit] : [limit];
  const [usersCount, activeSubs, latestUsers] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM users`),
    pool.query(`SELECT COUNT(*)::int AS total FROM subscriptions WHERE status = 'active'`),
    pool.query(`
      SELECT id, email, name, is_admin, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `, params),
  ]);

  return res.json({
    stats: {
      users: usersCount.rows[0]?.total || 0,
      activeSubscriptions: activeSubs.rows[0]?.total || 0,
    },
    users: latestUsers.rows,
  });
});

app.post('/telemetry/ingest', TELEMETRY_RATE_LIMIT, async (req, res) => {
  const userId = decodeOptionalUserId(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!items.length) {
    return res.status(400).json({ error: 'items vazio' });
  }

  const trimmed = items.slice(0, 200);
  const query = 'INSERT INTO telemetry_events (user_id, item) VALUES ($1, $2)';
  for (const item of trimmed) {
    await pool.query(query, [userId, item]);
  }

  return res.json({ success: true, accepted: trimmed.length });
});

app.use((err, _req, res, _next) => {
  console.error('[backend:error]', err);
  res.status(500).json({ error: 'Erro interno' });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[backend] running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('[backend] failed to start', error);
    process.exit(1);
  });

async function requireGymManager(gymId, userId) {
  const membership = await getMembershipForUser(gymId, userId);
  if (!membership) {
    return { success: false, code: 404, error: 'Gym não encontrado para este usuário' };
  }

  if (!canManageGym(membership.role)) {
    return { success: false, code: 403, error: 'Usuário sem permissão de gestão neste gym' };
  }

  const access = await getAccessContextForGym(gymId);
  return { success: true, membership, access };
}

async function attachPendingMembershipsToUser(userId, email) {
  await pool.query(
    `UPDATE gym_memberships
     SET user_id = $1, pending_email = NULL, status = 'active'
     WHERE pending_email = $2 AND user_id IS NULL`,
    [userId, String(email || '').toLowerCase().trim()],
  );
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

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

function resolveLeaderboardOrder(scoreType) {
  switch (scoreType) {
    case 'for_time':
      return 'br.score_value ASC, COALESCE(br.tiebreak_seconds, 0) ASC, br.created_at ASC';
    case 'rounds_reps':
    case 'reps':
    default:
      return 'br.score_value DESC, COALESCE(br.tiebreak_seconds, 0) ASC, br.created_at ASC';
  }
}

function parseBenchmarkScore(scoreDisplay, scoreType) {
  const raw = String(scoreDisplay || '').trim();
  const normalized = raw.replace(',', '.');

  if (scoreType === 'for_time') {
    const time = parseTimeToSeconds(normalized);
    if (time !== null) return { scoreValue: time, tiebreakSeconds: null };
  }

  if (scoreType === 'rounds_reps') {
    const roundsReps = normalized.match(/^(\d+)\s*\+\s*(\d+)$/);
    if (roundsReps) {
      return {
        scoreValue: Number(roundsReps[1]) * 1000 + Number(roundsReps[2]),
        tiebreakSeconds: null,
      };
    }
  }

  const numeric = Number(normalized.replace(/[^\d.-]/g, ''));
  if (Number.isFinite(numeric)) {
    return { scoreValue: numeric, tiebreakSeconds: null };
  }

  return { scoreValue: 0, tiebreakSeconds: null };
}

function parseTimeToSeconds(value) {
  if (!value) return null;
  const parts = String(value).split(':').map((part) => Number(part.trim()));
  if (!parts.every(Number.isFinite)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

async function handleStripeWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription') return;
      const userId = Number(session.metadata?.userId || 0);
      const planId = String(session.metadata?.planId || 'coach');
      await upsertSubscriptionRecord({
        userId,
        planId,
        status: 'active',
        provider: 'stripe',
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        stripePriceId: null,
        renewAt: null,
      });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = Number(subscription.metadata?.userId || 0);
      const planId = String(subscription.metadata?.planId || 'coach');
      const priceId = subscription.items?.data?.[0]?.price?.id || null;
      const renewAt = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      const status = normalizeStripeStatus(subscription.status);

      await upsertSubscriptionRecord({
        userId,
        planId,
        status,
        provider: 'stripe',
        stripeCustomerId: subscription.customer || null,
        stripeSubscriptionId: subscription.id || null,
        stripePriceId: priceId,
        renewAt,
      });
      return;
    }
    default:
      return;
  }
}

function normalizeStripeStatus(status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') return 'inactive';
  return 'pending';
}

async function upsertSubscriptionRecord({
  userId,
  planId,
  status,
  provider,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  renewAt,
}) {
  if (!userId) return;

  const existing = await pool.query(
    `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
    [stripeSubscriptionId],
  );

  if (existing.rows[0]?.id) {
    await pool.query(
      `UPDATE subscriptions
       SET plan_id = $2,
           status = $3,
           provider = $4,
           stripe_customer_id = $5,
           stripe_price_id = $6,
           renew_at = $7,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, planId, status, provider, stripeCustomerId, stripePriceId, renewAt],
    );
    return;
  }

  await pool.query(
    `INSERT INTO subscriptions (
      user_id, plan_id, status, provider, stripe_customer_id, stripe_subscription_id, stripe_price_id, renew_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [userId, planId, status, provider, stripeCustomerId, stripeSubscriptionId, stripePriceId, renewAt],
  );
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
