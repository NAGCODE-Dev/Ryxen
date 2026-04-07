import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('[seed-admin-playground] DATABASE_URL é obrigatório');
  process.exit(1);
}

const ADMIN_EMAIL = String(process.env.RYXEN_ADMIN_EMAIL || process.env.CROSSAPP_ADMIN_EMAIL || 'nagcode.contact@gmail.com').trim().toLowerCase();
const ADMIN_NAME = String(process.env.RYXEN_ADMIN_NAME || process.env.CROSSAPP_ADMIN_NAME || 'Nikolas Ayres').trim();
const DEFAULT_PASSWORD = String(process.env.RYXEN_SEED_PASSWORD || process.env.CROSSAPP_SEED_PASSWORD || 'RyxenSeed123').trim();
const GYM_COUNT = Math.max(1, Number(process.env.RYXEN_SEED_GYMS || process.env.CROSSAPP_SEED_GYMS || 2));
const ATHLETES_PER_GYM = Math.max(3, Number(process.env.RYXEN_SEED_ATHLETES_PER_GYM || process.env.CROSSAPP_SEED_ATHLETES_PER_GYM || 6));
const COACHES_PER_GYM = Math.max(1, Number(process.env.RYXEN_SEED_COACHES_PER_GYM || process.env.CROSSAPP_SEED_COACHES_PER_GYM || 1));

const useRemoteSsl = !/localhost|127\.0\.0\.1|@db(?::|\/|$)/i.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(useRemoteSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const admin = await ensureUser(client, {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: DEFAULT_PASSWORD,
      isAdmin: true,
    });
    await ensureActiveSubscription(client, admin.id, 'pro', 'mock');

    const summary = {
      admin: {
        email: admin.email,
        password: DEFAULT_PASSWORD,
        userId: admin.id,
      },
      gyms: [],
      coaches: [],
      athletes: [],
    };

    const benchmarkSlugs = await loadBenchmarkSlugs(client);
    const today = new Date();

    for (let gymIndex = 1; gymIndex <= GYM_COUNT; gymIndex += 1) {
      const gymName = `Ryxen Lab ${gymIndex}`;
      const gymSlug = `ryxen-lab-${gymIndex}`;
      const gym = await ensureGym(client, {
        ownerUserId: admin.id,
        gymName,
        gymSlug,
      });
      await ensureMembership(client, gym.id, admin.id, admin.email, 'owner');

      const gymSummary = {
        id: gym.id,
        name: gym.name,
        slug: gym.slug,
        coaches: [],
        athletes: [],
        groups: [],
        workouts: [],
      };

      const athleteMemberships = [];

      for (let coachIndex = 1; coachIndex <= COACHES_PER_GYM; coachIndex += 1) {
        const coachEmail = `coach${gymIndex}.${coachIndex}@ryxen.local`;
        const coach = await ensureUser(client, {
          email: coachEmail,
          name: `Coach ${gymIndex}.${coachIndex}`,
          password: DEFAULT_PASSWORD,
        });
        await ensureMembership(client, gym.id, coach.id, coach.email, 'coach');
        gymSummary.coaches.push({ email: coach.email, password: DEFAULT_PASSWORD, userId: coach.id });
        summary.coaches.push({ gym: gym.name, email: coach.email, password: DEFAULT_PASSWORD });
      }

      for (let athleteIndex = 1; athleteIndex <= ATHLETES_PER_GYM; athleteIndex += 1) {
        const athleteEmail = `athlete${gymIndex}.${athleteIndex}@ryxen.local`;
        const athlete = await ensureUser(client, {
          email: athleteEmail,
          name: `Athlete ${gymIndex}.${athleteIndex}`,
          password: DEFAULT_PASSWORD,
        });
        const membership = await ensureMembership(client, gym.id, athlete.id, athlete.email, 'athlete');
        athleteMemberships.push({ ...membership, userId: athlete.id, email: athlete.email, name: athlete.name });
        gymSummary.athletes.push({ email: athlete.email, password: DEFAULT_PASSWORD, userId: athlete.id });
        summary.athletes.push({ gym: gym.name, email: athlete.email, password: DEFAULT_PASSWORD });

        await seedAthleteData(client, {
          athleteId: athlete.id,
          gymId: gym.id,
          athleteIndex,
          benchmarkSlugs,
          baseDate: today,
        });
      }

      const groups = await ensureGroups(client, {
        gymId: gym.id,
        ownerUserId: admin.id,
        athleteMemberships,
      });
      gymSummary.groups = groups.map((group) => ({ id: group.id, name: group.name, memberCount: group.memberIds.length }));

      const workouts = await ensureWorkouts(client, {
        gymId: gym.id,
        ownerUserId: admin.id,
        athleteMemberships,
        groups,
        baseDate: today,
      });
      gymSummary.workouts = workouts.map((workout) => ({
        id: workout.id,
        title: workout.title,
        scheduledDate: workout.scheduled_date,
        audienceMode: workout.audienceMode,
      }));

      summary.gyms.push(gymSummary);
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[seed-admin-playground] failed', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureUser(client, { email, name, password, isAdmin = false }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existing = await client.query(
    `SELECT id, email, name, is_admin
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing.rows[0]) {
    const updated = await client.query(
      `UPDATE users
       SET name = COALESCE($2, name),
           password_hash = $3,
           is_admin = CASE WHEN $4 THEN TRUE ELSE is_admin END,
           email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = $1
       RETURNING id, email, name, is_admin`,
      [existing.rows[0].id, name || null, passwordHash, isAdmin],
    );
    return updated.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO users (email, password_hash, name, is_admin, email_verified, email_verified_at)
     VALUES ($1,$2,$3,$4,TRUE,NOW())
     RETURNING id, email, name, is_admin`,
    [normalizedEmail, passwordHash, name || null, isAdmin],
  );
  return inserted.rows[0];
}

