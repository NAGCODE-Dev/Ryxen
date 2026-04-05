import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = process.cwd();
const exportsDir = path.join(root, 'branding', 'exports');

const jobs = [
  {
    source: path.join(root, 'branding', 'crossapp-icon.svg'),
    outputs: [
      { size: 1024, name: 'crossapp-icon-1024.png' },
      { size: 512, name: 'crossapp-icon-512.png' },
      { size: 192, name: 'crossapp-icon-192.png' },
      { size: 180, name: 'crossapp-icon-180.png' },
      { size: 32, name: 'crossapp-icon-32.png' },
    ],
  },
  {
    source: path.join(root, 'branding', 'crossapp-logo-horizontal.svg'),
    outputs: [
      { width: 940, height: 240, name: 'crossapp-logo-horizontal.png' },
      { width: 470, height: 120, name: 'crossapp-logo-horizontal@2x-half.png' },
      { width: 1200, height: 630, name: 'crossapp-social-og.png' },
    ],
  },
  {
    source: path.join(root, 'branding', 'crossapp-logo-white.svg'),
    outputs: [
      { width: 940, height: 240, name: 'crossapp-logo-white.png' },
    ],
  },
  {
    source: path.join(root, 'branding', 'crossapp-logo-black.svg'),
    outputs: [
      { width: 940, height: 240, name: 'crossapp-logo-black.png' },
    ],
  },
];

await fs.mkdir(exportsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const job of jobs) {
  const svgMarkup = await fs.readFile(job.source, 'utf8');

  for (const output of job.outputs) {
    const width = output.width || output.size;
    const height = output.height || output.size;
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });

    await page.setContent(
      [
        '<!DOCTYPE html>',
        '<html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:grid;place-items:center}#art{width:100%;height:100%;display:block}#art svg{width:100%;height:100%;display:block}</style></head><body>',
        `<div id="art">${svgMarkup}</div>`,
        '</body></html>',
      ].join(''),
    );

    await page.waitForSelector('#art svg');
    await page.screenshot({
      path: path.join(exportsDir, output.name),
      omitBackground: true,
    });
    await page.close();
  }
}

await browser.close();

console.log('[generate-branding-exports] ok');
