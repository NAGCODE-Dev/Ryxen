export function renderAccountHeroSection({
  profile,
  isBusy,
  planName,
  planStatus,
  renewAt,
  escapeHtml,
  formatDateShort,
  renderAccountSkeleton,
}) {
  return `
    <div class="account-hero">
      <div class="account-heroIdentity">
        <div class="account-heroEyebrow">Conta ativa</div>
        ${isBusy ? renderAccountSkeleton() : `
          <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
          <div class="account-email">${escapeHtml(profile.email || '')}</div>
        `}
      </div>
      <div class="account-planCard">
        <span class="account-planLabel">Plano da conta</span>
        ${isBusy ? renderAccountSkeleton() : `
          <strong class="account-planValue">${escapeHtml(planName)}</strong>
          <span class="account-planMeta">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</span>
        `}
      </div>
    </div>
  `;
}

export function renderAccountSummaryTiles({
  isBusy,
  athleteBenefits,
  athleteStats,
  gyms,
  escapeHtml,
  describeAthleteBenefitSource,
}) {
  return `
    <div class="account-summaryGrid">
      ${isBusy ? Array.from({ length: 4 }, () => `
        <div class="summary-tile isSkeleton">
          <div class="skeleton skeleton-line skeleton-line-sm"></div>
          <div class="skeleton skeleton-line skeleton-line-lg"></div>
        </div>
      `).join('') : `
      <div class="summary-tile">
        <span class="summary-label">Acesso</span>
        <strong class="summary-value">${escapeHtml(athleteBenefits.label)}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Fonte</span>
        <strong class="summary-value">${escapeHtml(describeAthleteBenefitSource(athleteBenefits))}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Gyms</span>
        <strong class="summary-value">${gyms.length}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Treinos</span>
        <strong class="summary-value">${Number(athleteStats?.assignedWorkouts || 0)}</strong>
      </div>
      `}
    </div>
  `;
}

export function renderCoachAccessSection({
  canCoachManage,
  canAthleteUseApp,
  canUseDeveloperTools,
  hasActiveCoachSubscription,
  gyms,
}) {
  return `
    <div class="auth-intro">
      <div class="section-kicker">Coach</div>
      <p class="account-hint">${canCoachManage || canUseDeveloperTools
        ? 'O portal do coach continua separado do app do atleta. Use sua mesma conta para abrir o workspace do box.'
        : hasActiveCoachSubscription
          ? 'Seu plano está ativo, mas o portal do coach só libera quando sua conta está vinculada a um gym com permissão de gestão.'
          : 'Seu acesso de coach está bloqueado. Ative um plano quando quiser operar box, atletas e grupos no portal separado. O app do atleta continua liberado.'}</p>
      <div class="coach-pillRow">
        <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Coach liberado' : 'Coach bloqueado'}</span>
        <span class="coach-pill ${canAthleteUseApp ? 'isGood' : 'isWarn'}">${canAthleteUseApp ? 'Atleta liberado' : 'Atleta bloqueado'}</span>
        <span class="coach-pill">${gyms.length} gym(s)</span>
      </div>
      <div class="settings-actions coach-billingActions">
        ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
        ${!canCoachManage && canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
        <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
        ${!canCoachManage ? '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>' : ''}
      </div>
    </div>
  `;
}
