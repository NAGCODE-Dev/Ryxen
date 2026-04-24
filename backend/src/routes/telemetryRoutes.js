import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';

export function createTelemetryRouter({ telemetryRateLimit, authMiddleware = authRequired }) {
  const router = express.Router();

  router.post('/ingest', telemetryRateLimit, authMiddleware, async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!items.length) {
      return res.status(400).json({ error: 'items vazio' });
    }

    const trimmed = items.slice(0, 100);
    await pool.query(
      `INSERT INTO telemetry_events (user_id, item)
       SELECT $1, value
       FROM jsonb_array_elements($2::jsonb) AS value`,
      [req.user.userId, JSON.stringify(trimmed)],
    );

    return res.json({ success: true, accepted: trimmed.length });
  });

  return router;
}
