import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('[enrich-admin-playground] DATABASE_URL é obrigatório');
  process.exit(1);
}

const useRemoteSsl = !/localhost|127\.0\.0\.1|@db(?::|\/|$)/i.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(useRemoteSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const FEMALE_NAMES = [
  'Ana Clara', 'Beatriz', 'Camila', 'Fernanda', 'Gabriela', 'Isabela', 'Julia', 'Larissa',
  'Mariana', 'Natalia', 'Paula', 'Rafaela', 'Sabrina', 'Talita', 'Vanessa',
];
const MALE_NAMES = [
  'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor',
  'Joao Pedro', 'Leonardo', 'Lucas', 'Matheus', 'Pedro', 'Rafael', 'Thiago',
];
const LAST_NAMES = [
  'Almeida', 'Araujo', 'Barbosa', 'Cardoso', 'Costa', 'Ferreira', 'Gomes', 'Lima',
  'Martins', 'Melo', 'Moreira', 'Oliveira', 'Pereira', 'Rocha', 'Souza',
];
const EXERCISES = [
  ['BACK SQUAT', 85, 6],
  ['CLEAN', 72, 5],
  ['SNATCH', 55, 4],
  ['DEADLIFT', 115, 7],
];

function pickName(index) {
  const firstPool = index % 3 === 0 ? FEMALE_NAMES : MALE_NAMES;
  const first = firstPool[index % firstPool.length];
  const last = LAST_NAMES[index % LAST_NAMES.length];
  return `${first} ${last}`;
}

function isoDateDaysAgo(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function dateOnlyDaysAgo(daysAgo) {
  return isoDateDaysAgo(daysAgo).slice(0, 10);
}

async function main() {
  const client = await pool.connect();
  try {
    const athletesRes = await client.query(`
      SELECT u.id, u.email, gm.gym_id, g.name AS gym_name
      FROM users u
      JOIN gym_memberships gm ON gm.user_id = u.id
      JOIN gyms g ON g.id = gm.gym_id
      WHERE u.email LIKE 'athlete%.%@crossapp.local'
        AND gm.role = 'athlete'
        AND gm.status = 'active'
      ORDER BY u.email ASC
    `);

    const benchmarkRes = await client.query(`
      SELECT slug
      FROM benchmark_library
      ORDER BY year DESC NULLS LAST, name ASC
      LIMIT 6
    `);
    const benchmarkSlugs = benchmarkRes.rows.map((row) => row.slug).filter(Boolean);

    const workoutRes = await client.query(`
      SELECT w.id, w.gym_id, w.title, w.scheduled_date
      FROM workouts w
      WHERE w.sport_type = 'cross'
      ORDER BY w.gym_id ASC, w.scheduled_date DESC, w.id DESC
    `);
    const workoutsByGym = new Map();
    for (const row of workoutRes.rows) {
      const list = workoutsByGym.get(row.gym_id) || [];
      list.push(row);
      workoutsByGym.set(row.gym_id, list);
    }

    const summary = {
      athletes: athletesRes.rows.length,
      renamed: 0,
      measurementsInserted: 0,
      prsInserted: 0,
      resultsInserted: 0,
      strengthLogsInserted: 0,
    };

    for (let index = 0; index < athletesRes.rows.length; index += 1) {
      const athlete = athletesRes.rows[index];
      const athleteNumber = index + 1;
      const athleteName = pickName(athleteNumber);
      await client.query(`UPDATE users SET name = $2 WHERE id = $1`, [athlete.id, athleteName]);
      summary.renamed += 1;

      summary.measurementsInserted += await ensureMeasurementHistory(client, athlete.id, athleteNumber);
      summary.prsInserted += await ensurePrHistory(client, athlete.id, athleteNumber);
      summary.resultsInserted += await ensureBenchmarkHistory(client, athlete.id, athlete.gym_id, athleteNumber, benchmarkSlugs);
      summary.strengthLogsInserted += await ensureStrengthLogs(client, athlete.id, athlete.gym_id, athleteNumber, workoutsByGym.get(athlete.gym_id) || []);
    }

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (error) {
    console.error('[enrich-admin-playground] failed', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureMeasurementHistory(client, athleteId, athleteNumber) {
  const existingRes = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM athlete_measurements
     WHERE user_id = $1
       AND notes = 'seed realistic history'`,
    [athleteId],
  );
  if (Number(existingRes.rows[0]?.total || 0) >= 6) return 0;

  const baseWeight = 68 + (athleteNumber % 12);
  const baseWaist = 74 + (athleteNumber % 8);
  const inserts = [
    ['weight', 'Peso', 'kg', baseWeight + 2.4, 180],
    ['weight', 'Peso', 'kg', baseWeight + 1.8, 120],
    ['weight', 'Peso', 'kg', baseWeight + 1.1, 90],
    ['weight', 'Peso', 'kg', baseWeight + 0.6, 45],
    ['waist', 'Cintura', 'cm', baseWaist + 2, 120],
    ['waist', 'Cintura', 'cm', baseWaist, 45],
  ];

  let count = 0;
  for (let i = 0; i < inserts.length; i += 1) {
    const [type, label, unit, value, daysAgo] = inserts[i];
    const id = `seed-hist-${athleteId}-${type}-${i + 1}`;
    await client.query(
      `INSERT INTO athlete_measurements (id, user_id, type, label, unit, value, notes, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,'seed realistic history',$7)
       ON CONFLICT (id) DO NOTHING`,
      [id, athleteId, type, label, unit, value, dateOnlyDaysAgo(daysAgo)],
    );
    count += 1;
  }
  return count;
}

async function ensurePrHistory(client, athleteId, athleteNumber) {
  const existingRes = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM athlete_pr_records
     WHERE user_id = $1
       AND source = 'seed-history'`,
    [athleteId],
  );
  if (Number(existingRes.rows[0]?.total || 0) >= EXERCISES.length * 4) return 0;

  let count = 0;
  for (const [exercise, base, step] of EXERCISES) {
    for (let point = 0; point < 4; point += 1) {
      const value = base + (athleteNumber % 7) * 1.5 + step * point;
      await client.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source, created_at)
         VALUES ($1,$2,$3,'kg','seed-history',$4)`,
        [athleteId, exercise, value, isoDateDaysAgo(150 - point * 35)],
      );
      count += 1;
    }
  }
  return count;
}

async function ensureBenchmarkHistory(client, athleteId, gymId, athleteNumber, benchmarkSlugs) {
  const existingRes = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM benchmark_results
     WHERE user_id = $1
       AND notes = 'seed realistic history'`,
    [athleteId],
  );
  if (Number(existingRes.rows[0]?.total || 0) >= Math.min(benchmarkSlugs.length, 6)) return 0;

  let count = 0;
  for (let i = 0; i < Math.min(benchmarkSlugs.length, 6); i += 1) {
    const score = 72 + athleteNumber + i * 3;
    await client.query(
      `INSERT INTO benchmark_results (benchmark_slug, user_id, gym_id, sport_type, score_display, score_value, notes, created_at)
       VALUES ($1,$2,$3,'cross',$4,$5,'seed realistic history',$6)`,
      [benchmarkSlugs[i], athleteId, gymId, `${score} reps`, score, isoDateDaysAgo(210 - i * 28)],
    );
    count += 1;
  }
  return count;
}

async function ensureStrengthLogs(client, athleteId, gymId, athleteNumber, workouts) {
  const existingRes = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM strength_session_logs
     WHERE user_id = $1
       AND notes = 'seed realistic history'`,
    [athleteId],
  );
  if (Number(existingRes.rows[0]?.total || 0) >= 4) return 0;

  const picks = workouts.slice(0, 4);
  let count = 0;
  for (let i = 0; i < picks.length; i += 1) {
    const workout = picks[i];
    const load = 52 + athleteNumber + i * 4;
    await client.query(
      `INSERT INTO strength_session_logs (
         user_id, workout_id, exercise, sets_count, reps_text, load_value, load_text, rir,
         notes, payload, logged_at, completion_state, source_label
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'seed realistic history',$9,$10,'completed_from_coach',$11)`,
      [
        athleteId,
        workout?.id || null,
        i % 2 === 0 ? 'BACK SQUAT' : 'POWER CLEAN',
        5,
        i % 2 === 0 ? '5x3' : '6x2',
        load,
        `${load}kg`,
        2,
        JSON.stringify({ gymId, seeded: true }),
        isoDateDaysAgo(30 - i * 6),
        workout?.title || 'Seed workout',
      ],
    );
    count += 1;
  }
  return count;
}

main();
