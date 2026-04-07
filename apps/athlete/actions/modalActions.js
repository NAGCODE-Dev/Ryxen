function emptyPasswordResetState() {
  return {
    open: false,
    email: '',
    code: '',
    previewCode: '',
    previewUrl: '',
    supportEmail: '',
  };
}

async function closeModal(context) {
  const {
    applyUiPatch,
    toast,
    isImportBusy,
  } = context;

  if (isImportBusy?.()) {
    toast?.('A importacao ainda esta em andamento');
    return true;
  }

  await applyUiPatch((state) => ({
    ...state,
    modal: null,
    passwordReset: emptyPasswordResetState(),
  }));
  return true;
}

export async function handleAthleteModalAction(action, context) {
  const {
    element,
    applyUiState,
    applyUiPatch,
  } = context;

  switch (action) {
    case 'modal:open': {
      const modal = element.dataset.modal || null;
      if (modal === 'auth') {
        await applyUiPatch(
          (state) => ({
            ...state,
            modal,
            passwordReset: emptyPasswordResetState(),
          }),
          { ensureGoogle: true, focusSelector: '#auth-email' },
        );
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
