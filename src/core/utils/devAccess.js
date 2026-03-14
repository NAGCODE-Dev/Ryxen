const DEV_EMAILS = ['nagcode.contact@gmail.com'];

export function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

export function isDeveloperEmail(email) {
  return DEV_EMAILS.includes(normalizeEmail(email));
}

export function isDeveloperProfile(profile) {
  return isDeveloperEmail(profile?.email);
}
