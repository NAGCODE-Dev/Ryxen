import {
  renderTodayOverview,
  renderTodaySessionCard,
  renderTodayWorkoutHeader,
} from './sections.js';
import { renderTodayEmptyState, renderTodayPageIntro } from './chrome.js';

export function renderAthleteTodayPage(state, helpers) {
  const { renderPageHero, renderBottomTools, renderWorkoutBlock, escapeHtml, formatDay, platformVariant } = helpers;
  const workout = state?.workout ?? state?.workoutOfDay;
  const isNative = platformVariant === 'native';
  const containerClass = `workout-container ${isNative ? 'workout-container-native native-screenStack native-screenStack-today' : ''}`.trim();

  if (!workout || !workout.blocks?.length) {
    return `
      <div class="${containerClass}">
        ${renderTodayPageIntro(state, { renderPageHero, escapeHtml, formatDay })}
        ${renderTodayOverview(state, null, { escapeHtml, formatDay })}
        ${renderTodayEmptyState(state, { escapeHtml, formatDay })}
      </div>
    `;
  }

  const ui = state?.__ui || {};
  const workoutContext = state?.workoutContext || {};
  const showSourceToggle = !!workoutContext.canToggle;
  const activeSource = workoutContext.activeSource || 'uploaded';
  const warningsCount = workout.warnings?.length || 0;

  return `
    <div class="${containerClass}">
      ${renderTodayPageIntro(state, { renderPageHero, escapeHtml, formatDay })}
      ${renderTodayOverview(state, workout, { escapeHtml, formatDay })}
      ${renderTodaySessionCard(state, workout, { escapeHtml, formatDay })}
      ${renderTodayWorkoutHeader({ showSourceToggle, activeSource, warningsCount })}

      ${workout.blocks.map((block, blockIndex) => renderWorkoutBlock(block, blockIndex, ui)).join('')}
      ${renderBottomTools(state)}
    </div>
  `;
}
