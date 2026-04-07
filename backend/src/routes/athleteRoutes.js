import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import {
  loadAthleteAccessSnapshot,
  loadAthleteResultsBlock,
  loadAthleteSummaryBlock,
  loadAthleteWorkoutsBlock,
} from '../queries/athleteDashboardQueries.js';
import {
  createAthletePrRecord,
  syncAthleteMeasurementsSnapshot,
  syncAthletePrSnapshot,
} from '../services/athleteWriteServices.js';
import { createRunningLog, createStrengthLog } from '../services/athleteLogServices.js';
import { normalizeSportType } from '../utils/sportType.js';

export function createAthleteRouter({ buildBenchmarkTrendSeries, buildPrTrendSeries }) {
  const router = express.Router();

  router.post('/athletes/me/prs', authRequired, async (req, res) => {
    const exercise = String(req.body?.exercise || '').trim().toUpperCase();
    const value = Number(req.body?.value);
    const unit = String(req.body?.unit || 'kg').trim().toLowerCase();
    const source = String(req.body?.source || 'manual').trim().toLowerCase();

    if (!exercise || !Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'exercise e value válidos são obrigatórios' });
    }

    const created = await createAthletePrRecord({
      userId: req.user.userId,
      exercise,
      value,
      unit,
      source,
    });
    return res.json(created);
  });

  router.post('/athletes/me/prs/snapshot', authRequired, async (req, res) => {
    const prs = req.body?.prs;
    if (!prs || typeof prs !== 'object' || Array.isArray(prs)) {
      return res.status(400).json({ error: 'prs deve ser um objeto { EXERCISE: value }' });
    }

    const synced = await syncAthletePrSnapshot({
      userId: req.user.userId,
      prs,
    });
    return res.json(synced);
  });

  router.get('/athletes/me/measurements/history', authRequired, async (req, res) => {
    const result = await pool.query(
      `SELECT id, type, label, unit, value, notes, recorded_at, created_at
       FROM athlete_measurements
       WHERE user_id = $1
       ORDER BY recorded_at DESC, created_at DESC
       LIMIT 120`,
      [req.user.userId],
    );

    return res.json({ measurements: result.rows });
  });

  router.post('/athletes/me/measurements/snapshot', authRequired, async (req, res) => {
    const entries = Array.isArray(req.body?.measurements) ? req.body.measurements : null;
    if (!entries) {
      return res.status(400).json({ error: 'measurements deve ser um array' });
    }

    const synced = await syncAthleteMeasurementsSnapshot({
      userId: req.user.userId,
      measurements: entries,
    });
    if (synced.error) {
      return res.status(synced.code || 400).json({ error: synced.error });
    }
    return res.json(synced);
  });

  router.get('/athletes/me/summary', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType);
    const access = await loadAthleteAccessSnapshot(req.user.userId, sportType);
    const summary = await loadAthleteSummaryBlock(req.user.userId, access);
    return res.json(summary);
  });

  router.get('/athletes/me/results/summary', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType);
    const access = await loadAthleteAccessSnapshot(req.user.userId, sportType);
    const results = await loadAthleteResultsBlock(req.user.userId, access, {
      buildBenchmarkTrendSeries,
      buildPrTrendSeries,
    });
    return res.json(results);
  });

  router.get('/athletes/me/workouts/recent', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType);
    const access = await loadAthleteAccessSnapshot(req.user.userId, sportType);
    const workouts = await loadAthleteWorkoutsBlock(access);
    return res.json(workouts);
  });

  router.get('/athletes/me/imported-plan', authRequired, async (req, res) => {
    const snapshotRes = await pool.query(
      `SELECT id, payload, created_at
       FROM sync_snapshots
       WHERE user_id = $1
         AND COALESCE(payload->>'kind', '') = 'imported_plan'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [req.user.userId],
    );

    const row = snapshotRes.rows[0];
    if (!row) {
      return res.json({ importedPlan: null });
    }

    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return res.json({
      importedPlan: {
        weeks: Array.isArray(payload.weeks) ? payload.weeks : [],
        metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
        activeWeekNumber: Number(payload.activeWeekNumber) || null,
        updatedAt: payload.updatedAt || row.created_at,
      },
    });
  });

  router.get('/athletes/me/app-state', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType);
    const snapshotRes = await pool.query(
      `SELECT id, payload, created_at
       FROM sync_snapshots
       WHERE user_id = $1
         AND COALESCE(payload->>'kind', '') = 'app_state'
         AND COALESCE(payload->>'sportType', 'cross') = $2
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [req.user.userId, sportType],
    );

    const row = snapshotRes.rows[0];
    if (!row) {
      return res.json({ appState: null });
    }

    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return res.json({
      appState: {
        sportType,
        snapshot: payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : {},
        updatedAt: payload.updatedAt || row.created_at,
      },
    });
  });

  router.put('/athletes/me/app-state', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType || req.body?.sportType);
    const snapshot = req.body?.snapshot && typeof req.body.snapshot === 'object' ? req.body.snapshot : null;
    const updatedAt = String(req.body?.updatedAt || '').trim() || new Date().toISOString();

    if (!snapshot) {
      return res.status(400).json({ error: 'snapshot é obrigatório' });
    }

    const payload = {
      kind: 'app_state',
      sportType,
      snapshot,
      updatedAt,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM sync_snapshots
         WHERE user_id = $1
           AND COALESCE(payload->>'kind', '') = 'app_state'
           AND COALESCE(payload->>'sportType', 'cross') = $2`,
        [req.user.userId, sportType],
      );
      const inserted = await client.query(
        `INSERT INTO sync_snapshots (user_id, payload)
         VALUES ($1, $2::jsonb)
         RETURNING id, payload, created_at`,
        [req.user.userId, JSON.stringify(payload)],
      );
      await client.query('COMMIT');

      const row = inserted.rows[0];
      return res.json({
        appState: {
          sportType,
          snapshot: row.payload?.snapshot && typeof row.payload.snapshot === 'object' ? row.payload.snapshot : {},
          updatedAt: row.payload?.updatedAt || row.created_at,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  router.put('/athletes/me/imported-plan', authRequired, async (req, res) => {
    const weeks = Array.isArray(req.body?.weeks) ? req.body.weeks : null;
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const activeWeekNumber = Number(req.body?.activeWeekNumber) || null;

    if (!weeks?.length) {
      return res.status(400).json({ error: 'weeks deve ser um array não vazio' });
    }

    const payload = {
      kind: 'imported_plan',
      weeks,
      metadata,
      activeWeekNumber,
      updatedAt: new Date().toISOString(),
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM sync_snapshots
         WHERE user_id = $1
           AND COALESCE(payload->>'kind', '') = 'imported_plan'`,
        [req.user.userId],
      );
      const inserted = await client.query(
        `INSERT INTO sync_snapshots (user_id, payload)
         VALUES ($1, $2::jsonb)
         RETURNING id, payload, created_at`,
        [req.user.userId, JSON.stringify(payload)],
      );
      await client.query('COMMIT');

      const row = inserted.rows[0];
      return res.json({
        importedPlan: {
          weeks: Array.isArray(row.payload?.weeks) ? row.payload.weeks : [],
          metadata: row.payload?.metadata && typeof row.payload.metadata === 'object' ? row.payload.metadata : {},
          activeWeekNumber: Number(row.payload?.activeWeekNumber) || null,
          updatedAt: row.payload?.updatedAt || row.created_at,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  router.delete('/athletes/me/imported-plan', authRequired, async (req, res) => {
    const deleted = await pool.query(
      `DELETE FROM sync_snapshots
       WHERE user_id = $1
         AND COALESCE(payload->>'kind', '') = 'imported_plan'`,
      [req.user.userId],
    );

    return res.json({ deleted: deleted.rowCount || 0 });
  });

  router.post('/athletes/me/running/logs', authRequired, async (req, res) => {
    const created = await createRunningLog({
      userId: req.user.userId,
      input: req.body,
    });
    if (created.error) {
      return res.status(created.code || 400).json({ error: created.error });
    }
    return res.json(created);
  });

  router.get('/athletes/me/running/history', authRequired, async (req, res) => {
    const [logsRes, summaryRes] = await Promise.all([
      pool.query(
        `SELECT id, workout_id, title, session_type, distance_km, duration_min, avg_pace, target_pace, zone, notes, payload, completion_state, source_label, logged_at
         FROM running_session_logs
         WHERE user_id = $1
         ORDER BY logged_at DESC
         LIMIT 30`,
        [req.user.userId],
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS total_sessions,
          COALESCE(SUM(distance_km), 0)::numeric AS total_distance_km,
          COALESCE(AVG(duration_min), 0)::numeric AS avg_duration_min
         FROM running_session_logs
         WHERE user_id = $1`,
        [req.user.userId],
      ),
    ]);

    return res.json({
      summary: summaryRes.rows[0] || { total_sessions: 0, total_distance_km: 0, avg_duration_min: 0 },
      logs: logsRes.rows,
    });
  });

  router.post('/athletes/me/strength/logs', authRequired, async (req, res) => {
    const created = await createStrengthLog({
      userId: req.user.userId,
      input: req.body,
    });
    if (created.error) {
      return res.status(created.code || 400).json({ error: created.error });
    }
    return res.json(created);
  });

  router.get('/athletes/me/strength/history', authRequired, async (req, res) => {
    const [logsRes, bestsRes] = await Promise.all([
      pool.query(
        `SELECT id, workout_id, exercise, sets_count, reps_text, load_value, load_text, rir, notes, payload, completion_state, source_label, logged_at
         FROM strength_session_logs
         WHERE user_id = $1
         ORDER BY logged_at DESC
         LIMIT 40`,
        [req.user.userId],
      ),
      pool.query(
        `SELECT
          exercise,
          MAX(load_value) AS best_load,
          COUNT(*)::int AS total_logs
         FROM strength_session_logs
         WHERE user_id = $1
         GROUP BY exercise
         ORDER BY exercise ASC`,
        [req.user.userId],
      ),
    ]);

    return res.json({
      bests: bestsRes.rows,
      logs: logsRes.rows,
    });
  });

  return router;
}
