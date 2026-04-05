import { getAthleteImportUsage, normalizeAthleteBenefits } from '../core/services/athleteBenefitUsage.js';
import { isDeveloperEmail } from '../core/utils/devAccess.js';

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
              <img class="header-badgeMark" src="/icons/crossapp-mark.svg" alt="" aria-hidden="true">
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
  const hasWorkout = !!(state?.workout?.blocks?.length || state?.workoutOfDay?.blocks?.length);
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;

  if (!hasWorkout && !hasWeeks) return '';

  return `
    <div class="bottom-tools">
      <div class="bottom-toolsHead">
        <span class="section-kicker">Ações rápidas</span>
        <span class="bottom-toolsHint">${hasWorkout ? 'Mantenha o treino em movimento sem sair da tela principal.' : 'Comece pelo treino e organize o resto depois.'}</span>
      </div>
      ${hasWorkout ? `
        <button class="quick-action quick-action-primary" data-action="workout:copy" type="button">
          <span class="quick-actionIcon">COP</span>
          <span class="quick-actionLabel">Copiar treino</span>
          <span class="quick-actionMeta">Leve a sessão para mensagem, nota ou WhatsApp.</span>
        </button>
        <button class="quick-action quick-action-wide" data-action="modal:open" data-modal="import" type="button">
          <span class="quick-actionIcon">+</span>
          <span class="quick-actionLabel">Trocar treino</span>
          <span class="quick-actionMeta">Substitua a planilha atual sem perder a navegação.</span>
        </button>
      ` : `
        <button class="quick-action quick-action-primary quick-action-wide" data-action="modal:open" data-modal="import" type="button">
          <span class="quick-actionIcon">+</span>
          <span class="quick-actionLabel">Importar treino</span>
          <span class="quick-actionMeta">PDF, imagem, vídeo, texto ou planilha em um só fluxo.</span>
        </button>
      `}
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
  if (modal === 'import') return renderImportModal(state);
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

function formatCooldownLabel(cooldownUntil) {
  const remainingMs = Number(cooldownUntil || 0) - Date.now();
  if (remainingMs <= 0) return 'Gerar código';
  return `Aguardar ${Math.ceil(remainingMs / 1000)}s`;
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
  if (currentPage === 'account') return renderAccountPage(state);

  const workout = state?.workout ?? state?.workoutOfDay;
  if (!workout || !workout.blocks?.length) {
    return `
      <div class="workout-container">
        ${renderTodayPageIntro(state)}
        ${renderTodayOverview(state, null)}
        ${renderEmptyState(state)}
      </div>
    `;
  }

  const ui = state?.__ui || {};
  const workoutContext = state?.workoutContext || {};
  const showSourceToggle = !!workoutContext.canToggle;
  const activeSource = workoutContext.activeSource || 'uploaded';
  const warningsCount = workout.warnings?.length || 0;
  const showWorkoutHeader = showSourceToggle || warningsCount > 0;

  return `
    <div class="workout-container">
      ${renderTodayPageIntro(state)}
      ${renderTodayOverview(state, workout)}
      ${renderTodaySessionCard(state, workout)}
      ${showWorkoutHeader ? `
        <div class="workout-header">
          ${showSourceToggle ? `
            <div class="coach-pillRow workout-sourceToggle">
              <button
                class="coach-pill ${activeSource === 'uploaded' ? 'isActive' : ''}"
                data-action="workout:source"
                data-source="uploaded"
                type="button"
              >
                Planilha
              </button>
              <button
                class="coach-pill ${activeSource === 'coach' ? 'isActive' : ''}"
                data-action="workout:source"
                data-source="coach"
                type="button"
              >
                Coach
              </button>
            </div>
          ` : ''}

          ${warningsCount ? `
            <div class="workout-warnings">
              <span class="warning-badge">⚠️ ${warningsCount} aviso(s)</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${workout.blocks.map((block, b) => renderWorkoutBlock(block, b, ui)).join('')}
      ${renderBottomTools(state)}
    </div>
  `;
}

function renderBottomNav(state) {
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

function renderEmptyState(state) {
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  const day = formatDay(state?.currentDay);
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;

  if (!hasWeeks) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h2>Nenhum treino carregado</h2>
        <p>Importe um treino para começar ou entre para recuperar seu histórico.</p>
        <div class="page-actions page-actions-inline">
          <button class="btn-primary" data-action="modal:open" data-modal="import" type="button">Importar treino</button>
          <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">${isAuthenticated ? 'Conta' : 'Entrar'}</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-icon">😴</div>
      <h2>Sem treino para ${escapeHtml(day)}</h2>
      <p>Volte para o modo automático ou escolha outra planilha para esse dia.</p>
      <div class="page-actions page-actions-inline">
        <button class="btn-primary" data-action="day:auto" type="button">Modo automático</button>
        <button class="btn-secondary" data-action="modal:open" data-modal="import" type="button">Trocar planilha</button>
      </div>
    </div>
  `;
}

