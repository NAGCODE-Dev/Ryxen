import express from 'express';
import bcrypt from 'bcryptjs';

import { pool } from '../db.js';
import { ADMIN_EMAILS, EXPOSE_RESET_CODE, SUPPORT_EMAIL } from '../config.js';
import { isDeveloperEmail, normalizeEmail } from '../devAccess.js';
import { authRequired, signToken } from '../auth.js';
import { sendPasswordResetEmail } from '../mailer.js';
import { generateResetCode, hashResetCode, isResetCodeExpired } from '../passwordReset.js';
import { attachPendingMembershipsToUser } from '../utils/gymUtils.js';
import { attachPendingBillingClaimsToUser } from '../utils/subscriptionBilling.js';

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
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email e password são obrigatórios' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres' });
    }

    try {
      const normalizedEmail = normalizeEmail(email);
      const hash = await bcrypt.hash(String(password), 10);
      const inserted = await withUserBootstrap(normalizedEmail, async (client, shouldBeAdmin) => {
        return client.query(
          `INSERT INTO users (email, password_hash, name, is_admin)
           VALUES ($1,$2,$3,$4)
           RETURNING id, email, name, is_admin`,
          [normalizedEmail, hash, name || null, shouldBeAdmin],
        );
      });

      const user = inserted.rows[0];
      await attachPendingMembershipsToUser(user.id, user.email);
      await attachPendingBillingClaimsToUser(user.id, user.email);
      const token = signToken(user);
      return res.json({ token, user });
    } catch (error) {
      if (String(error?.message || '').includes('duplicate key')) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }
      return res.status(500).json({ error: 'Erro ao criar conta' });
    }
  });

  router.post('/signin', authRateLimit, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email e password são obrigatórios' });
    }

    const found = await pool.query(
      `SELECT id, email, name, password_hash, is_admin FROM users WHERE email = $1`,
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

    const safeUser = { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin };
    await attachPendingMembershipsToUser(user.id, user.email);
    await attachPendingBillingClaimsToUser(user.id, user.email);
    const token = signToken(safeUser);
    return res.json({ token, user: safeUser });
  });

  router.post('/refresh', authRequired, async (req, res) => {
    const found = await pool.query(`SELECT id, email, name, is_admin FROM users WHERE id = $1`, [req.user.userId]);
    const user = found.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    await attachPendingBillingClaimsToUser(user.id, user.email);
    return res.json({ token: signToken(user), user });
  });

  router.get('/me', authRequired, async (req, res) => {
    const found = await pool.query(`SELECT id, email, name, is_admin FROM users WHERE id = $1`, [req.user.userId]);
    const user = found.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    return res.json({ user });
  });

  router.post('/request-password-reset', resetRateLimit, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'email é obrigatório' });
    }

    const found = await pool.query(`SELECT id, email FROM users WHERE email = $1`, [email]);
    const user = found.rows[0];
    if (!user) {
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

    const response = {
      success: true,
      message: 'Código de recuperação gerado.',
      supportEmail: SUPPORT_EMAIL,
    };

    try {
      const mailInfo = await sendPasswordResetEmail({ to: email, code });
      response.deliveryStatus = 'sent';
      if (isDeveloperEmail(email)) {
        response.delivery = {
          transport: mailInfo.transport,
          previewUrl: mailInfo.previewUrl,
        };
        if (mailInfo.previewUrl) response.deliveryStatus = 'preview';
      }
    } catch (error) {
      console.error('[reset-email] failed', error);
      return res.status(503).json({
        error: 'Não foi possível enviar o email de recuperação',
        supportEmail: SUPPORT_EMAIL,
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
      return res.status(400).json({ error: 'Nenhum código ativo encontrado' });
    }

    if (isResetCodeExpired(tokenRow.expires_at)) {
      return res.status(400).json({ error: 'Código expirado' });
    }

    if (hashResetCode(code) !== tokenRow.code_hash) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
    await pool.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`, [tokenRow.id]);
    return res.json({ success: true });
  });

  router.post('/signout', authRequired, async (_req, res) => res.json({ success: true }));

  return router;
}
