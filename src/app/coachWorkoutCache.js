const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const COACH_WORKOUT_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeCoachWorkoutFeed(workouts = [], now = Date.now()) {
  const baseTime = Number.isFinite(now) ? now : Date.now();

  return workouts
    .filter((workout) => workout && typeof workout === 'object' && workout.payload && typeof workout.payload === 'object')
    .map((workout) => {
      const receivedAt = new Date(baseTime).toISOString();
      const expiresAt = new Date(baseTime + COACH_WORKOUT_TTL_MS).toISOString();
      return {
        id: Number(workout.id) || null,
        gymId: Number(workout.gym_id || workout.gymId) || null,
        gymName: String(workout.gym_name || workout.gymName || '').trim(),
        title: String(workout.title || '').trim(),
        description: String(workout.description || '').trim(),
        scheduledDate: String(workout.scheduled_date || workout.scheduledDate || '').trim(),
        publishedAt: workout.published_at || workout.publishedAt || workout.created_at || workout.createdAt || receivedAt,
        createdAt: workout.created_at || workout.createdAt || receivedAt,
        payload: workout.payload,
        benchmark: workout.benchmark || null,
        receivedAt,
        expiresAt,
      };
    });
}

export function pruneCoachWorkoutFeed(feed = [], now = Date.now()) {
  const baseTime = Number.isFinite(now) ? now : Date.now();
  return feed.filter((item) => {
    const expiresAt = Date.parse(item?.expiresAt || '');
    return Number.isFinite(expiresAt) && expiresAt > baseTime;
  });
}

export function resolveCoachWorkoutForDay(feed = [], dayName) {
  const targetDay = String(dayName || '').trim();
  if (!targetDay) return null;

  const match = pruneCoachWorkoutFeed(feed)
    .filter((item) => getDayNameFromScheduledDate(item?.scheduledDate) === targetDay)
    .sort((a, b) => {
      const aPublished = Date.parse(a?.publishedAt || a?.createdAt || 0) || 0;
      const bPublished = Date.parse(b?.publishedAt || b?.createdAt || 0) || 0;
      if (bPublished !== aPublished) return bPublished - aPublished;
      return (Number(b?.id) || 0) - (Number(a?.id) || 0);
    });

  return match[0] || null;
}

export function getDayNameFromScheduledDate(dateString) {
  const value = String(dateString || '').trim();
  if (!value) return null;

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return DAYS[date.getDay()] || null;
}
