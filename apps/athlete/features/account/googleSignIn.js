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
  let googleScriptPromise = null;
  let googleInitializedClientId = '';

  function isNativeAppRuntime() {
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
      const protocol = String(window.location?.protocol || '').toLowerCase();
      return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
    } catch {
      return false;
    }
  }

  async function loadGoogleScript() {
    if (!navigator.onLine) {
      throw new Error('Google Sign-In indisponível offline');
    }
    if (window.google?.accounts?.id) return window.google;
    if (googleScriptPromise) return googleScriptPromise;

    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-gsi="1"]');
      if (existing) {
        const checkReady = () => {
          if (window.google?.accounts?.id) resolve(window.google);
          else window.setTimeout(checkReady, 80);
        };
        checkReady();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleGsi = '1';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Não foi possível carregar o Google Sign-In'));
      document.head.appendChild(script);
    });

    return googleScriptPromise;
  }

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
        callback: async (response) => {
          try {
            const result = await getAppBridge()?.signInWithGoogle?.({ credential: response.credential });
            if (!result?.token && !result?.user) {
              throw new Error('Falha ao autenticar com Google');
            }

            const signedProfile = result?.user || getAppBridge()?.getProfile?.()?.data || null;
            invalidateHydrationCache();
            await applyUiState(
              { modal: null, authMode: 'signin' },
              { toastMessage: 'Login com Google efetuado' },
            );
            const currentPage = getUiState?.()?.currentPage || 'today';
            if (shouldHydratePage(currentPage)) {
              hydratePage(signedProfile, currentPage, null);
            }
            if (await resumePendingCheckout()) return;
          } catch (error) {
            toast(error?.message || 'Erro ao entrar com Google');
            console.error(error);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });
      googleInitializedClientId = clientId;
    }
    googleApi.accounts.id.renderButton(buttonEl, {
      theme: 'outline',
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
