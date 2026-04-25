import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import {
  authCodeDeliveryResponseSchema,
  authMeResponseSchema,
  authSessionSchema,
  passwordResetConfirmResponseSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signInInputSchema,
  signOutResponseSchema,
  signUpConfirmSchema,
  signUpRequestSchema,
} from "@ryxen/contracts";
import { DEV_EMAILS } from "../../config";
import {
  loadCurrentUser,
  requireAuthenticatedUser,
  signCompatibleToken,
  toPublicUser,
} from "../../lib/auth";
import { pool } from "../../lib/db";

const PASSWORD_HASH_ROUNDS = 10;
const SIGNUP_CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 15 * 60 * 1000;

type SignInUserRow = {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean | null;
  password_hash: string;
};

type VerificationRow = {
  id: number;
  email: string;
  name: string | null;
  password_hash: string;
  code_hash: string;
  expires_at: string;
};

type PasswordResetRow = {
  id: number;
  code_hash: string;
  expires_at: string;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function generateCode() {
  return String(randomInt(100000, 1000000));
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function isExpired(value: string) {
  return new Date(value).getTime() < Date.now();
}

function shouldExposePreviewCode(email: string) {
  return process.env.NODE_ENV !== "production" || DEV_EMAILS.includes(email);
}

async function countUsers() {
  const result = await pool.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM users`);
  return Number(result.rows[0]?.total || 0);
}

async function findUserByEmail(email: string) {
  const result = await pool.query<SignInUserRow>(
    `SELECT id, email, name, is_admin, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  return result.rows[0] || null;
}

async function attachPendingMembershipsToUser(userId: number, email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  await pool.query(
    `WITH matched AS (
       SELECT
         id,
         ROW_NUMBER() OVER (
           PARTITION BY gym_id
           ORDER BY created_at ASC, id ASC
         ) AS row_number
       FROM gym_memberships
       WHERE LOWER(pending_email) = LOWER($2)
         AND user_id IS NULL
     ),
     promoted AS (
       UPDATE gym_memberships gm
       SET user_id = $1,
           pending_email = NULL,
           status = 'active'
       FROM matched
       WHERE gm.id = matched.id
         AND matched.row_number = 1
       RETURNING gm.id
     )
     DELETE FROM gym_memberships gm
     USING matched
     WHERE gm.id = matched.id
       AND matched.row_number > 1`,
    [userId, normalizedEmail],
  );
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/signup", async (request, reply) => {
    const parsed = signUpRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: "Email ja cadastrado" });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_ROUNDS);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + SIGNUP_CODE_TTL_MS).toISOString();

    await pool.query(
      `UPDATE email_verification_tokens
       SET consumed_at = NOW()
       WHERE email = $1
         AND purpose = 'signup'
         AND consumed_at IS NULL`,
      [email],
    );

    await pool.query(
      `INSERT INTO email_verification_tokens (email, purpose, name, password_hash, code_hash, expires_at)
       VALUES ($1, 'signup', $2, $3, $4, $5)`,
      [email, parsed.data.name || null, passwordHash, hashCode(code), expiresAt],
    );

    return authCodeDeliveryResponseSchema.parse({
      success: true,
      message: "Codigo de verificacao gerado para concluir o cadastro.",
      previewCode: shouldExposePreviewCode(email) ? code : undefined,
    });
  });

  app.post("/signup/confirm", async (request, reply) => {
    const parsed = signUpConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const verificationRes = await pool.query<VerificationRow>(
      `SELECT id, email, name, password_hash, code_hash, expires_at
       FROM email_verification_tokens
       WHERE email = $1
         AND purpose = 'signup'
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    );

    const verification = verificationRes.rows[0] || null;
    if (!verification || isExpired(verification.expires_at) || verification.code_hash !== hashCode(parsed.data.code)) {
      return reply.status(400).send({ error: "Codigo de verificacao invalido ou expirado" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: "Email ja cadastrado" });
    }

    const shouldBeAdmin = (await countUsers()) === 0;
    const inserted = await pool.query<{
      id: number;
      email: string;
      name: string | null;
      is_admin: boolean | null;
    }>(
      `INSERT INTO users (email, password_hash, name, is_admin, email_verified, email_verified_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       RETURNING id, email, name, is_admin`,
      [email, verification.password_hash, verification.name || null, shouldBeAdmin],
    );

    await pool.query(
      `UPDATE email_verification_tokens
       SET consumed_at = NOW()
       WHERE email = $1
         AND purpose = 'signup'
         AND consumed_at IS NULL`,
      [email],
    );

    const user = inserted.rows[0];
    if (!user) {
      return reply.status(500).send({ error: "Nao foi possivel concluir o cadastro" });
    }
    await attachPendingMembershipsToUser(user.id, user.email);
    return authSessionSchema.parse({
      token: await signCompatibleToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        isAdmin: !!user.is_admin,
      }),
      user: toPublicUser(user),
      trustedDevice: null,
    });
  });

  app.post("/signin", async (request, reply) => {
    const parsed = signInInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const user = await findUserByEmail(email);
    if (!user) {
      return reply.status(401).send({ error: "Credenciais invalidas" });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: "Credenciais invalidas" });
    }

    await attachPendingMembershipsToUser(user.id, user.email);
    return authSessionSchema.parse({
      token: await signCompatibleToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        isAdmin: !!user.is_admin,
      }),
      user: toPublicUser(user),
      trustedDevice: null,
    });
  });

  app.post("/password-reset/request", async (request, reply) => {
    const parsed = passwordResetRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const user = await findUserByEmail(email);
    if (!user) {
      return authCodeDeliveryResponseSchema.parse({
        success: true,
        message: "Se o email existir, um codigo de recuperacao sera gerado.",
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS).toISOString();

    await pool.query(
      `UPDATE password_reset_tokens
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND consumed_at IS NULL`,
      [user.id],
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashCode(code), expiresAt],
    );

    return authCodeDeliveryResponseSchema.parse({
      success: true,
      message: "Codigo de recuperacao gerado.",
      previewCode: shouldExposePreviewCode(email) ? code : undefined,
    });
  });

  app.post("/password-reset/confirm", async (request, reply) => {
    const parsed = passwordResetConfirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);
    const user = await findUserByEmail(email);
    if (!user) {
      return reply.status(400).send({ error: "Codigo de recuperacao invalido ou expirado" });
    }

    const tokenRes = await pool.query<PasswordResetRow>(
      `SELECT id, code_hash, expires_at
       FROM password_reset_tokens
       WHERE user_id = $1
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );

    const token = tokenRes.rows[0] || null;
    if (!token || isExpired(token.expires_at) || token.code_hash !== hashCode(parsed.data.code)) {
      return reply.status(400).send({ error: "Codigo de recuperacao invalido ou expirado" });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_ROUNDS);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
    await pool.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`, [token.id]);

    return passwordResetConfirmResponseSchema.parse({ success: true });
  });

  app.get("/me", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const user = await loadCurrentUser(request.authUser!.userId);
    if (!user) {
      return reply.status(404).send({ error: "Usuario nao encontrado" });
    }

    return authMeResponseSchema.parse({
      user: toPublicUser(user),
    });
  });

  app.post("/refresh", { preHandler: requireAuthenticatedUser }, async (request, reply) => {
    const user = await loadCurrentUser(request.authUser!.userId);
    if (!user) {
      return reply.status(401).send({ error: "Usuario nao encontrado" });
    }

    return authSessionSchema.parse({
      token: await signCompatibleToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        isAdmin: !!user.is_admin,
      }),
      user: toPublicUser(user),
      trustedDevice: null,
    });
  });

  app.post("/signout", { preHandler: requireAuthenticatedUser }, async () =>
    signOutResponseSchema.parse({
      success: true,
    }),
  );
}
