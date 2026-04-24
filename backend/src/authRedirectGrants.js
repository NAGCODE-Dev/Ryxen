import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { pool } from './db.js';

const AUTH_REDIRECT_GRANT_TTL_MS = 2 * 60 * 1000;

function hashGrantCode(code) {
  return createHash('sha256').update(String(code || '')).digest('hex');
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getQueryable(client = null) {
  return client?.query ? client : pool;
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

export async function issueAuthRedirectGrant({ userId, flow = 'native_google_oauth', payload = {}, client = null }) {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

  const code = randomUUID();
  const codeHash = hashGrantCode(code);
  const expiresAt = new Date(Date.now() + AUTH_REDIRECT_GRANT_TTL_MS).toISOString();
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `INSERT INTO auth_redirect_grants (user_id, code_hash, flow, payload, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id, expires_at`,
    [normalizedUserId, codeHash, String(flow || 'native_google_oauth'), JSON.stringify(payload || {}), expiresAt],
  );

  return {
    code,
    expiresAt: result.rows[0]?.expires_at || expiresAt,
  };
}

export async function findAuthRedirectGrant({ code, client = null, lock = false }) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return null;

  const queryable = getQueryable(client);
  const grantRes = await queryable.query(
    `SELECT id, user_id, flow, payload, expires_at, consumed_at
     FROM auth_redirect_grants
     WHERE code_hash = $1
     LIMIT 1
     ${lock ? 'FOR UPDATE' : ''}`,
    [hashGrantCode(normalizedCode)],
  );
  const grant = grantRes.rows[0] || null;
  if (!grant) return null;
  if (grant.consumed_at) return null;
  if (new Date(grant.expires_at).getTime() <= Date.now()) return null;

  return {
    id: grant.id,
    userId: Number(grant.user_id || 0),
    flow: String(grant.flow || ''),
    payload: grant.payload && typeof grant.payload === 'object' ? grant.payload : {},
    expiresAt: grant.expires_at || null,
  };
}

export async function consumeAuthRedirectGrant({ code, client = null }) {
  const grant = await findAuthRedirectGrant({ code, client, lock: true });
  if (!grant) return null;

  await markAuthRedirectGrantConsumed({ grantId: grant.id, client });

  return grant;
}

export async function markAuthRedirectGrantConsumed({ grantId, client = null }) {
  const normalizedGrantId = Number(grantId);
  if (!Number.isFinite(normalizedGrantId) || normalizedGrantId <= 0) return null;

  const queryable = getQueryable(client);
  await queryable.query(
    `UPDATE auth_redirect_grants
     SET consumed_at = NOW()
     WHERE id = $1`,
    [normalizedGrantId],
  );
  return { id: normalizedGrantId };
}
