const SENSITIVE_KEYS = new Set([
  'authcode',
  'auth_code',
  'authtoken',
  'auth_token',
  'authuser',
  'auth_user',
  'code',
  'requestkey',
  'request_key',
  'state',
  'token',
  'trustedtoken',
  'trusted_token',
  'webhook_token',
  'x-kiwify-token',
  'x-kiwify-webhook-token',
  'x-webhook-token',
]);

export function sanitizeRequestPath(req) {
  return sanitizeUrlPath(req?.originalUrl || req?.url || '');
}

export function sanitizeUrlPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const parsed = raw.startsWith('/')
      ? new URL(raw, 'http://localhost')
      : new URL(raw);
    return parsed.pathname || '/';
  } catch {
    const queryIndex = raw.indexOf('?');
    return queryIndex >= 0 ? raw.slice(0, queryIndex) || '/' : raw;
  }
}

export function redactSensitiveValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item));

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        const normalizedKey = String(key || '').trim().toLowerCase();
        if (SENSITIVE_KEYS.has(normalizedKey)) {
          return [key, '[REDACTED]'];
        }
        if (normalizedKey === 'path' || normalizedKey === 'url' || normalizedKey.endsWith('_url')) {
          return [key, sanitizeUrlPath(entryValue)];
        }
        return [key, redactSensitiveValue(entryValue)];
      }),
    );
  }

  return value;
}
