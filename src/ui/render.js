import { renderAthleteTodayPage } from '../../apps/athlete/pages/today.js';
import { renderAthleteHistoryPage } from '../../apps/athlete/pages/history.js';
import { renderAthleteAccountPage } from '../../apps/athlete/pages/account.js';
import { renderAthleteAuthModal } from '../../apps/athlete/modals/authModal.js';
import { renderAthleteImportModal } from '../../apps/athlete/modals/importModal.js';
import { renderAthletePrsModal } from '../../apps/athlete/modals/prsModal.js';
import { renderAthleteSettingsModal } from '../../apps/athlete/modals/settingsModal.js';
import {
  createAthleteRenderHelpers,
  describeAthleteBenefitSource,
  formatDateShort,
  formatSubscriptionPlanName,
  isDeveloperEmail,
  normalizeAthleteBenefits,
  renderAccountSkeleton,
} from '../../apps/athlete/renderHelpers.js';

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

function getAppLabel() {
  try {
    return window.__CROSSAPP_APP_CONTEXT__?.appLabel || 'Ryxen Cross';
  } catch {
    return 'Ryxen Cross';
  }
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

function renderWeekChips(state) {
  const weeks = state?.weeks || [];
  const activeWeek = state?.activeWeekNumber;

  if (!weeks.length) return '<div class="week-chip-empty">Carregue um PDF</div>';

  return weeks.map((w) => {
    const weekNumber =
      (typeof w === 'number' || typeof w === 'string')
        ? Number(w)
        : (w?.weekNumber ?? w?.number ?? w?.week ?? w?.id);

    const isActive = weekNumber === activeWeek;

    return `
      <button
        class="week-chip ${isActive ? 'week-chip-active' : ''}"
        data-action="week:select"
        data-week="${weekNumber}"
        aria-pressed="${isActive}"
        type="button"
      >
        Semana ${weekNumber}
      </button>
    `;
  }).join('');
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

function renderAthleteAccessBanner(state) {
  const gymAccess = state?.__ui?.coachPortal?.gymAccess || [];
  if (!gymAccess.length) return '';

  const blocked = gymAccess.find((item) => item?.canAthletesUseApp === false);
  const warning = gymAccess.find((item) => item?.warning);
  const active = gymAccess.find((item) => item?.canAthletesUseApp === true);
  const target = blocked || warning || active;
  if (!target) return '';

  const tone = blocked ? 'isWarn' : (warning ? 'isInfo' : 'isGood');
  const title = blocked
    ? 'Acesso do atleta limitado'
    : warning
      ? 'Atenção na assinatura do coach'
      : 'Acesso do atleta ativo';
  const detail = target.warning
    || (target.daysRemaining > 0 ? `Acesso disponível por mais ${target.daysRemaining} dia(s).` : 'Seu coach está com acesso ativo.');

  return `
    <div class="athlete-accessBanner ${tone}">
      <div class="athlete-accessBannerTitle">${escapeHtml(title)}</div>
      <div class="athlete-accessBannerText">${escapeHtml(detail)}</div>
    </div>
  `;
}

function createAthletePageHelpers() {
  return createAthleteRenderHelpers({ escapeHtml });
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}
