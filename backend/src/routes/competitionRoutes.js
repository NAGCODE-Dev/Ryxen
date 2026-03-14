import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { getMembershipForUser, getUserMemberships } from '../access.js';

export function createCompetitionRouter({ requireGymManager, ensureCompetitionAccess, getBenchmarkBySlug, resolveLeaderboardOrder, parseBenchmarkScore }) {
  const router = express.Router();

  router.get('/competitions/calendar', authRequired, async (req, res) => {
    const gymId = Number(req.query.gymId || 0);
    const memberships = await getUserMemberships(req.user.userId);
    const gymIds = gymId && Number.isFinite(gymId)
      ? [gymId]
      : memberships.map((membership) => membership.gym_id);

    if (!gymIds.length) {
      return res.json({ competitions: [] });
    }

    const rows = await pool.query(
      `SELECT
        c.*,
        g.name AS gym_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ce.id,
              'title', ce.title,
              'eventDate', ce.event_date,
              'benchmarkSlug', ce.benchmark_slug,
              'scoreType', ce.score_type,
              'notes', ce.notes
            )
            ORDER BY ce.event_date ASC
          ) FILTER (WHERE ce.id IS NOT NULL),
          '[]'::json
        ) AS events
       FROM competitions c
       LEFT JOIN gyms g ON g.id = c.gym_id
       LEFT JOIN competition_events ce ON ce.competition_id = c.id
       WHERE c.gym_id = ANY($1::int[]) OR c.visibility = 'public'
       GROUP BY c.id, g.name
       ORDER BY c.starts_at ASC`,
      [gymIds],
    );

    return res.json({ competitions: rows.rows });
  });

  router.post('/gyms/:gymId/competitions', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const location = String(req.body?.location || '').trim();
    const startsAt = String(req.body?.startsAt || '').trim();
    const endsAt = String(req.body?.endsAt || '').trim();
    const visibility = String(req.body?.visibility || 'gym').trim().toLowerCase();

    if (!Number.isFinite(gymId) || !title || !startsAt) {
      return res.status(400).json({ error: 'gymId, title e startsAt são obrigatórios' });
    }

    if (!['gym', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility inválida' });
    }

    const manager = await requireGymManager(gymId, req.user.userId);
    if (!manager.success) {
      return res.status(manager.code).json({ error: manager.error });
    }

    if (!manager.access.gymAccess.canCoachManage) {
      return res.status(402).json({ error: 'Assinatura do coach inativa. Renove para criar competições.' });
    }

    const inserted = await pool.query(
      `INSERT INTO competitions (gym_id, created_by_user_id, title, description, location, starts_at, ends_at, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [gymId, req.user.userId, title, description || null, location || null, startsAt, endsAt || null, visibility],
    );

    return res.json({ competition: inserted.rows[0] });
  });

  router.post('/competitions/:competitionId/events', authRequired, async (req, res) => {
    const competitionId = Number(req.params.competitionId);
    const title = String(req.body?.title || '').trim();
    const benchmarkSlug = String(req.body?.benchmarkSlug || '').trim().toLowerCase();
    const eventDate = String(req.body?.eventDate || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!Number.isFinite(competitionId) || !title || !eventDate) {
      return res.status(400).json({ error: 'competitionId, title e eventDate são obrigatórios' });
    }

    const competitionResult = await pool.query(`SELECT * FROM competitions WHERE id = $1 LIMIT 1`, [competitionId]);
    const competition = competitionResult.rows[0];
    if (!competition) {
      return res.status(404).json({ error: 'Competição não encontrada' });
    }

    const manager = await requireGymManager(competition.gym_id, req.user.userId);
    if (!manager.success) {
      return res.status(manager.code).json({ error: manager.error });
    }

    let benchmark = null;
    if (benchmarkSlug) {
      benchmark = await getBenchmarkBySlug(benchmarkSlug);
      if (!benchmark) {
        return res.status(404).json({ error: 'Benchmark não encontrado' });
      }
    }

    const inserted = await pool.query(
      `INSERT INTO competition_events (competition_id, benchmark_slug, title, event_date, score_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [competitionId, benchmark?.slug || null, title, eventDate, benchmark?.score_type || null, notes || null],
    );

    return res.json({ event: inserted.rows[0] });
  });

  router.post('/benchmarks/:slug/results', authRequired, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const scoreDisplay = String(req.body?.scoreDisplay || '').trim();
    const gymId = Number(req.body?.gymId || 0);
    const competitionEventId = req.body?.competitionEventId ? Number(req.body.competitionEventId) : null;
    const notes = String(req.body?.notes || '').trim();

    if (!slug || !scoreDisplay) {
      return res.status(400).json({ error: 'slug e scoreDisplay são obrigatórios' });
    }

    const benchmark = await getBenchmarkBySlug(slug);
    if (!benchmark) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }

    if (gymId) {
      const membership = await getMembershipForUser(gymId, req.user.userId);
      if (!membership) {
        return res.status(403).json({ error: 'Usuário não pertence a este gym' });
      }
    }

    const parsedScore = parseBenchmarkScore(scoreDisplay, benchmark.score_type);
    const inserted = await pool.query(
      `INSERT INTO benchmark_results (benchmark_slug, user_id, gym_id, competition_event_id, score_display, score_value, tiebreak_seconds, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [slug, req.user.userId, gymId || null, competitionEventId, scoreDisplay, parsedScore.scoreValue, parsedScore.tiebreakSeconds, notes || null],
    );

    return res.json({ result: inserted.rows[0] });
  });

  router.get('/leaderboards/benchmarks/:slug', authRequired, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const gymId = Number(req.query.gymId || 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

    const benchmark = await getBenchmarkBySlug(slug);
    if (!benchmark) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }

    const where = ['br.benchmark_slug = $1'];
    const params = [slug];

    if (gymId) {
      params.push(gymId);
      where.push(`br.gym_id = $${params.length}`);
    }

    params.push(limit);
    const orderBy = resolveLeaderboardOrder(benchmark.score_type);
    const rows = await pool.query(
      `SELECT
        br.id,
        br.score_display,
        br.score_value,
        br.tiebreak_seconds,
        br.created_at,
        br.gym_id,
        u.name,
        u.email
       FROM benchmark_results br
       JOIN users u ON u.id = br.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${params.length}`,
      params,
    );

    return res.json({ benchmark, results: rows.rows });
  });

  router.get('/leaderboards/events/:eventId', authRequired, async (req, res) => {
    const eventId = Number(req.params.eventId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ error: 'eventId inválido' });
    }

    const eventResult = await pool.query(
      `SELECT
        ce.*,
        c.id AS competition_id,
        c.title AS competition_title,
        c.visibility,
        c.gym_id
       FROM competition_events ce
       JOIN competitions c ON c.id = ce.competition_id
       WHERE ce.id = $1
       LIMIT 1`,
      [eventId],
    );
    const eventRow = eventResult.rows[0];
    if (!eventRow) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const access = await ensureCompetitionAccess(eventRow, req.user.userId);
    if (!access.success) {
      return res.status(access.code).json({ error: access.error });
    }

    const benchmark = eventRow.benchmark_slug ? await getBenchmarkBySlug(eventRow.benchmark_slug) : null;
    const orderBy = resolveLeaderboardOrder(eventRow.score_type || benchmark?.score_type || 'reps');
    const rows = await pool.query(
      `SELECT
        br.id,
        br.score_display,
        br.score_value,
        br.tiebreak_seconds,
        br.created_at,
        u.id AS user_id,
        u.name,
        u.email
       FROM benchmark_results br
       JOIN users u ON u.id = br.user_id
       WHERE br.competition_event_id = $1
       ORDER BY ${orderBy}
       LIMIT $2`,
      [eventId, limit],
    );

    return res.json({
      competition: {
        id: eventRow.competition_id,
        title: eventRow.competition_title,
        visibility: eventRow.visibility,
        gymId: eventRow.gym_id,
      },
      event: {
        id: eventRow.id,
        title: eventRow.title,
        eventDate: eventRow.event_date,
        scoreType: eventRow.score_type || benchmark?.score_type || null,
        benchmarkSlug: eventRow.benchmark_slug,
      },
      benchmark,
      results: rows.rows.map((row, index) => ({ ...row, rank: index + 1 })),
    });
  });

  router.get('/leaderboards/competitions/:competitionId', authRequired, async (req, res) => {
    const competitionId = Number(req.params.competitionId);
    if (!Number.isFinite(competitionId)) {
      return res.status(400).json({ error: 'competitionId inválido' });
    }

    const competitionResult = await pool.query(`SELECT * FROM competitions WHERE id = $1 LIMIT 1`, [competitionId]);
    const competition = competitionResult.rows[0];
    if (!competition) {
      return res.status(404).json({ error: 'Competição não encontrada' });
    }

    const access = await ensureCompetitionAccess(competition, req.user.userId);
    if (!access.success) {
      return res.status(access.code).json({ error: access.error });
    }

    const eventsResult = await pool.query(
      `SELECT id, title, benchmark_slug, score_type, event_date
       FROM competition_events
       WHERE competition_id = $1
       ORDER BY event_date ASC, id ASC`,
      [competitionId],
    );
    const events = eventsResult.rows;

    const eventResults = [];
    const totals = new Map();

    for (const event of events) {
      const benchmark = event.benchmark_slug ? await getBenchmarkBySlug(event.benchmark_slug) : null;
      const orderBy = resolveLeaderboardOrder(event.score_type || benchmark?.score_type || 'reps');
      const rows = await pool.query(
        `SELECT
          br.id,
          br.score_display,
          br.score_value,
          br.tiebreak_seconds,
          br.created_at,
          u.id AS user_id,
          u.name,
          u.email
         FROM benchmark_results br
         JOIN users u ON u.id = br.user_id
         WHERE br.competition_event_id = $1
         ORDER BY ${orderBy}`,
        [event.id],
      );

      const participants = rows.rows.length;
      const ranked = rows.rows.map((row, index) => {
        const rank = index + 1;
        const points = Math.max(1, participants - index);
        const key = String(row.user_id);
        if (!totals.has(key)) {
          totals.set(key, {
            userId: row.user_id,
            name: row.name,
            email: row.email,
            totalPoints: 0,
            eventsCompleted: 0,
            placements: [],
          });
        }
        const athlete = totals.get(key);
        athlete.totalPoints += points;
        athlete.eventsCompleted += 1;
        athlete.placements.push({
          eventId: event.id,
          eventTitle: event.title,
          rank,
          points,
          scoreDisplay: row.score_display,
        });
        return { ...row, rank, points };
      });

      eventResults.push({ event, benchmark, results: ranked });
    }

    const leaderboard = Array.from(totals.values())
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.eventsCompleted !== a.eventsCompleted) return b.eventsCompleted - a.eventsCompleted;
        return a.name.localeCompare(b.name);
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return res.json({
      competition,
      summary: {
        events: events.length,
        athletesRanked: leaderboard.length,
      },
      leaderboard,
      events: eventResults,
    });
  });

  return router;
}
