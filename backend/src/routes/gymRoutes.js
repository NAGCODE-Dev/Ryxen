import express from 'express';

import { pool } from '../db.js';
import { authRequired } from '../auth.js';
import { getAccessContextForGym, getAccessContextForUser, getActiveSubscriptionForUser, getMembershipForUser, getUserMemberships } from '../access.js';
import { selectEffectiveAthleteBenefits } from '../accessPolicy.js';

export function createGymRouter({ requireGymManager, slugify, enrichWorkoutWithBenchmark }) {
  const router = express.Router();

  function normalizeSportType(value) {
    const raw = String(value || 'cross').trim().toLowerCase();
    return ['cross', 'running', 'strength'].includes(raw) ? raw : 'cross';
  }

  async function resolveWorkoutAudience(gymId, audienceMode, targetMembershipIds, targetGroupIds) {
    if (audienceMode === 'all') {
      const members = await pool.query(
        `SELECT id
         FROM gym_memberships
         WHERE gym_id = $1 AND status = 'active' AND role = 'athlete'`,
        [gymId],
      );
      return { rows: members.rows };
    }

    if (audienceMode === 'selected') {
      if (!targetMembershipIds.length) {
        return { error: 'Selecione pelo menos um atleta' };
      }
      const members = await pool.query(
        `SELECT id
         FROM gym_memberships
         WHERE gym_id = $1
           AND status = 'active'
           AND role = 'athlete'
           AND id = ANY($2::int[])`,
        [gymId, targetMembershipIds],
      );
      return { rows: members.rows };
    }

    if (audienceMode === 'groups') {
      if (!targetGroupIds.length) {
        return { error: 'Selecione pelo menos um grupo' };
      }
      const members = await pool.query(
        `SELECT DISTINCT gm.id
         FROM athlete_group_memberships agm
         JOIN athlete_groups ag ON ag.id = agm.group_id
         JOIN gym_memberships gm ON gm.id = agm.gym_membership_id
         WHERE ag.gym_id = $1
           AND ag.id = ANY($2::int[])
           AND gm.status = 'active'
           AND gm.role = 'athlete'`,
        [gymId, targetGroupIds],
      );
      return { rows: members.rows };
    }

    return { error: 'audienceMode inválido' };
  }

  router.get('/access/context', authRequired, async (req, res) => {
    const [gyms, personalSubscription] = await Promise.all([
      getAccessContextForUser(req.user.userId),
      getActiveSubscriptionForUser(req.user.userId),
    ]);
    return res.json({
      athleteBenefits: selectEffectiveAthleteBenefits({ gymContexts: gyms, personalSubscription }),
      personalSubscription,
      gyms: gyms.map((ctx) => ({
        membership: ctx.membership,
        gymAccess: ctx.access?.gymAccess || null,
        ownerSubscription: ctx.access?.ownerSubscription || null,
        athleteBenefits: ctx.access?.athleteBenefits || null,
      })),
    });
  });

  router.post('/gyms', authRequired, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const slug = slugify(req.body?.slug || name);
    if (!name || !slug) {
      return res.status(400).json({ error: 'name e slug são obrigatórios' });
    }

    const inserted = await pool.query(
      `INSERT INTO gyms (name, slug, owner_user_id) VALUES ($1,$2,$3) RETURNING *`,
      [name, slug, req.user.userId],
    );
    const gym = inserted.rows[0];

    await pool.query(
      `INSERT INTO gym_memberships (gym_id, user_id, role, status) VALUES ($1,$2,'owner','active')`,
      [gym.id, req.user.userId],
    );

    return res.json({ gym });
  });

  router.get('/gyms/me', authRequired, async (req, res) => {
    const memberships = await getAccessContextForUser(req.user.userId);
    return res.json({
      gyms: memberships.map((ctx) => ({
        id: ctx.membership.gym_id,
        name: ctx.membership.gym_name,
        slug: ctx.membership.gym_slug,
        role: ctx.membership.role,
        status: ctx.membership.status,
        access: ctx.access?.gymAccess || null,
      })),
    });
  });

  router.post('/gyms/:gymId/memberships', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const role = String(req.body?.role || 'athlete');
    const email = String(req.body?.email || '').toLowerCase().trim();

    if (!Number.isFinite(gymId) || !email) {
      return res.status(400).json({ error: 'gymId e email são obrigatórios' });
    }

    if (!['coach', 'athlete'].includes(role)) {
      return res.status(400).json({ error: 'role inválido' });
    }

    const membership = await requireGymManager(gymId, req.user.userId);
    if (!membership.success) {
      return res.status(membership.code).json({ error: membership.error });
    }

    const foundUser = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email]);
    const found = foundUser.rows[0] || null;

    try {
      const inserted = await pool.query(
        `INSERT INTO gym_memberships (gym_id, user_id, pending_email, role, status)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [gymId, found?.id || null, found ? null : email, role, found ? 'active' : 'invited'],
      );
      return res.json({ membership: inserted.rows[0] });
    } catch (error) {
      if (String(error?.message || '').includes('idx_gym_membership_user_unique')) {
        return res.status(409).json({ error: 'Usuário já pertence a este gym' });
      }
      return res.status(500).json({ error: 'Erro ao adicionar membro' });
    }
  });

  router.get('/gyms/:gymId/memberships', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const ownMembership = await getMembershipForUser(gymId, req.user.userId);
    if (!ownMembership) {
      return res.status(404).json({ error: 'Gym não encontrado para este usuário' });
    }

    const rows = await pool.query(
      `SELECT gm.*, u.email, u.name
       FROM gym_memberships gm
       LEFT JOIN users u ON u.id = gm.user_id
       WHERE gm.gym_id = $1
       ORDER BY gm.created_at ASC`,
      [gymId],
    );

    return res.json({ memberships: rows.rows });
  });

  router.get('/gyms/:gymId/groups', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const sportType = normalizeSportType(req.query?.sportType);
    const manager = await requireGymManager(gymId, req.user.userId);
    if (!manager.success) {
      return res.status(manager.code).json({ error: manager.error });
    }

    const groups = await pool.query(
      `SELECT
         ag.id,
         ag.gym_id,
         ag.name,
         ag.sport_type,
         ag.description,
         ag.created_at,
         COUNT(agm.id)::int AS member_count
       FROM athlete_groups ag
       LEFT JOIN athlete_group_memberships agm ON agm.group_id = ag.id
       WHERE ag.gym_id = $1
         AND ag.sport_type = $2
       GROUP BY ag.id
       ORDER BY ag.created_at DESC`,
      [gymId, sportType],
    );

    const members = await pool.query(
      `SELECT
         agm.group_id,
         gm.id AS membership_id,
         COALESCE(u.name, u.email, gm.pending_email, 'Convidado') AS label,
         COALESCE(u.email, gm.pending_email, '') AS email,
         gm.role,
         gm.status
       FROM athlete_group_memberships agm
       JOIN athlete_groups ag ON ag.id = agm.group_id
       JOIN gym_memberships gm ON gm.id = agm.gym_membership_id
       LEFT JOIN users u ON u.id = gm.user_id
       WHERE ag.gym_id = $1
         AND ag.sport_type = $2
       ORDER BY agm.created_at ASC`,
      [gymId, sportType],
    );

    const memberMap = new Map();
    for (const row of members.rows) {
      if (!memberMap.has(row.group_id)) memberMap.set(row.group_id, []);
      memberMap.get(row.group_id).push({
        membershipId: row.membership_id,
        label: row.label,
        email: row.email,
        role: row.role,
        status: row.status,
      });
    }

    return res.json({
      groups: groups.rows.map((group) => ({
        ...group,
        members: memberMap.get(group.id) || [],
      })),
    });
  });

  router.post('/gyms/:gymId/groups', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const sportType = normalizeSportType(req.body?.sportType);
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map((id) => Number(id)).filter(Number.isFinite)
      : [];

    if (!Number.isFinite(gymId) || !name) {
      return res.status(400).json({ error: 'gymId e name são obrigatórios' });
    }

    const manager = await requireGymManager(gymId, req.user.userId);
    if (!manager.success) {
      return res.status(manager.code).json({ error: manager.error });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO athlete_groups (gym_id, name, description, sport_type, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [gymId, name, description || null, sportType, req.user.userId],
      );
      const group = inserted.rows[0];

      if (memberIds.length) {
        const validMembers = await client.query(
          `SELECT id
           FROM gym_memberships
           WHERE gym_id = $1
             AND status = 'active'
             AND role = 'athlete'
             AND id = ANY($2::int[])`,
          [gymId, memberIds],
        );
        const validIds = validMembers.rows.map((row) => row.id);
        if (validIds.length) {
          await client.query(
            `INSERT INTO athlete_group_memberships (group_id, gym_membership_id)
             SELECT $1, UNNEST($2::int[])
             ON CONFLICT DO NOTHING`,
            [group.id, validIds],
          );
        }
      }

      await client.query('COMMIT');
      return res.json({ group });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Erro ao criar grupo' });
    } finally {
      client.release();
    }
  });

  router.post('/gyms/:gymId/workouts', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const sportType = normalizeSportType(req.body?.sportType);
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const scheduledDate = String(req.body?.scheduledDate || '').trim();
    const payload = req.body?.payload;
    const audienceMode = String(req.body?.audienceMode || 'all').trim().toLowerCase();
    const targetMembershipIds = Array.isArray(req.body?.targetMembershipIds)
      ? req.body.targetMembershipIds.map((id) => Number(id)).filter(Number.isFinite)
      : [];
    const targetGroupIds = Array.isArray(req.body?.targetGroupIds)
      ? req.body.targetGroupIds.map((id) => Number(id)).filter(Number.isFinite)
      : [];

    if (!Number.isFinite(gymId) || !title || !scheduledDate || !payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'gymId, title, scheduledDate e payload são obrigatórios' });
    }

    if (!['all', 'selected', 'groups'].includes(audienceMode)) {
      return res.status(400).json({ error: 'audienceMode inválido' });
    }

    const manager = await requireGymManager(gymId, req.user.userId);
    if (!manager.success) {
      return res.status(manager.code).json({ error: manager.error });
    }

    if (!manager.access.gymAccess.canCoachManage) {
      return res.status(402).json({ error: 'Assinatura do coach inativa. Renove para publicar treinos.' });
    }

    const audience = await resolveWorkoutAudience(gymId, audienceMode, targetMembershipIds, targetGroupIds);
    if (audience.error) {
      return res.status(400).json({ error: audience.error });
    }

    const targetRows = audience.rows || [];
    if ((audienceMode === 'selected' || audienceMode === 'groups') && !targetRows.length) {
      return res.status(400).json({ error: 'Nenhum atleta ativo encontrado para esta audiência' });
    }

    const inserted = await pool.query(
      `INSERT INTO workouts (gym_id, created_by_user_id, title, description, scheduled_date, payload, sport_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [gymId, req.user.userId, title, description || null, scheduledDate, payload, sportType],
    );
    const workout = inserted.rows[0];

    if (targetRows.length) {
      const ids = targetRows.map((member) => member.id);
      await pool.query(
        `INSERT INTO workout_assignments (workout_id, gym_membership_id)
         SELECT $1, UNNEST($2::int[])
         ON CONFLICT DO NOTHING`,
        [workout.id, ids],
      );
    }

    return res.json({
      workout,
      assigned: targetRows.length,
      audience: {
        sportType,
        mode: audienceMode,
        membershipIds: audienceMode === 'selected' ? targetMembershipIds : [],
        groupIds: audienceMode === 'groups' ? targetGroupIds : [],
      },
    });
  });

  router.get('/workouts/feed', authRequired, async (req, res) => {
    const sportType = normalizeSportType(req.query?.sportType);
    const memberships = await getUserMemberships(req.user.userId);
    if (!memberships.length) {
      return res.json({ workouts: [] });
    }

    const gymIds = memberships.map((m) => m.gym_id);
    const membershipIds = memberships.map((m) => m.id);
    const rows = await pool.query(
      `SELECT DISTINCT w.*, g.name AS gym_name
       FROM workouts w
       JOIN gyms g ON g.id = w.gym_id
       LEFT JOIN workout_assignments wa ON wa.workout_id = w.id
       WHERE w.gym_id = ANY($1::int[])
         AND w.sport_type = $3
         AND w.scheduled_date >= CURRENT_DATE - INTERVAL '1 day'
         AND (wa.gym_membership_id IS NULL OR wa.gym_membership_id = ANY($2::int[]))
       ORDER BY w.scheduled_date DESC, w.created_at DESC
       LIMIT 100`,
      [gymIds, membershipIds, sportType],
    );

    const accessContexts = await Promise.all(rows.rows.map((workout) => getAccessContextForGym(workout.gym_id)));
    const visible = rows.rows.filter((workout, index) => accessContexts[index]?.gymAccess?.canAthletesUseApp);
    const enriched = await Promise.all(visible.map(enrichWorkoutWithBenchmark));

    return res.json({ workouts: enriched });
  });

  router.get('/gyms/:gymId/insights', authRequired, async (req, res) => {
    const gymId = Number(req.params.gymId);
    const sportType = normalizeSportType(req.query?.sportType);
    if (!Number.isFinite(gymId)) {
      return res.status(400).json({ error: 'gymId inválido' });
    }

    const manager = await requireGymManager(gymId, req.user.userId);
    if (!manager.success) {
      return res.status(manager.code).json({ error: manager.error });
    }

    const [membersRes, workoutsRes, resultsRes, topBenchmarksRes, groupsRes] = await Promise.all([
      pool.query(
        `SELECT role, COUNT(*)::int AS total
         FROM gym_memberships
         WHERE gym_id = $1 AND status IN ('active', 'invited')
         GROUP BY role`,
        [gymId],
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE scheduled_date >= CURRENT_DATE AND scheduled_date <= CURRENT_DATE + INTERVAL '7 days')::int AS next_7_days
         FROM workouts
         WHERE gym_id = $1
           AND sport_type = $2`,
        [gymId, sportType],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM benchmark_results WHERE gym_id = $1`, [gymId]),
      pool.query(
        `SELECT
          br.benchmark_slug AS slug,
          b.name,
          COUNT(*)::int AS total
         FROM benchmark_results br
         JOIN benchmark_library b ON b.slug = br.benchmark_slug
         WHERE br.gym_id = $1
         GROUP BY br.benchmark_slug, b.name
         ORDER BY total DESC, b.name ASC
         LIMIT 5`,
        [gymId],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM athlete_groups WHERE gym_id = $1 AND sport_type = $2`, [gymId, sportType]),
    ]);

    const roleTotals = membersRes.rows.reduce((acc, row) => {
      acc[row.role] = Number(row.total || 0);
      return acc;
    }, {});

    const recentResults = await pool.query(
      `SELECT
        br.id,
        br.benchmark_slug,
        br.score_display,
        br.created_at,
        br.notes,
        b.name AS benchmark_name,
        u.name AS athlete_name,
        u.email AS athlete_email
       FROM benchmark_results br
       JOIN benchmark_library b ON b.slug = br.benchmark_slug
       JOIN users u ON u.id = br.user_id
       WHERE br.gym_id = $1
       ORDER BY br.created_at DESC
       LIMIT 8`,
      [gymId],
    );

    return res.json({
      gymId,
      access: manager.access?.gymAccess || null,
      stats: {
        athletes: roleTotals.athlete || 0,
        coaches: (roleTotals.owner || 0) + (roleTotals.coach || 0),
        workouts: Number(workoutsRes.rows[0]?.total || 0),
        workoutsNext7Days: Number(workoutsRes.rows[0]?.next_7_days || 0),
        results: Number(resultsRes.rows[0]?.total || 0),
        groups: Number(groupsRes.rows[0]?.total || 0),
        sportType,
      },
      recentResults: recentResults.rows,
      topBenchmarks: topBenchmarksRes.rows,
    });
  });

  return router;
}
