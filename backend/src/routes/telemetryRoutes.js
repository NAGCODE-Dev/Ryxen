import express from 'express';

import { pool } from '../db.js';
import { decodeOptionalUserId } from '../auth.js';

export function createTelemetryRouter({ telemetryRateLimit }) {
  const router = express.Router();

  router.post('/ingest', telemetryRateLimit, async (req, res) => {
    const userId = decodeOptionalUserId(req);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!items.length) {
      return res.status(400).json({ error: 'items vazio' });
    }

    const trimmed = items.slice(0, 200);
    await pool.query(
      `INSERT INTO telemetry_events (user_id, item)
       SELECT $1, value
       FROM jsonb_array_elements($2::jsonb) AS value`,
      [userId, JSON.stringify(trimmed)],
    );

    return res.json({ success: true, accepted: trimmed.length });
  });

  return router;
}
