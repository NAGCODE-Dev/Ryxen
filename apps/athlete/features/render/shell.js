import {
  createAthleteRenderHelpers,
  describeAthleteBenefitSource,
  formatDateShort,
  formatSubscriptionPlanName,
  isDeveloperEmail,
  normalizeAthleteBenefits,
  renderAccountSkeleton,
} from '../../components/renderHelpers.js';
import {
  renderAthleteAppShell,
  renderAthleteBottomNav,
  renderAthleteHeaderAccount,
} from './chrome.js';
import { renderAthleteModals } from './modals.js';
import { renderAthleteMainContent } from './pages.js';

export function renderAppShell() {
  return renderAthleteAppShell({ escapeHtml, getAppLabel });
}

export function renderAll(state = {}) {
  const headerAccountHtml = renderHeaderAccount(state);
  const mainHtml = renderMainContent(state);
  const bottomNavHtml = renderBottomNav(state);
  const modalsHtml = renderModals(state);

  return {
    headerAccountHtml,
    mainHtml,
    bottomNavHtml,
    modalsHtml,
  };
}

export function renderModals(state) {
  return renderAthleteModals(state, createAthleteModalHelpers());
}

export function renderHeaderAccount(state) {
  return renderAthleteHeaderAccount(state, { escapeHtml });
}

export function renderMainContent(state) {
  return renderAthleteMainContent(state, {
    createPageHelpers: createAthletePageHelpers,
  });
}

export function renderBottomNav(state) {
  return renderAthleteBottomNav(state);
}

export function renderImportModal(state = {}) {
  return renderAthleteModals({
    ...state,
    __ui: {
      ...(state?.__ui || {}),
      modal: 'import',
    },
  }, createAthleteModalHelpers());
}

export function renderPrsModal(prs = {}) {
  return renderAthleteModals({
    prs,
    __ui: { modal: 'prs' },
  }, createAthleteModalHelpers());
}

export function renderSettingsModal(settings = {}) {
  return renderAthleteModals({
    __ui: {
      modal: 'settings',
      settings,
    },
  }, createAthleteModalHelpers());
}

function createAthletePageHelpers() {
  return createAthleteRenderHelpers({ escapeHtml });
}

function createAthleteModalHelpers() {
  return {
    escapeHtml,
    formatDateShort,
    renderAccountSkeleton,
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    isDeveloperEmail,
    normalizeAthleteBenefits,
  };
}

function getAppLabel() {
  try {
    return window.__RYXEN_APP_CONTEXT__?.appLabel || window.__CROSSAPP_APP_CONTEXT__?.appLabel || 'Ryxen Cross';
  } catch {
    return 'Ryxen Cross';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}
