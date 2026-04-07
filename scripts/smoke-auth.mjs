const API_BASE_URL = String(process.env.RYXEN_API_BASE_URL || process.env.CROSSAPP_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const DEV_EMAIL_DOMAIN = String(process.env.RYXEN_DEV_EMAIL_DOMAIN || process.env.CROSSAPP_DEV_EMAIL_DOMAIN || 'nagcode.contact@gmail.com')
  .trim()
  .toLowerCase();
const PASSWORD = String(process.env.RYXEN_SMOKE_AUTH_PASSWORD || process.env.CROSSAPP_SMOKE_AUTH_PASSWORD || 'SmokeAuth123').trim();

async function main() {
  const email = buildSmokeEmail();
  const name = 'Smoke Auth';

  const signup = await apiRequest('/auth/signup', {
    method: 'POST',
    body: { email, password: PASSWORD, name },
  });

  if (!signup.previewCode) {
    throw new Error(
      'Signup não retornou previewCode. Para smoke local sem SMTP, habilite EXPOSE_RESET_CODE=true e use um email listado em DEV_EMAILS.',
    );
  }

  const confirm = await apiRequest('/auth/signup/confirm', {
    method: 'POST',
    body: { email, code: signup.previewCode },
  });

  const signin = await apiRequest('/auth/signin', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });

  const health = await rawJson('/health');

  const checks = [
    ['health ok', !!health?.ok],
    ['signup success', signup.success === true],
    ['signup preview code returned', typeof signup.previewCode === 'string' && signup.previewCode.length === 6],
    ['confirm token returned', typeof confirm.token === 'string' && confirm.token.length > 20],
    ['confirm user verified', confirm.user?.email_verified === true],
    ['signin token returned', typeof signin.token === 'string' && signin.token.length > 20],
    ['signin same email', signin.user?.email === email],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(JSON.stringify({ ok: false, failed }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl: API_BASE_URL,
    email,
    summary: {
      deliveryStatus: signup.deliveryStatus || null,
      previewUrl: signup.delivery?.previewUrl || null,
      confirmedUserId: confirm.user?.id || null,
      verifiedAt: confirm.user?.email_verified_at || null,
    },
    checks: checks.map(([label]) => label),
  }, null, 2));
}

function buildSmokeEmail() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (DEV_EMAIL_DOMAIN.includes('@')) {
    const [localPart, domain] = DEV_EMAIL_DOMAIN.split('@');
    return `${localPart}+smoke-auth-${stamp}@${domain}`;
  }

  return `smoke-auth+${stamp}@${DEV_EMAIL_DOMAIN}`;
}

async function rawJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

main().catch((error) => {
  console.error('[smoke-auth] failed', error);
  process.exit(1);
});
