export function renderAthleteAppShell({ escapeHtml, getAppLabel }) {
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

export function renderAthleteHeaderAccount(state, { escapeHtml }) {
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

export function renderAthleteBottomNav(state) {
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
