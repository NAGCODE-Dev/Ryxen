// @ts-check
import path from 'node:path';
import { test, expect, devices } from '@playwright/test';

const IMPORT_FIXTURES_DIR = path.join(process.cwd(), '__tests__', 'fixtures', 'imports');
const CLEAN_TEXT_IMPORT = path.join(IMPORT_FIXTURES_DIR, 'treino-exemplo.txt');
const BSB_ACCEPTED_IMPORTS = [
  path.join(IMPORT_FIXTURES_DIR, 'treino-bsb-clean.png'),
  path.join(IMPORT_FIXTURES_DIR, 'treino-bsb-cropped.png'),
  path.join(IMPORT_FIXTURES_DIR, 'treino-bsb-low-contrast.png'),
  path.join(IMPORT_FIXTURES_DIR, 'treino-bsb-tilted.png'),
];
const BSB_IMPOSSIBLE_IMPORT = path.join(IMPORT_FIXTURES_DIR, 'treino-bsb-impossivel.png');
const REAL_PRS_FIXTURE = path.join(IMPORT_FIXTURES_DIR, 'prs-real-legacy.json');
const PIXEL_7_PROFILE = (({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, colorScheme }) => ({
  viewport,
  userAgent,
  deviceScaleFactor,
  isMobile,
  hasTouch,
  colorScheme,
}))(devices['Pixel 7']);

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function waitForAthleteReady(page) {
  await page.goto('/sports/cross/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body?.dataset.page === 'today');
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading-screen');
    return !!loading && (loading.hidden === true || loading.getAttribute('aria-hidden') === 'true');
  }, null, { timeout: 8000 });
}

async function openAthleteImportModal(page) {
  const existingHeading = page.getByRole('heading', { name: /Adicionar treino/i });
  if (await existingHeading.count()) {
    const isVisible = await existingHeading.first().isVisible().catch(() => false);
    if (isVisible) return;
  }
  const trigger = page.locator('button[data-modal="import"]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('heading', { name: /Adicionar treino/i })).toBeVisible();
}

async function uploadFromUniversalPicker(page, filePath) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Imagem, vídeo, planilha ou texto/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
}

async function importWorkoutAndSave(page, filePath) {
  await openAthleteImportModal(page);
  await uploadFromUniversalPicker(page, filePath);
  await expect(page.getByText('Preview da importação')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Salvar importação/i }).click();
  await page.waitForFunction(() => !document.querySelector('.modal-overlay.isOpen'));
  await page.waitForFunction(() => document.body?.dataset.page === 'today');
}

function bottomNavButton(page, label) {
  return page.locator('.bottom-nav .nav-btn').filter({ hasText: label }).first();
}

function resolveCoachApiMocks(pathname, state) {
  if (pathname === '/billing/status') {
    return { plan: state.subscription.plan, status: state.subscription.status, renewAt: state.subscription.renewAt };
  }
  if (pathname === '/billing/entitlements') {
    return { entitlements: [], gymAccess: [] };
  }
  if (pathname === '/gyms/me') {
    return {
      gyms: [
        { id: 'gym-1', name: 'BSB Strong', role: 'owner', access: { warning: '' } },
      ],
    };
  }
  if (pathname === '/workouts/feed') {
    return { workouts: [] };
  }
  if (pathname === '/benchmarks') {
    return {
      benchmarks: [
        { slug: 'fran', name: 'Fran', category: 'girl', source: 'crossfit' },
        { slug: 'murph', name: 'Murph', category: 'hero', source: 'crossfit' },
      ],
      pagination: { total: 2, page: 1, limit: 30, pages: 1 },
    };
  }
  if (pathname === '/gyms/gym-1/memberships') {
    return { memberships: [] };
  }
  if (pathname === '/gyms/gym-1/groups') {
    return { groups: [] };
  }
  if (pathname === '/gyms/gym-1/insights') {
    return { stats: { athletes: 14, results: 28, activePrs: 9, athletesWithPrs: 7 } };
  }
  return {};
}

