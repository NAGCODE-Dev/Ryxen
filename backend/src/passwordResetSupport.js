import { randomUUID } from 'node:crypto';

import { pool } from './db.js';
import { normalizeEmail } from './devAccess.js';

const SUPPORT_REQUEST_TTL_MS = 2 * 60 * 60 * 1000;
const SUPPORT_REQUEST_COOLDOWN_MS = 30 * 1000;
const SUPPORT_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const SUPPORT_REQUEST_MAX_PER_EMAIL = 5;
const SUPPORT_REQUEST_MAX_PER_DEVICE = 4;
const TRUSTED_DEVICE_RECENT_LOGIN_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeSupportPayload(payload = {}) {
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
}

function parseDateMs(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildSupportRateLimitError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function getSupportRateLimitContext({ email, deviceId = '' }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeviceId = String(deviceId || '').trim();
  if (!normalizedEmail) {
    return {
      recentEmailAttempts: 0,
      recentDeviceAttempts: 0,
      cooldownRemainingMs: 0,
    };
  }

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE email = $1
           AND updated_at > NOW() - INTERVAL '15 minutes'
       )::int AS recent_email_attempts,
       COUNT(*) FILTER (
         WHERE $2 <> ''
           AND COALESCE(payload->>'deviceId', '') = $2
           AND updated_at > NOW() - INTERVAL '15 minutes'
       )::int AS recent_device_attempts,
       MAX(updated_at) FILTER (WHERE email = $1) AS last_email_request_at,
       MAX(updated_at) FILTER (
         WHERE $2 <> ''
           AND COALESCE(payload->>'deviceId', '') = $2
       ) AS last_device_request_at
     FROM password_reset_support_requests`,
    [normalizedEmail, normalizedDeviceId],
  );

  const row = result.rows[0] || {};
  const lastEmailAt = parseDateMs(row.last_email_request_at);
  const lastDeviceAt = parseDateMs(row.last_device_request_at);
  const cooldownBase = Math.max(lastEmailAt, lastDeviceAt);
  const cooldownRemainingMs = cooldownBase
    ? Math.max(0, SUPPORT_REQUEST_COOLDOWN_MS - (Date.now() - cooldownBase))
    : 0;

  return {
    recentEmailAttempts: Number(row.recent_email_attempts || 0),
    recentDeviceAttempts: Number(row.recent_device_attempts || 0),
    cooldownRemainingMs,
  };
}

async function getTrustedDeviceSignals({ email, deviceId = '' }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeviceId = String(deviceId || '').trim();
  if (!normalizedEmail) {
    return {
      hasTrustedDeviceForEmail: false,
      sameDeviceTrusted: false,
      recentLoginOnSameDevice: false,
      trustedDeviceLabel: '',
    };
  }

  const result = await pool.query(
    `SELECT
       EXISTS(
         SELECT 1
         FROM trusted_devices td
         WHERE td.email = $1
           AND td.revoked_at IS NULL
           AND td.expires_at > NOW()
       ) AS has_trusted_device_for_email,
       EXISTS(
         SELECT 1
         FROM trusted_devices td
         WHERE td.email = $1
           AND td.device_id = $2
           AND td.revoked_at IS NULL
           AND td.expires_at > NOW()
       ) AS same_device_trusted,
       (
         SELECT td.last_seen_at
         FROM trusted_devices td
         WHERE td.email = $1
           AND td.device_id = $2
           AND td.revoked_at IS NULL
         ORDER BY td.updated_at DESC
         LIMIT 1
       ) AS same_device_last_seen_at,
       (
         SELECT td.label
         FROM trusted_devices td
         WHERE td.email = $1
           AND td.device_id = $2
           AND td.revoked_at IS NULL
         ORDER BY td.updated_at DESC
         LIMIT 1
       ) AS same_device_label`,
    [normalizedEmail, normalizedDeviceId],
  );

  const row = result.rows[0] || {};
  const sameDeviceLastSeenAt = row.same_device_last_seen_at || null;
  const sameDeviceLastSeenMs = parseDateMs(sameDeviceLastSeenAt);
  return {
    hasTrustedDeviceForEmail: !!row.has_trusted_device_for_email,
    sameDeviceTrusted: !!row.same_device_trusted,
    recentLoginOnSameDevice: sameDeviceLastSeenMs > 0 && (Date.now() - sameDeviceLastSeenMs) <= TRUSTED_DEVICE_RECENT_LOGIN_MS,
    sameDeviceLastSeenAt,
    trustedDeviceLabel: String(row.same_device_label || '').trim(),
  };
}

export async function createPasswordResetSupportRequest({ userId, email, error = null, source = 'email_delivery_failed', payload = {} }) {
  const normalizedEmail = normalizeEmail(email);
  if (!userId || !normalizedEmail) return null;
  const nextPayload = normalizeSupportPayload(payload);
  const deviceId = String(nextPayload.deviceId || '').trim();
  const rateLimit = await getSupportRateLimitContext({ email: normalizedEmail, deviceId });
  const trustSignals = await getTrustedDeviceSignals({ email: normalizedEmail, deviceId });

  const active = await pool.query(
    `SELECT id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at
     FROM password_reset_support_requests
     WHERE user_id = $1
       AND email = $2
       AND status IN ('pending', 'approved')
       AND completed_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, normalizedEmail],
  );

  const existing = active.rows[0] || null;
  const lastError = error?.message || error?.code || null;
  const basePayload = {
    ...nextPayload,
    deviceId,
    trustSignals,
    rateLimit: {
      recentEmailAttempts: rateLimit.recentEmailAttempts,
      recentDeviceAttempts: rateLimit.recentDeviceAttempts,
    },
    lastRequestedAt: new Date().toISOString(),
  };

  if (rateLimit.cooldownRemainingMs > 0) {
    const cooldownError = buildSupportRateLimitError(
      'support_request_cooldown',
      `Aguarde ${Math.ceil(rateLimit.cooldownRemainingMs / 1000)}s para gerar outro pedido`,
      {
        retryAfterMs: rateLimit.cooldownRemainingMs,
        retryAfterSeconds: Math.max(1, Math.ceil(rateLimit.cooldownRemainingMs / 1000)),
        recentEmailAttempts: rateLimit.recentEmailAttempts,
        recentDeviceAttempts: rateLimit.recentDeviceAttempts,
      },
    );
    if (existing) {
      cooldownError.request = {
        ...existing,
        payload: {
          ...normalizeSupportPayload(existing.payload),
          ...basePayload,
        },
      };
    }
    throw cooldownError;
  }

  if (!existing) {
    if (rateLimit.recentEmailAttempts >= SUPPORT_REQUEST_MAX_PER_EMAIL) {
      throw buildSupportRateLimitError(
        'support_request_rate_limited_email',
        'Muitas tentativas recentes para este email. Aguarde alguns minutos.',
        {
          recentEmailAttempts: rateLimit.recentEmailAttempts,
          recentDeviceAttempts: rateLimit.recentDeviceAttempts,
        },
      );
    }
    if (deviceId && rateLimit.recentDeviceAttempts >= SUPPORT_REQUEST_MAX_PER_DEVICE) {
      throw buildSupportRateLimitError(
        'support_request_rate_limited_device',
        'Muitas tentativas recentes neste aparelho. Aguarde alguns minutos.',
        {
          recentEmailAttempts: rateLimit.recentEmailAttempts,
          recentDeviceAttempts: rateLimit.recentDeviceAttempts,
        },
      );
    }
  }

  if (existing?.status === 'pending') {
    const existingPayload = normalizeSupportPayload(existing.payload);
    const mergedPayload = {
      ...existingPayload,
      ...basePayload,
      requestCount: Math.max(Number(existingPayload.requestCount || 1), 1) + 1,
    };
    const updated = await pool.query(
      `UPDATE password_reset_support_requests
       SET last_error = $2,
           payload = COALESCE(payload, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at`,
      [existing.id, lastError, JSON.stringify(mergedPayload)],
    );
    return updated.rows[0] || existing;
  }

  if (existing?.status === 'approved') {
    const existingPayload = normalizeSupportPayload(existing.payload);
    const mergedPayload = {
      ...existingPayload,
      ...basePayload,
      requestCount: Math.max(Number(existingPayload.requestCount || 1), 1) + 1,
    };
    const updated = await pool.query(
      `UPDATE password_reset_support_requests
       SET last_error = $2,
           payload = COALESCE(payload, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at`,
      [existing.id, lastError, JSON.stringify(mergedPayload)],
    );
    return updated.rows[0] || existing;
  }

  const expiresAt = new Date(Date.now() + SUPPORT_REQUEST_TTL_MS).toISOString();
  const requestPayload = {
    ...basePayload,
    requestCount: 1,
  };
  const inserted = await pool.query(
    `INSERT INTO password_reset_support_requests (
        user_id,
        email,
        request_key,
        status,
        source,
        last_error,
        payload,
        expires_at
      )
      VALUES ($1, $2, $3, 'pending', $4, $5, $6::jsonb, $7)
      RETURNING id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at`,
    [userId, normalizedEmail, randomUUID(), source, lastError, JSON.stringify(requestPayload), expiresAt],
  );
  return inserted.rows[0] || null;
}

