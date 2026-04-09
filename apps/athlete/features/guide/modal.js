import { renderNyxIllustration } from './nyxIllustrations.js';

const GUIDE_STEPS = [
  {
    pose: 'welcome',
    kicker: 'Guia opcional',
    title: 'Quer um tour rápido?',
    lead: 'Eu te mostro o essencial do Ryxen sem atrapalhar seu começo.',
    note: 'Você pode pular isso quando quiser.',
    chips: ['Hoje', 'Evolução', 'Conta'],
    primaryLabel: 'Começar',
    primaryAction: 'modal:open',
    primaryModal: 'nyx-guide',
    primaryGuideStep: 1,
    secondaryLabel: 'Pular',
    secondaryAction: 'modal:close',
    surfaceTitle: 'Tudo começa por aqui.',
    surfaceText: 'Nyx aparece só em momentos estratégicos, como onboarding leve e empty states importantes.',
    tiles: [
      { label: 'Tom', value: 'Calmo' },
      { label: 'Uso', value: 'Opcional' },
      { label: 'Ritmo', value: 'Sem atrito' },
    ],
  },
  {
    pose: 'present',
    kicker: 'Hoje',
    title: 'Aqui você entra no que importa.',
    lead: 'Treino do dia, progresso e contexto da rotina ficam no mesmo fluxo.',
    note: 'Menos desvio, mais clareza no que precisa ser feito agora.',
    chips: ['Treino do dia', 'Rotina ativa', 'Contexto'],
    primaryLabel: 'Continuar',
    primaryAction: 'modal:open',
    primaryModal: 'nyx-guide',
    primaryGuideStep: 2,
    secondaryLabel: 'Pular tour',
    secondaryAction: 'modal:close',
    surfaceTitle: 'Tudo fica no mesmo eixo.',
    surfaceText: 'Quando o treino está carregado, o app já te coloca na superfície certa sem cair em painel genérico.',
    tiles: [
      { label: 'Entrada', value: 'Hoje' },
      { label: 'Leitura', value: 'Clara' },
      { label: 'Foco', value: 'Execução' },
    ],
  },
  {
    pose: 'present',
    kicker: 'Evolução',
    title: 'Sua evolução precisa ser fácil de ler.',
    lead: 'PRs, histórico e referências ficam acessíveis sem bagunça.',
    note: 'O progresso continua visível sem te fazer começar do zero toda semana.',
    chips: ['PRs', 'Histórico', 'Referências'],
    primaryLabel: 'Continuar',
    primaryAction: 'modal:open',
    primaryModal: 'nyx-guide',
    primaryGuideStep: 3,
    secondaryLabel: 'Pular tour',
    secondaryAction: 'modal:close',
    surfaceTitle: 'Leitura calma do progresso.',
    surfaceText: 'A ideia é tirar ruído, não esconder informação. Você bate o olho e entende a direção.',
    tiles: [
      { label: 'PRs', value: 'Acessíveis' },
      { label: 'Histórico', value: 'Contínuo' },
      { label: 'Leitura', value: 'Sem ruído' },
    ],
  },
  {
    pose: 'rest',
    kicker: 'Pronto',
    title: 'Agora você já sabe por onde começar.',
    lead: 'Ryxen fica no seu caminho só quando ajuda.',
    note: 'Quando precisar, o Nyx pode te mostrar de novo.',
    chips: ['Tour opcional', 'Uso real', 'Menos ruído'],
    primaryLabel: 'Entrar no app',
    primaryAction: 'modal:close',
    primaryCompleteGuide: true,
    secondaryLabel: 'Ver de novo',
    secondaryAction: 'modal:open',
    secondaryModal: 'nyx-guide',
    secondaryGuideStep: 0,
    surfaceTitle: 'Nyx te acompanha sem invadir.',
    surfaceText: 'A ideia é ter um guia silencioso, não um mascote barulhento. Premium, curto e útil.',
    tiles: [
      { label: 'Presença', value: 'Leve' },
      { label: 'Tom', value: 'Seguro' },
      { label: 'Marca', value: 'Nyx' },
    ],
  },
];

