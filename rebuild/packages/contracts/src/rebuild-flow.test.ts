import { describe, expect, it } from "vitest";
import {
  athleteOnboardingResponseSchema,
  athleteTodayWorkoutResponseSchema,
  coachOnboardingResponseSchema,
  workoutPublishInputSchema,
} from "./index";

describe("rebuild flow contracts", () => {
  it("accepts coach onboarding snapshots with latest workout delivery data", () => {
    const parsed = coachOnboardingResponseSchema.parse({
      snapshot: {
        user: {
          id: "1",
          email: "coach@ryxen.app",
          name: "Coach",
          isAdmin: false,
        },
        billingStatus: null,
        entitlements: null,
        gyms: [
          {
            id: "10",
            name: "Ryxen Gym",
            slug: "ryxen-gym",
            role: "owner",
            status: "active",
          },
        ],
        primaryGym: {
          id: "10",
          name: "Ryxen Gym",
          slug: "ryxen-gym",
          role: "owner",
          status: "active",
        },
        latestWorkout: {
          id: "44",
          gymId: "10",
          gymName: "Ryxen Gym",
          title: "Friday Engine",
          description: "Intervals and cooldown",
          sportType: "cross",
          scheduledDate: "2026-04-25",
          publishedAt: "2026-04-25T10:00:00.000Z",
          audienceMode: "selected",
          assignedCount: 2,
          resultCount: 1,
          payload: { lines: ["Warm-up", "EMOM 12"] },
          recentResponses: [
            {
              athleteName: "Ana",
              athleteEmail: "ana@ryxen.app",
              summary: "Treino concluido",
              completedAt: "2026-04-25T11:00:00.000Z",
            },
          ],
          athleteDeliveries: [
            {
              membershipId: "91",
              athleteName: "Ana",
              athleteEmail: "ana@ryxen.app",
              status: "responded",
              completedAt: "2026-04-25T11:00:00.000Z",
              summary: "Treino concluido",
            },
            {
              membershipId: "92",
              athleteName: "Bia",
              athleteEmail: "bia@ryxen.app",
              status: "pending",
            },
          ],
        },
        canPublish: true,
        nextStep: "Acompanhe os retornos do treino.",
      },
    });

    expect(parsed.snapshot.latestWorkout?.athleteDeliveries).toHaveLength(2);
    expect(parsed.snapshot.latestWorkout?.audienceMode).toBe("selected");
  });

  it("accepts athlete onboarding and today workout payloads", () => {
    const onboarding = athleteOnboardingResponseSchema.parse({
      snapshot: {
        user: {
          id: "2",
          email: "athlete@ryxen.app",
          name: "Athlete",
          isAdmin: false,
        },
        entitlements: {
          entitlements: ["athlete_app"],
          subscription: null,
          gymAccess: [
            {
              gymId: 10,
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
            gymId: 10,
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
          gymId: 10,
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
        nextStep: "O treino aparecera no Today assim que for publicado.",
      },
    });

    const today = athleteTodayWorkoutResponseSchema.parse({
      todayWorkout: {
        id: "44",
        gymId: "10",
        gymName: "Ryxen Gym",
        title: "Friday Engine",
        description: "Intervals and cooldown",
        sportType: "cross",
        scheduledDate: "2026-04-25",
        publishedAt: "2026-04-25T10:00:00.000Z",
        audienceMode: "all",
        assignedCount: 4,
        resultCount: 1,
        payload: { lines: ["Warm-up", "EMOM 12"] },
        recentResponses: [],
        athleteDeliveries: [],
      },
      submittedResult: {
        workoutId: "44",
        summary: "Treino concluido",
        score: "12+3",
        notes: "Me senti bem",
        completedAt: "2026-04-25T11:00:00.000Z",
      },
    });

    expect(onboarding.snapshot.canReceiveWorkout).toBe(true);
    expect(today.todayWorkout?.title).toBe("Friday Engine");
  });

  it("requires membership targets for selected audience shape", () => {
    const parsed = workoutPublishInputSchema.parse({
      gymId: "10",
      sportType: "cross",
      title: "Selected athletes only",
      description: "",
      scheduledDate: "2026-04-25",
      payload: { lines: ["AMRAP 10"] },
      audienceMode: "selected",
      targetMembershipIds: ["91", "92"],
      targetGroupIds: [],
    });

    expect(parsed.audienceMode).toBe("selected");
    expect(parsed.targetMembershipIds).toEqual(["91", "92"]);
  });
});
