const DEV_EMAILS = ['nagcode.contact@gmail.com'];

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

export function isDeveloperProfile(profile) {
  return isDeveloperEmail(profile?.email);
}

function stripPlusAlias(email) {
  const [localPart, domain] = String(email || '').split('@');
  if (!localPart || !domain) return normalizeEmail(email);
  const canonicalLocalPart = localPart.split('+')[0];
  return `${canonicalLocalPart}@${domain}`;
}
