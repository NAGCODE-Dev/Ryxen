import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = process.cwd();
const svgPath = path.join(root, 'icons', 'crossapp-mark.svg');
const svgMarkup = await fs.readFile(svgPath, 'utf8');

const pngOutputs = [
  { size: 192, output: path.join(root, 'icons', 'icon-192.png') },
  { size: 512, output: path.join(root, 'icons', 'icon-512.png') },
  { size: 48, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-mdpi', 'ic_launcher.png') },
  { size: 48, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-mdpi', 'ic_launcher_round.png') },
  { size: 48, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-mdpi', 'ic_launcher_foreground.png') },
  { size: 72, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher.png') },
  { size: 72, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher_round.png') },
  { size: 72, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher_foreground.png') },
  { size: 96, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xhdpi', 'ic_launcher.png') },
  { size: 96, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xhdpi', 'ic_launcher_round.png') },
  { size: 96, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xhdpi', 'ic_launcher_foreground.png') },
  { size: 144, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi', 'ic_launcher.png') },
  { size: 144, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi', 'ic_launcher_round.png') },
  { size: 144, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxhdpi', 'ic_launcher_foreground.png') },
  { size: 192, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png') },
  { size: 192, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_round.png') },
  { size: 192, output: path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher_foreground.png') },
];

const browser = await chromium.launch({ headless: true });

for (const { size, output } of pngOutputs) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });

  await page.setContent(
    [
      '<!DOCTYPE html>',
      '<html><head><style>html,body{margin:0;width:100%;height:100%;background:#09111f;overflow:hidden}body{display:grid;place-items:center}#mark{display:block}#mark svg{width:100%;height:100%;display:block}</style></head><body>',
      `<div id="mark" style="width:${size}px;height:${size}px;display:block">${svgMarkup}</div>`,
      '</body></html>',
    ].join(''),
  );

  await page.waitForSelector('#mark svg');

  await page.screenshot({
    path: output,
  });

  await page.close();
}

await browser.close();

console.log('[generate-brand-icons] ok');
