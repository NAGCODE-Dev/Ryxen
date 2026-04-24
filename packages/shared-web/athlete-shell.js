import { getStoredProfile, hasStoredSession } from './auth.js';
import { createStorage } from '../../src/adapters/storage/storageFactory.js';
import { loadParsedWeeks, saveParsedWeeks } from '../../src/adapters/pdf/pdfRepository.js';
import { getWorkoutFromWeek } from '../../src/adapters/pdf/customPdfParser.js';
import { getDayName } from '../../src/core/utils/date.js';
import {
  getAccessContext,
  getAthleteSummary,
  getAthleteWorkoutsRecent,
  getImportedPlanSnapshot,
} from '../../src/core/services/gymService.js';

const activeWeekStorage = createStorage('active-week', 100);
const dayOverrideStorage = createStorage('day-override', 100);
const prefsStorage = createStorage('preferences', 1000);

export async function loadAthleteTodaySnapshot(options = {}) {
  const sportType = String(options?.sportType || 'cross').trim() || 'cross';
  const profile = getStoredProfile();
  const authenticated = hasStoredSession();
  const selection = await readTodaySelection();
  const preferences = await readAthletePreferences();

  let weeks = [];
  let importedPlanMeta = null;
  let importedPlanSource = 'empty';

  const localPlan = await loadParsedWeeks();
  if (localPlan?.success && Array.isArray(localPlan?.data?.weeks) && localPlan.data.weeks.length) {
    weeks = localPlan.data.weeks;
    importedPlanMeta = localPlan.data.metadata || null;
    importedPlanSource = 'local';
  }

  const [remoteImport, summarySettled, workoutsSettled, accessSettled] = authenticated
    ? await Promise.all([
        weeks.length ? Promise.resolve({ importedPlan: null }) : safeServiceCall(() => getImportedPlanSnapshot(), { importedPlan: null }),
        safeServiceCall(() => getAthleteSummary({ sportType }), null),
        safeServiceCall(() => getAthleteWorkoutsRecent({ sportType }), { recentWorkouts: [] }),
        safeServiceCall(() => getAccessContext(), null),
      ])
    : [{ importedPlan: null }, null, { recentWorkouts: [] }, null];

  const importedPlan = remoteImport?.importedPlan || null;
  if (!weeks.length && Array.isArray(importedPlan?.weeks) && importedPlan.weeks.length) {
    weeks = importedPlan.weeks;
    importedPlanMeta = {
      ...(importedPlan.metadata || {}),
      updatedAt: importedPlan.updatedAt || importedPlan.metadata?.uploadedAt || null,
      source: importedPlan.metadata?.source || 'account',
    };
    importedPlanSource = 'remote';
    await saveParsedWeeks(weeks, importedPlanMeta || {});
  }

  const snapshot = buildAthleteTodaySnapshot({
    profile,
    weeks,
    selection: {
      ...selection,
      activeWeekNumber: selection?.activeWeekNumber || Number(importedPlan?.activeWeekNumber) || null,
    },
    preferences,
    athleteSummary: summarySettled,
    accessContext: accessSettled,
    recentWorkouts: workoutsSettled?.recentWorkouts || [],
    importedPlanMeta,
    importedPlanSource,
  });

  return {
    ...snapshot,
    authenticated,
    profile,
    preferences,
  };
}

export function buildAthleteTodaySnapshot({
  profile = null,
  weeks = [],
  selection = {},
  preferences = {},
  athleteSummary = null,
  accessContext = null,
  recentWorkouts = [],
  importedPlanMeta = null,
  importedPlanSource = 'empty',
} = {}) {
  const normalizedWeeks = Array.isArray(weeks)
    ? [...weeks].sort((a, b) => Number(a?.weekNumber || 0) - Number(b?.weekNumber || 0))
    : [];
  const activeWeekNumber = resolveActiveWeekNumber(normalizedWeeks, selection?.activeWeekNumber);
  const activeWeek = normalizedWeeks.find((week) => Number(week?.weekNumber) === Number(activeWeekNumber)) || normalizedWeeks[0] || null;
  const availableDays = Array.isArray(activeWeek?.workouts)
    ? activeWeek.workouts.map((workout) => String(workout?.day || '').trim()).filter(Boolean)
    : [];
  const currentDay = resolveCurrentDay(availableDays, selection?.currentDay);
  const workout = activeWeek ? (getWorkoutFromWeek(activeWeek, currentDay) || activeWeek.workouts?.[0] || null) : null;
  const workoutBlocks = Array.isArray(workout?.blocks) ? workout.blocks : [];

  return {
    profile,
    weeks: normalizedWeeks,
    activeWeekNumber,
    currentDay,
    workout,
    workoutMeta: workout
      ? {
          source: importedPlanSource === 'empty' ? 'unavailable' : `${importedPlanSource}-imported-plan`,
          weekNumber: activeWeek?.weekNumber || null,
          day: workout.day || currentDay || null,
          blockCount: workoutBlocks.length,
          availableDays,
        }
      : null,
    importedPlanMeta,
    workoutContext: {
      source: importedPlanSource,
      availableDays,
      availableWeeks: normalizedWeeks.map((week) => week?.weekNumber).filter(Boolean),
      recentWorkouts,
      accessContext,
      athleteBenefits: athleteSummary?.athleteBenefits || null,
      stats: athleteSummary?.stats || null,
      preferences,
    },
  };
}

export async function readAthletePreferences() {
  try {
    const stored = await prefsStorage.get('preferences');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

export async function readTodaySelection() {
  const [storedWeek, storedDay] = await Promise.all([
    activeWeekStorage.get('active-week').catch(() => null),
    dayOverrideStorage.get('custom-day').catch(() => null),
  ]);

  return {
    activeWeekNumber: Number(storedWeek) || null,
    currentDay: String(storedDay || '').trim() || null,
  };
}

export async function persistTodaySelection({ activeWeekNumber = null, currentDay = null } = {}) {
  if (Number.isFinite(Number(activeWeekNumber)) && Number(activeWeekNumber) > 0) {
    await activeWeekStorage.set('active-week', Number(activeWeekNumber));
  } else {
    await activeWeekStorage.remove('active-week');
  }

  if (String(currentDay || '').trim()) {
    await dayOverrideStorage.set('custom-day', String(currentDay).trim());
  } else {
    await dayOverrideStorage.remove('custom-day');
  }
}

export async function clearTodayDayOverride() {
  await dayOverrideStorage.remove('custom-day');
}

function resolveActiveWeekNumber(weeks, requestedWeekNumber) {
  const requested = Number(requestedWeekNumber) || null;
  if (requested && weeks.some((week) => Number(week?.weekNumber) === requested)) return requested;
  return Number(weeks[0]?.weekNumber) || null;
}

function resolveCurrentDay(availableDays = [], requestedDay = '') {
  const normalizedRequested = String(requestedDay || '').trim();
  if (normalizedRequested && availableDays.includes(normalizedRequested)) return normalizedRequested;

  const today = getDayName();
  if (availableDays.includes(today)) return today;

  return availableDays[0] || today;
}

async function safeServiceCall(task, fallbackValue) {
  try {
    return await task();
  } catch {
    return fallbackValue;
  }
}