export async function getPasswordResetSupportRequestByKey({ email, requestKey }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedKey = String(requestKey || '').trim();
  if (!normalizedEmail || !normalizedKey) return null;

  const result = await pool.query(
    `SELECT id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at
     FROM password_reset_support_requests
     WHERE email = $1
       AND request_key = $2
     LIMIT 1`,
    [normalizedEmail, normalizedKey],
  );
  return result.rows[0] || null;
}

export async function approvePasswordResetSupportRequest({ requestId, approvedByUserId, durationMinutes = 120 }) {
  const safeDurationMinutes = Math.min(Math.max(Number(durationMinutes) || 120, 5), 120);
  const result = await pool.query(
    `UPDATE password_reset_support_requests
     SET status = 'approved',
         approved_by_user_id = $2,
         denied_by_user_id = NULL,
         approved_at = NOW(),
         denied_at = NULL,
         updated_at = NOW(),
         expires_at = GREATEST(expires_at, NOW() + make_interval(mins => $3))
     WHERE id = $1
     RETURNING id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at`,
    [requestId, approvedByUserId || null, safeDurationMinutes],
  );
  return result.rows[0] || null;
}

export async function denyPasswordResetSupportRequest({ requestId, deniedByUserId }) {
  const result = await pool.query(
    `UPDATE password_reset_support_requests
     SET status = 'denied',
         denied_by_user_id = $2,
         approved_by_user_id = NULL,
         denied_at = NOW(),
         approved_at = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at`,
    [requestId, deniedByUserId || null],
  );
  return result.rows[0] || null;
}

