import 'dotenv/config';

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean);
}

function parseTrustProxy(value, isProduction) {
  if (value === undefined || value === null || value === '') {
    return isProduction ? 1 : false;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return value;
}

export const NODE_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
export const IS_PRODUCTION = NODE_ENV === 'production';
export const PORT = Number(process.env.PORT || 8787);
export const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
export const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
export const FRONTEND_ORIGIN = String(process.env.FRONTEND_ORIGIN || (IS_PRODUCTION ? '' : '*')).trim();
export const ALLOWED_ORIGINS = FRONTEND_ORIGIN === '*'
  ? '*'
  : parseList(FRONTEND_ORIGIN);
export const SUPPORT_EMAIL = String(process.env.SUPPORT_EMAIL || 'nagcode.contact@gmail.com').toLowerCase().trim();
export const ADMIN_EMAILS = Array.from(new Set([
  ...parseList(process.env.ADMIN_EMAILS || ''),
  SUPPORT_EMAIL,
]));
export const DEV_EMAILS = Array.from(new Set([
  ...parseList(process.env.DEV_EMAILS || ''),
  SUPPORT_EMAIL,
]));
export const EXPOSE_RESET_CODE = String(process.env.EXPOSE_RESET_CODE || 'false').trim().toLowerCase() === 'true';
export const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY, IS_PRODUCTION);
export const DEFAULT_BILLING_SUCCESS_URL = String(process.env.BILLING_SUCCESS_URL || FRONTEND_ORIGIN || 'http://localhost:8000').trim();
export const DEFAULT_BILLING_CANCEL_URL = String(process.env.BILLING_CANCEL_URL || FRONTEND_ORIGIN || 'http://localhost:8000').trim();

export function validateConfig() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL é obrigatório');
  }

  if (!Number.isFinite(PORT) || PORT <= 0) {
    throw new Error('PORT inválido');
  }

  if (IS_PRODUCTION) {
    if (!JWT_SECRET || JWT_SECRET === 'change-me' || JWT_SECRET === 'change-me-local') {
      throw new Error('JWT_SECRET forte é obrigatório em produção');
    }

    if (!FRONTEND_ORIGIN || FRONTEND_ORIGIN === '*') {
      throw new Error('FRONTEND_ORIGIN explícito é obrigatório em produção');
    }
  }
}

export function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS === '*') return true;
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(String(origin).toLowerCase().trim());
}
