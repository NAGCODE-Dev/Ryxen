export function createCoachFeedDomain({
  getState,
  coachWorkoutStorage,
  COACH_FEED_KEY,
  pruneCoachWorkoutFeed,
  normalizeCoachWorkoutFeed,
  resolveCoachWorkoutForDay,
  applyPreferredWorkout,
}) {
  async function getCoachWorkoutCache() {
    const saved = await coachWorkoutStorage.get(COACH_FEED_KEY);
    const workouts = pruneCoachWorkoutFeed(saved?.workouts || []);

    if (saved?.workouts?.length && workouts.length !== saved.workouts.length) {
      await coachWorkoutStorage.set(COACH_FEED_KEY, {
        updatedAt: new Date().toISOString(),
        workouts,
      });
    }

    return workouts;
  }

  async function getCoachWorkoutForCurrentDay(state = getState()) {
    const feed = await getCoachWorkoutCache();
    return resolveCoachWorkoutForDay(feed, state.currentDay);
  }

  async function syncCoachWorkoutFeed(workouts = []) {
    const normalized = normalizeCoachWorkoutFeed(workouts, Date.now());
    const existing = await getCoachWorkoutCache();
    const byId = new Map();

    existing.forEach((item) => {
      const key = item?.id || `${item?.gymId || 'gym'}:${item?.scheduledDate || 'date'}:${item?.title || 'title'}`;
      byId.set(key, item);
    });

    normalized.forEach((item) => {
      const key = item?.id || `${item?.gymId || 'gym'}:${item?.scheduledDate || 'date'}:${item?.title || 'title'}`;
      const current = byId.get(key);
      byId.set(key, current ? {
        ...item,
        receivedAt: current.receivedAt,
        expiresAt: current.expiresAt,
      } : item);
    });

    const merged = pruneCoachWorkoutFeed(Array.from(byId.values()));
    await coachWorkoutStorage.set(COACH_FEED_KEY, {
      updatedAt: new Date().toISOString(),
      workouts: merged,
    });

    await applyPreferredWorkout();

    return {
      success: true,
      data: {
        count: merged.length,
      },
    };
  }

  async function clearCoachWorkoutFeed() {
    await coachWorkoutStorage.remove(COACH_FEED_KEY);
    const state = getState();
    if (state.workoutMeta?.source === 'coach') {
      await applyPreferredWorkout({ fallbackToWelcome: true });
    }
    return { success: true };
  }

  return {
    getCoachWorkoutCache,
    getCoachWorkoutForCurrentDay,
    syncCoachWorkoutFeed,
    clearCoachWorkoutFeed,
  };
}
