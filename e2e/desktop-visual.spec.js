import { test, expect } from '@playwright/test';
import { hydrateAuthenticatedSession, signInViaApi } from './helpers/auth.js';

const athleteEmail = process.env.E2E_ATHLETE_EMAIL || '';
const athletePassword = process.env.E2E_ATHLETE_PASSWORD || '';

test.describe('desktop visual shell', () => {
  test.use({ viewport: { width: 1440, height: 1100 } });

  test('fluxo anônimo do atleta mantém sidebar e entrada curta no desktop', async ({ page }) => {
    await page.goto('/sports/cross/');
    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('body')).toContainText(/Acompanhe seu treino sem complicar/i);
    await expect(page.locator('body')).toContainText(/Entrar/i);
    await expect(page.locator('body')).toContainText(/Criar conta/i);

    await expect(page.locator('.app-container')).toHaveScreenshot('athlete-anon-desktop-shell.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
    });
  });

  test('perfil desktop autenticado mantém sidebar e leitura analítica', async ({ browser, request }) => {
    test.skip(!athleteEmail || !athletePassword, 'Defina E2E_ATHLETE_EMAIL e E2E_ATHLETE_PASSWORD para validar o Perfil desktop autenticado.');

    const auth = await signInViaApi(request, { email: athleteEmail, password: athletePassword });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await hydrateAuthenticatedSession(context, auth);
    const page = await context.newPage();

    await page.goto('/sports/cross/');
    await page.locator('[data-action="page:set"][data-page="history"]').first().click();
    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.profile-analyticsDesktop')).toBeVisible();

    await expect(page.locator('.app-container')).toHaveScreenshot('athlete-profile-desktop-shell.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      mask: [page.locator('.header-account')],
    });

    await context.close();
  });
});
