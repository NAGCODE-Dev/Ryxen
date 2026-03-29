import { DEV_EMAILS } from './config.js';

export function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

export function isDeveloperEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return DEV_EMAILS.some((allowed) => {
    const candidate = normalizeEmail(allowed);
    return normalized === candidate || stripPlusAlias(normalized) === candidate;
  });
}

function stripPlusAlias(email) {
  const [localPart, domain] = String(email || '').split('@');
  if (!localPart || !domain) return normalizeEmail(email);
  const canonicalLocalPart = localPart.split('+')[0];
  return `${canonicalLocalPart}@${domain}`;
}