export async function completePasswordResetSupportRequest({ requestId, client = null }) {
  const queryable = client?.query ? client : pool;
  const result = await queryable.query(
    `UPDATE password_reset_support_requests
     SET status = 'completed',
         completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, user_id, email, request_key, status, source, last_error, payload, expires_at, approved_at, denied_at, completed_at, created_at, updated_at`,
    [requestId],
  );
  return result.rows[0] || null;
}

export async function getRecentPasswordResetSupportRequests({ limit = 12, status = null } = {}) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 12, 1), 100);
  const params = [];
  const where = [];

  if (status) {
    params.push(String(status));
    where.push(`status = $${params.length}`);
  }

  params.push(boundedLimit);
  const result = await pool.query(
    `SELECT req.id, req.user_id, req.email, req.request_key, req.status, req.source, req.last_error, req.payload, req.expires_at, req.approved_at, req.denied_at, req.completed_at, req.created_at, req.updated_at,
            user_row.name AS user_name,
            approver.email AS approved_by_email,
            denier.email AS denied_by_email
     FROM password_reset_support_requests req
     LEFT JOIN users user_row ON user_row.id = req.user_id
     LEFT JOIN users approver ON approver.id = req.approved_by_user_id
     LEFT JOIN users denier ON denier.id = req.denied_by_user_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY req.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const rows = result.rows || [];
  return Promise.all(rows.map(async (row) => {
    const supportMeta = await buildPasswordResetSupportRequestMeta(row);
    return {
      ...row,
      supportMeta,
    };
  }));
}

export async function getPasswordResetSupportRequestStats() {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > NOW())::int AS pending,
       COUNT(*) FILTER (WHERE status = 'approved' AND expires_at > NOW())::int AS approved,
       COUNT(*) FILTER (WHERE status = 'denied')::int AS denied
     FROM password_reset_support_requests`,
  );
  return result.rows[0] || { pending: 0, approved: 0, denied: 0 };
}

export function getPasswordResetSupportRequestStatus(request) {
  if (!request) return 'missing';
  if (request.status === 'completed') return 'completed';
  if (request.status === 'denied') return 'denied';
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) return 'expired';
  if (request.status === 'approved') return 'approved';
  return 'pending';
}

export async function buildPasswordResetSupportRequestMeta(request) {
  if (!request) {
    return {
      status: 'missing',
      canRetry: true,
      retryAfterMs: 0,
      retryAfterSeconds: 0,
      trustSignals: {
        hasTrustedDeviceForEmail: false,
        sameDeviceTrusted: false,
        recentLoginOnSameDevice: false,
        trustedDeviceLabel: '',
      },
    };
  }

  const payload = normalizeSupportPayload(request.payload);
  const deviceId = String(payload.deviceId || '').trim();
  const status = getPasswordResetSupportRequestStatus(request);
  const requestedAt = String(payload.lastRequestedAt || request.updated_at || request.created_at || '');
  const trustSignals = payload.trustSignals || await getTrustedDeviceSignals({ email: request.email, deviceId });
  const requestedAtMs = parseDateMs(requestedAt);
  const retryAfterMs = status === 'pending' && requestedAtMs
    ? Math.max(0, SUPPORT_REQUEST_COOLDOWN_MS - (Date.now() - requestedAtMs))
    : 0;
  const canRetry = ['missing', 'expired', 'denied'].includes(status) || retryAfterMs <= 0;

  return {
    status,
    requestedAt,
    expiresAt: request.expires_at || '',
    approvedAt: request.approved_at || '',
    deniedAt: request.denied_at || '',
    completedAt: request.completed_at || '',
    canRetry,
    retryAfterMs,
    retryAfterSeconds: retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0,
    source: String(request.source || ''),
    attemptCount: Math.max(Number(payload.requestCount || 1), 1),
    trustSignals,
    rateLimit: {
      recentEmailAttempts: Number(payload.rateLimit?.recentEmailAttempts || 0),
      recentDeviceAttempts: Number(payload.rateLimit?.recentDeviceAttempts || 0),
    },
  };
}