function renderHistoryPage(state) {
  const athleteOverview = state?.__ui?.athleteOverview || {};
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;
  const blocks = athleteOverview?.blocks || {};
  const summaryState = blocks?.summary?.status || 'idle';
  const resultsState = blocks?.results?.status || 'idle';
  const benchmarkHistory = athleteOverview?.benchmarkHistory || [];
  const prHistory = athleteOverview?.prHistory || [];
  const athleteStats = athleteOverview?.stats || {};
  const isBusy = !!state?.__ui?.isBusy;
  const isSummaryLoading = isAuthenticated && summaryState === 'loading' && !athleteOverview?.stats;
  const isDetailLoading = isAuthenticated && (resultsState === 'loading' || (resultsState === 'idle' && athleteOverview?.detailLevel !== 'full'));
  const isDetailError = resultsState === 'error';
  const resultsLogged = Number(athleteStats?.resultsLogged || 0);
  const progressSummary = [
    !isDetailLoading && benchmarkHistory.length ? `${benchmarkHistory.length} benchmark(s) com histórico` : null,
    !isDetailLoading && prHistory.length ? `${prHistory.length} PR(s) acompanhados` : null,
    !isSummaryLoading && resultsLogged ? `${resultsLogged} resultado(s) registrado(s)` : null,
  ].filter(Boolean).join(' • ');

  return `
    <div class="workout-container page-stack page-stack-history">
      ${renderPageHero({
        eyebrow: 'Histórico',
        title: 'Evolução',
        subtitle: progressSummary || 'Benchmarks, PRs e resultados em leitura rápida.',
        actions: `
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">PRs</button>
          <button class="btn-secondary" data-action="page:set" data-page="account" type="button">Conta</button>
        `,
      })}

      ${renderPageFold({
        title: 'Resumo rápido',
        subtitle: 'Só o que importa para continuar.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Benchmarks</strong>
            <span>${isBusy || isDetailLoading ? 'Carregando histórico...' : benchmarkHistory.length ? `${benchmarkHistory.length} benchmark(s) com marca registrada.` : 'Nenhum benchmark com histórico ainda.'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>PRs</strong>
            <span>${isBusy || isDetailLoading ? 'Carregando PRs...' : prHistory.length ? `${prHistory.length} PR(s) acompanhados no app.` : 'Cadastre seus PRs para calcular cargas com contexto.'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Resultados</strong>
            <span>${isBusy || isSummaryLoading ? 'Carregando resumo...' : resultsLogged ? `${resultsLogged} resultado(s) registrado(s) até agora.` : 'Nenhum resultado registrado ainda.'}</span>
          </div>
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'Benchmarks',
        subtitle: 'Tendência das marcas que você já registrou.',
        content: `
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(4) : isDetailError ? '<p class="account-hint">Não foi possível carregar benchmarks agora.</p>' : benchmarkHistory.length ? benchmarkHistory.map((item) => `
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
          `).join('') : '<p class="account-hint">Finalize benchmarks ou registre seus resultados para começar o histórico.</p>'}
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'PRs',
        subtitle: 'Suas cargas de referência em leitura direta.',
        content: `
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(3) : isDetailError ? '<p class="account-hint">Não foi possível carregar PRs agora.</p>' : prHistory.length ? prHistory.map((item) => `
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
  const athleteBlocks = state?.__ui?.athleteOverview?.blocks || {};
  const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
  const accessEntitlements = coachPortal?.entitlements || [];
  const canCoachManage = accessEntitlements.includes('coach_portal');
  const gyms = coachPortal?.gyms || [];
  const athleteStats = state?.__ui?.athleteOverview?.stats || {};
  const athleteBenefitSource = describeAthleteBenefitSource(athleteBenefits);
  const athleteResults = state?.__ui?.athleteOverview?.recentResults || [];
  const athleteWorkouts = state?.__ui?.athleteOverview?.recentWorkouts || [];
  const isSummaryLoading = coachPortal?.status === 'loading' || athleteBlocks?.summary?.status === 'loading';
  const isWorkoutsLoading = athleteBlocks?.workouts?.status === 'loading';
  const isResultsLoading = athleteBlocks?.results?.status === 'loading';

  if (!profile?.email) {
    return `
      <div class="workout-container page-stack page-stack-account">
        ${renderPageHero({
          eyebrow: 'Conta',
          title: 'Sua conta',
          subtitle: 'Salve seu uso, recupere a senha por email e continue de onde parou.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
          `,
        })}

        ${renderPageFold({
          title: 'O que libera',
          subtitle: 'Benefícios práticos dentro do app.',
          content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Conta salva</strong>
                <span>Entre com a mesma conta quando precisar retomar seu uso.</span>
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
          title: 'Coach Portal',
          subtitle: 'A mesma conta também abre a área separada do box.',
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Portal separado</strong>
              <span>Gestão do box, atletas e publicação de treino continuam fora do app principal.</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
            <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
          </div>
          `,
        })}
      </div>
    `;
  }

  return `
    <div class="workout-container page-stack page-stack-account">
      ${renderPageHero({
        eyebrow: 'Conta',
        title: profile.name || 'Sua conta',
        subtitle: 'Acesso, plano e atividade recente em leitura direta.',
        actions: `
          <button class="btn-secondary" data-action="auth:refresh" type="button">Recarregar</button>
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
        `,
      })}

      ${renderPageFold({
        title: 'Seu acesso',
        subtitle: 'O essencial da conta em um só lugar.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Perfil</strong>
            <span>${isBusy ? 'Carregando perfil...' : `${escapeHtml(profile.name || 'Sem nome')} • ${escapeHtml(profile.email || '')}`}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Plano</strong>
            <span>${isBusy || coachPortal?.status === 'loading' ? 'Carregando plano...' : `${escapeHtml(planName)} • ${escapeHtml(planStatus)}`}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Acesso do atleta</strong>
            <span>${isSummaryLoading ? 'Carregando acesso...' : `${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}`}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Uso do app</strong>
            <span>${isSummaryLoading ? 'Buscando indicadores...' : `${Number(athleteStats?.resultsLogged || 0)} resultado(s) • ${importUsage.unlimited ? 'imports livres' : `${importUsage.remaining} restante(s)`}`}</span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'Coach Portal',
        subtitle: 'Portal separado do box e próximo passo de acesso.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Status do portal</strong>
            <span>${canCoachManage ? `Liberado • ${gyms.length} gym(s) visível(is)` : 'Indisponível no plano atual'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Renovação</strong>
            <span>${renewAt ? `Plano renova em ${escapeHtml(formatDateShort(renewAt))}` : 'Sem data de renovação disponível.'}</span>
          </div>
        </div>
        <div class="page-actions">
          ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Ver upgrade</button>' : ''}
          ${canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
          ${canCoachManage ? '<a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir Coach Portal</a>' : '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>'}
        </div>
        `,
      })}

      ${renderPageFold({
        title: 'Atividade recente',
        subtitle: 'O que já apareceu para você dentro do app.',
        content: `
        <div class="coach-list coach-listCompact">
          <div class="coach-listItem static">
            <strong>Resultados recentes</strong>
            <span>${isResultsLoading ? 'Carregando resultados...' : athleteResults.length ? `${athleteResults.length} registro(s) recente(s).` : 'Nenhum resultado registrado ainda.'}</span>
          </div>
          <div class="coach-listItem static">
            <strong>Treinos do box</strong>
            <span>${isWorkoutsLoading ? 'Carregando treinos...' : athleteWorkouts.length ? `${athleteWorkouts.length} treino(s) recente(s) liberado(s).` : 'Nenhum treino recente liberado para sua conta.'}</span>
          </div>
        </div>
        `,
      })}
    </div>
  `;
}

function renderTodayPageIntro(state) {
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  const hasWorkout = !!(state?.workout?.blocks?.length || state?.workoutOfDay?.blocks?.length);
  const activeWeek = state?.activeWeekNumber || state?.weeks?.[0]?.weekNumber || 1;
  const currentDay = formatDay(state?.currentDay || state?.workout?.day || state?.workoutOfDay?.day || '');
  const heroActions = hasWeeks ? `
    <button class="btn-secondary" data-action="day:auto" type="button">Automático</button>
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
  ` : '';

  return `
    ${renderPageHero({
      eyebrow: 'Hoje',
      title: hasWorkout && currentDay ? currentDay : 'Treino do dia',
      subtitle: hasWeeks
        ? (hasWorkout
          ? `Semana ${activeWeek} • ${currentDay || 'sessão pronta'}`
          : `Semana ${activeWeek} • escolha o dia ou troque a planilha`)
        : 'Importe um treino em PDF, imagem, vídeo, planilha ou texto.',
      actions: heroActions,
      footer: hasWeeks ? `<div class="week-chips">${renderWeekChips(state)}</div>` : '',
    })}
  `;
}

function renderTodayOverview(state, workout) {
  const weeks = state?.weeks?.length ?? 0;
  const activeWeek = state?.activeWeekNumber ?? state?.weeks?.[0]?.weekNumber ?? null;
  const activeSource = state?.workoutContext?.activeSource || 'uploaded';
  const warningsCount = workout?.warnings?.length || 0;
  const lines = (workout?.blocks || []).reduce((sum, block) => sum + (block?.lines?.length || 0), 0);
  const blocks = workout?.blocks?.length || 0;
  const currentDay = formatDay(state?.currentDay || workout?.day || '');

  if (!workout && !weeks) return '';

  if (!workout) {
    return `
      <div class="today-overviewCard">
        <div class="today-overviewTop">
          <span class="today-overviewBadge">${weeks ? `Semana ${activeWeek || 1}` : 'Modo livre'}</span>
          <span class="today-overviewMeta">Sem sessão carregada</span>
        </div>
        <strong class="today-overviewTitle">${weeks ? 'Escolha o dia ou troque a planilha.' : 'Importe um treino para começar.'}</strong>
      </div>
    `;
  }

  return `
    <div class="today-overviewCard">
      <div class="today-overviewTop">
        <span class="today-overviewBadge">${weeks ? `Semana ${activeWeek || 1}` : 'Sessão avulsa'}</span>
        <span class="today-overviewMeta">${activeSource === 'coach' ? 'Coach' : 'Planilha'}</span>
      </div>
      <strong class="today-overviewTitle">${warningsCount ? `${warningsCount} aviso(s) na sessão` : `${blocks} bloco(s) e ${lines} linha(s)`}</strong>
      ${currentDay ? `<span class="today-overviewFoot">${escapeHtml(currentDay)}</span>` : ''}
    </div>
  `;
}

function renderTodaySessionCard(state, workout) {
  const activeSource = state?.workoutContext?.activeSource || 'uploaded';
  const warningsCount = workout?.warnings?.length || 0;
  const blocks = workout?.blocks?.length || 0;
  const firstUsefulLine = (workout?.blocks || [])
    .flatMap((block) => block?.lines || [])
    .map((line) => typeof line === 'string' ? line : (line?.raw || line?.text || ''))
    .map((line) => String(line || '').trim())
    .find((line) => line && !line.startsWith('*') && !line.includes('@gmail') && !line.includes('@hotmail')) || '';

  return `
    <section class="today-sessionCard">
      <div class="today-sessionHead">
        <div>
          <div class="section-kicker">Sessão</div>
          <h2 class="today-sessionTitle">${escapeHtml(firstUsefulLine || 'Treino pronto')}</h2>
        </div>
        <div class="today-sessionPill ${warningsCount ? 'isWarn' : 'isGood'}">${warningsCount ? `${warningsCount} aviso(s)` : 'Pronto'}</div>
      </div>
      <div class="today-sessionMeta">
        <span>${escapeHtml(activeSource === 'coach' ? 'Vindo do coach' : 'Vindo da sua planilha')}</span>
        <span>${blocks} bloco(s)</span>
      </div>
      <div class="today-sessionStrip">
        <span class="today-sessionStripItem">${warningsCount ? 'Ajuste os avisos antes de começar' : 'Sessão pronta para executar'}</span>
      </div>
    </section>
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

