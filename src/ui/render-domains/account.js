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
          title: 'Entre para salvar seu progresso',
          subtitle: 'Use o app no dia a dia, sincronize seus dados e acesse sua conta quando quiser.',
          actions: `
            <button class="btn-primary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" data-auth-mode="signup" type="button">Criar conta</button>
          `,
        })}

        <div class="summary-strip summary-strip-3">
          ${renderSummaryTile('Treinos', 'Uso livre', 'importe e acompanhe no seu ritmo')}
          ${renderSummaryTile('Perfil', 'Evolução', 'benchmarks e registros pessoais')}
          ${renderSummaryTile('Conta', 'Sync', 'nome, email e segurança')}
        </div>

        <div class="coach-grid">
          ${renderPageFold({
            title: 'Por que entrar',
            subtitle: 'O essencial para usar o app com segurança e continuidade.',
            content: `
            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Sync entre dispositivos</strong>
                <span>Seus dados não ficam presos em um aparelho.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Treinos do coach</strong>
                <span>Se você treina com coach, recebe a programação sem sair do seu fluxo diário.</span>
              </div>
              <div class="coach-listItem static">
                <strong>Seu progresso salvo</strong>
                <span>Registros, benchmarks e histórico ficam vinculados à sua conta.</span>
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
        title: profile.name || 'Sua conta',
        subtitle: 'Dados da conta, segurança e vínculo com coach sem misturar sua evolução com gestão.',
        actions: `
          <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
          <button class="btn-primary" data-action="auth:signout" type="button">Sair</button>
        `,
      })}

      <div class="summary-strip summary-strip-3">
        ${renderSummaryTile('Conta', isBusy ? '...' : escapeHtml(profile.name || 'Sem nome'), isBusy ? '' : escapeHtml(profile.email || ''))}
        ${renderSummaryTile('Modo', isBusy ? '...' : escapeHtml(canCoachManage ? 'Com coach' : 'Solo'), isBusy ? '' : escapeHtml(athleteBenefitSource))}
        ${renderSummaryTile('Plano', isBusy ? '...' : escapeHtml(hasAthletePlus ? 'Atleta Plus' : planName), isBusy ? '' : escapeHtml(planStatus))}
      </div>

      <div class="coach-grid">
        ${renderPageFold({
          title: 'Dados da conta',
          subtitle: 'Identidade e informações básicas da sua conta.',
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
              <strong>Email</strong>
              <span>${escapeHtml(profile.email || '')}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Gyms vinculados</strong>
              <span>${Number(athleteStats?.activeGyms || gyms.length || 0)} gym(s) ativo(s)</span>
            </div>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Segurança e sincronização',
          subtitle: 'Ações essenciais da conta.',
          content: `
          <div class="page-actions">
            <button class="btn-secondary" data-action="auth:sync-push" type="button">Enviar sync</button>
            <button class="btn-secondary" data-action="auth:sync-pull" type="button">Baixar sync</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="settings" type="button">Configurações</button>
            <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Resumo da conta</button>
          </div>
          `,
        })}

        ${renderPageFold({
          title: 'Vínculo com coach',
          subtitle: 'Seu modo atual de uso do app.',
          content: `
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Modo atual</strong>
              <span>${canCoachManage ? 'Vinculado a coach com portal ativo' : 'Uso solo ou sem portal ativo'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Plano atual</strong>
              <span>${escapeHtml(hasAthletePlus ? 'Atleta Plus' : planName)} • ${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Coach Portal</strong>
              <span>${canCoachManage ? 'Seu acesso de coach está liberado nesta conta.' : 'O Coach Portal continua separado e não interfere no uso diário do atleta.'}</span>
            </div>
          </div>
          <div class="page-actions account-portalAction">
            <a class="btn-secondary" href="/coach/">Coach Portal</a>
          </div>
          `,
        })}

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
    const planKey = subscription?.plan || subscription?.plan_id || 'free';
    const planName = formatSubscriptionPlanName(planKey);
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
                <span class="account-planLabel">Plano da conta</span>
                ${isBusy ? renderAccountSkeleton() : `
                  <strong class="account-planValue">${escapeHtml(planName)}</strong>
                  <span class="account-planMeta">${escapeHtml(planStatus)}${renewAt ? ` • renova em ${escapeHtml(formatDateShort(renewAt))}` : ''}</span>
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
                <span class="summary-label">Plano pessoal</span>
                <strong class="summary-value">${hasAthletePlus ? 'Atleta Plus' : 'Livre'}</strong>
              </div>
              `}
            </div>

            <div class="coach-list coach-listCompact">
              <div class="coach-listItem static">
                <strong>Sua conta</strong>
                <span>${hasAthletePlus ? 'Atleta Plus ativo' : 'App do atleta liberado para uso diário'}</span>
              </div>
              <div class="coach-listItem static">
                <strong>Próximo passo</strong>
                <span>Abra a página Conta para ver segurança, sync e acesso ao Coach Portal sem misturar isso com o seu treino.</span>
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
                  <p class="account-hint">Digite seu email, receba um código e crie uma nova senha sem sair desta tela.</p>
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
                  <p class="account-hint">Se o email estiver cadastrado, você receberá um código de recuperação.</p>
                  <div class="auth-sheetActions">
                    <button class="btn-secondary" data-action="auth:reset-toggle" type="button">Voltar para entrar</button>
                  </div>
                </div>
              </section>
            </div>
          ` : `
            <div class="auth-intro">
              <div class="section-kicker">CrossApp</div>
              <p class="account-hint">${isSignup ? 'Crie sua conta para salvar treinos, resultados e evolução.' : 'Entre para acompanhar seus treinos, resultados e histórico.'}</p>
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
                  <strong>Esqueceu sua senha?</strong>
                  <p class="account-hint">Peça um código por email e volte ao app com uma nova senha.</p>
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
