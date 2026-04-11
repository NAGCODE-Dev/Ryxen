import { renderNyxIllustration } from './nyxIllustrations.js';
import { clampNyxGuideStep, getNyxGuideStep, getNyxGuideStepCount } from './steps.js';

function renderProgress(stepIndex) {
  const total = getNyxGuideStepCount();
  const safeStep = clampNyxGuideStep(stepIndex);
  return `
    <div class="guide-progress" aria-label="Progresso do tour">
      <span class="guide-progressLabel">Passo ${safeStep + 1} de ${total}</span>
      <div class="guide-progressDots">
        ${Array.from({ length: total }, (_, index) => `
          <span class="guide-progressDot ${index === safeStep ? 'isActive' : ''} ${index < safeStep ? 'isDone' : ''}"></span>
        `).join('')}
      </div>
    </div>
  `;
}

function renderGuideFooter(stepIndex) {
  const total = getNyxGuideStepCount();
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  return `
    <div class="guide-actions">
      ${isFirst
        ? '<button class="btn-secondary" data-action="modal:close" type="button">Pular</button>'
        : `<button class="btn-secondary" data-action="nyx:step" data-guide-step="${stepIndex - 1}" type="button">Voltar</button>`}
      ${isLast
        ? '<button class="btn-primary" data-action="modal:close" data-guide-complete="true" type="button">Entrar no app</button>'
        : `<button class="btn-primary" data-action="nyx:step" data-guide-step="${stepIndex + 1}" type="button">${isFirst ? 'Começar' : 'Continuar'}</button>`}
    </div>
  `;
}

export function renderAthleteNyxGuideModal({ guide = {}, preferences = {}, platformVariant = 'web' } = {}) {
  const stepIndex = clampNyxGuideStep(guide?.step);
  const step = getNyxGuideStep(stepIndex);
  const total = getNyxGuideStepCount();
  const isCompleted = preferences?.nyxGuideCompleted === true;
  const isNative = platformVariant === 'native';

  return `
    <div class="modal-overlay guide-overlay ${isNative ? 'guide-overlay-native modal-overlay-native' : ''} isOpen" id="ui-nyxGuideBackdrop">
      <div class="guide-shell ${isNative ? 'guide-shell-native' : ''}" id="nyx-guide-shell" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="nyx-guide-title">
        <div class="guide-topbar">
          <div class="guide-mark">
            <span class="guide-markBadge" aria-hidden="true"></span>
            <span>Nyx</span>
          </div>
          <div class="guide-topbarMeta">
            <span>${isCompleted ? 'Tour concluído' : `Passo ${stepIndex + 1}/${total}`}</span>
            <button class="modal-close" data-action="modal:close" type="button" aria-label="Fechar tour">✕</button>
          </div>
        </div>

        <div class="guide-card">
          <div class="guide-stage">
            <div class="guide-copy">
              <div class="guide-copyBody">
                ${renderProgress(stepIndex)}
                <span class="guide-kicker">${step.kicker}</span>
                <h2 class="guide-title" id="nyx-guide-title">${step.title}</h2>
                <p class="guide-lead">${step.lead}</p>
                ${Array.isArray(step.chips) && step.chips.length ? `
                  <div class="guide-chipRow">
                    ${step.chips.map((chip) => `<span class="guide-chip">${chip}</span>`).join('')}
                  </div>
                ` : ''}
              </div>

              <div class="guide-targetNote">
                <span class="guide-targetBadge">${step.targetLabel}</span>
                ${step.note ? `<p class="guide-note">${step.note}</p>` : ''}
                ${step.targetText ? `<p class="guide-targetText">${step.targetText}</p>` : ''}
              </div>
            </div>

            <div class="guide-visualPane ${isNative ? 'guide-visualPane-native' : ''}">
              <div class="guide-visualCard" aria-hidden="true">
                <div class="guide-visualHalo"></div>
                ${renderNyxIllustration({ pose: step.pose })}
              </div>
            </div>
          </div>

          <div class="guide-footer">
            <div class="guide-footerMeta">
              ${isCompleted
                ? 'Tour concluído'
                : 'Navegação guiada'}
            </div>
            ${renderGuideFooter(stepIndex)}
          </div>
        </div>
      </div>
    </div>
  `;
}
