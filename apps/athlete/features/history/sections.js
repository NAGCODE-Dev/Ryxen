export function renderBenchmarkHistorySection({
  benchmarkHistory = [],
  isBusy = false,
  isDetailLoading = false,
  isDetailError = false,
  renderTrendSkeletons,
  renderSparkline,
  formatTrendValue,
  escapeHtml,
}) {
  if (isBusy || isDetailLoading) return renderTrendSkeletons(4);
  if (isDetailError) return '<p class="account-hint">Não foi possível carregar benchmarks agora.</p>';
  if (!benchmarkHistory.length) {
    return '<p class="account-hint">Finalize benchmarks ou registre seus resultados para começar o histórico.</p>';
  }

  return benchmarkHistory.map((item) => `
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
  `).join('');
}

export function renderPrHistorySection({
  prHistory = [],
  isBusy = false,
  isDetailLoading = false,
  isDetailError = false,
  renderTrendSkeletons,
  renderSparkline,
  formatNumber,
  escapeHtml,
}) {
  if (isBusy || isDetailLoading) return renderTrendSkeletons(3);
  if (isDetailError) return '<p class="account-hint">Não foi possível carregar PRs agora.</p>';
  if (!prHistory.length) {
    return '<p class="account-hint">Cadastre seus PRs para o app calcular cargas e mostrar progresso real.</p>';
  }

  return prHistory.map((item) => `
    <div class="trend-card">
      <div class="trend-cardHead">
        <strong>${escapeHtml(item.exercise)}</strong>
        <span>${escapeHtml(String(item.latestValue ?? '-'))} ${escapeHtml(item.unit || 'kg')}</span>
      </div>
      ${renderSparkline(item.points.map((point) => Number(point.value || 0)), false)}
      <div class="trend-meta">
        <span>${item.delta === null ? 'Sem histórico suficiente' : `${item.delta > 0 ? '+' : ''}${formatNumber(item.delta)} ${escapeHtml(item.unit || 'kg')}`}</span>
        <span>${item.points.length} atualização(ões)</span>
      </div>
    </div>
  `).join('');
}
