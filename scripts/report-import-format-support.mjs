import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { classifyUniversalImportFile } from '../src/app/importFileTypes.js';
import { parseTextIntoWeeks } from '../src/app/workoutHelpers.js';
import { extractTextFromSpreadsheetFile } from '../src/adapters/spreadsheet/spreadsheetReader.js';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const fixturesDir = path.join(rootDir, '__tests__', 'fixtures', 'imports');
const manifestPath = path.join(fixturesDir, 'manifest.json');
const port = Number(process.env.IMPORT_REPORT_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

async function main() {
  await ensureFixtures();
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const server = await startStaticServer();

  try {
    const browserFixtures = manifest.filter((item) => item.category === 'pdf' || item.category === 'image');
    const localFixtures = manifest.filter((item) => !browserFixtures.includes(item));

    const results = [];
    for (const fixture of localFixtures) {
      console.log(`Processando ${fixture.name}...`);
      results.push(await evaluateFixtureInNode(fixture));
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(120_000);
      await page.goto(`${baseURL}/index.html`, { waitUntil: 'domcontentloaded' });

      for (const fixture of browserFixtures) {
        console.log(`Processando ${fixture.name}...`);
        const result = await evaluateFixtureInBrowser(page, fixture);
        results.push(result);
      }
    } finally {
      await browser.close();
    }

    printReport(results);
  } finally {
    await stopProcess(server);
  }
}

async function ensureFixtures() {
  try {
    await fs.access(manifestPath);
  } catch {
    await runNodeScript(path.join(rootDir, 'scripts', 'generate-import-fixtures.mjs'));
  }
}

async function evaluateFixtureInNode(fixture) {
  const filePath = path.join(fixturesDir, fixture.name);
  const buffer = await fs.readFile(filePath);
  const file = makeNodeFileLike(fixture.name, fixture.mime, buffer);
  const classification = classifyUniversalImportFile(file);

  let extractedText = '';
  let parsedWeeks = [];
  let note = '';

  try {
    if (classification.source === 'spreadsheet') {
      extractedText = await extractTextFromSpreadsheetFile(file);
    } else if (classification.source === 'text') {
      extractedText = await file.text();
    } else {
      note = classification.error || 'Formato fora do escopo local';
    }

    if (extractedText) {
      parsedWeeks = parseTextIntoWeeks(extractedText, 19);
      if (!parsedWeeks.length) {
        note = 'Leu o arquivo, mas não virou semana importável';
      }
    } else if (!note) {
      note = 'Extração vazia';
    }
  } catch (error) {
    note = error?.message || String(error);
  }

  return buildResult(fixture, classification.source, extractedText, parsedWeeks, note);
}

function evaluateFixtureInBrowser(page, fixture) {
  return page.evaluate(async (item) => {
    const [{ classifyUniversalImportFile }, { parseTextIntoWeeks }, pdfModule, imageModule] = await Promise.all([
      import('/src/app/importFileTypes.js'),
      import('/src/app/workoutHelpers.js'),
      import('/src/adapters/pdf/pdfReader.js'),
      import('/src/adapters/media/ocrReader.js'),
    ]);

    const response = await fetch(`/__tests__/fixtures/imports/${item.name}`);
    const blob = await response.blob();
    const file = new File([blob], item.name, { type: item.mime });
    const classification = classifyUniversalImportFile(file);

    let extractedText = '';
    let parsedWeeks = [];
    let note = '';

    try {
      if (classification.source === 'pdf') {
        extractedText = await pdfModule.extractTextFromFile(file);
      } else if (classification.source === 'image') {
        extractedText = await imageModule.extractTextFromImageFile(file);
      } else {
        note = classification.error || 'Formato fora do escopo';
      }

      if (extractedText) {
        parsedWeeks = parseTextIntoWeeks(extractedText, 19);
        if (!parsedWeeks.length) {
          note = 'Leu o arquivo, mas não virou semana importável';
        }
      } else if (!note) {
        note = 'Extração vazia';
      }
    } catch (error) {
      note = error?.message || String(error);
    }

    return {
      name: item.name,
      category: item.category,
      format: item.format,
      quality: item.quality,
      shouldParse: item.shouldParse,
      classification: classification.source,
      parsed: parsedWeeks.length > 0,
      weeks: parsedWeeks.length,
      extractedChars: extractedText.length,
      note,
    };
  }, fixture);
}

function printReport(results) {
  const enriched = results.map((item) => ({
    ...item,
    expectation: item.parsed === item.shouldParse,
  }));

  console.table(
    enriched.map((item) => ({
      file: item.name,
      category: item.category,
      format: item.format,
      quality: item.quality,
      parsed: item.parsed,
      weeks: item.weeks,
      chars: item.extractedChars,
      expected: item.shouldParse,
      ok: item.expectation,
      note: item.note,
    })),
  );

  console.log('');
  console.table(summarize(enriched, 'quality'));
  console.log('');
  console.table(summarize(enriched, 'format'));
  console.log('');
  console.table(summarize(enriched, 'category'));

  const parsedCount = enriched.filter((item) => item.parsed).length;
  const expectationCount = enriched.filter((item) => item.expectation).length;
  const total = enriched.length || 1;

  console.log(`\nTaxa de sucesso real: ${parsedCount}/${enriched.length} (${toRate(parsedCount, total)}%)`);
  console.log(`Aderência ao esperado: ${expectationCount}/${enriched.length} (${toRate(expectationCount, total)}%)`);
}

function summarize(items, field) {
  const grouped = new Map();
  for (const item of items) {
    const key = item[field];
    if (!grouped.has(key)) {
      grouped.set(key, { key, total: 0, parsed: 0, expectedOk: 0 });
    }
    const entry = grouped.get(key);
    entry.total += 1;
    if (item.parsed) entry.parsed += 1;
    if (item.expectation) entry.expectedOk += 1;
  }

  return Array.from(grouped.values()).map((entry) => ({
    [field]: entry.key,
    total: entry.total,
    parsed: `${entry.parsed}/${entry.total}`,
    parseRate: `${toRate(entry.parsed, entry.total)}%`,
    expectedOk: `${entry.expectedOk}/${entry.total}`,
    expectationRate: `${toRate(entry.expectedOk, entry.total)}%`,
  }));
}

function toRate(value, total) {
  return Number(((value / total) * 100).toFixed(1));
}

function makeNodeFileLike(name, type, buffer) {
  return {
    name,
    type,
    async arrayBuffer() {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
    async text() {
      return buffer.toString('utf8');
    },
  };
}

function buildResult(fixture, classification, extractedText, parsedWeeks, note) {
  return {
    name: fixture.name,
    category: fixture.category,
    format: fixture.format,
    quality: fixture.quality,
    shouldParse: fixture.shouldParse,
    classification,
    parsed: parsedWeeks.length > 0,
    weeks: parsedWeeks.length,
    extractedChars: extractedText.length,
    note,
  };
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('python3', ['-m', 'http.server', String(port)], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let settled = false;

    server.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    server.on('close', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(stderr.trim() || `Falha ao subir servidor estático (${code})`));
      }
    });

    waitForServer()
      .then(() => {
        if (!settled) {
          settled = true;
          resolve(server);
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          server.kill('SIGTERM');
          reject(error);
        }
      });
  });
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${baseURL}/index.html`);
      if (response.ok) return;
    } catch {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Servidor estático não respondeu a tempo');
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }
    child.on('close', () => resolve());
    child.kill('SIGTERM');
  });
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Falha ao rodar ${scriptPath}`));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
