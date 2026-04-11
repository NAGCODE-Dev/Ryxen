export function renderAccountAccessSection(renderPageFold, view) {
  const {
    isBusy = false,
    coachPortalStatus = 'idle',
    isSummaryLoading = false,
    profileName = '',
    profileEmail = '',
    planName = '',
    planStatus = '',
    athleteBenefitsLabel = '',
    athleteBenefitSource = '',
    resultsLogged = 0,
    importUsage,
    escapeHtml,
  } = view;

  return renderPageFold({
    title: 'Seu acesso',
    subtitle: 'Conta, plano e uso em uma leitura só.',
    guideTarget: 'account-access',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Perfil</strong>
        <span>${isBusy ? 'Carregando perfil...' : `${escapeHtml(profileName || 'Sem nome')} • ${escapeHtml(profileEmail || '')}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Plano</strong>
        <span>${isBusy || coachPortalStatus === 'loading' ? 'Carregando plano...' : `${escapeHtml(planName)} • ${escapeHtml(planStatus)}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Acesso do atleta</strong>
        <span>${isSummaryLoading ? 'Carregando acesso...' : `${escapeHtml(athleteBenefitsLabel)} • ${escapeHtml(athleteBenefitSource)}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Uso do app</strong>
        <span>${isSummaryLoading ? 'Buscando indicadores...' : `${Number(resultsLogged || 0)} resultado(s) • ${importUsage.unlimited ? 'imports livres' : `${importUsage.remaining} restante(s)`}`}</span>
      </div>
    </div>
    <div class="page-actions">
      <button class="btn-secondary" data-action="account:view:set" data-account-view="preferences" type="button">Preferências</button>
      <button class="btn-secondary" data-action="account:view:set" data-account-view="data" type="button">Dados</button>
    </div>
    `,
  });
}

export function renderAccountCoachPortalSection(renderPageFold, view) {
  const {
    canCoachManage = false,
    gymsCount = 0,
    renewAt = null,
    canUseDeveloperTools = false,
    formatDateShort,
    escapeHtml,
  } = view;

  return renderPageFold({
    title: 'Coach Portal',
    subtitle: 'Gestão do box, quando fizer sentido ativar.',
    guideTarget: 'account-coach',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Status do portal</strong>
        <span>${canCoachManage ? `Liberado • ${gymsCount} gym(s) visível(is)` : 'Indisponível no plano atual'}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Renovação</strong>
        <span>${renewAt ? `Plano renova em ${escapeHtml(formatDateShort(renewAt))}` : 'Sem data de renovação disponível.'}</span>
      </div>
    </div>
    <div class="page-actions">
      ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Ver plano</button>' : ''}
      ${canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
      ${canCoachManage ? '<a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>' : '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Comparar planos</a>'}
    </div>
    `,
  });
}

export function renderAccountActivitySection(renderPageFold, view) {
  const {
    isResultsLoading = false,
    isWorkoutsLoading = false,
    athleteResultsCount = 0,
    athleteWorkoutsCount = 0,
  } = view;

  return renderPageFold({
    title: 'Atividade recente',
    subtitle: 'O que já apareceu no seu fluxo recente.',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Resultados recentes</strong>
        <span>${isResultsLoading ? 'Carregando resultados...' : athleteResultsCount ? `${athleteResultsCount} registro(s) recente(s).` : 'Nenhum resultado registrado ainda.'}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Treinos do box</strong>
        <span>${isWorkoutsLoading ? 'Carregando treinos...' : athleteWorkoutsCount ? `${athleteWorkoutsCount} treino(s) recente(s) liberado(s).` : 'Nenhum treino recente liberado para sua conta.'}</span>
      </div>
    </div>
    `,
  });
}

function renderOptionCard({
  name,
  key,
  value,
  checked = false,
  eyebrow = '',
  title,
  description,
}) {
  return `
    <label class="account-choiceCard">
      <input
        class="account-choiceInput"
        type="radio"
        name="${name}"
        value="${value}"
        data-preference-key="${key}"
        ${checked ? 'checked' : ''}
      />
      <span class="account-choiceFace">
        ${eyebrow ? `<span class="account-choiceEyebrow">${eyebrow}</span>` : ''}
        <strong>${title}</strong>
        <small>${description}</small>
      </span>
    </label>
  `;
}

function renderAccentCard({ value, checked = false, label, description, swatchClass }) {
  return `
    <label class="account-choiceCard account-choiceCard-tone">
      <input
        class="account-choiceInput"
        type="radio"
        name="setting-accentTone"
        value="${value}"
        data-preference-key="accentTone"
        ${checked ? 'checked' : ''}
      />
      <span class="account-toneFace">
        <span class="account-toneSwatch ${swatchClass}" aria-hidden="true"></span>
        <strong>${label}</strong>
        <small>${description}</small>
      </span>
    </label>
  `;
}

function renderSwitchRow({
  id,
  key,
  checked = false,
  title,
  description,
}) {
  return `
    <label class="account-switchRow" for="${id}">
      <span class="account-switchCopy">
        <strong>${title}</strong>
        <small>${description}</small>
      </span>
      <span class="account-switchSlot">
        <input
          class="account-switchInput"
          type="checkbox"
          id="${id}"
          data-preference-key="${key}"
          ${checked ? 'checked' : ''}
        />
        <span class="account-switchControl" aria-hidden="true"></span>
      </span>
    </label>
  `;
}

export function renderAccountPreferencesSections(renderPageFold, view) {
  const {
    preferences = {},
  } = view;

  const showLbsConversion = preferences.showLbsConversion !== false;
  const showEmojis = preferences.showEmojis !== false;
  const showGoals = preferences.showGoals !== false;
  const showNyxHints = preferences.showNyxHints !== false;
  const nyxGuideCompleted = preferences.nyxGuideCompleted === true;
  const accentTone = ['blue', 'sage', 'sand', 'rose', 'teal', 'plum', 'ember'].includes(preferences.accentTone)
    ? preferences.accentTone
    : 'blue';
  const interfaceDensity = preferences.interfaceDensity === 'compact' ? 'compact' : 'comfortable';
  const reduceMotion = preferences.reduceMotion === true;
  const workoutPriority = preferences.workoutPriority === 'coach' ? 'coach' : 'uploaded';

  return `
    ${renderPageFold({
      title: 'Aparência',
      subtitle: 'Ajuste o clima visual para o jeito que você mais gosta de usar.',
      guideTarget: 'account-preferences',
      content: `
        <div class="account-settingsGrid">
          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Base visual</strong>
              <span>O Ryxen agora segue uma base escura única para manter contraste, foco e acabamento premium.</span>
            </div>
            <div class="account-choiceGrid account-choiceGrid-single">
              ${renderOptionCard({
                name: 'setting-theme',
                key: 'theme',
                value: 'dark',
                checked: true,
                eyebrow: 'Escuro',
                title: 'Noite',
                description: 'Mais foco, contraste calmo e cara premium.',
              })}
            </div>
          </div>

          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Tom de destaque</strong>
              <span>Use uma assinatura visual mais fria, orgânica ou quente.</span>
            </div>
            <div class="account-toneGrid">
              ${renderAccentCard({
                value: 'blue',
                checked: accentTone === 'blue',
                label: 'Azul',
                description: 'Clássico',
                swatchClass: 'account-toneSwatch-blue',
              })}
              ${renderAccentCard({
                value: 'sage',
                checked: accentTone === 'sage',
                label: 'Sage',
                description: 'Calmo',
                swatchClass: 'account-toneSwatch-sage',
              })}
              ${renderAccentCard({
                value: 'sand',
                checked: accentTone === 'sand',
                label: 'Sand',
                description: 'Quente',
                swatchClass: 'account-toneSwatch-sand',
              })}
              ${renderAccentCard({
                value: 'rose',
                checked: accentTone === 'rose',
                label: 'Rose',
                description: 'Suave',
                swatchClass: 'account-toneSwatch-rose',
              })}
              ${renderAccentCard({
                value: 'teal',
                checked: accentTone === 'teal',
                label: 'Teal',
                description: 'Fresco',
                swatchClass: 'account-toneSwatch-teal',
              })}
              ${renderAccentCard({
                value: 'plum',
                checked: accentTone === 'plum',
                label: 'Plum',
                description: 'Profundo',
                swatchClass: 'account-toneSwatch-plum',
              })}
              ${renderAccentCard({
                value: 'ember',
                checked: accentTone === 'ember',
                label: 'Ember',
                description: 'Enérgico',
                swatchClass: 'account-toneSwatch-ember',
              })}
            </div>
          </div>

          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Densidade e movimento</strong>
              <span>Deixe a interface mais espaçada ou mais econômica.</span>
            </div>
            <div class="account-choiceGrid">
              ${renderOptionCard({
                name: 'setting-interfaceDensity',
                key: 'interfaceDensity',
                value: 'comfortable',
                checked: interfaceDensity === 'comfortable',
                eyebrow: 'Equilibrada',
                title: 'Confortável',
                description: 'Mais respiro entre blocos e ações.',
              })}
              ${renderOptionCard({
                name: 'setting-interfaceDensity',
                key: 'interfaceDensity',
                value: 'compact',
                checked: interfaceDensity === 'compact',
                eyebrow: 'Econômica',
                title: 'Compacta',
                description: 'Mais conteúdo por dobra, sem perder leitura.',
              })}
            </div>
            <div class="account-switchStack">
              ${renderSwitchRow({
                id: 'setting-reduceMotion',
                key: 'reduceMotion',
                checked: reduceMotion,
                title: 'Reduzir movimento',
                description: 'Diminui transições e animações para uma navegação mais estável.',
              })}
            </div>
          </div>
        </div>
      `,
    })}

    ${renderPageFold({
      title: 'Treino',
      subtitle: 'Controle a forma como os blocos e prioridades aparecem para você.',
      guideTarget: 'account-preferences',
      content: `
        <div class="account-settingsGrid">
          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Fonte prioritária</strong>
              <span>Escolha o que aparece primeiro quando coach e planilha convivem.</span>
            </div>
            <div class="account-choiceGrid">
              ${renderOptionCard({
                name: 'setting-workoutPriority',
                key: 'workoutPriority',
                value: 'uploaded',
                checked: workoutPriority === 'uploaded',
                eyebrow: 'Planilha',
                title: 'Meu treino importado',
                description: 'Ideal quando você vive mais na rotina enviada por arquivo.',
              })}
              ${renderOptionCard({
                name: 'setting-workoutPriority',
                key: 'workoutPriority',
                value: 'coach',
                checked: workoutPriority === 'coach',
                eyebrow: 'Coach',
                title: 'Treino do box',
                description: 'Prioriza o que o coach acabou de publicar para a turma.',
              })}
            </div>
          </div>

          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Leitura do treino</strong>
              <span>Pequenos detalhes que deixam o dia mais fácil de bater o olho.</span>
            </div>
            <div class="account-switchStack">
              ${renderSwitchRow({
                id: 'setting-showLbsConversion',
                key: 'showLbsConversion',
                checked: showLbsConversion,
                title: 'Mostrar conversão lbs → kg',
                description: 'Ajuda a ler cargas importadas em libras sem conta mental.',
              })}
              ${renderSwitchRow({
                id: 'setting-showObjectives',
                key: 'showObjectivesInWods',
                checked: showGoals,
                title: 'Mostrar objetivos do WOD',
                description: 'Mantém a intenção do treino visível quando o bloco trouxer esse contexto.',
              })}
              ${renderSwitchRow({
                id: 'setting-showEmojis',
                key: 'showEmojis',
                checked: showEmojis,
                title: 'Mostrar emojis',
                description: 'Preserva sinais rápidos de leitura nas áreas que usam esse apoio visual.',
              })}
              ${renderSwitchRow({
                id: 'setting-showNyxHints',
                key: 'showNyxHints',
                checked: showNyxHints,
                title: 'Mostrar sugestões do Nyx',
                description: 'Deixa o guia aparecer em empty states e momentos de onboarding leve.',
              })}
            </div>
          </div>

          <p class="account-settingsFootnote">Tudo salva automaticamente. O app aplica as mudanças assim que você toca em cada opção.</p>
        </div>
      `,
    })}

    ${renderPageFold({
      title: 'Nyx',
      subtitle: 'Um guia opcional, calmo e direto para quando você quiser uma ajuda leve.',
      guideTarget: 'account-preferences',
      content: `
        <div class="account-settingsCard account-settingsCard-nyx">
          <div class="account-settingsHead">
            <strong>${nyxGuideCompleted ? 'Tour concluído' : 'Tour opcional do Nyx'}</strong>
            <span>${nyxGuideCompleted ? 'Você já viu o essencial. Se quiser, o Nyx pode te acompanhar de novo pelas áreas principais.' : 'Hoje, evolução, PRs, importação e conta em um tour curto e guiado.'}</span>
          </div>
          <div class="account-choiceFace account-choiceFace-static">
            <span class="account-choiceEyebrow">Guia premium</span>
            <strong>Tour real pelo app</strong>
            <small>Abre as áreas certas, explica o que cada uma faz e guarda seu progresso sem peso visual extra.</small>
          </div>
          <div class="page-actions">
            <button class="btn-primary" data-action="modal:open" data-modal="nyx-guide" data-guide-step="0" type="button">${nyxGuideCompleted ? 'Ver de novo' : 'Começar tour'}</button>
            <button class="btn-secondary" data-action="account:view:set" data-account-view="data" type="button">Ir para Dados</button>
          </div>
        </div>
      `,
    })}
  `;
}

export function renderAccountDataSections(renderPageFold, view) {
  const {
    profileEmail = '',
    planName = '',
    planStatus = '',
    athleteBenefitSource = '',
    importUsage = { unlimited: false, remaining: 0 },
    escapeHtml,
  } = view;

  return `
    ${renderPageFold({
      title: 'Seus dados',
      subtitle: 'Backup, restauração e o básico do que está salvo hoje.',
      guideTarget: 'account-data',
      content: `
        <div class="account-dataGrid">
          <article class="account-dataCard">
            <span class="account-dataEyebrow">Conta conectada</span>
            <strong>${escapeHtml(profileEmail || 'Sem email')}</strong>
            <small>${escapeHtml(planName || 'Livre')} • ${escapeHtml(planStatus || 'sem status')}</small>
          </article>
          <article class="account-dataCard">
            <span class="account-dataEyebrow">Origem do acesso</span>
            <strong>${escapeHtml(athleteBenefitSource || 'Conta local')}</strong>
            <small>${importUsage.unlimited ? 'Imports livres nesta conta.' : `${Number(importUsage.remaining || 0)} import(s) restante(s).`}</small>
          </article>
        </div>
        <div class="settings-actions settings-actions-grid">
          <button class="btn-secondary" data-action="backup:export" type="button">Fazer backup</button>
          <button class="btn-secondary" data-action="backup:import" type="button">Restaurar backup</button>
        </div>
      `,
    })}

    ${renderPageFold({
      title: 'Documentos e privacidade',
      subtitle: 'Acesso rápido às páginas mais importantes do produto.',
      guideTarget: 'account-data',
      content: `
        <div class="settings-actions settings-actions-grid">
          <a class="btn-secondary settings-linkBtn" href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacidade</a>
          <a class="btn-secondary settings-linkBtn" href="/terms.html" target="_blank" rel="noopener noreferrer">Termos</a>
        </div>
      `,
    })}

    ${renderPageFold({
      title: 'Limpeza local',
      subtitle: 'Use só quando quiser zerar os dados deste aparelho e começar limpo.',
      content: `
        <div class="settings-actions">
          <button class="btn-secondary btn-dangerSoft" data-action="pdf:clear" type="button">Limpar dados do app</button>
        </div>
      `,
    })}
  `;
}
