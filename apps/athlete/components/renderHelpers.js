import { getAthleteImportUsage, normalizeAthleteBenefits } from '../../../src/core/services/athleteBenefitUsage.js';
import { isDeveloperEmail } from '../../../src/core/utils/devAccess.js';
import { renderWorkoutBlock } from '../renderers/workoutBlock.js';
import {
  describeAthleteBenefitSource,
  formatDateShort,
  formatDay,
  formatNumber,
  formatSubscriptionPlanName,
  formatTrendValue,
  renderSparkline,
} from './renderFormatters.js';
import {
  renderBottomTools,
  renderPageFold,
  renderPageHero,
  renderTrendSkeletons,
} from './pageChrome.js';

export function createAthleteRenderHelpers({ escapeHtml, platformVariant = 'web' } = {}) {
  const resolvedVariant = platformVariant === 'native' ? 'native' : 'web';
  return {
    platformVariant: resolvedVariant,
    renderPageHero: (options) => renderPageHero(options, { escapeHtml, platformVariant: resolvedVariant }),
    renderPageFold: (options) => renderPageFold(options, { escapeHtml, platformVariant: resolvedVariant }),
    renderTrendSkeletons,
    renderSparkline,
    formatTrendValue,
    formatNumber,
    formatDateShort,
    renderBottomTools: (state) => renderBottomTools(state, { escapeHtml, platformVariant: resolvedVariant }),
    renderWorkoutBlock: (block, blockIndex, ui) => renderWorkoutBlock(block, blockIndex, ui, { escapeHtml }),
    renderAccountSkeleton,
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    escapeHtml,
    isDeveloperEmail,
    normalizeAthleteBenefits,
    getAthleteImportUsage,
    formatDay,
  };
}

export { normalizeAthleteBenefits };
export { isDeveloperEmail };
export { getAthleteImportUsage };
export {
  describeAthleteBenefitSource,
  formatDateShort,
  formatDay,
  formatNumber,
  formatSubscriptionPlanName,
  formatTrendValue,
  renderSparkline,
};

export function renderAccountSkeleton() {
  return `
    <div class="sheet-stack isSkeleton">
      <div class="skeleton skeleton-line skeleton-line-lg"></div>
      <div class="skeleton skeleton-line"></div>
    </div>
  `;
}
