import { handleAthleteTodayDayChange, handleAthleteTodaySettingsChange } from './todayChangeActions.js';
import { handleAthleteWodNavigation } from './todayWodNavActions.js';

export async function handleAthleteWodAction(action, context) {
  return handleAthleteWodNavigation(action, context);
}

export async function handleAthleteTodayChangeAction(event, context) {
  const handledSettingsChange = await handleAthleteTodaySettingsChange(event, context);
  if (handledSettingsChange) return true;
  return handleAthleteTodayDayChange(event, context);
}