function renderProgress(step) {
  return `
    <div class="guide-progress" aria-label="Progresso do tour">
      ${GUIDE_STEPS.map((item, index) => `
        <span class="guide-progressItem ${index === step ? 'isActive' : ''}">
          ${item.kicker}
        </span>
      `).join('')}
    </div>
  `;
}

function renderSurface(step) {
  return `
    <div class="guide-surfaceCard">
      <strong>${step.surfaceTitle}</strong>
      <p>${step.surfaceText}</p>
      <div class="guide-surfaceRow">
        ${step.tiles.map((tile) => `
          <div class="guide-surfaceTile">
            <span>${tile.label}</span>
            <strong>${tile.value}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderGuideActionButton(step, kind) {
  const action = kind === 'primary' ? step.primaryAction : step.secondaryAction;
  const label = kind === 'primary' ? step.primaryLabel : step.secondaryLabel;
  const modal = kind === 'primary' ? step.primaryModal : step.secondaryModal;
  const guideStep = kind === 'primary' ? step.primaryGuideStep : step.secondaryGuideStep;
  const completeGuide = kind === 'primary' ? step.primaryCompleteGuide : step.secondaryCompleteGuide;
  const className = kind === 'primary' ? 'btn-primary' : 'btn-secondary';

  return `
    <button
      class="${className}"
      data-action="${action}"
      ${modal ? `data-modal="${modal}"` : ''}
      ${Number.isInteger(guideStep) ? `data-guide-step="${guideStep}"` : ''}
      ${completeGuide ? 'data-guide-complete="true"' : ''}
      type="button"
    >
      ${label}
    </button>
  `;
}

export function renderAthleteNyxGuideModal({ guide = {}, preferences = {} } = {}) {
  const stepIndex = Number.isInteger(Number(guide?.step))
    ? Math.min(Math.max(Number(guide.step), 0), GUIDE_STEPS.length - 1)
    : 0;
  const step = GUIDE_STEPS[stepIndex];
  const isCompleted = preferences?.nyxGuideCompleted === true;

  return `
    <div class="modal-overlay guide-overlay isOpen" id="ui-nyxGuideBackdrop">
      <div class="guide-shell" id="nyx-guide-shell" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="nyx-guide-title">
        <div class="guide-topbar">
          <div class="guide-mark">
            <span class="guide-markBadge" aria-hidden="true"></span>
            <span>Guided by Nyx</span>
          </div>
          <button class="modal-close" data-action="modal:close" type="button" aria-label="Fechar tour">✕</button>
        </div>

        <div class="guide-card">
          <div class="guide-stage">
            <div class="guide-copy">
              <div class="guide-copyBody">
                ${renderProgress(stepIndex)}
                <span class="guide-kicker">${step.kicker}</span>
                <h2 class="guide-title" id="nyx-guide-title">${step.title}</h2>
                <p class="guide-lead">${step.lead}</p>
                <div class="guide-chipRow">
                  ${step.chips.map((chip) => `<span class="guide-chip">${chip}</span>`).join('')}
                </div>
              </div>

              <p class="guide-note">${step.note}</p>
            </div>

            <div class="guide-visualPane">
              <div class="guide-visualCard" aria-hidden="true">
                ${renderNyxIllustration({ pose: step.pose })}
              </div>
              ${renderSurface(step)}
            </div>
          </div>

          <div class="guide-footer">
            <div class="guide-footerMeta">
              ${isCompleted ? 'Você já concluiu esse tour antes. Pode rever quando quiser.' : 'Nyx aparece só quando ajuda: onboarding leve, momentos vazios e novidades importantes.'}
            </div>
            <div class="guide-actions">
              ${renderGuideActionButton(step, 'secondary')}
              ${renderGuideActionButton(step, 'primary')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
