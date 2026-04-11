import { createServer } from 'node:http';
import { cp, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const exportsDir = path.join(root, 'branding', 'exports');
const distExportsDir = path.join(distDir, 'branding', 'exports');
const coachShotPath = path.join(exportsDir, 'ryxen-coach-portal-shot.png');
const ogPath = path.join(exportsDir, 'ryxen-social-og.png');
const athleteShotPath = path.join(exportsDir, 'ryxen-athlete-product-shot.png');

await ensureBuildArtifacts();

const server = createStaticServer(distDir);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const serverPort = typeof address === 'object' && address ? address.port : 4174;
console.log('[generate-marketing-assets] static server started on port', serverPort);

let browser = null;

async function launchBrowser() {
  try {
    const instance = await chromium.launch({ headless: true });
    console.log('[generate-marketing-assets] browser launched successfully');
    return instance;
  } catch (error) {
    console.error('[generate-marketing-assets] failed to launch browser:', error.message);
    if (await canReuseExistingOutputs([coachShotPath, ogPath])) {
      await syncArtifactsToDist();
      await closeServerSafely(server);
      console.log('[generate-marketing-assets] reusing committed exports (playwright browser unavailable)');
      process.exit(0);
    }
    throw error;
  }
}

async function closeServerSafely(srv) {
  return new Promise((resolve, reject) => {
    srv.close((error) => {
      if (error) {
        console.error('[generate-marketing-assets] error closing server:', error.message);
        reject(error);
      } else {
        console.log('[generate-marketing-assets] server closed successfully');
        resolve();
      }
    });
  });
}

async function closeBrowserSafely(instance) {
  if (!instance) return;
  try {
    await instance.close();
    console.log('[generate-marketing-assets] browser closed successfully');
  } catch (error) {
    console.error('[generate-marketing-assets] error closing browser:', error.message);
  }
}

browser = await launchBrowser();

try {
  await captureCoachPortalShot(browser);
  await generateOgImage(browser);
  await syncArtifactsToDist();
  console.log('[generate-marketing-assets] all marketing assets generated successfully');
} catch (error) {
  console.error('[generate-marketing-assets] error during asset generation:', error.message);
  throw error;
} finally {
  await closeBrowserSafely(browser);
  await closeServerSafely(server);
}

async function ensureBuildArtifacts() {
  await waitForFile(path.join(distDir, 'index.html'));
  await waitForFile(path.join(distDir, 'coach', 'index.html'));
  await waitForFile(athleteShotPath);
  await waitForFile(path.join(exportsDir, 'ryxen-logo-horizontal.png'));
}

function createStaticServer(baseDir) {
  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';

      const filePath = path.join(baseDir, pathname.replace(/^\/+/, ''));
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function captureCoachPortalShot(browser) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });

  await page.goto(`http://127.0.0.1:${serverPort}/coach/`, { waitUntil: 'networkidle' });
  await page.locator('.auth-layout').screenshot({
    path: coachShotPath,
  });
  await page.close();
}

async function generateOgImage(browser) {
  const [wordmarkPng, athleteShot, coachShot] = await Promise.all([
    readFile(path.join(root, 'branding', 'exports', 'ryxen-logo-horizontal.png')),
    readFile(athleteShotPath),
    readFile(coachShotPath),
  ]);

  const athleteData = asDataUrl(athleteShot, 'image/png');
  const coachData = asDataUrl(coachShot, 'image/png');
  const wordmarkData = asDataUrl(wordmarkPng, 'image/png');

  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });

  await page.setContent(`<!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            font-family: "Space Grotesk", "Segoe UI", sans-serif;
            background:
              radial-gradient(circle at top left, rgba(47, 143, 255, 0.28), transparent 28%),
              radial-gradient(circle at 88% 16%, rgba(255, 130, 48, 0.22), transparent 24%),
              linear-gradient(180deg, #071427 0%, #09111b 100%);
            color: #f8fafc;
          }
          .frame {
            position: relative;
            width: 100%;
            height: 100%;
            padding: 42px 46px;
            display: grid;
            grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
            gap: 34px;
          }
          .copy {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .eyebrow {
            display: inline-flex;
            align-items: center;
            width: max-content;
            min-height: 34px;
            padding: 0 14px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(255,255,255,0.04);
            color: #60a5fa;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .wordmark {
            width: 230px;
            height: auto;
            margin: 18px 0 22px;
          }
          h1 {
            margin: 0;
            max-width: 9ch;
            font-size: 68px;
            line-height: 0.92;
            letter-spacing: -0.065em;
          }
          p {
            margin: 18px 0 0;
            max-width: 31ch;
            color: rgba(226, 232, 240, 0.82);
            font-size: 23px;
            line-height: 1.45;
          }
          .signals {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 28px;
          }
          .signals span {
            display: inline-flex;
            align-items: center;
            min-height: 38px;
            padding: 0 14px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.16);
            background: rgba(255,255,255,0.04);
            color: rgba(226, 232, 240, 0.86);
            font-size: 15px;
            font-weight: 600;
          }
          .shots {
            position: relative;
            display: grid;
            align-content: end;
          }
          .athleteShot,
          .coachShot {
            border-radius: 28px;
            border: 1px solid rgba(148, 163, 184, 0.16);
            box-shadow: 0 24px 90px rgba(0, 0, 0, 0.34);
            overflow: hidden;
            background: rgba(255,255,255,0.04);
          }
          .athleteShot {
            width: 100%;
            transform: rotate(-3deg) translateY(10px);
          }
          .coachShot {
            position: absolute;
            right: -12px;
            top: 18px;
            width: 58%;
            transform: rotate(5deg);
          }
          .athleteShot img,
          .coachShot img {
            display: block;
            width: 100%;
            height: auto;
          }
          .caption {
            display: flex;
            justify-content: space-between;
            margin-top: 16px;
            color: rgba(226, 232, 240, 0.74);
            font-size: 15px;
            letter-spacing: -0.01em;
          }
        </style>
      </head>
      <body>
        <div class="frame">
          <div class="copy">
            <div>
              <div class="eyebrow">Ryxen</div>
              <img class="wordmark" src="${wordmarkData}" alt="Ryxen">
              <h1>Cada lado entra no lugar certo.</h1>
              <p>Treino, evolução e gestão em experiências próprias, claras e prontas para o uso real.</p>
              <div class="signals">
                <span>Treino do dia</span>
                <span>Portal dedicado</span>
                <span>Evolução contínua</span>
              </div>
            </div>
            <div class="caption">
              <span>ryxen-app.vercel.app</span>
              <span>Cross no núcleo. Expansão com clareza.</span>
            </div>
          </div>
          <div class="shots">
            <div class="coachShot"><img src="${coachData}" alt=""></div>
            <div class="athleteShot"><img src="${athleteData}" alt=""></div>
          </div>
        </div>
      </body>
    </html>`);

  await page.screenshot({ path: ogPath });
  await page.close();
}

function asDataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function syncArtifactsToDist() {
  await mkdir(distExportsDir, { recursive: true });
  await cp(coachShotPath, path.join(distExportsDir, 'ryxen-coach-portal-shot.png'));
  await cp(ogPath, path.join(distExportsDir, 'ryxen-social-og.png'));
}

async function waitForFile(filePath, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await stat(filePath);
      return;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function canReuseExistingOutputs(files) {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        await stat(file);
        return true;
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}
