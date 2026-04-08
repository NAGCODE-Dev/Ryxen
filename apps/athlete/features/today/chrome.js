export function renderTodayEmptyState(state, { escapeHtml, formatDay }) {
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

export function renderTodayPageIntro(state, { renderPageHero, formatDay }) {
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
