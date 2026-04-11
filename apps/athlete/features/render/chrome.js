import { getAthleteNotificationCount } from '../../notifications.js';
import { isAthleteNativeVariant } from '../../platformVariant.js';

export function renderAthleteAppShell({ escapeHtml, getAppLabel, platformVariant = 'web' }) {
  const appLabel = getAppLabel();
  const isNative = isAthleteNativeVariant(platformVariant);
  return `
    <!-- LOADING SCREEN -->
    <div class="loading-screen" id="loading-screen">
      <div class="spinner"></div>
      <p data-loading-label>Carregando...</p>
    </div>

    <div class="app-container ${isNative ? 'app-container-native' : ''}">
      <!-- HEADER -->
      <header class="app-header ${isNative ? 'app-header-native' : ''}">
        <div class="header-content">
          ${isNative ? `
            <div class="native-appBar">
              <div class="native-appBrand">
                <img class="native-appMark" src="/branding/exports/ryxen-icon-64.png" alt="" aria-hidden="true">
                <div class="native-appBrandCopy">
                  <span class="native-appEyebrow">Ryxen</span>
                  <strong class="native-appTitle">${escapeHtml(appLabel)}</strong>
                </div>
              </div>
              <div class="header-account header-account-native" id="ui-headerAccount"></div>
            </div>
          ` : `
            <div class="header-topline">
              <div class="header-badge">
                <img class="header-badgeMark" src="/branding/exports/ryxen-icon-64.png" alt="" aria-hidden="true">
                <span>${escapeHtml(appLabel)}</span>
              </div>
              <div class="header-account" id="ui-headerAccount"></div>
            </div>
          `}
        </div>
      </header>

      <!-- NAV -->
      <nav class="bottom-nav ${isNative ? 'bottom-nav-native' : ''}">
        <div class="bottom-navItems ${isNative ? 'bottom-navItems-native' : ''}" id="ui-bottomNav"></div>
      </nav>

      <!-- MAIN -->
      <main class="app-main ${isNative ? 'app-main-native' : ''}" id="ui-main"></main>
    </div>

    <!-- MODALS -->
    <div id="ui-modals"></div>
  `;
}

function renderSessionStatusChip(sessionRestore, platformVariant) {
  if (sessionRestore === 'ready' || sessionRestore === 'idle') return '';
  const isNative = isAthleteNativeVariant(platformVariant);
  const toneClass = sessionRestore === 'failed' ? 'isWarn' : 'isInfo';
  const label = sessionRestore === 'failed' ? 'Sem sincronizar' : 'Reconectando';
  return `<span class="session-statusChip ${toneClass} ${isNative ? 'session-statusChip-native' : ''}">${label}</span>`;
}

function renderAccountButton({ escapeHtml, displayName, notificationCount, isNative }) {
  if (!isNative) {
    return `
      <button class="header-account-btn isActive" data-action="modal:open" data-modal="auth" type="button">
        ${escapeHtml(displayName)}
        ${notificationCount > 0 ? `<span class="header-accountBadge">${Math.min(notificationCount, 99)}</span>` : ''}
      </button>
    `;
  }

  const parts = String(displayName || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] || '');
  const initials = (parts.join('') || String(displayName || '?').slice(0, 1)).toUpperCase();

  return `
    <button class="native-accountBtn isActive" data-action="modal:open" data-modal="auth" type="button">
      <span class="native-accountAvatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <span class="native-accountCopy">
        <span class="native-accountLabel">Conta</span>
        <strong class="native-accountName">${escapeHtml(displayName)}</strong>
      </span>
      ${notificationCount > 0 ? `<span class="header-accountBadge">${Math.min(notificationCount, 99)}</span>` : ''}
    </button>
  `;
}

export function renderAthleteHeaderAccount(state, { escapeHtml, platformVariant = 'web' }) {
  const profile = state?.__ui?.auth?.profile || null;
  const notificationCount = getAthleteNotificationCount(state);
  const sessionRestore = state?.__ui?.sessionRestore || 'idle';
  const isNative = isAthleteNativeVariant(platformVariant);
  const sessionChip = renderSessionStatusChip(sessionRestore, platformVariant);

  if (!profile?.email) {
    return `
      <div class="header-accountGroup ${isNative ? 'header-accountGroup-native' : ''}">
        ${sessionChip}
        <button class="${isNative ? 'native-accountBtn' : 'header-account-btn'}" data-action="modal:open" data-modal="auth" type="button">
          ${isNative
            ? '<span class="native-accountAvatar" aria-hidden="true">IN</span><span class="native-accountCopy"><span class="native-accountLabel">Conta</span><strong class="native-accountName">Entrar</strong></span>'
            : 'Entrar'}
        </button>
      </div>
    `;
  }

  const displayName = profile.name || profile.email;
  return `
    <div class="header-accountGroup ${isNative ? 'header-accountGroup-native' : ''}">
      ${sessionChip}
      ${renderAccountButton({ escapeHtml, displayName, notificationCount, isNative })}
    </div>
  `;
}

function renderNavIcon(page) {
  switch (page) {
    case 'history':
      return `
        <svg class="nav-iconSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 17.5h3.5V11H5zm5.25 0h3.5V6h-3.5zm5.25 0H19v-9h-3.5z"></path>
        </svg>
      `;
    case 'account':
      return `
        <svg class="nav-iconSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 12a3.75 3.75 0 1 0-3.75-3.75A3.75 3.75 0 0 0 12 12m0 1.75c-3.13 0-5.68 1.68-6.68 4.18a.75.75 0 0 0 .7 1.07h11.96a.75.75 0 0 0 .7-1.07c-1-2.5-3.55-4.18-6.68-4.18"></path>
        </svg>
      `;
    default:
      return `
        <svg class="nav-iconSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4.75 12.5 12 5.75l7.25 6.75v5.75a.75.75 0 0 1-.75.75h-4.25v-4.75h-4.5v4.75H5.5a.75.75 0 0 1-.75-.75z"></path>
        </svg>
      `;
  }
}

export function renderAthleteBottomNav(state, { platformVariant = 'web' } = {}) {
  const currentPage = state?.__ui?.currentPage || 'today';
  const isNative = isAthleteNativeVariant(platformVariant);
  const items = [
    { page: 'today', label: 'Hoje' },
    { page: 'history', label: 'Evolução' },
    { page: 'account', label: 'Conta' },
  ];

  return items.map((item) => `
    <button class="nav-btn ${isNative ? 'nav-btn-native' : ''} ${currentPage === item.page ? 'nav-btn-active' : ''} ${item.page === 'today' ? 'nav-btn-primary' : ''}" data-action="page:set" data-page="${item.page}" aria-current="${currentPage === item.page ? 'page' : 'false'}" type="button">
      ${isNative ? `<span class="nav-icon nav-icon-native">${renderNavIcon(item.page)}</span>` : (item.icon ? `<span class="nav-icon">${item.icon}</span>` : '')}
      <span class="nav-label">${item.label}</span>
    </button>
  `).join('');
}
