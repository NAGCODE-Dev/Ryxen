import crypto from 'crypto';

const rateBuckets = new Map();

function sanitizeLoggedPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;

  try {
    const parsed = new URL(raw, 'http://localhost');
    ['token', 'webhook_token', 'signature'].forEach((key) => {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '[redacted]');
    });
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw
      .replace(/([?&](?:token|webhook_token|signature)=)[^&]*/gi, '$1[redacted]');
  }
}

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
      path: sanitizeLoggedPath(req.originalUrl),
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.userId || null,
      ip: req.ip || null,
    }));
  });

  next();
}

export function createRateLimiter({ windowMs, maxRequests, keyPrefix }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || 'unknown'}`;
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
