import { createGoogleCredentialHandler } from './googleSignInFlow.js';
import { createGoogleScriptLoader, isNativeAppRuntime } from './googleSignInInfra.js';

export function createGoogleSignInHelpers({
  root,
  getUiState,
  getAppBridge,
  applyUiState,
  toast,
  invalidateHydrationCache,
  shouldHydratePage,
  hydratePage,
  resumePendingCheckout,
}) {
  let googleInitializedClientId = '';
  const loadGoogleScript = createGoogleScriptLoader();
  const handleGoogleCredentialResponse = createGoogleCredentialHandler({
    getAppBridge,
    invalidateHydrationCache,
    applyUiState,
    getUiState,
    shouldHydratePage,
    hydratePage,
    resumePendingCheckout,
    toast,
  });

  async function ensureGoogleSignInUi() {
    const ui = getUiState?.() || {};
    if (ui.modal !== 'auth') return;

    const shell = root.querySelector('#google-signin-shell');
    const buttonEl = root.querySelector('#google-signin-button');
    if (!shell || !buttonEl) return;

    const profile = getAppBridge()?.getProfile?.()?.data || null;
    if (profile?.email) {
      shell.style.display = 'none';
      return;
    }

    const runtime = getAppBridge()?.getRuntimeConfig?.()?.data || {};
    const clientId = String(runtime?.auth?.googleClientId || '').trim();
    if (!clientId) {
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    if (!navigator.onLine) {
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }
    if (isNativeAppRuntime()) {
      shell.style.display = '';
      shell.innerHTML = `
        <button class="btn-secondary auth-googleNativeButton auth-googleCta" data-action="auth:google-redirect" type="button">
          <span class="auth-googleMark" aria-hidden="true">G</span>
          <span>Continuar com Google</span>
        </button>
      `;
      return;
    }

    const googleApi = await loadGoogleScript();
    if (!googleApi?.accounts?.id) {
      shell.style.display = 'none';
      shell.innerHTML = '';
      return;
    }

    shell.style.display = '';
    buttonEl.innerHTML = '';
    if (googleInitializedClientId !== clientId) {
      googleApi.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });
      googleInitializedClientId = clientId;
    }
    googleApi.accounts.id.renderButton(buttonEl, {
      theme: 'filled_black',
      size: 'large',
      type: 'standard',
      shape: 'pill',
      text: ui.authMode === 'signup' ? 'signup_with' : 'signin_with',
      logo_alignment: 'left',
      width: Math.max(220, Math.min(buttonEl.clientWidth || 320, 360)),
      locale: 'pt-BR',
    });
  }

  return {
    ensureGoogleSignInUi,
  };
}
