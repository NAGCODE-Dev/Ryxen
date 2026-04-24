import { summarizeWorkoutForDisplay } from '../../workoutMetadataSummary.js';

export function renderAthleteImportModal(state = {}, helpers = {}) {
  const { escapeHtml } = helpers;
  const platformVariant = helpers?.platformVariant === 'native' ? 'native' : 'web';
  const nativeOverlayClass = platformVariant === 'native' ? 'modal-overlay-native' : '';
  const nativeContainerClass = platformVariant === 'native' ? 'modal-container-nativeSheet' : '';
  const importStatus = state?.__ui?.importStatus || {};
  const currentWorkout = state?.workout?.blocks?.length ? state.workout : state?.workoutOfDay;
  const hasCurrentWorkout = !!currentWorkout?.blocks?.length;
  const metadata = summarizeWorkoutForDisplay(currentWorkout);
  const review = importStatus?.review || null;
  const importSteps = [
    { key: 'selected', label: 'Selecionado' },
    { key: 'read', label: 'Lendo' },
    { key: 'organize', label: 'Organizando' },
    { key: 'save', label: 'Salvo' },
  ];
  const activeStepIndex = importSteps.findIndex((item) => item.key === importStatus?.step);
  const importBusy = !!importStatus?.active;

  return `
    <div class="modal-overlay ${nativeOverlayClass} isOpen">
      <div class="modal-container ${nativeContainerClass}">
        <div class="modal-header">
          <div class="modal-titleGroup">
            <span class="modal-kicker">Importação</span>
            <h2 class="modal-title">Adicionar treino</h2>
          </div>
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
          ${review ? `
            <div class="import-reviewCard">
              <div class="import-reviewHead">
                <strong>Preview da importação</strong>
                <span>${escapeHtml((review.weekNumbers || []).join(', ') || 'Semanas detectadas')}</span>
              </div>
              <div class="today-metaChips">
                <span class="today-metaChip">${escapeHtml(`${review.weeksCount || 0} semana(s)`)}</span>
                <span class="today-metaChip">${escapeHtml(`${review.totalDays || 0} dia(s)`)}</span>
                <span class="today-metaChip">${escapeHtml(`${review.totalBlocks || 0} bloco(s)`)}</span>
                ${review.source ? `<span class="today-metaChip">${escapeHtml(review.source)}</span>` : ''}
              </div>
              <div class="import-reviewList">
                ${(review.days || []).map((day) => `
                  <div class="import-reviewItem">
                    <div class="import-reviewItemHead">
                      <strong>${escapeHtml(day.day || 'Dia')}</strong>
                      ${day.weekNumber ? `<span>Semana ${escapeHtml(day.weekNumber)}</span>` : ''}
                    </div>
                    ${day.periods?.length || day.blockTypes?.length ? `
                      <div class="today-metaChips">
                        ${(day.periods || []).map((period) => `<span class="today-metaChip">${escapeHtml(period)}</span>`).join('')}
                        ${(day.blockTypes || []).map((type) => `<span class="today-metaChip">${escapeHtml(type)}</span>`).join('')}
                      </div>
                    ` : ''}
                    ${day.intervalSummary ? `<p class="import-reviewText">Intervalos: ${escapeHtml(day.intervalSummary)}</p>` : ''}
                    ${day.goal ? `<p class="import-reviewText">Objetivo: ${escapeHtml(day.goal)}</p>` : ''}
                    ${day.movements?.length ? `<p class="import-reviewText">Movimentos: ${escapeHtml(day.movements.join(', '))}</p>` : ''}
                  </div>
                `).join('')}
              </div>
              ${review.canEditText ? `
                <div class="import-reviewEditor">
                  <div class="import-reviewItemHead">
                    <strong>Revisão ativa</strong>
                    <span>Texto que o parser vai ler</span>
                  </div>
                  ${review.reviewHelp ? `<p class="import-reviewText">${escapeHtml(review.reviewHelp)}</p>` : ''}
                  <textarea class="add-input import-reviewTextarea" id="ui-importReviewText" rows="10" spellcheck="false">${escapeHtml(review.reviewText || '')}</textarea>
                </div>
              ` : ''}
              <div class="page-actions">
                ${review.canEditText ? '<button class="btn-secondary" data-action="import:reparse" type="button">Reprocessar preview</button>' : ''}
                <button class="btn-primary" data-action="import:confirm" type="button">Salvar importação</button>
                <button class="btn-secondary" data-action="import:cancel-review" type="button">Descartar preview</button>
              </div>
            </div>
          ` : `
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
          `}
        </div>
      </div>
    </div>
  `;
}
