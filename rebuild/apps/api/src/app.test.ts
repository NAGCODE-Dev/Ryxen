import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api app", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@fastify/sensible", () => ({
      default: async function sensibleMock() {
        return;
      },
    }));
    vi.doMock("@fastify/cors", () => ({
      default: async function corsMock() {
        return;
      },
    }));
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/ryxen_test";
    process.env.JWT_SECRET = "test-secret";
    process.env.PORT = "8787";
  });

  afterEach(() => {
    vi.doUnmock("@fastify/sensible");
    vi.doUnmock("@fastify/cors");
    process.env = { ...envBackup };
  });

  it("responds to health checks", async () => {
    const { buildApp } = await import("./app");
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "ryxen-rebuild-api",
    });

    await app.close();
  });

  it("rejects protected routes without bearer token", async () => {
    const { buildApp } = await import("./app");
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/coach/onboarding",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Token ausente",
    });

    await app.close();
  });

  it("publishes workouts with selected audience membership ids", async () => {
    const publishWorkout = vi.fn(async () => ({
      id: "44",
      gymId: "7",
      gymName: "Ryxen Gym",
      title: "Selected athletes only",
      description: "",
      sportType: "cross",
      scheduledDate: "2026-04-25",
      publishedAt: "2026-04-25T10:00:00.000Z",
      audienceMode: "selected" as const,
      assignedCount: 2,
      resultCount: 0,
      payload: { lines: ["AMRAP 10"] },
      recentResponses: [],
      athleteDeliveries: [],
    }));

    vi.resetModules();
    vi.doMock("@fastify/sensible", () => ({
      default: async function sensibleMock() {
        return;
      },
    }));
    vi.doMock("@fastify/cors", () => ({
      default: async function corsMock() {
        return;
      },
    }));
    vi.doMock("./lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 12,
          email: "coach@ryxen.app",
          isAdmin: false,
        };
      },
      requireAdminUser: async () => undefined,
      requireAdminOrDeveloperUser: async () => undefined,
      loadCurrentUser: async () => null,
      signCompatibleToken: async () => "token",
      toPublicUser: (value: unknown) => value,
    }));
    vi.doMock("./modules/coach/repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(async () => ({
        user: {
          id: "12",
          email: "coach@ryxen.app",
          name: "Coach",
          isAdmin: false,
        },
        billingStatus: null,
        entitlements: null,
        gyms: [],
        primaryGym: null,
        latestWorkout: null,
        recentWorkouts: [],
        canPublish: true,
        nextStep: "Publique um treino.",
      })),
      inviteGymMembership: vi.fn(),
      listGymMemberships: vi.fn(async () => []),
      publishWorkout,
      removeGymMembership: vi.fn(),
      getAthleteTodayWorkout: vi.fn(async () => null),
      getLatestAthleteWorkoutResult: vi.fn(async () => null),
      upsertAthleteWorkoutResult: vi.fn(),
      listAthleteWorkoutResults: vi.fn(async () => []),
    }));
    vi.doMock("./modules/billing/repository", () => ({
      getBillingStatusSnapshot: vi.fn(async () => null),
      getEntitlementsSnapshot: vi.fn(async () => ({
        entitlements: [],
        subscription: null,
        gymAccess: [],
      })),
      grantMockSubscription: vi.fn(),
      createCheckoutIntent: vi.fn(),
    }));
    vi.doMock("./modules/athletes/repository", () => ({
      deleteImportedPlan: vi.fn(),
      getAthleteOnboardingSnapshot: vi.fn(async () => ({
        user: {
          id: "22",
          email: "athlete@ryxen.app",
          name: "Athlete",
          isAdmin: false,
        },
        entitlements: null,
        gyms: [],
        primaryGym: null,
        canReceiveWorkout: false,
        nextStep: "Aguardando convite.",
      })),
      getAppState: vi.fn(async () => null),
      getImportedPlan: vi.fn(async () => null),
      getMeasurementsHistory: vi.fn(async () => []),
      putAppState: vi.fn(),
      putImportedPlan: vi.fn(),
      syncMeasurementsSnapshot: vi.fn(),
      syncPrSnapshot: vi.fn(),
    }));

    const { buildApp } = await import("./app");
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/gyms/7/workouts",
      headers: {
        authorization: "Bearer fake-token",
      },
      payload: {
        sportType: "cross",
        title: "Selected athletes only",
        description: "",
        scheduledDate: "2026-04-25",
        payload: { lines: ["AMRAP 10"] },
        audienceMode: "selected",
        targetMembershipIds: ["91", "92"],
        targetGroupIds: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(publishWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 12,
        gymId: 7,
        audienceMode: "selected",
        targetMembershipIds: [91, 92],
      }),
    );
    expect(response.json().workout.audienceMode).toBe("selected");

    await app.close();
  });

  it("returns athlete onboarding snapshot for authenticated athlete", async () => {
    const getAthleteOnboardingSnapshot = vi.fn(async () => ({
      user: {
        id: "22",
        email: "athlete@ryxen.app",
        name: "Athlete",
        isAdmin: false,
      },
      entitlements: {
        entitlements: ["athlete_app"],
        subscription: null,
        gymAccess: [
          {
            gymId: 7,
            gymName: "Ryxen Gym",
            role: "athlete",
            status: "active",
            canCoachManage: false,
            canAthletesUseApp: true,
            warning: null,
            accessTier: "active",
            daysRemaining: 30,
          },
        ],
      },
      gyms: [
        {
          gymId: 7,
          gymName: "Ryxen Gym",
          role: "athlete",
          status: "active",
          canCoachManage: false,
          canAthletesUseApp: true,
          warning: null,
          accessTier: "active",
          daysRemaining: 30,
        },
      ],
      primaryGym: {
        gymId: 7,
        gymName: "Ryxen Gym",
        role: "athlete",
        status: "active",
        canCoachManage: false,
        canAthletesUseApp: true,
        warning: null,
        accessTier: "active",
        daysRemaining: 30,
      },
      canReceiveWorkout: true,
      nextStep: "O treino aparecera no Today.",
    }));

    vi.resetModules();
    vi.doMock("@fastify/sensible", () => ({
      default: async function sensibleMock() {
        return;
      },
    }));
    vi.doMock("@fastify/cors", () => ({
      default: async function corsMock() {
        return;
      },
    }));
    vi.doMock("./lib/auth", () => ({
      requireAuthenticatedUser: async (request: { authUser?: unknown }) => {
        request.authUser = {
          userId: 22,
          email: "athlete@ryxen.app",
          isAdmin: false,
        };
      },
      requireAdminUser: async () => undefined,
      requireAdminOrDeveloperUser: async () => undefined,
      loadCurrentUser: async () => null,
      signCompatibleToken: async () => "token",
      toPublicUser: (value: unknown) => value,
    }));
    vi.doMock("./modules/coach/repository", () => ({
      createCoachGym: vi.fn(),
      getCoachGyms: vi.fn(async () => []),
      getCoachOnboardingSnapshot: vi.fn(async () => ({
        user: null,
        billingStatus: null,
        entitlements: null,
        gyms: [],
        primaryGym: null,
        latestWorkout: null,
        recentWorkouts: [],
        canPublish: false,
        nextStep: "",
      })),
      inviteGymMembership: vi.fn(),
      listGymMemberships: vi.fn(async () => []),
      publishWorkout: vi.fn(),
      removeGymMembership: vi.fn(),
      getAthleteTodayWorkout: vi.fn(async () => null),
      getLatestAthleteWorkoutResult: vi.fn(async () => null),
      upsertAthleteWorkoutResult: vi.fn(),
      listAthleteWorkoutResults: vi.fn(async () => []),
    }));
    vi.doMock("./modules/billing/repository", () => ({
      getBillingStatusSnapshot: vi.fn(async () => null),
      getEntitlementsSnapshot: vi.fn(async () => ({
        entitlements: [],
        subscription: null,
        gymAccess: [],
      })),
      grantMockSubscription: vi.fn(),
      createCheckoutIntent: vi.fn(),
    }));
    vi.doMock("./modules/athletes/repository", () => ({
      deleteImportedPlan: vi.fn(),
      getAthleteOnboardingSnapshot,
      getAppState: vi.fn(async () => null),
      getImportedPlan: vi.fn(async () => null),
      getMeasurementsHistory: vi.fn(async () => []),
      putAppState: vi.fn(),
      putImportedPlan: vi.fn(),
      syncMeasurementsSnapshot: vi.fn(),
      syncPrSnapshot: vi.fn(),
    }));

    const { buildApp } = await import("./app");
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/athletes/me/onboarding",
      headers: {
        authorization: "Bearer fake-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(getAthleteOnboardingSnapshot).toHaveBeenCalledWith(22);
    expect(response.json().snapshot.canReceiveWorkout).toBe(true);
    expect(response.json().snapshot.primaryGym.gymName).toBe("Ryxen Gym");

    await app.close();
  });
});
