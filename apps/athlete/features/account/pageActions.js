import { handleAthleteAdminAction } from './adminActions.js';
import { handleAthletePageSessionAction } from './pageSessionActions.js';

export async function handleAthleteAccountHistoryAction(action, context) {
  const handledByAdmin = await handleAthleteAdminAction(action, context);
  if (handledByAdmin) return true;

  return handleAthletePageSessionAction(action, context);
}
