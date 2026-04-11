import { pool } from '../db.js';

export async function resolveWorkoutAudience({ gymId, audienceMode, targetMembershipIds, targetGroupIds }) {
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

export async function inviteGymMembership({ gymId, email, role }) {
  const foundUser = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email]);
  const found = foundUser.rows[0] || null;

  try {
    const inserted = await pool.query(
      `INSERT INTO gym_memberships (gym_id, user_id, pending_email, role, status)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [gymId, found?.id || null, found ? null : email, role, found ? 'active' : 'invited'],
    );
    return { membership: inserted.rows[0] };
  } catch (error) {
    if (String(error?.message || '').includes('idx_gym_membership_user_unique')) {
      return { error: 'Usuário já pertence a este gym', code: 409 };
    }
    throw error;
  }
}

export async function createWorkoutForAudience({
  gymId,
  userId,
  title,
  description,
  scheduledDate,
  payload,
  sportType,
  audienceMode,
  targetMembershipIds,
  targetGroupIds,
}) {
  const audience = await resolveWorkoutAudience({
    gymId,
    audienceMode,
    targetMembershipIds,
    targetGroupIds,
  });
  if (audience.error) {
    return { error: audience.error, code: 400 };
  }

  const targetRows = audience.rows || [];
  if ((audienceMode === 'selected' || audienceMode === 'groups') && !targetRows.length) {
    return { error: 'Nenhum atleta ativo encontrado para esta audiência', code: 400 };
  }

  const inserted = await pool.query(
    `INSERT INTO workouts (gym_id, created_by_user_id, title, description, scheduled_date, payload, sport_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [gymId, userId, title, description || null, scheduledDate, payload, sportType],
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

  return {
    workout,
    assigned: targetRows.length,
    audience: {
      sportType,
      mode: audienceMode,
      membershipIds: audienceMode === 'selected' ? targetMembershipIds : [],
      groupIds: audienceMode === 'groups' ? targetGroupIds : [],
    },
  };
}

export async function createAthleteGroup({
  gymId,
  sportType,
  name,
  description,
  memberIds,
  userId,
}) {
  let client;
  try {
    client = await pool.connect();
    console.info('[gym-write-services] gym creation started', { gymName });
    
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO athlete_groups (gym_id, name, description, sport_type, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [gymId, name, description || null, sportType, userId],
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
    console.info('[gym-write-services] athlete group created successfully', { groupId: group.id, gymId });
    return { group };
  } catch (error) {
    console.error('[gym-write-services] error creating athlete group', { gymId, error: error.message });
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.warn('[gym-write-services] transaction rolled back');
      } catch (rollbackError) {
        console.error('[gym-write-services] error during rollback', { rollbackError: rollbackError.message });
      }
    }
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
        console.info('[gym-write-services] database client released');
      } catch (releaseError) {
        console.error('[gym-write-services] error releasing database client', { releaseError: releaseError.message });
      }
    }
  }
}
