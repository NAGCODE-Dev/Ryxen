/**
 * Entry point da aplicação
 * - Registra Service Worker
 * - Inicializa app (app.js)
 * - Monta UI plugável (src/ui/ui.js)
 *
 * Obs: mantido compatível com window.__APP__ exposto pelo app.js. [file:8]
 */

import { init } from './app.js';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { mountConsentBanner } from './ui/consent.js';
import { flushTelemetry, trackError, trackEvent } from './core/services/telemetryService.js';
import { isDeveloperProfile } from './core/utils/devAccess.js';

if (window.__TREINO_BOOTSTRAPPED__) {
  // Evita double-boot caso o script seja incluído duas vezes acidentalmente.
  console.warn('⚠️ Boot já executado. Ignorando reexecução do main.js.');
} else {
  window.__TREINO_BOOTSTRAPPED__ = true;
  bootstrap();
}

async function bootstrap() {
  setupVercelObservability();
  setupGlobalTelemetryHandlers();
  registerServiceWorker();
  mountConsentBanner();

  const result = await init();
  if (!result?.success) {
    trackError(result?.error || 'init_failed', { stage: 'bootstrap' });
    renderError(result?.error || 'Erro desconhecido');
    return;
  }

  trackEvent('app_initialized', { success: true });
  flushTelemetry().catch(() => {});

  // Debug opcional (não interfere no uso normal):
  // /?debug=1 mantém o painel antigo para inspeção rápida.
  const params = new URLSearchParams(window.location.search);
  const profile = window.__APP__?.getProfile?.()?.data || null;
  if (params.get('debug') === '1' && isDeveloperProfile(profile)) {
    renderDebugPlaceholder();
    return;
  }

  await mountUI();
}

function setupVercelObservability() {
  if (window.__CROSSAPP_VERCEL_OBSERVABILITY__) return;
  window.__CROSSAPP_VERCEL_OBSERVABILITY__ = true;

  inject();
  injectSpeedInsights();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        trackEvent('service_worker_registered', { scope: reg.scope });
      })
      .catch((err) => {
        trackError(err, { stage: 'service_worker_register' });
        console.error('Erro no Service Worker:', err);
      });
  });
}

async function mountUI() {
  const root = document.getElementById('app');
  if (!root) {
    console.error('Elemento #app não encontrado.');
    return;
  }

  // Garantia: app.js expõe __APP__ durante init().
  if (!window.__APP__?.getState) {
    console.warn('⚠️ window.__APP__ ainda não está disponível. Tentando novamente...');
    await wait(0);
  }

  const { mountUI } = await import('./ui/ui.js');
  mountUI({ root });
}

function renderDebugPlaceholder() {
  const root = document.getElementById('app');
  if (!root) return;

  const state = safeGetState();

  root.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui; max-width: 900px; margin: 0 auto;">
      <h1 style="margin:0 0 1rem 0;">✅ PWA Multi-Semana Pronto (Debug)</h1>

      <div style="background:#f0f0f0; padding:1.25rem; border-radius:10px; margin:1rem 0;">
        <h2 style="margin:0 0 0.75rem 0;">📊 Estado Atual</h2>
        <ul style="margin:0; padding-left: 1.1rem;">
          <li><strong>Dia:</strong> ${escapeHtml(state.currentDay || '—')}</li>
          <li><strong>Semanas carregadas:</strong> ${Number(state.weeks?.length || 0)}</li>
          <li><strong>Semana ativa:</strong> ${escapeHtml(state.activeWeekNumber ?? 'Nenhuma')}</li>
          <li><strong>PRs cadastrados:</strong> ${Object.keys(state.prs || {}).length}</li>
          <li><strong>Tela ativa:</strong> ${escapeHtml(state.ui?.activeScreen || '—')}</li>
          <li><strong>Treino:</strong> ${
            state.workout ? escapeHtml(`${state.workout.day} (${state.workout.blocks?.length || 0} blocos)`) : '⏳ Aguardando PDF'
          }</li>
        </ul>
      </div>

      <div style="background:#e3f2fd; padding:1.25rem; border-radius:10px; margin:1rem 0;">
        <h2 style="margin:0 0 0.75rem 0;">🧪 Teste Multi-Semana no Console</h2>
        <pre style="background:#fff; padding:1rem; border-radius:8px; overflow:auto; font-size:0.9rem; line-height:1.4;">
// 1. Ver estado completo
__APP__.debugState()

// 2. Upload PDF com múltiplas semanas
const input = document.createElement('input');
input.type = 'file';
input.accept = 'application/pdf';
input.onchange = async (e) => {
  const result = await __APP__.uploadMultiWeekPdf(e.target.files[0]);
  console.log('Upload:', result);
  console.log('Semanas:', __APP__.getWeeks());
  console.log('Semana ativa:', __APP__.getActiveWeek());
};
input.click();

// 3. Trocar semana (após upload)
__APP__.selectWeek(19)
__APP__.selectWeek(18)

// 4. Adicionar PRs
__APP__.addPR('BACK SQUAT', 100)
__APP__.addPR('DEADLIFT', 150)
__APP__.addPR('BENCH PRESS', 80)

// 5. Listar PRs
__APP__.listPRs()

// 6. Copiar treino (após upload)
await __APP__.copyWorkout()

// 7. Exportar treino
__APP__.exportWorkout()

// 8. Exportar/Importar PRs
__APP__.exportPRs()
const prsJson = '{"BACK SQUAT": 120, "DEADLIFT": 160}';
__APP__.importPRs(prsJson);

// 9. Info do PDF
__APP__.getPdfInfo().then(info => console.log('PDF info:', info));
        </pre>
        <p style="margin:0;color:#333;">
          Dica: remova <code>?debug=1</code> da URL para voltar para a UI.
        </p>
      </div>
    </div>
  `;
}

function renderError(errorMsg) {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui; max-width: 720px; margin: 0 auto; text-align: center;">
      <h1 style="color:#d32f2f; margin:0 0 0.75rem 0;">Erro ao Inicializar</h1>
      <p style="background:#ffebee; padding:1rem; border-radius:10px; color:#b71c1c; margin:0 0 1rem 0;">
        ${escapeHtml(errorMsg)}
      </p>
      <button
        onclick="location.reload()"
        style="padding: 0.75rem 1.25rem; background:#1976d2; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:1rem;"
      >
        Recarregar
      </button>
    </div>
  `;
}

function safeGetState() {
  try {
    return window.__APP__?.getState ? window.__APP__.getState() : {};
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setupGlobalTelemetryHandlers() {
  window.addEventListener('error', (event) => {
    trackError(event?.error || event?.message || 'window_error', {
      source: event?.filename || null,
      line: event?.lineno || null,
      column: event?.colno || null,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    trackError(event?.reason || 'unhandled_rejection', { source: 'promise' });
  });
}
