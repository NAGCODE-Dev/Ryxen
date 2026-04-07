import { test, expect } from '@playwright/test';

test('home, pricing e coach portal públicos carregam', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ryxen/i);
  await expect(page.locator('body')).toContainText('Ryxen');

  await page.goto('/pricing.html');
  await expect(page).toHaveTitle(/Planos|Ryxen/i);
  await expect(page.locator('body')).toContainText(/Coach Starter|Coach Pro|Coach Performance/i);

  await page.goto('/coach/');
  await expect(page.locator('h1')).toContainText('Coach Portal');
  await expect(page.locator('body')).toContainText(/Entrar|Voltar para a plataforma|Recuperar senha/i);

  await page.goto('/support.html');
  await expect(page).toHaveTitle(/Suporte|Ryxen/i);
  await expect(page.locator('body')).toContainText(/Suporte|Ryxen/i);

  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(/Privacidade|Ryxen/i);
  await expect(page.locator('body')).toContainText(/Privacidade|dados pessoais|Ryxen/i);

  await page.goto('/terms.html');
  await expect(page).toHaveTitle(/Termos|Ryxen/i);
  await expect(page.locator('body')).toContainText(/Termos|uso|Ryxen/i);
});

test('app do atleta abre modal de autenticação para usuário anônimo', async ({ page }) => {
  await page.goto('/sports/cross/');
  await page.locator('[data-action="modal:open"][data-modal="auth"]').first().click();
  await expect(page.locator('.modal-title')).toContainText(/Entrar|Criar conta|Recuperar senha|Acessar sua conta/i);
  await expect(page.locator('#auth-email')).toBeVisible();
});
