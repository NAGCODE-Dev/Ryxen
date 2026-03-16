import { test, expect } from '@playwright/test';
import { hydrateAuthenticatedSession, signInViaApi } from './helpers/auth.js';

const athleteEmail = process.env.E2E_ATHLETE_EMAIL || '';
const athletePassword = process.env.E2E_ATHLETE_PASSWORD || '';

test.describe('athlete base import limit', () => {
  test.skip(!athleteEmail || !athletePassword, 'Defina E2E_ATHLETE_EMAIL e E2E_ATHLETE_PASSWORD para validar o limite de imports do atleta base.');

  test('conta mostra regra de 10 imports/mês e o saldo acompanha o uso local', async ({ browser, request }) => {
    const auth = await signInViaApi(request, { email: athleteEmail, password: athletePassword });
    const context = await browser.newContext();
    await hydrateAuthenticatedSession(context, auth);
    const page = await context.newPage();

    await page.addInitScript(() => {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      localStorage.setItem('crossapp-athlete-usage-v1', JSON.stringify({
        base: {
          [monthKey]: { all: 0 },
        },
      }));
    });

    await page.goto('/sports/cross/');
    await page.locator('[data-action="page:set"][data-page="account"]').first().click();
    await expect(page.locator('body')).toContainText(/10 importações por mês no uso livre|10 imports por mês no plano base/i);

    await page.evaluate(() => {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      localStorage.setItem('crossapp-athlete-usage-v1', JSON.stringify({
        base: {
          [monthKey]: { all: 10 },
        },
      }));
    });

    await page.reload();
    await page.locator('[data-action="page:set"][data-page="account"]').first().click();
    await expect(page.locator('body')).toContainText(/0\/10|10\/10 usado\(s\)|limite mensal/i);

    await context.close();
  });
});