async function ensureActiveSubscription(client, userId, planId, provider) {
  const current = await client.query(
    `SELECT id
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );

  const renewAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();

  if (current.rows[0]) {
    await client.query(
      `UPDATE subscriptions
       SET plan_id = $2,
           status = 'active',
           provider = $3,
           renew_at = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [current.rows[0].id, planId, provider, renewAt],
    );
    return;
  }

  await client.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, provider, renew_at, updated_at)
     VALUES ($1,$2,'active',$3,$4,NOW())`,
    [userId, planId, provider, renewAt],
  );
}

async function ensureGym(client, { ownerUserId, gymName, gymSlug }) {
  const existing = await client.query(
    `SELECT id, name, slug
     FROM gyms
     WHERE slug = $1
     LIMIT 1`,
    [gymSlug],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await client.query(
    `INSERT INTO gyms (name, slug, owner_user_id)
     VALUES ($1,$2,$3)
     RETURNING id, name, slug`,
    [gymName, gymSlug, ownerUserId],
  );
  return inserted.rows[0];
}

async function ensureMembership(client, gymId, userId, email, role) {
  const existing = await client.query(
    `SELECT id, gym_id, user_id, role, status
     FROM gym_memberships
     WHERE gym_id = $1
       AND user_id = $2
     LIMIT 1`,
    [gymId, userId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await client.query(
    `INSERT INTO gym_memberships (gym_id, user_id, pending_email, role, status)
     VALUES ($1,$2,NULL,$3,'active')
     RETURNING id, gym_id, user_id, role, status`,
    [gymId, userId, role],
  );
  return inserted.rows[0];
}

async function ensureGroups(client, { gymId, ownerUserId, athleteMemberships }) {
  const slices = [
    { name: 'RX Base', description: 'Atletas principais do dia', members: athleteMemberships.slice(0, Math.ceil(athleteMemberships.length / 2)) },
    { name: 'Scale Engine', description: 'Grupo secundário para envio segmentado', members: athleteMemberships.slice(Math.floor(athleteMemberships.length / 3)) },
  ];

  const groups = [];
  for (const slice of slices) {
    const existing = await client.query(
      `SELECT id, name
       FROM athlete_groups
       WHERE gym_id = $1
         AND sport_type = 'cross'
         AND name = $2
       LIMIT 1`,
      [gymId, slice.name],
    );

    let group = existing.rows[0];
    if (!group) {
      const inserted = await client.query(
        `INSERT INTO athlete_groups (gym_id, name, description, sport_type, created_by_user_id)
         VALUES ($1,$2,$3,'cross',$4)
         RETURNING id, name`,
        [gymId, slice.name, slice.description, ownerUserId],
      );
      group = inserted.rows[0];
    }

    const memberIds = slice.members.map((member) => member.id);
    for (const membershipId of memberIds) {
      await client.query(
        `INSERT INTO athlete_group_memberships (group_id, gym_membership_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [group.id, membershipId],
      );
    }

    groups.push({ ...group, memberIds });
  }

  return groups;
}