async function installCoachDashboardRoutes(page, { failWithHtml = false } = {}) {
  const state = {
    subscription: {
      plan: 'coach',
      status: 'inactive',
      renewAt: null,
    },
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');

    if (failWithHtml && pathname === '/gyms/me') {
      return route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><body>bad gateway</body></html>',
      });
    }

    if (pathname === '/billing/mock/activate' && request.method() === 'POST') {
      state.subscription = {
        plan: 'coach',
        status: 'active',
        renewAt: '2026-05-11T12:00:00.000Z',
      };
      return fulfillJson(route, { ok: true });
    }

    if (pathname.startsWith('/competitions/') || pathname === '/competitions/calendar' || pathname.startsWith('/leaderboards/benchmarks/')) {
      return fulfillJson(route, { error: 'not_found' }, 404);
    }

    return fulfillJson(route, resolveCoachApiMocks(pathname, state));
  });
}

test.describe('athlete hardening', () => {
  test.use(PIXEL_7_PROFILE);

  test('navega, importa treino, abre vídeo uma vez, importa/exporta PRs e exporta backup', async ({ page, context }) => {
    test.setTimeout(90000);

    await waitForAthleteReady(page);

    const bootMetrics = await page.evaluate(() => window.__RYXEN_BOOT_METRICS__);
    expect(bootMetrics?.summary?.ui_mounted ?? 99999).toBeLessThan(3500);
    expect(bootMetrics?.summary?.loading_hidden ?? 99999).toBeLessThan(4000);

    await importWorkoutAndSave(page, CLEAN_TEXT_IMPORT);

    const workoutBlockCount = await page.locator('.workout-block').count();
    expect(workoutBlockCount).toBeGreaterThan(0);

    const popupPromise = context.waitForEvent('page');
    await expect(page.locator('.exercise-helpBtn').first()).toBeVisible();
    await page.locator('.exercise-helpBtn').first().click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    expect(popup.url()).toContain('youtube.com');
    await page.waitForTimeout(600);
    expect(context.pages().filter((entry) => entry !== page).length).toBe(1);
    expect(page.url()).toContain('/sports/cross/index.html');
    await popup.close().catch(() => {});

    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, 1800);
    }
    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, -1800);
    }

    await bottomNavButton(page, 'Evolução').click();
    await page.waitForFunction(() => document.body?.dataset.page === 'history');
    await expect(page.getByRole('heading', { name: 'Evolução' })).toBeVisible();

    await page.getByRole('button', { name: 'PRs' }).click();
    const prsModal = page.locator('.modal-overlay.isOpen');
    await expect(prsModal.getByText(/Importar e exportar/i)).toBeVisible();

    const prsChooserPromise = page.waitForEvent('filechooser');
    await prsModal.getByRole('button', { name: /Importar arquivo/i }).click();
    const prsChooser = await prsChooserPromise;
    await prsChooser.setFiles(REAL_PRS_FIXTURE);

    const backSquatInput = prsModal.locator('input[data-exercise="BACK SQUAT"]');
    await expect(backSquatInput).toHaveValue('146');

    const prDownloadPromise = page.waitForEvent('download');
    await prsModal.getByRole('button', { name: /^Exportar$/ }).click();
    const prDownload = await prDownloadPromise;
    expect(prDownload.suggestedFilename()).toMatch(/\.json$/i);

    await prsModal.getByRole('button', { name: /Salvar tudo/i }).click();
    await expect(page.locator('.ui-toastShow')).toContainText(/PRs salvos|salvos/i);

    await bottomNavButton(page, 'Conta').click();
    await page.waitForFunction(() => document.body?.dataset.page === 'account');

    await page.getByRole('button', { name: 'Dados' }).click();
    const backupDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Fazer backup/i }).click();
    const backupDownload = await backupDownloadPromise;
    expect(backupDownload.suggestedFilename()).toMatch(/backup/i);
  });

  test('aceita screenshots difíceis, rejeita impossível com recuperação da UI e segue navegável', async ({ page }) => {
    test.setTimeout(120000);

    await waitForAthleteReady(page);

    for (const fixture of BSB_ACCEPTED_IMPORTS) {
      await openAthleteImportModal(page);
      await uploadFromUniversalPicker(page, fixture);
      await expect(page.getByText('Preview da importação')).toBeVisible({ timeout: 25000 });
      await page.getByRole('button', { name: /Descartar preview/i }).click();
      await page.waitForFunction(() => !document.querySelector('.import-reviewCard'));
    }

    await openAthleteImportModal(page);
    await uploadFromUniversalPicker(page, BSB_IMPOSSIBLE_IMPORT);
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => {
      const loading = document.getElementById('loading-screen');
      return !!loading && (loading.hidden === true || loading.getAttribute('aria-hidden') === 'true');
    }, null, { timeout: 8000 });

    const openModal = page.locator('.modal-overlay.isOpen');
    if (await openModal.count()) {
      await openModal.locator('.modal-close').click();
    }

    await bottomNavButton(page, 'Conta').click();
    await page.waitForFunction(() => document.body?.dataset.page === 'account');
    await expect(page.getByRole('button', { name: 'Preferências' })).toBeVisible();
  });

  test('entra sem senha com grant confiável salvo no aparelho', async ({ page }) => {
    await page.addInitScript(() => {
      const deviceId = 'device-playwright-trusted';
      const email = 'trusted@example.com';
      localStorage.setItem('ryxen-trusted-device-id', deviceId);
      localStorage.setItem('ryxen-last-auth-email', email);
      localStorage.setItem('ryxen-trusted-device-map', JSON.stringify({
        [email]: {
          deviceId,
          trustedToken: 'trusted-token-demo',
          expiresAt: '2099-01-01T00:00:00.000Z',
          label: 'browser:playwright',
        },
      }));
    });

    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      if (pathname === '/auth/trusted-device/signin') {
        return fulfillJson(route, {
          token: 'token-trusted',
          user: {
            id: 'user-trusted',
            email: 'trusted@example.com',
            name: 'Trusted User',
          },
        });
      }
      return fulfillJson(route, {});
    });

    await waitForAthleteReady(page);
    await page.locator('button[data-modal="auth"]').first().click();

    await expect(page.locator('#auth-email')).toHaveValue('trusted@example.com');
    await expect(page.getByRole('button', { name: /Entrar sem senha neste aparelho/i })).toBeVisible();

    await page.getByRole('button', { name: /Entrar sem senha neste aparelho/i }).click();
    await page.waitForFunction(() => !document.querySelector('.modal-overlay.isOpen'));

    await expect(page.locator('.header-account-btn.isActive')).toContainText(/Trusted User|trusted@example\.com/i);
  });
});

