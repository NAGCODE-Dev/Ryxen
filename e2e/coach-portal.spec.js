import { test, expect } from '@playwright/test';

const coachEmail = process.env.E2E_COACH_EMAIL || '';
const coachPassword = process.env.E2E_COACH_PASSWORD || '';

test.describe('coach portal flow', () => {
  test.skip(!coachEmail || !coachPassword, 'Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD para rodar os fluxos autenticados do coach.');

  test('coach faz login e atualiza dashboard', async ({ page }) => {
    await page.goto('/coach/');
    await page.getByPlaceholder('Email').fill(coachEmail);
    await page.getByPlaceholder('Senha').fill(coachPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.locator('h1')).toContainText('Coach Portal');
    await expect(page.locator('body')).toContainText(/Operação do coach|Assinatura|Gyms|Membros/i);

    const refreshButton = page.getByRole('button', { name: /Atualizar dados|Atualizando/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();
    await expect(page.locator('body')).toContainText('Coach Portal');
  });
});
