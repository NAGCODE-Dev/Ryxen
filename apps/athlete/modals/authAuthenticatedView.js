import {
  renderAccountHeroSection,
  renderCoachAccessSection,
} from './authAccountSections.js';
import { renderAdminSection } from './authAdminSection.js';
import { renderAccountNotificationsSection } from './accountNotificationsSection.js';
import { buildAthleteNotifications } from '../notifications.js';

export function renderAuthenticatedAccountView({
  profile,
  isBusy,
  admin,
  coachPortal,
  helpers,
}) {
  const {
    escapeHtml,
    formatDateShort,
    renderAccountSkeleton,
    formatSubscriptionPlanName,
    isDeveloperEmail,
  } = helpers;

  const isAdmin = !!profile?.is_admin || !!profile?.isAdmin;
  const overview = admin?.overview || null;
  const entitlements = coachPortal?.entitlements || [];
  const canCoachManage = entitlements.includes('coach_portal');
  const canAthleteUseApp = entitlements.includes('athlete_app');
  const subscription = coachPortal?.subscription || null;
  const gyms = coachPortal?.gyms || [];
  const gymAccess = coachPortal?.gymAccess || [];
  const planKey = subscription?.plan || subscription?.plan_id || 'free';
  const planName = formatSubscriptionPlanName(planKey);
  const planStatus = subscription?.status || 'inactive';
  const canUseDeveloperTools = isDeveloperEmail(profile?.email) || isAdmin;
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const hasActiveCoachSubscription = planStatus === 'active' && (planKey === 'pro' || planKey === 'coach');
  const notifications = buildAthleteNotifications({
    __ui: {
      auth: {
        profile,
        admin,
      },
    },
  });
  const platformVariant = helpers?.platformVariant === 'native' ? 'native' : 'web';
  const nativeOverlayClass = platformVariant === 'native' ? 'modal-overlay-native' : '';
  const nativeContainerClass = platformVariant === 'native' ? 'modal-container-nativeSheet modal-container-nativeSheet-full' : '';

  return `
    <div class="modal-overlay modal-overlay-auth ${nativeOverlayClass} isOpen" id="ui-authModalBackdrop">
      <div class="modal-container modal-container-auth ${nativeContainerClass}">
      <div class="modal-header">
        <div class="modal-titleGroup">
          <span class="modal-kicker">Conta</span>
          <h2 class="modal-title">Sua conta</h2>
        </div>
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

          <div class="settings-actions account-actions">
            <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
            <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
          </div>

          ${(canCoachManage || canUseDeveloperTools || hasActiveCoachSubscription || gyms.length || gymAccess.length) ? renderCoachAccessSection({
            canCoachManage,
            canAthleteUseApp,
            canUseDeveloperTools,
            hasActiveCoachSubscription,
            gyms,
            gymAccess,
          }) : ''}

          ${notifications.length ? renderAccountNotificationsSection({
            notifications,
            escapeHtml,
          }) : ''}

          ${isAdmin ? renderAdminSection({ overview, admin, escapeHtml, formatDateShort }) : ''}
        </div>
      </div>
    </div>
  `;
}
