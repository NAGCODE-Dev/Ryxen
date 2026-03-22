import express from 'express';
import bcrypt from 'bcryptjs';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { pool } from '../db.js';
import { ADMIN_EMAILS, EXPOSE_RESET_CODE, GOOGLE_CLIENT_ID, SUPPORT_EMAIL } from '../config.js';
import { isDeveloperEmail, normalizeEmail } from '../devAccess.js';
import { authRequired, signToken } from '../auth.js';
import { getAuthCodeDeliveryCapability, sendPasswordResetEmail, sendSignupVerificationEmail } from '../mailer.js';
import { logOpsEvent } from '../opsEvents.js';
import { generateResetCode, hashResetCode, isResetCodeExpired } from '../passwordReset.js';
import { captureBackendError } from '../sentry.js';
import { attachPendingMembershipsToUser } from '../utils/gymUtils.js';
import { attachPendingBillingClaimsToUser } from '../utils/subscriptionBilling.js';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

async function withUserBootstrap(normalizedEmail, factory) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [904001]);
    const existingCount = await client.query('SELECT EXISTS(SELECT 1 FROM users) AS has_users');
    const shouldBeAdmin = !existingCount.rows[0]?.has_users || ADMIN_EMAILS.includes(normalizedEmail);
    const result = await factory(client, shouldBeAdmin);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createAuthRouter({ authRateLimit, resetRateLimit }) {
  const router = express.Router();

  router.post('/signup', authRateLimit, async (req, res) => {
    return requestSignupVerification(req, res);
  });

  router.post('/signup/request-code', authRateLimit, async (req, res) => {
    return requestSignupVerification(req, res);
  });

  router.post('/signup/confirm', authRateLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ error: 'email e code são obrigatórios' });
    }

    const tokenRow = await pool.query(
      `SELECT id, email, name, password_hash, code_hash, expires_at
       FROM email_verification_tokens
       WHERE email = $1
         AND purpose = 'signup'
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    );

    const verification = tokenRow.rows[0] || null;
    if (!verification) {
      return res.status(400).json({ error: 'Nenhum código ativo encontrado para este email' });
    }

    if (isResetCodeExpired(verification.expires_at)) {
      return res.status(400).json({ error: 'Código expirado' });
    }

    if (hashResetCode(code) !== verification.code_hash) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    try {
      const inserted = await withUserBootstrap(email, async (client, shouldBeAdmin) => {
        const existing = await client.query(
          `SELECT id, email, name, is_admin, email_verified, email_verified_at
           FROM users
           WHERE email = $1
           LIMIT 1`,
          [email],
        );
        if (existing.rows[0]) {
          const conflict = new Error('Email já cadastrado');
          conflict.code = 'duplicate_email';
          throw conflict;
        }

        return client.query(
          `INSERT INTO users (email, password_hash, name, is_admin, email_verified, email_verified_at)
           VALUES ($1,$2,$3,$4,TRUE,NOW())
           RETURNING id, email, name, is_admin, email_verified, email_verified_at`,
          [email, verification.password_hash, verification.name || null, shouldBeAdmin],
        );
      });

      await pool.query(
        `UPDATE email_verification_tokens
         SET consumed_at = NOW()
         WHERE email = $1
           AND purpose = 'signup'
           AND consumed_at IS NULL`,
        [email],
      );

      const user = inserted.rows[0];
      await attachPendingMembershipsToUser(user.id, user.email);
      await attachPendingBillingClaimsToUser(user.id, user.email);
      const token = signToken(user);
      return res.json({ token, user });
    } catch (error) {
      captureBackendError(error, {
        tags: { feature: 'auth', source: 'signup_confirm' },
        email,
      });
      if (error?.code === 'duplicate_email' || String(error?.message || '').includes('duplicate key')) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }
      console.error('[signup/confirm] failed', error);
      return res.status(500).json({ error: 'Erro ao confirmar cadastro' });
    }
  });

  router.post('/signin', authRateLimit, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email e password são obrigatórios' });
    }

    const found = await pool.query(
      `SELECT id, email, name, password_hash, is_admin, email_verified, email_verified_at
       FROM users
       WHERE email = $1`,
      [normalizeEmail(email)],
    );

    const user = found.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(String(password), user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      email_verified: user.email_verified,
      email_verified_at: user.email_verified_at,
    };
    await attachPendingMembershipsToUser(user.id, user.email);
    await attachPendingBillingClaimsToUser(user.id, user.email);
    const token = signToken(safeUser);
    return res.json({ token, user: safeUser });
  });

  router.post('/google', authRateLimit, async (req, res) => {
    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      return res.status(400).json({ error: 'credential é obrigatório' });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google Sign-In não configurado no servidor' });
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(credential);
    } catch (error) {
      return res.status(401).json({ error: error?.message || 'Token Google inválido' });
    }

    const email = normalizeEmail(payload.email);
    const name = String(payload.name || '').trim() || null;
    if (!email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'Conta Google sem email verificado' });
    }

    try {
      let user = await findUserByEmail(email);

      if (!user) {
        const fallbackPassword = await bcrypt.hash(`google-oauth:${payload.sub}:${Date.now()}`, 10);
        const inserted = await withUserBootstrap(email, async (client, shouldBeAdmin) => {
          return client.query(
            `INSERT INTO users (email, password_hash, name, is_admin, email_verified, email_verified_at)
             VALUES ($1,$2,$3,$4,TRUE,NOW())
             RETURNING id, email, name, is_admin, email_verified, email_verified_at`,
            [email, fallbackPassword, name, shouldBeAdmin],
          );
        });
        user = inserted.rows[0];
      } else if (!user.name && name) {
        const updated = await pool.query(
          `UPDATE users
           SET name = COALESCE(name, $2),
               email_verified = TRUE,
               email_verified_at = COALESCE(email_verified_at, NOW())
           WHERE id = $1
           RETURNING id, email, name, is_admin, email_verified, email_verified_at`,
          [user.id, name],
        );
        user = updated.rows[0] || user;
      } else if (!user.email_verified) {
        const updated = await pool.query(
          `UPDATE users
           SET email_verified = TRUE,
               email_verified_at = COALESCE(email_verified_at, NOW())
           WHERE id = $1
           RETURNING id, email, name, is_admin, email_verified, email_verified_at`,
          [user.id],
        );
        user = updated.rows[0] || user;
      }

      await attachPendingMembershipsToUser(user.id, user.email);
      await attachPendingBillingClaimsToUser(user.id, user.email);
      const token = signToken(user);
      return res.json({ token, user });
    } catch (error) {
      captureBackendError(error, {
        tags: { feature: 'auth', source: 'google_signin' },
        email,
      });
      console.error('[auth/google] failed', error);
      return res.status(500).json({ error: 'Erro ao entrar com Google' });
    }
  });

  router.post('/refresh', authRequired, async (req, res) => {
    const found = await pool.query(
      `SELECT id, email, name, is_admin, email_verified, email_verified_at
       FROM users
       WHERE id = $1`,
      [req.user.userId],
    );
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    await attachPendingBillingClaimsToUser(user.id, user.email);
    return res.json({ token: signToken(user), user });
  });

  router.get('/me', authRequired, async (req, res) => {
    const found = await pool.query(
      `SELECT id, email, name, is_admin, email_verified, email_verified_at
       FROM users
       WHERE id = $1`,
      [req.user.userId],
    );
    const user = found.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    return res.json({ user });
  });

  router.post('/request-password-reset', resetRateLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'email é obrigatório' });
    }

    const deliveryCapability = await getAuthCodeDeliveryCapability(email);
    if (!deliveryCapability.canSendCode) {
      return res.status(503).json({
        error: 'O envio real de email não está configurado. Configure SMTP para recuperar a senha.',
        supportEmail: SUPPORT_EMAIL,
      });
    }

    const found = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email]);
    const user = found.rows[0];
    if (!user) {
      await logOpsEvent({
        kind: 'password_reset_request',
        status: 'ignored_no_user',
        email,
        payload: { reason: 'user_not_found' },
      });
      return res.json({ success: true, message: 'Se o email existir, o código será gerado.' });
    }

    const code = generateResetCode();
    const codeHash = hashResetCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await pool.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL`, [user.id]);
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, codeHash, expiresAt],
    );

    await logOpsEvent({
      kind: 'password_reset_request',
      status: 'created',
      userId: user.id,
      email,
      payload: { expiresAt },
    });

    const response = {
      success: true,
      message: 'Se o email estiver cadastrado, você receberá um código de recuperação.',
      supportEmail: SUPPORT_EMAIL,
      cooldownSeconds: 30,
    };

    try {
      const mailInfo = await sendPasswordResetEmail({ to: email, code, userId: user.id });
      response.deliveryStatus = 'sent';
      if (isDeveloperEmail(email)) {
        response.delivery = {
          transport: mailInfo.transport,
          previewUrl: mailInfo.previewUrl,
        };
        if (mailInfo.previewUrl) response.deliveryStatus = 'preview';
      }

      await logOpsEvent({
        kind: 'password_reset_email',
        status: response.deliveryStatus,
        userId: user.id,
        email,
        payload: {
          messageId: mailInfo.messageId,
          transport: mailInfo.transport,
          durationMs: mailInfo.durationMs || null,
          previewUrl: isDeveloperEmail(email) ? (mailInfo.previewUrl || null) : null,
        },
      });
    } catch (error) {
      captureBackendError(error, {
        tags: { feature: 'auth', source: 'password_reset_email' },
        email,
      });
      console.error('[reset-email] failed', error);
      await logOpsEvent({
        kind: 'password_reset_email',
        status: 'failed',
        userId: user.id,
        email,
        payload: {
          error: error?.message || String(error),
          errorCode: error?.code || null,
        },
      });
      return res.status(503).json({
        error: error?.code === 'smtp_send_timeout'
          ? 'O envio do email demorou mais do que o esperado. Tente novamente em instantes.'
          : 'Não foi possível enviar o email de recuperação',
        supportEmail: SUPPORT_EMAIL,
        retryAfterSeconds: 10,
      });
    }

    if (EXPOSE_RESET_CODE && isDeveloperEmail(email)) {
      response.previewCode = code;
    }

    return res.json(response);
  });

  router.post('/confirm-password-reset', resetRateLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code e newPassword são obrigatórios' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
    }

    const foundUser = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    const user = foundUser.rows[0];
    if (!user) {
      await logOpsEvent({
        kind: 'password_reset_confirm',
        status: 'failed_no_user',
        email,
        payload: {},
      });
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const foundToken = await pool.query(
      `SELECT id, code_hash, expires_at
       FROM password_reset_tokens
       WHERE user_id = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id],
    );

    const tokenRow = foundToken.rows[0];
    if (!tokenRow) {
      await logOpsEvent({
        kind: 'password_reset_confirm',
        status: 'failed_missing_code',
        userId: user.id,
        email,
        payload: {},
      });
      return res.status(400).json({ error: 'Nenhum código ativo encontrado' });
    }

    if (isResetCodeExpired(tokenRow.expires_at)) {
      await logOpsEvent({
        kind: 'password_reset_confirm',
        status: 'failed_expired',
        userId: user.id,
        email,
        payload: { expiresAt: tokenRow.expires_at },
      });
      return res.status(400).json({ error: 'Código expirado' });
    }

    if (hashResetCode(code) !== tokenRow.code_hash) {
      await logOpsEvent({
        kind: 'password_reset_confirm',
        status: 'failed_invalid_code',
        userId: user.id,
        email,
        payload: {},
      });
      return res.status(400).json({ error: 'Código inválido' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
    await pool.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`, [tokenRow.id]);
    await logOpsEvent({
      kind: 'password_reset_confirm',
      status: 'success',
      userId: user.id,
      email,
      payload: {},
    });
    return res.json({ success: true });
  });

  router.post('/signout', authRequired, async (_req, res) => res.json({ success: true }));

  return router;
}

