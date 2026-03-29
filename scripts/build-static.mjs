import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const distDir = path.join(root, 'dist');

const filesToCopy = [
  'index.html',
  'pricing.html',
  'privacy.html',
  'terms.html',
  'support.html',
  'manifest.json',
  'sw.js',
];

const dirsToCopy = [
  'src',
  'icons',
  'sports',
];

const fileConfig = await loadFileConfig();

const runtimeConfig = deepMerge(fileConfig, {
  apiBaseUrl: process.env.CROSSAPP_API_BASE_URL || '/api',
  nativeApiBaseUrl: process.env.CROSSAPP_NATIVE_API_BASE_URL || fileConfig?.nativeApiBaseUrl || process.env.CROSSAPP_API_BASE_URL || '',
  telemetryEnabled: process.env.CROSSAPP_TELEMETRY_ENABLED !== 'false',
  auth: {
    googleClientId: process.env.CROSSAPP_GOOGLE_CLIENT_ID || fileConfig?.auth?.googleClientId || '',
  },
  observability: {
    sentry: {
      dsn: process.env.CROSSAPP_SENTRY_DSN || fileConfig?.observability?.sentry?.dsn || '',
      environment: process.env.CROSSAPP_APP_ENV || process.env.VERCEL_ENV || fileConfig?.observability?.sentry?.environment || 'production',
      release: process.env.CROSSAPP_APP_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || fileConfig?.observability?.sentry?.release || '',
    },
  },
  billing: {
    provider: process.env.CROSSAPP_BILLING_PROVIDER || fileConfig?.billing?.provider || 'kiwify_link',
    successUrl: process.env.CROSSAPP_BILLING_SUCCESS_URL || fileConfig?.billing?.successUrl || '',
    cancelUrl: process.env.CROSSAPP_BILLING_CANCEL_URL || fileConfig?.billing?.cancelUrl || '',
    links: {
      athlete_plus: process.env.CROSSAPP_KIWIFY_CHECKOUT_ATHLETE_PLUS_URL || fileConfig?.billing?.links?.athlete_plus || '',
      starter: process.env.CROSSAPP_KIWIFY_CHECKOUT_STARTER_URL || fileConfig?.billing?.links?.starter || '',
      pro: process.env.CROSSAPP_KIWIFY_CHECKOUT_PRO_URL || fileConfig?.billing?.links?.pro || '',
      coach: process.env.CROSSAPP_KIWIFY_CHECKOUT_COACH_URL || fileConfig?.billing?.links?.coach || '',
      performance: process.env.CROSSAPP_KIWIFY_CHECKOUT_PERFORMANCE_URL || fileConfig?.billing?.links?.performance || '',
    },
  },
});

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const file of filesToCopy) {
  await cp(path.join(root, file), path.join(distDir, file));
}

for (const dir of dirsToCopy) {
  await cp(path.join(root, dir), path.join(distDir, dir), { recursive: true });
}

const frontendConfig = `window.__CROSSAPP_CONFIG__ = ${JSON.stringify(runtimeConfig, null, 2)};\n`;
await writeFile(path.join(distDir, 'config.js'), frontendConfig, 'utf8');

await patchHtml(path.join(distDir, 'index.html'));
await patchHtml(path.join(distDir, 'sports/cross/index.html'));
await patchHtml(path.join(distDir, 'sports/running/index.html'));
await patchHtml(path.join(distDir, 'sports/strength/index.html'));

console.log(`[build-static] dist ready at ${distDir}`);

async function patchHtml(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const updated = raw.replace('./src/ui/styles.css', raw.includes('/coach/') ? './styles.css' : './src/ui/styles.css');
  await writeFile(filePath, updated, 'utf8');
}

async function loadFileConfig() {
  try {
    const raw = await readFile(path.join(root, 'config.js'), 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(raw, sandbox, { timeout: 1000 });
    return sandbox.window.__CROSSAPP_CONFIG__ || {};
  } catch {
    return {};
  }
}

function deepMerge(base, override) {
  const output = { ...(base || {}) };
  Object.keys(override || {}).forEach((key) => {
    const a = output[key];
    const b = override[key];
    if (isObject(a) && isObject(b)) {
      output[key] = deepMerge(a, b);
    } else {
      output[key] = b;
    }
  });
  return output;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
