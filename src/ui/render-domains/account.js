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
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const isBusy = !!state?.__ui?.isBusy;
  const athleteBenefits = normalizeAthleteBenefits(state?.__ui?.athleteOverview?.athleteBenefits || null);
  const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
  const accessEntitlements = coachPortal?.entitlements || [];
  const canCoachManage = accessEntitlements.includes('coach_portal');
  const gyms = coachPortal?.gyms || [];
  const athleteStats = state?.__ui?.athleteOverview?.stats || {};
  const athleteBenefitSource = describeAthleteBenefitSource(athleteBenefits);
  const hasAthletePlus = planKey === 'athlete_plus' && planStatus === 'active';
  const isAdmin = !!(profile?.is_admin || profile?.isAdmin);
  const adminOverview = state?.__ui?.admin?.overview || null;
  const adminHealth = state?.__ui?.admin?.health || null;
  const adminManualReset = state?.__ui?.admin?.manualReset || null;

  if (!profile?.email) {
    return `
      <div class="workout-container page-stack page-stack-account">
        ${renderPageHero({
          eyebrow: 'Conta',
          title: 'Conta vazia',
          subtitle: 'Sem sessão ativa. Entre só quando precisar sincronizar ou salvar progresso.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" data-auth-mode="signup" type="button">Criar conta</button>
          `,
        })}

        <div class="summary-strip summary-strip-3">
          ${renderSummaryTile('Sessão', 'Offline', 'nenhum email ativo')}
          ${renderSummaryTile('Treino', 'Livre', 'importe quando quiser')}
          ${renderSummaryTile('Estado', 'Limpo', 'sem sync e sem coach')}
        </div>

        <div class="coach-grid">
          ${renderPageFold({
            title: 'Modo atual',
            subtitle: 'O app fica simples até você decidir conectar uma conta.',
            content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Sem conta conectada</strong>
                <span>Nenhum email aparece enquanto você estiver fora da sessão.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Importação manual</strong>
                <span>O treino continua entrando por botão, não por aba fixa.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Base pronta</strong>
                <span>Use esse estado cru para começar a mandar os treinos e dados do jeito certo.</span>
              </div>
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
        title: 'Conta ativa',
        subtitle: 'Só o essencial da sessão. O resto fica fora do caminho.',
        actions: `
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
          <button class="btn-secondary" data-action="app:reset-local" type="button">Limpar app</button>
        `,
      })}

      <div class="summary-strip summary-strip-3">
        ${renderSummaryTile('Conta', isBusy ? '...' : escapeHtml(profile.name || 'Sem nome'), isBusy ? '' : escapeHtml(profile.email || ''))}
        ${renderSummaryTile('Modo', isBusy ? '...' : escapeHtml(canCoachManage ? 'Com coach' : 'Solo'), isBusy ? '' : escapeHtml(athleteBenefitSource))}
        ${renderSummaryTile('Imports', isBusy ? '...' : escapeHtml(importUsage.unlimited ? 'Livre' : `${importUsage.remaining}/${importUsage.limit}`), isBusy ? '' : escapeHtml(importUsage.unlimited ? 'sem limite' : `${importUsage.used} usado(s)`))}
      </div>

      <div class="coach-grid">
        ${renderPageFold({
          title: 'Sessão',
          subtitle: 'Identidade básica e saída rápida.',
          content: `
          ${isBusy ? renderAccountSkeleton() : `
            <div class="account-name">${escapeHtml(profile.name || 'Sem nome')}</div>
            <div class="account-email">${escapeHtml(profile.email || '')}</div>
          `}
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Acesso atual</strong>
              <span>${escapeHtml(athleteBenefits.label)} • ${escapeHtml(athleteBenefitSource)}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Gyms vinculados</strong>
              <span>${Number(athleteStats?.activeGyms || gyms.length || 0)} gym(s) ativo(s)</span>
            </div>
            <div class="coach-listItem static">
              <strong>Plano</strong>
              <span>${escapeHtml(hasAthletePlus ? 'Atleta Plus' : 'Uso livre')} • ${escapeHtml(planStatus)}</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar sessão</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Dados locais',
          subtitle: 'Limpeza e sincronização sem poluir a tela.',
          content: `
          <div class="page-actions">
            <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
            <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
            <button class="btn-secondary" data-action="pdf:clear" type="button">Limpar treino</button>
            <button class="btn-secondary" data-action="app:reset-local" type="button">Reset total</button>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Resumo',
          subtitle: 'Estado atual da conta sem detalhe desnecessário.',
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Modo atual</strong>
              <span>${canCoachManage ? 'Vinculado a coach com portal ativo' : 'Uso solo ou sem portal ativo'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Imports do mês</strong>
              <span>${importUsage.unlimited ? 'Sem limite mensal' : `${importUsage.used}/${importUsage.limit} usado(s) neste mês`}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Coach Portal</strong>
              <span>${canCoachManage ? 'Seu acesso de coach está liberado nesta conta.' : 'O Coach Portal fica separado e não interfere no uso diário do atleta.'}</span>
            </div>
          </div>
          `,
        })}

        ${(canCoachManage || hasAthletePlus) ? renderPageFold({
          title: 'Coach Portal',
          subtitle: 'Atalho opcional e separado do treino.',
          open: false,
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Portal separado</strong>
              <span>${canCoachManage ? 'Seu acesso de coach está liberado nesta conta.' : 'Abra o portal só quando precisar cuidar de box, membros e publicação.'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Assinatura</strong>
              <span>${hasAthletePlus ? `Ativa${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}` : 'Sem assinatura pessoal ativa.'}</span>
            </div>
          </div>
          <div class="page-actions account-portalAction">
            <a class="btn-secondary" href="/coach/">Coach Portal</a>
            ${hasAthletePlus ? '' : '<button class="btn-secondary" data-action="billing:checkout" data-plan="athlete_plus" type="button">Assinar Atleta Plus</button>'}
          </div>
          `,
        }) : ''}

        ${isAdmin ? renderPageFold({
          title: 'Admin',
          subtitle: 'Saúde operacional, billing e suporte.',
          content: `
          <div class="page-actions">
            <input class="add-input" id="admin-search" type="text" placeholder="Buscar usuário por nome ou email" value="${escapeHtml(state?.__ui?.admin?.query || '')}" />
            <button class="btn-secondary" data-action="admin:refresh" type="button">Atualizar painel</button>
          </div>
          ${adminOverview ? renderAdminOverview(adminOverview, adminHealth, adminManualReset, { escapeHtml, formatDateShort }) : `
            <p class="account-hint">Carregue o painel admin para ver falhas recentes de reset, email e webhook.</p>
          `}
          `,
        }) : ''}
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
  const isSubmitting = !!auth?.submitting;
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const resetCooldown = Math.max(0, Math.ceil(((reset?.nextRequestAt || 0) - Date.now()) / 1000));
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
    const importUsage = getAthleteImportUsage(athleteBenefits, 'pdf');
    const planKey = subscription?.plan || subscription?.plan_id || 'free';
    const planStatus = subscription?.status || 'inactive';
    const hasAthletePlus = planKey === 'athlete_plus' && planStatus === 'active';
    const renewAt = subscription?.renewAt || subscription?.renew_at || null;
    return `
      <div class="modal-overlay modal-overlay-auth isOpen" id="ui-authModalBackdrop">
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
                <span class="account-planLabel">Uso do atleta</span>
                ${isBusy ? renderAccountSkeleton() : `
                  <strong class="account-planValue">${escapeHtml(hasAthletePlus ? 'Atleta Plus' : 'Uso livre')}</strong>
                  <span class="account-planMeta">${escapeHtml(hasAthletePlus ? `Imports ilimitados${renewAt ? ` • renova em ${formatDateShort(renewAt)}` : ''}` : 'Até 10 imports por mês no plano base')}</span>
                `}
              </div>
            </div>

            <div class="account-summaryGrid account-summaryGrid-compact">
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
                <span class="summary-label">Imports</span>
                <strong class="summary-value">${importUsage.unlimited ? 'Ilimitado' : `${importUsage.remaining}/${importUsage.limit}`}</strong>
              </div>
              `}
            </div>

            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Uso atual</strong>
                <span>${hasAthletePlus ? 'Atleta Plus ativo' : 'App do atleta liberado com até 10 imports por mês'}</span>
              </div>
              <div class="coach-listItem static">
                <strong>Conta e segurança</strong>
                <span>Abra a página Conta para ver sync, imports do mês e o Coach Portal só no fim da página.</span>
              </div>
            </div>

            <div class="settings-actions account-actions">
              <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
              <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
              <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
              <a class="btn-secondary" href="/sports/cross/#account" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;">Ir para Conta</a>
            </div>

            <div class="settings-actions account-actions">
              <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="modal-overlay modal-overlay-auth isOpen" id="ui-authModalBackdrop">
      <div class="modal-container modal-container-auth">
        <div class="modal-header">
          <h2 class="modal-title">${isSignup ? 'Criar conta' : isResetMode ? 'Recuperar senha' : 'Entrar'}</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          ${isResetMode ? `
            <div class="auth-panelStack">
              <section class="auth-resetSheet">
                <div class="auth-sheetHead">
                  <div class="section-kicker">Recuperar senha</div>
                  <p class="account-hint">Receba um código por email e defina uma nova senha.</p>
                </div>

                <div class="auth-resetForm">
                  <div class="auth-resetRequest">
                    <input class="add-input" id="reset-email" type="email" placeholder="Email da conta" value="${escapeHtml(reset.email || '')}" />
                    <button class="btn-secondary" data-action="auth:reset-request" type="button" ${(reset?.requesting || resetCooldown > 0) ? 'disabled' : ''}>${reset?.requesting ? 'Enviando...' : resetCooldown > 0 ? `Aguarde ${resetCooldown}s` : 'Enviar código por email'}</button>
                  </div>
                  ${reset?.statusMessage ? `
                    <div class="notice ${reset?.statusTone === 'error' ? 'error' : 'success'}">
                      ${escapeHtml(reset.statusMessage)}
                    </div>
                  ` : ''}
                  ${resetCooldown > 0 && !reset?.requesting ? `
                    <p class="account-hint">Você poderá pedir um novo código em ${resetCooldown}s.</p>
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
                    <button class="btn-primary" data-action="auth:reset-confirm" type="button" ${reset?.confirming ? 'disabled' : ''}>${reset?.confirming ? 'Salvando...' : 'Trocar senha'}</button>
                  </div>
                  <div class="auth-sheetActions">
                    <button class="btn-secondary" data-action="auth:reset-toggle" type="button">Voltar para entrar</button>
                  </div>
                </div>
              </section>
            </div>
          ` : `
            <div class="auth-intro">
              <div class="section-kicker">CrossApp</div>
              <p class="account-hint">${isSignup ? 'Crie sua conta e comece a salvar treinos e resultados.' : 'Entre para ver seu treino, resultados e evolução.'}</p>
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
                  <button class="btn-primary" data-action="auth:submit" data-mode="${escapeHtml(authMode)}" type="button" ${isSubmitting ? 'disabled' : ''}>
                    ${isSubmitting ? (isSignup ? 'Criando conta...' : 'Entrando...') : (isSignup ? 'Criar conta' : 'Entrar')}
                  </button>
                </form>
              </section>

              ${!isSignup ? `
                <section class="auth-resetPrompt">
                  <strong>Esqueceu a senha?</strong>
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
  return 'uso livre com até 10 imports por mês';
}

function formatSubscriptionPlanName(planId) {
  const normalized = String(planId || 'free').trim().toLowerCase();
  if (normalized === 'athlete_plus') return 'Atleta Plus';
  if (normalized === 'starter') return 'Coach Starter';
  if (normalized === 'pro' || normalized === 'coach') return 'Coach Pro';
  if (normalized === 'performance') return 'Coach Performance';
  return 'Free';
}

function renderAdminOverview(overview, health, manualReset, helpers) {
  const { escapeHtml, formatDateShort } = helpers;
  const stats = overview?.stats || {};
  const ops = overview?.ops || {};
  const users = Array.isArray(overview?.users) ? overview.users : [];
  const mailer = ops?.mailer || {};
  const billing = ops?.billing || {};
  const recentClaims = Array.isArray(ops?.recentBillingClaims) ? ops.recentBillingClaims : [];
  const recentOps = Array.isArray(ops?.recentOps) ? ops.recentOps : [];
  const recentEmailJobs = Array.isArray(ops?.recentEmailJobs) ? ops.recentEmailJobs : [];
  const healthMailer = health?.mailer || null;
  const healthDb = health?.db || null;

  return `
    <div class="account-summaryGrid account-summaryGrid-compact">
      <div class="summary-tile">
        <span class="summary-label">Usuários</span>
        <strong class="summary-value">${Number(stats.users || 0)}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Assinaturas ativas</span>
        <strong class="summary-value">${Number(stats.activeSubscriptions || 0)}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Claims pendentes</span>
        <strong class="summary-value">${Number(stats.pendingBillingClaims || 0)}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Email</span>
        <strong class="summary-value">${escapeHtml(mailer.ok ? 'ok' : 'falha')}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Banco</span>
        <strong class="summary-value">${escapeHtml(healthDb?.ok ? 'ok' : 'falha')}</strong>
      </div>
      <div class="summary-tile">
        <span class="summary-label">Emails</span>
        <strong class="summary-value">${escapeHtml(recentEmailJobs[0]?.status || 'sem dados')}</strong>
      </div>
    </div>

    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Entrega de email</strong>
        <span>${escapeHtml(`${mailer.mode || 'desconhecido'} • ${mailer.verified ? 'verificado' : 'não verificado'}${mailer.durationMs ? ` • ${mailer.durationMs}ms` : ''}${mailer.error ? ` • ${mailer.error}` : ''}`)}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Billing</strong>
        <span>${billing.webhookConfigured ? 'webhook configurado' : 'webhook ausente'} • ${billing.apiConfigured ? 'API Kiwify configurada' : 'API Kiwify incompleta'}</span>
      </div>
    </div>

    ${health ? `
      <div class="coach-list coach-listCompact">
        <div class="coach-listItem static">
          <strong>Health operacional</strong>
          <span>${escapeHtml(`${health.ok ? 'ok' : 'com falhas'} • ${health.durationMs || 0}ms`)}</span>
        </div>
        <div class="coach-listItem static">
          <strong>SMTP verificado</strong>
          <span>${escapeHtml(healthMailer ? `${healthMailer.ok ? 'ok' : 'falha'}${healthMailer.errorCode ? ` • ${healthMailer.errorCode}` : ''}${healthMailer.error ? ` • ${healthMailer.error}` : ''}` : 'sem dados')}</span>
        </div>
      </div>
    ` : ''}

    <div class="coach-list coach-listCompact">
      <div class="coach-listItem static">
        <strong>Falhas e eventos recentes</strong>
        <span>${recentOps.length ? recentOps.slice(0, 5).map((item) => `${item.kind}:${item.status}`).join(' • ') : 'Sem eventos recentes.'}</span>
      </div>
      <div class="coach-listItem static">
        <strong>Claims recentes</strong>
        <span>${recentClaims.length ? recentClaims.slice(0, 3).map((item) => `${item.plan_id}:${describeClaimAction(item)}:${item.status}`).join(' • ') : 'Nenhuma claim recente.'}</span>
      </div>
    </div>

    ${recentClaims.length ? `
      <div class="coach-list coach-listCompact">
        ${recentClaims.slice(0, 6).map((item) => `
          <div class="coach-listItem static">
            <strong>${escapeHtml(item.plan_id)} • ${escapeHtml(describeClaimAction(item))} • ${escapeHtml(item.status)}</strong>
            <span>${escapeHtml(item.email || 'sem email')} • ${escapeHtml(formatDateShort(item.updated_at || item.created_at))}</span>
            ${item.status !== 'applied' ? `
              <div class="page-actions">
                <button class="btn-secondary" data-action="admin:reprocess-claim" data-claim-id="${Number(item.id)}" type="button">Reprocessar claim</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${recentEmailJobs.length ? `
      <div class="coach-list coach-listCompact">
        ${recentEmailJobs.slice(0, 6).map((job) => `
          <div class="coach-listItem static">
            <strong>${escapeHtml(job.kind)} • ${escapeHtml(job.status)}${job.provider ? ` • ${escapeHtml(job.provider)}` : ''}</strong>
            <span>${escapeHtml(job.email || 'sem email')} • ${escapeHtml(formatDateShort(job.updatedAt || job.createdAt))}${job.lastError ? ` • ${escapeHtml(job.lastError)}` : ''}</span>
            ${job.status !== 'sent' ? `
              <div class="page-actions">
                <button class="btn-secondary" data-action="admin:retry-email-job" data-job-id="${Number(job.id)}" type="button">Reenviar email</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${manualReset?.reset?.code ? `
      <div class="coach-list coach-listCompact">
        <div class="coach-listItem static">
          <strong>Código manual de recuperação</strong>
          <span>${escapeHtml(manualReset.user?.email || 'sem email')} • expira em ${escapeHtml(formatDateShort(manualReset.reset?.expiresAt))}</span>
          <div class="reset-codePreview">
            Código temporário: <strong>${escapeHtml(manualReset.reset.code)}</strong>
          </div>
        </div>
      </div>
    ` : ''}

    ${users.length ? `
      <div class="admin-userList">
        ${users.map((user) => `
          <div class="admin-userRow">
            <div>
              <div class="admin-userName">${escapeHtml(user.name || 'Sem nome')}</div>
              <div class="admin-userEmail">${escapeHtml(user.email || '')}</div>
              <div class="admin-userMeta">
                ${escapeHtml(user.subscription_plan || 'free')} • ${escapeHtml(user.subscription_status || 'inactive')}${user.is_admin ? ' • admin' : ''}
              </div>
            </div>
            <div class="admin-userControls">
              <div class="admin-userActions">
                <button class="btn-secondary" data-action="admin:create-manual-reset" data-user-id="${Number(user.id)}" type="button">Gerar código manual</button>
                <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="starter" type="button">Starter</button>
                <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="pro" type="button">Pro</button>
                <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="performance" type="button">Performance</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${recentOps.length ? `
      <div class="coach-list coach-listCompact">
        ${recentOps.slice(0, 6).map((item) => `
          <div class="coach-listItem static">
            <strong>${escapeHtml(item.kind)} • ${escapeHtml(item.status)}</strong>
            <span>${escapeHtml(item.email || 'sem email')} • ${escapeHtml(formatDateShort(item.created_at))}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

function describeClaimAction(claim) {
  const payload = claim?.payload && typeof claim.payload === 'object' ? claim.payload : {};
  return payload?.billingAction === 'reversal' ? 'reversão' : 'ativação';
}
