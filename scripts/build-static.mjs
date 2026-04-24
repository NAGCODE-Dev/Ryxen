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
  'apps',
  'packages',
  'src',
  'branding',
  'icons',
  'sports',
];

const fileConfig = await loadFileConfig();

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

const runtimeConfig = deepMerge(fileConfig, {
  apiBaseUrl: readEnv('RYXEN_API_BASE_URL', 'CROSSAPP_API_BASE_URL') || '/api',
  nativeApiBaseUrl: readEnv('RYXEN_NATIVE_API_BASE_URL', 'CROSSAPP_NATIVE_API_BASE_URL') || fileConfig?.nativeApiBaseUrl || readEnv('RYXEN_API_BASE_URL', 'CROSSAPP_API_BASE_URL') || '',
  native: {
    target: readEnv('RYXEN_NATIVE_TARGET', 'CROSSAPP_NATIVE_TARGET') || fileConfig?.native?.target || 'device',
    emulatorApiBaseUrl:
      readEnv('RYXEN_NATIVE_EMULATOR_API_BASE_URL', 'CROSSAPP_NATIVE_EMULATOR_API_BASE_URL')
      || fileConfig?.native?.emulatorApiBaseUrl
      || 'http://10.0.2.2:8787',
  },
  telemetryEnabled: readEnv('RYXEN_TELEMETRY_ENABLED', 'CROSSAPP_TELEMETRY_ENABLED') !== 'false',
  auth: {
    googleClientId: readEnv('RYXEN_GOOGLE_CLIENT_ID', 'CROSSAPP_GOOGLE_CLIENT_ID') || fileConfig?.auth?.googleClientId || '',
    appLinkBaseUrl:
      readEnv('RYXEN_APP_LINK_BASE_URL', 'CROSSAPP_APP_LINK_BASE_URL')
      || fileConfig?.auth?.appLinkBaseUrl
      || 'https://ryxen-app.vercel.app/auth/callback',
  },
  observability: {
    sentry: {
      dsn: readEnv('RYXEN_SENTRY_DSN', 'CROSSAPP_SENTRY_DSN') || fileConfig?.observability?.sentry?.dsn || '',
      environment: readEnv('RYXEN_APP_ENV', 'CROSSAPP_APP_ENV') || process.env.VERCEL_ENV || fileConfig?.observability?.sentry?.environment || 'production',
      release: readEnv('RYXEN_APP_RELEASE', 'CROSSAPP_APP_RELEASE') || process.env.VERCEL_GIT_COMMIT_SHA || fileConfig?.observability?.sentry?.release || '',
    },
  },
  billing: {
    provider: readEnv('RYXEN_BILLING_PROVIDER', 'CROSSAPP_BILLING_PROVIDER') || fileConfig?.billing?.provider || 'kiwify_link',
    successUrl: readEnv('RYXEN_BILLING_SUCCESS_URL', 'CROSSAPP_BILLING_SUCCESS_URL') || fileConfig?.billing?.successUrl || '',
    cancelUrl: readEnv('RYXEN_BILLING_CANCEL_URL', 'CROSSAPP_BILLING_CANCEL_URL') || fileConfig?.billing?.cancelUrl || '',
    links: {
      athlete_plus: readEnv('RYXEN_KIWIFY_CHECKOUT_ATHLETE_PLUS_URL', 'CROSSAPP_KIWIFY_CHECKOUT_ATHLETE_PLUS_URL') || fileConfig?.billing?.links?.athlete_plus || '',
      starter: readEnv('RYXEN_KIWIFY_CHECKOUT_STARTER_URL', 'CROSSAPP_KIWIFY_CHECKOUT_STARTER_URL') || fileConfig?.billing?.links?.starter || '',
      pro: readEnv('RYXEN_KIWIFY_CHECKOUT_PRO_URL', 'CROSSAPP_KIWIFY_CHECKOUT_PRO_URL') || fileConfig?.billing?.links?.pro || '',
      coach: readEnv('RYXEN_KIWIFY_CHECKOUT_COACH_URL', 'CROSSAPP_KIWIFY_CHECKOUT_COACH_URL') || fileConfig?.billing?.links?.coach || '',
      performance: readEnv('RYXEN_KIWIFY_CHECKOUT_PERFORMANCE_URL', 'CROSSAPP_KIWIFY_CHECKOUT_PERFORMANCE_URL') || fileConfig?.billing?.links?.performance || '',
    },
  },
});

