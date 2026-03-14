import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { getAccessContextForUser, getUserMemberships } from '../access.js';

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

  router.get('/athletes/me/dashboard', authRequired, async (req, res) => {
    const memberships = await getUserMemberships(req.user.userId);
    const gymIds = memberships.map((membership) => membership.gym_id);
    const contexts = await getAccessContextForUser(req.user.userId);
    const allowedGymIds = contexts
      .filter((ctx) => ctx?.access?.gymAccess?.canAthletesUseApp)
      .map((ctx) => ctx.membership.gym_id);

    const [resultsRes, competitionsRes, workoutsRes, benchmarkTrendRes, prTrendRes, resultCountRes, competitionCountRes, workoutCountRes] = await Promise.all([
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
         ORDER BY br.created_at DESC
         LIMIT 8`,
        [req.user.userId],
      ),
      allowedGymIds.length
        ? pool.query(
            `SELECT
              c.id,
              c.title,
              c.location,
              c.starts_at,
              c.visibility,
              g.name AS gym_name,
              COUNT(ce.id)::int AS event_count
             FROM competitions c
             LEFT JOIN competition_events ce ON ce.competition_id = c.id
             LEFT JOIN gyms g ON g.id = c.gym_id
             WHERE c.gym_id = ANY($1::int[])
               AND c.starts_at >= NOW() - INTERVAL '1 day'
             GROUP BY c.id, g.name
             ORDER BY c.starts_at ASC
             LIMIT 6`,
            [allowedGymIds],
          )
        : Promise.resolve({ rows: [] }),
      allowedGymIds.length
        ? pool.query(
            `SELECT
              w.id,
              w.title,
              w.scheduled_date,
              w.published_at,
              g.name AS gym_name
             FROM workouts w
             JOIN gyms g ON g.id = w.gym_id
             WHERE w.gym_id = ANY($1::int[])
             ORDER BY w.scheduled_date DESC, w.created_at DESC
             LIMIT 8`,
            [allowedGymIds],
          )
        : Promise.resolve({ rows: [] }),
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
         ORDER BY br.created_at DESC
         LIMIT 60`,
        [req.user.userId],
      ),
      pool.query(
        `SELECT exercise, value, unit, source, created_at
         FROM athlete_pr_records
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 80`,
        [req.user.userId],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM benchmark_results WHERE user_id = $1`, [req.user.userId]),
      allowedGymIds.length
        ? pool.query(`SELECT COUNT(*)::int AS total FROM competitions WHERE gym_id = ANY($1::int[]) AND starts_at >= NOW() - INTERVAL '1 day'`, [allowedGymIds])
        : Promise.resolve({ rows: [{ total: 0 }] }),
      allowedGymIds.length
        ? pool.query(`SELECT COUNT(*)::int AS total FROM workouts WHERE gym_id = ANY($1::int[])`, [allowedGymIds])
        : Promise.resolve({ rows: [{ total: 0 }] }),
    ]);

    const benchmarkHistory = buildBenchmarkTrendSeries(benchmarkTrendRes.rows);
    const prHistory = buildPrTrendSeries(prTrendRes.rows);
    const prCurrent = prHistory.reduce((acc, item) => {
      acc[item.exercise] = item.latestValue;
      return acc;
    }, {});

    return res.json({
      stats: {
        gyms: gymIds.length,
        activeGyms: allowedGymIds.length,
        resultsLogged: Number(resultCountRes.rows[0]?.total || 0),
        upcomingCompetitions: Number(competitionCountRes.rows[0]?.total || 0),
        assignedWorkouts: Number(workoutCountRes.rows[0]?.total || 0),
        trackedBenchmarks: benchmarkHistory.length,
        trackedPrs: prHistory.length,
      },
      recentResults: resultsRes.rows,
      upcomingCompetitions: competitionsRes.rows,
      recentWorkouts: workoutsRes.rows,
      benchmarkHistory,
      prHistory,
      prCurrent,
      gymAccess: contexts.map((ctx) => ({
        gymId: ctx.membership.gym_id,
        gymName: ctx.membership.gym_name,
        role: ctx.membership.role,
        canAthletesUseApp: ctx?.access?.gymAccess?.canAthletesUseApp || false,
        warning: ctx?.access?.gymAccess?.warning || null,
      })),
    });
  });

  return router;
}
