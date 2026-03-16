import { renderTodayPage as renderTodayPageDomain } from './render-domains/today.js';
import { renderModals as renderModalsDomain } from './render-domains/modals.js';
import {
  renderHistoryPage as renderHistoryPageDomain,
  inferExerciseHelp as inferExerciseHelpDomain,
} from './render-domains/history.js';
import { renderCompetitionsPage as renderCompetitionsPageDomain } from './render-domains/competitions.js';
import {
  renderAccountPage as renderAccountPageDomain,
  renderAuthModal as renderAuthModalDomain,
} from './render-domains/account.js';

export function renderAppShell() {
  const appLabel = getAppLabel();
  return `
    <div class="app-container">
      <div class="app-shell">
        <aside class="app-sidebar" aria-label="Navegação principal do atleta">
          <div class="app-sidebarBrand">
            <div class="header-badge">${escapeHtml(appLabel)}</div>
            <h1 class="app-sidebarTitle">Treine hoje. Veja sua evolução.</h1>
            <p class="app-sidebarText">Acompanhe o treino do dia, importe planilhas e mantenha seus registros no mesmo lugar.</p>
          </div>
          <div class="app-sidebarMeta" id="ui-sidebarMeta"></div>
          <nav class="app-sidebarNav">
            <div class="app-sidebarNavItems" id="ui-sidebarNav"></div>
          </nav>
        </aside>

        <div class="app-stage">
      <!-- LOADING SCREEN -->
      <div class="loading-screen" id="loading-screen">
        <div class="spinner"></div>
        <p>Carregando...</p>
      </div>

      <!-- HEADER -->
      <header class="app-header">
        <div class="header-content">
          <div class="header-topline">
            <div class="header-badge">${escapeHtml(appLabel)}</div>
            <div class="header-account" id="ui-headerAccount"></div>
          </div>
        </div>
      </header>

      <!-- MAIN -->
      <main class="app-main" id="ui-main"></main>
        </div>
      </div>

      <!-- MODALS -->
      <div id="ui-modals"></div>

      <!-- BOTTOM NAV -->
      <nav class="bottom-nav">
        <div class="bottom-navItems" id="ui-bottomNav"></div>
      </nav>
    </div>
  `;
}

function getAppLabel() {
  try {
    return window.__CROSSAPP_APP_CONTEXT__?.appLabel || 'CrossApp Cross';
  } catch {
    return 'CrossApp Cross';
  }
}

export function renderAll(state = {}) {
  const headerAccountHtml = renderHeaderAccount(state);
  const mainHtml = renderMainContent(state);
  const bottomNavHtml = renderBottomNav(state);
  const sidebarNavHtml = renderSidebarNav(state);
  const sidebarMetaHtml = renderSidebarMeta(state);
  const modalsHtml = renderModals(state);
  
  return {
    headerAccountHtml,
    mainHtml,
    bottomNavHtml,
    sidebarNavHtml,
    sidebarMetaHtml,
    modalsHtml,
  };
}

function renderBottomTools(state) {
  const currentPage = state?.__ui?.currentPage || 'today';
  if (currentPage !== 'today') return '';

  return `
    <div class="bottom-tools">
      <button class="quick-action quick-action-primary quick-action-wide" data-action="modal:open" data-modal="import" type="button">
        <span class="quick-actionIcon">IMPORTAR</span>
        <span class="quick-actionLabel">Adicionar treino ou planilha</span>
      </button>
    </div>
  `;
}

function renderModals(state) {
  return renderModalsDomain(state, {
    renderAuthModal,
  });
}

function formatDay(day) {
  const days = {
    'segunda': 'Segunda',
    'terça': 'Terça',
    'terca': 'Terça',
    'quarta': 'Quarta',
    'quinta': 'Quinta',
    'sexta': 'Sexta',
    'sábado': 'Sábado',
    'sabado': 'Sábado',
    'domingo': 'Domingo',
  };
  return days[String(day || '').toLowerCase()] || day || 'Hoje';
}

function formatSubtitle(state) {
  const day = formatDay(state?.currentDay);
  const week = state?.activeWeekNumber ?? '—';
  const total = (state?.weeks?.length ?? 0);

  if (!total) return 'Carregue um PDF para começar';
  return `Semana ${week} de ${total} • ${day}`;
}

