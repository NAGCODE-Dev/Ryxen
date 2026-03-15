import { isDeveloperEmail } from '../../core/utils/devAccess.js';
import { getAthleteImportUsage, normalizeAthleteBenefits } from '../../core/services/athleteBenefitUsage.js';

export function renderAccountPage(state, helpers) {
  const {
    renderPageHero,
    renderSummaryTile,
    renderPageFold,
    renderAccountSkeleton,
    formatDateShort,
    escapeHtml,
  } = helpers;

  const profile = state?.__ui?.auth?.profile || null;
  const coachPortal = state?.__ui?.coachPortal || {};
  const subscription = coachPortal?.subscription || null;
  const planKey = subscription?.plan || subscription?.plan_id || 'free';
  const planName = formatSubscriptionPlanName(planKey);
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const canUseDeveloperTools = isDeveloperEmail(profile?.email);
  const isBusy = !!state?.__ui?.isBusy;
  const athleteBenefits = normalizeAthleteBenefits(state?.__ui?.athleteOverview?.athleteBenefits || null);
  const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
  const accessEntitlements = coachPortal?.entitlements || [];
  const canCoachManage = accessEntitlements.includes('coach_portal');
  const gyms = coachPortal?.gyms || [];
  const athleteStats = state?.__ui?.athleteOverview?.stats || {};
  const athleteBenefitSource = describeAthleteBenefitSource(athleteBenefits);
  const hasAthletePlus = planKey === 'athlete_plus' && planStatus === 'active';

  if (!profile?.email) {
    return `
      <div class="workout-container page-stack page-stack-account">
        ${renderPageHero({
          eyebrow: 'CrossApp Platform',
          title: 'Conecte sua conta aos módulos certos',
          subtitle: 'Use o módulo Train no dia a dia e a mesma conta para sincronização, Coach Portal e plano pessoal quando fizer sentido.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar na conta</button>
          `,
        })}

        <div class="summary-strip summary-strip-4">
          ${renderSummaryTile('Train', 'Tudo liberado', 'imports, histórico e PRs')}
          ${renderSummaryTile('Coach', 'Portal separado', 'box, atletas e grupos')}
          ${renderSummaryTile('Conta', 'Mesma identidade', 'sync e módulos vinculados')}
          ${renderSummaryTile('Plano pessoal', 'Opcional', 'Atleta Plus na mesma conta')}
        </div>

        <div class="coach-grid">
          ${renderPageFold({
            title: 'O que sua conta conecta',
            subtitle: 'Valor prático da conta entre Train, Coach e assinatura pessoal.',
            content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Sync entre dispositivos</strong>
                <span>Seus dados não ficam presos em um aparelho.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Módulo Train + Coach</strong>
                <span>Receba a programação do box mantendo o módulo Train como sua rotina diária.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Histórico e PRs</strong>
                <span>Use seu progresso para calcular cargas e enxergar evolução, sem limite artificial no app.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Atleta Plus opcional</strong>
                <span>Assinatura pessoal para apoiar o produto e manter um plano próprio vinculado à sua conta.</span>
              </div>
            </div>
            `,
          })}
          ${renderPageFold({
            title: 'Atleta Plus',
            subtitle: 'Assinatura pessoal opcional, sem bloquear o uso livre do app.',
            content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Status</strong>
                <span>${hasAthletePlus ? 'Ativo na sua conta' : 'Opcional, sem obrigatoriedade para usar o app'}</span>
              </div>
              <div class="coach-listItem static">
                <strong>Como funciona</strong>
                <span>O app do atleta continua liberado. O Atleta Plus existe como assinatura pessoal vinculada à sua conta.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Quando faz sentido</strong>
                <span>Se você quer manter um plano próprio no produto mesmo treinando solo, sem depender do plano do coach.</span>
              </div>
            </div>
            <div class="page-actions">
              ${hasAthletePlus ? '<span class="coach-pill isGood">Atleta Plus ativo</span>' : '<button class="btn-primary" data-action="billing:checkout" data-plan="athlete_plus" type="button">Assinar Atleta Plus</button>'}
              <a class="btn-secondary" href="/pricing.html">Ver planos</a>
            </div>
            `,
          })}
          ${renderPageFold({
            title: 'Se você também é coach',
            subtitle: 'Mesma conta, operação no módulo Coach.',
            content: `
            <p class="account-hint">Use a mesma conta para abrir o módulo Coach e publicar treinos para atletas, grupos e planilhas especiais.</p>
            <div class="page-actions">
              <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
              <a class="btn-secondary" href="/coach/">Abrir Coach Portal</a>
            </div>
            `,
          })}
        </div>
      </div>
    `;
  }

  return `
    <div class="workout-container page-stack page-stack-account">
      ${renderPageHero({
        eyebrow: 'Conta',
        title: profile.name || 'Sua conta',
        subtitle: 'Sessão, sync e acesso aos módulos Train, Coach e plano pessoal vinculados à sua conta.',
        actions: `
          <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
        `,
      })}

      <div class="summary-strip summary-strip-4">
        ${renderSummaryTile('Conta', isBusy ? '...' : escapeHtml(profile.name || 'Sem nome'), isBusy ? '' : escapeHtml(profile.email || ''))}
        ${renderSummaryTile('Plano', isBusy ? '...' : escapeHtml(planName), isBusy ? '' : escapeHtml(planStatus))}
        ${renderSummaryTile('Benefício atleta', isBusy ? '...' : athleteBenefits.label, isBusy ? '' : athleteBenefitSource)}
        ${renderSummaryTile('Importações', isBusy ? '...' : (importUsage.unlimited ? 'Ilimitado' : `${importUsage.remaining}/${importUsage.limit}`), isBusy ? '' : (importUsage.unlimited ? 'PDF e mídia sem limite' : `${importUsage.used} uso(s) neste mês`))}
      </div>

      <div class="coach-grid">
        ${renderPageFold({
          title: 'Módulo Train',
          subtitle: 'Conta ativa, sync e leitura do atleta dentro da plataforma.',
          content: `
          ${isBusy ? renderAccountSkeleton() : `
            <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
            <div class="account-email">${escapeHtml(profile.email || '')}</div>
          `}
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Acesso do atleta</strong>
              <span>${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Resultados e agenda</strong>
              <span>${Number(athleteStats?.resultsLogged || 0)} resultado(s) • ${Number(athleteStats?.upcomingCompetitions || 0)} competição(ões)</span>
            </div>
            <div class="coach-listItem static">
              <strong>Treinos vinculados</strong>
              <span>${Number(athleteStats?.assignedWorkouts || 0)} treino(s) • ${Number(athleteStats?.activeGyms || 0)} gym(s) ativo(s)</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
            <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Resumo completo</button>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Plano e acesso',
          subtitle: 'O módulo Train fica livre; plano pessoal ou do coach aparecem na mesma conta.',
          content: `
          ${isBusy ? renderAccountSkeleton() : `
            <div class="account-name">${escapeHtml(planName)}</div>
            <div class="account-email">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</div>
          `}
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Status do atleta</strong>
              <span>${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Plano pessoal</strong>
              <span>${hasAthletePlus ? 'Atleta Plus ativo na sua conta' : 'Sem plano pessoal ativo'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Imports</strong>
              <span>${importUsage.unlimited ? 'PDF e mídia ilimitados' : `${importUsage.remaining} restante(s) de ${importUsage.limit}`}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Histórico visível</strong>
              <span>${athleteBenefits.historyDays === null ? 'Completo' : `${athleteBenefits.historyDays} dias`}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Competições</strong>
              <span>Liberadas no app do atleta.</span>
            </div>
          </div>
          <div class="page-actions">
            ${!hasAthletePlus ? '<button class="btn-secondary" data-action="billing:checkout" data-plan="athlete_plus" type="button">Assinar Atleta Plus</button>' : '<span class="coach-pill isGood">Atleta Plus ativo</span>'}
            ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
            ${canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
            <a class="btn-secondary" href="/pricing.html">Ver planos</a>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Módulo Coach',
          subtitle: canCoachManage || canUseDeveloperTools ? 'Portal separado para operação do box.' : 'Upgrade para operar box, atletas e grupos.',
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Status do coach</strong>
              <span>${canCoachManage ? 'Liberado para gestão' : 'Bloqueado até ativar plano'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Gyms vinculados</strong>
              <span>${gyms.length} gym(s) visível(is) nesta conta</span>
            </div>
            <div class="coach-listItem static">
              <strong>Como funciona</strong>
              <span>No módulo Train você acompanha conta e benefícios. A operação do box fica no Coach Portal.</span>
            </div>
          </div>
          <div class="page-actions">
            <a class="btn-secondary" href="/coach/">Abrir Coach Portal</a>
            <a class="btn-secondary" href="/pricing.html">Ver planos</a>
          </div>
          `,
        })}
      </div>
    </div>
  `;
}

export function renderAuthModal({ auth = {}, authMode = 'signin' } = {}, helpers) {
  const {
    renderAccountSkeleton,
    formatDateShort,
    escapeHtml,
  } = helpers;

  const profile = auth?.profile || null;
  const isAuthenticated = !!profile?.email;
  const isBusy = !!auth?.isBusy;
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const isResetMode = !isSignup && !!reset?.open;
  const coachPortal = auth?.coachPortal || {};
  const athleteOverview = auth?.athleteOverview || {};

  if (isAuthenticated) {
    const entitlements = coachPortal?.entitlements || [];
    const canCoachManage = entitlements.includes('coach_portal');
    const subscription = coachPortal?.subscription || null;
    const gyms = coachPortal?.gyms || [];
    const athleteStats = athleteOverview?.stats || {};
    const athleteBenefits = normalizeAthleteBenefits(athleteOverview?.athleteBenefits || null);
    const planKey = subscription?.plan || subscription?.plan_id || 'free';
    const planName = formatSubscriptionPlanName(planKey);
    const planStatus = subscription?.status || 'inactive';
    const hasAthletePlus = planKey === 'athlete_plus' && planStatus === 'active';
    const canUseDeveloperTools = isDeveloperEmail(profile?.email);
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
                ${isBusy ? renderAccountSkeleton() : `
                  <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
                  <div class="account-email">${escapeHtml(profile.email || '')}</div>
                `}
              </div>
              <div class="account-planCard">
                <span class="account-planLabel">Plano da conta</span>
                ${isBusy ? renderAccountSkeleton() : `
                  <strong class="account-planValue">${escapeHtml(planName)}</strong>
                  <span class="account-planMeta">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</span>
                `}
              </div>
            </div>

            <div class="account-summaryGrid">
              ${isBusy ? Array.from({ length: 4 }, () => `
                <div class="summary-tile isSkeleton">
                  <div class="skeleton skeleton-line skeleton-line-sm"></div>
                  <div class="skeleton skeleton-line skeleton-line-lg"></div>
                </div>
              `).join('') : `
              <div class="summary-tile">
                <span class="summary-label">Acesso</span>
                <strong class="summary-value">${escapeHtml(athleteBenefits.label)}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Fonte</span>
                <strong class="summary-value">${escapeHtml(describeAthleteBenefitSource(athleteBenefits))}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Gyms</span>
                <strong class="summary-value">${gyms.length}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Treinos</span>
                <strong class="summary-value">${Number(athleteStats?.assignedWorkouts || 0)}</strong>
              </div>
              <div class="summary-tile">
                <span class="summary-label">Plano pessoal</span>
                <strong class="summary-value">${hasAthletePlus ? 'Atleta Plus' : 'Livre'}</strong>
              </div>
              `}
            </div>

            <div class="settings-actions account-actions">
              <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
              <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
              <a class="btn-secondary" href="/sports/cross/#account" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Ir para Conta</a>
              <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
            </div>

            <div class="auth-intro">
              <div class="section-kicker">Atleta Plus</div>
              <p class="account-hint">${hasAthletePlus
                ? 'Seu plano pessoal está ativo nesta conta. O app do atleta continua liberado e o Atleta Plus fica vinculado ao seu email.'
                : 'O app do atleta continua liberado. O Atleta Plus é uma assinatura pessoal opcional vinculada à sua conta.'}</p>
              <div class="coach-pillRow">
                <span class="coach-pill ${hasAthletePlus ? 'isGood' : ''}">${hasAthletePlus ? 'Atleta Plus ativo' : 'Atleta livre'}</span>
                <span class="coach-pill">${renewAt && hasAthletePlus ? `Renova em ${escapeHtml(formatDateShort(renewAt))}` : 'Sem plano pessoal ativo'}</span>
              </div>
              <div class="settings-actions coach-billingActions">
                ${hasAthletePlus ? '<span class="coach-pill isGood">Atleta Plus ativo</span>' : '<button class="btn-secondary" data-action="billing:checkout" data-plan="athlete_plus" type="button">Assinar Atleta Plus</button>'}
                <a class="btn-secondary" href="/pricing.html">Ver planos</a>
              </div>
            </div>

            <div class="auth-intro">
              <div class="section-kicker">Coach</div>
              <p class="account-hint">${canCoachManage || canUseDeveloperTools
                ? 'O portal do coach continua separado do app do atleta. Use sua mesma conta para abrir o workspace do box.'
                : 'Seu acesso de coach está bloqueado. Ative um plano quando quiser operar box, atletas e grupos no portal separado. O app do atleta continua liberado.'}</p>
              <div class="coach-pillRow">
                <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Coach liberado' : 'Coach bloqueado'}</span>
                <span class="coach-pill isGood">Atleta liberado</span>
                <span class="coach-pill">${gyms.length} gym(s)</span>
              </div>
              <div class="settings-actions coach-billingActions">
                ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
                ${!canCoachManage && canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
                <a class="btn-secondary" href="/coach/">Abrir portal</a>
                <a class="btn-secondary" href="/pricing.html">Ver planos</a>
              </div>
            </div>

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
          <h2 class="modal-title">${isSignup ? '📝 Criar conta' : isResetMode ? '📨 Recuperar senha' : '🔐 Acessar sua conta'}</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          ${isResetMode ? `
            <div class="auth-panelStack">
              <section class="auth-resetSheet">
                <div class="auth-sheetHead">
                  <div class="section-kicker">Recuperação</div>
                  <p class="account-hint">Peça um código por email e defina uma nova senha.</p>
                </div>

                <div class="auth-resetForm">
                  <div class="auth-resetRequest">
                    <input class="add-input" id="reset-email" type="email" placeholder="Email da conta" value="${escapeHtml(reset.email || '')}" />
                    <button class="btn-secondary" data-action="auth:reset-request" type="button">Gerar código</button>
                  </div>
                  ${reset?.statusMessage ? `
                    <div class="notice ${reset?.statusTone === 'error' ? 'error' : 'success'}">
                      ${escapeHtml(reset.statusMessage)}
                    </div>
                  ` : ''}
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
                  <div class="auth-resetConfirm">
                    <input class="add-input" id="reset-code" type="text" placeholder="Código de 6 dígitos" value="${escapeHtml(reset.code || '')}" />
                    <input class="add-input" id="reset-newPassword" type="password" placeholder="Nova senha" />
                    <button class="btn-primary" data-action="auth:reset-confirm" type="button">Trocar senha</button>
                  </div>
                  <p class="account-hint">O código é enviado por email${reset?.supportEmail ? ` via ${escapeHtml(reset.supportEmail)}` : ''}.</p>
                  <div class="auth-sheetActions">
                    <button class="btn-secondary" data-action="auth:reset-toggle" type="button">Voltar para entrar</button>
                  </div>
                </div>
              </section>
            </div>
          ` : `
            <div class="auth-intro">
              <div class="section-kicker">CrossApp Platform</div>
              <p class="account-hint">${isSignup ? 'Crie sua conta para sincronizar o módulo Train, manter seu histórico e usar o Coach Portal quando precisar operar o box.' : 'Entre para continuar no módulo Train, sincronizar seus dados e acessar módulos vinculados à sua conta.'}</p>
            </div>
            <div class="auth-panelStack">
              <section class="auth-formCard">
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
              </section>

              ${!isSignup ? `
                <section class="auth-resetPrompt">
                  <strong>Recuperação separada do login</strong>
                  <p class="account-hint">Abra o fluxo de recuperação sem misturar reset com a entrada principal da conta.</p>
                  <button class="btn-secondary" data-action="auth:reset-toggle" type="button">Recuperar senha</button>
                </section>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function describeAthleteBenefitSource(benefits) {
  const normalized = normalizeAthleteBenefits(benefits);
  if (normalized.personal) return 'liberado na conta do atleta';
  if (normalized.inherited) return 'liberado também quando há coach vinculado';
  return 'sem bloqueios no app do atleta';
}

function formatSubscriptionPlanName(planId) {
  const normalized = String(planId || 'free').trim().toLowerCase();
  if (normalized === 'athlete_plus') return 'Atleta Plus';
  if (normalized === 'starter') return 'Coach Starter';
  if (normalized === 'pro' || normalized === 'coach') return 'Coach Pro';
  if (normalized === 'performance') return 'Coach Performance';
  return 'Free';
}