reportNativeApiResolution(runtimeConfig);

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const file of filesToCopy) {
  await cp(path.join(root, file), path.join(distDir, file));
}

for (const dir of dirsToCopy) {
  await cp(path.join(root, dir), path.join(distDir, dir), { recursive: true });
}

const frontendConfig = [
  `window.__RYXEN_CONFIG__ = ${JSON.stringify(runtimeConfig, null, 2)};`,
  'window.__CROSSAPP_CONFIG__ = window.__CROSSAPP_CONFIG__ || window.__RYXEN_CONFIG__;',
  '',
].join('\n');
await writeFile(path.join(distDir, 'config.js'), frontendConfig, 'utf8');

await patchHtml(path.join(distDir, 'index.html'));
await patchHtml(path.join(distDir, 'sports/cross/index.html'));
await patchHtml(path.join(distDir, 'sports/running/index.html'));
await patchHtml(path.join(distDir, 'sports/strength/index.html'));
await mkdir(path.join(distDir, 'auth/callback'), { recursive: true });
await cp(path.join(distDir, 'sports/cross/index.html'), path.join(distDir, 'auth/callback/index.html'));
await writeWellKnownFiles(distDir);

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
    return sandbox.window.__RYXEN_CONFIG__ || sandbox.window.__CROSSAPP_CONFIG__ || {};
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

function reportNativeApiResolution(config) {
  const apiBaseUrl = String(config?.apiBaseUrl || '').trim();
  const nativeApiBaseUrl = String(config?.nativeApiBaseUrl || '').trim();
  const nativeTarget = String(config?.native?.target || '').trim().toLowerCase();
  const emulatorApiBaseUrl = String(config?.native?.emulatorApiBaseUrl || '').trim();

  if (apiBaseUrl !== '/api' || nativeApiBaseUrl) return;

  if (nativeTarget === 'emulator' && emulatorApiBaseUrl) {
    console.warn(
      [
        '[build-static] aviso: build nativa configurada para emulador.',
        `"/api" vai usar ${emulatorApiBaseUrl}.`,
        'Para device real, defina RYXEN_NATIVE_API_BASE_URL com uma URL absoluta.',
      ].join(' '),
    );
    return;
  }

  console.warn(
    [
      '[build-static] aviso: build nativa sem backend absoluto configurado.',
      'Em device real, "/api" não será resolvido automaticamente.',
      'Defina RYXEN_NATIVE_API_BASE_URL para produção/device ou RYXEN_NATIVE_TARGET=emulator para testes locais no Android emulator.',
    ].join(' '),
  );
}

async function writeWellKnownFiles(outputDir) {
  const wellKnownDir = path.join(outputDir, '.well-known');
  await mkdir(wellKnownDir, { recursive: true });

  const androidFingerprints = parseCsv(
    readEnv('RYXEN_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS', 'CROSSAPP_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS') || '',
  );
  if (!androidFingerprints.length) {
    console.warn(
      '[build-static] aviso: RYXEN_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS não definido. assetlinks.json será publicado vazio até a fingerprint oficial ser configurada.',
    );
  }

  const assetLinks = androidFingerprints.length
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.nagcode.ryxen',
            sha256_cert_fingerprints: androidFingerprints,
          },
        },
      ]
    : [];

  await writeFile(
    path.join(wellKnownDir, 'assetlinks.json'),
    `${JSON.stringify(assetLinks, null, 2)}\n`,
    'utf8',
  );

  const iosAppId = String(
    readEnv('RYXEN_IOS_APP_LINK_APP_ID', 'CROSSAPP_IOS_APP_LINK_APP_ID')
    || 'TEAMID.com.nagcode.ryxen',
  ).trim();
  const appleAssociation = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [iosAppId],
          components: [
            {
              '/': '/auth/callback',
              comment: 'Native auth callback for Ryxen',
            },
          ],
        },
      ],
    },
  };

  await writeFile(
    path.join(wellKnownDir, 'apple-app-site-association'),
    `${JSON.stringify(appleAssociation, null, 2)}\n`,
    'utf8',
  );
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
