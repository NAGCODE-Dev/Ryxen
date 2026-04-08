export function createEmptyPasswordResetState(overrides = {}) {
  return {
    open: false,
    email: '',
    code: '',
    previewCode: '',
    previewUrl: '',
    supportEmail: '',
    ...overrides,
  };
}

export async function handleAthletePasswordResetAction(action, context) {
  const {
    root,
    getUiState,
    applyUiPatch,
    isDeveloperEmail,
    getAppBridge,
  } = context;

  switch (action) {
    case 'auth:reset-toggle': {
      await applyUiPatch(
        (state) => ({
          ...state,
          passwordReset: {
            ...(state.passwordReset || {}),
            open: !(state.passwordReset?.open),
            step: state.passwordReset?.open ? 'request' : (state.passwordReset?.step || 'request'),
          },
        }),
        { ensureGoogle: true },
      );
      if (!(getUiState?.()?.passwordReset?.open)) return true;
      root.querySelector('#reset-email')?.focus();
      return true;
    }

    case 'auth:reset-request': {
      const currentReset = getUiState?.()?.passwordReset || {};
      const cooldownUntil = Number(currentReset?.cooldownUntil || 0);
      const remainingMs = cooldownUntil - Date.now();
      if (remainingMs > 0) {
        throw new Error(`Aguarde ${Math.ceil(remainingMs / 1000)}s para gerar outro código`);
      }

      const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
      if (!email) throw new Error('Informe o email da conta');

      const result = await getAppBridge().requestPasswordReset({ email });
      const showDeveloperPreview = isDeveloperEmail(email);
      const requestedAt = Date.now();
      await applyUiPatch(
        (state) => ({
          ...state,
          passwordReset: {
            ...(state.passwordReset || {}),
            open: true,
            step: 'confirm',
            email,
            code: '',
            requestedAt: new Date(requestedAt).toISOString(),
            deliveryStatus: result?.deliveryStatus || 'sent',
            message: showDeveloperPreview && result?.previewCode
              ? 'Código gerado em preview.'
              : 'Código enviado para seu email. Use o mais recente.',
            cooldownUntil: requestedAt + 30_000,
            previewCode: showDeveloperPreview ? (result?.previewCode || '') : '',
            previewUrl: showDeveloperPreview ? (result?.delivery?.previewUrl || '') : '',
            supportEmail: result?.supportEmail || '',
          },
        }),
        {
          toastMessage: showDeveloperPreview && result?.previewCode ? 'Código gerado' : 'Código enviado para seu email',
          ensureGoogle: true,
          focusSelector: '#reset-code',
        },
      );
      return true;
    }

    case 'auth:reset-confirm': {
      const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
      const code = String(root.querySelector('#reset-code')?.value || '').trim();
      const newPassword = String(root.querySelector('#reset-newPassword')?.value || '');

      if (!email || !code || !newPassword) {
        throw new Error('Preencha email, código e nova senha');
      }

      const result = await getAppBridge().confirmPasswordReset({ email, code, newPassword });
      if (!result?.success) throw new Error(result?.error || 'Falha ao redefinir senha');

      await applyUiPatch(
        (state) => ({
          ...state,
          authMode: 'signin',
          passwordReset: createEmptyPasswordResetState({
            step: 'request',
            email,
            message: 'Senha atualizada. Entre com a nova senha.',
            requestedAt: '',
            cooldownUntil: 0,
            deliveryStatus: '',
          }),
        }),
        { toastMessage: 'Senha atualizada', ensureGoogle: true, focusSelector: '#auth-email' },
      );
      return true;
    }

    default:
      return false;
  }
}
