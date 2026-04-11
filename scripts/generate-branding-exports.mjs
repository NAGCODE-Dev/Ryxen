import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = process.cwd();
const brandingDir = path.join(root, 'branding');
const sourcesDir = path.join(brandingDir, 'sources');
const exportsDir = path.join(brandingDir, 'exports');
const iconsDir = path.join(root, 'icons');
const androidResDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const brandBackground = '#071427';

const sources = {
  wordmarkPrimary: path.join(sourcesDir, 'ryxen-wordmark-primary.png'),
  wordmarkAlt: path.join(sourcesDir, 'ryxen-wordmark-alt.png'),
  appIcon: path.join(sourcesDir, 'ryxen-app-icon-master.png'),
  nyxBase: path.join(sourcesDir, 'nyx-base.png'),
  nyxMentor: path.join(sourcesDir, 'nyx-mentor.png'),
};

const exportedIcons = [32, 64, 180, 192, 512, 1024];
const androidLauncherSizes = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];
const splashOutputs = [
  { file: path.join(androidResDir, 'drawable', 'splash.png'), width: 320, height: 480 },
  { file: path.join(androidResDir, 'drawable-port-mdpi', 'splash.png'), width: 320, height: 480 },
  { file: path.join(androidResDir, 'drawable-port-hdpi', 'splash.png'), width: 480, height: 800 },
  { file: path.join(androidResDir, 'drawable-port-xhdpi', 'splash.png'), width: 720, height: 1280 },
  { file: path.join(androidResDir, 'drawable-port-xxhdpi', 'splash.png'), width: 960, height: 1600 },
  { file: path.join(androidResDir, 'drawable-port-xxxhdpi', 'splash.png'), width: 1280, height: 1920 },
  { file: path.join(androidResDir, 'drawable-land-mdpi', 'splash.png'), width: 480, height: 320 },
  { file: path.join(androidResDir, 'drawable-land-hdpi', 'splash.png'), width: 800, height: 480 },
  { file: path.join(androidResDir, 'drawable-land-xhdpi', 'splash.png'), width: 1280, height: 720 },
  { file: path.join(androidResDir, 'drawable-land-xxhdpi', 'splash.png'), width: 1600, height: 960 },
  { file: path.join(androidResDir, 'drawable-land-xxxhdpi', 'splash.png'), width: 1920, height: 1280 },
];

const requiredFallbackOutputs = [
  ...exportedIcons.map((size) => path.join(exportsDir, `ryxen-icon-${size}.png`)),
  path.join(exportsDir, 'ryxen-logo-horizontal.png'),
  path.join(exportsDir, 'ryxen-logo-horizontal@2x-half.png'),
  path.join(exportsDir, 'ryxen-logo-horizontal-alt.png'),
  path.join(exportsDir, 'nyx-base.png'),
  path.join(exportsDir, 'nyx-mentor.png'),
  path.join(iconsDir, 'icon-192.png'),
  path.join(iconsDir, 'icon-512.png'),
  ...androidLauncherSizes.flatMap(({ dir }) => [
    path.join(androidResDir, dir, 'ic_launcher.png'),
    path.join(androidResDir, dir, 'ic_launcher_round.png'),
    path.join(androidResDir, dir, 'ic_launcher_foreground.png'),
  ]),
  ...splashOutputs.map(({ file }) => file),
];

await Promise.all([
  fs.mkdir(exportsDir, { recursive: true }),
  fs.mkdir(iconsDir, { recursive: true }),
  ...androidLauncherSizes.flatMap(({ dir }) => [
    fs.mkdir(path.join(androidResDir, dir), { recursive: true }),
  ]),
  ...splashOutputs.map(({ file }) => fs.mkdir(path.dirname(file), { recursive: true })),
]);

await ensureSources();

const [wordmarkPrimaryBuffer, wordmarkAltBuffer, appIconBuffer] = await Promise.all([
  fs.readFile(sources.wordmarkPrimary),
  fs.readFile(sources.wordmarkAlt),
  fs.readFile(sources.appIcon),
]);

let browser = null;

async function launchBrowser() {
  try {
    const instance = await chromium.launch({ headless: true });
    console.log('[generate-branding-exports] browser launched successfully');
    return instance;
  } catch (error) {
    console.error('[generate-branding-exports] failed to launch browser:', error.message);
    if (await canReuseExistingOutputs(requiredFallbackOutputs)) {
      console.log('[generate-branding-exports] reusing committed exports (playwright browser unavailable)');
      process.exit(0);
    }
    throw error;
  }
}

async function closeBrowserSafely(instance) {
  if (!instance) return;
  try {
    await instance.close();
    console.log('[generate-branding-exports] browser closed successfully');
  } catch (error) {
    console.error('[generate-branding-exports] error closing browser:', error.message);
  }
}

browser = await launchBrowser();

