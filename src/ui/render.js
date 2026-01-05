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
        </div>
      </header>

      <!-- WEEK CHIPS -->
      <div class="week-chips-container">
        <div class="week-chips" id="ui-weekChips"></div>
      </div>

      <!-- MAIN CONTENT -->
      <main class="app-main" id="ui-main">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h2>Nenhum treino carregado</h2>
          <p>Toque no botão + para carregar seu PDF</p>
        </div>
      </main>

      <!-- BOTTOM NAV -->
      <nav class="bottom-nav">
        <button class="nav-btn" data-action="copy">
          <span class="nav-icon">📋</span>
          <span class="nav-label">Copiar</span>
        </button>
        <button class="nav-btn" data-action="openPrsModal">
          <span class="nav-icon">🎯</span>
          <span class="nav-label">PRs</span>
        </button>
        <button class="nav-btn nav-btn-primary" data-action="loadPdf">
          <span class="nav-icon">📄</span>
          <span class="nav-label">PDF</span>
        </button>
        <button class="nav-btn" data-action="export">
          <span class="nav-icon">💾</span>
          <span class="nav-label">Exportar</span>
        </button>
        <button class="nav-btn" data-action="openSettingsModal">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">Config</span>
        </button>
      </nav>

      <!-- MODALS CONTAINER -->
      <div id="ui-modals"></div>

      <!-- HIDDEN ELEMENTS (para compatibilidade com ui.js) -->
      <div style="display:none;">
        <span id="ui-weekBadge"></span>
        <span id="ui-dayBadge"></span>
        <span id="ui-warnBadge"></span>
        <div id="ui-state"></div>
        <div id="ui-events"></div>
        <div id="ui-prsTable"></div>
        <span id="ui-prsCount"></span>
      </div>
    </div>
  `;
}

export function renderAll(state = {}) {
  const subtitle = formatSubtitle(state);
  const weekBadge = `Semana ${state?.activeWeekNumber ?? '—'}`;
  const dayBadge = formatDay(state?.currentDay);
  const warnBadgeVisible = state?.workoutOfDay?.warnings?.length > 0;
  const weekChipsHtml = renderWeekChips(state);
  const mainHtml = renderMainContent(state);
  const stateHtml = ''; // removido debug
  const prsModalHtml = ''; // renderizado sob demanda
  
  return {
    subtitle,
    weekBadge,
    dayBadge,
    warnBadgeVisible,
    weekChipsHtml,
    mainHtml,
    stateHtml,
    prsModalHtml,
  };
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
    'domingo': 'Domingo'
  };
  return days[day?.toLowerCase()] || day || 'Hoje';
}

function formatSubtitle(state) {
  const day = formatDay(state?.currentDay);
  const week = state?.activeWeekNumber ?? '—';
  const total = state?.totalWeeks ?? 0;
  
  if (!total) return 'Carregue um PDF para começar';
  return `Semana ${week} de ${total} • ${day}`;
}

function renderWeekChips(state) {
  const weeks = state?.allWeeks || [];
  const activeWeek = state?.activeWeekNumber;

  if (!weeks.length) {
    return '<div class="week-chip-empty">Carregue um PDF</div>';
  }

  return weeks
    .map((w) => {
      const isActive = w === activeWeek;
      return `
        <button 
          class="week-chip ${isActive ? 'week-chip-active' : ''}"
          data-action="selectWeek"
          data-week="${w}"
          aria-pressed="${isActive}"
        >
          Semana ${w}
        </button>
      `;
    })
    .join('');
}

function renderMainContent(state) {
  const workout = state?.workoutOfDay;
  
  if (!workout || !workout.blocks?.length) {
    return renderEmptyState(state);
  }

  return `
    <div class="workout-container">
      <div class="workout-header">
        <h2 class="workout-title">Treino • ${formatDay(state?.currentDay)}</h2>
        ${workout.warnings?.length ? `
          <div class="workout-warnings">
            <span class="warning-badge">⚠️ ${workout.warnings.length} avisos</span>
          </div>
        ` : ''}
      </div>

      ${workout.blocks.map((block, idx) => renderWorkoutBlock(block, idx)).join('')}
    </div>
  `;
}

function renderEmptyState(state) {
  const hasWeeks = state?.totalWeeks > 0;
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
      <h2>Sem treino para ${day}</h2>
      <p>Não há treino programado para este dia</p>
    </div>
  `;
}

function renderWorkoutBlock(block, index) {
  const lines = block.lines || [];
  
  return `
    <div class="workout-block">
      ${lines.map((line, i) => renderWorkoutLine(line, i)).join('')}
    </div>
  `;
}

function renderWorkoutLine(line, index) {
  const text = escapeHtml(line.text || '');
  const load = line.loadCalculation;
  const hasLoad = load && load.calculated && load.displayText;
  const isWarning = load?.warnings?.length > 0;

  return `
    <div class="workout-line">
      <div class="exercise-text">${text}</div>
      ${hasLoad ? `
        <div class="load-calc ${isWarning ? 'load-warning' : ''}">
          → ${escapeHtml(load.displayText)}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderPrsModal(prs = {}) {
  const entries = Object.entries(prs).sort((a, b) => a[0].localeCompare(b[0]));

  return `
    <div class="modal-overlay" id="modal-prs">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">🎯 Personal Records</h2>
          <button class="modal-close" data-action="closeModal">✕</button>
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
            <button class="btn-secondary" data-action="exportPrs">
              💾 Exportar
            </button>
            <button class="btn-secondary" data-action="importPrs">
              📥 Importar
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
                  value="${value}" 
                  data-exercise="${escapeHtml(exercise)}"
                  step="0.5"
                  min="0"
                />
                <button 
                  class="pr-remove" 
                  data-action="removePr" 
                  data-exercise="${escapeHtml(exercise)}"
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
              id="pr-new-exercise"
            />
            <input 
              type="number" 
              class="add-input" 
              placeholder="PR (kg)" 
              id="pr-new-value"
              step="0.5"
              min="0"
            />
            <button class="btn-primary" data-action="addPr">
              ➕ Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderSettingsModal(settings = {}) {
  return `
    <div class="modal-overlay" id="modal-settings">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">⚙️ Configurações</h2>
          <button class="modal-close" data-action="closeModal">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="settings-group">
            <label class="settings-label">
              <input 
                type="checkbox" 
                id="setting-showLbs" 
                ${settings.showLbsConversion ? 'checked' : ''}
              />
              <span>Mostrar conversão lbs → kg</span>
            </label>

            <label class="settings-label">
              <input 
                type="checkbox" 
                id="setting-showEmojis" 
                ${settings.showEmojis !== false ? 'checked' : ''}
              />
              <span>Mostrar emojis</span>
            </label>

            <label class="settings-label">
              <input 
                type="checkbox" 
                id="setting-showObjectives" 
                ${settings.showObjectivesInWods !== false ? 'checked' : ''}
              />
              <span>Mostrar objetivos nos WODs</span>
            </label>
          </div>

          <div class="settings-actions">
            <button class="btn-primary" data-action="saveSettings">
              💾 Salvar
            </button>
            <button class="btn-secondary" data-action="clearAll">
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
  div.textContent = text;
  return div.innerHTML;
}
