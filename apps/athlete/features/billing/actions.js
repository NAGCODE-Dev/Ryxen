export async function handleAthleteBillingAction(action, context) {
  const {
    element,
    getUiState,
    applyUiPatch,
    finalizeUiChange,
    hydratePage,
    invalidateHydrationCache,
    getAppBridge,
    normalizeCheckoutPlan,
    hasCheckoutAuth,
    queueCheckoutIntent,
    isDeveloperProfile,
  } = context;

  switch (action) {
    case 'billing:checkout': {
      const plan = normalizeCheckoutPlan(element.dataset.plan || 'coach') || 'coach';
      const profile = getAppBridge()?.getProfile?.()?.data || null;
      if (!profile?.email || !hasCheckoutAuth()) {
        queueCheckoutIntent(plan, {
          source: 'app',
          returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        });
        await applyUiPatch(
          (state) => ({ ...state, modal: 'auth', authMode: 'signin' }),
          { toastMessage: 'Entre para continuar no checkout', ensureGoogle: true, focusSelector: '#auth-email' },
        );
        return true;
      }
      await getAppBridge().openCheckout(plan);
      return true;
    }

    case 'billing:activate-local': {
      const profile = getAppBridge()?.getProfile?.()?.data || null;
      if (!isDeveloperProfile(profile)) {
        throw new Error('Recurso restrito a admin ou ambiente de desenvolvimento');
      }

      const plan = element.dataset.plan || 'coach';
      await getAppBridge().activateMockSubscription(plan);
      invalidateHydrationCache({ coach: true, athlete: false, account: true });
      const ui = getUiState?.() || {};
      await hydratePage(profile, 'account', ui?.coachPortal?.selectedGymId || null, { force: true });
      await finalizeUiChange({ toastMessage: 'Plano Coach local ativado', render: false });
      return true;
    }

    default:
      return false;
  }
}
