import { getAthleteImportUsage, normalizeAthleteBenefits } from '../core/services/athleteBenefitUsage.js';
import { isDeveloperEmail } from '../core/utils/devAccess.js';

export function renderAppShell() {
  const appLabel = getAppLabel();
  return `
    <div class="app-container">
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
  const modalsHtml = renderModals(state);
  
  return {
    headerAccountHtml,
    mainHtml,
    bottomNavHtml,
    modalsHtml,
  };
}

function renderBottomTools(state) {
  const currentPage = state?.__ui?.currentPage || 'today';
  if (currentPage !== 'today') return '';

  return `
    <div class="bottom-tools">
      <button class="quick-action quick-action-primary quick-action-wide" data-action="modal:open" data-modal="import" type="button">
        <span class="quick-actionIcon">+</span>
        <span class="quick-actionLabel">Importar treino</span>
      </button>
    </div>
  `;
}

function renderModals(state) {
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};
  const authMode = state?.__ui?.authMode || 'signin';

  if (modal === 'prs') return renderPrsModal(prs);
  if (modal === 'settings') return renderSettingsModal(settings);
  if (modal === 'import') return renderImportModal();
  if (modal === 'auth') return renderAuthModal({
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
  });

  return '';
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

  const workout = state?.workout ?? state?.workoutOfDay;
  if (!workout || !workout.blocks?.length) {
    return `
      <div class="workout-container">
        ${renderTodayPageIntro(state)}
        ${renderEmptyState(state)}
        ${renderBottomTools(state)}
      </div>
    `;
  }

  const ui = state?.__ui || {};
  const trainingMode = !!ui.trainingMode;
  const progress = ui.progress || { doneCount: 0, totalCount: 0 };
  const workoutContext = state?.workoutContext || {};
  const showSourceToggle = !!workoutContext.canToggle;
  const activeSource = workoutContext.activeSource || 'uploaded';

  return `
    <div class="workout-container">
      ${renderTodayPageIntro(state)}
      <div class="workout-header">
        <h2 class="workout-title">Treino • ${escapeHtml(formatDay(state?.currentDay))}</h2>
        ${showSourceToggle ? `
          <div class="coach-pillRow workout-sourceToggle">
            <button
              class="coach-pill ${activeSource === 'uploaded' ? 'isActive' : ''}"
              data-action="workout:source"
              data-source="uploaded"
              type="button"
            >
              Planilha enviada
            </button>
            <button
              class="coach-pill ${activeSource === 'coach' ? 'isActive' : ''}"
              data-action="workout:source"
              data-source="coach"
              type="button"
            >
              Treino do coach
            </button>
          </div>
        ` : ''}

        ${trainingMode ? `
          <div class="wod-toolbar">
            <button class="btn-secondary" data-action="wod:mode" type="button">Sair do modo treino</button>
            <div class="wod-progress">${progress.doneCount}/${progress.totalCount}</div>
            <button class="btn-secondary" data-action="wod:prev" type="button">◀</button>
            <button class="btn-secondary" data-action="wod:next" type="button">▶</button>
          </div>

          <div class="wod-stickyNext">
            <button class="btn-primary" data-action="wod:next" type="button">Próximo</button>
          </div>
        ` : `
          <div class="wod-toolbar">
            <button class="btn-secondary" data-action="wod:mode" type="button">Modo treino</button>
          </div>
        `}

        ${workout.warnings?.length ? `
          <div class="workout-warnings">
            <span class="warning-badge">⚠️ ${workout.warnings.length} avisos</span>
          </div>
        ` : ''}
      </div>

      ${workout.blocks.map((block, b) => renderWorkoutBlock(block, b, ui)).join('')}
      ${renderBottomTools(state)}
    </div>
  `;
}

function renderBottomNav(state) {
  const currentPage = state?.__ui?.currentPage || 'today';
  const items = [
    { page: 'today', icon: '◉', label: 'Hoje' },
    { page: 'history', icon: '↗', label: 'Histórico' },
    { page: 'competitions', icon: '🏁', label: 'Competições' },
    { page: 'account', icon: 'ID', label: 'Conta' },
  ];

  return items.map((item) => `
    <button class="nav-btn ${currentPage === item.page ? 'nav-btn-active' : ''} ${item.page === 'today' ? 'nav-btn-primary' : ''}" data-action="page:set" data-page="${item.page}" type="button">
      <span class="nav-icon">${item.icon}</span>
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

function renderEmptyState(state) {
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  const day = formatDay(state?.currentDay);

  if (!hasWeeks) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h2>Nenhum treino carregado</h2>
        <p>Abra a importação e envie um arquivo.</p>
        <div class="page-actions page-actions-inline">
          <button class="btn-primary" data-action="modal:open" data-modal="import" type="button">Importar treino</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-icon">😴</div>
      <h2>Sem treino para ${escapeHtml(day)}</h2>
      <p>Troque o dia ou importe outro treino.</p>
      <div class="page-actions page-actions-inline">
        <button class="btn-secondary" data-action="day:auto" type="button">Voltar para auto</button>
        <button class="btn-secondary" data-action="modal:open" data-modal="import" type="button">Importar</button>
      </div>
    </div>
  `;
}

function renderHistoryPage(state) {
  const athleteOverview = state?.__ui?.athleteOverview || {};
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;
  const benchmarkHistory = athleteOverview?.benchmarkHistory || [];
  const prHistory = athleteOverview?.prHistory || [];
  const isBusy = !!state?.__ui?.isBusy;
  const isDetailLoading = isAuthenticated && athleteOverview?.detailLevel !== 'full';
  const benchmarkPoints = benchmarkHistory.reduce((sum, item) => sum + Number(item?.points?.length || 0), 0);
  const prPoints = prHistory.reduce((sum, item) => sum + Number(item?.points?.length || 0), 0);

  return `
    <div class="workout-container page-stack page-stack-history">
      ${renderPageHero({
        eyebrow: 'Histórico',
        title: 'Sua evolução no box',
        subtitle: 'Benchmarks, PRs e consistência em uma leitura diária mais direta.',
        actions: `
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">Gerenciar PRs</button>
          <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Sincronizar conta</button>
        `,
      })}

      <div class="summary-strip summary-strip-3">
        ${renderSummaryTile('Benchmarks', isBusy || isDetailLoading ? '...' : String(benchmarkHistory.length), 'modalidades com histórico')}
        ${renderSummaryTile('PRs', isBusy || isDetailLoading ? '...' : String(prHistory.length), 'movimentos acompanhados')}
        ${renderSummaryTile('Registros', isBusy || isDetailLoading ? '...' : String(benchmarkPoints + prPoints), 'entradas acumuladas')}
      </div>

      ${renderPageFold({
        title: 'Evolução por benchmark',
        subtitle: 'Progressão dos benchmarks mais registrados.',
        content: `
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(4) : benchmarkHistory.length ? benchmarkHistory.map((item) => `
            <div class="trend-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.name || item.slug || 'Benchmark')}</strong>
                <span>${escapeHtml(item.latestLabel || 'Sem marca')}</span>
              </div>
              ${renderSparkline(item.points.map((point) => Number(point.value || 0)), item.scoreType === 'for_time')}
              <div class="trend-meta">
                <span>${item.improvement === null ? 'Sem histórico suficiente' : `${item.improvement > 0 ? '+' : ''}${formatTrendValue(item.improvement, item.scoreType)}`}</span>
                <span>${item.points.length} registro(s)</span>
              </div>
            </div>
          `).join('') : '<p class="account-hint">Finalize benchmarks ou entre na conta para começar a curva de evolução.</p>'}
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'Evolução de PRs',
        subtitle: 'Progressão das suas cargas de referência.',
        content: `
        <div class="page-actions">
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">Gerenciar PRs</button>
        </div>
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(3) : prHistory.length ? prHistory.map((item) => `
            <div class="trend-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.exercise)}</strong>
                <span>${escapeHtml(String(item.latestValue ?? '—'))} ${escapeHtml(item.unit || 'kg')}</span>
              </div>
              ${renderSparkline(item.points.map((point) => Number(point.value || 0)), false)}
              <div class="trend-meta">
                <span>${item.delta === null ? 'Sem histórico suficiente' : `${item.delta > 0 ? '+' : ''}${formatNumber(item.delta)} ${escapeHtml(item.unit || 'kg')}`}</span>
                <span>${item.points.length} atualização(ões)</span>
              </div>
            </div>
          `).join('') : '<p class="account-hint">Cadastre seus PRs para o app calcular cargas e mostrar progresso real.</p>'}
        </div>
        `,
      })}
    </div>
  `;
}

function renderCompetitionsPage(state) {
  const athleteOverview = state?.__ui?.athleteOverview || {};
  const items = athleteOverview?.upcomingCompetitions || [];
  const access = athleteOverview?.gymAccess || [];
  const isBusy = !!state?.__ui?.isBusy;
  const activeGyms = access.filter((item) => item?.warning ? false : true).length;
  const blockedGyms = access.filter((item) => item?.warning).length;

  return `
    <div class="workout-container page-stack page-stack-competitions">
      ${renderPageHero({
        eyebrow: 'Competições',
        title: 'Agenda competitiva do seu box',
        subtitle: 'Agenda publicada pelo coach e leitura rápida do seu acesso.',
        actions: `
          <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar para sincronizar</button>
        `,
      })}

      <div class="summary-strip summary-strip-3">
        ${renderSummaryTile('Eventos', isBusy ? '...' : String(items.length), 'competições próximas')}
        ${renderSummaryTile('Gyms ativos', isBusy ? '...' : String(activeGyms), 'com acesso ok')}
        ${renderSummaryTile('Alertas', isBusy ? '...' : String(blockedGyms), 'gyms com aviso')}
      </div>

      <div class="coach-grid">
        ${renderPageFold({
          title: 'Próximas competições',
          subtitle: 'Próximos eventos vinculados à sua conta.',
          content: `
          <div class="coach-list coach-listCompact">
            ${isBusy ? renderListSkeletons(4) : items.length ? items.map((item) => `
              <div class="coach-listItem static">
                <strong>${escapeHtml(item.title || 'Competição')}</strong>
                <span>${escapeHtml(item.gym_name || '')} • ${escapeHtml(formatDateShort(item.starts_at))}${item.location ? ` • ${escapeHtml(item.location)}` : ''}</span>
              </div>
            `).join('') : '<p class="account-hint">Seu coach ainda não publicou eventos para os gyms ligados à sua conta.</p>'}
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Acesso por gym',
          subtitle: 'Status atual do vínculo com cada box.',
          content: `
          <div class="coach-list coach-listCompact">
            ${isBusy ? renderListSkeletons(3) : access.length ? access.map((item) => `
              <div class="coach-listItem static">
                <strong>${escapeHtml(item.gymName || `Gym ${item.gymId}`)}</strong>
                <span>${item.warning ? escapeHtml(item.warning) : 'Acesso ativo'}</span>
              </div>
            `).join('') : '<p class="account-hint">Entre na conta correta ou peça ao coach para vincular você a um gym.</p>'}
          </div>
          `,
        })}
      </div>
    </div>
  `;
}

function renderAccountPage(state) {
  const profile = state?.__ui?.auth?.profile || null;
  const coachPortal = state?.__ui?.coachPortal || {};
  const subscription = coachPortal?.subscription || null;
  const planKey = subscription?.plan || subscription?.plan_id || 'free';
  const planName = formatSubscriptionPlanName(planKey);
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const canUseDeveloperTools = isDeveloperEmail(profile?.email);
  const isBusy = !!state?.__ui?.isBusy;
  const athleteBenefits = normalizeAthleteBenefits(state?.__ui?.athleteOverview?.athleteBenefits || null);
  const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
  const accessEntitlements = coachPortal?.entitlements || [];
  const canCoachManage = accessEntitlements.includes('coach_portal');
  const gyms = coachPortal?.gyms || [];
  const athleteStats = state?.__ui?.athleteOverview?.stats || {};
  const athleteBenefitSource = describeAthleteBenefitSource(athleteBenefits);

  if (!profile?.email) {
    return `
      <div class="workout-container page-stack page-stack-account">
        ${renderPageHero({
          eyebrow: 'Conta',
          title: 'Sincronize seu treino com o coach',
          subtitle: 'Use o app sozinho ou conecte sua conta a um coach para receber treino e liberar mais recursos.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar na conta</button>
          `,
        })}

        <div class="summary-strip summary-strip-4">
          ${renderSummaryTile('Solo', 'Tudo liberado', 'imports e histórico completos')}
          ${renderSummaryTile('Coach', 'Portal separado', 'gestão do box e dos atletas')}
          ${renderSummaryTile('Treino', 'Uso diário', 'planilha, histórico e PRs')}
          ${renderSummaryTile('Portal', 'Separado', 'operação do coach')}
        </div>

        <div class="coach-grid">
        ${renderPageFold({
          title: 'O que você libera',
          subtitle: 'Valor prático da conta no uso diário.',
            content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Sync entre dispositivos</strong>
                <span>Seus dados não ficam presos em um aparelho.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Treinos do coach</strong>
                <span>Receba a programação do box mantendo o app principal como sua rotina diária.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Histórico e PRs</strong>
                <span>Use seu progresso para calcular cargas e enxergar evolução, sem limite artificial no app.</span>
              </div>
            </div>
            `,
          })}
          ${renderPageFold({
            title: 'Se você é coach',
            subtitle: 'Mesma conta, operação no portal separado.',
            content: `
            <p class="account-hint">Use a mesma conta para abrir o Coach Portal e publicar treinos para atletas, grupos e planilhas especiais.</p>
            <div class="page-actions">
              <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
              <a class="btn-secondary" href="/coach/" target="_blank" rel="noopener noreferrer">Abrir portal</a>
            </div>
            `,
          })}
        </div>
      </div>
    `;
  }

  return `
    <div class="workout-container page-stack page-stack-account">
      ${renderPageHero({
        eyebrow: 'Conta',
        title: profile.name || 'Sua conta',
        subtitle: 'Sessão, sync, histórico completo e acesso ao portal do coach.',
        actions: `
          <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
        `,
      })}

      <div class="summary-strip summary-strip-4">
        ${renderSummaryTile('Conta', isBusy ? '...' : escapeHtml(profile.name || 'Sem nome'), isBusy ? '' : escapeHtml(profile.email || ''))}
        ${renderSummaryTile('Plano', isBusy ? '...' : escapeHtml(planName), isBusy ? '' : escapeHtml(planStatus))}
        ${renderSummaryTile('Benefício atleta', isBusy ? '...' : athleteBenefits.label, isBusy ? '' : athleteBenefitSource)}
        ${renderSummaryTile('Importações', isBusy ? '...' : (importUsage.unlimited ? 'Ilimitado' : `${importUsage.remaining}/${importUsage.limit}`), isBusy ? '' : (importUsage.unlimited ? 'PDF e mídia sem limite' : `${importUsage.used} uso(s) neste mês`))}
      </div>

      <div class="coach-grid">
        ${renderPageFold({
          title: 'Visão do atleta',
          subtitle: 'Conta ativa, sync e acesso do atleta.',
          content: `
          ${isBusy ? renderAccountSkeleton() : `
            <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
            <div class="account-email">${escapeHtml(profile.email || '')}</div>
          `}
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Acesso do atleta</strong>
              <span>${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Resultados e agenda</strong>
              <span>${Number(athleteStats?.resultsLogged || 0)} resultado(s) • ${Number(athleteStats?.upcomingCompetitions || 0)} competição(ões)</span>
            </div>
            <div class="coach-listItem static">
              <strong>Treinos vinculados</strong>
              <span>${Number(athleteStats?.assignedWorkouts || 0)} treino(s) • ${Number(athleteStats?.activeGyms || 0)} gym(s) ativo(s)</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
            <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Resumo completo</button>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Plano e acesso',
          subtitle: 'Atletas usam o app completo. O plano do coach vale para a operação do box.',
          content: `
          ${isBusy ? renderAccountSkeleton() : `
            <div class="account-name">${escapeHtml(planName)}</div>
            <div class="account-email">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</div>
          `}
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Status do atleta</strong>
              <span>${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Imports</strong>
              <span>${importUsage.unlimited ? 'PDF e mídia ilimitados' : `${importUsage.remaining} restante(s) de ${importUsage.limit}`}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Histórico visível</strong>
              <span>${athleteBenefits.historyDays === null ? 'Completo' : `${athleteBenefits.historyDays} dias`}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Competições</strong>
              <span>Liberadas no app do atleta.</span>
            </div>
          </div>
          <div class="page-actions">
            ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
            ${canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
            <a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Portal do coach',
          subtitle: canCoachManage || canUseDeveloperTools ? 'Portal separado para operação do box.' : 'Upgrade para operar box, atletas e grupos.',
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Status do coach</strong>
              <span>${canCoachManage ? 'Liberado para gestão' : 'Bloqueado até ativar plano'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Gyms vinculados</strong>
              <span>${gyms.length} gym(s) visível(is) nesta conta</span>
            </div>
            <div class="coach-listItem static">
              <strong>Como funciona</strong>
              <span>No app principal você acompanha conta e benefícios. A operação do box fica no portal separado.</span>
            </div>
          </div>
          <div class="page-actions">
            <a class="btn-secondary" href="/coach/" target="_blank" rel="noopener noreferrer">Abrir portal</a>
            <a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>
          </div>
          `,
        })}
      </div>
    </div>
  `;
}

function renderTodayPageIntro(state) {
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  return `
    ${renderPageHero({
      eyebrow: 'Hoje',
      title: hasWeeks ? 'Treino do dia' : 'Importe seu treino',
      subtitle: hasWeeks
        ? formatSubtitle(state)
        : 'PDF, imagem, vídeo, planilha ou texto.',
      actions: `
        <button class="btn-secondary" data-action="day:auto" type="button">Auto</button>
        <select class="day-select" data-action="day:set">
          <option value="">Dia (manual)…</option>
          <option value="Segunda">Segunda</option>
          <option value="Terça">Terça</option>
          <option value="Quarta">Quarta</option>
          <option value="Quinta">Quinta</option>
          <option value="Sexta">Sexta</option>
          <option value="Sábado">Sábado</option>
          <option value="Domingo">Domingo</option>
        </select>
      `,
      footer: hasWeeks ? `<div class="week-chips">${renderWeekChips(state)}</div>` : '',
    })}
  `;
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

export function renderImportModal() {
  return `
    <div class="modal-overlay isOpen">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Adicionar treino</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>
        <div class="modal-body modal-body-auth">
          <div class="auth-intro">
            <div class="section-kicker">Importação</div>
            <p class="account-hint">Escolha o tipo de arquivo.</p>
          </div>
          <div class="coach-grid">
            <button class="quick-action quick-action-modal" data-action="pdf:pick" type="button">
              <span class="quick-actionIcon">PDF</span>
              <span class="quick-actionLabel">Planilha em PDF</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="media:pick" type="button">
              <span class="quick-actionIcon">ARQ</span>
              <span class="quick-actionLabel">Imagem, vídeo, texto ou planilha</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="workout:import" type="button">
              <span class="quick-actionIcon">JSON</span>
              <span class="quick-actionLabel">Importar treino salvo</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="workout:export" type="button">
              <span class="quick-actionIcon">EXP</span>
              <span class="quick-actionLabel">Exportar treino atual</span>
            </button>
          </div>
        </div>
      </div>
    </div>
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

function describeAthleteBenefitSource(benefits) {
  const normalized = normalizeAthleteBenefits(benefits);
  if (normalized.personal) return 'liberado na conta do atleta';
  if (normalized.inherited) return 'liberado também quando há coach vinculado';
  return 'sem bloqueios no app do atleta';
}

function formatSubscriptionPlanName(planId) {
  const normalized = String(planId || 'free').trim().toLowerCase();
  if (normalized === 'athlete_plus') return 'Atleta Plus';
  if (normalized === 'starter') return 'Coach Starter';
  if (normalized === 'pro' || normalized === 'coach') return 'Coach Pro';
  if (normalized === 'performance') return 'Coach Performance';
  return 'Free';
}

const EXERCISE_VIDEO_LIBRARY = [
  { label: 'Back Squat', query: 'back squat', aliases: ['back squat', 'backsquat', 'agachamento livre', 'agachamento costas'] },
  { label: 'Front Squat', query: 'front squat', aliases: ['front squat', 'agachamento frontal'] },
  { label: 'Deadlift', query: 'deadlift', aliases: ['deadlift', 'levantamento terra', 'terra'] },
  { label: 'Romanian Deadlift', query: 'romanian deadlift', aliases: ['romanian deadlift', 'rdl', 'stiff'] },
  { label: 'Bench Press', query: 'bench press', aliases: ['bench press', 'supino reto', 'supino'] },
  { label: 'Overhead Press', query: 'overhead press', aliases: ['strict press', 'overhead press', 'shoulder press', 'desenvolvimento'] },
  { label: 'Push Press', query: 'push press', aliases: ['push press'] },
  { label: 'Push Jerk', query: 'push jerk', aliases: ['push jerk'] },
  { label: 'Split Jerk', query: 'split jerk', aliases: ['split jerk', 'jerk'] },
  { label: 'Thruster', query: 'thruster', aliases: ['thruster'] },
  { label: 'Snatch', query: 'snatch', aliases: ['snatch', 'arranco'] },
  { label: 'Power Snatch', query: 'power snatch', aliases: ['power snatch'] },
  { label: 'Hang Power Snatch', query: 'hang power snatch', aliases: ['hang power snatch'] },
  { label: 'Squat Snatch', query: 'squat snatch', aliases: ['squat snatch'] },
  { label: 'Clean', query: 'clean', aliases: ['clean'] },
  { label: 'Power Clean', query: 'power clean', aliases: ['power clean'] },
  { label: 'Hang Power Clean', query: 'hang power clean', aliases: ['hang power clean'] },
  { label: 'Squat Clean', query: 'squat clean', aliases: ['squat clean'] },
  { label: 'Clean and Jerk', query: 'clean and jerk', aliases: ['clean and jerk'] },
  { label: 'Overhead Squat', query: 'overhead squat', aliases: ['overhead squat', 'ohs'] },
  { label: 'Wall Ball', query: 'wall ball', aliases: ['wall ball', 'wallball'] },
  { label: 'Box Jump', query: 'box jump', aliases: ['box jump', 'box jump over'] },
  { label: 'Walking Lunge', query: 'walking lunge', aliases: ['walking lunge', 'lunge walk', 'passada', 'afundo andando'] },
  { label: 'Burpee', query: 'burpee', aliases: ['burpee'] },
  { label: 'Pull-Up', query: 'pull up', aliases: ['pull up', 'pull-up'] },
  { label: 'Chest to Bar', query: 'chest to bar pull up', aliases: ['chest to bar', 'c2b'] },
  { label: 'Bar Muscle-Up', query: 'bar muscle up', aliases: ['bar muscle up', 'bmup'] },
  { label: 'Ring Muscle-Up', query: 'ring muscle up', aliases: ['ring muscle up', 'rmu'] },
  { label: 'Toes to Bar', query: 'toes to bar', aliases: ['toes to bar', 't2b'] },
  { label: 'Handstand Push-Up', query: 'handstand push up', aliases: ['handstand push up', 'hspu', 'shspu'] },
  { label: 'Handstand Walk', query: 'handstand walk', aliases: ['handstand walk', 'hs walk'] },
  { label: 'Double Under', query: 'double under', aliases: ['double under', 'du'] },
  { label: 'Row', query: 'rowing technique', aliases: ['row', 'rowing', 'remo'] },
  { label: 'Bike Erg', query: 'bike erg technique', aliases: ['bike erg', 'bikeerg', 'assault bike'] },
  { label: 'Rope Climb', query: 'rope climb', aliases: ['rope climb', 'subida na corda'] },
  { label: 'Kettlebell Swing', query: 'kettlebell swing', aliases: ['kettlebell swing', 'kb swing'] },
  { label: 'Goblet Squat', query: 'goblet squat', aliases: ['goblet squat'] },
  { label: 'Dumbbell Snatch', query: 'dumbbell snatch', aliases: ['db snatch', 'dumbbell snatch'] },
  { label: 'Dumbbell Clean and Jerk', query: 'dumbbell clean and jerk', aliases: ['db clean and jerk', 'dumbbell clean and jerk'] },
];

function inferExerciseHelp(rawText = '') {
  const sourceLine = String(rawText || '').trim();
  if (!sourceLine) return null;
  const normalized = normalizeExerciseSearchText(sourceLine);
  if (!normalized || normalized.length < 3) return null;
  if (isProbablyLoadPrescription(sourceLine, normalized)) return null;

  const matched = EXERCISE_VIDEO_LIBRARY
    .flatMap((item) => item.aliases.map((alias) => ({ item, alias })))
    .sort((a, b) => b.alias.length - a.alias.length)
    .find(({ alias }) => normalized.includes(normalizeExerciseSearchText(alias)));

  if (matched?.item) {
    return buildExerciseHelpPayload(matched.item.label, matched.item.query, sourceLine);
  }

  return null;
}

function buildExerciseHelpPayload(label, query, sourceLine = '') {
  return {
    label,
    query,
    sourceLine,
    youtubeUrl: buildSearchUrl(query),
  };
}

function buildSearchUrl(query) {
  const q = encodeURIComponent(String(query || '').trim());
  return `https://www.youtube.com/results?search_query=${q}%20exercise%20tutorial`;
}

function normalizeExerciseSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isProbablyLoadPrescription(rawText = '', normalized = '') {
  if (!rawText || !normalized) return true;
  if (/@\s*\d+%/.test(rawText)) return true;
  if (/^\s*\d+[\d+x+@%/\-() ]*$/.test(rawText)) return true;

  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const alphaTokens = tokens.filter((token) => /[a-z]/.test(token));
  if (!alphaTokens.length) return true;
  const numberTokens = tokens.filter((token) => /\d/.test(token));

  return numberTokens.length > alphaTokens.length && alphaTokens.length <= 2;
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
  const exerciseHelp = !hasLoad ? inferExerciseHelp(rawText) : null;
  
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

function renderPrsModal(prs = {}) {
  const entries = Object.entries(prs).sort((a, b) => a[0].localeCompare(b[0]));

  return `
    <div class="modal-overlay isOpen" id="ui-prsModalBackdrop">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">🎯 Personal Records</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body">
          <div class="pr-search">
            <input
              type="text"
              class="search-input"
              placeholder="Buscar exercício..."
              id="ui-prsSearch"
            />
          </div>

          <div class="pr-actions">
            <button class="btn-secondary" data-action="prs:export" type="button">
              💾 Exportar
            </button>

            <button class="btn-secondary" data-action="prs:import-file" type="button">
              📁 Importar arquivo
            </button>

            <button class="btn-secondary" data-action="prs:import" type="button">
              📋 Colar JSON
            </button>
          </div>

          <div class="pr-list" id="ui-prsTable">
            ${entries.length === 0 ? `
              <div class="empty-state-small">
                <p>Nenhum PR cadastrado</p>
              </div>
            ` : entries.map(([exercise, value]) => `
              <div class="pr-item" data-exercise="${escapeHtml(exercise)}">
                <label class="pr-label">${escapeHtml(exercise)}</label>

                <input
                  type="number"
                  class="pr-input"
                  data-action="prs:editValue"
                  value="${Number(value)}"
                  data-exercise="${escapeHtml(exercise)}"
                  step="0.5"
                  min="0"
                />

                <button
                  class="btn-secondary pr-save"
                  data-action="prs:save"
                  data-exercise="${escapeHtml(exercise)}"
                  type="button"
                  title="Salvar"
                >
                  Salvar
                </button>

                <button
                  class="pr-remove"
                  data-action="prs:remove"
                  data-exercise="${escapeHtml(exercise)}"
                  type="button"
                  title="Remover"
                >
                  🗑️
                </button>
              </div>
            `).join('')}
          </div>

          <div class="pr-add">
            <input
              type="text"
              class="add-input"
              placeholder="Nome do exercício"
              id="ui-prsNewName"
            />
            <input
              type="number"
              class="add-input"
              placeholder="PR (kg)"
              id="ui-prsNewValue"
              step="0.5"
              min="0"
            />
            <button class="btn-primary" data-action="prs:add" type="button">
              ➕ Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsModal(settings = {}) {
  const showLbsConversion = settings.showLbsConversion !== false;
  const showEmojis = settings.showEmojis !== false;
  const showObjectivesInWods = settings.showObjectivesInWods !== false;

  return `
    <div class="modal-overlay isOpen" id="ui-settingsModalBackdrop">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">⚙️ Configurações</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body">
          <div class="settings-group">
            <label class="settings-label">
              <input
                type="checkbox"
                id="setting-showLbsConversion"
                ${showLbsConversion ? 'checked' : ''}
              />
              <span>Mostrar conversão lbs → kg</span>
            </label>

            <label class="settings-label">
              <input
                type="checkbox"
                id="setting-showEmojis"
                ${showEmojis ? 'checked' : ''}
              />
              <span>Mostrar emojis</span>
            </label>

            <label class="settings-label">
              <input
                type="checkbox"
                id="setting-showObjectives"
                ${showObjectivesInWods ? 'checked' : ''}
              />
              <span>Mostrar objetivos nos WODs</span>
            </label>
          </div>

          <div class="settings-actions">
            <button class="btn-primary" data-action="settings:save" type="button">
              💾 Salvar
            </button>
            <button class="btn-secondary" data-action="backup:export" type="button">
              🧰 Backup
            </button>
            <button class="btn-secondary" data-action="backup:import" type="button">
              ♻️ Restaurar
            </button>
            <button class="btn-secondary" data-action="pdf:clear" type="button">
              🗑️ Limpar Tudo
            </button>
            <a class="btn-secondary" href="./privacy.html" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              🔐 Privacidade
            </a>
            <a class="btn-secondary" href="./pricing.html" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              💳 Planos
            </a>
            <a class="btn-secondary" href="./terms.html" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              📄 Termos
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAuthModal({ auth = {}, authMode = 'signin' } = {}) {
  const profile = auth?.profile || null;
  const isAuthenticated = !!profile?.email;
  const isBusy = !!auth?.isBusy;
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const signupVerification = auth?.signupVerification || {};
  const admin = auth?.admin || {};
  const coachPortal = auth?.coachPortal || {};
  const athleteOverview = auth?.athleteOverview || {};

  if (isAuthenticated) {
    const isAdmin = !!profile?.is_admin || !!profile?.isAdmin;
    const overview = admin?.overview || null;
    const entitlements = coachPortal?.entitlements || [];
    const canCoachManage = entitlements.includes('coach_portal');
    const canAthleteUseApp = entitlements.includes('athlete_app');
    const subscription = coachPortal?.subscription || null;
    const gyms = coachPortal?.gyms || [];
    const gymAccess = coachPortal?.gymAccess || [];
    const athleteStats = athleteOverview?.stats || {};
    const athleteResults = athleteOverview?.recentResults || [];
    const athleteCompetitions = athleteOverview?.upcomingCompetitions || [];
    const athleteWorkouts = athleteOverview?.recentWorkouts || [];
    const athleteBenefits = normalizeAthleteBenefits(athleteOverview?.athleteBenefits || null);
    const planKey = subscription?.plan || subscription?.plan_id || 'free';
    const planName = formatSubscriptionPlanName(planKey);
    const planStatus = subscription?.status || 'inactive';
    const canUseDeveloperTools = isDeveloperEmail(profile?.email);
    const renewAt = subscription?.renewAt || subscription?.renew_at || null;
    return `
      <div class="modal-overlay isOpen" id="ui-authModalBackdrop">
        <div class="modal-container modal-container-auth">
        <div class="modal-header">
          <h2 class="modal-title">👤 Sua conta</h2>
            <button class="modal-close" data-action="modal:close" type="button">✕</button>
          </div>

          <div class="modal-body modal-body-auth">
            <div class="account-hero">
              <div class="account-heroIdentity">
                <div class="account-heroEyebrow">Conta ativa</div>
                ${isBusy ? renderAccountSkeleton() : `
                  <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
                  <div class="account-email">${escapeHtml(profile.email || '')}</div>
                `}
              </div>
              <div class="account-planCard">
                <span class="account-planLabel">Plano da conta</span>
                ${isBusy ? renderAccountSkeleton() : `
                  <strong class="account-planValue">${escapeHtml(planName)}</strong>
                  <span class="account-planMeta">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</span>
                `}
              </div>
            </div>

            <div class="account-summaryGrid">
              ${isBusy ? Array.from({ length: 4 }, () => `
                <div class="summary-tile isSkeleton">
                  <div class="skeleton skeleton-line skeleton-line-sm"></div>
                  <div class="skeleton skeleton-line skeleton-line-lg"></div>
                </div>
              `).join('') : `
              <div class="summary-tile">
                <span class="summary-label">Acesso</span>
                <strong class="summary-value">${escapeHtml(athleteBenefits.label)}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Fonte</span>
                <strong class="summary-value">${escapeHtml(describeAthleteBenefitSource(athleteBenefits))}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Gyms</span>
                <strong class="summary-value">${gyms.length}</strong>
              </div>
              <div class="summary-tile">
                  <span class="summary-label">Treinos</span>
                  <strong class="summary-value">${Number(athleteStats?.assignedWorkouts || 0)}</strong>
                </div>
              `}
            </div>

            <details class="account-fold" open>
              <summary class="account-foldSummary">
                <span>
                  <span class="section-kicker">Atleta</span>
                  <strong>Resumo rápido da conta</strong>
                </span>
                <span class="account-foldMeta">${Number(athleteStats?.resultsLogged || 0)} resultados • ${Number(athleteStats?.upcomingCompetitions || 0)} competições • ${Number(athleteStats?.assignedWorkouts || 0)} treinos</span>
              </summary>
              <div class="account-foldBody">
                <div class="account-summaryGrid account-summaryGrid-compact">
                  <div class="summary-tile">
                    <span class="summary-label">Resultados</span>
                    <strong class="summary-value">${Number(athleteStats?.resultsLogged || 0)}</strong>
                  </div>
                  <div class="summary-tile">
                    <span class="summary-label">Competições</span>
                    <strong class="summary-value">${Number(athleteStats?.upcomingCompetitions || 0)}</strong>
                  </div>
                  <div class="summary-tile">
                    <span class="summary-label">Treinos</span>
                    <strong class="summary-value">${Number(athleteStats?.assignedWorkouts || 0)}</strong>
                  </div>
                  <div class="summary-tile">
                    <span class="summary-label">Gyms ativos</span>
                    <strong class="summary-value">${Number(athleteStats?.activeGyms || 0)}</strong>
                  </div>
                </div>

                <div class="coach-list coach-listCompact">
                  <div class="coach-listItem static">
                    <strong>Resultados recentes</strong>
                    <span>${athleteResults.length ? `${athleteResults.length} registro(s) recente(s)` : 'Nenhum resultado registrado ainda.'}</span>
                  </div>
                  <div class="coach-listItem static">
                    <strong>Próximas competições</strong>
                    <span>${athleteCompetitions.length ? `${athleteCompetitions.length} competição(ões) no radar` : 'Nenhuma competição próxima para seus gyms.'}</span>
                  </div>
                  <div class="coach-listItem static">
                    <strong>Treinos do box</strong>
                    <span>${athleteWorkouts.length ? `${athleteWorkouts.length} treino(s) recente(s) liberado(s)` : 'Nenhum treino recente liberado para sua conta.'}</span>
                  </div>
                </div>
              </div>
            </details>

            <div class="settings-actions account-actions">
              <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
              <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
              <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
              <a class="btn-secondary" href="/sports/cross/#account" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Ir para Conta</a>
            </div>

            <div class="auth-intro">
              <div class="section-kicker">Coach</div>
              <p class="account-hint">${canCoachManage || canUseDeveloperTools
                ? 'O portal do coach continua separado do app do atleta. Use sua mesma conta para abrir o workspace do box.'
                : 'Seu acesso de coach está bloqueado. Ative um plano quando quiser operar box, atletas e grupos no portal separado. O app do atleta continua liberado.'}</p>
              <div class="coach-pillRow">
                <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Coach liberado' : 'Coach bloqueado'}</span>
                <span class="coach-pill isGood">${canAthleteUseApp ? 'Atleta liberado' : 'Atleta liberado'}</span>
                <span class="coach-pill">${gyms.length} gym(s)</span>
              </div>
              <div class="settings-actions coach-billingActions">
                ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
                ${!canCoachManage && canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
                <a class="btn-secondary" href="/coach/" target="_blank" rel="noopener noreferrer">Abrir portal</a>
                <a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>
              </div>
            </div>

            ${isAdmin ? `
              <details class="account-fold account-section-admin">
                <summary class="account-foldSummary">
                  <div>
                    <div class="section-kicker">Admin</div>
                    <strong>Painel administrativo</strong>
                  </div>
                  <span class="account-foldMeta">${Number(overview?.stats?.users || 0)} usuários • ${Number(overview?.stats?.activeSubscriptions || 0)} assinaturas</span>
                </summary>
                <div class="account-foldBody">
                <div class="account-sectionHead">
                  <div></div>
                  <button class="btn-secondary" data-action="admin:refresh" type="button">Atualizar</button>
                </div>
                <div class="admin-toolbar">
                  <input class="add-input" id="admin-search" type="text" placeholder="Buscar por nome ou email" value="${escapeHtml(admin?.query || '')}" />
                  <button class="btn-secondary" data-action="admin:refresh" type="button">Buscar</button>
                </div>
                ${overview ? `
                  <div class="admin-stats">
                    <div class="admin-statCard">
                      <span class="admin-statLabel">Usuários</span>
                      <span class="admin-statValue">${Number(overview?.stats?.users || 0)}</span>
                    </div>
                    <div class="admin-statCard">
                      <span class="admin-statLabel">Assinaturas ativas</span>
                      <span class="admin-statValue">${Number(overview?.stats?.activeSubscriptions || 0)}</span>
                    </div>
                  </div>
                  <div class="admin-userList">
                    ${(overview?.users || []).map((user) => `
                      <div class="admin-userRow">
                        <div>
                          <div class="admin-userName">${escapeHtml(user.name || 'Sem nome')}</div>
                          <div class="admin-userEmail">${escapeHtml(user.email || '')}</div>
                          <div class="account-hint">
                            Plano: ${escapeHtml(user.subscription_plan || 'free')} • ${escapeHtml(user.subscription_status || 'inactive')}
                            ${user.subscription_renew_at ? ` • renova em ${escapeHtml(formatDateShort(user.subscription_renew_at))}` : ''}
                          </div>
                        </div>
                        <div class="admin-userControls">
                          <div class="admin-userMeta">${user.is_admin ? 'Admin' : 'User'}</div>
                          <div class="admin-userActions">
                            <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="starter" type="button">Starter</button>
                            <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="pro" type="button">Pro</button>
                            <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="performance" type="button">Performance</button>
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <p class="account-hint">Carregue os dados do painel para ver os últimos usuários.</p>
                `}
                </div>
              </details>
            ` : ''}

            <div class="settings-actions">
              <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="modal-overlay isOpen" id="ui-authModalBackdrop">
      <div class="modal-container modal-container-auth">
        <div class="modal-header">
          <h2 class="modal-title">${isSignup ? '📝 Criar conta' : '🔐 Entrar'}</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          <div class="auth-intro">
            <div class="section-kicker">Acesso seguro</div>
            <p class="account-hint">Entre para sincronizar dados, liberar o Coach Portal e gerenciar sua assinatura.</p>
          </div>
          <div class="auth-switch">
            <button class="btn-secondary ${!isSignup ? 'isSelected' : ''}" data-action="auth:switch" data-mode="signin" type="button">Entrar</button>
            <button class="btn-secondary ${isSignup ? 'isSelected' : ''}" data-action="auth:switch" data-mode="signup" type="button">Cadastrar</button>
          </div>

          <div class="auth-googleBlock" id="google-signin-shell">
            <div id="google-signin-button"></div>
            <p class="account-hint auth-googleHint">Use sua conta Google para entrar sem senha.</p>
          </div>

          <div class="auth-divider">ou continue com email</div>

          <form class="auth-form" id="ui-authForm">
            <input class="add-input" id="auth-name" type="text" placeholder="Seu nome" value="${escapeHtml(signupVerification.name || '')}" ${isSignup ? '' : 'style="display:none"'} />
            <input class="add-input" id="auth-email" type="email" placeholder="Seu email" autocomplete="email" value="${escapeHtml(signupVerification.email || '')}" />
            <input class="add-input" id="auth-password" type="password" placeholder="Sua senha" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
            ${isSignup ? `
              <div class="auth-signupVerify">
                <button class="btn-secondary" data-action="auth:signup-request-code" type="button">Enviar código</button>
                <input class="add-input" id="auth-signup-code" type="text" placeholder="Código de verificação" value="${escapeHtml(signupVerification.code || signupVerification.previewCode || '')}" />
                ${signupVerification?.previewCode ? `
                  <div class="reset-codePreview">
                    Código temporário: <strong>${escapeHtml(signupVerification.previewCode)}</strong>
                  </div>
                ` : ''}
                ${signupVerification?.previewUrl ? `
                  <a class="reset-previewLink" href="${escapeHtml(signupVerification.previewUrl)}" target="_blank" rel="noopener noreferrer">
                    Abrir preview do email
                  </a>
                ` : ''}
                <p class="account-hint">Cadastros novos só são liberados após validar o código enviado ao email.${signupVerification?.supportEmail ? ` Suporte: ${escapeHtml(signupVerification.supportEmail)}` : ''}</p>
              </div>
            ` : ''}
            <button class="btn-primary" data-action="auth:submit" data-mode="${escapeHtml(authMode)}" type="button">
              ${isSignup ? 'Criar conta com código' : 'Entrar'}
            </button>
          </form>

          ${!isSignup ? `
            <div class="auth-resetBox">
              <button class="btn-secondary" data-action="auth:reset-toggle" type="button">Esqueci minha senha</button>

              ${reset?.open ? `
                <div class="auth-resetForm">
                  <input class="add-input" id="reset-email" type="email" placeholder="Email da conta" value="${escapeHtml(reset.email || '')}" />
                  <button class="btn-secondary" data-action="auth:reset-request" type="button">Gerar código</button>
                  ${reset?.previewCode ? `
                    <div class="reset-codePreview">
                      Código temporário: <strong>${escapeHtml(reset.previewCode)}</strong>
                    </div>
                  ` : ''}
                  ${reset?.previewUrl ? `
                    <a class="reset-previewLink" href="${escapeHtml(reset.previewUrl)}" target="_blank" rel="noopener noreferrer">
                      Abrir preview do email
                    </a>
                  ` : ''}
                  <input class="add-input" id="reset-code" type="text" placeholder="Código de 6 dígitos" value="${escapeHtml(reset.code || '')}" />
                  <input class="add-input" id="reset-newPassword" type="password" placeholder="Nova senha" />
                  <button class="btn-primary" data-action="auth:reset-confirm" type="button">Trocar senha</button>
                  <p class="account-hint">O código é enviado por email${reset?.supportEmail ? ` via ${escapeHtml(reset.supportEmail)}` : ''}. Pré-visualizações de desenvolvimento só aparecem para a conta administradora.</p>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
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
