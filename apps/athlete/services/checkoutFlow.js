export function normalizeCheckoutPlan(planId) {
  const normalized = String(planId || '').trim().toLowerCase();
  return ['athlete_plus', 'starter', 'pro', 'coach', 'performance'].includes(normalized)
    ? normalized
    : '';
}

export function stripCheckoutParamsFromUrl(windowObject = window) {
  try {
    const url = new URL(windowObject.location.href);
    if (!url.searchParams.has('checkoutPlan') && !url.searchParams.has('returnTo')) return;
    url.searchParams.delete('checkoutPlan');
    url.searchParams.delete('returnTo');
    windowObject.history.replaceState({}, '', url.toString());
  } catch {
    // no-op
  }
}

export async function maybeResumePendingCheckout(deps) {
  const {
    consumeCheckoutIntent,
    hasCheckoutAuth,
    getAppBridge,
    toast,
    queueCheckoutIntent,
  } = deps;

  const pending = consumeCheckoutIntent();
  if (!pending?.planId || !hasCheckoutAuth()) return false;
  try {
    toast('Continuando para o checkout...');
    await getAppBridge()?.openCheckout?.(pending.planId);
    return true;
  } catch (error) {
    queueCheckoutIntent(pending.planId, pending);
    throw error;
  }
}

export async function maybePrimeCheckoutIntentFromUrl(deps) {
  const {
    windowObject = window,
    getAppBridge,
    hasCheckoutAuth,
    queueCheckoutIntent,
    normalizeCheckoutPlan: resolveCheckoutPlan = normalizeCheckoutPlan,
    stripCheckoutParamsFromUrl: cleanupCheckoutParams = stripCheckoutParamsFromUrl,
    maybeResumePendingCheckout,
    applyUiPatch,
  } = deps;

  try {
    const url = new URL(windowObject.location.href);
    const planId = resolveCheckoutPlan(url.searchParams.get('checkoutPlan'));
    const returnTo = String(url.searchParams.get('returnTo') || '').trim();
    if (!planId) return;

    queueCheckoutIntent(planId, { source: 'pricing', returnTo });
    cleanupCheckoutParams(windowObject);

    if (hasCheckoutAuth() && getAppBridge()?.getProfile?.()?.data?.email) {
      await maybeResumePendingCheckout();
      return;
    }

    await applyUiPatch(
      (state) => ({ ...state, modal: 'auth', authMode: 'signin' }),
      { toastMessage: 'Entre para continuar no checkout', ensureGoogle: true, focusSelector: '#auth-email' },
    );
  } catch (error) {
    console.warn('Falha ao preparar checkout autenticado:', error?.message || error);
  }
}
