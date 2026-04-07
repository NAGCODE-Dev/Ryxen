export function createLocalSessionDomain({
  windowObject,
  clearAllStorages,
  PRESERVED_LOCAL_KEYS,
  AUTH_TOKEN_KEY,
  PROFILE_KEY,
  CHECKOUT_INTENT_KEY,
  PR_HISTORY_KEY,
  ATHLETE_USAGE_KEY,
  TELEMETRY_QUEUE_KEY,
  APP_STATE_SYNC_KEY,
  SYNC_OUTBOX_KEY,
}) {
  async function clearLocalUserData(options = {}) {
    const preserveAuth = options?.preserveAuth === true;
    const preserved = captureLocalValues([
      ...PRESERVED_LOCAL_KEYS,
      ...(preserveAuth ? [AUTH_TOKEN_KEY, PROFILE_KEY] : []),
    ]);

    await clearAllStorages();

    const sessionKeys = [
      CHECKOUT_INTENT_KEY,
      PR_HISTORY_KEY,
      ATHLETE_USAGE_KEY,
      TELEMETRY_QUEUE_KEY,
      APP_STATE_SYNC_KEY,
      SYNC_OUTBOX_KEY,
      ...(!preserveAuth ? [AUTH_TOKEN_KEY, PROFILE_KEY] : []),
    ];

    sessionKeys.forEach(removeLocalValue);
    restoreLocalValues(preserved);
  }

  function captureLocalValues(keys = []) {
    const snapshot = new Map();
    keys.forEach((key) => {
      try {
        const value = windowObject.localStorage.getItem(key);
        if (value !== null) snapshot.set(key, value);
      } catch {
        // no-op
      }
    });
    return snapshot;
  }

  function restoreLocalValues(values) {
    values.forEach((value, key) => {
      try {
        windowObject.localStorage.setItem(key, value);
      } catch {
        // no-op
      }
    });
  }

  function removeLocalValue(key) {
    try {
      windowObject.localStorage.removeItem(key);
    } catch {
      // no-op
    }
  }

  return {
    clearLocalUserData,
  };
}