export function renderImportModal(state = {}) {
  const importStatus = state?.__ui?.importStatus || {};
  const hasCurrentWorkout = !!(state?.workout?.blocks?.length || state?.workoutOfDay?.blocks?.length);
  const importSteps = [
    { key: 'selected', label: 'Selecionado' },
    { key: 'read', label: 'Lendo' },
    { key: 'organize', label: 'Organizando' },
    { key: 'save', label: 'Salvo' },
  ];
  const activeStepIndex = importSteps.findIndex((item) => item.key === importStatus?.step);
  const importBusy = !!importStatus?.active;
  return `
    <div class="modal-overlay isOpen">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Adicionar treino</h2>
          <button class="modal-close" data-action="modal:close" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>✕</button>
        </div>
        <div class="modal-body modal-body-auth">
          <div class="auth-intro">
            <div class="section-kicker">Importação</div>
            <p class="account-hint">${importBusy ? 'Estamos processando seu arquivo. Aguarde para importar outro.' : 'Escolha o tipo de arquivo.'}</p>
          </div>
          ${(importStatus?.active || importStatus?.message) ? `
            <div class="import-statusCard is-${escapeHtml(importStatus.tone || 'idle')}" id="ui-importStatus">
              <div class="import-statusHead">
                <strong>${escapeHtml(importStatus.title || 'Importando arquivo')}</strong>
                ${importStatus?.fileName ? `<span>${escapeHtml(importStatus.fileName)}</span>` : ''}
              </div>
              <div class="import-stepper" aria-hidden="true">
                ${importSteps.map((step, index) => `
                  <div class="import-step ${index <= activeStepIndex ? 'isDone' : ''} ${index === activeStepIndex ? 'isActive' : ''}">
                    <span class="import-stepDot"></span>
                    <span class="import-stepLabel">${escapeHtml(step.label)}</span>
                  </div>
                `).join('')}
              </div>
              <p>${escapeHtml(importStatus.message || 'Preparando importação...')}</p>
            </div>
          ` : ''}
          <div class="coach-grid">
            <button class="quick-action quick-action-modal" data-action="pdf:pick" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
              <span class="quick-actionIcon">PDF</span>
              <span class="quick-actionLabel">Planilha em PDF</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="media:pick" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
              <span class="quick-actionIcon">ARQ</span>
              <span class="quick-actionLabel">Imagem, vídeo, planilha ou texto</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="workout:import" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
              <span class="quick-actionIcon">JSON</span>
              <span class="quick-actionLabel">Arquivo salvo</span>
            </button>
            ${hasCurrentWorkout ? `
              <button class="quick-action quick-action-modal" data-action="workout:export" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
                <span class="quick-actionIcon">EXP</span>
                <span class="quick-actionLabel">Exportar treino atual</span>
              </button>
            ` : ''}
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
        <div class="rest-badge">Descanso</div>
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
        <span class="note-badge">Nota</span>
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
      Executar
    </button>
  ` : '';
  
  return `
    <div class="workout-line" data-line-id="${escapeHtml(lineId)}">
      <span class="workout-lineMarker" aria-hidden="true"></span>
      <div class="exercise-main">
        <div class="exercise-text">${text}</div>
        ${loadHtml}
      </div>
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
      <div class="modal-container modal-container-settings">
        <div class="modal-header">
          <h2 class="modal-title">⚙️ Configurações</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-settings">
          <section class="settings-section">
            <div class="settings-sectionHead">
              <strong>Preferências</strong>
              <span>Salvam automaticamente quando você toca.</span>
            </div>
            <div class="settings-group">
              <label class="settings-label">
                <input
                  type="checkbox"
                  id="setting-showLbsConversion"
                  data-setting-toggle="showLbsConversion"
                  ${showLbsConversion ? 'checked' : ''}
                />
                <span>
                  <strong>Mostrar conversão lbs → kg</strong>
                  <small>Ajuda a ler cargas importadas em libras sem fazer conta mental.</small>
                </span>
              </label>

              <label class="settings-label">
                <input
                  type="checkbox"
                  id="setting-showEmojis"
                  data-setting-toggle="showEmojis"
                  ${showEmojis ? 'checked' : ''}
                />
                <span>
                  <strong>Mostrar emojis</strong>
                  <small>Mantém a leitura mais leve nas áreas que usam sinais visuais rápidos.</small>
                </span>
              </label>

              <label class="settings-label">
                <input
                  type="checkbox"
                  id="setting-showObjectives"
                  data-setting-toggle="showObjectivesInWods"
                  ${showObjectivesInWods ? 'checked' : ''}
                />
                <span>
                  <strong>Mostrar objetivos nos WODs</strong>
                  <small>Exibe a intenção do treino quando o conteúdo tiver esse contexto.</small>
                </span>
              </label>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-sectionHead">
              <strong>Dados</strong>
              <span>Ferramentas para guardar ou recuperar seu app.</span>
            </div>
            <div class="settings-actions settings-actions-grid">
              <button class="btn-secondary" data-action="backup:export" type="button">🧰 Fazer backup</button>
              <button class="btn-secondary" data-action="backup:import" type="button">♻️ Restaurar backup</button>
            </div>
          </section>

          <section class="settings-section settings-section-danger">
            <div class="settings-sectionHead">
              <strong>Avançado</strong>
              <span>Ação crítica. Use só quando quiser zerar os dados locais do app.</span>
            </div>
            <div class="settings-actions">
              <button class="btn-secondary btn-dangerSoft" data-action="pdf:clear" type="button">🗑️ Limpar dados do app</button>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-sectionHead">
              <strong>Sobre</strong>
              <span>Informações legais e privacidade.</span>
            </div>
            <div class="settings-actions settings-actions-grid">
              <a class="btn-secondary settings-linkBtn" href="/privacy.html" target="_blank" rel="noopener noreferrer">🔐 Privacidade</a>
              <a class="btn-secondary settings-linkBtn" href="/terms.html" target="_blank" rel="noopener noreferrer">📄 Termos</a>
            </div>
          </section>
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
  const resetStep = reset?.step === 'confirm' ? 'confirm' : 'request';
  const signupVerification = auth?.signupVerification || {};
  const rememberedEmail = signupVerification.email || reset.email || '';
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
    const athleteWorkouts = athleteOverview?.recentWorkouts || [];
    const athleteBenefits = normalizeAthleteBenefits(athleteOverview?.athleteBenefits || null);
    const planKey = subscription?.plan || subscription?.plan_id || 'free';
    const planName = formatSubscriptionPlanName(planKey);
    const planStatus = subscription?.status || 'inactive';
    const canUseDeveloperTools = isDeveloperEmail(profile?.email);
    const renewAt = subscription?.renewAt || subscription?.renew_at || null;
    const hasActiveCoachSubscription = planStatus === 'active' && (planKey === 'pro' || planKey === 'coach');
    return `
      <div class="modal-overlay modal-overlay-auth isOpen" id="ui-authModalBackdrop">
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

            <div class="settings-actions account-actions">
              <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
              <button class="btn-secondary" data-action="modal:close" type="button">Fechar</button>
            </div>

            <div class="auth-intro">
              <div class="section-kicker">Coach</div>
              <p class="account-hint">${canCoachManage || canUseDeveloperTools
                ? 'O portal do coach continua separado do app do atleta. Use sua mesma conta para abrir o workspace do box.'
                : hasActiveCoachSubscription
                  ? 'Seu plano está ativo, mas o portal do coach só libera quando sua conta está vinculada a um gym com permissão de gestão.'
                  : 'Seu acesso de coach está bloqueado. Ative um plano quando quiser operar box, atletas e grupos no portal separado. O app do atleta continua liberado.'}</p>
              <div class="coach-pillRow">
                <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Coach liberado' : 'Coach bloqueado'}</span>
                <span class="coach-pill ${canAthleteUseApp ? 'isGood' : 'isWarn'}">${canAthleteUseApp ? 'Atleta liberado' : 'Atleta bloqueado'}</span>
                <span class="coach-pill">${gyms.length} gym(s)</span>
              </div>
              <div class="settings-actions coach-billingActions">
                ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
                ${!canCoachManage && canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
                <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
                ${!canCoachManage ? '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>' : ''}
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
                    <div class="admin-statCard">
                      <span class="admin-statLabel">Exclusões pendentes</span>
                      <span class="admin-statValue">${Number(overview?.stats?.pendingAccountDeletions || 0)}</span>
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
                          ${user.pendingDeletion ? `
                            <div class="account-hint" style="color:#f3c87b;">
                              Exclusão pendente • apaga em ${escapeHtml(formatDateShort(user.pendingDeletion.delete_after || user.pendingDeletion.deleteAfter || ''))}
                            </div>
                          ` : ''}
                        </div>
                        <div class="admin-userControls">
                          <div class="admin-userMeta">${user.is_admin ? 'Admin' : 'User'}</div>
                          <div class="admin-userActions">
                            <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="starter" type="button">Starter</button>
                            <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="pro" type="button">Pro</button>
                            <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="performance" type="button">Performance</button>
                            <button class="btn-secondary" data-action="admin:request-delete" data-user-id="${Number(user.id)}" data-user-email="${escapeHtml(user.email || '')}" type="button">${user.pendingDeletion ? 'Reenviar deleção' : 'Pedir deleção'}</button>
                            <button class="btn-secondary" data-action="admin:delete-now" data-user-id="${Number(user.id)}" data-user-email="${escapeHtml(user.email || '')}" type="button">Excluir agora</button>
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
    <div class="modal-overlay modal-overlay-auth isOpen" id="ui-authModalBackdrop">
      <div class="modal-container modal-container-auth">
        <div class="modal-header">
          <h2 class="modal-title">${isSignup ? 'Criar conta' : 'Entrar'}</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          <div class="auth-intro auth-intro-auth">
            <div class="section-kicker">${isSignup ? 'Criar conta' : 'Entrar'}</div>
            <p class="account-hint">${isSignup
              ? 'Crie sua conta para salvar treino, histórico e progresso sem misturar isso com a operação do box.'
              : 'Entre para retomar treino, histórico e progresso exatamente de onde parou.'}</p>
          </div>

          <div class="auth-switch">
            <button class="btn-secondary ${!isSignup ? 'isSelected' : ''}" data-action="auth:switch" data-mode="signin" type="button">Entrar</button>
            <button class="btn-secondary ${isSignup ? 'isSelected' : ''}" data-action="auth:switch" data-mode="signup" type="button">Cadastrar</button>
          </div>

          <div class="auth-googleBlock" id="google-signin-shell">
            <div id="google-signin-button"></div>
          </div>

          <div class="auth-divider">ou continue com email</div>

          <form class="auth-form" id="ui-authForm">
            <input class="add-input" id="auth-name" type="text" placeholder="Seu nome" autocomplete="name" value="${escapeHtml(signupVerification.name || '')}" ${isSignup ? '' : 'style="display:none"'} />
            <input class="add-input" id="auth-email" type="email" inputmode="email" autocapitalize="off" autocomplete="email username" placeholder="Seu email" value="${escapeHtml(rememberedEmail)}" />
            <input class="add-input" id="auth-password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="Sua senha" />
            ${isSignup ? `
              <div class="auth-signupVerify">
                <button class="btn-secondary" data-action="auth:signup-request-code" type="button">Enviar código</button>
                <input class="add-input" id="auth-signup-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Código de verificação" value="${escapeHtml(signupVerification.code || signupVerification.previewCode || '')}" />
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
                <p class="account-hint">Digite o código enviado ao seu email.</p>
              </div>
            ` : ''}
            <button class="btn-primary auth-submitButton" data-action="auth:submit" data-mode="${escapeHtml(authMode)}" type="button">
              ${isSignup ? 'Criar conta com código' : 'Entrar'}
            </button>
            ${!isSignup && reset?.message && !reset?.open ? `
              <p class="account-hint auth-inlineStatus">${escapeHtml(reset.message)}</p>
            ` : ''}
          </form>

          ${!isSignup ? `
            <div class="auth-assist">
              <button class="auth-resetToggle ${reset?.open ? 'isOpen' : ''}" data-action="auth:reset-toggle" type="button">
                ${reset?.open ? 'Voltar ao login' : 'Esqueci minha senha'}
              </button>

              ${reset?.open ? `
                <div class="auth-resetBox">
                  <div class="auth-resetIntro">
                    <strong>Recuperar senha</strong>
                    <p class="account-hint">${resetStep === 'confirm'
                      ? 'Agora informe o codigo recebido e defina sua nova senha.'
                      : 'Digite o email da conta para receber um codigo de recuperacao.'}</p>
                  </div>
                  <div class="auth-resetForm">
                  <input class="add-input" id="reset-email" type="email" inputmode="email" autocapitalize="off" autocomplete="email username" placeholder="Email da conta" value="${escapeHtml(reset.email || '')}" />
                  <button class="btn-secondary auth-resetRequestButton" data-action="auth:reset-request" type="button" ${Number(reset?.cooldownUntil || 0) > Date.now() ? 'disabled' : ''}>${escapeHtml(formatCooldownLabel(reset?.cooldownUntil || 0))}</button>
                  ${resetStep === 'confirm' ? `
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
                  <input class="add-input" id="reset-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Código de 6 dígitos" value="${escapeHtml(reset.code || '')}" />
                  <input class="add-input" id="reset-newPassword" type="password" autocomplete="new-password" placeholder="Nova senha" />
                  <button class="btn-primary auth-resetConfirmButton" data-action="auth:reset-confirm" type="button">Trocar senha</button>
                  ` : ''}
                  ${reset?.message ? `
                    <p class="account-hint auth-resetStatus">${escapeHtml(reset.message)}</p>
                  ` : `
                    <p class="account-hint auth-resetStatus">Vamos enviar um codigo de 6 digitos para o email da conta.</p>
                  `}
                </div>
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
