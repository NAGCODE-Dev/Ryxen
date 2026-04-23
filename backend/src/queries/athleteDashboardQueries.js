import { pool } from '../db.js';
import { getAccessContextForUser, getActiveSubscriptionForUser } from '../access.js';
import { selectEffectiveAthleteBenefits } from '../accessPolicy.js';

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

export async function validateAccessibleWorkout(workoutId, userId, sportType) {
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

export async function loadAthleteAccessSnapshot(userId, sportType) {
  const [contexts, personalSubscription] = await Promise.all([
    getAccessContextForUser(userId),
    getActiveSubscriptionForUser(userId),
  ]);
  const gymIds = contexts.map((ctx) => ctx.membership.gym_id);
  const athleteBenefits = selectEffectiveAthleteBenefits({ gymContexts: contexts, personalSubscription });
  const allowedContexts = contexts
    .filter((ctx) => ctx?.access?.gymAccess?.canAthletesUseApp)
    .map((ctx) => ctx.membership);
  const allowedGymIds = allowedContexts.map((membership) => membership.gym_id);
  const allowedMembershipIds = allowedContexts.map((membership) => membership.id);

  return {
    gymIds,
    contexts,
    personalSubscription,
    athleteBenefits,
    allowedGymIds,
    allowedMembershipIds,
    sportType,
  };
}

export async function loadAthleteSummaryBlock(userId, access) {
  const [resultCountRes, workoutCountRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM benchmark_results WHERE user_id = $1 AND sport_type = $2`, [userId, access.sportType]),
    access.allowedMembershipIds.length
      ? pool.query(
          `SELECT COUNT(DISTINCT w.id)::int AS total
           FROM workouts w
           JOIN gym_memberships gm
             ON gm.id = ANY($1::int[])
            AND gm.gym_id = w.gym_id
           LEFT JOIN workout_assignments wa ON wa.workout_id = w.id
           WHERE w.sport_type = $2
             AND (wa.gym_membership_id IS NULL OR wa.gym_membership_id = gm.id)`,
          [access.allowedMembershipIds, access.sportType],
        )
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

export async function loadAthleteResultsBlock(userId, access, { buildBenchmarkTrendSeries, buildPrTrendSeries }) {
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

export async function loadAthleteWorkoutsBlock(access) {
  if (!access.allowedMembershipIds.length) {
    return { recentWorkouts: [] };
  }

  const workoutsRes = await pool.query(
    `SELECT DISTINCT
      w.id,
      w.title,
      w.scheduled_date,
      w.published_at,
      g.name AS gym_name
     FROM workouts w
     JOIN gyms g ON g.id = w.gym_id
     JOIN gym_memberships gm
       ON gm.id = ANY($1::int[])
      AND gm.gym_id = w.gym_id
     LEFT JOIN workout_assignments wa ON wa.workout_id = w.id
     WHERE w.sport_type = $2
       AND (wa.gym_membership_id IS NULL OR wa.gym_membership_id = gm.id)
     ORDER BY w.scheduled_date DESC, w.created_at DESC
     LIMIT 8`,
    [access.allowedMembershipIds, access.sportType],
  );

  const isWithinHistoryWindow = buildHistoryWindowFilter(access.athleteBenefits);
  return {
    recentWorkouts: workoutsRes.rows.filter((row) => isWithinHistoryWindow(row.scheduled_date || row.published_at)),
  };
}
