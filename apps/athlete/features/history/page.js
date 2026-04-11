import {
  renderBenchmarkHistorySection,
  renderPrHistorySection,
} from './sections.js';
import { buildAthleteHistoryPageState } from './viewState.js';

function renderHeroStat(label, value, detail = '') {
  return `
    <div class="summary-tile summary-tileCompact summary-tileHero">
      <span class="summary-label">${label}</span>
      <strong class="summary-value">${value}</strong>
      ${detail ? `<span class="summary-detail">${detail}</span>` : ''}
    </div>
  `;
}

export function renderAthleteHistoryPage(state, helpers) {
  const {
    renderPageHero,
    renderPageFold,
    renderTrendSkeletons,
    renderSparkline,
    formatTrendValue,
    formatNumber,
    escapeHtml,
  } = helpers;
  const {
    benchmarkHistory,
    prHistory,
    isBusy,
    isSummaryLoading,
    isDetailLoading,
    isDetailError,
    resultsLogged,
    progressSummary,
    showSnapshotNotice,
  } = buildAthleteHistoryPageState(state);

  return `
    <div class="workout-container page-stack page-stack-history">
      ${renderPageHero({
        eyebrow: 'Histórico',
        title: 'Evolução',
        subtitle: progressSummary || 'Benchmarks, PRs e resultados com leitura leve e direta.',
        actions: `
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">PRs</button>
          <button class="btn-secondary" data-action="page:set" data-page="account" type="button">Conta</button>
        `,
        footer: `
          <div class="summary-strip summary-strip-3">
            ${renderHeroStat('Benchmarks', String(benchmarkHistory.length), benchmarkHistory.length ? 'com histórico' : 'sem marcas ainda')}
            ${renderHeroStat('PRs', String(prHistory.length), prHistory.length ? 'em acompanhamento' : 'cadastre cargas')}
            ${renderHeroStat('Resultados', String(resultsLogged || 0), resultsLogged ? 'registrados no app' : 'sem registros ainda')}
          </div>
        `,
      })}

      ${showSnapshotNotice ? '<p class="account-hint">Mostrando dados salvos anteriormente enquanto a conexão atualiza.</p>' : ''}

      ${renderPageFold({
        title: 'Resumo',
        subtitle: 'O essencial para continuar.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Benchmarks</strong>
            <span>${isBusy || isDetailLoading ? 'Carregando histórico...' : benchmarkHistory.length ? `${benchmarkHistory.length} benchmark(s) com marca registrada.` : 'Nenhum benchmark com histórico ainda.'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>PRs</strong>
            <span>${isBusy || isDetailLoading ? 'Carregando PRs...' : prHistory.length ? `${prHistory.length} PR(s) acompanhados no app.` : 'Cadastre seus PRs para calcular cargas com contexto.'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Resultados</strong>
            <span>${isBusy || isSummaryLoading ? 'Carregando resumo...' : resultsLogged ? `${resultsLogged} resultado(s) registrado(s) até agora.` : 'Nenhum resultado registrado ainda.'}</span>
          </div>
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'Benchmarks',
        subtitle: 'Tendência das marcas já registradas.',
        guideTarget: 'history-benchmarks',
        content: `
        <div class="trend-grid">
          ${renderBenchmarkHistorySection({
            benchmarkHistory,
            isBusy,
            isDetailLoading,
            isDetailError,
            renderTrendSkeletons,
            renderSparkline,
            formatTrendValue,
            escapeHtml,
          })}
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'PRs',
        subtitle: 'Suas cargas de referência, sem ruído.',
        guideTarget: 'history-prs',
        content: `
        <div class="trend-grid">
          ${renderPrHistorySection({
            prHistory,
            isBusy,
            isDetailLoading,
            isDetailError,
            renderTrendSkeletons,
            renderSparkline,
            formatNumber,
            escapeHtml,
          })}
        </div>
        `,
      })}
    </div>
  `;
}