test.describe('coach hardening', () => {
  test('portal do coach trata HTML inválido sem quebrar o parse JSON', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ryxen-auth-token', 'coach-token');
      localStorage.setItem('ryxen-user-profile', JSON.stringify({
        id: 'coach-1',
        email: 'admin@example.com',
        name: 'Coach Admin',
        isAdmin: true,
      }));
    });

    await installCoachDashboardRoutes(page, { failWithHtml: true });

    await page.goto('/coach/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Ryxen Coach/i);
    await expect(page.getByText(/Resposta inesperada do servidor/i)).toBeVisible();
  });

  test('coach aceita ativação local para admin e lê link coach a partir do plano pro da Kiwify', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ryxen-auth-token', 'coach-token');
      localStorage.setItem('ryxen-user-profile', JSON.stringify({
        id: 'coach-2',
        email: 'admin@example.com',
        name: 'Coach Admin',
        isAdmin: true,
      }));
      localStorage.setItem('ryxen-runtime-config', JSON.stringify({
        billing: {
          provider: 'kiwify_link',
          links: {
            starter: 'https://example.com/starter-plan',
            pro: 'https://example.com/pro-plan',
            performance: 'https://example.com/performance-plan',
          },
        },
      }));
    });

    await installCoachDashboardRoutes(page, { failWithHtml: false });

    await page.goto('/coach/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Ativar local' })).toBeVisible();

    await page.getByRole('button', { name: 'Ativar local' }).click();
    await expect(page.getByText(/Plano Coach local ativado/i)).toBeVisible();
    await expect(page.getByText(/Plano coach ativo/i)).toBeVisible();

    await page.locator('.billing-bannerActions').getByRole('button', { name: 'Assinar Coach', exact: true }).click();
    await page.waitForURL('https://example.com/pro-plan', { timeout: 10000 });
  });
});
