import type { FastifyInstance } from "fastify";
import {
  athleteAppStateResponseSchema,
  athleteAppStateSnapshotSchema,
  athleteMeasurementsHistoryResponseSchema,
  athleteMeasurementsSnapshotInputSchema,
  athleteMeasurementsSnapshotResponseSchema,
  athleteOnboardingResponseSchema,
  athletePrSnapshotSchema,
  athletePrSnapshotSyncResponseSchema,
  athleteWorkoutHistoryResponseSchema,
  athleteTodayWorkoutResponseSchema,
  athleteWorkoutResultInputSchema,
  athleteWorkoutResultResponseSchema,
  importedPlanDeleteResponseSchema,
  importedPlanResponseSchema,
  importedPlanSnapshotSchema,
} from "@ryxen/contracts";
import { requireAuthenticatedUser } from "../../lib/auth";
import {
  deleteImportedPlan,
  getAthleteOnboardingSnapshot,
  getAppState,
  getImportedPlan,
  getMeasurementsHistory,
  putAppState,
  putImportedPlan,
  syncMeasurementsSnapshot,
  syncPrSnapshot,
} from "./repository";
import {
  getAthleteTodayWorkout,
  listAthleteWorkoutResults,
  getLatestAthleteWorkoutResult,
  upsertAthleteWorkoutResult,
} from "../coach/repository";
import { normalizeSportType } from "./sport-type";

export async function registerAthleteRoutes(app: FastifyInstance) {
  app.get("/athletes/me/onboarding", { preHandler: requireAuthenticatedUser }, async (request) =>
    athleteOnboardingResponseSchema.parse({
      snapshot: await getAthleteOnboardingSnapshot(request.authUser!.userId),
    }),
  );

  app.get("/athletes/me/imported-plan", { preHandler: requireAuthenticatedUser }, async (request) =>
    importedPlanResponseSchema.parse({
      importedPlan: await getImportedPlan(request.authUser!.userId),
    }),
  );

  app.put("/athletes/me/imported-plan", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const parsed = importedPlanSnapshotSchema.safeParse({
      weeks:
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>).weeks
          : undefined,
      metadata:
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>).metadata
          : undefined,
      activeWeekNumber:
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>).activeWeekNumber
          : undefined,
      updatedAt:
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>).updatedAt
          : new Date().toISOString(),
    });

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    return importedPlanResponseSchema.parse({
      importedPlan: await putImportedPlan(request.authUser!.userId, parsed.data),
    });
  });

  app.delete("/athletes/me/imported-plan", { preHandler: requireAuthenticatedUser }, async (request) =>
    importedPlanDeleteResponseSchema.parse(
      await deleteImportedPlan(request.authUser!.userId),
    ),
  );

  app.get("/athletes/me/app-state", { preHandler: requireAuthenticatedUser }, async (request) =>
    athleteAppStateResponseSchema.parse({
      appState: await getAppState(
        request.authUser!.userId,
        (request.query as Record<string, unknown> | undefined)?.sportType,
      ),
    }),
  );

  app.put("/athletes/me/app-state", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const body =
      request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
    const parsed = athleteAppStateSnapshotSchema.safeParse({
      sportType:
        body.sportType ||
        ((request.query as Record<string, unknown> | undefined)?.sportType ?? "cross"),
      snapshot: body.snapshot,
      updatedAt: body.updatedAt || new Date().toISOString(),
    });

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    return athleteAppStateResponseSchema.parse({
      appState: await putAppState(request.authUser!.userId, parsed.data),
    });
  });

  app.get("/athletes/me/measurements/history", { preHandler: requireAuthenticatedUser }, async (request) =>
    athleteMeasurementsHistoryResponseSchema.parse({
      measurements: await getMeasurementsHistory(request.authUser!.userId),
    }),
  );

  app.post(
    "/athletes/me/measurements/snapshot",
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const parsed = athleteMeasurementsSnapshotInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      return athleteMeasurementsSnapshotResponseSchema.parse(
        await syncMeasurementsSnapshot(request.authUser!.userId, parsed.data.measurements),
      );
    },
  );

  app.post("/athletes/me/prs/snapshot", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const body =
      request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
    const parsed = athletePrSnapshotSchema.safeParse(body.prs);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "prs deve ser um objeto { EXERCISE: value }",
      });
    }

    return athletePrSnapshotSyncResponseSchema.parse(
      await syncPrSnapshot(request.authUser!.userId, parsed.data),
    );
  });

  app.get("/athletes/me/today-workout", { preHandler: requireAuthenticatedUser }, async (request) => {
    const sportType = normalizeSportType(
      (request.query as Record<string, unknown> | undefined)?.sportType,
    );
    const todayWorkout = await getAthleteTodayWorkout(request.authUser!.userId, sportType);
    const submittedResult = todayWorkout
      ? await getLatestAthleteWorkoutResult(request.authUser!.userId, Number(todayWorkout.id))
      : null;

    return athleteTodayWorkoutResponseSchema.parse({
      todayWorkout,
      submittedResult,
    });
  });

  app.post("/athletes/me/workout-result", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const parsed = athleteWorkoutResultInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const submittedResult = await upsertAthleteWorkoutResult({
      userId: request.authUser!.userId,
      workoutId: Number(parsed.data.workoutId),
      summary: parsed.data.summary,
      score: parsed.data.score,
      notes: parsed.data.notes,
      completedAt: parsed.data.completedAt || new Date().toISOString(),
    });

    return athleteWorkoutResultResponseSchema.parse({
      success: true,
      submittedResult,
    });
  });

  app.get("/athletes/me/workout-results", { preHandler: requireAuthenticatedUser }, async (request) =>
    athleteWorkoutHistoryResponseSchema.parse({
      results: await listAthleteWorkoutResults(request.authUser!.userId),
    }),
  );
}