try {
  const wordmarkPrimaryData = asDataUrl(wordmarkPrimaryBuffer, 'image/png');
  const wordmarkAltData = asDataUrl(wordmarkAltBuffer, 'image/png');
  const appIconData = asDataUrl(appIconBuffer, 'image/png');

  for (const size of exportedIcons) {
    await screenshotImage(browser, {
      src: appIconData,
      width: size,
      height: size,
      output: path.join(exportsDir, `ryxen-icon-${size}.png`),
      fit: 'cover',
      background: brandBackground,
    });
  }

  await screenshotImage(browser, {
    src: wordmarkPrimaryData,
    width: 940,
    height: 240,
    output: path.join(exportsDir, 'ryxen-logo-horizontal.png'),
    fit: 'cover',
    background: brandBackground,
    objectPosition: 'center 49%',
  });

  await screenshotImage(browser, {
    src: wordmarkPrimaryData,
    width: 470,
    height: 120,
    output: path.join(exportsDir, 'ryxen-logo-horizontal@2x-half.png'),
    fit: 'cover',
    background: brandBackground,
    objectPosition: 'center 49%',
  });

  await screenshotImage(browser, {
    src: wordmarkAltData,
    width: 940,
    height: 240,
    output: path.join(exportsDir, 'ryxen-logo-horizontal-alt.png'),
    fit: 'cover',
    background: brandBackground,
    objectPosition: 'center 49%',
  });

  for (const { dir, size } of androidLauncherSizes) {
    const targets = [
      path.join(androidResDir, dir, 'ic_launcher.png'),
      path.join(androidResDir, dir, 'ic_launcher_round.png'),
      path.join(androidResDir, dir, 'ic_launcher_foreground.png'),
    ];

    for (const output of targets) {
      await screenshotImage(browser, {
        src: appIconData,
        width: size,
        height: size,
        output,
        fit: 'cover',
        background: brandBackground,
      });
    }
  }

  for (const splash of splashOutputs) {
    await screenshotSplash(browser, {
      src: appIconData,
      width: splash.width,
      height: splash.height,
      output: splash.file,
    });
  }
  console.log('[generate-branding-exports] all assets generated successfully');
} catch (error) {
  console.error('[generate-branding-exports] error during asset generation:', error.message);
  throw error;
} finally {
  await closeBrowserSafely(browser);
}

await Promise.all([
  fs.copyFile(path.join(exportsDir, 'ryxen-icon-192.png'), path.join(iconsDir, 'icon-192.png')),
  fs.copyFile(path.join(exportsDir, 'ryxen-icon-512.png'), path.join(iconsDir, 'icon-512.png')),
  fs.copyFile(sources.nyxBase, path.join(exportsDir, 'nyx-base.png')),
  fs.copyFile(sources.nyxMentor, path.join(exportsDir, 'nyx-mentor.png')),
]);

console.log('[generate-branding-exports] ok');

async function ensureSources() {
  await Promise.all(
    Object.values(sources).map(async (file) => {
      try {
        await fs.access(file);
      } catch {
        throw new Error(`[generate-branding-exports] missing source asset: ${path.relative(root, file)}`);
      }
    }),
  );
}

async function canReuseExistingOutputs(files) {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        await fs.access(file);
        return true;
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}

function asDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function screenshotImage(browser, {
  src,
  width,
  height,
  output,
  fit = 'contain',
  background = 'transparent',
  objectPosition = 'center center',
}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  await page.setContent(`<!DOCTYPE html>
    <html>
      <head>
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: ${background};
          }
          body {
            display: grid;
            place-items: center;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: ${fit};
            object-position: ${objectPosition};
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${src}" alt="" />
      </body>
    </html>`);

  await page.locator('img').waitFor({ state: 'visible' });
  await page.screenshot({ path: output });
  await page.close();
}

async function screenshotSplash(browser, {
  src,
  width,
  height,
  output,
}) {
  const iconSize = Math.max(112, Math.round(Math.min(width, height) * 0.34));
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  await page.setContent(`<!DOCTYPE html>
    <html>
      <head>
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background:
              radial-gradient(circle at 50% 24%, rgba(59, 130, 246, 0.18), transparent 28%),
              linear-gradient(180deg, #081321 0%, ${brandBackground} 100%);
          }
          body {
            display: grid;
            place-items: center;
          }
          .frame {
            display: grid;
            place-items: center;
            width: ${iconSize}px;
            height: ${iconSize}px;
            border-radius: ${Math.round(iconSize * 0.23)}px;
            overflow: hidden;
            box-shadow:
              0 28px 72px rgba(4, 8, 16, 0.42),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);
          }
          img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="frame">
          <img src="${src}" alt="" />
        </div>
      </body>
    </html>`);

  await page.locator('.frame').waitFor({ state: 'visible' });
  await page.screenshot({ path: output });
  await page.close();
}
