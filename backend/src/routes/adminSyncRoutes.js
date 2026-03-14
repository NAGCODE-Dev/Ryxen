import express from 'express';

import { pool } from '../db.js';
import { adminRequired, authRequired } from '../auth.js';

export function createAdminSyncRouter() {
  const router = express.Router();

  router.post('/sync/push', authRequired, async (req, res) => {
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

  router.get('/sync/pull', authRequired, async (req, res) => {
    const found = await pool.query(
      `SELECT id, payload, created_at FROM sync_snapshots WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.userId],
    );

    const row = found.rows[0];
    if (!row) return res.json({ payload: null, snapshotId: null, savedAt: null });
    return res.json({ payload: row.payload, snapshotId: row.id, savedAt: row.created_at });
  });

  router.get('/sync/snapshots', authRequired, async (req, res) => {
    const rows = await pool.query(
      `SELECT id, created_at FROM sync_snapshots WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.userId],
    );

    return res.json({ snapshots: rows.rows.map((r) => ({ id: r.id, savedAt: r.created_at })) });
  });

  router.get('/admin/overview', adminRequired, async (req, res) => {
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

  return router;
}