async function verifyGoogleIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: GOOGLE_CLIENT_ID,
  });
  return payload;
}

async function findUserByEmail(email) {
  const found = await pool.query(
    `SELECT id, email, name, is_admin, email_verified, email_verified_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
  return found.rows[0] || null;
}

async function requestSignupVerification(req, res) {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
  }

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }

  const normalizedEmail = normalizeEmail(email);
  const deliveryCapability = await getAuthCodeDeliveryCapability(normalizedEmail);
  if (!deliveryCapability.canSendCode) {
    return res.status(503).json({
      error: 'O envio real de email não está configurado. Configure SMTP para validar novos cadastros.',
      supportEmail: SUPPORT_EMAIL,
    });
  }

  try {
    const existing = await pool.query(`SELECT 1 FROM users WHERE email = $1 LIMIT 1`, [normalizedEmail]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const code = generateResetCode();
    const codeHash = hashResetCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const passwordHash = await bcrypt.hash(String(password), 10);

    await pool.query(
      `UPDATE email_verification_tokens
       SET consumed_at = NOW()
       WHERE email = $1
         AND purpose = 'signup'
         AND consumed_at IS NULL`,
      [normalizedEmail],
    );

    await pool.query(
      `INSERT INTO email_verification_tokens (email, purpose, name, password_hash, code_hash, expires_at)
       VALUES ($1, 'signup', $2, $3, $4, $5)`,
      [normalizedEmail, String(name || '').trim(), passwordHash, codeHash, expiresAt],
    );

    await logOpsEvent({
      kind: 'signup_verification_request',
      status: 'created',
      email: normalizedEmail,
      payload: { expiresAt },
    });

    const response = {
      success: true,
      message: 'Enviamos um código de verificação para seu email.',
      supportEmail: SUPPORT_EMAIL,
      cooldownSeconds: 30,
    };

    const mailInfo = await sendSignupVerificationEmail({ to: normalizedEmail, code });
    response.deliveryStatus = 'sent';
    if (isDeveloperEmail(normalizedEmail)) {
      response.delivery = {
        transport: mailInfo.transport,
        previewUrl: mailInfo.previewUrl,
      };
      if (mailInfo.previewUrl) response.deliveryStatus = 'preview';
    }

    await logOpsEvent({
      kind: 'signup_verification_email',
      status: response.deliveryStatus,
      email: normalizedEmail,
      payload: {
        messageId: mailInfo.messageId,
        transport: mailInfo.transport,
        durationMs: mailInfo.durationMs || null,
        previewUrl: isDeveloperEmail(normalizedEmail) ? (mailInfo.previewUrl || null) : null,
      },
    });

    if (EXPOSE_RESET_CODE && isDeveloperEmail(normalizedEmail)) {
      response.previewCode = code;
    }

    return res.json(response);
  } catch (error) {
    captureBackendError(error, {
      tags: { feature: 'auth', source: 'signup_request_code' },
      email: normalizedEmail,
    });
    console.error('[signup/request-code] failed', error);
    return res.status(500).json({ error: 'Erro ao enviar código de verificação' });
  }
}
