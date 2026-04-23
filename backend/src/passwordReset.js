import crypto from 'crypto';

export function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

export function matchesResetCode(code, expectedHash) {
  const actual = hashResetCode(code);
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(String(expectedHash || ''), 'hex');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isResetCodeExpired(expiresAt, now = Date.now()) {
  return new Date(expiresAt).getTime() < now;
}
