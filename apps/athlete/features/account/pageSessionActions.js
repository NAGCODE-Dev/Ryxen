export async function handleAthletePageSessionAction(action, context) {
  const {
    element,
    getUiState,
    applyUiState,
    applyUiPatch,
    finalizeUiChange,
    hydratePage,
    shouldHydratePage,
    invalidateHydrationCache,
    getAppBridge,
    maybeResumePendingCheckout,
    emptyCoachPortal,
    emptyAthleteOverview,
    emptyAdmin,
  } = context;

  switch (action) {
    case 'page:set': {
      const page = String(element.dataset.page || 'today');
      await applyUiPatch((state) => ({ ...state, currentPage: page }));
      if (page === 'account' || page === 'history') {
        const profile = getAppBridge()?.getProfile?.()?.data || null;
        const ui = getUiState?.() || {};
        hydratePage(profile, page, ui?.coachPortal?.selectedGymId || null);
      }
      return true;
    }

    case 'auth:refresh': {
      const result = await getAppBridge().refreshSession();
      if (!result?.token && !result?.user) {
        throw new Error('Falha ao atualizar sessão');
      }
      const profile = result?.user || getAppBridge()?.getProfile?.()?.data || null;
      const ui = getUiState?.() || {};
      invalidateHydrationCache();
      await finalizeUiChange({ toastMessage: 'Sessão atualizada' });
      if (shouldHydratePage(ui?.currentPage || 'today')) {
        hydratePage(profile, ui?.currentPage || 'today', ui?.coachPortal?.selectedGymId || null);
      }
      if (await maybeResumePendingCheckout()) return true;
      return true;
    }

    case 'auth:signout': {
      await getAppBridge().signOut();
      invalidateHydrationCache();
      await applyUiState(
        {
          modal: null,
          authMode: 'signin',
          coachPortal: emptyCoachPortal(),
          athleteOverview: emptyAthleteOverview(),
          admin: typeof emptyAdmin === 'function' ? emptyAdmin() : { overview: null, query: '' },
        },
        { toastMessage: 'Sessão encerrada' },
      );
      return true;
    }

    default:
      return false;
  }
}
