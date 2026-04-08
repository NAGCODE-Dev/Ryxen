export function renderAccountAccessSection(renderPageFold, view) {
  const {
    isBusy = false,
    coachPortalStatus = 'idle',
    isSummaryLoading = false,
    profileName = '',
    profileEmail = '',
    planName = '',
    planStatus = '',
    athleteBenefitsLabel = '',
    athleteBenefitSource = '',
    resultsLogged = 0,
    importUsage,
    escapeHtml,
  } = view;

  return renderPageFold({
    title: 'Seu acesso',
    subtitle: 'O essencial da conta em um só lugar.',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Perfil</strong>
        <span>${isBusy ? 'Carregando perfil...' : `${escapeHtml(profileName || 'Sem nome')} • ${escapeHtml(profileEmail || '')}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Plano</strong>
        <span>${isBusy || coachPortalStatus === 'loading' ? 'Carregando plano...' : `${escapeHtml(planName)} • ${escapeHtml(planStatus)}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Acesso do atleta</strong>
        <span>${isSummaryLoading ? 'Carregando acesso...' : `${escapeHtml(athleteBenefitsLabel)} • ${escapeHtml(athleteBenefitSource)}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Uso do app</strong>
        <span>${isSummaryLoading ? 'Buscando indicadores...' : `${Number(resultsLogged || 0)} resultado(s) • ${importUsage.unlimited ? 'imports livres' : `${importUsage.remaining} restante(s)`}`}</span>
      </div>
    </div>
    <div class="page-actions">
      <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
    </div>
    `,
  });
}

export function renderAccountCoachPortalSection(renderPageFold, view) {
  const {
    canCoachManage = false,
    gymsCount = 0,
    renewAt = null,
    canUseDeveloperTools = false,
    formatDateShort,
    escapeHtml,
  } = view;

  return renderPageFold({
    title: 'Coach Portal',
    subtitle: 'Portal separado do box e próximo passo de acesso.',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Status do portal</strong>
        <span>${canCoachManage ? `Liberado • ${gymsCount} gym(s) visível(is)` : 'Indisponível no plano atual'}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Renovação</strong>
        <span>${renewAt ? `Plano renova em ${escapeHtml(formatDateShort(renewAt))}` : 'Sem data de renovação disponível.'}</span>
      </div>
    </div>
    <div class="page-actions">
      ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Ver upgrade</button>' : ''}
      ${canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
      ${canCoachManage ? '<a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir Coach Portal</a>' : '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>'}
    </div>
    `,
  });
}

export function renderAccountActivitySection(renderPageFold, view) {
  const {
    isResultsLoading = false,
    isWorkoutsLoading = false,
    athleteResultsCount = 0,
    athleteWorkoutsCount = 0,
  } = view;

  return renderPageFold({
    title: 'Atividade recente',
    subtitle: 'O que já apareceu para você dentro do app.',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Resultados recentes</strong>
        <span>${isResultsLoading ? 'Carregando resultados...' : athleteResultsCount ? `${athleteResultsCount} registro(s) recente(s).` : 'Nenhum resultado registrado ainda.'}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Treinos do box</strong>
        <span>${isWorkoutsLoading ? 'Carregando treinos...' : athleteWorkoutsCount ? `${athleteWorkoutsCount} treino(s) recente(s) liberado(s).` : 'Nenhum treino recente liberado para sua conta.'}</span>
      </div>
    </div>
    `,
  });
}
