export function createGoogleCredentialHandler({
  getAppBridge,
  invalidateHydrationCache,
  applyUiState,
  getUiState,
  shouldHydratePage,
  hydratePage,
  resumePendingCheckout,
  toast,
}) {
  return async function handleGoogleCredentialResponse(response) {
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
  };
}
