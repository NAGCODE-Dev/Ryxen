import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { sanitizeRequestPath } from './securityRedaction.js';

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
  return rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      const safeIpKey = ipKeyGenerator(req.ip || 'unknown');
      const resolvedKey = keyResolver ? keyResolver(req) : safeIpKey;
      return `${keyPrefix}:${String(resolvedKey || safeIpKey).trim().toLowerCase()}`;
    },
    handler(_req, res) {
      return res.status(429).json({
        error: 'Muitas tentativas. Tente novamente em instantes.',
      });
    },
  });
}