async function ensureWorkouts(client, { gymId, ownerUserId, athleteMemberships, groups, baseDate }) {
  const formatDate = (offset) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const templates = [
    {
      title: 'Hoje | Snatch + Metcon',
      scheduledDate: formatDate(0),
      audienceMode: 'all',
      payload: {
        blocks: [
          { type: 'OLY', lines: ['POWER SNATCH + SQUAT SNATCH', '6x (1+1) @ 65-80%'] },
          { type: 'METCON', lines: ['12 MIN AMRAP', '10 BURPEES', '12 TOES TO BAR', '14 WALL BALLS'] },
        ],
      },
    },
    {
      title: 'Amanhã | Front Squat + Engine',
      scheduledDate: formatDate(1),
      audienceMode: 'all',
      payload: {
        blocks: [
          { type: 'STRENGTH', lines: ['FRONT SQUAT', '5x3 @ 82%'] },
          { type: 'ENGINE', lines: ['4 ROUNDS', '400m run', '15 box step overs', '12 push press'] },
        ],
      },
    },
    {
      title: 'Individual | Técnica',
      scheduledDate: formatDate(2),
      audienceMode: 'selected',
      targetMembershipIds: athleteMemberships.slice(0, 2).map((member) => member.id),
      payload: {
        blocks: [
          { type: 'ACCESSORY', lines: ['PAUSE CLEAN', '5x2 leve', 'tempo controlado'] },
        ],
      },
    },
    {
      title: 'Grupo RX | Barbell Cycling',
      scheduledDate: formatDate(3),
      audienceMode: 'groups',
      targetGroupIds: groups.slice(0, 1).map((group) => group.id),
      payload: {
        blocks: [
          { type: 'BARBELL', lines: ['EMOM 10', '5 power clean + 5 push jerk'] },
        ],
      },
    },
  ];

  const workouts = [];
  for (const template of templates) {
    const existing = await client.query(
      `SELECT id, title, scheduled_date
       FROM workouts
       WHERE gym_id = $1
         AND sport_type = 'cross'
         AND title = $2
         AND scheduled_date = $3
       LIMIT 1`,
      [gymId, template.title, template.scheduledDate],
    );

    let workout = existing.rows[0];
    if (!workout) {
      const inserted = await client.query(
        `INSERT INTO workouts (gym_id, created_by_user_id, title, description, scheduled_date, payload, sport_type)
         VALUES ($1,$2,$3,$4,$5,$6,'cross')
         RETURNING id, title, scheduled_date`,
        [gymId, ownerUserId, template.title, null, template.scheduledDate, template.payload],
      );
      workout = inserted.rows[0];
    }

    if (template.audienceMode === 'selected' && template.targetMembershipIds?.length) {
      for (const membershipId of template.targetMembershipIds) {
        await client.query(
          `INSERT INTO workout_assignments (workout_id, gym_membership_id)
           VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [workout.id, membershipId],
        );
      }
    }

    if (template.audienceMode === 'groups' && template.targetGroupIds?.length) {
      const rows = await client.query(
        `SELECT DISTINCT gym_membership_id
         FROM athlete_group_memberships
         WHERE group_id = ANY($1::int[])`,
        [template.targetGroupIds],
      );
      for (const row of rows.rows) {
        await client.query(
          `INSERT INTO workout_assignments (workout_id, gym_membership_id)
           VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [workout.id, row.gym_membership_id],
        );
      }
    }

    workouts.push({ ...workout, audienceMode: template.audienceMode });
  }

  return workouts;
}

async function loadBenchmarkSlugs(client) {
  const result = await client.query(
    `SELECT slug
     FROM benchmark_library
     ORDER BY year DESC NULLS LAST, name ASC
     LIMIT 6`,
  );
  return result.rows.map((row) => row.slug).filter(Boolean);
}

async function seedAthleteData(client, { athleteId, gymId, athleteIndex, benchmarkSlugs, baseDate }) {
  const exerciseBase = [
    ['BACK SQUAT', 100],
    ['CLEAN', 80],
    ['SNATCH', 60],
  ];

  for (const [exercise, baseValue] of exerciseBase) {
    const existing = await client.query(
      `SELECT 1
       FROM athlete_pr_records
       WHERE user_id = $1
         AND exercise = $2
       LIMIT 1`,
      [athleteId, exercise],
    );
    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source, created_at)
         VALUES ($1,$2,$3,'kg','seed', NOW() - ($4::int * INTERVAL '1 day'))`,
        [athleteId, exercise, baseValue + athleteIndex * 2, athleteIndex],
      );
    }
  }

  const measurementId = `seed-weight-${athleteId}`;
  const measurement = await client.query(
    `SELECT 1
     FROM athlete_measurements
     WHERE id = $1
     LIMIT 1`,
    [measurementId],
  );
  if (!measurement.rows[0]) {
    const recordedAt = new Date(baseDate);
    recordedAt.setDate(recordedAt.getDate() - athleteIndex);
    await client.query(
      `INSERT INTO athlete_measurements (id, user_id, type, label, unit, value, notes, recorded_at)
       VALUES ($1,$2,'body','Peso','kg',$3,'seed playground',$4)`,
      [measurementId, athleteId, 78 + athleteIndex, recordedAt.toISOString()],
    );
  }

  for (let i = 0; i < Math.min(3, benchmarkSlugs.length); i += 1) {
    const slug = benchmarkSlugs[i];
    const existing = await client.query(
      `SELECT 1
       FROM benchmark_results
       WHERE user_id = $1
         AND benchmark_slug = $2
         AND notes = 'seed playground'
       LIMIT 1`,
      [athleteId, slug],
    );
    if (existing.rows[0]) continue;
    const createdAt = new Date(baseDate);
    createdAt.setDate(createdAt.getDate() - (i + athleteIndex));
    await client.query(
      `INSERT INTO benchmark_results (benchmark_slug, user_id, gym_id, sport_type, score_display, score_value, notes, created_at)
       VALUES ($1,$2,$3,'cross',$4,$5,'seed playground',$6)`,
      [slug, athleteId, gymId, `${80 + athleteIndex + i} reps`, 80 + athleteIndex + i, createdAt.toISOString()],
    );
  }
}

main();
