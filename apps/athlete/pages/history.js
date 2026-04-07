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
          ${isBusy || isDetailLoading ? renderTrendSkeletons(4) : isDetailError ? '<p class="account-hint">Não foi possível carregar benchmarks agora.</p>' : benchmarkHistory.length ? benchmarkHistory.map((item) => `
            <div class="trend-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.name || item.slug || 'Benchmark')}</strong>
                <span>${escapeHtml(item.latestLabel || 'Sem marca')}</span>
              </div>
              ${renderSparkline(item.points.map((point) => Number(point.value || 0)), item.scoreType === 'for_time')}
              <div class="trend-meta">
                <span>${item.improvement === null ? 'Sem histórico suficiente' : `${item.improvement > 0 ? '+' : ''}${formatTrendValue(item.improvement, item.scoreType)}`}</span>
                <span>${item.points.length} registro(s)</span>
              </div>
            </div>
          `).join('') : '<p class="account-hint">Finalize benchmarks ou registre seus resultados para começar o histórico.</p>'}
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'PRs',
        subtitle: 'Suas cargas de referência em leitura direta.',
        content: `
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(3) : isDetailError ? '<p class="account-hint">Não foi possível carregar PRs agora.</p>' : prHistory.length ? prHistory.map((item) => `
            <div class="trend-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.exercise)}</strong>
                <span>${escapeHtml(String(item.latestValue ?? '—'))} ${escapeHtml(item.unit || 'kg')}</span>
              </div>
              ${renderSparkline(item.points.map((point) => Number(point.value || 0)), false)}
              <div class="trend-meta">
                <span>${item.delta === null ? 'Sem histórico suficiente' : `${item.delta > 0 ? '+' : ''}${formatNumber(item.delta)} ${escapeHtml(item.unit || 'kg')}`}</span>
                <span>${item.points.length} atualização(ões)</span>
              </div>
            </div>
          `).join('') : '<p class="account-hint">Cadastre seus PRs para o app calcular cargas e mostrar progresso real.</p>'}
        </div>
        `,
      })}
    </div>
  `;
}
