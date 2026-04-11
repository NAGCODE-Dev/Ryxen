import {
  renderAccountAccessSection,
  renderAccountActivitySection,
  renderAccountCoachPortalSection,
  renderAccountDataSections,
  renderAccountPreferencesSections,
  renderGuestBenefitsSection,
  renderGuestCoachPortalSection,
} from './sections.js';
import { buildAthleteAccountPageState } from './viewState.js';

function renderHeroStat(label, value, detail = '') {
  return `
    <div class="summary-tile summary-tileCompact summary-tileHero">
      <span class="summary-label">${label}</span>
      <strong class="summary-value">${value}</strong>
      ${detail ? `<span class="summary-detail">${detail}</span>` : ''}
    </div>
  `;
}

function renderAccountViewButton(view, currentView, label, detail) {
  const isActive = currentView === view;
  return `
    <button
      class="account-viewTab ${isActive ? 'isActive' : ''}"
      data-action="account:view:set"
      data-account-view="${view}"
      aria-pressed="${isActive ? 'true' : 'false'}"
      type="button"
    >
      <strong>${label}</strong>
      <span>${detail}</span>
    </button>
  `;
}

export function renderAthleteAccountPage(state, helpers) {
  const {
    renderPageHero,
    renderPageFold,
    formatDateShort,
    escapeHtml,
  } = helpers;
  const {
    profile,
    coachPortal,
    planName,
    planStatus,
    renewAt,
    canUseDeveloperTools,
    isBusy,
    athleteBenefits,
    importUsage,
    canCoachManage,
    gyms,
    athleteStats,
    athleteBenefitSource,
    athleteResults,
    athleteWorkouts,
    preferences,
    accountView,
    isSummaryLoading,
    isWorkoutsLoading,
    isResultsLoading,
    showSnapshotNotice,
  } = buildAthleteAccountPageState(state, helpers);

  if (!profile?.email) {
    return `
      <div class="workout-container page-stack page-stack-account">
        ${renderPageHero({
          eyebrow: 'Conta',
          title: 'Sua conta',
          subtitle: accountView === 'preferences'
            ? 'Ajuste o visual, o treino e o conforto deste aparelho.'
            : accountView === 'data'
              ? 'Backups, documentos e os dados locais do app continuam por aqui.'
              : 'Acesso simples, progresso salvo e tudo no seu ritmo.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
          `,
          footer: `
            <div class="account-viewTabs" role="tablist" aria-label="Seções da conta">
              ${renderAccountViewButton('overview', accountView, 'Visão geral', 'entrada e benefícios')}
              ${renderAccountViewButton('preferences', accountView, 'Preferências', 'visual e treino')}
              ${renderAccountViewButton('data', accountView, 'Dados', 'backup e documentos')}
            </div>
          `,
        })}

        ${accountView === 'preferences'
          ? renderAccountPreferencesSections(renderPageFold, {
            preferences,
            escapeHtml,
          })
          : accountView === 'data'
            ? renderAccountDataSections(renderPageFold, {
              profileEmail: '',
              planName: 'Livre',
              planStatus: 'sem login',
              athleteBenefitSource: 'Conta local',
              importUsage,
              escapeHtml,
            })
            : `
              ${renderGuestBenefitsSection(renderPageFold)}
              ${renderGuestCoachPortalSection(renderPageFold)}
            `}
      </div>
    `;
  }

  return `
    <div class="workout-container page-stack page-stack-account">
      ${renderPageHero({
        eyebrow: 'Conta',
        title: profile.name || 'Sua conta',
        subtitle: accountView === 'preferences'
          ? 'Aparência, treino e conforto visual do seu jeito.'
          : accountView === 'data'
            ? 'Backups, documentos e o básico do que está salvo neste app.'
            : 'Plano, acesso e atividade recente em uma leitura tranquila.',
        actions: `
          <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
        `,
        footer: `
          <div class="summary-strip summary-strip-3">
            ${renderHeroStat('Plano', escapeHtml(planName || 'Livre'), escapeHtml(planStatus || 'sem status'))}
            ${renderHeroStat('Resultados', String(Number(athleteStats?.resultsLogged || 0)), 'registros salvos')}
            ${renderHeroStat('Portal', canCoachManage ? 'Liberado' : 'Fechado', canCoachManage ? `${gyms.length} gym(s)` : 'upgrade quando quiser')}
          </div>
          <div class="account-viewTabs" role="tablist" aria-label="Seções da conta">
            ${renderAccountViewButton('overview', accountView, 'Visão geral', 'acesso e atividade')}
            ${renderAccountViewButton('preferences', accountView, 'Preferências', 'aparência e treino')}
            ${renderAccountViewButton('data', accountView, 'Dados', 'backup e documentos')}
          </div>
        `,
      })}

      ${showSnapshotNotice ? '<p class="account-hint">Mostrando dados salvos anteriormente enquanto a conexão atualiza.</p>' : ''}

      ${accountView === 'preferences'
        ? renderAccountPreferencesSections(renderPageFold, {
          preferences,
          escapeHtml,
        })
        : accountView === 'data'
          ? renderAccountDataSections(renderPageFold, {
            profileEmail: profile.email,
            planName,
            planStatus,
            athleteBenefitSource,
            importUsage,
            escapeHtml,
          })
          : `
            ${renderAccountAccessSection(renderPageFold, {
              isBusy,
              coachPortalStatus: coachPortal?.status,
              isSummaryLoading,
              profileName: profile.name,
              profileEmail: profile.email,
              planName,
              planStatus,
              athleteBenefitsLabel: athleteBenefits.label,
              athleteBenefitSource,
              resultsLogged: athleteStats?.resultsLogged,
              importUsage,
              escapeHtml,
            })}

            ${renderAccountCoachPortalSection(renderPageFold, {
              canCoachManage,
              gymsCount: gyms.length,
              renewAt,
              canUseDeveloperTools,
              formatDateShort,
              escapeHtml,
            })}

            ${renderAccountActivitySection(renderPageFold, {
              isResultsLoading,
              isWorkoutsLoading,
              athleteResultsCount: athleteResults.length,
              athleteWorkoutsCount: athleteWorkouts.length,
            })}
          `}
    </div>
  `;
}
