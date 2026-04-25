import type { FastifyInstance } from "fastify";
import {
  coachOnboardingResponseSchema,
  coachWorkoutDraftSchema,
  coachGymsResponseSchema,
  createGymInputSchema,
  createGymResponseSchema,
  gymMembershipsResponseSchema,
  inviteMembershipInputSchema,
  inviteMembershipResponseSchema,
  membershipDeleteResponseSchema,
  workoutPublishInputSchema,
  workoutPublishResponseSchema,
  workoutDeleteResponseSchema,
  workoutUpdateInputSchema,
  workoutUpdateResponseSchema,
} from "@ryxen/contracts";
import { requireAuthenticatedUser } from "../../lib/auth";
import {
  createCoachGym,
  getCoachGyms,
  getCoachOnboardingSnapshot,
  inviteGymMembership,
  listGymMemberships,
  publishWorkout,
  removeGymMembership,
  removeWorkout,
  updateWorkout,
} from "./repository";

export async function registerCoachRoutes(app: FastifyInstance) {
  app.get("/coach/onboarding", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const snapshot = await getCoachOnboardingSnapshot(request.authUser!.userId);
    if (!snapshot.user) {
      return reply.status(404).send({ error: "Usuario nao encontrado" });
    }

    return coachOnboardingResponseSchema.parse({ snapshot });
  });

  app.get("/gyms/me", { preHandler: requireAuthenticatedUser }, async (request) =>
    coachGymsResponseSchema.parse({
      gyms: await getCoachGyms(request.authUser!.userId),
    }),
  );

  app.post("/gyms", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const parsed = createGymInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const gym = await createCoachGym({
        userId: request.authUser!.userId,
        name: parsed.data.name,
        ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
      });

      return createGymResponseSchema.parse({ gym });
    } catch (error) {
      return reply.status(409).send({
        error: error instanceof Error ? error.message : "Nao foi possivel criar o gym",
      });
    }
  });

  app.get("/gyms/:gymId/memberships", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    try {
      const memberships = await listGymMemberships(
        request.authUser!.userId,
        Number((request.params as Record<string, unknown>).gymId),
      );

      return gymMembershipsResponseSchema.parse({ memberships });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Nao foi possivel carregar memberships",
      });
    }
  });

  app.post("/gyms/:gymId/memberships", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const parsed = inviteMembershipInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const membership = await inviteGymMembership({
        userId: request.authUser!.userId,
        gymId: Number((request.params as Record<string, unknown>).gymId),
        email: parsed.data.email,
        role: parsed.data.role,
      });

      return inviteMembershipResponseSchema.parse({ membership });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Nao foi possivel convidar o atleta",
      });
    }
  });

  app.delete(
    "/gyms/:gymId/memberships/:membershipId",
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      try {
        const result = await removeGymMembership({
          userId: request.authUser!.userId,
          gymId: Number((request.params as Record<string, unknown>).gymId),
          membershipId: Number((request.params as Record<string, unknown>).membershipId),
        });

        return membershipDeleteResponseSchema.parse(result);
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Nao foi possivel remover a membership",
        });
      }
    },
  );

  app.post("/gyms/:gymId/workouts", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const body =
      request.body && typeof request.body === "object"
        ? (request.body as Record<string, unknown>)
        : {};
    const parsed = workoutPublishInputSchema.safeParse({
      gymId: Number((request.params as Record<string, unknown>).gymId),
      sportType: body.sportType,
      title: body.title,
      description: body.description,
      scheduledDate: body.scheduledDate,
      payload: body.payload,
      audienceMode: body.audienceMode,
      targetMembershipIds: body.targetMembershipIds,
      targetGroupIds: body.targetGroupIds,
    });

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const workout = await publishWorkout({
        userId: request.authUser!.userId,
        gymId: Number(parsed.data.gymId),
        sportType: parsed.data.sportType,
        title: parsed.data.title,
        description: parsed.data.description,
        scheduledDate: parsed.data.scheduledDate,
        payload: parsed.data.payload,
        audienceMode: parsed.data.audienceMode,
        targetMembershipIds: parsed.data.targetMembershipIds.map(Number),
        targetGroupIds: parsed.data.targetGroupIds.map(Number),
      });

      return workoutPublishResponseSchema.parse({ workout });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Nao foi possivel publicar o treino",
      });
    }
  });

  app.put(
    "/gyms/:gymId/workouts/:workoutId",
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const body =
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>)
          : {};
      const params = request.params as Record<string, unknown>;
      const parsed = workoutUpdateInputSchema.safeParse({
        gymId: Number(params.gymId),
        workoutId: Number(params.workoutId),
        title: body.title,
        description: body.description,
        scheduledDate: body.scheduledDate,
        payload: body.payload,
      });

      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      try {
        const workout = await updateWorkout({
          userId: request.authUser!.userId,
          gymId: Number(parsed.data.gymId),
          workoutId: Number(parsed.data.workoutId),
          title: parsed.data.title,
          description: parsed.data.description,
          scheduledDate: parsed.data.scheduledDate,
          payload: parsed.data.payload,
        });

        return workoutUpdateResponseSchema.parse({ workout });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Nao foi possivel atualizar o treino",
        });
      }
    },
  );

  app.delete(
    "/gyms/:gymId/workouts/:workoutId",
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const params = request.params as Record<string, unknown>;

      try {
        const result = await removeWorkout({
          userId: request.authUser!.userId,
          gymId: Number(params.gymId),
          workoutId: Number(params.workoutId),
        });

        return workoutDeleteResponseSchema.parse(result);
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Nao foi possivel remover o treino",
        });
      }
    },
  );

  app.post("/coach/draft/validate", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const parsed = coachWorkoutDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    return {
      valid: true,
      draft: parsed.data,
    };
  });
}
