import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { getAccessContextForUser, getActiveSubscriptionForUser, getUserMemberships } from '../access.js';
import { selectEffectiveAthleteBenefits } from '../accessPolicy.js';

export function createAthleteRouter({ buildBenchmarkTrendSeries, buildPrTrendSeries }) {
  const router = express.Router();

  function normalizeSportType(value) {
    const raw = String(value || 'cross').trim().toLowerCase();
    return ['cross', 'running', 'strength'].includes(raw) ? raw : 'cross';
  }

  async function validateAccessibleWorkout(workoutId, userId, sportType) {
    if (!Number.isFinite(workoutId)) return null;

    const result = await pool.query(
      `SELECT DISTINCT w.id, w.title
       FROM workouts w
       JOIN gym_memberships gm ON gm.gym_id = w.gym_id
       LEFT JOIN workout_assignments wa ON wa.workout_id = w.id
       WHERE w.id = $1
         AND w.sport_type = $2
         AND gm.user_id = $3
         AND gm.status = 'active'
         AND (wa.gym_membership_id IS NULL OR wa.gym_membership_id = gm.id)
       LIMIT 1`,
      [workoutId, sportType, userId],
    );

    return result.rows[0] || null;
  }

  async function loadAthleteAccessSnapshot(userId, sportType) {
    const memberships = await getUserMemberships(userId);
    const gymIds = memberships.map((membership) => membership.gym_id);
    const [contexts, personalSubscription] = await Promise.all([
      getAccessContextForUser(userId),
      getActiveSubscriptionForUser(userId),
    ]);
    const athleteBenefits = selectEffectiveAthleteBenefits({ gymContexts: contexts, personalSubscription });
    const allowedGymIds = contexts
      .filter((ctx) => ctx?.access?.gymAccess?.canAthletesUseApp)
      .map((ctx) => ctx.membership.gym_id);

    return {
      memberships,
      gymIds,
      contexts,
      personalSubscription,
      athleteBenefits,
      allowedGymIds,
      sportType,
    };
  }

  function buildHistoryWindowFilter(athleteBenefits) {
    const cutoffTime = athleteBenefits?.historyDays
      ? Date.now() - Number(athleteBenefits.historyDays) * 24 * 60 * 60 * 1000
      : null;

    return (value) => {
      if (!cutoffTime) return true;
      const timestamp = new Date(value || 0).getTime();
      if (!Number.isFinite(timestamp)) return false;
      return timestamp >= cutoffTime;
    };
  }

  function buildGymAccessRows(contexts = []) {
    return contexts.map((ctx) => ({
      gymId: ctx.membership.gym_id,
      gymName: ctx.membership.gym_name,
      role: ctx.membership.role,
      canAthletesUseApp: ctx?.access?.gymAccess?.canAthletesUseApp || false,
      warning: ctx?.access?.gymAccess?.warning || null,
      athleteBenefits: ctx?.access?.athleteBenefits || null,
    }));
  }

  async function loadAthleteSummaryBlock(userId, access) {
    const [resultCountRes, workoutCountRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM benchmark_results WHERE user_id = $1 AND sport_type = $2`, [userId, access.sportType]),
      access.allowedGymIds.length
        ? pool.query(`SELECT COUNT(*)::int AS total FROM workouts WHERE gym_id = ANY($1::int[]) AND sport_type = $2`, [access.allowedGymIds, access.sportType])
        : Promise.resolve({ rows: [{ total: 0 }] }),
    ]);

    return {
      stats: {
        gyms: access.gymIds.length,
        activeGyms: access.allowedGymIds.length,
        resultsLogged: Number(resultCountRes.rows[0]?.total || 0),
        assignedWorkouts: Number(workoutCountRes.rows[0]?.total || 0),
        sportType: access.sportType,
        athleteTier: access.athleteBenefits?.tier || 'base',
      },
      athleteBenefits: access.athleteBenefits,
      personalSubscription: access.personalSubscription,
      gymAccess: buildGymAccessRows(access.contexts),
    };
  }

  async function loadAthleteResultsBlock(userId, access) {
    const isWithinHistoryWindow = buildHistoryWindowFilter(access.athleteBenefits);
    const [resultsRes, benchmarkTrendRes, prTrendRes, measurementRes, runningHistoryRes, strengthHistoryRes] = await Promise.all([
      pool.query(
        `SELECT
          br.*,
          b.name AS benchmark_name,
          b.category AS benchmark_category,
          g.name AS gym_name
         FROM benchmark_results br
         JOIN benchmark_library b ON b.slug = br.benchmark_slug
         LEFT JOIN gyms g ON g.id = br.gym_id
         WHERE br.user_id = $1
           AND br.sport_type = $2
         ORDER BY br.created_at DESC
         LIMIT 8`,
        [userId, access.sportType],
      ),
      pool.query(
        `SELECT
          br.benchmark_slug,
          b.name AS benchmark_name,
          b.score_type,
          br.score_display,
          br.score_value,
          br.created_at
         FROM benchmark_results br
         JOIN benchmark_library b ON b.slug = br.benchmark_slug
         WHERE br.user_id = $1
           AND br.sport_type = $2
         ORDER BY br.created_at DESC
         LIMIT 60`,
        [userId, access.sportType],
      ),
      access.sportType === 'cross'
        ? pool.query(
            `SELECT exercise, value, unit, source, created_at
             FROM athlete_pr_records
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 80`,
            [userId],
          )
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT id, type, label, unit, value, notes, recorded_at, created_at
         FROM athlete_measurements
         WHERE user_id = $1
         ORDER BY recorded_at DESC, created_at DESC
         LIMIT 120`,
        [userId],
      ),
      access.sportType === 'running'
        ? pool.query(
            `SELECT id, workout_id, title, session_type, distance_km, duration_min, avg_pace, target_pace, zone, notes, logged_at
             FROM running_session_logs
             WHERE user_id = $1
             ORDER BY logged_at DESC
             LIMIT 20`,
            [userId],
          )
        : Promise.resolve({ rows: [] }),
      access.sportType === 'strength'
        ? pool.query(
            `SELECT id, workout_id, exercise, sets_count, reps_text, load_value, load_text, rir, notes, logged_at
             FROM strength_session_logs
             WHERE user_id = $1
             ORDER BY logged_at DESC
             LIMIT 24`,
            [userId],
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const benchmarkHistory = buildBenchmarkTrendSeries(benchmarkTrendRes.rows)
      .map((item) => ({
        ...item,
        points: (item.points || []).filter((point) => isWithinHistoryWindow(point.createdAt || point.date)),
      }))
      .filter((item) => item.points.length);

    const prHistory = access.sportType === 'cross'
      ? buildPrTrendSeries(prTrendRes.rows)
        .map((item) => ({
          ...item,
          points: (item.points || []).filter((point) => isWithinHistoryWindow(point.createdAt || point.date)),
        }))
        .filter((item) => item.points.length)
      : [];

    const prCurrent = prHistory.reduce((acc, item) => {
      acc[item.exercise] = item.latestValue;
      return acc;
    }, {});

    return {
      recentResults: resultsRes.rows.filter((row) => isWithinHistoryWindow(row.created_at)),
      benchmarkHistory,
      prHistory,
      prCurrent,
      measurements: measurementRes.rows,
      runningHistory: runningHistoryRes.rows.filter((row) => isWithinHistoryWindow(row.logged_at)),
      strengthHistory: strengthHistoryRes.rows.filter((row) => isWithinHistoryWindow(row.logged_at)),
    };
  }

  async function loadAthleteWorkoutsBlock(access) {
    if (!access.allowedGymIds.length) {
      return { recentWorkouts: [] };
    }

    const workoutsRes = await pool.query(
      `SELECT
        w.id,
        w.title,
        w.scheduled_date,
        w.published_at,
        g.name AS gym_name
       FROM workouts w
       JOIN gyms g ON g.id = w.gym_id
       WHERE w.gym_id = ANY($1::int[])
         AND w.sport_type = $2
       ORDER BY w.scheduled_date DESC, w.created_at DESC
       LIMIT 8`,
      [access.allowedGymIds, access.sportType],
    );

    const isWithinHistoryWindow = buildHistoryWindowFilter(access.athleteBenefits);
    return {
      recentWorkouts: workoutsRes.rows.filter((row) => isWithinHistoryWindow(row.scheduled_date || row.published_at)),
    };
  }

  router.post('/athletes/me/prs', authRequired, async (req, res) => {
    const exercise = String(req.body?.exercise || '').trim().toUpperCase();
    const value = Number(req.body?.value);
    const unit = String(req.body?.unit || 'kg').trim().toLowerCase();
    const source = String(req.body?.source || 'manual').trim().toLowerCase();

    if (!exercise || !Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'exercise e value válidos são obrigatórios' });
    }

    const inserted = await pool.query(
      `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.user.userId, exercise, value, unit || 'kg', source || 'manual'],
    );

    return res.json({ prRecord: inserted.rows[0] });
  });

  router.post('/athletes/me/prs/snapshot', authRequired, async (req, res) => {
    const prs = req.body?.prs;
    if (!prs || typeof prs !== 'object' || Array.isArray(prs)) {
      return res.status(400).json({ error: 'prs deve ser um objeto { EXERCISE: value }' });
    }

    const entries = Object.entries(prs)
      .map(([exercise, value]) => [String(exercise || '').trim().toUpperCase(), Number(value)])
      .filter(([exercise, value]) => exercise && Number.isFinite(value) && value > 0);

    let insertedCount = 0;

    for (const [exercise, value] of entries) {
      const latest = await pool.query(
        `SELECT value
         FROM athlete_pr_records
         WHERE user_id = $1 AND exercise = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.user.userId, exercise],
      );
      const current = latest.rows[0] ? Number(latest.rows[0].value) : null;
      if (current === value) continue;

      await pool.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
         VALUES ($1,$2,$3,'kg','snapshot')`,
        [req.user.userId, exercise, value],
      );
      insertedCount += 1;
    }

    return res.json({ inserted: insertedCount, total: entries.length });
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

    const normalized = [];
    for (const entry of entries) {
      const id = String(entry?.id || '').trim();
      const type = String(entry?.type || 'custom').trim().toLowerCase();
      const label = String(entry?.label || '').trim();
      const unit = String(entry?.unit || '').trim();
      const value = Number(entry?.value);
      const notes = String(entry?.notes || '').trim();
      const recordedAt = String(entry?.recordedAt || '').trim();

      if (!id || !label || !Number.isFinite(value) || !recordedAt) {
        return res.status(400).json({ error: 'Cada medida precisa de id, label, value e recordedAt válidos' });
      }

      normalized.push({
        id,
        type: type || 'custom',
        label,
        unit,
        value,
        notes: notes || null,
        recordedAt,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM athlete_measurements WHERE user_id = $1`, [req.user.userId]);

      for (const entry of normalized) {
        await client.query(
          `INSERT INTO athlete_measurements (id, user_id, type, label, unit, value, notes, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            entry.id,
            req.user.userId,
            entry.type,
            entry.label,
            entry.unit || '',
            entry.value,
            entry.notes,
            entry.recordedAt,
          ],
        );
      }

      await client.query('COMMIT');
      return res.json({ synced: normalized.length });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
    const results = await loadAthleteResultsBlock(req.user.userId, access);
    return res.json(results);
  });

  router.get('/athletes/me/workouts/recent', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType);
    const access = await loadAthleteAccessSnapshot(req.user.userId, sportType);
    const workouts = await loadAthleteWorkoutsBlock(access);
    return res.json(workouts);
  });

  router.post('/athletes/me/running/logs', authRequired, async (req, res) => {
    const workoutId = req.body?.workoutId !== undefined && req.body?.workoutId !== '' ? Number(req.body.workoutId) : null;
    const completionState = String(req.body?.completionState || '').trim().toLowerCase();
    const sourceLabel = String(req.body?.sourceLabel || '').trim();
    const title = String(req.body?.title || '').trim();
    const sessionType = String(req.body?.sessionType || '').trim().toLowerCase();
    const distanceKm = req.body?.distanceKm !== undefined && req.body?.distanceKm !== '' ? Number(req.body.distanceKm) : null;
    const durationMin = req.body?.durationMin !== undefined && req.body?.durationMin !== '' ? Number(req.body.durationMin) : null;
    const avgPace = String(req.body?.avgPace || '').trim();
    const targetPace = String(req.body?.targetPace || '').trim();
    const zone = String(req.body?.zone || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
    const loggedAt = String(req.body?.loggedAt || '').trim();

    if (!title && !sessionType && !Number.isFinite(distanceKm) && !Number.isFinite(durationMin)) {
      return res.status(400).json({ error: 'Informe ao menos título, tipo, distância ou duração' });
    }

    const workout = await validateAccessibleWorkout(workoutId, req.user.userId, 'running');
    if (workoutId && !workout) {
      return res.status(400).json({ error: 'workoutId inválido para esta conta' });
    }

    const inserted = await pool.query(
      `INSERT INTO running_session_logs (user_id, workout_id, title, session_type, distance_km, duration_min, avg_pace, target_pace, zone, notes, payload, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        req.user.userId,
        workout?.id || null,
        title || workout?.title || null,
        sessionType || null,
        Number.isFinite(distanceKm) ? distanceKm : null,
        Number.isFinite(durationMin) ? durationMin : null,
        avgPace || null,
        targetPace || null,
        zone || null,
        notes || null,
        payload,
        loggedAt || new Date().toISOString(),
      ],
    );

    const log = inserted.rows[0];
    await pool.query(
      `UPDATE running_session_logs
       SET completion_state = $2,
           source_label = $3
       WHERE id = $1`,
      [
        log.id,
        workout?.id ? 'completed_from_coach' : (completionState || 'manual'),
        sourceLabel || workout?.title || null,
      ],
    );

    const refreshed = await pool.query(
      `SELECT *
       FROM running_session_logs
       WHERE id = $1`,
      [log.id],
    );

    return res.json({ log: refreshed.rows[0] });
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
    const workoutId = req.body?.workoutId !== undefined && req.body?.workoutId !== '' ? Number(req.body.workoutId) : null;
    const completionState = String(req.body?.completionState || '').trim().toLowerCase();
    const sourceLabel = String(req.body?.sourceLabel || '').trim();
    const exercise = String(req.body?.exercise || '').trim();
    const setsCount = req.body?.setsCount !== undefined && req.body?.setsCount !== '' ? Number(req.body.setsCount) : null;
    const repsText = String(req.body?.repsText || '').trim();
    const loadValue = req.body?.loadValue !== undefined && req.body?.loadValue !== '' ? Number(req.body.loadValue) : null;
    const loadText = String(req.body?.loadText || '').trim();
    const rir = req.body?.rir !== undefined && req.body?.rir !== '' ? Number(req.body.rir) : null;
    const notes = String(req.body?.notes || '').trim();
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
    const loggedAt = String(req.body?.loggedAt || '').trim();

    if (!exercise) {
      return res.status(400).json({ error: 'exercise é obrigatório' });
    }

    const workout = await validateAccessibleWorkout(workoutId, req.user.userId, 'strength');
    if (workoutId && !workout) {
      return res.status(400).json({ error: 'workoutId inválido para esta conta' });
    }

    const inserted = await pool.query(
      `INSERT INTO strength_session_logs (user_id, workout_id, exercise, sets_count, reps_text, load_value, load_text, rir, notes, payload, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user.userId,
        workout?.id || null,
        exercise,
        Number.isFinite(setsCount) ? setsCount : null,
        repsText || null,
        Number.isFinite(loadValue) ? loadValue : null,
        loadText || null,
        Number.isFinite(rir) ? rir : null,
        notes || null,
        payload,
        loggedAt || new Date().toISOString(),
      ],
    );

    const log = inserted.rows[0];
    await pool.query(
      `UPDATE strength_session_logs
       SET completion_state = $2,
           source_label = $3
       WHERE id = $1`,
      [
        log.id,
        workout?.id ? 'completed_from_coach' : (completionState || 'manual'),
        sourceLabel || workout?.title || null,
      ],
    );

    const refreshed = await pool.query(
      `SELECT *
       FROM strength_session_logs
       WHERE id = $1`,
      [log.id],
    );

    return res.json({ log: refreshed.rows[0] });
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
