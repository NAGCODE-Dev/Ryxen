import express from 'express';

import { adminRequired } from '../auth.js';
import { grantSubscriptionToUser, normalizeSubscriptionPlanId, reprocessBillingClaim } from '../utils/subscriptionBilling.js';
import { getMailerHealth, getRecentEmailJobs, retryEmailJob } from '../mailer.js';
import { getRecentOpsEvents, logOpsEvent } from '../opsEvents.js';
import { KIWIFY_WEBHOOK_TOKEN, KIWIFY_CLIENT_ID, KIWIFY_CLIENT_SECRET } from '../config.js';
import { generateResetCode, hashResetCode } from '../passwordReset.js';

export function createAdminOpsRouter() {
  const router = express.Router();

  router.get('/admin/overview', adminRequired, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const q = String(req.query.q || '').trim().toLowerCase();
    const verify = String(req.query.verify || '').trim() === '1';
    const where = q ? `WHERE LOWER(email) LIKE $1 OR LOWER(COALESCE(name, '')) LIKE $1` : '';
    const params = q ? [`%${q}%`, limit] : [limit];
    const [usersCount, activeSubs, pendingClaims, latestUsers, recentBillingClaims, recentOps, recentEmailJobs, mailerHealth] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM users`),
      pool.query(`SELECT COUNT(*)::int AS total FROM subscriptions WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*)::int AS total FROM billing_claims WHERE status = 'pending'`),
      pool.query(`
        SELECT id, email, name, is_admin, created_at
             , sub.plan_id AS subscription_plan
             , sub.status AS subscription_status
             , sub.provider AS subscription_provider
             , sub.renew_at AS subscription_renew_at
             , sub.updated_at AS subscription_updated_at
        FROM users
        LEFT JOIN LATERAL (
          SELECT plan_id, status, provider, renew_at, updated_at
          FROM subscriptions
          WHERE user_id = users.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) sub ON TRUE
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length}
      `, params),
      pool.query(`
        SELECT id, provider, external_ref, email, plan_id, status, payload, created_at, updated_at
        FROM billing_claims
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 12
      `),
      getRecentOpsEvents({ limit: 20 }),
      getRecentEmailJobs({ kind: 'password_reset', limit: 12 }),
      getMailerHealth({ verify }),
    ]);

    return res.json({
      stats: {
        users: usersCount.rows[0]?.total || 0,
        activeSubscriptions: activeSubs.rows[0]?.total || 0,
        pendingBillingClaims: pendingClaims.rows[0]?.total || 0,
      },
      users: latestUsers.rows,
      ops: {
        mailer: mailerHealth,
        billing: {
          webhookConfigured: !!KIWIFY_WEBHOOK_TOKEN,
          apiConfigured: !!(KIWIFY_CLIENT_ID && KIWIFY_CLIENT_SECRET),
        },
        recentEmailJobs,
        recentBillingClaims: recentBillingClaims.rows,
        recentOps: recentOps,
      },
    });
  });

  router.get('/admin/ops/health', adminRequired, async (req, res) => {
    const verify = String(req.query.verify || '').trim() === '1';
    const startedAt = Date.now();
    const [dbCheck, mailer] = await Promise.allSettled([
      pool.query('SELECT 1 AS ok'),
      getMailerHealth({ verify }),
    ]);

    const dbOk = dbCheck.status === 'fulfilled';
    const db = dbOk
      ? { ok: true }
      : { ok: false, error: dbCheck.reason?.message || String(dbCheck.reason) };
    const mailerHealth = mailer.status === 'fulfilled'
      ? mailer.value
      : { ok: false, mode: 'unknown', verified: verify, error: mailer.reason?.message || String(mailer.reason) };

    return res.json({
      ok: db.ok && !!mailerHealth.ok,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      db,
      mailer: mailerHealth,
      billing: {
        webhookConfigured: !!KIWIFY_WEBHOOK_TOKEN,
        apiConfigured: !!(KIWIFY_CLIENT_ID && KIWIFY_CLIENT_SECRET),
      },
    });
  });

  router.post('/admin/billing/claims/:claimId/reprocess', adminRequired, async (req, res) => {
    const claimId = Number(req.params.claimId);
    if (!Number.isFinite(claimId) || claimId <= 0) {
      return res.status(400).json({ error: 'claimId inválido' });
    }

    const result = await reprocessBillingClaim(claimId, { force: true });
    if (!result?.claim) {
      return res.status(404).json({ error: 'Claim não encontrada' });
    }

    await logOpsEvent({
      kind: 'billing_claim_reprocess',
      status: result.applied ? 'applied' : 'pending',
      email: result.claim.email,
      userId: result.claim.applied_user_id || null,
      payload: {
        claimId,
        externalRef: result.claim.external_ref,
        planId: result.claim.plan_id,
      },
    });

    return res.json({
      success: true,
      claim: result.claim,
      subscription: result.subscription,
      applied: !!result.applied,
    });
  });

  router.post('/admin/email/jobs/:jobId/retry', adminRequired, async (req, res) => {
    const jobId = Number(req.params.jobId);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return res.status(400).json({ error: 'jobId inválido' });
    }

    const result = await retryEmailJob(jobId);
    if (!result?.job) {
      return res.status(404).json({ error: 'Job de email não encontrado' });
    }

    await logOpsEvent({
      kind: 'email_job_retry',
      status: result.job.status,
      email: result.job.email,
      userId: result.job.userId,
      payload: {
        jobId,
        kind: result.job.kind,
        provider: result.job.provider,
        retryCount: result.job.retryCount,
      },
    });

    return res.json({
      success: true,
      job: result.job,
      delivery: {
        provider: result.provider || null,
        messageId: result.messageId || null,
        previewUrl: result.previewUrl || null,
      },
    });
  });

  router.post('/admin/users/:userId/password-reset/manual', adminRequired, async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId inválido' });
    }

    const userRes = await pool.query(
      `SELECT id, email, name
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    const user = userRes.rows[0] || null;
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const code = generateResetCode();
    const codeHash = hashResetCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await pool.query(
      `UPDATE password_reset_tokens
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND consumed_at IS NULL`,
      [user.id],
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, codeHash, expiresAt],
    );

    await logOpsEvent({
      kind: 'password_reset_manual_release',
      status: 'created',
      userId: user.id,
      email: user.email,
      payload: { expiresAt },
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
      },
      reset: {
        code,
        expiresAt,
      },
    });
  });

  router.post('/admin/subscriptions/activate', adminRequired, async (req, res) => {
    const userId = Number(req.body?.userId);
    const planId = normalizeSubscriptionPlanId(req.body?.planId);
    const renewDays = Math.min(Math.max(Number(req.body?.renewDays) || 30, 1), 365);

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'userId inválido' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'planId inválido' });
    }

    const userRes = await pool.query(
      `SELECT id, email, name, is_admin
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    const user = userRes.rows[0] || null;
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const subscription = await grantSubscriptionToUser({
      userId,
      planId,
      provider: 'kiwify_manual',
      renewDays,
    });

    return res.json({
      success: true,
      user,
      subscription,
    });
  });

  return router;
}
