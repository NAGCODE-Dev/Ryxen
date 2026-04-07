import { pool } from '../db.js';
import { getAccessContextsForGymIds, getUserMemberships } from '../access.js';

export async function loadVisibleWorkoutFeed({ userId, sportType, enrichWorkoutWithBenchmark }) {
  const memberships = await getUserMemberships(userId);
  if (!memberships.length) {
    return [];
  }

  const gymIds = memberships.map((membership) => membership.gym_id);
  const membershipIds = memberships.map((membership) => membership.id);
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

  const accessByGymId = await getAccessContextsForGymIds(rows.rows.map((workout) => workout.gym_id));
  const visible = rows.rows.filter((workout) => accessByGymId.get(workout.gym_id)?.gymAccess?.canAthletesUseApp);
  return Promise.all(visible.map(enrichWorkoutWithBenchmark));
}

export async function loadGymInsights({ gymId, sportType, access }) {
  const [membersRes, workoutsRes, resultsRes, topBenchmarksRes, groupsRes, prSummaryRes, recentResults, recentPrs] = await Promise.all([
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
    sportType === 'cross'
      ? pool.query(
          `WITH gym_athletes AS (
             SELECT DISTINCT gm.user_id
             FROM gym_memberships gm
             WHERE gm.gym_id = $1
               AND gm.role = 'athlete'
               AND gm.status = 'active'
               AND gm.user_id IS NOT NULL
           ),
           latest_prs AS (
             SELECT DISTINCT ON (apr.user_id, apr.exercise)
               apr.user_id,
               apr.exercise,
               apr.source
             FROM athlete_pr_records apr
             JOIN gym_athletes ga ON ga.user_id = apr.user_id
             ORDER BY apr.user_id, apr.exercise, apr.created_at DESC
           )
           SELECT
             COUNT(*) FILTER (WHERE source <> 'snapshot_removed')::int AS total_active_prs,
             COUNT(DISTINCT user_id) FILTER (WHERE source <> 'snapshot_removed')::int AS athletes_with_prs,
             COUNT(*) FILTER (WHERE source = 'snapshot')::int AS snapshot_entries
           FROM latest_prs`,
          [gymId],
        )
      : Promise.resolve({ rows: [{ total_active_prs: 0, athletes_with_prs: 0, snapshot_entries: 0 }] }),
    pool.query(
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
    ),
    sportType === 'cross'
      ? pool.query(
          `WITH gym_athletes AS (
             SELECT DISTINCT gm.user_id
             FROM gym_memberships gm
             WHERE gm.gym_id = $1
               AND gm.role = 'athlete'
               AND gm.status = 'active'
               AND gm.user_id IS NOT NULL
           ),
           latest_prs AS (
             SELECT DISTINCT ON (apr.user_id, apr.exercise)
               apr.id,
               apr.user_id,
               apr.exercise,
               apr.value,
               apr.unit,
               apr.source,
               apr.created_at
             FROM athlete_pr_records apr
             JOIN gym_athletes ga ON ga.user_id = apr.user_id
             ORDER BY apr.user_id, apr.exercise, apr.created_at DESC
           )
           SELECT
             lp.id,
             lp.exercise,
             lp.value,
             lp.unit,
             lp.source,
             lp.created_at,
             u.name AS athlete_name,
             u.email AS athlete_email
           FROM latest_prs lp
           JOIN users u ON u.id = lp.user_id
           WHERE lp.source <> 'snapshot_removed'
           ORDER BY lp.created_at DESC
           LIMIT 8`,
          [gymId],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const roleTotals = membersRes.rows.reduce((acc, row) => {
    acc[row.role] = Number(row.total || 0);
    return acc;
  }, {});
  const prSummary = prSummaryRes.rows[0] || {};

  return {
    gymId,
    access: access?.gymAccess || null,
    stats: {
      athletes: roleTotals.athlete || 0,
      coaches: (roleTotals.owner || 0) + (roleTotals.coach || 0),
      workouts: Number(workoutsRes.rows[0]?.total || 0),
      workoutsNext7Days: Number(workoutsRes.rows[0]?.next_7_days || 0),
      results: Number(resultsRes.rows[0]?.total || 0),
      groups: Number(groupsRes.rows[0]?.total || 0),
      activePrs: Number(prSummary.total_active_prs || 0),
      athletesWithPrs: Number(prSummary.athletes_with_prs || 0),
      prSnapshotEntries: Number(prSummary.snapshot_entries || 0),
      sportType,
    },
    recentResults: recentResults.rows,
    recentPrs: recentPrs.rows,
    topBenchmarks: topBenchmarksRes.rows,
  };
}
