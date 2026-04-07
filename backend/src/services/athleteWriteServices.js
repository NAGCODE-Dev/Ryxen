import { pool } from '../db.js';

export async function createAthletePrRecord({ userId, exercise, value, unit, source }) {
  const inserted = await pool.query(
    `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [userId, exercise, value, unit || 'kg', source || 'manual'],
  );

  return { prRecord: inserted.rows[0] };
}

export async function syncAthletePrSnapshot({ userId, prs }) {
  const entries = Object.entries(prs)
    .map(([exercise, value]) => [String(exercise || '').trim().toUpperCase(), Number(value)])
    .filter(([exercise, value]) => exercise && Number.isFinite(value) && value > 0);

  const incoming = new Map(entries);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const latestRes = await client.query(
      `SELECT DISTINCT ON (exercise) exercise, value, source
       FROM athlete_pr_records
       WHERE user_id = $1
       ORDER BY exercise ASC, created_at DESC`,
      [userId],
    );

    const latestByExercise = new Map(
      latestRes.rows.map((row) => [
        String(row.exercise || '').trim().toUpperCase(),
        {
          value: Number(row.value),
          source: String(row.source || 'manual').trim().toLowerCase(),
        },
      ]),
    );

    let insertedCount = 0;
    let removedCount = 0;

    for (const [exercise, value] of incoming.entries()) {
      const current = latestByExercise.get(exercise) || null;
      if (current && current.source !== 'snapshot_removed' && current.value === value) continue;

      await client.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
         VALUES ($1,$2,$3,'kg','snapshot')`,
        [userId, exercise, value],
      );
      insertedCount += 1;
    }

    for (const [exercise, current] of latestByExercise.entries()) {
      if (incoming.has(exercise)) continue;
      if (current?.source === 'snapshot_removed') continue;

      await client.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
         VALUES ($1,$2,0,'kg','snapshot_removed')`,
        [userId, exercise],
      );
      removedCount += 1;
    }

    await client.query('COMMIT');
    return { inserted: insertedCount, removed: removedCount, total: entries.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncAthleteMeasurementsSnapshot({ userId, measurements }) {
  const normalized = [];
  for (const entry of measurements) {
    const id = String(entry?.id || '').trim();
    const type = String(entry?.type || 'custom').trim().toLowerCase();
    const label = String(entry?.label || '').trim();
    const unit = String(entry?.unit || '').trim();
    const value = Number(entry?.value);
    const notes = String(entry?.notes || '').trim();
    const recordedAt = String(entry?.recordedAt || '').trim();

    if (!id || !label || !Number.isFinite(value) || !recordedAt) {
      return { error: 'Cada medida precisa de id, label, value e recordedAt válidos', code: 400 };
    }

    normalized.push({
      id,
      type: type || 'custom',
      label,
      unit,
      value,
      notes: notes || null,
      recordedAt,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM athlete_measurements WHERE user_id = $1`, [userId]);

    for (const entry of normalized) {
      await client.query(
        `INSERT INTO athlete_measurements (id, user_id, type, label, unit, value, notes, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          entry.id,
          userId,
          entry.type,
          entry.label,
          entry.unit || '',
          entry.value,
          entry.notes,
          entry.recordedAt,
        ],
      );
    }

    await client.query('COMMIT');
    return { synced: normalized.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
