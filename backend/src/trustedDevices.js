import { createHash, randomUUID } from 'node:crypto';

import { pool } from './db.js';
import { normalizeEmail } from './devAccess.js';

const TRUSTED_DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function hashTrustedToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export async function issueTrustedDeviceGrant({ userId, email, deviceId, label = '' }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeviceId = String(deviceId || '').trim();
  if (!userId || !normalizedEmail || !normalizedDeviceId) return null;

  const token = randomUUID();
  const tokenHash = hashTrustedToken(token);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString();
  const deviceLabel = String(label || '').trim().slice(0, 160) || null;

  const existing = await pool.query(
    `SELECT id
     FROM trusted_devices
     WHERE user_id = $1
       AND email = $2
       AND device_id = $3
       AND revoked_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, normalizedEmail, normalizedDeviceId],
  );

  if (existing.rows[0]?.id) {
    await pool.query(
      `UPDATE trusted_devices
       SET token_hash = $2,
           label = COALESCE($3, label),
           expires_at = $4,
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, tokenHash, deviceLabel, expiresAt],
    );
  } else {
    await pool.query(
      `INSERT INTO trusted_devices (user_id, email, device_id, label, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, normalizedEmail, normalizedDeviceId, deviceLabel, tokenHash, expiresAt],
    );
  }

  return {
    deviceId: normalizedDeviceId,
    trustedToken: token,
    expiresAt,
    label: deviceLabel,
  };
}

export async function authenticateTrustedDevice({ email, deviceId, trustedToken }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeviceId = String(deviceId || '').trim();
  const token = String(trustedToken || '').trim();
  if (!normalizedEmail || !normalizedDeviceId || !token) return null;

  const result = await pool.query(
    `SELECT td.id, td.user_id, td.email, td.device_id, td.label, td.token_hash, td.expires_at,
            u.id AS user_row_id, u.email AS user_email, u.name AS user_name, u.is_admin, u.email_verified, u.email_verified_at
     FROM trusted_devices td
     JOIN users u ON u.id = td.user_id
     WHERE td.email = $1
       AND td.device_id = $2
       AND td.revoked_at IS NULL
     ORDER BY td.updated_at DESC
     LIMIT 1`,
    [normalizedEmail, normalizedDeviceId],
  );

  const row = result.rows[0] || null;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.token_hash !== hashTrustedToken(token)) return null;

  await pool.query(
    `UPDATE trusted_devices
     SET last_seen_at = NOW(),
         updated_at = NOW(),
         expires_at = $2
     WHERE id = $1`,
    [row.id, new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString()],
  );

  return {
    user: {
      id: row.user_row_id,
      email: row.user_email,
      name: row.user_name,
      is_admin: row.is_admin,
      email_verified: row.email_verified,
      email_verified_at: row.email_verified_at,
    },
    device: {
      id: row.id,
      deviceId: row.device_id,
      label: row.label || null,
    },
  };
}
