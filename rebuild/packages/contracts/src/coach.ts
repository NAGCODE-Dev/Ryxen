import { z } from "zod";
import { userProfileSchema } from "./auth";
import { billingStatusSchema, entitlementSnapshotSchema } from "./billing";
import { sportTypeSchema, timestampSchema } from "./common";

export const gymSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  role: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const membershipSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  gymId: z.union([z.string(), z.number()]).optional(),
  email: z.string().trim().toLowerCase(),
  role: z.enum(["owner", "coach", "athlete"]),
  status: z.string().trim(),
  label: z.string().trim().optional(),
});

export const athleteGroupSchema = z.object({
  id: z.union([z.string(), z.number()]),
  gymId: z.union([z.string(), z.number()]),
  sportType: sportTypeSchema,
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  memberCount: z.number().int().nonnegative().optional(),
  members: z.array(z.record(z.any())).default([]),
});

export const workoutAudienceModeSchema = z.enum(["all", "selected", "groups"]);

export const workoutPublishInputSchema = z.object({
  gymId: z.union([z.string(), z.number()]),
  sportType: sportTypeSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  scheduledDate: z.string().trim().min(1),
  payload: z.record(z.any()),
  audienceMode: workoutAudienceModeSchema,
  targetMembershipIds: z.array(z.union([z.string(), z.number()])).default([]),
  targetGroupIds: z.array(z.union([z.string(), z.number()])).default([]),
});

export const coachWorkoutDraftSchema = z.object({
  workoutTitle: z.string().trim().default(""),
  workoutDate: z.string().trim().default(""),
  workoutBenchmarkSlug: z.string().trim().default(""),
  workoutLines: z.string().trim().default(""),
  runningSessionType: z.string().trim().default("easy"),
  runningDistanceKm: z.string().trim().default(""),
  runningDurationMin: z.string().trim().default(""),
  runningTargetPace: z.string().trim().default(""),
  runningZone: z.string().trim().default(""),
  runningNotes: z.string().trim().default(""),
  runningSegments: z.array(z.record(z.string())).default([]),
  strengthFocus: z.string().trim().default(""),
  strengthLoadGuidance: z.string().trim().default(""),
  strengthRir: z.string().trim().default(""),
  strengthRestSeconds: z.string().trim().default(""),
  strengthExercises: z.array(z.record(z.string())).default([]),
  workoutAudienceMode: workoutAudienceModeSchema.default("all"),
  targetMembershipIds: z.array(z.union([z.string(), z.number()])).default([]),
  targetGroupIds: z.array(z.union([z.string(), z.number()])).default([]),
  updatedAt: timestampSchema.optional(),
});

export const workoutSummarySchema = z.object({
  id: z.union([z.string(), z.number()]),
  gymId: z.union([z.string(), z.number()]),
  gymName: z.string().trim().nullable().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  sportType: sportTypeSchema,
  scheduledDate: z.string().trim().min(1),
  publishedAt: timestampSchema,
  audienceMode: workoutAudienceModeSchema.default("all"),
  assignedCount: z.number().int().nonnegative().default(0),
  resultCount: z.number().int().nonnegative().default(0),
  payload: z.record(z.any()).default({}),
  recentResponses: z
    .array(
      z.object({
        athleteName: z.string().trim().min(1),
        athleteEmail: z.string().trim().toLowerCase(),
        summary: z.string().trim().min(1),
        score: z.string().trim().optional(),
        notes: z.string().trim().optional(),
        completedAt: timestampSchema,
      }),
    )
    .default([]),
  athleteDeliveries: z
    .array(
      z.object({
        membershipId: z.union([z.string(), z.number()]),
        athleteName: z.string().trim().min(1),
        athleteEmail: z.string().trim().toLowerCase(),
        status: z.enum(["pending", "responded"]),
        completedAt: timestampSchema.nullable().optional(),
        summary: z.string().trim().optional(),
        score: z.string().trim().optional(),
      }),
    )
    .default([]),
});

export const coachActivityItemSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum([
    "workout_published",
    "membership_invited",
    "membership_ready",
    "athlete_responded",
  ]),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  gymName: z.string().trim().nullable().optional(),
  relatedWorkoutId: z.union([z.string(), z.number()]).nullable().optional(),
  occurredAt: timestampSchema,
  emphasis: z.enum(["positive", "neutral", "attention"]).default("neutral"),
});

export const coachOnboardingSnapshotSchema = z.object({
  user: userProfileSchema,
  billingStatus: billingStatusSchema.nullable(),
  entitlements: entitlementSnapshotSchema.nullable(),
  gyms: z.array(gymSchema).default([]),
  primaryGym: gymSchema.nullable(),
  latestWorkout: workoutSummarySchema.nullable(),
  recentWorkouts: z.array(workoutSummarySchema).default([]),
  activityFeed: z.array(coachActivityItemSchema).default([]),
  canPublish: z.boolean(),
  nextStep: z.string().trim().min(1),
});

export const coachOnboardingResponseSchema = z.object({
  snapshot: coachOnboardingSnapshotSchema,
});

export const createGymInputSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
});

export const createGymResponseSchema = z.object({
  gym: gymSchema,
});

export const coachGymsResponseSchema = z.object({
  gyms: z.array(gymSchema).default([]),
});

export const inviteMembershipInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["coach", "athlete"]).default("athlete"),
});

export const inviteMembershipResponseSchema = z.object({
  membership: membershipSchema,
});

export const gymMembershipsResponseSchema = z.object({
  memberships: z.array(membershipSchema).default([]),
});

export const membershipDeleteResponseSchema = z.object({
  success: z.literal(true),
  deletedMembershipId: z.union([z.string(), z.number()]),
});

export const workoutPublishResponseSchema = z.object({
  workout: workoutSummarySchema,
});

export const workoutUpdateInputSchema = z.object({
  gymId: z.union([z.string(), z.number()]),
  workoutId: z.union([z.string(), z.number()]),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  scheduledDate: z.string().trim().min(1),
  payload: z.record(z.any()),
});

export const workoutUpdateResponseSchema = z.object({
  workout: workoutSummarySchema,
});

export const workoutDeleteResponseSchema = z.object({
  success: z.literal(true),
  deletedWorkoutId: z.union([z.string(), z.number()]),
});
