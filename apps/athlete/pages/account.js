export function renderAthleteAccountPage(state, helpers) {
  const {
    renderPageHero,
    renderPageFold,
    renderAccountSkeleton,
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    formatDateShort,
    escapeHtml,
    isDeveloperEmail,
    normalizeAthleteBenefits,
    getAthleteImportUsage,
  } = helpers;
  const profile = state?.__ui?.auth?.profile || null;
  const coachPortal = state?.__ui?.coachPortal || {};
  const subscription = coachPortal?.subscription || null;
  const planKey = subscription?.plan || subscription?.plan_id || 'free';
  const planName = formatSubscriptionPlanName(planKey);
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const canUseDeveloperTools = isDeveloperEmail(profile?.email);
  const isBusy = !!state?.__ui?.isBusy;
  const athleteBenefits = normalizeAthleteBenefits(state?.__ui?.athleteOverview?.athleteBenefits || null);
  const athleteBlocks = state?.__ui?.athleteOverview?.blocks || {};
  const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
  const accessEntitlements = coachPortal?.entitlements || [];
  const canCoachManage = accessEntitlements.includes('coach_portal');
  const gyms = coachPortal?.gyms || [];
  const athleteStats = state?.__ui?.athleteOverview?.stats || {};
  const athleteBenefitSource = describeAthleteBenefitSource(athleteBenefits);
  const athleteResults = state?.__ui?.athleteOverview?.recentResults || [];
  const athleteWorkouts = state?.__ui?.athleteOverview?.recentWorkouts || [];
  const isSummaryLoading = coachPortal?.status === 'loading' || athleteBlocks?.summary?.status === 'loading';
  const isWorkoutsLoading = athleteBlocks?.workouts?.status === 'loading';
  const isResultsLoading = athleteBlocks?.results?.status === 'loading';

  if (!profile?.email) {
    return `
      <div class="workout-container page-stack page-stack-account">
        ${renderPageHero({
          eyebrow: 'Conta',
          title: 'Sua conta',
          subtitle: 'Salve seu uso, recupere a senha por email e continue de onde parou.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
          `,
        })}

        ${renderPageFold({
          title: 'O que libera',
          subtitle: 'Benefícios práticos dentro do app.',
          content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Conta salva</strong>
                <span>Entre com a mesma conta quando precisar retomar seu uso.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Treinos do coach</strong>
                <span>Receba a programação do box mantendo o app principal como sua rotina diária.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Histórico e PRs</strong>
                <span>Use seu progresso para calcular cargas e enxergar evolução, sem limite artificial no app.</span>
              </div>
            </div>
          `,
        })}

        ${renderPageFold({
          title: 'Coach Portal',
          subtitle: 'A mesma conta também abre a área separada do box.',
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Portal separado</strong>
              <span>Gestão do box, atletas e publicação de treino continuam fora do app principal.</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
            <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
          </div>
          `,
        })}
      </div>
    `;
  }

  return `
    <div class="workout-container page-stack page-stack-account">
      ${renderPageHero({
        eyebrow: 'Conta',
        title: profile.name || 'Sua conta',
        subtitle: 'Acesso, plano e atividade recente em leitura direta.',
        actions: `
          <button class="btn-secondary" data-action="auth:refresh" type="button">Recarregar</button>
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
        `,
      })}

      ${renderPageFold({
        title: 'Seu acesso',
        subtitle: 'O essencial da conta em um só lugar.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Perfil</strong>
            <span>${isBusy ? 'Carregando perfil...' : `${escapeHtml(profile.name || 'Sem nome')} • ${escapeHtml(profile.email || '')}`}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Plano</strong>
            <span>${isBusy || coachPortal?.status === 'loading' ? 'Carregando plano...' : `${escapeHtml(planName)} • ${escapeHtml(planStatus)}`}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Acesso do atleta</strong>
            <span>${isSummaryLoading ? 'Carregando acesso...' : `${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}`}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Uso do app</strong>
            <span>${isSummaryLoading ? 'Buscando indicadores...' : `${Number(athleteStats?.resultsLogged || 0)} resultado(s) • ${importUsage.unlimited ? 'imports livres' : `${importUsage.remaining} restante(s)`}`}</span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'Coach Portal',
        subtitle: 'Portal separado do box e próximo passo de acesso.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Status do portal</strong>
            <span>${canCoachManage ? `Liberado • ${gyms.length} gym(s) visível(is)` : 'Indisponível no plano atual'}</span>
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
      })}

      ${renderPageFold({
        title: 'Atividade recente',
        subtitle: 'O que já apareceu para você dentro do app.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Resultados recentes</strong>
            <span>${isResultsLoading ? 'Carregando resultados...' : athleteResults.length ? `${athleteResults.length} registro(s) recente(s).` : 'Nenhum resultado registrado ainda.'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Treinos do box</strong>
            <span>${isWorkoutsLoading ? 'Carregando treinos...' : athleteWorkouts.length ? `${athleteWorkouts.length} treino(s) recente(s) liberado(s).` : 'Nenhum treino recente liberado para sua conta.'}</span>
          </div>
        </div>
        `,
      })}
    </div>
  `;
}
