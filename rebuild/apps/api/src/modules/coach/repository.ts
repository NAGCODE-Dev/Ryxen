import {
  buildDefaultOwnerSubscription,
  buildGymMembershipContext,
  serializeSubscriptionStatus,
} from "@ryxen/domain";
import { pool } from "../../lib/db";
import { getEntitlementsSnapshot, getLatestSubscription } from "../billing/repository";

type GymRow = {
  id: number;
  name: string;
  slug: string;
  role: string;
  status: string;
  owner_user_id: number;
};

type MembershipRow = {
  id: number;
  gym_id: number;
  pending_email: string | null;
  email: string | null;
  name: string | null;
  gym_name?: string | null;
  role: string;
  status: string;
  created_at?: string;
};

type SubscriptionRow = {
  user_id: number;
  plan_id: string | null;
  status: string | null;
  provider: string | null;
  renew_at: string | null;
  updated_at: string | null;
};

type WorkoutRow = {
  id: number;
  gym_id: number;
  gym_name: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  published_at: string;
  sport_type: "cross" | "running" | "strength";
  payload: Record<string, unknown> | null;
  assigned_count: string;
};

type WorkoutResultRow = {
  athlete_name: string | null;
  athlete_email: string | null;
  payload: Record<string, unknown> | null;
};

type WorkoutDeliveryRow = {
  membership_id: number;
  athlete_name: string | null;
  athlete_email: string | null;
  payload: Record<string, unknown> | null;
};

type AthleteWorkoutHistoryRow = {
  payload: Record<string, unknown> | null;
  workout_id: number | null;
  workout_title: string | null;
  gym_name: string | null;
  scheduled_date: string | null;
};

