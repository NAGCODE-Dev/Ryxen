import {
  renderAuthenticatedAccountView,
  renderGuestAuthView,
} from './authModalSections.js';

export function renderAthleteAuthModal({ auth = {}, authMode = 'signin', helpers = {} } = {}) {
  const {
    escapeHtml,
  } = helpers;

  const profile = auth?.profile || null;
  const isAuthenticated = !!profile?.email;
  const isBusy = !!auth?.isBusy;
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const signupVerification = auth?.signupVerification || {};
  const admin = auth?.admin || {};
  const coachPortal = auth?.coachPortal || {};
  const athleteOverview = auth?.athleteOverview || {};

  if (isAuthenticated) {
    return renderAuthenticatedAccountView({
      profile,
      isBusy,
      admin,
      coachPortal,
      athleteOverview,
      helpers,
    });
  }

  return renderGuestAuthView({
    isSignup,
    authMode,
    reset,
    signupVerification,
    escapeHtml,
  });
}
