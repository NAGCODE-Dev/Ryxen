import crypto from 'crypto';

import { pool } from './db.js';
import { BACKEND_PUBLIC_URL, FRONTEND_ORIGIN, SUPPORT_EMAIL } from './config.js';
import { logOpsEvent } from './opsEvents.js';
import { sendAccountDeletionReviewEmail } from './mailer.js';

const ACCOUNT_DELETION_WINDOW_DAYS = 15;
const ACCOUNT_DELETION_SWEEP_INTERVAL_MS = Math.max(Number(process.env.ACCOUNT_DELETION_SWEEP_INTERVAL_MS || 60 * 60 * 1000), 60_000);

let deletionWorkerStarted = false;
let deletionSweepTimer = null;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function generateDeletionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashDeletionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getDeletionBaseUrl() {
  return String(BACKEND_PUBLIC_URL || FRONTEND_ORIGIN || 'http://localhost:8787').replace(/\/$/, '');
}

function buildDeletionLink(token, action) {
  const search = new URLSearchParams({ token, action }).toString();
  return `${getDeletionBaseUrl()}/account-deletions/respond?${search}`;
}

function addDeletionWindowDays(baseDate = new Date(), days = ACCOUNT_DELETION_WINDOW_DAYS) {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export async function requestAccountDeletion({ userId, requestedByUserId = null, reason = 'admin_request' }) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('userId inválido');
  }

  const userRes = await pool.query(
    `SELECT id, email, name, is_admin
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [normalizedUserId],
  );
  const user = userRes.rows[0] || null;
  if (!user) {
    const error = new Error('Usuário não encontrado');
    error.code = 'user_not_found';
    throw error;
  }

  await pool.query(
    `DELETE FROM account_deletion_requests
     WHERE user_id = $1
       AND status = 'pending_confirmation'`,
    [normalizedUserId],
  );

  const token = generateDeletionToken();
  const tokenHash = hashDeletionToken(token);
  const deleteAfter = addDeletionWindowDays();
  const confirmUrl = buildDeletionLink(token, 'confirm');
  const cancelUrl = buildDeletionLink(token, 'cancel');

  const insertedRes = await pool.query(
    `INSERT INTO account_deletion_requests (
       user_id, email, requested_by_user_id, token_hash, status, delete_after, payload
     )
     VALUES ($1,$2,$3,$4,'pending_confirmation',$5,$6)
     RETURNING id, user_id, email, requested_by_user_id, status, delete_after, created_at, updated_at`,
    [
      user.id,
      normalizeEmail(user.email),
      requestedByUserId || null,
      tokenHash,
      {
        reason,
        supportEmail: SUPPORT_EMAIL,
      },
    ],
  );
  try {
    await sendAccountDeletionReviewEmail({
      to: user.email,
      userName: user.name || null,
      confirmUrl,
      cancelUrl,
      deleteAfter,
      supportEmail: SUPPORT_EMAIL,
    });
  } catch (error) {
    await pool.query(`DELETE FROM account_deletion_requests WHERE id = $1`, [insertedRes.rows[0].id]);
    throw error;
  }

  await logOpsEvent({
    kind: 'account_deletion_requested',
    status: 'pending_confirmation',
    userId: user.id,
    email: user.email,
    payload: {
      requestId: insertedRes.rows[0].id,
      requestedByUserId: requestedByUserId || null,
      deleteAfter,
      reason,
    },
  });

  return {
    user,
    request: insertedRes.rows[0],
    reused: false,
  };
}

export async function respondToAccountDeletionToken({ token, action }) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['confirm', 'cancel'].includes(normalizedAction)) {
    const error = new Error('Ação inválida');
    error.code = 'invalid_action';
    throw error;
  }

  const tokenHash = hashDeletionToken(token);
  const requestRes = await pool.query(
    `SELECT adr.*, u.name
     FROM account_deletion_requests adr
     LEFT JOIN users u ON u.id = adr.user_id
     WHERE adr.token_hash = $1
     LIMIT 1`,
    [tokenHash],
  );
  const request = requestRes.rows[0] || null;
  if (!request) {
    const error = new Error('Solicitação não encontrada');
    error.code = 'request_not_found';
    throw error;
  }

  if (request.status === 'deleted') {
    return { outcome: 'already_deleted', request };
  }

  if (request.status === 'cancelled') {
    return { outcome: 'already_cancelled', request };
  }

  if (normalizedAction === 'cancel') {
    const updatedRes = await pool.query(
      `UPDATE account_deletion_requests
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [request.id],
    );
    await logOpsEvent({
      kind: 'account_deletion_cancelled',
      status: 'cancelled',
      email: request.email,
      payload: { requestId: request.id },
    });
    return { outcome: 'cancelled', request: updatedRes.rows[0] };
  }

  const deletion = await deleteUserAccount({
    userId: request.user_id,
    requestedByUserId: request.requested_by_user_id || null,
    source: 'email_confirmation',
    requestId: request.id,
    preserveRequest: true,
    emailOverride: request.email,
  });
  return { outcome: 'deleted', request: deletion.request, deleted: deletion.deleted };
}

export async function deleteUserAccountNow({ userId, requestedByUserId = null, source = 'admin_immediate' }) {
  return deleteUserAccount({ userId, requestedByUserId, source, requestId: null, preserveRequest: false });
}

