import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { pool } from './db.js';

const EXPIRES_IN = '7d';

export function signToken(user) {
  return jwt.sign(
    {
      userId: user.id || user.userId,
      email: user.email,
      name: user.name || null,
      isAdmin: !!user.is_admin || !!user.isAdmin,
      sessionVersion: Number(user.session_version ?? user.sessionVersion ?? 0),
    },
    JWT_SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

async function resolveAuthenticatedRequestUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return { ok: false, code: 401, error: 'Token ausente' };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return { ok: false, code: 401, error: 'Token inválido' };
  }

  const result = await pool.query(
    `SELECT id, email, name, is_admin, email_verified, email_verified_at, session_version
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [decoded?.userId],
  );
  const user = result.rows[0] || null;
  if (!user) {
    return { ok: false, code: 401, error: 'Sessão expirada. Entre novamente.' };
  }

  const tokenSessionVersion = Number(decoded?.sessionVersion || 0);
  const currentSessionVersion = Number(user.session_version || 0);
  if (tokenSessionVersion !== currentSessionVersion) {
    return { ok: false, code: 401, error: 'Sessão expirada. Entre novamente.' };
  }

  return {
    ok: true,
    user: {
      userId: user.id,
      email: user.email,
      name: user.name || null,
      isAdmin: !!user.is_admin,
      emailVerified: !!user.email_verified,
      emailVerifiedAt: user.email_verified_at || null,
      sessionVersion: currentSessionVersion,
    },
  };
}

export async function authRequired(req, res, next) {
  try {
    const auth = await resolveAuthenticatedRequestUser(req);
    if (!auth.ok) {
      return res.status(auth.code).json({ error: auth.error });
    }

    req.user = auth.user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function adminRequired(req, res, next) {
  try {
    const auth = await resolveAuthenticatedRequestUser(req);
    if (!auth.ok) {
      return res.status(auth.code).json({ error: auth.error });
    }

    if (!auth.user?.isAdmin) {
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }

    req.user = auth.user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function invalidateUserSessions({ userId, client = null, passwordChanged = false }) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

  const queryable = client?.query ? client : pool;
  const result = await queryable.query(
    `UPDATE users
     SET session_version = session_version + 1,
         password_changed_at = CASE WHEN $2 THEN NOW() ELSE password_changed_at END
     WHERE id = $1
     RETURNING id, session_version, password_changed_at`,
    [normalizedUserId, !!passwordChanged],
  );

  return result.rows[0] || null;
}

export function decodeOptionalUserId(req) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}
