try {
  await import('dotenv/config');
} catch {
  // Frontend-only installs can run backend config tests without backend deps present.
}

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
export const NATIVE_APP_ORIGINS = parseList(process.env.NATIVE_APP_ORIGINS || 'capacitor://localhost,https://localhost,http://localhost,ionic://localhost');
export const ALLOWED_ORIGINS = FRONTEND_ORIGIN === '*'
  ? '*'
  : Array.from(new Set([
      ...parseList(FRONTEND_ORIGIN),
      ...NATIVE_APP_ORIGINS,
    ]));
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
export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY, IS_PRODUCTION);
export const DEFAULT_BILLING_SUCCESS_URL = String(process.env.BILLING_SUCCESS_URL || FRONTEND_ORIGIN || 'http://localhost:8000').trim();
export const DEFAULT_BILLING_CANCEL_URL = String(process.env.BILLING_CANCEL_URL || FRONTEND_ORIGIN || 'http://localhost:8000').trim();
export const GOOGLE_CLIENT_ID = String(
  process.env.GOOGLE_CLIENT_ID || '581596457498-9vrde3rt79ikqqm751v8bfhngemm2k23.apps.googleusercontent.com',
).trim();
export const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
export const APP_ENV = String(process.env.APP_ENV || NODE_ENV || 'development').trim().toLowerCase();
export const APP_RELEASE = String(process.env.APP_RELEASE || '').trim();
export const SENTRY_DSN = String(process.env.SENTRY_DSN || '').trim();
export const BACKEND_PUBLIC_URL = String(process.env.BACKEND_PUBLIC_URL || '').trim();
export const KIWIFY_WEBHOOK_TOKEN = String(process.env.KIWIFY_WEBHOOK_TOKEN || '').trim();
export const KIWIFY_ACCOUNT_ID = String(process.env.KIWIFY_ACCOUNT_ID || '').trim();
export const KIWIFY_CLIENT_ID = String(process.env.KIWIFY_CLIENT_ID || '').trim();
export const KIWIFY_CLIENT_SECRET = String(process.env.KIWIFY_CLIENT_SECRET || '').trim();
export const KIWIFY_PRODUCT_STARTER_ID = String(process.env.KIWIFY_PRODUCT_STARTER_ID || '').trim();
export const KIWIFY_PRODUCT_PRO_ID = String(process.env.KIWIFY_PRODUCT_PRO_ID || '').trim();
export const KIWIFY_PRODUCT_PERFORMANCE_ID = String(process.env.KIWIFY_PRODUCT_PERFORMANCE_ID || '').trim();
export const KIWIFY_PRODUCT_ATHLETE_PLUS_ID = String(process.env.KIWIFY_PRODUCT_ATHLETE_PLUS_ID || '').trim();
export const RETENTION_SWEEP_INTERVAL_MS = Math.max(Number(process.env.RETENTION_SWEEP_INTERVAL_MS || 6 * 60 * 60 * 1000), 60_000);
export const RETENTION_TELEMETRY_DAYS = Math.max(Number(process.env.RETENTION_TELEMETRY_DAYS || 30), 1);
export const RETENTION_OPS_DAYS = Math.max(Number(process.env.RETENTION_OPS_DAYS || 90), 1);
export const RETENTION_EMAIL_JOBS_DAYS = Math.max(Number(process.env.RETENTION_EMAIL_JOBS_DAYS || 30), 1);
export const RETENTION_PASSWORD_RESET_DAYS = Math.max(Number(process.env.RETENTION_PASSWORD_RESET_DAYS || 2), 1);
export const RETENTION_EMAIL_VERIFICATION_DAYS = Math.max(Number(process.env.RETENTION_EMAIL_VERIFICATION_DAYS || 2), 1);
export const RETENTION_SYNC_SNAPSHOT_KEEP_PER_USER = Math.max(Number(process.env.RETENTION_SYNC_SNAPSHOT_KEEP_PER_USER || 5), 1);
export const RETENTION_ACCOUNT_DELETION_DAYS = Math.max(Number(process.env.RETENTION_ACCOUNT_DELETION_DAYS || 90), 1);

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
