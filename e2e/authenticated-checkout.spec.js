import { test, expect } from '@playwright/test';
import { hydrateAuthenticatedSession, signInViaApi } from './helpers/auth.js';

const athleteEmail = process.env.E2E_ATHLETE_EMAIL || '';
const athletePassword = process.env.E2E_ATHLETE_PASSWORD || '';

test.describe('authenticated checkout flow', () => {
  test.skip(!athleteEmail || !athletePassword, 'Defina E2E_ATHLETE_EMAIL e E2E_ATHLETE_PASSWORD para validar checkout autenticado.');

  test('pricing envia usuário autenticado direto para o checkout sem abrir auth', async ({ browser, request }) => {
    const auth = await signInViaApi(request, { email: athleteEmail, password: athletePassword });
    const context = await browser.newContext();
    await hydrateAuthenticatedSession(context, auth);
    const page = await context.newPage();

    await page.goto('/pricing.html');
    await expect(page.locator('body')).toContainText(/Atleta Plus/i);

    await Promise.all([
      page.waitForURL((url) => /pay\.kiwify\.com\.br|checkout\.kiwify/i.test(url.toString()), { timeout: 15000 }),
      page.getByRole('link', { name: /Assinar Atleta Plus/i }).click(),
    ]);

    await expect(page).not.toHaveURL(/sports\/cross/i);
    await expect(page).toHaveURL(/pay\.kiwify\.com\.br|checkout\.kiwify/i);

    await context.close();
  });
});
