import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = process.cwd();
const exportsDir = path.join(root, 'branding', 'exports');

const jobs = [
  {
    source: path.join(root, 'branding', 'ryxen-icon.svg'),
    outputs: [
      { size: 1024, name: 'ryxen-icon-1024.png', aliases: ['crossapp-icon-1024.png'] },
      { size: 512, name: 'ryxen-icon-512.png', aliases: ['crossapp-icon-512.png'] },
      { size: 192, name: 'ryxen-icon-192.png', aliases: ['crossapp-icon-192.png'] },
      { size: 180, name: 'ryxen-icon-180.png', aliases: ['crossapp-icon-180.png'] },
      { size: 32, name: 'ryxen-icon-32.png', aliases: ['crossapp-icon-32.png'] },
    ],
  },
  {
    source: path.join(root, 'branding', 'ryxen-logo-horizontal.svg'),
    outputs: [
      { width: 940, height: 240, name: 'ryxen-logo-horizontal.png', aliases: ['crossapp-logo-horizontal.png'] },
      { width: 470, height: 120, name: 'ryxen-logo-horizontal@2x-half.png', aliases: ['crossapp-logo-horizontal@2x-half.png'] },
      { width: 1200, height: 630, name: 'ryxen-social-og.png', aliases: ['crossapp-social-og.png'] },
    ],
  },
  {
    source: path.join(root, 'branding', 'ryxen-logo-white.svg'),
    outputs: [
      { width: 940, height: 240, name: 'ryxen-logo-white.png', aliases: ['crossapp-logo-white.png'] },
    ],
  },
  {
    source: path.join(root, 'branding', 'ryxen-logo-black.svg'),
    outputs: [
      { width: 940, height: 240, name: 'ryxen-logo-black.png', aliases: ['crossapp-logo-black.png'] },
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
    for (const alias of output.aliases || []) {
      await fs.copyFile(path.join(exportsDir, output.name), path.join(exportsDir, alias));
    }
    await page.close();
  }
}

await browser.close();

console.log('[generate-branding-exports] ok');
