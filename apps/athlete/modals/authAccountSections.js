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
        <span class="account-planLabel">Status da conta</span>
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
  gymAccess = [],
}) {
  const athleteMemberships = (Array.isArray(gymAccess) ? gymAccess : []).filter((item) => item?.role === 'athlete');
  const hasGymMembership = gyms.length > 0;
  const membershipSummary = hasGymMembership
    ? `${gyms.length} gym(s) vinculado(s)`
    : 'Sem vínculo de gym';

  return `
    <div class="auth-intro">
      <div class="section-kicker">Coach</div>
      <p class="account-hint">${canCoachManage || canUseDeveloperTools
        ? 'Abra o portal do coach com a mesma conta.'
        : hasGymMembership
          ? 'Sua conta está vinculada a um gym. O portal completo só libera com permissão de gestão, mas seu vínculo e acesso de atleta continuam válidos.'
        : hasActiveCoachSubscription
          ? 'O acesso está ativo, mas o portal só libera com vínculo a um gym com permissão de gestão.'
          : 'O portal do coach só aparece quando a conta recebe acesso de gestão.'}</p>
      <div class="coach-pillRow">
        <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Portal disponível' : 'Portal indisponível'}</span>
        <span class="coach-pill ${canAthleteUseApp ? 'isGood' : 'isWarn'}">${canAthleteUseApp ? 'Atleta disponível' : 'Atleta indisponível'}</span>
        <span class="coach-pill">${membershipSummary}</span>
      </div>
      ${athleteMemberships.length ? `
        <p class="account-hint">${athleteMemberships.length} vínculo(s) ativo(s) como atleta detectado(s).</p>
      ` : ''}
      <div class="settings-actions coach-billingActions">
        ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Abrir cobrança</button>' : ''}
        ${!canCoachManage && canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
        <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
        ${!canCoachManage ? '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Detalhes de acesso</a>' : ''}
      </div>
    </div>
  `;
}
