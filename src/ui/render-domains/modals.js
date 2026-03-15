export function renderModals(state, helpers) {
  const { renderAuthModal } = helpers;
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
      admin: state?.__ui?.admin || {},
      athleteOverview: state?.__ui?.athleteOverview || {},
      coachPortal: state?.__ui?.coachPortal || {},
    },
    authMode,
  });

  return '';
}

function renderImportModal() {
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
            <p class="account-hint">Escolha a melhor origem para o treino. O app prioriza o treino do coach, mas sua planilha pode conviver e ser alternada quando fizer sentido.</p>
          </div>
          <div class="coach-grid">
            <button class="quick-action quick-action-modal" data-action="pdf:pick" type="button">
              <span class="quick-actionIcon">PDF</span>
              <span class="quick-actionLabel">Importar planilha em PDF</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="media:pick" type="button">
              <span class="quick-actionIcon">OCR</span>
              <span class="quick-actionLabel">Foto, imagem ou vídeo</span>
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
            <a class="btn-secondary" href="./privacy.html" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              🔐 Privacidade
            </a>
            <a class="btn-secondary" href="./pricing.html" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              💳 Planos
            </a>
            <a class="btn-secondary" href="./terms.html" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              📄 Termos
            </a>
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
