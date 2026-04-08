import {
  renderAccountHeroSection,
  renderAccountSummaryTiles,
  renderCoachAccessSection,
} from './authAccountSections.js';
import { renderAdminSection } from './authAdminSection.js';

export function renderAuthenticatedAccountView({
  profile,
  isBusy,
  admin,
  coachPortal,
  athleteOverview,
  helpers,
}) {
  const {
    escapeHtml,
    formatDateShort,
    renderAccountSkeleton,
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    isDeveloperEmail,
    normalizeAthleteBenefits,
  } = helpers;

  const isAdmin = !!profile?.is_admin || !!profile?.isAdmin;
  const overview = admin?.overview || null;
  const entitlements = coachPortal?.entitlements || [];
  const canCoachManage = entitlements.includes('coach_portal');
  const canAthleteUseApp = entitlements.includes('athlete_app');
  const subscription = coachPortal?.subscription || null;
  const gyms = coachPortal?.gyms || [];
  const athleteStats = athleteOverview?.stats || {};
  const athleteBenefits = normalizeAthleteBenefits(athleteOverview?.athleteBenefits || null);
  const planKey = subscription?.plan || subscription?.plan_id || 'free';
  const planName = formatSubscriptionPlanName(planKey);
  const planStatus = subscription?.status || 'inactive';
  const canUseDeveloperTools = isDeveloperEmail(profile?.email);
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const hasActiveCoachSubscription = planStatus === 'active' && (planKey === 'pro' || planKey === 'coach');

  return `
    <div class="modal-overlay modal-overlay-auth isOpen" id="ui-authModalBackdrop">
      <div class="modal-container modal-container-auth">
      <div class="modal-header">
        <h2 class="modal-title">👤 Sua conta</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          ${renderAccountHeroSection({
            profile,
            isBusy,
            planName,
            planStatus,
            renewAt,
            escapeHtml,
            formatDateShort,
            renderAccountSkeleton,
          })}

          ${renderAccountSummaryTiles({
            isBusy,
            athleteBenefits,
            athleteStats,
            gyms,
            escapeHtml,
            describeAthleteBenefitSource,
          })}

          <div class="settings-actions account-actions">
            <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
            <button class="btn-secondary" data-action="modal:close" type="button">Fechar</button>
          </div>

          ${renderCoachAccessSection({
            canCoachManage,
            canAthleteUseApp,
            canUseDeveloperTools,
            hasActiveCoachSubscription,
            gyms,
          })}

          ${isAdmin ? renderAdminSection({ overview, admin, escapeHtml, formatDateShort }) : ''}

          <div class="settings-actions">
            <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
