import { createHash, timingSafeEqual } from 'node:crypto';

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizePkceCodeVerifier(value) {
  const raw = String(value || '').trim();
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(raw) ? raw : '';
}

export function normalizePkceCodeChallenge(value) {
  const raw = String(value || '').trim();
  return /^[A-Za-z0-9_-]{43,128}$/.test(raw) ? raw : '';
}

export function normalizePkceCodeChallengeMethod(value) {
  const raw = String(value || '').trim().toUpperCase();
  return raw === 'S256' || raw === 'PLAIN' ? raw : '';
}

export function computePkceCodeChallenge(verifier, method = 'S256') {
  const normalizedVerifier = normalizePkceCodeVerifier(verifier);
  const normalizedMethod = normalizePkceCodeChallengeMethod(method) || 'S256';
  if (!normalizedVerifier) return '';
  if (normalizedMethod === 'PLAIN') return normalizedVerifier;
  return createHash('sha256').update(normalizedVerifier).digest('base64url');
}

export function validateAuthRedirectExchange({ grant, deviceId = '', authVerifier = '' }) {
  const expectedDeviceId = String(grant?.payload?.deviceId || '').trim();
  const normalizedDeviceId = String(deviceId || '').trim();
  if (expectedDeviceId && (!normalizedDeviceId || !safeEquals(expectedDeviceId, normalizedDeviceId))) {
    return { ok: false, error: 'Código de autenticação inválido para este dispositivo' };
  }

  const expectedChallenge = normalizePkceCodeChallenge(grant?.payload?.codeChallenge);
  if (!expectedChallenge) {
    return { ok: true };
  }

  const method = normalizePkceCodeChallengeMethod(grant?.payload?.codeChallengeMethod) || 'S256';
  const normalizedVerifier = normalizePkceCodeVerifier(authVerifier);
  if (!normalizedVerifier) {
    return { ok: false, error: 'Código de autenticação inválido ou expirado' };
  }

  const actualChallenge = computePkceCodeChallenge(normalizedVerifier, method);
  if (!actualChallenge || !safeEquals(expectedChallenge, actualChallenge)) {
    return { ok: false, error: 'Código de autenticação inválido ou expirado' };
  }

  return { ok: true };
}
