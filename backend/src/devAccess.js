import { DEV_EMAILS } from './config.js';

export function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

export function isDeveloperEmail(email) {
  return DEV_EMAILS.includes(normalizeEmail(email));
}
