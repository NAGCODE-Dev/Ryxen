import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const EXPIRES_IN = '7d';

export function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name || null, isAdmin: !!user.is_admin || !!user.isAdmin },
    JWT_SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function adminRequired(req, res, next) {
  const result = authRequired(req, res, () => null);
  if (result) return result;

  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }

  return next();
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
