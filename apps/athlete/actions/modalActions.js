import { clearPasswordResetSupportPolling } from '../features/account/authResetActions.js';

function emptyPasswordResetState() {
  return {
    open: false,
    step: 'request',
    email: '',
    code: '',
    previewCode: '',
    previewUrl: '',
    supportEmail: '',
    supportRequestKey: '',
    supportRequestStatus: '',
    supportApprovedAt: '',
    adminNotificationSent: false,
  };
}

function emptyGuideState() {
  return { step: 0 };
}

async function closeModal(context) {
  const {
    applyUiPatch,
    toast,
    isImportBusy,
    element,
    getUiState,
    getAppBridge,
  } = context;

  if (isImportBusy?.()) {
    toast?.('A importacao ainda esta em andamento');
    return true;
  }

  if (element?.dataset?.guideComplete === 'true') {
    const currentUiSettings = getUiState?.()?.settings || {};
    const currentCorePreferences = getAppBridge?.()?.getStateSnapshot?.()?.preferences || {};
    const nextShowNyxHints = currentUiSettings.showNyxHints ?? currentCorePreferences.showNyxHints !== false;
    if (typeof getAppBridge?.()?.setPreferences === 'function') {
      const result = await getAppBridge().setPreferences({
        showNyxHints: nextShowNyxHints,
        nyxGuideCompleted: true,
      });
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao concluir tour');
      }
    }
    toast?.('Nyx pronto para te acompanhar');
  }

  clearPasswordResetSupportPolling();
  await applyUiPatch((state) => ({
    ...state,
    modal: null,
    guide: emptyGuideState(),
    passwordReset: emptyPasswordResetState(),
  }));
  return true;
}

export async function handleAthleteModalAction(action, context) {
  const {
    element,
    applyUiState,
    applyUiPatch,
    getAppBridge,
    getUiState,
  } = context;

  switch (action) {
    case 'modal:open': {
      const modal = element.dataset.modal || null;
      if (modal === 'nyx-guide') {
        const nextStep = Number(element.dataset.guideStep);
        await applyUiPatch(
          (state) => ({
            ...state,
            modal,
            guide: {
              step: Number.isInteger(nextStep) && nextStep >= 0 && nextStep <= 3 ? nextStep : 0,
            },
          }),
          { focusSelector: '#nyx-guide-shell' },
        );
        return true;
      }
      if (modal === 'auth') {
        clearPasswordResetSupportPolling();
        await applyUiPatch(
          (state) => ({
            ...state,
            modal,
            passwordReset: emptyPasswordResetState(),
          }),
          { ensureGoogle: true, focusSelector: '#auth-email' },
        );
        const profile = getAppBridge?.()?.getProfile?.()?.data || null;
        if (profile?.is_admin || profile?.isAdmin) {
          try {
            const result = await getAppBridge().getAdminOverview({ limit: 25 });
            await applyUiState({ admin: { overview: result?.data || null, query: '' } });
          } catch (error) {
            console.warn('Falha ao carregar painel admin:', error?.message || error);
          }
        }
        return true;
      }
      await applyUiState(
        { modal },
        { focusSelector: modal === 'prs' ? '#ui-prsSearch' : (modal === 'auth' ? '#auth-email' : '') },
      );
      return true;
    }

    case 'modal:close':
      return closeModal(context);

    case 'nyx:next': {
      await applyUiPatch(
        (state) => ({
          ...state,
          modal: 'nyx-guide',
          guide: {
            step: Math.min(Number(state?.guide?.step || 0) + 1, 3),
          },
        }),
        { focusSelector: '#nyx-guide-shell' },
      );
      return true;
    }

    case 'nyx:restart': {
      await applyUiPatch(
        (state) => ({
          ...state,
          modal: 'nyx-guide',
          guide: { step: 0 },
        }),
        { focusSelector: '#nyx-guide-shell' },
      );
      return true;
    }

    case 'nyx:finish': {
      const currentUiSettings = context.getUiState?.()?.settings || {};
      const currentCorePreferences = context.getAppBridge?.()?.getStateSnapshot?.()?.preferences || {};
      const nextShowNyxHints = currentUiSettings.showNyxHints ?? currentCorePreferences.showNyxHints !== false;
      if (typeof context.getAppBridge?.()?.setPreferences === 'function') {
        const result = await context.getAppBridge().setPreferences({
          showNyxHints: nextShowNyxHints,
          nyxGuideCompleted: true,
        });
        if (!result?.success) {
          throw new Error(result?.error || 'Falha ao concluir tour');
        }
      }
      await applyUiPatch(
        (state) => ({
          ...state,
          modal: null,
          guide: emptyGuideState(),
          settings: {
            ...(state?.settings || {}),
            showNyxHints: nextShowNyxHints,
          },
        }),
        { toastMessage: 'Nyx pronto para te acompanhar' },
      );
      return true;
    }

    case 'nyx:hints:disable': {
      if (typeof context.getAppBridge?.()?.setPreferences === 'function') {
        const result = await context.getAppBridge().setPreferences({
          showNyxHints: false,
        });
        if (!result?.success) {
          throw new Error(result?.error || 'Falha ao ajustar o guia do Nyx');
        }
      }
      await applyUiPatch(
        (state) => ({
          ...state,
          settings: {
            ...(state?.settings || {}),
            showNyxHints: false,
          },
        }),
        { toastMessage: 'Nyx fica em silêncio por enquanto' },
      );
      return true;
    }

    default:
      return false;
  }
}

export async function handleAthleteModalOverlayClick(event, context) {
  const overlay = event.target?.closest?.('.modal-overlay');
  if (!overlay || event.target !== overlay) return false;
  await closeModal(context);
  return true;
}

export async function handleAthleteModalEscapeKey(event, context) {
  if (event.key !== 'Escape') return false;
  const ui = context.getUiState?.();
  if (!ui?.modal) return false;
  await closeModal(context);
  return true;
}
