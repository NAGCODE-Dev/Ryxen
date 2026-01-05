export function renderAppShell() {
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
          <h1 class="app-title">💪 Treino do Dia</h1>
          <p class="app-subtitle" id="ui-subtitle">Carregando...</p>

          <div class="day-controls">
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
          </div>
        </div>
      </header>

      <!-- WEEK CHIPS -->
      <div class="week-chips-container">
        <div class="week-chips" id="ui-weekChips"></div>
      </div>

      <!-- MAIN -->
      <main class="app-main" id="ui-main"></main>

      <!-- EVENTS (debug) -->
      <div id="ui-events" class="ui-events"></div>

      <!-- MODALS -->
      <div id="ui-modals"></div>

      <!-- BOTTOM NAV -->
      <nav class="bottom-nav">
        <button class="nav-btn" data-action="workout:copy" type="button">
          <span class="nav-icon">📋</span>
          <span class="nav-label">Copiar</span>
        </button>

        <button class="nav-btn" data-action="modal:open" data-modal="prs" type="button">
          <span class="nav-icon">🎯</span>
          <span class="nav-label">PRs</span>
        </button>

        <button class="nav-btn nav-btn-primary" data-action="pdf:pick" type="button">
          <span class="nav-icon">📄</span>
          <span class="nav-label">PDF</span>
        </button>

        <button class="nav-btn" data-action="workout:export" type="button">
          <span class="nav-icon">💾</span>
          <span class="nav-label">Exportar</span>
        </button>

        <button class="nav-btn" data-action="modal:open" data-modal="settings" type="button">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Config</span>
        </button>
      </nav>
    </div>
  `;
}

export function renderAll(state = {}) {
  const subtitle = formatSubtitle(state);
  const weekChipsHtml = renderWeekChips(state);
  const mainHtml = renderMainContent(state);
  const modalsHtml = renderModals(state);

  return {
    subtitle,
    weekChipsHtml,
    mainHtml,
    modalsHtml,
  };
}

function renderModals(state) {
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};

  if (modal === 'prs') return renderPrsModal(prs);
  if (modal === 'settings') return renderSettingsModal(settings);

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
  const workout = state?.workout || state?.workoutOfDay;
  if (!workout || !workout.blocks?.length) {
    return renderEmptyState(state);
  }

  const ui = state?.__ui || {};
  const trainingMode = !!ui.trainingMode;
  const progress = ui.progress || { doneCount: 0, totalCount: 0 };

  return `
    <div class="workout-container">
      <div class="workout-header">
        <h2 class="workout-title">Treino • ${escapeHtml(formatDay(state?.currentDay))}</h2>

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
        <p>Carregue um PDF de treino para começar</p>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-icon">😴</div>
      <h2>Sem treino para ${escapeHtml(day)}</h2>
      <p>Não há treino programado para este dia</p>
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

  const rawText =
    typeof line === 'string'
      ? line
      : (line?.text ?? line?.raw ?? line?.label ?? '');

  const text = escapeHtml(rawText);

  const load = typeof line === 'object' ? line.loadCalculation : null;
  const hasLoad = load && load.calculated && load.displayText;
  const isWarning = load?.warnings?.length > 0;

  if (!trainingMode) {
    return `
      <div class="workout-line" data-line-id="${escapeHtml(lineId)}">
        <div class="exercise-text">${text}</div>
        ${hasLoad ? `
          <div class="load-calc ${isWarning ? 'load-warning' : ''}">
            → ${escapeHtml(load.displayText)}
          </div>
        ` : ''}
      </div>
    `;
  }

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
        ✓
      </button>

      <button
        class="line-body"
        type="button"
        data-action="wod:toggle"
        data-line-id="${escapeHtml(lineId)}"
        title="Selecionar/alternar"
      >
        <div class="exercise-text">${text}</div>
        ${hasLoad ? `
          <div class="load-calc ${isWarning ? 'load-warning' : ''}">
            → ${escapeHtml(load.displayText)}
          </div>
        ` : ''}
      </button>
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
            <button class="btn-secondary" data-action="pdf:clear" type="button">
              🗑️ Limpar Tudo
            </button>
          </div>
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
