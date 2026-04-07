export function renderAthleteTodayPage(state, helpers) {
  const { renderPageHero, renderBottomTools, renderWorkoutBlock, escapeHtml, formatDay } = helpers;
  const workout = state?.workout ?? state?.workoutOfDay;

  if (!workout || !workout.blocks?.length) {
    return `
      <div class="workout-container">
        ${renderTodayPageIntro(state, { renderPageHero, escapeHtml, formatDay })}
        ${renderTodayOverview(state, null, { escapeHtml, formatDay })}
        ${renderEmptyState(state, { escapeHtml, formatDay })}
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
      ${renderTodayPageIntro(state, { renderPageHero, escapeHtml, formatDay })}
      ${renderTodayOverview(state, workout, { escapeHtml, formatDay })}
      ${renderTodaySessionCard(state, workout, { escapeHtml, formatDay })}
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

      ${workout.blocks.map((block, blockIndex) => renderWorkoutBlock(block, blockIndex, ui)).join('')}
      ${renderBottomTools(state)}
    </div>
  `;
}

function renderEmptyState(state, { escapeHtml, formatDay }) {
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

function renderTodayPageIntro(state, { renderPageHero, escapeHtml, formatDay }) {
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

  const renderWeekChips = (localState) => {
    const weeks = localState?.weeks || [];
    const activeWeekNumber = localState?.activeWeekNumber;

    if (!weeks.length) return '<div class="week-chip-empty">Carregue um PDF</div>';

    return weeks.map((week) => {
      const weekNumber =
        (typeof week === 'number' || typeof week === 'string')
          ? Number(week)
          : (week?.weekNumber ?? week?.number ?? week?.week ?? week?.id);

      const isActive = weekNumber === activeWeekNumber;

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
  };

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

function renderTodayOverview(state, workout, { escapeHtml, formatDay }) {
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

function renderTodaySessionCard(state, workout, { escapeHtml }) {
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
