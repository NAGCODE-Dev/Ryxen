import { test, expect } from '@playwright/test';
import { hydrateAuthenticatedSession, signInViaApi } from './helpers/auth.js';

const athleteEmail = process.env.E2E_ATHLETE_EMAIL || '';
const athletePassword = process.env.E2E_ATHLETE_PASSWORD || '';

test.describe('athlete benchmark flow', () => {
  test.skip(!athleteEmail || !athletePassword, 'Defina E2E_ATHLETE_EMAIL e E2E_ATHLETE_PASSWORD para rodar o fluxo de benchmark.');

  test('seleciona benchmark, envia resultado e mantém leaderboard visível', async ({ browser, request }) => {
    const auth = await signInViaApi(request, { email: athleteEmail, password: athletePassword });
    const context = await browser.newContext();
    await hydrateAuthenticatedSession(context, auth);
    const page = await context.newPage();

    await page.goto('/sports/cross/');
    await page.locator('[data-action="page:set"][data-page="history"]').first().click();
    await expect(page.locator('body')).toContainText(/Biblioteca de benchmarks/i);

    const benchmarkButton = page.locator('[data-action="benchmark:select"]').first();
    await expect(benchmarkButton).toBeVisible();
    await benchmarkButton.click();

    const detailCard = page.locator('.benchmark-detailCard');
    await expect(detailCard).toBeVisible();
    await expect(detailCard).toContainText(/Estrutura|Leaderboard/i);

    const detailText = (await detailCard.textContent()) || '';
    let scoreValue = '03:24';
    if (/Rounds \+ reps/i.test(detailText)) scoreValue = '1+1';
    else if (/Carga/i.test(detailText)) scoreValue = '100 kg';
    else if (/Repetições/i.test(detailText)) scoreValue = '50';

    await page.locator('#benchmark-score-input').fill(scoreValue);
    await page.locator('#benchmark-notes-input').fill('E2E benchmark result');
    await page.locator('[data-action="benchmark:submit"]').click();

    await expect(page.locator('body')).toContainText(/Resultado registrado/i);
    await expect(detailCard).toContainText(/Seu histórico neste benchmark|Sua melhor marca/i);
    await expect(detailCard).toContainText(/Leaderboard/i);

    await context.close();
  });
});