type CoachActivityRow = {
  id: number | null;
  workout_id?: number | null;
  gym_name: string | null;
  title?: string | null;
  description?: string | null;
  occurred_at: string;
  role?: string | null;
  status?: string | null;
  pending_email?: string | null;
  athlete_name?: string | null;
  athlete_email?: string | null;
  payload?: Record<string, unknown> | null;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function ensureObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function getCoachGyms(userId: number) {
  const result = await pool.query<GymRow>(
    `SELECT
       g.id,
       g.name,
       g.slug,
       gm.role,
       gm.status,
       g.owner_user_id
     FROM gym_memberships gm
     JOIN gyms g ON g.id = gm.gym_id
     WHERE gm.user_id = $1
       AND gm.role IN ('owner', 'coach')
     ORDER BY gm.created_at ASC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    role: row.role,
    status: row.status,
    ownerUserId: row.owner_user_id,
  }));
}

export async function createCoachGym(input: { userId: number; name: string; slug?: string }) {
  const name = String(input.name || "").trim();
  const slug = slugify(String(input.slug || name));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number; name: string; slug: string }>(
      `INSERT INTO gyms (name, slug, owner_user_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug`,
      [name, slug, input.userId],
    );

    const gym = inserted.rows[0];
    if (!gym) {
      throw new Error("Nao foi possivel criar o gym");
    }
    await client.query(
      `INSERT INTO gym_memberships (gym_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')
       ON CONFLICT DO NOTHING`,
      [gym.id, input.userId],
    );

    await client.query("COMMIT");

    return {
      id: String(gym.id),
      name: gym.name,
      slug: gym.slug,
      role: "owner",
      status: "active",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCoachMembershipContext(userId: number, gymId: number) {
  const gyms = await getCoachGyms(userId);
  const gym = gyms.find((item) => Number(item.id) === gymId) || null;
  if (!gym) return null;

  const latestSubscription = await getLatestSubscription(gym.ownerUserId);
  const context = buildGymMembershipContext({
    gymId,
    gymName: gym.name,
    role: gym.role,
    status: gym.status,
    ownerSubscription: latestSubscription || buildDefaultOwnerSubscription(),
  });

  return {
    gym,
    context,
  };
}

export async function listGymMemberships(userId: number, gymId: number) {
  const access = await getCoachMembershipContext(userId, gymId);
  if (!access) {
    throw new Error("Coach nao possui acesso a este gym");
  }

  const result = await pool.query<MembershipRow>(
    `SELECT
       gm.id,
       gm.gym_id,
       gm.pending_email,
       u.email,
       u.name,
       gm.role,
       gm.status
     FROM gym_memberships gm
     LEFT JOIN users u ON u.id = gm.user_id
     WHERE gm.gym_id = $1
     ORDER BY gm.created_at ASC`,
    [gymId],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    gymId: String(row.gym_id),
    email: normalizeEmail(row.email || row.pending_email),
    label: String(row.name || row.email || row.pending_email || "Convidado"),
    role: row.role as "owner" | "coach" | "athlete",
    status: row.status,
  }));
}

export async function inviteGymMembership(input: {
  userId: number;
  gymId: number;
  email: string;
  role: "coach" | "athlete";
}) {
  const access = await getCoachMembershipContext(input.userId, input.gymId);
  if (!access) {
    throw new Error("Coach nao possui acesso a este gym");
  }

  const email = normalizeEmail(input.email);
  const foundUser = await pool.query<{ id: number; email: string; name: string | null }>(
    `SELECT id, email, name
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
  const found = foundUser.rows[0] || null;

  try {
    const inserted = await pool.query<MembershipRow>(
      `INSERT INTO gym_memberships (gym_id, user_id, pending_email, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, gym_id, pending_email, role, status`,
      [
        input.gymId,
        found?.id || null,
        found ? null : email,
        input.role,
        found ? "active" : "invited",
      ],
    );

    const membership = inserted.rows[0];
    if (!membership) {
      throw new Error("Nao foi possivel criar o convite");
    }

    return {
      id: String(membership.id),
      gymId: String(membership.gym_id),
      email,
      label: String(found?.name || found?.email || email),
      role: membership.role as "owner" | "coach" | "athlete",
      status: membership.status,
    };
  } catch (error) {
    const constraint = String(
      error && typeof error === "object" && "constraint" in error
        ? (error as { constraint?: string }).constraint || ""
        : "",
    );
    if (
      constraint.includes("idx_gym_membership_user_unique") ||
      constraint.includes("idx_gym_membership_pending_email_unique")
    ) {
      throw new Error("Esse atleta ja pertence ao gym ou ja tem convite pendente");
    }
    throw error;
  }
}

export async function removeGymMembership(input: {
  userId: number;
  gymId: number;
  membershipId: number;
}) {
  const access = await getCoachMembershipContext(input.userId, input.gymId);
  if (!access) {
    throw new Error("Coach nao possui acesso a este gym");
  }

  const membershipRes = await pool.query<{
    id: number;
    user_id: number | null;
    role: string;
    gym_id: number;
  }>(
    `SELECT id, user_id, role, gym_id
     FROM gym_memberships
     WHERE id = $1
       AND gym_id = $2
     LIMIT 1`,
    [input.membershipId, input.gymId],
  );

  const membership = membershipRes.rows[0] || null;
  if (!membership) {
    throw new Error("Membership nao encontrada");
  }

  if (membership.role === "owner") {
    throw new Error("O owner principal do gym nao pode ser removido");
  }

  if (membership.user_id === input.userId) {
    throw new Error("Voce nao pode remover sua propria membership por esta tela");
  }

  const deleted = await pool.query(
    `DELETE FROM gym_memberships
     WHERE id = $1
       AND gym_id = $2`,
    [input.membershipId, input.gymId],
  );

  if (!deleted.rowCount) {
    throw new Error("Nao foi possivel remover a membership");
  }

  return {
    success: true as const,
    deletedMembershipId: String(input.membershipId),
  };
}

async function resolveWorkoutAudience(gymId: number, audienceMode: string, targetMembershipIds: number[], targetGroupIds: number[]) {
  if (audienceMode === "all") {
    const members = await pool.query<{ id: number }>(
      `SELECT id
       FROM gym_memberships
       WHERE gym_id = $1
         AND status = 'active'
         AND role = 'athlete'`,
      [gymId],
    );

    return members.rows.map((row) => row.id);
  }

  if (audienceMode === "selected") {
    if (!targetMembershipIds.length) return [];
    const members = await pool.query<{ id: number }>(
      `SELECT id
       FROM gym_memberships
       WHERE gym_id = $1
         AND status = 'active'
         AND role = 'athlete'
         AND id = ANY($2::int[])`,
      [gymId, targetMembershipIds],
    );

    return members.rows.map((row) => row.id);
  }

  if (audienceMode === "groups") {
    if (!targetGroupIds.length) return [];
    const members = await pool.query<{ id: number }>(
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

    return members.rows.map((row) => row.id);
  }

  return [];
}

export async function publishWorkout(input: {
  userId: number;
  gymId: number;
  title: string;
  description?: string;
  scheduledDate: string;
  payload: Record<string, unknown>;
  sportType: "cross" | "running" | "strength";
  audienceMode: "all" | "selected" | "groups";
  targetMembershipIds: number[];
  targetGroupIds: number[];
}) {
  const access = await getCoachMembershipContext(input.userId, input.gymId);
  if (!access) {
    throw new Error("Coach nao possui acesso a este gym");
  }

  if (!access.context.canCoachManage) {
    throw new Error("Assinatura do coach sem permissao para publicar treinos");
  }

  const membershipIds = await resolveWorkoutAudience(
    input.gymId,
    input.audienceMode,
    input.targetMembershipIds,
    input.targetGroupIds,
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO workouts (gym_id, created_by_user_id, title, description, scheduled_date, payload, sport_type)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id`,
      [
        input.gymId,
        input.userId,
        input.title,
        input.description || null,
        input.scheduledDate,
        JSON.stringify(input.payload),
        input.sportType,
      ],
    );

    const workoutId = inserted.rows[0]?.id;
    if (typeof workoutId !== "number") {
      throw new Error("Nao foi possivel salvar o treino");
    }
    if (membershipIds.length) {
      await client.query(
        `INSERT INTO workout_assignments (workout_id, gym_membership_id)
         SELECT $1, UNNEST($2::int[])
         ON CONFLICT DO NOTHING`,
        [workoutId, membershipIds],
      );
    }

    await client.query("COMMIT");
    return getWorkoutSummary(workoutId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateWorkout(input: {
  userId: number;
  gymId: number;
  workoutId: number;
  title: string;
  description?: string;
  scheduledDate: string;
  payload: Record<string, unknown>;
}) {
  const access = await getCoachMembershipContext(input.userId, input.gymId);
  if (!access) {
    throw new Error("Coach nao possui acesso a este gym");
  }

  if (!access.context.canCoachManage) {
    throw new Error("Assinatura do coach sem permissao para editar treinos");
  }

  const workoutRes = await pool.query<{ id: number; gym_id: number }>(
    `SELECT id, gym_id
     FROM workouts
     WHERE id = $1
       AND gym_id = $2
     LIMIT 1`,
    [input.workoutId, input.gymId],
  );

  const workout = workoutRes.rows[0] || null;
  if (!workout) {
    throw new Error("Treino nao encontrado neste gym");
  }

  const updated = await pool.query(
    `UPDATE workouts
     SET title = $1,
         description = $2,
         scheduled_date = $3,
         payload = $4::jsonb
     WHERE id = $5
       AND gym_id = $6`,
    [
      input.title,
      input.description || null,
      input.scheduledDate,
      JSON.stringify(input.payload),
      input.workoutId,
      input.gymId,
    ],
  );

  if (!updated.rowCount) {
    throw new Error("Nao foi possivel atualizar o treino");
  }

  return getWorkoutSummary(input.workoutId);
}

export async function removeWorkout(input: {
  userId: number;
  gymId: number;
  workoutId: number;
}) {
  const access = await getCoachMembershipContext(input.userId, input.gymId);
  if (!access) {
    throw new Error("Coach nao possui acesso a este gym");
  }

  if (!access.context.canCoachManage) {
    throw new Error("Assinatura do coach sem permissao para remover treinos");
  }

  const workoutRes = await pool.query<{ id: number; gym_id: number }>(
    `SELECT id, gym_id
     FROM workouts
     WHERE id = $1
       AND gym_id = $2
     LIMIT 1`,
    [input.workoutId, input.gymId],
  );

  const workout = workoutRes.rows[0] || null;
  if (!workout) {
    throw new Error("Treino nao encontrado neste gym");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM sync_snapshots
       WHERE COALESCE(payload->>'kind', '') = 'workout_result'
         AND COALESCE(payload->>'workoutId', '') = $1`,
      [String(input.workoutId)],
    );

    await client.query(
      `DELETE FROM workout_assignments
       WHERE workout_id = $1`,
      [input.workoutId],
    );

    const deleted = await client.query(
      `DELETE FROM workouts
       WHERE id = $1
         AND gym_id = $2`,
      [input.workoutId, input.gymId],
    );

    if (!deleted.rowCount) {
      throw new Error("Nao foi possivel remover o treino");
    }

    await client.query("COMMIT");
    return {
      success: true as const,
      deletedWorkoutId: String(input.workoutId),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWorkoutSummary(workoutId: number) {
  const result = await pool.query<WorkoutRow>(
    `SELECT
       w.id,
       w.gym_id,
       g.name AS gym_name,
       w.title,
       w.description,
       w.scheduled_date,
       w.published_at,
       w.sport_type,
       w.payload,
       COUNT(DISTINCT wa.id)::text AS assigned_count
     FROM workouts w
     JOIN gyms g ON g.id = w.gym_id
     LEFT JOIN workout_assignments wa ON wa.workout_id = w.id
     WHERE w.id = $1
     GROUP BY w.id, g.name`,
    [workoutId],
  );

  const row = result.rows[0] || null;
  if (!row) return null;

  const resultCountRes = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM sync_snapshots
     WHERE COALESCE(payload->>'kind', '') = 'workout_result'
       AND COALESCE(payload->>'workoutId', '') = $1`,
    [String(workoutId)],
  );

  const recentResponsesRes = await pool.query<WorkoutResultRow>(
    `SELECT
       u.name AS athlete_name,
       u.email AS athlete_email,
       ss.payload
     FROM sync_snapshots ss
     JOIN users u ON u.id = ss.user_id
     WHERE COALESCE(ss.payload->>'kind', '') = 'workout_result'
       AND COALESCE(ss.payload->>'workoutId', '') = $1
     ORDER BY ss.created_at DESC, ss.id DESC
     LIMIT 8`,
    [String(workoutId)],
  );

  const athleteDeliveriesRes = await pool.query<WorkoutDeliveryRow>(
    `SELECT
       gm.id AS membership_id,
       u.name AS athlete_name,
       u.email AS athlete_email,
       latest_result.payload
     FROM workout_assignments wa
     JOIN gym_memberships gm ON gm.id = wa.gym_membership_id
     JOIN users u ON u.id = gm.user_id
     LEFT JOIN LATERAL (
       SELECT ss.payload
       FROM sync_snapshots ss
       WHERE ss.user_id = gm.user_id
         AND COALESCE(ss.payload->>'kind', '') = 'workout_result'
         AND COALESCE(ss.payload->>'workoutId', '') = $1
       ORDER BY ss.created_at DESC, ss.id DESC
       LIMIT 1
     ) latest_result ON TRUE
     WHERE wa.workout_id = $2
     ORDER BY u.name ASC NULLS LAST, u.email ASC`,
    [String(workoutId), workoutId],
  );

  const recentResponses = recentResponsesRes.rows
    .map((row) => {
      const payload = ensureObject(row.payload);
      const athleteEmail = normalizeEmail(row.athlete_email);
      const summary = String(payload.summary || "").trim();
      const completedAt = String(payload.completedAt || "").trim();
      if (!athleteEmail || !summary || !completedAt) return null;

      return {
        athleteName: String(row.athlete_name || row.athlete_email || "Atleta"),
        athleteEmail,
        summary,
        score: String(payload.score || "").trim() || undefined,
        notes: String(payload.notes || "").trim() || undefined,
        completedAt,
      };
    })
    .filter(Boolean);

  const athleteDeliveries = athleteDeliveriesRes.rows
    .map((row) => {
      const payload = ensureObject(row.payload);
      const athleteEmail = normalizeEmail(row.athlete_email);
      if (!athleteEmail) return null;

      const summary = String(payload.summary || "").trim();
      const completedAt = String(payload.completedAt || "").trim();

      return {
        membershipId: String(row.membership_id),
        athleteName: String(row.athlete_name || row.athlete_email || "Atleta"),
        athleteEmail,
        status: completedAt ? ("responded" as const) : ("pending" as const),
        completedAt: completedAt || null,
        summary: summary || undefined,
        score: String(payload.score || "").trim() || undefined,
      };
    })
    .filter(Boolean);

  return {
    id: String(row.id),
    gymId: String(row.gym_id),
    gymName: row.gym_name,
    title: row.title,
    description: row.description,
    sportType: row.sport_type,
    scheduledDate: row.scheduled_date,
    publishedAt: row.published_at,
    audienceMode: "all" as const,
    assignedCount: Number(row.assigned_count || 0),
    resultCount: Number(resultCountRes.rows[0]?.total || 0),
    payload: ensureObject(row.payload),
    recentResponses,
    athleteDeliveries,
  };
}

export async function getLatestCoachWorkout(userId: number) {
  const result = await pool.query<{ id: number }>(
    `SELECT w.id
     FROM workouts w
     JOIN gym_memberships gm ON gm.gym_id = w.gym_id
     WHERE gm.user_id = $1
       AND gm.role IN ('owner', 'coach')
     ORDER BY w.published_at DESC, w.created_at DESC
     LIMIT 1`,
    [userId],
  );

  const workoutId = result.rows[0]?.id;
  return typeof workoutId === "number" ? getWorkoutSummary(workoutId) : null;
}

export async function listRecentCoachWorkouts(userId: number, limit = 5) {
  const result = await pool.query<{ id: number }>(
    `SELECT DISTINCT w.id
     FROM workouts w
     JOIN gym_memberships gm ON gm.gym_id = w.gym_id
     WHERE gm.user_id = $1
       AND gm.role IN ('owner', 'coach')
     ORDER BY w.published_at DESC, w.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  const summaries = await Promise.all(
    result.rows
      .map((row) => row.id)
      .filter((id): id is number => typeof id === "number")
      .map((id) => getWorkoutSummary(id)),
  );

  return summaries.filter(Boolean);
}

export async function listCoachActivityFeed(userId: number, limit = 8) {
  const [publishedWorkouts, memberships, responses] = await Promise.all([
    pool.query<CoachActivityRow>(
      `SELECT
         w.id,
         w.id AS workout_id,
         g.name AS gym_name,
         w.title,
         w.published_at AS occurred_at
       FROM workouts w
       JOIN gyms g ON g.id = w.gym_id
       JOIN gym_memberships gm ON gm.gym_id = w.gym_id
       WHERE gm.user_id = $1
         AND gm.role IN ('owner', 'coach')
       ORDER BY w.published_at DESC, w.created_at DESC
       LIMIT $2`,
      [userId, limit],
    ),
    pool.query<CoachActivityRow>(
      `SELECT
         gm.id,
         g.name AS gym_name,
         gm.role,
         gm.status,
         gm.pending_email,
         u.name AS athlete_name,
         u.email AS athlete_email,
         gm.created_at AS occurred_at
       FROM gym_memberships gm
       JOIN gyms g ON g.id = gm.gym_id
       JOIN gym_memberships coach_gm ON coach_gm.gym_id = gm.gym_id
       LEFT JOIN users u ON u.id = gm.user_id
       WHERE coach_gm.user_id = $1
         AND coach_gm.role IN ('owner', 'coach')
         AND gm.role IN ('coach', 'athlete')
         AND gm.role <> 'owner'
       ORDER BY gm.created_at DESC, gm.id DESC
       LIMIT $2`,
      [userId, limit],
    ),
    pool.query<CoachActivityRow>(
      `SELECT
         ss.id,
         w.id AS workout_id,
         g.name AS gym_name,
         w.title,
         u.name AS athlete_name,
         u.email AS athlete_email,
         ss.payload,
         ss.created_at AS occurred_at
       FROM sync_snapshots ss
       JOIN users u ON u.id = ss.user_id
       JOIN workouts w
         ON w.id = CASE
           WHEN COALESCE(ss.payload->>'workoutId', '') ~ '^[0-9]+$'
             THEN (ss.payload->>'workoutId')::int
           ELSE NULL
         END
       JOIN gyms g ON g.id = w.gym_id
       JOIN gym_memberships coach_gm ON coach_gm.gym_id = w.gym_id
       WHERE coach_gm.user_id = $1
         AND coach_gm.role IN ('owner', 'coach')
         AND COALESCE(ss.payload->>'kind', '') = 'workout_result'
       ORDER BY ss.created_at DESC, ss.id DESC
       LIMIT $2`,
      [userId, limit],
    ),
  ]);

  const workoutEvents = publishedWorkouts.rows.map((row) => ({
    id: `workout-${row.id}`,
    type: "workout_published" as const,
    title: `Treino publicado${row.title ? `: ${row.title}` : ""}`,
    description: "O loop foi ativado para o gym. Agora vale acompanhar convites e retornos.",
    gymName: row.gym_name,
    relatedWorkoutId: row.workout_id ? String(row.workout_id) : null,
    occurredAt: row.occurred_at,
    emphasis: "neutral" as const,
  }));

  const membershipEvents = memberships.rows.map((row) => {
    const email = normalizeEmail(row.athlete_email || row.pending_email);
    const label = String(row.athlete_name || row.athlete_email || row.pending_email || "Membro");
    const roleLabel = row.role === "coach" ? "coach" : "atleta";

    if (row.status === "invited") {
      return {
        id: `membership-invited-${row.id}`,
        type: "membership_invited" as const,
        title: `${roleLabel === "coach" ? "Coach" : "Atleta"} convidado`,
        description: `${label}${email ? ` (${email})` : ""} recebeu convite para entrar no loop do gym.`,
        gymName: row.gym_name,
        relatedWorkoutId: null,
        occurredAt: row.occurred_at,
        emphasis: "neutral" as const,
      };
    }

    return {
      id: `membership-ready-${row.id}`,
      type: "membership_ready" as const,
      title: `${roleLabel === "coach" ? "Coach" : "Atleta"} pronto para o loop`,
      description: `${label}${email ? ` (${email})` : ""} ja pode operar dentro do gym.`,
      gymName: row.gym_name,
      relatedWorkoutId: null,
      occurredAt: row.occurred_at,
      emphasis: "positive" as const,
    };
  });

  const responseEvents = responses.rows
    .map((row) => {
      const payload = ensureObject(row.payload);
      const summary = String(payload.summary || "").trim();
      const athleteName = String(row.athlete_name || row.athlete_email || "Atleta");

      if (!summary) return null;

      return {
        id: `response-${row.id}`,
        type: "athlete_responded" as const,
        title: `${athleteName} respondeu ao treino`,
        description: summary,
        gymName: row.gym_name,
        relatedWorkoutId: row.workout_id ? String(row.workout_id) : null,
        occurredAt: row.occurred_at,
        emphasis: "positive" as const,
      };
    })
    .filter(Boolean);

  return [...workoutEvents, ...membershipEvents, ...responseEvents]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, limit);
}

export async function getCoachOnboardingSnapshot(userId: number) {
  const [user, billingStatus, entitlements, gyms, latestWorkout, recentWorkouts, activityFeed] = await Promise.all([
    pool.query<{ id: number; email: string; name: string | null; is_admin: boolean | null }>(
      `SELECT id, email, name, is_admin
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    ),
    getLatestSubscription(userId),
    getEntitlementsSnapshot(userId),
    getCoachGyms(userId),
    getLatestCoachWorkout(userId),
    listRecentCoachWorkouts(userId),
    listCoachActivityFeed(userId),
  ]);

  const primaryGym = gyms[0] || null;
  const nextStep = primaryGym
    ? latestWorkout
      ? "Treino publicado. Agora valide a experiencia do atleta."
      : "Publique o primeiro treino do seu gym."
    : "Crie o primeiro gym para iniciar o onboarding.";

  return {
    user: user.rows[0]
      ? {
          id: String(user.rows[0].id),
          email: user.rows[0].email,
          name: user.rows[0].name,
          isAdmin: !!user.rows[0].is_admin,
        }
      : null,
    billingStatus: billingStatus ? serializeSubscriptionStatus(billingStatus) : null,
    entitlements,
    gyms: gyms.map((gym) => ({
      id: gym.id,
      name: gym.name,
      slug: gym.slug,
      role: gym.role,
      status: gym.status,
    })),
    primaryGym: primaryGym
      ? {
          id: primaryGym.id,
          name: primaryGym.name,
          slug: primaryGym.slug,
          role: primaryGym.role,
          status: primaryGym.status,
        }
      : null,
    latestWorkout,
    recentWorkouts,
    activityFeed,
    canPublish: !!primaryGym,
    nextStep,
  };
}

export async function getAthleteTodayWorkout(userId: number, sportType: "cross" | "running" | "strength") {
  const result = await pool.query<{ id: number }>(
    `SELECT DISTINCT w.id
     FROM workouts w
     JOIN gym_memberships gm ON gm.gym_id = w.gym_id
     LEFT JOIN workout_assignments wa ON wa.workout_id = w.id
     WHERE gm.user_id = $1
       AND gm.status = 'active'
       AND w.sport_type = $2
       AND (wa.gym_membership_id IS NULL OR wa.gym_membership_id = gm.id)
     ORDER BY w.scheduled_date DESC, w.created_at DESC
     LIMIT 1`,
    [userId, sportType],
  );

  const workoutId = result.rows[0]?.id;
  if (typeof workoutId !== "number") return null;

  return getWorkoutSummary(workoutId);
}

export async function upsertAthleteWorkoutResult(input: {
  userId: number;
  workoutId: number;
  summary: string;
  score?: string;
  notes?: string;
  completedAt: string;
}) {
  const payload = {
    kind: "workout_result",
    workoutId: String(input.workoutId),
    summary: input.summary,
    score: input.score || "",
    notes: input.notes || "",
    completedAt: input.completedAt,
  };

  await pool.query(
    `INSERT INTO sync_snapshots (user_id, payload)
     VALUES ($1, $2::jsonb)`,
    [input.userId, JSON.stringify(payload)],
  );

  return {
    workoutId: String(input.workoutId),
    summary: input.summary,
    score: input.score || "",
    notes: input.notes || "",
    completedAt: input.completedAt,
  };
}

export async function getLatestAthleteWorkoutResult(userId: number, workoutId: number) {
  const result = await pool.query<{ payload: Record<string, unknown> | null }>(
    `SELECT payload
     FROM sync_snapshots
     WHERE user_id = $1
       AND COALESCE(payload->>'kind', '') = 'workout_result'
       AND COALESCE(payload->>'workoutId', '') = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, String(workoutId)],
  );

  const payload = ensureObject(result.rows[0]?.payload);
  if (!Object.keys(payload).length) return null;

  return {
    workoutId: String(payload.workoutId || workoutId),
    summary: String(payload.summary || ""),
    score: String(payload.score || ""),
    notes: String(payload.notes || ""),
    completedAt: String(payload.completedAt || ""),
  };
}

export async function listAthleteWorkoutResults(userId: number, limit = 8) {
  const result = await pool.query<AthleteWorkoutHistoryRow>(
    `SELECT
       ss.payload,
       w.id AS workout_id,
       w.title AS workout_title,
       g.name AS gym_name,
       w.scheduled_date
     FROM sync_snapshots ss
     LEFT JOIN workouts w
       ON w.id = CASE
         WHEN COALESCE(ss.payload->>'workoutId', '') ~ '^[0-9]+$'
           THEN (ss.payload->>'workoutId')::int
         ELSE NULL
       END
     LEFT JOIN gyms g ON g.id = w.gym_id
     WHERE ss.user_id = $1
       AND COALESCE(ss.payload->>'kind', '') = 'workout_result'
     ORDER BY ss.created_at DESC, ss.id DESC
     LIMIT $2`,
    [userId, limit],
  );

  return result.rows
    .map((row) => {
      const payload = ensureObject(row.payload);
      const workoutId = String(payload.workoutId || row.workout_id || "").trim();
      const summary = String(payload.summary || "").trim();
      const completedAt = String(payload.completedAt || "").trim();
      const workoutTitle = String(row.workout_title || "Treino publicado").trim();

      if (!workoutId || !summary || !completedAt) return null;

      return {
        workoutId,
        workoutTitle,
        gymName: row.gym_name,
        scheduledDate: row.scheduled_date || undefined,
        summary,
        score: String(payload.score || "").trim() || undefined,
        notes: String(payload.notes || "").trim() || undefined,
        completedAt,
      };
    })
    .filter(Boolean);
}
