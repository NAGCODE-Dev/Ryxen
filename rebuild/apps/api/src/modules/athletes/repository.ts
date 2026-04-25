import { normalizeSportType } from "./sport-type";
import { pool } from "../../lib/db";
import { getEntitlementsSnapshot } from "../billing/repository";

type SnapshotRow = {
  id: number;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type MeasurementRow = {
  id: string;
  type: string;
  label: string;
  unit: string;
  value: number;
  notes: string | null;
  recorded_at: string;
  created_at?: string;
};

function ensureObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getAthleteOnboardingSnapshot(userId: number) {
  const [userRes, entitlements] = await Promise.all([
    pool.query<{ id: number; email: string; name: string | null; is_admin: boolean | null }>(
      `SELECT id, email, name, is_admin
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    ),
    getEntitlementsSnapshot(userId),
  ]);

  const gyms = entitlements?.gymAccess || [];
  const primaryGym = gyms[0] || null;
  const canReceiveWorkout = gyms.some((gym) => gym.role === "athlete" && gym.status === "active");
  const nextStep = primaryGym
    ? canReceiveWorkout
      ? "Seu acesso ao gym ja esta ativo. Assim que o coach publicar um treino, ele aparece no Today."
      : "Seu gym foi encontrado, mas o acesso ainda nao esta ativo."
    : "Voce ainda nao esta vinculado a um gym. Entre com o email convidado pelo coach para receber o treino.";

  const user = userRes.rows[0];

  return {
    user: user
      ? {
          id: String(user.id),
          email: user.email,
          name: user.name,
          isAdmin: !!user.is_admin,
        }
      : null,
    entitlements,
    gyms,
    primaryGym,
    canReceiveWorkout,
    nextStep,
  };
}

export async function getImportedPlan(userId: number) {
  const result = await pool.query<SnapshotRow>(
    `SELECT id, payload, created_at
     FROM sync_snapshots
     WHERE user_id = $1
       AND COALESCE(payload->>'kind', '') = 'imported_plan'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const payload = ensureObject(row.payload);
  return {
    weeks: Array.isArray(payload.weeks) ? payload.weeks : [],
    metadata: ensureObject(payload.metadata),
    activeWeekNumber:
      typeof payload.activeWeekNumber === "number" ? payload.activeWeekNumber : null,
    updatedAt:
      typeof payload.updatedAt === "string" && payload.updatedAt
        ? payload.updatedAt
        : row.created_at,
  };
}

export async function putImportedPlan(
  userId: number,
  input: {
    weeks: unknown[];
    metadata?: Record<string, unknown>;
    activeWeekNumber?: number | null;
    updatedAt?: string;
  },
) {
  const payload = {
    kind: "imported_plan",
    weeks: input.weeks,
    metadata: input.metadata || {},
    activeWeekNumber: input.activeWeekNumber ?? null,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM sync_snapshots
       WHERE user_id = $1
         AND COALESCE(payload->>'kind', '') = 'imported_plan'`,
      [userId],
    );
    await client.query(
      `INSERT INTO sync_snapshots (user_id, payload)
       VALUES ($1, $2::jsonb)`,
      [userId, JSON.stringify(payload)],
    );
    await client.query("COMMIT");
    return getImportedPlan(userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteImportedPlan(userId: number) {
  const deleted = await pool.query(
    `DELETE FROM sync_snapshots
     WHERE user_id = $1
       AND COALESCE(payload->>'kind', '') = 'imported_plan'`,
    [userId],
  );

  return {
    deleted: deleted.rowCount || 0,
  };
}

export async function getAppState(userId: number, sportTypeInput: unknown) {
  const sportType = normalizeSportType(sportTypeInput);
  const result = await pool.query<SnapshotRow>(
    `SELECT id, payload, created_at
     FROM sync_snapshots
     WHERE user_id = $1
       AND COALESCE(payload->>'kind', '') = 'app_state'
       AND COALESCE(payload->>'sportType', 'cross') = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, sportType],
  );

  const row = result.rows[0];
  if (!row) return null;

  const payload = ensureObject(row.payload);
  return {
    sportType,
    snapshot: ensureObject(payload.snapshot),
    updatedAt:
      typeof payload.updatedAt === "string" && payload.updatedAt
        ? payload.updatedAt
        : row.created_at,
  };
}

export async function putAppState(
  userId: number,
  input: {
    sportType?: string;
    snapshot: Record<string, unknown>;
    updatedAt?: string;
  },
) {
  const sportType = normalizeSportType(input.sportType);
  const payload = {
    kind: "app_state",
    sportType,
    snapshot: input.snapshot,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM sync_snapshots
       WHERE user_id = $1
         AND COALESCE(payload->>'kind', '') = 'app_state'
         AND COALESCE(payload->>'sportType', 'cross') = $2`,
      [userId, sportType],
    );
    await client.query(
      `INSERT INTO sync_snapshots (user_id, payload)
       VALUES ($1, $2::jsonb)`,
      [userId, JSON.stringify(payload)],
    );
    await client.query("COMMIT");
    return getAppState(userId, sportType);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMeasurementsHistory(userId: number) {
  const result = await pool.query<MeasurementRow>(
    `SELECT id, type, label, unit, value, notes, recorded_at, created_at
     FROM athlete_measurements
     WHERE user_id = $1
     ORDER BY recorded_at DESC, created_at DESC
     LIMIT 120`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    label: row.label,
    unit: row.unit,
    value: Number(row.value),
    notes: row.notes,
    recordedAt: row.recorded_at,
  }));
}

export async function syncMeasurementsSnapshot(
  userId: number,
  measurements: Array<{
    id: string;
    type: string;
    label: string;
    unit: string;
    value: number;
    notes?: string | null | undefined;
    recordedAt: string;
  }>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM athlete_measurements WHERE user_id = $1`, [userId]);

    for (const measurement of measurements) {
      await client.query(
        `INSERT INTO athlete_measurements (id, user_id, type, label, unit, value, notes, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          measurement.id,
          userId,
          measurement.type,
          measurement.label,
          measurement.unit,
          measurement.value,
          measurement.notes || null,
          measurement.recordedAt,
        ],
      );
    }

    await client.query("COMMIT");
    return { synced: measurements.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function syncPrSnapshot(userId: number, prs: Record<string, number>) {
  const entries = Object.entries(prs)
    .map(([exercise, value]) => [String(exercise || "").trim().toUpperCase(), Number(value)] as const)
    .filter(([exercise, value]) => exercise && Number.isFinite(value) && value > 0);

  const incoming = new Map(entries);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const latestRes = await client.query<{ exercise: string; value: number; source: string }>(
      `SELECT DISTINCT ON (exercise) exercise, value, source
       FROM athlete_pr_records
       WHERE user_id = $1
       ORDER BY exercise ASC, created_at DESC`,
      [userId],
    );

    const latestByExercise = new Map<string, { value: number; source: string }>(
      latestRes.rows.map((row) => [
        String(row.exercise || "").trim().toUpperCase(),
        {
          value: Number(row.value),
          source: String(row.source || "manual").trim().toLowerCase(),
        },
      ]),
    );

    let inserted = 0;
    let removed = 0;

    for (const [exercise, value] of incoming.entries()) {
      const current = latestByExercise.get(exercise);
      if (current && current.source !== "snapshot_removed" && current.value === value) {
        continue;
      }

      await client.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
         VALUES ($1,$2,$3,'kg','snapshot')`,
        [userId, exercise, value],
      );
      inserted += 1;
    }

    for (const [exercise, current] of latestByExercise.entries()) {
      if (incoming.has(exercise) || current.source === "snapshot_removed") {
        continue;
      }

      await client.query(
        `INSERT INTO athlete_pr_records (user_id, exercise, value, unit, source)
         VALUES ($1,$2,0,'kg','snapshot_removed')`,
        [userId, exercise],
      );
      removed += 1;
    }

    await client.query("COMMIT");
    return {
      inserted,
      removed,
      total: entries.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
