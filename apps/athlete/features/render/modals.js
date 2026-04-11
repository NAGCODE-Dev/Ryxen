import {
  renderAthleteAuthModal,
  renderAthleteSettingsModal,
} from '../account/modals.js';
import { renderAthleteNyxGuideModal } from '../guide/modal.js';
import { renderAthleteImportModal } from '../import/modal.js';
import { renderAthletePrsModal } from '../prs/modal.js';

export function renderAthleteModals(state, helpers) {
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};
  const authMode = state?.__ui?.authMode || 'signin';

  if (modal === 'nyx-guide') {
    return renderAthleteNyxGuideModal({
      guide: state?.__ui?.guide || {},
      preferences: state?.preferences || {},
      platformVariant: state?.__ui?.platformVariant || helpers.platformVariant || 'web',
    });
  }
  if (modal === 'prs') {
    return renderAthletePrsModal(prs, {
      escapeHtml: helpers.escapeHtml,
      platformVariant: state?.__ui?.platformVariant || helpers.platformVariant || 'web',
    });
  }
  if (modal === 'settings') {
    return renderAthleteSettingsModal(settings, {
      platformVariant: state?.__ui?.platformVariant || helpers.platformVariant || 'web',
    });
  }
  if (modal === 'import') {
    return renderAthleteImportModal(state, {
      escapeHtml: helpers.escapeHtml,
      platformVariant: state?.__ui?.platformVariant || helpers.platformVariant || 'web',
    });
  }
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
        platformVariant: state?.__ui?.platformVariant || helpers.platformVariant || 'web',
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
