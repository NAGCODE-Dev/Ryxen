import { test, expect } from '@playwright/test';
import { buildE2ETestEmail, E2E_API_BASE_URL, signUpViaApi } from './helpers/auth.js';

const resetEmail = process.env.E2E_RESET_EMAIL || '';
const resetNewPassword = process.env.E2E_RESET_NEW_PASSWORD || '';
const resetExpectPreview = String(process.env.E2E_RESET_EXPECT_PREVIEW || 'false').trim().toLowerCase() === 'true';
const runResetApi = String(process.env.E2E_RESET_API || 'false').trim().toLowerCase() === 'true';

test.describe('password reset flow', () => {
  test('abre a tela de recuperação de senha', async ({ page }) => {
    await page.goto('/sports/cross/');
    await page.locator('[data-action="modal:open"][data-modal="auth"]').first().click();
    await page.locator('[data-action="auth:reset-toggle"]').first().click();

    await expect(page.locator('#reset-email')).toBeVisible();
    await expect(page.locator('#reset-code')).toBeVisible();
    await expect(page.locator('#reset-newPassword')).toBeVisible();
    await expect(page.locator('body')).toContainText(/Recuperação|Trocar senha/i);
  });

  test('usuário pede código e o backend aceita o reset', async ({ page, request }) => {
    test.skip(!runResetApi, 'Defina E2E_RESET_API=true para validar o endpoint real de reset.');
    test.setTimeout(60000);
    const email = resetEmail || buildE2ETestEmail('reset');
    const password = 'Athlete123';

    if (!resetEmail) {
      await signUpViaApi(request, {
        name: 'Reset E2E',
        email,
        password,
      });
    }

    await page.goto('/sports/cross/');
    await page.locator('[data-action="modal:open"][data-modal="auth"]').first().click();
    await page.locator('[data-action="auth:reset-toggle"]').first().click();
    await page.locator('#reset-email').fill(email);
    const resetResponse = await request.post(`${E2E_API_BASE_URL}/auth/request-password-reset`, {
      data: { email },
    });
    expect(resetResponse.ok()).toBeTruthy();
    const resetResult = await resetResponse.json();
    expect(resetResult?.success).toBeTruthy();
    await expect(page.locator('#reset-email')).toHaveValue(email);

    if (resetExpectPreview) {
      test.skip(!resetNewPassword, 'Defina E2E_RESET_NEW_PASSWORD para confirmar o reset com preview.');
      const code = String(resetResult?.previewCode || '').trim();
      expect(code).toBeTruthy();
      await page.locator('#reset-code').fill(code);
      await page.locator('#reset-newPassword').fill(resetNewPassword);
      const confirmResponse = await request.post(`${E2E_API_BASE_URL}/auth/confirm-password-reset`, {
        data: {
          email,
          code,
          newPassword: resetNewPassword,
        },
      });
      expect(confirmResponse.ok()).toBeTruthy();
      const confirmResult = await confirmResponse.json();
      expect(confirmResult?.success).toBeTruthy();
    }
  });
});
