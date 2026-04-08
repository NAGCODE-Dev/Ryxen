export function getMeasurementSyncHash(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return '[]';
  return entries
    .map((entry) => [
      entry?.id || '',
      entry?.type || '',
      entry?.label || '',
      entry?.unit || '',
      entry?.value || '',
      entry?.recorded_at || '',
      entry?.created_at || '',
    ].join(':'))
    .join('|');
}

export function createMeasurementSyncScheduler({
  getAppBridge,
  initialHash = '[]',
  delayMs = 300,
} = {}) {
  let timeoutId = null;
  let lastSyncedHash = initialHash;

  function clear() {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  function schedule(previous, next) {
    const previousHash = getMeasurementSyncHash(previous?.athleteOverview?.measurements);
    const nextHash = getMeasurementSyncHash(next?.athleteOverview?.measurements);
    if (previousHash === nextHash || nextHash === lastSyncedHash) {
      return;
    }

    clear();
    timeoutId = window.setTimeout(async () => {
      try {
        const result = await getAppBridge?.()?.syncAthleteMeasurementsSnapshot?.(next?.athleteOverview?.measurements || []);
        if (result?.success || result?.queued) {
          lastSyncedHash = nextHash;
        }
      } catch {
        // no-op
      }
    }, delayMs);
  }

  return {
    schedule,
    clear,
  };
}
