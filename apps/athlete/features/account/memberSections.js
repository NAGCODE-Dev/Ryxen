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
    title: 'Conta e acesso',
    subtitle: 'Status, uso e atividade.',
    guideTarget: 'account-access',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Perfil</strong>
        <span>${isBusy ? 'Carregando perfil...' : `${escapeHtml(profileName || 'Sem nome')} • ${escapeHtml(profileEmail || '')}`}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Status da conta</strong>
        <span>${isBusy || coachPortalStatus === 'loading' ? 'Carregando conta...' : `${escapeHtml(planName)} • ${escapeHtml(planStatus)}`}</span>
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
    athleteGymMemberships = 0,
    renewAt = null,
    canUseDeveloperTools = false,
    formatDateShort,
    escapeHtml,
  } = view;

  return renderPageFold({
    title: 'Coach Portal',
    subtitle: 'Status e entrada do portal.',
    guideTarget: 'account-coach',
    content: `
    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Status do portal</strong>
        <span>${canCoachManage
          ? `Disponível • ${gymsCount} gym(s) visível(is)`
          : athleteGymMemberships
            ? `Sem gestão • ${athleteGymMemberships} vínculo(s) como atleta`
            : 'Indisponível no estado atual'}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Renovação</strong>
        <span>${renewAt ? `Revisão em ${escapeHtml(formatDateShort(renewAt))}` : 'Sem data de renovação disponível.'}</span>
      </div>
    </div>
    <div class="page-actions">
      ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Abrir cobrança</button>' : ''}
      ${canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
      ${canCoachManage ? '<a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>' : '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Detalhes de acesso</a>'}
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
    subtitle: 'Resultados e treinos recentes.',
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
      subtitle: 'Visual e leitura.',
      guideTarget: 'account-preferences',
      content: `
        <div class="account-settingsGrid">
          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Base visual</strong>
              <span>Tema ativo do app.</span>
            </div>
            <div class="account-choiceGrid account-choiceGrid-single">
              ${renderOptionCard({
                name: 'setting-theme',
                key: 'theme',
                value: 'dark',
                checked: true,
                eyebrow: 'Escuro',
                title: 'Noite',
                description: 'Contraste estável.',
              })}
            </div>
          </div>

          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Tom de destaque</strong>
              <span>Cor principal do app.</span>
            </div>
            <div class="account-toneGrid">
              ${renderAccentCard({
                value: 'blue',
                checked: accentTone === 'blue',
                label: 'Azul',
                description: 'Padrão',
                swatchClass: 'account-toneSwatch-blue',
              })}
              ${renderAccentCard({
                value: 'sage',
                checked: accentTone === 'sage',
                label: 'Sage',
                description: 'Verde',
                swatchClass: 'account-toneSwatch-sage',
              })}
              ${renderAccentCard({
                value: 'sand',
                checked: accentTone === 'sand',
                label: 'Sand',
                description: 'Areia',
                swatchClass: 'account-toneSwatch-sand',
              })}
              ${renderAccentCard({
                value: 'rose',
                checked: accentTone === 'rose',
                label: 'Rose',
                description: 'Rosé',
                swatchClass: 'account-toneSwatch-rose',
              })}
              ${renderAccentCard({
                value: 'teal',
                checked: accentTone === 'teal',
                label: 'Teal',
                description: 'Teal',
                swatchClass: 'account-toneSwatch-teal',
              })}
              ${renderAccentCard({
                value: 'plum',
                checked: accentTone === 'plum',
                label: 'Plum',
                description: 'Plum',
                swatchClass: 'account-toneSwatch-plum',
              })}
              ${renderAccentCard({
                value: 'ember',
                checked: accentTone === 'ember',
                label: 'Ember',
                description: 'Âmbar',
                swatchClass: 'account-toneSwatch-ember',
              })}
            </div>
          </div>

          <div class="account-settingsCard">
            <div class="account-settingsHead">
              <strong>Densidade e movimento</strong>
              <span>Espaço e transições.</span>
            </div>
            <div class="account-choiceGrid">
              ${renderOptionCard({
                name: 'setting-interfaceDensity',
                key: 'interfaceDensity',
                value: 'comfortable',
                checked: interfaceDensity === 'comfortable',
                eyebrow: 'Equilibrada',
                title: 'Confortável',
                description: 'Mais espaço entre blocos.',
              })}
              ${renderOptionCard({
                name: 'setting-interfaceDensity',
                key: 'interfaceDensity',
                value: 'compact',
                checked: interfaceDensity === 'compact',
                eyebrow: 'Econômica',
                title: 'Compacta',
                description: 'Mais conteúdo por tela.',
              })}
            </div>
            <div class="account-switchStack">
              ${renderSwitchRow({
                id: 'setting-reduceMotion',
                key: 'reduceMotion',
                checked: reduceMotion,
                title: 'Reduzir movimento',
                description: 'Reduz animações.',
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
              <span>Opções do treino.</span>
            </div>
            <div class="account-switchStack">
              ${renderSwitchRow({
                id: 'setting-showLbsConversion',
                key: 'showLbsConversion',
                checked: showLbsConversion,
                title: 'Mostrar conversão lbs → kg',
                description: 'Converte cargas importadas.',
              })}
              ${renderSwitchRow({
                id: 'setting-showObjectives',
                key: 'showObjectivesInWods',
                checked: showGoals,
                title: 'Mostrar objetivos do WOD',
                description: 'Exibe o objetivo do bloco.',
              })}
              ${renderSwitchRow({
                id: 'setting-showEmojis',
                key: 'showEmojis',
                checked: showEmojis,
                title: 'Mostrar emojis',
                description: 'Mantém ícones do treino.',
              })}
              ${renderSwitchRow({
                id: 'setting-showNyxHints',
                key: 'showNyxHints',
                checked: showNyxHints,
                title: 'Mostrar sugestões do Nyx',
                description: 'Mostra atalhos do guia em estados vazios.',
              })}
            </div>
          </div>

          <p class="account-settingsFootnote">Salvo automaticamente.</p>
        </div>
      `,
    })}

    ${renderPageFold({
      title: 'Nyx',
      subtitle: 'Tour das áreas principais.',
      guideTarget: 'account-preferences',
      content: `
        <div class="account-settingsCard account-settingsCard-nyx">
          <div class="account-settingsHead">
            <strong>${nyxGuideCompleted ? 'Tour concluído' : 'Tour do Nyx'}</strong>
            <span>${nyxGuideCompleted ? 'Reabra quando precisar.' : 'Hoje, evolução, conta e dados.'}</span>
          </div>
          <div class="account-choiceFace account-choiceFace-static">
            <span class="account-choiceEyebrow">Guia</span>
            <strong>Abrir tour</strong>
            <small>Navega pelas áreas principais.</small>
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
      subtitle: 'Links da conta.',
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
      subtitle: 'Apaga dados salvos neste aparelho.',
      content: `
        <div class="settings-actions">
          <button class="btn-secondary btn-dangerSoft" data-action="pdf:clear" type="button">Limpar dados do app</button>
        </div>
      `,
    })}
  `;
}
