import { pool } from '../db.js';

function normalizeSportType(value) {
  const raw = String(value || 'cross').trim().toLowerCase();
  return ['cross', 'running', 'strength'].includes(raw) ? raw : 'cross';
}

function isMissingRelationError(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

function resolveSportType(body = {}) {
  return normalizeSportType(
    body?.sportType
      || body?.workoutContext?.sportType
      || body?.workout?.sportType
      || body?.history?.sportType
      || 'cross',
  );
}

function buildWorkoutRef(body = {}) {
  const ref = body?.workoutRef && typeof body.workoutRef === 'object' ? body.workoutRef : {};
  const workout = body?.workout && typeof body.workout === 'object' ? body.workout : {};
  return {
    workoutId: ref.workoutId || null,
    title: ref.title || workout.title || null,
    dayLabel: ref.dayLabel || workout.day || null,
    weekNumber: ref.weekNumber || body?.workoutContext?.activeWeekNumber || null,
    source: ref.source || workout.source || null,
  };
}

async function safeQuery(query, params = []) {
  try {
    return await pool.query(query, params);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return { rows: [] };
    }
    throw error;
  }
}

export async function buildCrossAiContext({ preset, body, user }) {
  if (preset?.key !== 'analyze_result' || !user?.userId) {
    return null;
  }

  const userId = Number(user.userId);
  const sportType = resolveSportType(body);
  const workoutRef = buildWorkoutRef(body);

  try {
    const [athleteContextRes, recentResultsRes, recentPrsRes, recentInsightsRes] = await Promise.all([
      safeQuery(
        `SELECT equipment, limitations, preferences, athlete_notes, coach_notes, updated_at
         FROM athlete_context
         WHERE user_id = $1
           AND sport_type = $2
         LIMIT 1`,
        [userId, sportType],
      ),
      safeQuery(
        `SELECT benchmark_slug, score_display, score_value, created_at
         FROM benchmark_results
         WHERE user_id = $1
           AND sport_type = $2
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId, sportType],
      ),
      sportType === 'cross'
        ? safeQuery(
            `SELECT exercise, value, unit, source, created_at
             FROM athlete_pr_records
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 5`,
            [userId],
          )
        : Promise.resolve({ rows: [] }),
      safeQuery(
        `SELECT mode, response_data, response_meta, workout_ref, created_at
         FROM crossai_insights
         WHERE user_id = $1
           AND sport_type = $2
           AND mode = 'analyze-result'
         ORDER BY created_at DESC
         LIMIT 3`,
        [userId, sportType],
      ),
    ]);

    return {
      sportType,
      workoutRef,
      athleteContext: athleteContextRes.rows[0]
        ? {
            equipment: athleteContextRes.rows[0].equipment || [],
            limitations: athleteContextRes.rows[0].limitations || [],
            preferences: athleteContextRes.rows[0].preferences || {},
            athleteNotes: athleteContextRes.rows[0].athlete_notes || '',
            coachNotes: athleteContextRes.rows[0].coach_notes || '',
            updatedAt: athleteContextRes.rows[0].updated_at || null,
          }
        : null,
      recentResults: recentResultsRes.rows,
      recentPrs: recentPrsRes.rows,
      recentInsights: recentInsightsRes.rows.map((row) => ({
        mode: row.mode,
        data: row.response_data || {},
        meta: row.response_meta || {},
        workoutRef: row.workout_ref || {},
        createdAt: row.created_at || null,
      })),
    };
  } catch (error) {
    console.warn('[crossai] contexto não carregado:', error?.message || error);
    return {
      sportType,
      workoutRef,
      athleteContext: null,
      recentResults: [],
      recentPrs: [],
      recentInsights: [],
    };
  }
}

export async function saveCrossAiInsight({ preset, body, user, output }) {
  if (!user?.userId || !preset?.key || !output?.mode) {
    return null;
  }

  const userId = Number(user.userId);
  const sportType = resolveSportType(body);
  const workoutRef = buildWorkoutRef(body);

  try {
    const inserted = await safeQuery(
      `INSERT INTO crossai_insights (
         user_id,
         sport_type,
         preset_key,
         mode,
         version,
         workout_ref,
         request_payload,
         response_data,
         response_meta
       )
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb)
       RETURNING id, created_at`,
      [
        userId,
        sportType,
        preset.key,
        String(output.mode || ''),
        String(output.version || 'v1'),
        JSON.stringify(workoutRef || {}),
        JSON.stringify(body || {}),
        JSON.stringify(output.data || {}),
        JSON.stringify(output.meta || {}),
      ],
    );

    return inserted.rows[0] || null;
  } catch (error) {
    console.warn('[crossai] insight não persistido:', error?.message || error);
    return null;
  }
}
