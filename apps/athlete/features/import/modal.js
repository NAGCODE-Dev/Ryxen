import { summarizeWorkoutForDisplay } from '../../workoutMetadataSummary.js';

export function renderAthleteImportModal(state = {}, helpers = {}) {
  const { escapeHtml } = helpers;
  const importStatus = state?.__ui?.importStatus || {};
  const currentWorkout = state?.workout?.blocks?.length ? state.workout : state?.workoutOfDay;
  const hasCurrentWorkout = !!currentWorkout?.blocks?.length;
  const metadata = summarizeWorkoutForDisplay(currentWorkout);
  const importSteps = [
    { key: 'selected', label: 'Selecionado' },
    { key: 'read', label: 'Lendo' },
    { key: 'organize', label: 'Organizando' },
    { key: 'save', label: 'Salvo' },
  ];
  const activeStepIndex = importSteps.findIndex((item) => item.key === importStatus?.step);
  const importBusy = !!importStatus?.active;

  return `
    <div class="modal-overlay isOpen">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Adicionar treino</h2>
          <button class="modal-close" data-action="modal:close" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>✕</button>
        </div>
        <div class="modal-body modal-body-auth">
          <div class="auth-intro">
            <div class="section-kicker">Importação</div>
            <p class="account-hint">${importBusy ? 'Estamos processando seu arquivo. Aguarde para importar outro.' : 'Escolha o tipo de arquivo.'}</p>
          </div>
          ${(importStatus?.active || importStatus?.message) ? `
            <div class="import-statusCard is-${escapeHtml(importStatus.tone || 'idle')}" id="ui-importStatus">
              <div class="import-statusHead">
                <strong>${escapeHtml(importStatus.title || 'Importando arquivo')}</strong>
                ${importStatus?.fileName ? `<span>${escapeHtml(importStatus.fileName)}</span>` : ''}
              </div>
              <div class="import-stepper" aria-hidden="true">
                ${importSteps.map((step, index) => `
                  <div class="import-step ${index <= activeStepIndex ? 'isDone' : ''} ${index === activeStepIndex ? 'isActive' : ''}">
                    <span class="import-stepDot"></span>
                    <span class="import-stepLabel">${escapeHtml(step.label)}</span>
                  </div>
                `).join('')}
              </div>
              <p>${escapeHtml(importStatus.message || 'Preparando importação...')}</p>
            </div>
          ` : ''}
          ${hasCurrentWorkout ? `
            <div class="import-previewCard">
              <div class="import-previewHead">
                <strong>Treino atual</strong>
                ${currentWorkout?.day ? `<span>${escapeHtml(currentWorkout.day)}</span>` : ''}
              </div>
              <div class="import-previewBody">
                <strong class="import-previewTitle">${escapeHtml(metadata.primaryTitle || 'Treino carregado')}</strong>
                ${metadata.periods.length || metadata.blockTypes.length ? `
                  <div class="today-metaChips">
                    ${metadata.periods.map((period) => `<span class="today-metaChip">${escapeHtml(period)}</span>`).join('')}
                    ${metadata.blockTypes.map((type) => `<span class="today-metaChip">${escapeHtml(type)}</span>`).join('')}
                  </div>
                ` : ''}
                ${metadata.highlights.length ? `
                  <div class="import-previewList">
                    ${metadata.highlights.map((item) => `<span class="import-previewItem">${escapeHtml(item)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          <div class="coach-grid">
            <button class="quick-action quick-action-modal" data-action="pdf:pick" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
              <span class="quick-actionIcon">PDF</span>
              <span class="quick-actionLabel">Planilha em PDF</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="media:pick" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
              <span class="quick-actionIcon">ARQ</span>
              <span class="quick-actionLabel">Imagem, vídeo, planilha ou texto</span>
            </button>
            <button class="quick-action quick-action-modal" data-action="workout:import" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
              <span class="quick-actionIcon">JSON</span>
              <span class="quick-actionLabel">Arquivo salvo</span>
            </button>
            ${hasCurrentWorkout ? `
              <button class="quick-action quick-action-modal" data-action="workout:export" type="button" ${importBusy ? 'disabled aria-disabled="true"' : ''}>
                <span class="quick-actionIcon">EXP</span>
                <span class="quick-actionLabel">Exportar treino atual</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}
