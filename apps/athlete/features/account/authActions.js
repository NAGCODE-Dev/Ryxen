import {
  createEmptyPasswordResetState,
  handleAthletePasswordResetAction,
} from './authResetActions.js';

export async function handleAthleteAuthAction(action, context) {
  const {
    element,
    root,
    getUiState,
    applyUiState,
    applyUiPatch,
    getAppBridge,
    invalidateHydrationCache,
    shouldHydratePage,
    hydratePage,
    maybeResumePendingCheckout,
    isDeveloperEmail,
  } = context;

  const handledByReset = await handleAthletePasswordResetAction(action, {
    ...context,
    isDeveloperEmail,
  });
  if (handledByReset) return true;

  switch (action) {
    case 'auth:switch': {
      const mode = element.dataset.mode === 'signup' ? 'signup' : 'signin';
      await applyUiPatch(
        (state) => ({
          ...state,
          authMode: mode,
          passwordReset: createEmptyPasswordResetState(),
          signupVerification: mode === 'signup'
            ? (state.signupVerification || {})
            : {},
        }),
        { ensureGoogle: true, focusSelector: '#auth-email' },
      );
      return true;
    }

    case 'auth:google-redirect': {
      await getAppBridge()?.startGoogleSignInRedirect?.({
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
      return true;
    }

    case 'auth:signup-request-code': {
      const name = String(root.querySelector('#auth-name')?.value || '').trim();
      const email = String(root.querySelector('#auth-email')?.value || '').trim().toLowerCase();
      const password = String(root.querySelector('#auth-password')?.value || '');

      if (!name) throw new Error('Informe seu nome');
      if (!email) throw new Error('Informe seu email');
      if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');

      const result = await getAppBridge().requestSignUpVerification({ name, email, password });
      await applyUiPatch(
        (state) => ({
          ...state,
          signupVerification: {
            ...(state.signupVerification || {}),
            name,
            email,
            code: result?.previewCode || '',
            previewCode: result?.previewCode || '',
            previewUrl: result?.delivery?.previewUrl || '',
            supportEmail: result?.supportEmail || '',
            deliveryStatus: result?.deliveryStatus || '',
            requestedAt: new Date().toISOString(),
          },
        }),
        {
          toastMessage: result?.deliveryStatus === 'preview' ? 'Código gerado em preview' : 'Código enviado para seu email',
          ensureGoogle: true,
          focusSelector: '#auth-signup-code',
        },
      );
      return true;
    }

    case 'auth:submit': {
      const mode = element.dataset.mode === 'signup' ? 'signup' : 'signin';
      const name = String(root.querySelector('#auth-name')?.value || '').trim();
      const signupVerification = getUiState?.()?.signupVerification || {};
      const email = String(root.querySelector('#auth-email')?.value || signupVerification.email || '').trim().toLowerCase();
      const password = String(root.querySelector('#auth-password')?.value || '');

      let result;
      if (mode === 'signup') {
        const code = String(root.querySelector('#auth-signup-code')?.value || signupVerification.code || signupVerification.previewCode || '').trim();
        if (!name && !signupVerification.name) throw new Error('Informe seu nome');
        if (!email) throw new Error('Informe seu email');
        if (!code) throw new Error('Informe o código enviado ao seu email');
        result = await getAppBridge().confirmSignUp({ email, code });
      } else {
        if (!email) throw new Error('Informe seu email');
        if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');
        result = await getAppBridge().signIn({ email, password });
      }

      if (!result?.token && !result?.user) {
        throw new Error('Falha ao autenticar');
      }

      const profile = result?.user || getAppBridge()?.getProfile?.()?.data || null;
      invalidateHydrationCache();
      await applyUiState(
        { modal: null, authMode: 'signin', signupVerification: {} },
        { toastMessage: mode === 'signup' ? 'Conta criada' : 'Login efetuado' },
      );
      const currentPage = getUiState?.()?.currentPage || 'today';
      if (shouldHydratePage(currentPage)) {
        hydratePage(profile, currentPage, null);
      }
      if (await maybeResumePendingCheckout()) return true;
      return true;
    }

    default:
      return false;
  }
}

export function handleAthleteAuthEnterKey(event, context) {
  const { root, getUiState } = context;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (event.key !== 'Enter') return false;

  const modal = getUiState?.()?.modal || null;
  if (modal !== 'auth') return false;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLTextAreaElement) return false;
  if (activeElement instanceof HTMLButtonElement) return false;

  const ui = getUiState?.() || {};
  const authMode = ui.authMode === 'signup' ? 'signup' : 'signin';
  const reset = ui.passwordReset || {};

  const trigger = reset?.open && reset?.step === 'confirm'
    ? root.querySelector('[data-action="auth:reset-confirm"]')
    : reset?.open
      ? root.querySelector('[data-action="auth:reset-request"]')
      : root.querySelector(`[data-action="auth:submit"][data-mode="${authMode}"]`);

  if (!trigger) return false;

  event.preventDefault();
  trigger.click();
  return true;
}
