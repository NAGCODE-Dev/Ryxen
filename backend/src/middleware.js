import crypto from 'crypto';

import { sanitizeRequestPath } from './securityRedaction.js';

const rateBuckets = new Map();

export function attachRequestMeta(req, res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function applySecurityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  if (_req.secure || String(_req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function attachRequestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    if (res.statusCode < 400) return;

    console.error('[backend:request]', JSON.stringify({
      requestId: req.requestId,
      method: req.method,
      path: sanitizeRequestPath(req),
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.userId || null,
      ip: req.ip || null,
    }));
  });

  next();
}

export function createRateLimiter({ windowMs, maxRequests, keyPrefix, keyResolver = null }) {
  return (req, res, next) => {
    const now = Date.now();
    if (rateBuckets.size > 5000) {
      for (const [bucketKey, bucket] of rateBuckets.entries()) {
        if (!bucket || now > bucket.resetAt) {
          rateBuckets.delete(bucketKey);
        }
      }
    }
    const resolvedKey = keyResolver ? keyResolver(req) : (req.ip || 'unknown');
    const key = `${keyPrefix}:${String(resolvedKey || req.ip || 'unknown').trim().toLowerCase()}`;
    const bucket = rateBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: 'Muitas tentativas. Tente novamente em instantes.',
      });
    }

    bucket.count += 1;
    return next();
  };
}