async function deleteUserAccount({ userId, requestedByUserId = null, source, requestId = null, preserveRequest = false, emailOverride = '' }) {
  let client;
  try {
    client = await pool.connect();
    console.info('[account-deletion] deletion process started', { userId, source });
    
    await client.query('BEGIN');
    const userRes = await client.query(
      `SELECT id, email, name
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [userId],
    );
    const user = userRes.rows[0] || null;
    const email = normalizeEmail(emailOverride || user?.email || '');

    if (!user && !email) {
      const error = new Error('Usuário não encontrado');
      error.code = 'user_not_found';
      throw error;
    }

    console.info('[account-deletion] starting data cleanup', { userId, email, source });

    await client.query(`DELETE FROM telemetry_events WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM billing_claims WHERE applied_user_id = $1 OR email = $2`, [userId, email]);
    await client.query(`DELETE FROM email_jobs WHERE user_id = $1 OR email = $2`, [userId, email]);
    await client.query(`DELETE FROM ops_events WHERE user_id = $1 OR email = $2`, [userId, email]);
    await client.query(`DELETE FROM email_verification_tokens WHERE email = $1`, [email]);
    await client.query(`DELETE FROM gym_memberships WHERE pending_email = $1 AND user_id IS NULL`, [email]);

    if (requestId) {
      await client.query(
        `UPDATE account_deletion_requests
         SET status = 'deleted',
             confirmed_at = COALESCE(confirmed_at, NOW()),
             deleted_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [requestId],
      );
    }

    if (!preserveRequest) {
      await client.query(`DELETE FROM account_deletion_requests WHERE user_id = $1 OR email = $2`, [userId, email]);
    }

    if (user) {
      await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    }

    await client.query('COMMIT');

    await logOpsEvent({
      kind: 'account_deleted',
      status: 'deleted',
      payload: {
        source,
        requestedByUserId: requestedByUserId || null,
        requestId: requestId || null,
      },
    });

    const requestRes = requestId
      ? await pool.query(`SELECT * FROM account_deletion_requests WHERE id = $1 LIMIT 1`, [requestId])
      : { rows: [] };

    console.info('[account-deletion] deletion completed successfully', { userId, email, source });
    return {
      deleted: {
        userId,
        email,
        source,
      },
      request: requestRes.rows[0] || null,
    };
  } catch (error) {
    console.error('[account-deletion] unexpected error during deletion', { userId, email, source, error: error.message });
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.warn('[account-deletion] transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('[account-deletion] error during rollback', { rollbackError: rollbackError.message });
      }
    }
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
        console.info('[account-deletion] database client released');
      } catch (releaseError) {
        console.error('[account-deletion] error releasing database client', { releaseError: releaseError.message });
      }
    }
  }
}

export async function getPendingDeletionSummary(userIds = []) {
  const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)));
  if (!ids.length) return new Map();

  const res = await pool.query(
    `SELECT DISTINCT ON (user_id)
        user_id, id, status, delete_after, created_at, updated_at
     FROM account_deletion_requests
     WHERE user_id = ANY($1::int[])
       AND status IN ('pending_confirmation', 'cancelled')
     ORDER BY user_id, created_at DESC`,
    [ids],
  );

  return new Map(res.rows.map((row) => [Number(row.user_id), row]));
}

export function startAccountDeletionWorker() {
  if (deletionWorkerStarted) return;
  deletionWorkerStarted = true;
  deletionSweepTimer = setInterval(() => {
    sweepDueAccountDeletions().catch((error) => {
      console.error('[account-deletion-worker] sweep failed', error);
    });
  }, ACCOUNT_DELETION_SWEEP_INTERVAL_MS);
  deletionSweepTimer.unref?.();
}

export async function sweepDueAccountDeletions() {
  console.info('[account-deletion-worker] sweep cycle started');
  
  let dueRes;
  try {
    dueRes = await pool.query(
      `SELECT id, user_id, requested_by_user_id, email
       FROM account_deletion_requests
       WHERE status = 'pending_confirmation'
         AND delete_after <= NOW()
       ORDER BY delete_after ASC
       LIMIT 20`,
    );
  } catch (error) {
    console.error('[account-deletion-worker] failed to query due deletions', { error: error.message });
    throw error;
  }

  console.info('[account-deletion-worker] found pending deletions', { count: dueRes.rows.length });

  for (const row of dueRes.rows) {
    try {
      await deleteUserAccount({
        userId: row.user_id,
        requestedByUserId: row.requested_by_user_id || null,
        source: 'auto_after_15_days',
        requestId: row.id,
        preserveRequest: true,
        emailOverride: row.email,
      });
      console.info('[account-deletion-worker] user deleted successfully', { requestId: row.id, userId: row.user_id });
    } catch (error) {
      console.error('[account-deletion-worker] delete failed', { requestId: row.id, userId: row.user_id, error: error.message });
    }
  }
  
  console.info('[account-deletion-worker] sweep cycle completed', { processedCount: dueRes.rows.length });
}

export function renderAccountDeletionResponseHtml({ title, message }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0b0f14; color: #f4f7fb; margin: 0; }
      .wrap { max-width: 560px; margin: 10vh auto; padding: 24px; }
      .card { background: #121821; border: 1px solid #253142; border-radius: 20px; padding: 24px; }
      h1 { font-size: 28px; margin: 0 0 12px; }
      p { color: #b9c3d1; line-height: 1.6; }
      a { color: #d9e6ff; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </div>
  </body>
</html>`;
}
