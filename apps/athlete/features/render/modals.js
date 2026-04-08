import {
  renderAthleteAuthModal,
  renderAthleteSettingsModal,
} from '../account/modals.js';
import { renderAthleteImportModal } from '../import/modal.js';
import { renderAthletePrsModal } from '../prs/modal.js';

export function renderAthleteModals(state, helpers) {
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};
  const authMode = state?.__ui?.authMode || 'signin';

  if (modal === 'prs') return renderAthletePrsModal(prs, { escapeHtml: helpers.escapeHtml });
  if (modal === 'settings') return renderAthleteSettingsModal(settings);
  if (modal === 'import') return renderAthleteImportModal(state, { escapeHtml: helpers.escapeHtml });
  if (modal === 'auth') {
    return renderAthleteAuthModal({
      auth: {
        ...(state?.__ui?.auth || {}),
        isBusy: state?.__ui?.isBusy || false,
        passwordReset: state?.__ui?.passwordReset || {},
        signupVerification: state?.__ui?.signupVerification || {},
        admin: state?.__ui?.admin || {},
        athleteOverview: state?.__ui?.athleteOverview || {},
        coachPortal: state?.__ui?.coachPortal || {},
      },
      authMode,
      helpers: {
        escapeHtml: helpers.escapeHtml,
        formatDateShort: helpers.formatDateShort,
        renderAccountSkeleton: helpers.renderAccountSkeleton,
        describeAthleteBenefitSource: helpers.describeAthleteBenefitSource,
        formatSubscriptionPlanName: helpers.formatSubscriptionPlanName,
        isDeveloperEmail: helpers.isDeveloperEmail,
        normalizeAthleteBenefits: helpers.normalizeAthleteBenefits,
      },
    });
  }

  return '';
}
