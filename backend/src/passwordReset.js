import crypto from 'crypto';

export function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

export function isResetCodeExpired(expiresAt, now = Date.now()) {
  return new Date(expiresAt).getTime() < now;
}
