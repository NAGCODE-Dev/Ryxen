import { logOpsEvent } from './opsEvents.js';
import { sanitizeRequestPath } from './securityRedaction.js';

function pickHeader(req, headerName) {
  return String(req?.headers?.[headerName] || '').trim() || null;
}

export function buildRequestAuditContext(req) {
  return {
    requestId: req?.requestId || null,
    method: req?.method || null,
    path: sanitizeRequestPath(req),
    ip: req?.ip || null,
    userAgent: pickHeader(req, 'user-agent'),
  };
}

export async function logAdminAuditEvent({
  req,
  action,
  status = 'success',
  actorUserId = null,
  actorEmail = '',
  targetUserId = null,
  targetEmail = '',
  payload = {},
}) {
  if (!action) return null;

  return logOpsEvent({
    kind: 'admin_audit',
    status,
    userId: actorUserId || null,
    email: actorEmail || '',
    payload: {
      action,
      actorUserId: actorUserId || null,
      actorEmail: actorEmail || null,
      targetUserId: targetUserId || null,
      targetEmail: targetEmail || null,
      ...buildRequestAuditContext(req),
      ...(payload || {}),
    },
  });
}
