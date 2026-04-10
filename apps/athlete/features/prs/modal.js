export function renderAthletePrsModal(prs = {}, helpers = {}) {
  const { escapeHtml } = helpers;
  const entries = Object.entries(prs).sort((a, b) => a[0].localeCompare(b[0]));

  return `
    <div class="modal-overlay isOpen" id="ui-prsModalBackdrop">
      <div class="modal-container modal-container-prs">
        <div class="modal-header">
          <div class="modal-titleGroup">
            <span class="modal-kicker">Cargas</span>
            <h2 class="modal-title">Personal Records</h2>
          </div>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body">
          <div class="modal-intro modal-intro-compact">
            <p class="account-hint">Guarde suas referências de força para o app calcular melhor as cargas do treino.</p>
            <p class="account-hint">Edite quantos exercícios quiser e salve tudo de uma vez.</p>
          </div>

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

          ${entries.length > 0 ? `
            <div class="pr-batchActions">
              <button class="btn-primary pr-saveAll" data-action="prs:save-all" type="button">
                Salvar tudo
              </button>
            </div>
          ` : ''}

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
              Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
