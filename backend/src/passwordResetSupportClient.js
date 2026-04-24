export function buildClientPasswordResetSupportMeta(meta = {}) {
  return {
    status: String(meta.status || 'missing'),
    requestedAt: String(meta.requestedAt || ''),
    expiresAt: String(meta.expiresAt || ''),
    approvedAt: String(meta.approvedAt || ''),
    deniedAt: String(meta.deniedAt || ''),
    completedAt: String(meta.completedAt || ''),
    canRetry: !!meta.canRetry,
    retryAfterMs: Number(meta.retryAfterMs || 0),
    retryAfterSeconds: Number(meta.retryAfterSeconds || 0),
    attemptCount: Math.max(Number(meta.attemptCount || 1), 1),
  };
}
