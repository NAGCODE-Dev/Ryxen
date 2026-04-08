import {
  renderBenchmarkHistorySection,
  renderPrHistorySection,
} from './sections.js';

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
  const athleteOverview = state?.__ui?.athleteOverview || {};
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;
  const blocks = athleteOverview?.blocks || {};
  const summaryState = blocks?.summary?.status || 'idle';
  const resultsState = blocks?.results?.status || 'idle';
  const benchmarkHistory = athleteOverview?.benchmarkHistory || [];
  const prHistory = athleteOverview?.prHistory || [];
  const athleteStats = athleteOverview?.stats || {};
  const isBusy = !!state?.__ui?.isBusy;
  const isSummaryLoading = isAuthenticated && summaryState === 'loading' && !athleteOverview?.stats;
  const isDetailLoading = isAuthenticated && (resultsState === 'loading' || (resultsState === 'idle' && athleteOverview?.detailLevel !== 'full'));
  const isDetailError = resultsState === 'error';
  const resultsLogged = Number(athleteStats?.resultsLogged || 0);
  const progressSummary = [
    !isDetailLoading && benchmarkHistory.length ? `${benchmarkHistory.length} benchmark(s) com histórico` : null,
    !isDetailLoading && prHistory.length ? `${prHistory.length} PR(s) acompanhados` : null,
    !isSummaryLoading && resultsLogged ? `${resultsLogged} resultado(s) registrado(s)` : null,
  ].filter(Boolean).join(' • ');

  return `
    <div class="workout-container page-stack page-stack-history">
      ${renderPageHero({
        eyebrow: 'Histórico',
        title: 'Evolução',
        subtitle: progressSummary || 'Benchmarks, PRs e resultados em leitura rápida.',
        actions: `
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">PRs</button>
          <button class="btn-secondary" data-action="page:set" data-page="account" type="button">Conta</button>
        `,
      })}

      ${renderPageFold({
        title: 'Resumo rápido',
        subtitle: 'Só o que importa para continuar.',
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
        subtitle: 'Tendência das marcas que você já registrou.',
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
        subtitle: 'Suas cargas de referência em leitura direta.',
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
