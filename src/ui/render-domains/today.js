import { getAthleteImportUsage, normalizeAthleteBenefits } from '../../core/services/athleteBenefitUsage.js';

export function renderTodayPage(state, helpers) {
  const {
    renderPageHero,
    renderSummaryTile,
    renderWorkoutBlock,
    renderBottomTools,
    formatDay,
    formatSubtitle,
    escapeHtml,
  } = helpers;

  const workout = state?.workout ?? state?.workoutOfDay;
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  const accessBanner = renderAthleteAccessBanner(state, { escapeHtml });
  if (!isAuthenticated && !hasWeeks) {
    return renderPublicTodayEntry(state, { renderPageHero, escapeHtml });
  }
  if (!workout || !workout.blocks?.length) {
    return `
      <div class="workout-container">
        ${renderTodayPageIntro(state, { renderPageHero, renderSummaryTile, formatSubtitle, escapeHtml })}
        ${accessBanner}
        ${renderEmptyState(state, { formatDay, escapeHtml })}
        ${renderBottomTools(state)}
      </div>
    `;
  }

  const ui = state?.__ui || {};
  const trainingMode = !!ui.trainingMode;
  const progress = ui.progress || { doneCount: 0, totalCount: 0 };
  const workoutContext = state?.workoutContext || {};
  const importReview = state?.workoutMeta?.importReview || ui?.importFlow?.lastReview || null;
  const showSourceToggle = !!workoutContext.canToggle;
  const activeSource = workoutContext.activeSource || 'uploaded';

  return `
    <div class="workout-container">
      ${renderTodayPageIntro(state, { renderPageHero, renderSummaryTile, formatSubtitle, escapeHtml })}
      ${accessBanner}
      ${renderWorkoutContextNav(state?.__ui?.currentPage || 'today')}
      ${renderImportReview(importReview, { escapeHtml })}
      <div class="workout-header">
        <h2 class="workout-title">Train • ${escapeHtml(formatDay(state?.currentDay))}</h2>
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

function renderImportReview(review, helpers) {
  const { escapeHtml } = helpers;
  if (!review || typeof review !== 'object') return '';

  return `
    <div class="auth-intro import-reviewCard">
      <div class="section-kicker">Última importação</div>
      <strong>${escapeHtml(review.summary || 'Arquivo importado')}</strong>
      <div class="coach-pillRow">
        <span class="coach-pill">Origem: ${escapeHtml(review.sourceLabel || review.source || 'arquivo')}</span>
        <span class="coach-pill">Confiança: ${escapeHtml(review.confidenceLabel || 'média')}</span>
        <span class="coach-pill">${escapeHtml(String(review.weekCount || 0))} semana(s)</span>
      </div>
      ${(review.warnings || []).length ? `<p class="account-hint">${escapeHtml(review.warnings.join(' • '))}</p>` : ''}
    </div>
  `;
}

function renderWorkoutContextNav(currentPage) {
  const items = [
    { page: 'today', label: 'Hoje' },
    { modal: 'import', label: 'Importar' },
    { page: 'history', label: 'Perfil' },
    { page: 'account', label: 'Conta' },
  ];

  return `
    <div class="workout-contextNav" aria-label="Troca rápida de seção">
      ${items.map((item) => `
        <button
          class="coach-pill workout-contextNavBtn ${item.page && currentPage === item.page ? 'isActive' : ''}"
          data-action="${item.page ? 'page:set' : 'modal:open'}"
          ${item.page ? `data-page="${item.page}"` : `data-modal="${item.modal}"`}
          type="button"
        >
          ${item.label}
        </button>
      `).join('')}
    </div>
  `;
}

function renderAthleteAccessBanner(state, helpers) {
  const { escapeHtml } = helpers;
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

function renderEmptyState(state, helpers) {
  const { formatDay, escapeHtml } = helpers;
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  const day = formatDay(state?.currentDay);
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;

  if (!hasWeeks) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
      <h2>Comece no módulo Train</h2>
      <p>${isAuthenticated
          ? 'Importe sua planilha ou escolha outro dia para continuar.'
          : 'Importe sua planilha ou entre na conta para salvar seus treinos e resultados.'
        }</p>
        <div class="page-actions page-actions-inline">
          <button class="btn-primary" data-action="modal:open" data-modal="import" type="button">Adicionar treino</button>
          ${isAuthenticated
            ? '<button class="btn-secondary" data-action="page:set" data-page="account" type="button">Ver conta</button>'
            : '<button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>'
          }
        </div>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-icon">😴</div>
      <h2>Sem treino para ${escapeHtml(day)}</h2>
      <p>Troque o dia ou importe uma planilha manual para continuar.</p>
      <div class="page-actions page-actions-inline">
        <button class="btn-secondary" data-action="day:auto" type="button">Voltar para auto</button>
        <button class="btn-secondary" data-action="modal:open" data-modal="import" type="button">Adicionar treino</button>
      </div>
    </div>
  `;
}

