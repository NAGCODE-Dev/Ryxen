function createTimedCache() {
  return { key: '', value: null, task: null, at: 0 };
}

function isFresh(cache, key, maxAgeMs) {
  return cache.key === key && cache.value && (Date.now() - cache.at) < maxAgeMs;
}

export function createCoachPortalDomain({
  measureAsync,
  emptyCoachPortal,
  getSubscriptionStatus,
  getEntitlements,
  getMyGyms,
}) {
  let coachCache = createTimedCache();

  function invalidateCoachCache() {
    coachCache = createTimedCache();
  }

  async function loadCoachSnapshot(profileEmail, selectedGymId, { force = false } = {}) {
    const email = String(profileEmail || '').trim().toLowerCase();
    if (!email) {
      return { ...emptyCoachPortal(), status: 'ready', error: '' };
    }

    const cacheKey = `${email}::${selectedGymId || 'default'}`;
    if (!force && isFresh(coachCache, cacheKey, 15000)) return coachCache.value;
    if (!force && coachCache.key === cacheKey && coachCache.task) return coachCache.task;

    coachCache.key = cacheKey;
    coachCache.task = (async () => {
      const [subscriptionResult, entitlementsResult, gymsResult] = await Promise.all([
        measureAsync('account.subscription', () => getSubscriptionStatus()),
        measureAsync('account.entitlements', () => getEntitlements()),
        measureAsync('account.gyms', () => getMyGyms()),
      ]);

      const gyms = gymsResult?.data?.gyms || [];
      const value = {
        subscription: subscriptionResult?.data || null,
        entitlements: entitlementsResult?.data?.entitlements || [],
        gymAccess: entitlementsResult?.data?.gymAccess || [],
        gyms,
        selectedGymId: selectedGymId || gyms[0]?.id || null,
        status: 'ready',
        error: '',
      };
      coachCache = { key: cacheKey, value, task: null, at: Date.now() };
      return value;
    })();

    return coachCache.task;
  }

  return {
    invalidateCoachCache,
    loadCoachSnapshot,
  };
}
