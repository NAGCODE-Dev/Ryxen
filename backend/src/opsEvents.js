import { pool } from './db.js';
import { normalizeEmail } from './devAccess.js';

export async function logOpsEvent({ kind, status, userId = null, email = '', payload = {} }) {
  if (!kind || !status) return null;

  const normalizedEmail = normalizeEmail(email || '') || null;
  const result = await pool.query(
    `INSERT INTO ops_events (kind, status, user_id, email, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [String(kind), String(status), userId || null, normalizedEmail, payload || {}],
  );

  return result.rows[0] || null;
}

export async function getRecentOpsEvents({ kind = null, limit = 20 } = {}) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const params = [];
  const where = [];

  if (kind) {
    params.push(String(kind));
    where.push(`kind = $${params.length}`);
  }

  params.push(boundedLimit);
  const result = await pool.query(
    `SELECT id, kind, status, user_id, email, payload, created_at
     FROM ops_events
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}