function renderTodayPageIntro(state, helpers) {
  const { renderPageHero, formatSubtitle } = helpers;
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;
  return `
    ${renderPageHero({
      eyebrow: 'Train',
      title: hasWeeks ? 'Treino do dia' : 'Comece pelo treino certo',
      subtitle: hasWeeks
        ? formatSubtitle(state)
        : 'Importe uma planilha ou entre para salvar seus treinos e resultados dentro do CrossApp Train.',
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
    ${renderAthleteBenefitsStrip(state, helpers)}
  `;
}

function renderPublicTodayEntry(state, helpers) {
  const { renderPageHero, escapeHtml } = helpers;

  return `
    <div class="workout-container workout-container-entry">
      ${renderPageHero({
        eyebrow: 'CrossApp',
        title: 'Acompanhe seu treino sem complicar',
        subtitle: 'Entre para acompanhar seus treinos, importar planilhas, registrar resultados e ver sua evolução no dia a dia.',
        actions: `
          <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
          <button class="btn-secondary" data-action="modal:open" data-modal="auth" data-auth-mode="signup" type="button">Criar conta</button>
        `,
        footer: `
          <div class="entry-featureRow">
            <div class="summary-tile summary-tileCompact">
              <span class="summary-label">Treino do dia</span>
              <strong class="summary-value">Hoje</strong>
              <span class="summary-detail">veja o que fazer agora</span>
            </div>
            <div class="summary-tile summary-tileCompact">
              <span class="summary-label">Importação</span>
              <strong class="summary-value">Planilha</strong>
              <span class="summary-detail">PDF, foto ou treino salvo</span>
            </div>
            <div class="summary-tile summary-tileCompact">
              <span class="summary-label">Evolução</span>
              <strong class="summary-value">Registros</strong>
              <span class="summary-detail">benchmarks e marcas pessoais</span>
            </div>
          </div>
        `,
      })}

      <div class="empty-state empty-state-entry">
        <div class="empty-icon">📋</div>
        <h2>Comece por aqui</h2>
        <p>Se já tiver sua planilha, importe agora. Se preferir, entre na sua conta e deixe tudo salvo no mesmo lugar.</p>
        <div class="page-actions page-actions-inline">
          <button class="btn-secondary" data-action="modal:open" data-modal="import" type="button">Importar treino</button>
        </div>
      </div>
    </div>
  `;
}

function renderAthleteBenefitsStrip(state, helpers) {
  const { renderSummaryTile } = helpers;
  const benefits = normalizeAthleteBenefits(state?.__ui?.athleteOverview?.athleteBenefits || null);
  const importUsage = getAthleteImportUsage(benefits, 'pdf');
  const historyValue = benefits.historyDays === null ? 'Completo' : `${benefits.historyDays} dias`;

  return `
    <div class="summary-strip summary-strip-3">
      ${renderSummaryTile('Hoje', benefits.label, describeAthleteBenefitSource(benefits))}
      ${renderSummaryTile('Imports no mês', importUsage.unlimited ? 'Ilimitado' : `${importUsage.remaining}/${importUsage.limit}`, importUsage.unlimited ? 'PDF ou mídia sem limite' : `${importUsage.used} usado(s) entre PDF e mídia`)}
      ${renderSummaryTile('Perfil', historyValue, 'evolução e benchmarks')}
    </div>
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

function describeAthleteBenefitSource(benefits) {
  const normalized = normalizeAthleteBenefits(benefits);
  if (normalized.personalPlan === 'athlete_plus') return 'plano pessoal do atleta';
  if (normalized.effectiveTier === 'performance') return 'plano do coach (performance)';
  if (normalized.effectiveTier === 'pro') return 'plano do coach (pro)';
  if (normalized.effectiveTier === 'starter') return 'plano do coach (starter)';
  return 'modo base do atleta • até 10 imports por mês';
}
