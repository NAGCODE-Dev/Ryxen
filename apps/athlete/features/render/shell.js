import { renderAthleteTodayPage } from '../today/page.js';
import { renderAthleteHistoryPage } from '../history/page.js';
import { renderAthleteAccountPage } from '../account/page.js';
import {
  renderAthleteAuthModal,
  renderAthleteSettingsModal,
} from '../account/modals.js';
import { renderAthleteImportModal } from '../import/modal.js';
import { renderAthletePrsModal } from '../prs/modal.js';
import {
  createAthleteRenderHelpers,
  describeAthleteBenefitSource,
  formatDateShort,
  formatSubscriptionPlanName,
  isDeveloperEmail,
  normalizeAthleteBenefits,
  renderAccountSkeleton,
} from '../../components/renderHelpers.js';

export function renderAppShell() {
  const appLabel = getAppLabel();
  return `
    <!-- LOADING SCREEN -->
    <div class="loading-screen" id="loading-screen">
      <div class="spinner"></div>
      <p data-loading-label>Carregando...</p>
    </div>

    <div class="app-container">
      <!-- HEADER -->
      <header class="app-header">
        <div class="header-content">
          <div class="header-topline">
            <div class="header-badge">
              <img class="header-badgeMark" src="/icons/ryxen-mark.svg" alt="" aria-hidden="true">
              <span>${escapeHtml(appLabel)}</span>
            </div>
            <div class="header-account" id="ui-headerAccount"></div>
          </div>
        </div>
      </header>

      <!-- NAV -->
      <nav class="bottom-nav">
        <div class="bottom-navItems" id="ui-bottomNav"></div>
      </nav>

      <!-- MAIN -->
      <main class="app-main" id="ui-main"></main>
    </div>

    <!-- MODALS -->
    <div id="ui-modals"></div>
  `;
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
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};
  const authMode = state?.__ui?.authMode || 'signin';

  if (modal === 'prs') return renderPrsModal(prs);
  if (modal === 'settings') return renderSettingsModal(settings);
  if (modal === 'import') return renderImportModal(state);
  if (modal === 'auth') return renderAthleteAuthModal({
    auth: {
      ...(state?.__ui?.auth || {}),
      isBusy: state?.__ui?.isBusy || false,
      passwordReset: state?.__ui?.passwordReset || {},
      signupVerification: state?.__ui?.signupVerification || {},
      admin: state?.__ui?.admin || {},
      athleteOverview: state?.__ui?.athleteOverview || {},
      coachPortal: state?.__ui?.coachPortal || {},
    },
    authMode,
    helpers: {
      escapeHtml,
      formatDateShort,
      renderAccountSkeleton,
      describeAthleteBenefitSource,
      formatSubscriptionPlanName,
      isDeveloperEmail,
      normalizeAthleteBenefits,
    },
  });

  return '';
}

export function renderHeaderAccount(state) {
  const profile = state?.__ui?.auth?.profile || null;

  if (!profile?.email) {
    return '<button class="header-account-btn" data-action="modal:open" data-modal="auth" type="button">Entrar</button>';
  }

  const displayName = profile.name || profile.email;
  return `
    <button class="header-account-btn isActive" data-action="modal:open" data-modal="auth" type="button">
      ${escapeHtml(displayName)}
    </button>
  `;
}

export function renderMainContent(state) {
  const currentPage = state?.__ui?.currentPage || 'today';
  const pageHelpers = createAthletePageHelpers();
  if (currentPage === 'history') return renderAthleteHistoryPage(state, pageHelpers);
  if (currentPage === 'account') return renderAthleteAccountPage(state, pageHelpers);
  return renderAthleteTodayPage(state, pageHelpers);
}

export function renderBottomNav(state) {
  const currentPage = state?.__ui?.currentPage || 'today';
  const items = [
    { page: 'today', label: 'Hoje' },
    { page: 'history', label: 'Evolução' },
    { page: 'account', label: 'Conta' },
  ];

  return items.map((item) => `
    <button class="nav-btn ${currentPage === item.page ? 'nav-btn-active' : ''} ${item.page === 'today' ? 'nav-btn-primary' : ''}" data-action="page:set" data-page="${item.page}" aria-current="${currentPage === item.page ? 'page' : 'false'}" type="button">
      ${item.icon ? `<span class="nav-icon">${item.icon}</span>` : ''}
      <span class="nav-label">${item.label}</span>
    </button>
  `).join('');
}

export function renderImportModal(state = {}) {
  return renderAthleteImportModal(state, { escapeHtml });
}

export function renderPrsModal(prs = {}) {
  return renderAthletePrsModal(prs, { escapeHtml });
}

export function renderSettingsModal(settings = {}) {
  return renderAthleteSettingsModal(settings);
}

function createAthletePageHelpers() {
  return createAthleteRenderHelpers({ escapeHtml });
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
