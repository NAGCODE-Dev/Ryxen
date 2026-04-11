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
            font-family: "Manrope", "Segoe UI", sans-serif;
            background:
              radial-gradient(circle at top left, rgba(66, 142, 255, 0.16), transparent 28%),
              linear-gradient(180deg, #08111b 0%, #0a1017 100%);
          }
          body {
            padding: 24px;
          }
          .frame {
            width: 100%;
            height: 100%;
            border-radius: 34px;
            overflow: hidden;
            border: 1px solid rgba(196, 210, 233, 0.12);
            background:
              linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
              rgba(12, 17, 24, 0.98);
            box-shadow: 0 34px 92px rgba(4, 8, 16, 0.28);
            display: grid;
            grid-template-columns: 260px minmax(0, 1fr);
          }
          .sidebar {
            display: grid;
            align-content: start;
            gap: 18px;
            padding: 24px 20px;
            border-right: 1px solid rgba(196, 210, 233, 0.1);
            background:
              linear-gradient(180deg, rgba(18, 23, 31, 0.98), rgba(12, 16, 22, 0.94)),
              radial-gradient(circle at top, rgba(168, 194, 247, 0.08), transparent 30%);
          }
          .brand {
            display: grid;
            gap: 10px;
          }
          .brand small {
            color: rgba(186, 196, 211, 0.72);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .brand strong {
            color: #f3f6fb;
            font-size: 30px;
            line-height: 0.94;
            letter-spacing: -0.05em;
          }
          .brand p {
            margin: 0;
            color: rgba(211, 220, 232, 0.72);
            font-size: 13px;
            line-height: 1.55;
          }
          .nav {
            display: grid;
            gap: 10px;
          }
          .navItem {
            min-height: 44px;
            display: flex;
            align-items: center;
            padding: 0 14px;
            border-radius: 14px;
            border: 1px solid rgba(196, 210, 233, 0.08);
            background: rgba(255,255,255,0.03);
            color: rgba(225, 231, 241, 0.82);
            font-size: 14px;
            font-weight: 700;
          }
          .navItem.active {
            color: #f8fbff;
            border-color: rgba(66, 142, 255, 0.28);
            background:
              linear-gradient(180deg, rgba(66, 142, 255, 0.14), rgba(66, 142, 255, 0.05)),
              rgba(255,255,255,0.03);
          }
          .main {
            padding: 24px;
            display: grid;
            gap: 18px;
            background:
              radial-gradient(circle at top right, rgba(66, 142, 255, 0.08), transparent 24%),
              linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0));
          }
          .hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            padding: 22px;
            border-radius: 24px;
            border: 1px solid rgba(196, 210, 233, 0.12);
            background:
              linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012)),
              rgba(20, 26, 35, 0.92);
          }
          .hero small {
            display: inline-flex;
            min-height: 28px;
            align-items: center;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid rgba(196, 210, 233, 0.12);
            color: #a8c2f7;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: rgba(255,255,255,0.03);
          }
          .hero h2 {
            margin: 14px 0 10px;
            color: #f3f6fb;
            font-size: 34px;
            line-height: 0.96;
            letter-spacing: -0.06em;
            max-width: 11ch;
          }
          .hero p {
            margin: 0;
            max-width: 56ch;
            color: rgba(211, 220, 232, 0.76);
            font-size: 14px;
            line-height: 1.6;
          }
          .heroPills {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 16px;
          }
          .heroPills span {
            display: inline-flex;
            align-items: center;
            min-height: 32px;
            padding: 0 12px;
            border-radius: 999px;
            border: 1px solid rgba(196, 210, 233, 0.12);
            background: rgba(255,255,255,0.03);
            color: rgba(225, 231, 241, 0.82);
            font-size: 12px;
            font-weight: 700;
          }
          .heroStat {
            min-width: 220px;
            display: grid;
            gap: 10px;
          }
          .heroStatCard {
            display: grid;
            gap: 4px;
            padding: 14px;
            border-radius: 18px;
            border: 1px solid rgba(196, 210, 233, 0.1);
            background: rgba(255,255,255,0.03);
          }
          .heroStatCard span {
            color: rgba(172, 186, 206, 0.72);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .heroStatCard strong {
            color: #f3f6fb;
            font-size: 18px;
            line-height: 1.1;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
          }
          .card {
            display: grid;
            gap: 10px;
            padding: 18px;
            border-radius: 22px;
            border: 1px solid rgba(196, 210, 233, 0.1);
            background:
              linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.01)),
              rgba(20, 26, 35, 0.9);
          }
          .card small {
            color: rgba(172, 186, 206, 0.72);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .card strong {
            color: #f3f6fb;
            font-size: 18px;
            line-height: 1.08;
            letter-spacing: -0.03em;
          }
          .card p {
            margin: 0;
            color: rgba(211, 220, 232, 0.74);
            font-size: 13px;
            line-height: 1.55;
          }
        </style>
      </head>
      <body>
        <div class="frame">
          <aside class="sidebar">
            <div class="brand">
              <small>Coach Portal</small>
              <strong>Ryxen</strong>
              <p>Gestão do box, publicação e visão operacional em uma superfície separada do app do atleta.</p>
            </div>
            <div class="nav">
              <div class="navItem active">Visão geral</div>
              <div class="navItem">Publicação</div>
              <div class="navItem">Atletas</div>
              <div class="navItem">Benchmarks</div>
              <div class="navItem">Assinatura</div>
            </div>
          </aside>
          <main class="main">
            <section class="hero">
              <div>
                <small>Experiência do coach</small>
                <h2>Publicar, organizar e acompanhar.</h2>
                <p>Planejamento, grupos, atletas, benchmarks e assinatura ficam em um workspace mais claro para operar no dia a dia.</p>
                <div class="heroPills">
                  <span>Portal dedicado</span>
                  <span>Publicação com contexto</span>
                  <span>Gestão com clareza</span>
                </div>
              </div>
              <div class="heroStat">
                <div class="heroStatCard">
                  <span>Grupo ativo</span>
                  <strong>RX • 18 atletas</strong>
                </div>
                <div class="heroStatCard">
                  <span>Benchmark</span>
                  <strong>Fran • ranking pronto</strong>
                </div>
              </div>
            </section>
            <section class="grid">
              <article class="card">
                <small>Publicação</small>
                <strong>Treinos e blocos organizados</strong>
                <p>Planeje a semana e publique sem misturar a rotina operacional com a experiência do atleta.</p>
              </article>
              <article class="card">
                <small>Atletas</small>
                <strong>Grupos, acessos e contexto</strong>
                <p>Entenda quem está ativo, quem precisa de ajuste e onde cada conta realmente entra.</p>
              </article>
              <article class="card">
                <small>Box</small>
                <strong>Assinatura, portal e uso</strong>
                <p>Billing, período liberado e ferramentas do coach em um lugar só, sem ruído extra.</p>
              </article>
            </section>
          </main>
        </div>
      </body>
    </html>`, { waitUntil: 'load' });

  await page.screenshot({
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
