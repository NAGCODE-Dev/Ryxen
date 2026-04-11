import { summarizeWorkoutForDisplay } from '../../workoutMetadataSummary.js';

export function renderTodayWorkoutHeader({
  showSourceToggle = false,
  activeSource = 'uploaded',
  warningsCount = 0,
}) {
  const showWorkoutHeader = showSourceToggle || warningsCount > 0;

  if (!showWorkoutHeader) return '';

  return `
    <div class="workout-header" data-guide-target="today-workout">
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
  `;
}

export function renderTodayOverview(state, workout, { escapeHtml, formatDay }) {
  const weeks = state?.weeks?.length ?? 0;
  const activeWeek = state?.activeWeekNumber ?? state?.weeks?.[0]?.weekNumber ?? null;
  const activeSource = state?.workoutContext?.activeSource || 'uploaded';
  const warningsCount = workout?.warnings?.length || 0;
  const lines = (workout?.blocks || []).reduce((sum, block) => sum + (block?.lines?.length || 0), 0);
  const blocks = workout?.blocks?.length || 0;
  const currentDay = formatDay(state?.currentDay || workout?.day || '');
  const metadata = summarizeWorkoutForDisplay(workout);

  if (!workout && !weeks) return '';

  if (!workout) {
    return `
      <div class="today-overviewCard" data-guide-target="today-overview">
        <div class="today-overviewTop">
          <span class="today-overviewBadge">${weeks ? `Semana ${activeWeek || 1}` : 'Modo livre'}</span>
          <span class="today-overviewMeta">Sem sessão carregada</span>
        </div>
        <strong class="today-overviewTitle">${weeks ? 'Escolha o dia ou troque a planilha.' : 'Importe um treino para começar.'}</strong>
      </div>
    `;
  }

  return `
    <div class="today-overviewCard" data-guide-target="today-overview">
      <div class="today-overviewTop">
        <span class="today-overviewBadge">${weeks ? `Semana ${activeWeek || 1}` : 'Sessão avulsa'}</span>
        <span class="today-overviewMeta">${activeSource === 'coach' ? 'Coach' : 'Planilha'}</span>
      </div>
      <strong class="today-overviewTitle">${escapeHtml(metadata.primaryTitle || 'Treino do dia')}</strong>
      ${metadata.periods.length || metadata.blockTypes.length ? `
        <div class="today-metaChips">
          ${metadata.periods.map((period) => `<span class="today-metaChip">${escapeHtml(period)}</span>`).join('')}
          ${metadata.blockTypes.map((type) => `<span class="today-metaChip">${escapeHtml(type)}</span>`).join('')}
        </div>
      ` : ''}
      <span class="today-overviewFoot">${warningsCount ? `${warningsCount} aviso(s)` : `${blocks} blocos · ${lines} linhas`}${currentDay ? ` • ${escapeHtml(currentDay)}` : ''}</span>
    </div>
  `;
}

export function renderTodaySessionCard(state, workout, { escapeHtml }) {
  const activeSource = state?.workoutContext?.activeSource || 'uploaded';
  const warningsCount = workout?.warnings?.length || 0;
  const blocks = workout?.blocks?.length || 0;
  const metadata = summarizeWorkoutForDisplay(workout);
  const compactHighlights = metadata.highlights.slice(0, 2);

  return `
    <section class="today-sessionCard" data-guide-target="today-workout">
      <div class="today-sessionHead">
        <div>
          <div class="section-kicker">Sessão</div>
          <h2 class="today-sessionTitle">${escapeHtml(metadata.primaryTitle || 'Treino pronto')}</h2>
        </div>
        <div class="today-sessionPill ${warningsCount ? 'isWarn' : 'isGood'}">${warningsCount ? `${warningsCount} aviso(s)` : 'Pronto'}</div>
      </div>
      <div class="today-sessionMeta">
        <span>${escapeHtml(activeSource === 'coach' ? 'Coach' : 'Planilha')}</span>
        <span>${blocks} blocos</span>
        ${metadata.periods.slice(0, 2).map((period) => `<span>${escapeHtml(period)}</span>`).join('')}
      </div>
      ${compactHighlights.length ? `
        <div class="today-sessionStrip">
          ${compactHighlights.map((item) => `<span class="today-sessionStripItem">${escapeHtml(item)}</span>`).join('')}
        </div>
      ` : ''}
    </section>
  `;
}