function renderHeaderAccount(state) {
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

function renderMainContent(state) {
  const currentPage = state?.__ui?.currentPage || 'today';
  if (currentPage === 'history') return renderHistoryPage(state);
  if (currentPage === 'competitions') return renderCompetitionsPage(state);
  if (currentPage === 'account') return renderAccountPage(state);
  return renderTodayPageDomain(state, {
    renderPageHero,
    renderSummaryTile,
    renderWorkoutBlock,
    renderBottomTools,
    formatDay,
    formatSubtitle,
    escapeHtml,
  });
}

function renderBottomNav(state) {
  return renderPrimaryNav(state, { variant: 'bottom' });
}

function renderSidebarNav(state) {
  return renderPrimaryNav(state, { variant: 'sidebar' });
}

function renderPrimaryNav(state, { variant = 'bottom' } = {}) {
  const currentPage = state?.__ui?.currentPage || 'today';
  const items = getPrimaryNavItems();

  return items.map((item) => {
    const isPage = item.type !== 'modal';
    const isActive = isPage && currentPage === item.page;
    const dataAttrs = isPage
      ? `data-action="page:set" data-page="${item.page}"`
      : `data-action="modal:open" data-modal="${item.modal}"`;
    const buttonClass = variant === 'sidebar' ? 'sidebar-navBtn' : 'nav-btn';
    const iconClass = variant === 'sidebar' ? 'sidebar-navIcon' : 'nav-icon';
    const labelClass = variant === 'sidebar' ? 'sidebar-navLabel' : 'nav-label';

    return `
      <button class="${buttonClass} ${isActive ? `${buttonClass}-active` : ''} ${item.page === 'today' && variant === 'bottom' ? 'nav-btn-primary' : ''}" ${dataAttrs} type="button">
        <span class="${iconClass}">${item.icon}</span>
        <span class="${labelClass}">${item.label}</span>
        ${variant === 'sidebar' ? `<span class="sidebar-navMeta">${escapeHtml(item.meta || '')}</span>` : ''}
      </button>
    `;
  }).join('');
}

function getPrimaryNavItems() {
  return [
    { page: 'today', icon: '◉', label: 'Hoje', meta: 'treino do dia' },
    { type: 'modal', modal: 'import', icon: '+', label: 'Importar', meta: 'planilha ou mídia' },
    { page: 'history', icon: '↗', label: 'Perfil', meta: 'registros e benchmarks' },
    { page: 'account', icon: 'ID', label: 'Conta', meta: 'segurança e coach' },
  ];
}

function renderSidebarMeta(state) {
  const profile = state?.__ui?.auth?.profile || null;
  const currentPage = state?.__ui?.currentPage || 'today';
  const workout = state?.workout ?? state?.workoutOfDay;
  const athleteOverview = state?.__ui?.athleteOverview || {};
  const athleteProfile = state?.__ui?.athleteProfile || {};
  const pageSummary = buildSidebarPageSummary(currentPage, state, {
    workout,
    athleteOverview,
    athleteProfile,
  });

  return `
    <div class="sidebar-panel">
      <span class="sidebar-panelLabel">Agora</span>
      <strong class="sidebar-panelTitle">${escapeHtml(pageSummary.title)}</strong>
      <span class="sidebar-panelText">${escapeHtml(pageSummary.detail)}</span>
    </div>
    <div class="sidebar-panel">
      <span class="sidebar-panelLabel">Conta</span>
      <strong class="sidebar-panelTitle">${escapeHtml(profile?.name || 'Modo visitante')}</strong>
      <span class="sidebar-panelText">${escapeHtml(profile?.email || 'Entre ou crie sua conta para salvar sua rotina e seus resultados.')}</span>
    </div>
  `;
}

function buildSidebarPageSummary(currentPage, state, context = {}) {
  const { workout, athleteOverview, athleteProfile } = context;
  const measurementsCount = Array.isArray(athleteProfile?.measurements) ? athleteProfile.measurements.length : 0;
  const recordsCount = Array.isArray(athleteOverview?.prHistory) ? athleteOverview.prHistory.length : Object.keys(state?.prs || {}).length;
  const benchmarkCount = Array.isArray(athleteOverview?.benchmarkHistory) ? athleteOverview.benchmarkHistory.length : 0;

  if (currentPage === 'today') {
    return {
      title: workout?.blocks?.length ? 'Treino carregado' : 'Treino do dia',
      detail: workout?.blocks?.length
        ? formatSubtitle(state)
        : 'Abra o treino de hoje ou importe uma planilha para começar.',
    };
  }

  if (currentPage === 'history') {
    return {
      title: 'Perfil do atleta',
      detail: `${recordsCount} registro(s), ${benchmarkCount} benchmark(s) e ${measurementsCount} medida(s) reunidos no seu histórico.`,
    };
  }

  if (currentPage === 'account') {
    return {
      title: 'Conta',
      detail: 'Dados da conta, segurança e acesso ao Coach Portal no fim da página.',
    };
  }

  return {
    title: 'CrossApp',
    detail: 'Treino, evolução e conta em um fluxo só.',
  };
}

function renderHistoryPage(state) {
  return renderHistoryPageDomain(state, {
    renderPageHero,
    renderSummaryTile,
    renderPageFold,
    renderListSkeletons,
    renderTrendSkeletons,
    renderSparkline,
    formatTrendValue,
    formatNumber,
    escapeHtml,
    escapeAttribute,
  });
}

function renderCompetitionsPage(state) {
  return renderCompetitionsPageDomain(state, {
    renderPageHero,
    renderSummaryTile,
    renderPageFold,
    renderListSkeletons,
    getCompetitionProviderVisual,
    formatCompetitionMetaLine,
    competitionStatusClass,
    formatCompetitionStatus,
    formatCompetitionProvider,
    formatDateShort,
    escapeHtml,
    escapeAttribute,
  });
}

function renderAccountPage(state) {
  return renderAccountPageDomain(state, {
    renderPageHero,
    renderSummaryTile,
    renderPageFold,
    renderAccountSkeleton,
    formatDateShort,
    escapeHtml,
  });
}

function renderPageHero({ eyebrow, title, subtitle, actions = '', footer = '' }) {
  return `
    <section class="page-hero">
      <div class="page-heroBody">
        ${eyebrow ? `<div class="page-heroEyebrow">${escapeHtml(eyebrow)}</div>` : ''}
        <h1 class="page-heroTitle">${escapeHtml(title || '')}</h1>
        ${subtitle ? `<p class="page-heroSubtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-heroActions">${actions}</div>` : ''}
      ${footer ? `<div class="page-heroFooter">${footer}</div>` : ''}
    </section>
  `;
}

function renderPageFold({ title, subtitle = '', content = '', open = true }) {
  return `
    <details class="page-fold page-section" ${open ? 'open' : ''}>
      <summary class="page-foldSummary">
        <div class="page-foldSummaryRow">
          <div class="page-foldHead">
            <strong class="page-foldTitle">${escapeHtml(title || '')}</strong>
            ${subtitle ? `<span class="page-foldSubtitle">${escapeHtml(subtitle)}</span>` : ''}
          </div>
          <span class="page-foldChevron">⌄</span>
        </div>
      </summary>
      <div class="page-foldBody">
        ${content}
      </div>
    </details>
  `;
}

function renderListSkeletons(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="coach-listItem static isSkeleton">
      <div class="skeleton skeleton-line skeleton-line-lg"></div>
      <div class="skeleton skeleton-line"></div>
    </div>
  `).join('');
}

function renderTrendSkeletons(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="trend-card isSkeleton">
      <div class="trend-cardHead">
        <div class="skeleton skeleton-line skeleton-line-lg"></div>
        <div class="skeleton skeleton-line skeleton-line-sm"></div>
      </div>
      <div class="skeleton skeleton-chart"></div>
      <div class="trend-meta">
        <div class="skeleton skeleton-line skeleton-line-sm"></div>
        <div class="skeleton skeleton-line skeleton-line-sm"></div>
      </div>
    </div>
  `).join('');
}

