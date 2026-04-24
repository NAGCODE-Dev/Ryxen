// @ts-check
import { test, expect } from '@playwright/test';

test('landing shows official wordmark and balanced product shots', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Ryxen/i);
  await expect(page.locator('img.hub-wordmark[alt="Ryxen"]')).toBeVisible();

  const coachShot = page.locator('img[alt*="Coach Portal do Ryxen"]');
  await expect(coachShot).toBeVisible();
  await expect.poll(async () => coachShot.evaluate((img) => img.naturalWidth)).toBeGreaterThan(1000);
  await expect.poll(async () => coachShot.evaluate((img) => img.naturalHeight)).toBeGreaterThan(700);

  const coachSize = await coachShot.evaluate((img) => ({
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  }));

  expect(coachSize.naturalWidth).toBeGreaterThan(1000);
  expect(coachSize.naturalHeight).toBeGreaterThan(700);
});

test('coach login shell renders cleanly', async ({ page }) => {
  await page.goto('/coach/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Ryxen Coach/i);
  await expect(page.getByRole('heading', { name: /Coach Portal/i })).toBeVisible();
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuar com Google/i })).toBeVisible();
});

test('athlete react shell renders today pilot cleanly', async ({ page }) => {
  await page.goto('/athlete/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Ryxen Athlete/i);
  await expect(page.getByRole('heading', { name: /Editorial Today/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Importar plano/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Abrir legado/i })).toBeVisible();
});
