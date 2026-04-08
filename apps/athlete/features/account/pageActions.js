export async function handleAthleteAccountHistoryAction(action, context) {
  const {
    element,
    root,
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

    case 'admin:refresh': {
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
      await applyUiState(
        { admin: { overview: result?.data || null, query } },
        { toastMessage: 'Painel admin atualizado' },
      );
      return true;
    }

    case 'admin:activate-plan': {
      const userId = Number(element.dataset.userId);
      const planId = String(element.dataset.planId || '').trim().toLowerCase();
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error('Usuário inválido');
      }
      if (!['athlete_plus', 'starter', 'pro', 'performance'].includes(planId)) {
        throw new Error('Plano inválido');
      }

      const confirmed = confirm(`Ativar plano ${planId} para este usuário por 30 dias?`);
      if (!confirmed) return true;

      await getAppBridge().activateCoachSubscription(userId, planId, 30);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
      await applyUiState(
        { admin: { overview: result?.data || null, query } },
        { toastMessage: `Plano ${planId} ativado` },
      );
      return true;
    }

    case 'admin:request-delete': {
      const userId = Number(element.dataset.userId);
      const userEmail = String(element.dataset.userEmail || '').trim();
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error('Usuário inválido');
      }

      const confirmed = confirm(`Solicitar exclusão da conta ${userEmail || `#${userId}`}?\n\nUm email será enviado. Se a pessoa não responder em até 15 dias, a conta e os dados serão excluídos automaticamente.`);
      if (!confirmed) return true;

      const deletion = await getAppBridge().requestAccountDeletion(userId);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
      await applyUiState(
        { admin: { overview: result?.data || null, query } },
        { toastMessage: deletion?.data?.reused ? 'Exclusão já estava pendente' : 'Email de exclusão enviado' },
      );
      return true;
    }

    case 'admin:delete-now': {
      const userId = Number(element.dataset.userId);
      const userEmail = String(element.dataset.userEmail || '').trim();
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error('Usuário inválido');
      }

      const confirmed = confirm(`Excluir agora a conta ${userEmail || `#${userId}`}?\n\nIsso remove a conta e os dados derivados permanentemente.`);
      if (!confirmed) return true;

      await getAppBridge().deleteAccountNow(userId);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const result = await getAppBridge().getAdminOverview({ q: query, limit: 25 });
      await applyUiState(
        { admin: { overview: result?.data || null, query } },
        { toastMessage: 'Conta excluída permanentemente' },
      );
      return true;
    }

    default:
      return false;
  }
}
