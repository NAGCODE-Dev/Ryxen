// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('landing page shows athlete and coach entry points', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Ryxen/);
  await expect(page.getByRole('heading', { name: /importe treino, acompanhe evolução/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /abrir cross/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /coach portal/i }).first()).toBeVisible();
  await expect(page.getByText(/dois caminhos\. sem confusão\./i)).toBeVisible();
});

test('coach portal shows login actions and support links', async ({ page }) => {
  await page.goto('/coach/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/Ryxen Coach/);
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('link', { name: /abrir app do atleta/i })).toHaveAttribute('href', '/');
  await expect(page.getByText(/operação do coach/i).first()).toBeVisible();
  await expect(page.getByText('Publique treinos', { exact: true })).toBeVisible();
});
