import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth config prefere app link https para callback nativo', async () => {
  const configSource = await readFile(new URL('../config.js', import.meta.url), 'utf8');
  assert.match(configSource, /appLinkBaseUrl:\s*'https:\/\/ryxen-app\.vercel\.app\/auth\/callback'/);
});

test('android manifest expõe app links verificados para o callback de auth', async () => {
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.match(manifest, /android:host="\$\{ryxenAppLinkHost\}"/);
  assert.match(manifest, /android:pathPrefix="\/auth\/callback"/);
});

test('build estático publica arquivos well-known para app links', async () => {
  const buildScript = await readFile(new URL('../scripts/build-static.mjs', import.meta.url), 'utf8');
  assert.match(buildScript, /assetlinks\.json/);
  assert.match(buildScript, /apple-app-site-association/);
  assert.match(buildScript, /RYXEN_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS/);
  assert.match(buildScript, /auth\/callback\/index\.html/);
});

test('vercel serve endpoints well-known com content-type json', async () => {
  const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const sources = vercelConfig.headers.map((entry) => entry.source);
  assert.ok(sources.includes('/.well-known/assetlinks.json'));
  assert.ok(sources.includes('/.well-known/apple-app-site-association'));
});
