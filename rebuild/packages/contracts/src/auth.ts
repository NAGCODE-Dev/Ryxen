import { z } from "zod";
import { emailSchema, timestampSchema } from "./common";

export const userProfileSchema = z.object({
  id: z.string(),
  email: emailSchema,
  name: z.string().trim().nullable().optional(),
  isAdmin: z.boolean().default(false),
});

export const trustedDeviceGrantSchema = z.object({
  deviceId: z.string().min(1),
  trustedToken: z.string().min(1),
  expiresAt: timestampSchema,
  label: z.string().trim().nullable().optional(),
});

export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  deviceId: z.string().trim().optional(),
  deviceLabel: z.string().trim().optional(),
});

export const signUpRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  name: z.string().trim().optional(),
  deviceId: z.string().trim().optional(),
  deviceLabel: z.string().trim().optional(),
});

export const signUpConfirmSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(4),
  deviceId: z.string().trim().optional(),
  deviceLabel: z.string().trim().optional(),
});

export const authSessionSchema = z.object({
  token: z.string().min(1),
  user: userProfileSchema,
  trustedDevice: trustedDeviceGrantSchema.nullable().optional(),
});

export const authMeResponseSchema = z.object({
  user: userProfileSchema,
});

export const authCodeDeliveryResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().trim().min(1),
  previewCode: z.string().trim().optional(),
});

export const signOutResponseSchema = z.object({
  success: z.literal(true),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  deviceId: z.string().trim().optional(),
  deviceLabel: z.string().trim().optional(),
});

export const passwordResetConfirmSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(4),
  password: z.string().min(8),
  trustedDeviceToken: z.string().trim().optional(),
});

export const passwordResetConfirmResponseSchema = z.object({
  success: z.literal(true),
});
