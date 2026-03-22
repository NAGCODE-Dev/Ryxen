import { test, expect } from '@playwright/test';
import { hydrateAuthenticatedSession, signInViaApi } from './helpers/auth.js';

const athleteEmail = process.env.E2E_ATHLETE_EMAIL || '';
const athletePassword = process.env.E2E_ATHLETE_PASSWORD || '';

test.describe('athlete authenticated flow', () => {
  test.skip(!athleteEmail || !athletePassword, 'Defina E2E_ATHLETE_EMAIL e E2E_ATHLETE_PASSWORD para rodar os fluxos autenticados do atleta.');

  test('navega entre hoje, histórico, competições e conta', async ({ browser, request }) => {
    const auth = await signInViaApi(request, { email: athleteEmail, password: athletePassword });
    const context = await browser.newContext();
    await hydrateAuthenticatedSession(context, auth);
    const page = await context.newPage();

    await page.goto('/sports/cross/');
    await expect(page.locator('body')).toContainText(/Treino do dia|Comece pelo treino certo/i);

    await page.locator('[data-action="page:set"][data-page="history"]').first().click();
    await expect(page.locator('body')).toContainText(/Sua evolução no box|Biblioteca de benchmarks/i);

    await page.locator('[data-action="page:set"][data-page="competitions"]').first().click();
    await expect(page.locator('body')).toContainText(/Competições/i);

    await page.locator('[data-action="page:set"][data-page="account"]').first().click();
    await expect(page.locator('body')).toContainText(/Sua conta|Conta/i);

    await context.close();
  });
});
