import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { getMembershipForUser, getUserMemberships } from '../access.js';

export function buildCompetitionCalendarScope(gymIds) {
  const normalizedGymIds = Array.isArray(gymIds)
    ? gymIds
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  return {
    includePublic: true,
    gymIdsParam: normalizedGymIds.length ? normalizedGymIds : null,
  };
}

export function createCompetitionRouter({ requireGymManager, ensureCompetitionAccess, getBenchmarkBySlug, resolveLeaderboardOrder, parseBenchmarkScore }) {
  const router = express.Router();

  function normalizeSportType(value) {
    const raw = String(value || 'cross').trim().toLowerCase();
    return ['cross', 'running', 'strength'].includes(raw) ? raw : 'cross';
  }

  function normalizeCompetitionSourceProvider(value) {
    const raw = String(value || 'manual').trim().toLowerCase();
    return ['manual', 'crossfit_open', 'competition_corner', 'official'].includes(raw) ? raw : 'manual';
  }

  function normalizeCompetitionSourceType(value) {
    const raw = String(value || 'internal').trim().toLowerCase();
    return ['internal', 'official_link', 'external_leaderboard', 'hybrid'].includes(raw) ? raw : 'internal';
  }

  function normalizeCompetitionStatus(value, fallback = 'scheduled') {
    const raw = String(value || fallback).trim().toLowerCase();
    return ['scheduled', 'live', 'completed', 'archived'].includes(raw) ? raw : fallback;
  }

  router.get('/competitions/calendar', authRequired, async (req, res) => {
    const gymId = Number(req.query.gymId || 0);
    const sportType = normalizeSportType(req.query?.sportType);
    const memberships = await getUserMemberships(req.user.userId);
    const gymIds = gymId && Number.isFinite(gymId)
      ? [gymId]
      : memberships.map((membership) => membership.gym_id);
    const scope = buildCompetitionCalendarScope(gymIds);

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
              'sportType', ce.sport_type,
              'benchmarkSlug', ce.benchmark_slug,
              'scoreType', ce.score_type,
              'notes', ce.notes,
              'externalRef', ce.external_ref,
              'registrationUrl', ce.registration_url,
              'leaderboardUrl', ce.leaderboard_url,
              'status', ce.status,
              'payload', ce.payload
            )
            ORDER BY ce.event_date ASC
          ) FILTER (WHERE ce.id IS NOT NULL),
          '[]'::json
        ) AS events
       FROM competitions c
       LEFT JOIN gyms g ON g.id = c.gym_id
       LEFT JOIN competition_events ce ON ce.competition_id = c.id
       WHERE (
         c.visibility = 'public'
         OR (
           COALESCE(array_length($1::int[], 1), 0) > 0
           AND c.gym_id = ANY($1::int[])
         )
       )
         AND c.sport_type = $2
       GROUP BY c.id, g.name
       ORDER BY c.starts_at ASC`,
      [scope.gymIdsParam, sportType],
    );

    return res.json({ competitions: rows.rows });
  });

  router.post('/gyms/:gymId/competitions', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const sportType = normalizeSportType(req.body?.sportType);
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const location = String(req.body?.location || '').trim();
    const startsAt = String(req.body?.startsAt || '').trim();
    const endsAt = String(req.body?.endsAt || '').trim();
    const visibility = String(req.body?.visibility || 'gym').trim().toLowerCase();
    const sourceProvider = normalizeCompetitionSourceProvider(req.body?.sourceProvider);
    const sourceType = normalizeCompetitionSourceType(req.body?.sourceType);
    const externalRef = String(req.body?.externalRef || '').trim();
    const officialSiteUrl = String(req.body?.officialSiteUrl || '').trim();
    const registrationUrl = String(req.body?.registrationUrl || '').trim();
    const leaderboardUrl = String(req.body?.leaderboardUrl || '').trim();
    const liveEmbedUrl = String(req.body?.liveEmbedUrl || '').trim();
    const coverImageUrl = String(req.body?.coverImageUrl || '').trim();
    const status = normalizeCompetitionStatus(req.body?.status);
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};

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
      `INSERT INTO competitions (
         gym_id, created_by_user_id, title, description, location, starts_at, ends_at, visibility, sport_type,
         source_provider, source_type, external_ref, official_site_url, registration_url, leaderboard_url, live_embed_url, cover_image_url, status, payload
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        gymId, req.user.userId, title, description || null, location || null, startsAt, endsAt || null, visibility, sportType,
        sourceProvider, sourceType, externalRef || null, officialSiteUrl || null, registrationUrl || null, leaderboardUrl || null, liveEmbedUrl || null, coverImageUrl || null, status, payload,
      ],
    );

    return res.json({ competition: inserted.rows[0] });
  });

  router.post('/competitions/:competitionId/events', authRequired, async (req, res) => {
    const competitionId = Number(req.params.competitionId);
    const title = String(req.body?.title || '').trim();
    const benchmarkSlug = String(req.body?.benchmarkSlug || '').trim().toLowerCase();
    const eventDate = String(req.body?.eventDate || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const externalRef = String(req.body?.externalRef || '').trim();
    const registrationUrl = String(req.body?.registrationUrl || '').trim();
    const leaderboardUrl = String(req.body?.leaderboardUrl || '').trim();
    const status = normalizeCompetitionStatus(req.body?.status);
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};

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
      `INSERT INTO competition_events (
         competition_id, benchmark_slug, title, event_date, score_type, notes, sport_type,
         external_ref, registration_url, leaderboard_url, status, payload
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        competitionId, benchmark?.slug || null, title, eventDate, benchmark?.score_type || null, notes || null, competition.sport_type || 'cross',
        externalRef || null, registrationUrl || null, leaderboardUrl || null, status, payload,
      ],
    );

    return res.json({ event: inserted.rows[0] });
  });

  router.post('/benchmarks/:slug/results', authRequired, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const scoreDisplay = String(req.body?.scoreDisplay || '').trim();
    const gymId = Number(req.body?.gymId || 0);
    const competitionEventId = req.body?.competitionEventId ? Number(req.body.competitionEventId) : null;
    const notes = String(req.body?.notes || '').trim();
    const sportType = normalizeSportType(req.body?.sportType);

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
      `INSERT INTO benchmark_results (benchmark_slug, user_id, gym_id, competition_event_id, score_display, score_value, tiebreak_seconds, notes, sport_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [slug, req.user.userId, gymId || null, competitionEventId, scoreDisplay, parsedScore.scoreValue, parsedScore.tiebreakSeconds, notes || null, sportType],
    );

    return res.json({ result: inserted.rows[0] });
  });

  router.get('/leaderboards/benchmarks/:slug', authRequired, async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const gymId = Number(req.query.gymId || 0);
    const sportType = normalizeSportType(req.query?.sportType);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

    const benchmark = await getBenchmarkBySlug(slug);
    if (!benchmark) {
      return res.status(404).json({ error: 'Benchmark não encontrado' });
    }

    const where = ['br.benchmark_slug = $1', 'br.sport_type = $2'];
    const params = [slug, sportType];

    if (gymId) {
      params.push(gymId);
      where.push(`br.gym_id = $${params.length}`);
    }

    const orderBy = resolveLeaderboardOrder(benchmark.score_type);
    const ranked = await pool.query(
      `WITH ranked AS (
         SELECT
           br.id,
           br.user_id,
           br.score_display,
           br.score_value,
           br.tiebreak_seconds,
           br.created_at,
           br.gym_id,
           br.sport_type,
           u.name,
           u.email,
           ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rank
         FROM benchmark_results br
         JOIN users u ON u.id = br.user_id
         WHERE ${where.join(' AND ')}
       )
       SELECT *
       FROM ranked
       ORDER BY rank ASC
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    const currentUserResult = await pool.query(
      `WITH ranked AS (
         SELECT
           br.id,
           br.user_id,
           br.score_display,
           br.score_value,
           br.tiebreak_seconds,
           br.created_at,
           br.gym_id,
           br.sport_type,
           u.name,
           u.email,
           ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rank
         FROM benchmark_results br
         JOIN users u ON u.id = br.user_id
         WHERE ${where.join(' AND ')}
       )
       SELECT *
       FROM ranked
       WHERE user_id = $${params.length + 1}
       ORDER BY rank ASC
       LIMIT 1`,
      [...params, req.user.userId],
    );

    return res.json({ benchmark, results: ranked.rows, currentUser: currentUserResult.rows[0] || null });
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
        c.gym_id,
        c.sport_type AS competition_sport_type
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
        br.sport_type,
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
        sportType: eventRow.competition_sport_type || 'cross',
      },
      event: {
        id: eventRow.id,
        title: eventRow.title,
        eventDate: eventRow.event_date,
        scoreType: eventRow.score_type || benchmark?.score_type || null,
        benchmarkSlug: eventRow.benchmark_slug,
        sportType: eventRow.sport_type || eventRow.competition_sport_type || 'cross',
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
          br.sport_type,
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
