import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

const runtimeConfig = {
  apiBaseUrl: process.env.CROSSAPP_API_BASE_URL || '/api',
  telemetryEnabled: process.env.CROSSAPP_TELEMETRY_ENABLED !== 'false',
  auth: {
    googleClientId: process.env.CROSSAPP_GOOGLE_CLIENT_ID || '',
  },
  billing: {
    provider: process.env.CROSSAPP_BILLING_PROVIDER || 'stripe',
    successUrl: process.env.CROSSAPP_BILLING_SUCCESS_URL || '',
    cancelUrl: process.env.CROSSAPP_BILLING_CANCEL_URL || '',
    links: {
      starter: process.env.CROSSAPP_KIWIFY_CHECKOUT_STARTER_URL || '',
      pro: process.env.CROSSAPP_KIWIFY_CHECKOUT_PRO_URL || '',
      coach: process.env.CROSSAPP_KIWIFY_CHECKOUT_COACH_URL || '',
      performance: process.env.CROSSAPP_KIWIFY_CHECKOUT_PERFORMANCE_URL || '',
    },
  },
};

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
