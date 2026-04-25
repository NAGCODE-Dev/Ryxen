import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("coach routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists gym memberships for the authenticated coach", async () => {
    const listGymMemberships = vi.fn(async () => [
      {
        id: "91",
        gymId: "7",
        email: "athlete@ryxen.app",
        label: "Athlete",
        role: "athlete",
        status: "active",
      },
      {
        id: "92",
        gymId: "7",
        email: "coach@ryxen.app",
        label: "Coach",
        role: "coach",
        status: "active",
      },
    ]);

    vi.doMock("../../lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 12,
          email: "coach@ryxen.app",
          isAdmin: false,
        };
      },
    }));
    vi.doMock("./repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(),
      inviteGymMembership: vi.fn(),
      listGymMemberships,
      publishWorkout: vi.fn(),
      removeGymMembership: vi.fn(),
      removeWorkout: vi.fn(),
    }));

    const { registerCoachRoutes } = await import("./routes");
    const app = Fastify();
    app.decorateRequest("authUser", null);
    await registerCoachRoutes(app);

    const response = await app.inject({
      method: "GET",
      url: "/gyms/7/memberships",
      headers: {
        authorization: "Bearer fake-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(listGymMemberships).toHaveBeenCalledWith(12, 7);
    expect(response.json().memberships).toHaveLength(2);

    await app.close();
  });

  it("invites a new athlete membership for a gym", async () => {
    const inviteGymMembership = vi.fn(async () => ({
      id: "101",
      gymId: "7",
      email: "new-athlete@ryxen.app",
      label: "new-athlete@ryxen.app",
      role: "athlete",
      status: "invited",
    }));

    vi.doMock("../../lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 12,
          email: "coach@ryxen.app",
          isAdmin: false,
        };
      },
    }));
    vi.doMock("./repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(),
      inviteGymMembership,
      listGymMemberships: vi.fn(async () => []),
      publishWorkout: vi.fn(),
      removeGymMembership: vi.fn(),
      removeWorkout: vi.fn(),
    }));

    const { registerCoachRoutes } = await import("./routes");
    const app = Fastify();
    app.decorateRequest("authUser", null);
    await registerCoachRoutes(app);

    const response = await app.inject({
      method: "POST",
      url: "/gyms/7/memberships",
      headers: {
        authorization: "Bearer fake-token",
      },
      payload: {
        email: "NEW-ATHLETE@RYXEN.APP",
        role: "athlete",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(inviteGymMembership).toHaveBeenCalledWith({
      userId: 12,
      gymId: 7,
      email: "new-athlete@ryxen.app",
      role: "athlete",
    });
    expect(response.json().membership.status).toBe("invited");

    await app.close();
  });

  it("removes a membership from the gym", async () => {
    const removeGymMembership = vi.fn(async () => ({
      success: true,
      deletedMembershipId: "101",
    }));

    vi.doMock("../../lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 12,
          email: "coach@ryxen.app",
          isAdmin: false,
        };
      },
    }));
    vi.doMock("./repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(),
      inviteGymMembership: vi.fn(),
      listGymMemberships: vi.fn(async () => []),
      publishWorkout: vi.fn(),
      removeGymMembership,
      removeWorkout: vi.fn(),
    }));

    const { registerCoachRoutes } = await import("./routes");
    const app = Fastify();
    app.decorateRequest("authUser", null);
    await registerCoachRoutes(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/gyms/7/memberships/101",
      headers: {
        authorization: "Bearer fake-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(removeGymMembership).toHaveBeenCalledWith({
      userId: 12,
      gymId: 7,
      membershipId: 101,
    });
    expect(response.json()).toEqual({
      success: true,
      deletedMembershipId: "101",
    });

    await app.close();
  });

  it("updates a published workout for the gym", async () => {
    const updateWorkout = vi.fn(async () => ({
      id: "44",
      gymId: "7",
      gymName: "Ryxen Gym",
      title: "Friday Engine Updated",
      description: "Updated intervals",
      sportType: "cross",
      scheduledDate: "2026-04-26",
      publishedAt: "2026-04-25T10:00:00.000Z",
      audienceMode: "all" as const,
      assignedCount: 3,
      resultCount: 1,
      payload: { lines: ["Warm-up", "AMRAP 14"] },
      recentResponses: [],
      athleteDeliveries: [],
    }));

    vi.doMock("../../lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 12,
          email: "coach@ryxen.app",
          isAdmin: false,
        };
      },
    }));
    vi.doMock("./repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(),
      inviteGymMembership: vi.fn(),
      listGymMemberships: vi.fn(async () => []),
      publishWorkout: vi.fn(),
      updateWorkout,
      removeGymMembership: vi.fn(),
      removeWorkout: vi.fn(),
    }));

    const { registerCoachRoutes } = await import("./routes");
    const app = Fastify();
    app.decorateRequest("authUser", null);
    await registerCoachRoutes(app);

    const response = await app.inject({
      method: "PUT",
      url: "/gyms/7/workouts/44",
      headers: {
        authorization: "Bearer fake-token",
      },
      payload: {
        title: "Friday Engine Updated",
        description: "Updated intervals",
        scheduledDate: "2026-04-26",
        payload: { lines: ["Warm-up", "AMRAP 14"] },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(updateWorkout).toHaveBeenCalledWith({
      userId: 12,
      gymId: 7,
      workoutId: 44,
      title: "Friday Engine Updated",
      description: "Updated intervals",
      scheduledDate: "2026-04-26",
      payload: { lines: ["Warm-up", "AMRAP 14"] },
    });
    expect(response.json().workout.title).toBe("Friday Engine Updated");

    await app.close();
  });

  it("removes a published workout from the gym", async () => {
    const removeWorkout = vi.fn(async () => ({
      success: true,
      deletedWorkoutId: "44",
    }));

    vi.doMock("../../lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 12,
          email: "coach@ryxen.app",
          isAdmin: false,
        };
      },
    }));
    vi.doMock("./repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(),
      inviteGymMembership: vi.fn(),
      listGymMemberships: vi.fn(async () => []),
      publishWorkout: vi.fn(),
      updateWorkout: vi.fn(),
      removeGymMembership: vi.fn(),
      removeWorkout,
    }));

    const { registerCoachRoutes } = await import("./routes");
    const app = Fastify();
    app.decorateRequest("authUser", null);
    await registerCoachRoutes(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/gyms/7/workouts/44",
      headers: {
        authorization: "Bearer fake-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(removeWorkout).toHaveBeenCalledWith({
      userId: 12,
      gymId: 7,
      workoutId: 44,
    });
    expect(response.json()).toEqual({
      success: true,
      deletedWorkoutId: "44",
    });

    await app.close();
  });
});
