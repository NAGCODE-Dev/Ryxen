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
          <div class="header-topline">
            <div class="header-badge">CrossApp Athlete</div>
            <div class="header-account" id="ui-headerAccount"></div>
          </div>
          <h1 class="app-title">Treino do Dia</h1>
          <p class="app-subtitle" id="ui-subtitle">Carregando...</p>

          <div class="day-controls">
            <button class="btn-secondary day-autoBtn" data-action="day:auto" type="button">Auto</button>
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

      <!-- MODALS -->
      <div id="ui-modals"></div>

      <div class="bottom-tools">
        <button class="quick-action quick-action-primary" data-action="pdf:pick" type="button">
          <span class="quick-actionIcon">PDF</span>
          <span class="quick-actionLabel">Importar PDF</span>
        </button>
        <button class="quick-action" data-action="media:pick" type="button">
          <span class="quick-actionIcon">OCR</span>
          <span class="quick-actionLabel">Foto ou vídeo</span>
        </button>
        <button class="quick-action" data-action="workout:import" type="button">
          <span class="quick-actionIcon">JSON</span>
          <span class="quick-actionLabel">Importar</span>
        </button>
        <button class="quick-action" data-action="workout:export" type="button">
          <span class="quick-actionIcon">EXP</span>
          <span class="quick-actionLabel">Exportar</span>
        </button>
      </div>

      <!-- BOTTOM NAV -->
      <nav class="bottom-nav">
        <button class="nav-btn" data-action="workout:copy" type="button">
          <span class="nav-icon">⎘</span>
          <span class="nav-label">Copiar</span>
        </button>

        <button class="nav-btn" data-action="modal:open" data-modal="prs" type="button">
          <span class="nav-icon">PR</span>
          <span class="nav-label">PRs</span>
        </button>

        <button class="nav-btn nav-btn-primary" data-action="wod:mode" type="button">
          <span class="nav-icon">▶</span>
          <span class="nav-label">Treino</span>
        </button>

        <button class="nav-btn" data-action="modal:open" data-modal="settings" type="button">
          <span class="nav-icon">⚙</span>
          <span class="nav-label">Config</span>
        </button>

        <button class="nav-btn" data-action="modal:open" data-modal="auth" type="button">
          <span class="nav-icon">ID</span>
          <span class="nav-label">Conta</span>
        </button>
      </nav>
    </div>
  `;
}

export function renderAll(state = {}) {
  const subtitle = formatSubtitle(state);
  const headerAccountHtml = renderHeaderAccount(state);
  const weekChipsHtml = renderWeekChips(state);
  const mainHtml = renderMainContent(state);
  const modalsHtml = renderModals(state);
  
  return {
    subtitle,
    headerAccountHtml,
    weekChipsHtml,
    mainHtml,
    modalsHtml,
  };
}

function renderModals(state) {
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};
  const authMode = state?.__ui?.authMode || 'signin';

  if (modal === 'prs') return renderPrsModal(prs);
  if (modal === 'settings') return renderSettingsModal(settings);
  if (modal === 'auth') return renderAuthModal({
    auth: {
      ...(state?.__ui?.auth || {}),
      passwordReset: state?.__ui?.passwordReset || {},
      admin: state?.__ui?.admin || {},
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
  const workout = state?.workout ?? state?.workoutOfDay;
  const accessBanner = renderAthleteAccessBanner(state);
  if (!workout || !workout.blocks?.length) {
    return `${accessBanner}${renderEmptyState(state)}`;
  }

  const ui = state?.__ui || {};
  const trainingMode = !!ui.trainingMode;
  const progress = ui.progress || { doneCount: 0, totalCount: 0 };

  return `
    <div class="workout-container">
      ${accessBanner}
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
  
  const rawText = typeof line === 'string' ? line : (line?.raw || line?.text || '');
  const display = typeof line === 'object' ? (line.calculated ?? '') : '';
  const hasLoad = !!String(display).trim();
  const isWarning = !!(typeof line === 'object' && line.hasWarning);
  const isHeader = !!(typeof line === 'object' && line.isHeader);
  const isRest = !!(typeof line === 'object' && line.isRest);
  
  const text = escapeHtml(rawText);
  
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
  
  if (!trainingMode) {
    return `
      <div class="workout-line" data-line-id="${escapeHtml(lineId)}">
        <div class="exercise-text">${text}</div>
        ${loadHtml}
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
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const admin = auth?.admin || {};
  const coachPortal = auth?.coachPortal || {};

  if (isAuthenticated) {
    const isAdmin = !!profile?.is_admin || !!profile?.isAdmin;
    const overview = admin?.overview || null;
    const entitlements = coachPortal?.entitlements || [];
    const canCoachManage = entitlements.includes('coach_portal');
    const canAthleteUseApp = entitlements.includes('athlete_app');
    const subscription = coachPortal?.subscription || null;
    const gyms = coachPortal?.gyms || [];
    const benchmarks = coachPortal?.benchmarks || [];
    const feed = coachPortal?.feed || [];
    const gymAccess = coachPortal?.gymAccess || [];
    const planName = subscription?.plan || subscription?.plan_id || 'free';
    const planStatus = subscription?.status || 'inactive';
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
                <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
                <div class="account-email">${escapeHtml(profile.email || '')}</div>
              </div>
              <div class="account-planCard">
                <span class="account-planLabel">Plano Coach</span>
                <strong class="account-planValue">${escapeHtml(planName)}</strong>
                <span class="account-planMeta">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</span>
              </div>
            </div>

            <div class="account-summaryGrid">
              <div class="summary-tile">
                <span class="summary-label">Coach</span>
                <strong class="summary-value">${canCoachManage ? 'Liberado' : 'Bloqueado'}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Atletas</span>
                <strong class="summary-value">${canAthleteUseApp ? 'Com acesso' : 'Limitados'}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Gyms</span>
                <strong class="summary-value">${gyms.length}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Treinos</span>
                <strong class="summary-value">${feed.length}</strong>
              </div>
            </div>

            <div class="settings-actions account-actions">
              <button class="btn-secondary" data-action="auth:sync-push" type="button">☁️ Enviar sync</button>
              <button class="btn-secondary" data-action="auth:sync-pull" type="button">📥 Baixar sync</button>
              <button class="btn-secondary" data-action="auth:refresh" type="button">🔄 Atualizar sessão</button>
              <a class="btn-secondary" href="/coach/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Coach Portal</a>
            </div>

            <section class="account-section coach-portal">
              <div class="account-sectionHead">
                <div>
                  <div class="section-kicker">Coach Workspace</div>
                  <strong>Gestão de box, atletas e programação</strong>
                </div>
                <button class="btn-secondary" data-action="coach:refresh" type="button">Atualizar</button>
              </div>

              <div class="admin-stats">
                <div class="admin-statCard">
                  <span class="admin-statLabel">Plano</span>
                  <span class="admin-statValue">${escapeHtml(planName)}</span>
                </div>
                <div class="admin-statCard">
                  <span class="admin-statLabel">Status</span>
                  <span class="admin-statValue">${escapeHtml(planStatus)}</span>
                </div>
              </div>

              <div class="coach-pillRow">
                <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Coach liberado' : 'Coach bloqueado'}</span>
                <span class="coach-pill ${canAthleteUseApp ? 'isGood' : 'isWarn'}">${canAthleteUseApp ? 'Atletas com acesso' : 'Atletas limitados'}</span>
              </div>

              ${!canCoachManage ? `
                <div class="reset-codePreview">
                  Assinatura inativa. Renove para continuar gerenciando box, atletas e treinos.
                </div>
                <div class="settings-actions coach-billingActions">
                  <button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>
                  <button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>
                </div>
              ` : ''}

              <div class="coach-grid">
                <div class="coach-card">
                  <h3 class="coach-cardTitle">Gyms</h3>
                  <div class="coach-list">
                    ${gyms.length ? gyms.map((gym) => `
                      <button class="coach-listItem" data-action="coach:select-gym" data-gym-id="${gym.id}" type="button">
                        <strong>${escapeHtml(gym.name)}</strong>
                        <span>${escapeHtml(gym.role)} • ${gym.access?.warning ? escapeHtml(gym.access.warning) : 'ok'}</span>
                      </button>
                    `).join('') : '<p class="account-hint">Nenhum gym criado ainda.</p>'}
                  </div>
                  <div class="auth-form">
                    <input class="add-input" id="coach-gym-name" type="text" placeholder="Nome do gym" />
                    <input class="add-input" id="coach-gym-slug" type="text" placeholder="slug-do-gym" />
                    <button class="btn-secondary" data-action="coach:create-gym" type="button">Criar gym</button>
                  </div>
                </div>

                <div class="coach-card">
                  <h3 class="coach-cardTitle">Membros</h3>
                  <div class="coach-list">
                    ${(coachPortal?.members || []).length ? (coachPortal.members || []).map((member) => `
                      <div class="coach-listItem static">
                        <strong>${escapeHtml(member.name || member.email || member.pending_email || 'Convidado')}</strong>
                        <span>${escapeHtml(member.role)} • ${escapeHtml(member.status)}</span>
                      </div>
                    `).join('') : '<p class="account-hint">Selecione um gym para ver membros.</p>'}
                  </div>
                  <div class="auth-form">
                    <input class="add-input" id="coach-member-email" type="email" placeholder="Email do membro" />
                    <select class="add-input" id="coach-member-role">
                      <option value="athlete">athlete</option>
                      <option value="coach">coach</option>
                    </select>
                    <button class="btn-secondary" data-action="coach:add-member" type="button">Adicionar membro</button>
                  </div>
                </div>

                <div class="coach-card coach-cardWide">
                  <h3 class="coach-cardTitle">Publicar treino</h3>
                  <div class="auth-form">
                    <input class="add-input" id="coach-workout-title" type="text" placeholder="Título do treino" />
                    <input class="add-input" id="coach-workout-date" type="date" />
                    <input class="add-input" id="coach-workout-benchmark" type="text" placeholder="benchmark slug opcional (ex: fran)" />
                    <textarea class="add-input coach-textarea" id="coach-workout-lines" placeholder="Uma linha por exercício ou bloco&#10;BACK SQUAT&#10;5x5 @80"></textarea>
                    <button class="btn-primary" data-action="coach:publish-workout" type="button">Publicar treino</button>
                  </div>
                </div>

                <div class="coach-card">
                  <h3 class="coach-cardTitle">Benchmark Library</h3>
                  <div class="admin-toolbar">
                    <input class="add-input" id="coach-benchmark-query" type="text" placeholder="Buscar benchmark" value="${escapeHtml(coachPortal?.benchmarkQuery || '')}" />
                    <button class="btn-secondary" data-action="benchmarks:refresh" type="button">Buscar</button>
                  </div>
                  <div class="coach-tabs">
                    <button class="btn-secondary" data-action="benchmarks:filter" data-category="" type="button">Todos</button>
                    <button class="btn-secondary" data-action="benchmarks:filter" data-category="girls" type="button">Girls</button>
                    <button class="btn-secondary" data-action="benchmarks:filter" data-category="hero" type="button">Hero</button>
                    <button class="btn-secondary" data-action="benchmarks:filter" data-category="open" type="button">Open</button>
                  </div>
                  <div class="coach-list">
                    ${benchmarks.length ? benchmarks.map((item) => `
                      <div class="coach-listItem static">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.category)}${item.year ? ` • ${item.year}` : ''}${item.slug ? ` • ${escapeHtml(item.slug)}` : ''}</span>
                      </div>
                    `).join('') : '<p class="account-hint">Nenhum benchmark carregado.</p>'}
                  </div>
                </div>

                <div class="coach-card">
                  <h3 class="coach-cardTitle">Feed do app</h3>
                  <div class="coach-list">
                    ${feed.length ? feed.map((item) => `
                      <div class="coach-listItem static">
                        <strong>${escapeHtml(item.title)}</strong>
                        <span>${escapeHtml(item.gym_name || '')}${item.benchmark?.name ? ` • ${escapeHtml(item.benchmark.name)}` : ''}</span>
                      </div>
                    `).join('') : '<p class="account-hint">Sem treinos publicados ainda.</p>'}
                  </div>
                </div>
              </div>

              ${gymAccess.length ? `
                <div class="coach-card coach-cardWide">
                  <h3 class="coach-cardTitle">Acesso dos gyms</h3>
                  <div class="coach-list">
                    ${gymAccess.map((item) => `
                      <div class="coach-listItem static">
                        <strong>${escapeHtml(item.gymName || `Gym ${item.gymId}`)}</strong>
                        <span>${escapeHtml(item.role)} • ${item.warning ? escapeHtml(item.warning) : 'Acesso ativo'}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </section>

            ${isAdmin ? `
              <section class="account-section account-section-admin">
                <div class="account-sectionHead">
                  <div>
                    <div class="section-kicker">Admin</div>
                    <strong>Painel administrativo</strong>
                  </div>
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
                        </div>
                        <div class="admin-userMeta">${user.is_admin ? 'Admin' : 'User'}</div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <p class="account-hint">Carregue os dados do painel para ver os últimos usuários.</p>
                `}
              </section>
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

          <form class="auth-form" id="ui-authForm">
            <input class="add-input" id="auth-name" type="text" placeholder="Seu nome" ${isSignup ? '' : 'style="display:none"'} />
            <input class="add-input" id="auth-email" type="email" placeholder="Seu email" autocomplete="email" />
            <input class="add-input" id="auth-password" type="password" placeholder="Sua senha" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
            <button class="btn-primary" data-action="auth:submit" data-mode="${escapeHtml(authMode)}" type="button">
              ${isSignup ? 'Criar conta' : 'Entrar'}
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
                  <p class="account-hint">Em ambiente local, o código pode aparecer aqui. Em produção, ele deve ser enviado por email${reset?.supportEmail ? ` via ${escapeHtml(reset.supportEmail)}` : ''}.</p>
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
