import { pool } from '../db.js';
import { validateAccessibleWorkout } from '../queries/athleteDashboardQueries.js';

export async function createRunningLog({ userId, input }) {
  const workoutId = input?.workoutId !== undefined && input?.workoutId !== '' ? Number(input.workoutId) : null;
  const completionState = String(input?.completionState || '').trim().toLowerCase();
  const sourceLabel = String(input?.sourceLabel || '').trim();
  const title = String(input?.title || '').trim();
  const sessionType = String(input?.sessionType || '').trim().toLowerCase();
  const distanceKm = input?.distanceKm !== undefined && input?.distanceKm !== '' ? Number(input.distanceKm) : null;
  const durationMin = input?.durationMin !== undefined && input?.durationMin !== '' ? Number(input.durationMin) : null;
  const avgPace = String(input?.avgPace || '').trim();
  const targetPace = String(input?.targetPace || '').trim();
  const zone = String(input?.zone || '').trim();
  const notes = String(input?.notes || '').trim();
  const payload = input?.payload && typeof input.payload === 'object' ? input.payload : {};
  const loggedAt = String(input?.loggedAt || '').trim();

  if (!title && !sessionType && !Number.isFinite(distanceKm) && !Number.isFinite(durationMin)) {
    return { error: 'Informe ao menos título, tipo, distância ou duração', code: 400 };
  }

  const workout = await validateAccessibleWorkout(workoutId, userId, 'running');
  if (workoutId && !workout) {
    return { error: 'workoutId inválido para esta conta', code: 400 };
  }

  const inserted = await pool.query(
    `INSERT INTO running_session_logs (user_id, workout_id, title, session_type, distance_km, duration_min, avg_pace, target_pace, zone, notes, payload, logged_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      userId,
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

  return { log: refreshed.rows[0] };
}

export async function createStrengthLog({ userId, input }) {
  const workoutId = input?.workoutId !== undefined && input?.workoutId !== '' ? Number(input.workoutId) : null;
  const completionState = String(input?.completionState || '').trim().toLowerCase();
  const sourceLabel = String(input?.sourceLabel || '').trim();
  const exercise = String(input?.exercise || '').trim();
  const setsCount = input?.setsCount !== undefined && input?.setsCount !== '' ? Number(input.setsCount) : null;
  const repsText = String(input?.repsText || '').trim();
  const loadValue = input?.loadValue !== undefined && input?.loadValue !== '' ? Number(input.loadValue) : null;
  const loadText = String(input?.loadText || '').trim();
  const rir = input?.rir !== undefined && input?.rir !== '' ? Number(input.rir) : null;
  const notes = String(input?.notes || '').trim();
  const payload = input?.payload && typeof input.payload === 'object' ? input.payload : {};
  const loggedAt = String(input?.loggedAt || '').trim();

  if (!exercise) {
    return { error: 'exercise é obrigatório', code: 400 };
  }

  const workout = await validateAccessibleWorkout(workoutId, userId, 'strength');
  if (workoutId && !workout) {
    return { error: 'workoutId inválido para esta conta', code: 400 };
  }

  const inserted = await pool.query(
    `INSERT INTO strength_session_logs (user_id, workout_id, exercise, sets_count, reps_text, load_value, load_text, rir, notes, payload, logged_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      userId,
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

  return { log: refreshed.rows[0] };
}
