import { renderAthleteTodayPage } from '../today/page.js';
import { renderAthleteHistoryPage } from '../history/page.js';
import { renderAthleteAccountPage } from '../account/page.js';

export function renderAthleteMainContent(state, { createPageHelpers }) {
  const currentPage = state?.__ui?.currentPage || 'today';
  const pageHelpers = createPageHelpers(state);

  if (currentPage === 'history') return renderAthleteHistoryPage(state, pageHelpers);
  if (currentPage === 'account') return renderAthleteAccountPage(state, pageHelpers);
  return renderAthleteTodayPage(state, pageHelpers);
}
