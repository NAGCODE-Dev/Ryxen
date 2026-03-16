import { summarizeDraft } from '../../app/importDraft.js';

export function renderModals(state, helpers) {
  const { renderAuthModal } = helpers;
  const modal = state?.__ui?.modal || null;
  const prs = state?.prs || {};
  const settings = state?.__ui?.settings || {};
  const authMode = state?.__ui?.authMode || 'signin';

  if (modal === 'prs') return renderPrsModal(prs);
  if (modal === 'settings') return renderSettingsModal(settings);
  if (modal === 'import') return renderImportModal(state?.__ui?.importFlow || {});
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

export function renderImportModal(importFlow = {}) {
  const review = importFlow?.lastReview || null;
  const hasReview = review && typeof review === 'object';
  const draft = importFlow?.draft || null;
  const hasDraft = draft && Array.isArray(draft?.weeks) && draft.weeks.length > 0;
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
            <p class="account-hint">Envie PDF, planilha, imagem ou vídeo. O app lê o arquivo, organiza os blocos e usa seus registros salvos para sugerir cargas quando fizer sentido.</p>
          </div>
          ${importFlow?.isProcessing ? `
            <div class="reset-codePreview">
              <strong>Processando arquivo...</strong>
              <p class="account-hint">Estamos lendo o conteúdo e preparando uma revisão antes do treino aparecer.</p>
            </div>
          ` : ''}
          ${importFlow?.lastError ? `
            <div class="reset-codePreview">
              <strong>Importação não concluída</strong>
              <p class="account-hint">${escapeHtml(importFlow.lastError)}</p>
            </div>
          ` : ''}
          ${hasReview ? `
            <div class="reset-codePreview">
              <strong>${hasDraft ? 'Revisão antes de salvar' : 'Última importação'}</strong>
              <p class="account-hint">${escapeHtml(review.summary || '')}</p>
              <div class="coach-pillRow">
                <span class="coach-pill">Origem: ${escapeHtml(review.sourceLabel || review.source || 'arquivo')}</span>
                <span class="coach-pill">Confiança: ${escapeHtml(review.confidenceLabel || 'média')}</span>
                <span class="coach-pill">${escapeHtml(String(review.weekCount || 0))} semana(s)</span>
              </div>
              ${(review.warnings || []).length ? `<p class="account-hint">${escapeHtml(review.warnings.join(' • '))}</p>` : ''}
            </div>
          ` : ''}
          ${hasDraft ? `
            <div class="import-reviewEditor">
              <p class="account-hint">Revise o dia, ajuste o texto e apague as linhas que não devem entrar antes de salvar.</p>
              ${draft.weeks.map((week, weekIndex) => `
                <section class="import-reviewWeek">
                  <div class="import-reviewWeekHead">
                    <strong>Semana ${Number(week.weekNumber || weekIndex + 1)}</strong>
                    <span class="account-hint">${Array.isArray(week.workouts) ? week.workouts.length : 0} treino(s) detectado(s)</span>
                  </div>
                  <div class="import-reviewWorkoutList">
                    ${(week.workouts || []).map((workout, workoutIndex) => `
                      <article class="import-reviewWorkout">
                        <label class="settings-label">
                          <input
                            type="checkbox"
                            data-import-enabled="1"
                            data-week-index="${weekIndex}"
                            data-workout-index="${workoutIndex}"
                            ${workout.enabled !== false ? 'checked' : ''}
                          />
                          <span>Usar este treino</span>
                        </label>
                        <input
                          class="add-input"
                          type="text"
                          data-import-day="1"
                          data-week-index="${weekIndex}"
                          data-workout-index="${workoutIndex}"
                          value="${escapeAttribute(workout.day || '')}"
                          placeholder="Dia do treino"
                        />
                        <div class="account-hint">Linhas ativas: ${(() => {
                          const summary = summarizeDraft(workout);
                          return `${summary.enabled}/${summary.total}`;
                        })()}</div>
                        <div class="import-reviewLines">
                          ${(Array.isArray(workout.lines) ? workout.lines : []).map((line, lineIndex) => `
                            <label class="import-reviewLine ${line.kind === 'block' ? 'isBlock' : ''}">
                              <input
                                type="checkbox"
                                data-import-line-enabled="1"
                                data-week-index="${weekIndex}"
                                data-workout-index="${workoutIndex}"
                                data-line-index="${lineIndex}"
                                ${line.enabled !== false ? 'checked' : ''}
                              />
                              <input
                                class="add-input"
                                type="text"
                                data-import-line-text="1"
                                data-week-index="${weekIndex}"
                                data-workout-index="${workoutIndex}"
                                data-line-index="${lineIndex}"
                                value="${escapeAttribute(line.text || '')}"
                                placeholder="${line.kind === 'block' ? 'Cabeçalho do bloco' : 'Linha do treino'}"
                              />
                            </label>
                          `).join('')}
                        </div>
                      </article>
                    `).join('')}
                  </div>
                </section>
              `).join('')}
              <div class="page-actions">
                <button class="btn-primary" data-action="import:review-apply" type="button">Salvar treino</button>
                <button class="btn-secondary" data-action="import:review-discard" type="button">Descartar revisão</button>
              </div>
            </div>
          ` : ''}
          ${!hasDraft ? `
          <div class="coach-grid">
            <button class="quick-action quick-action-modal" data-action="pdf:pick" type="button">
              <span class="quick-actionIcon">PDF</span>
              <span class="quick-actionLabel">PDF do treino</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="media:pick" type="button">
              <span class="quick-actionIcon">XLS</span>
              <span class="quick-actionLabel">Excel, ODS, foto ou vídeo</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="workout:import" type="button">
              <span class="quick-actionIcon">JSON</span>
              <span class="quick-actionLabel">Treino salvo</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="workout:export" type="button">
              <span class="quick-actionIcon">EXP</span>
              <span class="quick-actionLabel">Exportar treino atual</span>
            </button>
          </div>
          ` : ''}
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
          <h2 class="modal-title">Registros</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body">
          <div class="auth-intro">
            <div class="section-kicker">Desempenho</div>
            <p class="account-hint">Use este espaço para manter suas referências de carga. Outros tipos de marca continuam aparecendo no Perfil junto com benchmarks e histórico.</p>
          </div>
          <div class="pr-search">
            <input
              type="text"
              class="search-input"
              placeholder="Buscar exercício"
              id="ui-prsSearch"
            />
          </div>

          <div class="pr-actions">
            <button class="btn-secondary" data-action="prs:export" type="button">
              Exportar
            </button>

            <button class="btn-secondary" data-action="prs:import-file" type="button">
              Importar arquivo
            </button>

            <button class="btn-secondary" data-action="prs:import" type="button">
              Colar JSON
            </button>
          </div>

          <div class="pr-list" id="ui-prsTable">
            ${entries.length === 0 ? `
              <div class="empty-state-small">
                <p>Nenhum registro de carga ainda</p>
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
              placeholder="Carga de referência (kg)"
              id="ui-prsNewValue"
              step="0.5"
              min="0"
            />
            <button class="btn-primary" data-action="prs:add" type="button">
              Adicionar
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
            <button class="btn-secondary" data-action="app:reset-local" type="button">
              Resetar app
            </button>
            <a class="btn-secondary" href="./privacy.html" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">
              🔐 Privacidade
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
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