function renderAccountSkeleton() {
  return `
    <div class="sheet-stack isSkeleton">
      <div class="skeleton skeleton-line skeleton-line-lg"></div>
      <div class="skeleton skeleton-line"></div>
    </div>
  `;
}

function renderSummaryTile(label, value, detail = '') {
  return `
    <div class="summary-tile summary-tileCompact">
      <span class="summary-label">${escapeHtml(label || '')}</span>
      <strong class="summary-value">${escapeHtml(value || '')}</strong>
      ${detail ? `<span class="summary-detail">${escapeHtml(detail || '')}</span>` : ''}
    </div>
  `;
}

function renderWorkoutBlock(block, blockIndex, ui) {
  const lines = block?.lines || [];
  return `
    <div class="workout-block">
      ${lines.map((line, lineIndex) => {
        const lineId = `b${blockIndex}-l${lineIndex}`;
        return renderWorkoutLine(line, lineId, ui);
      }).join('')}
    </div>
  `;
}

function renderWorkoutLine(line, lineId, ui) {
  const trainingMode = !!ui?.trainingMode;
  
  const rawText = typeof line === 'string' ? line : (line?.raw || line?.text || '');
  const display = typeof line === 'object' ? (line.calculated ?? '') : '';
  const hasLoad = !!String(display).trim();
  const isWarning = !!(typeof line === 'object' && line.hasWarning);
  const isHeader = !!(typeof line === 'object' && line.isHeader);
  const isRest = !!(typeof line === 'object' && line.isRest);
  
  const text = escapeHtml(rawText);
  const exerciseHelp = !hasLoad ? inferExerciseHelpDomain(rawText) : null;
  
  // Filtro: Remove linhas indesejadas
  if (
    rawText.includes('#garanta') ||
    rawText.includes('#treine') ||
    rawText.toLowerCase().includes('@hotmail') ||
    rawText.toLowerCase().includes('@gmail')
  ) {
    return '';
  }
  
  // Cabeçalho
  if (isHeader) {
    return `
      <div class="workout-section-header" data-line-id="${escapeHtml(lineId)}">
        <h3 class="section-title">${text}</h3>
      </div>
    `;
  }
  
  // Descanso com timer
  if (isRest) {
    const restMatch = rawText.match(/(\d+)['`´]/);
    const restSeconds = restMatch ? parseInt(restMatch[1]) * 60 : null;
    
    return `
      <div class="workout-rest" data-line-id="${escapeHtml(lineId)}">
        <div class="rest-icon">⏱️</div>
        <div class="rest-content">
          <span class="rest-text">${text}</span>
          ${restSeconds ? `
            <button 
              class="btn-timer" 
              data-action="timer:start" 
              data-seconds="${restSeconds}"
              type="button"
            >
              Timer ${Math.floor(restSeconds / 60)}min
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Nota
  if (rawText.startsWith('*')) {
    return `
      <div class="workout-note" data-line-id="${escapeHtml(lineId)}">
        <span class="note-icon">💡</span>
        <span class="note-text">${text.replace(/^\*+\s*/, '')}</span>
      </div>
    `;
  }
  
  // Linha normal
  const loadHtml = hasLoad ? `
    <div class="load-calc ${isWarning ? 'load-warning' : ''}">
      ${escapeHtml(display)}
    </div>
  ` : '';
  const helpActionHtml = exerciseHelp ? `
    <button
      class="exercise-helpBtn"
      type="button"
      data-action="exercise:help"
      data-exercise="${escapeHtml(exerciseHelp.label)}"
      data-url="${escapeHtml(exerciseHelp.youtubeUrl)}"
      title="Ver execução"
      aria-label="Ver execução de ${escapeHtml(exerciseHelp.label)}"
    >
      Ver execução
    </button>
  ` : '';
  
  if (!trainingMode) {
    return `
      <div class="workout-line" data-line-id="${escapeHtml(lineId)}">
        <div class="exercise-main">
          <div class="exercise-text">${text}</div>
          ${loadHtml}
        </div>
        ${helpActionHtml}
      </div>
    `;
  }
  
  // Modo treino
  const done = !!ui?.done?.[lineId];
  const isActive = ui?.activeLineId === lineId;
  
  return `
    <div class="workout-line ${done ? 'is-done' : ''} ${isActive ? 'is-active' : ''}" data-line-id="${escapeHtml(lineId)}">
      <button 
        class="line-check" 
        type="button" 
        aria-pressed="${done}" 
        data-action="wod:toggle" 
        data-line-id="${escapeHtml(lineId)}"
        title="Marcar como feito"
      >
        ${done ? '✓' : ''}
      </button>
      <button 
        class="line-body" 
        type="button" 
        data-action="wod:toggle" 
        data-line-id="${escapeHtml(lineId)}"
        title="Selecionar/alternar"
      >
        <div class="exercise-text">${text}</div>
        ${loadHtml}
      </button>
      ${helpActionHtml}
    </div>
  `;
}

function renderAuthModal({ auth = {}, authMode = 'signin' } = {}) {
  return renderAuthModalDomain({ auth, authMode }, {
    renderAccountSkeleton,
    formatDateShort,
    escapeHtml,
  });
}

function formatCompetitionProvider(value) {
  const normalized = String(value || 'manual').trim().toLowerCase();
  if (normalized === 'crossfit_open') return 'CrossFit Open';
  if (normalized === 'competition_corner') return 'Competition Corner';
  if (normalized === 'official') return 'Oficial';
  return 'Manual';
}

function getCompetitionProviderVisual(item = {}) {
  const provider = String(item?.source_provider || item?.sourceProvider || 'manual').trim().toLowerCase();
  const coverUrl = String(item?.cover_image_url || item?.coverImageUrl || '').trim();

  if (provider === 'crossfit_open') {
    return {
      icon: 'OPEN',
      toneClass: 'isCrossfitOpen',
      coverStyle: coverUrl ? `background-image: linear-gradient(135deg, rgba(9, 13, 22, 0.52), rgba(9, 13, 22, 0.84)), url('${coverUrl.replace(/'/g, "\\'")}')` : '',
    };
  }

  if (provider === 'competition_corner') {
    return {
      icon: 'CC',
      toneClass: 'isCompetitionCorner',
      coverStyle: coverUrl ? `background-image: linear-gradient(135deg, rgba(8, 12, 18, 0.5), rgba(8, 12, 18, 0.82)), url('${coverUrl.replace(/'/g, "\\'")}')` : '',
    };
  }

  if (provider === 'official') {
    return {
      icon: 'OF',
      toneClass: 'isOfficial',
      coverStyle: coverUrl ? `background-image: linear-gradient(135deg, rgba(11, 14, 17, 0.46), rgba(11, 14, 17, 0.82)), url('${coverUrl.replace(/'/g, "\\'")}')` : '',
    };
  }

  return {
    icon: 'EV',
    toneClass: 'isManual',
    coverStyle: coverUrl ? `background-image: linear-gradient(135deg, rgba(11, 14, 17, 0.46), rgba(11, 14, 17, 0.82)), url('${coverUrl.replace(/'/g, "\\'")}')` : '',
  };
}

function formatCompetitionStatus(value) {
  const normalized = String(value || 'scheduled').trim().toLowerCase();
  if (normalized === 'live') return 'Ao vivo';
  if (normalized === 'completed') return 'Encerrado';
  if (normalized === 'archived') return 'Arquivo';
  return 'Agendado';
}

function competitionStatusClass(value) {
  const normalized = String(value || 'scheduled').trim().toLowerCase();
  if (normalized === 'live') return 'isGood';
  if (normalized === 'completed' || normalized === 'archived') return 'isWarn';
  return '';
}

function formatCompetitionMetaLine(item = {}) {
  const parts = [];
  if (item.gym_name || item.gymName) parts.push(item.gym_name || item.gymName);
  if (item.starts_at || item.startsAt) parts.push(formatDateShort(item.starts_at || item.startsAt));
  if (item.location) parts.push(item.location);
  return parts.join(' • ') || 'Sem detalhe publicado';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function formatDateShort(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatTrendValue(value, scoreType) {
  if (scoreType === 'for_time') return `${formatNumber(value)}s`;
  return formatNumber(value);
}

function renderSparkline(values = [], lowerIsBetter = false) {
  const points = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (points.length < 2) {
    return '<div class="trend-empty">Sem dados suficientes</div>';
  }

  const width = 220;
  const height = 64;
  const padding = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const coords = points.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
    const normalized = (value - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return [x, y];
  });
  const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  const stroke = lowerIsBetter ? '#7ee0a1' : '#ff9c71';

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${polyline}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="${stroke}"></circle>
    </svg>
  `;
}
