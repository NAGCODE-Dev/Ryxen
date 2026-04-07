export function renderAthleteAuthModal({ auth = {}, authMode = 'signin', helpers = {} } = {}) {
  const {
    escapeHtml,
    formatDateShort,
    renderAccountSkeleton,
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    isDeveloperEmail,
    normalizeAthleteBenefits,
  } = helpers;

  const profile = auth?.profile || null;
  const isAuthenticated = !!profile?.email;
  const isBusy = !!auth?.isBusy;
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const resetStep = reset?.step === 'confirm' ? 'confirm' : 'request';
  const signupVerification = auth?.signupVerification || {};
  const rememberedEmail = signupVerification.email || reset.email || '';
  const admin = auth?.admin || {};
  const coachPortal = auth?.coachPortal || {};
  const athleteOverview = auth?.athleteOverview || {};

  if (isAuthenticated) {
    const isAdmin = !!profile?.is_admin || !!profile?.isAdmin;
    const overview = admin?.overview || null;
    const entitlements = coachPortal?.entitlements || [];
    const canCoachManage = entitlements.includes('coach_portal');
    const canAthleteUseApp = entitlements.includes('athlete_app');
    const subscription = coachPortal?.subscription || null;
    const gyms = coachPortal?.gyms || [];
    const athleteStats = athleteOverview?.stats || {};
    const athleteBenefits = normalizeAthleteBenefits(athleteOverview?.athleteBenefits || null);
    const planKey = subscription?.plan || subscription?.plan_id || 'free';
    const planName = formatSubscriptionPlanName(planKey);
    const planStatus = subscription?.status || 'inactive';
    const canUseDeveloperTools = isDeveloperEmail(profile?.email);
    const renewAt = subscription?.renewAt || subscription?.renew_at || null;
    const hasActiveCoachSubscription = planStatus === 'active' && (planKey === 'pro' || planKey === 'coach');
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
              `}
            </div>

            <div class="settings-actions account-actions">
              <button class="btn-secondary" data-action="auth:refresh" type="button">Atualizar</button>
              <button class="btn-secondary" data-action="modal:close" type="button">Fechar</button>
            </div>

            <div class="auth-intro">
              <div class="section-kicker">Coach</div>
              <p class="account-hint">${canCoachManage || canUseDeveloperTools
                ? 'O portal do coach continua separado do app do atleta. Use sua mesma conta para abrir o workspace do box.'
                : hasActiveCoachSubscription
                  ? 'Seu plano está ativo, mas o portal do coach só libera quando sua conta está vinculada a um gym com permissão de gestão.'
                  : 'Seu acesso de coach está bloqueado. Ative um plano quando quiser operar box, atletas e grupos no portal separado. O app do atleta continua liberado.'}</p>
              <div class="coach-pillRow">
                <span class="coach-pill ${canCoachManage ? 'isGood' : 'isWarn'}">${canCoachManage ? 'Coach liberado' : 'Coach bloqueado'}</span>
                <span class="coach-pill ${canAthleteUseApp ? 'isGood' : 'isWarn'}">${canAthleteUseApp ? 'Atleta liberado' : 'Atleta bloqueado'}</span>
                <span class="coach-pill">${gyms.length} gym(s)</span>
              </div>
              <div class="settings-actions coach-billingActions">
                ${!canCoachManage ? '<button class="btn-primary" data-action="billing:checkout" data-plan="coach" type="button">Assinar Coach</button>' : ''}
                ${!canCoachManage && canUseDeveloperTools ? '<button class="btn-secondary" data-action="billing:activate-local" data-plan="coach" type="button">Ativar local</button>' : ''}
                <a class="btn-secondary" href="/coach/index.html" target="_blank" rel="noopener noreferrer">Abrir portal</a>
                ${!canCoachManage ? '<a class="btn-secondary" href="/pricing.html" target="_blank" rel="noopener noreferrer">Ver planos</a>' : ''}
              </div>
            </div>

            ${isAdmin ? renderAdminSection({ overview, admin, escapeHtml, formatDateShort }) : ''}

            <div class="settings-actions">
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
          <h2 class="modal-title">${isSignup ? 'Criar conta' : 'Entrar'}</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          <div class="auth-intro auth-intro-auth">
            <div class="section-kicker">${isSignup ? 'Criar conta' : 'Entrar'}</div>
            <p class="account-hint">${isSignup
              ? 'Crie sua conta para salvar treino, histórico e progresso sem misturar isso com a operação do box.'
              : 'Entre para retomar treino, histórico e progresso exatamente de onde parou.'}</p>
          </div>

          <div class="auth-switch">
            <button class="btn-secondary ${!isSignup ? 'isSelected' : ''}" data-action="auth:switch" data-mode="signin" type="button">Entrar</button>
            <button class="btn-secondary ${isSignup ? 'isSelected' : ''}" data-action="auth:switch" data-mode="signup" type="button">Cadastrar</button>
          </div>

          <div class="auth-googleBlock" id="google-signin-shell">
            <div id="google-signin-button"></div>
          </div>

          <div class="auth-divider">ou continue com email</div>

          <form class="auth-form" id="ui-authForm">
            <input class="add-input" id="auth-name" type="text" placeholder="Seu nome" autocomplete="name" value="${escapeHtml(signupVerification.name || '')}" ${isSignup ? '' : 'style="display:none"'} />
            <input class="add-input" id="auth-email" type="email" inputmode="email" autocapitalize="off" autocomplete="email username" placeholder="Seu email" value="${escapeHtml(rememberedEmail)}" />
            <input class="add-input" id="auth-password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="Sua senha" />
            ${isSignup ? `
              <div class="auth-signupVerify">
                <button class="btn-secondary" data-action="auth:signup-request-code" type="button">Enviar código</button>
                <input class="add-input" id="auth-signup-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Código de verificação" value="${escapeHtml(signupVerification.code || signupVerification.previewCode || '')}" />
                ${signupVerification?.previewCode ? `
                  <div class="reset-codePreview">
                    Código temporário: <strong>${escapeHtml(signupVerification.previewCode)}</strong>
                  </div>
                ` : ''}
                ${signupVerification?.previewUrl ? `
                  <a class="reset-previewLink" href="${escapeHtml(signupVerification.previewUrl)}" target="_blank" rel="noopener noreferrer">
                    Abrir preview do email
                  </a>
                ` : ''}
                <p class="account-hint">Digite o código enviado ao seu email.</p>
              </div>
            ` : ''}
            <button class="btn-primary auth-submitButton" data-action="auth:submit" data-mode="${escapeHtml(authMode)}" type="button">
              ${isSignup ? 'Criar conta com código' : 'Entrar'}
            </button>
            ${!isSignup && reset?.message && !reset?.open ? `
              <p class="account-hint auth-inlineStatus">${escapeHtml(reset.message)}</p>
            ` : ''}
          </form>

          ${!isSignup ? renderPasswordResetBox({ reset, resetStep, escapeHtml }) : ''}
        </div>
      </div>
    </div>
  `;
}

function renderAdminSection({ overview, admin, escapeHtml, formatDateShort }) {
  return `
    <details class="account-fold account-section-admin">
      <summary class="account-foldSummary">
        <div>
          <div class="section-kicker">Admin</div>
          <strong>Painel administrativo</strong>
        </div>
        <span class="account-foldMeta">${Number(overview?.stats?.users || 0)} usuários • ${Number(overview?.stats?.activeSubscriptions || 0)} assinaturas</span>
      </summary>
      <div class="account-foldBody">
      <div class="account-sectionHead">
        <div></div>
        <button class="btn-secondary" data-action="admin:refresh" type="button">Atualizar</button>
      </div>
      <div class="admin-toolbar">
        <input class="add-input" id="admin-search" type="text" placeholder="Buscar por nome ou email" value="${escapeHtml(admin?.query || '')}" />
        <button class="btn-secondary" data-action="admin:refresh" type="button">Buscar</button>
      </div>
      ${overview ? `
        <div class="admin-stats">
          <div class="admin-statCard">
            <span class="admin-statLabel">Usuários</span>
            <span class="admin-statValue">${Number(overview?.stats?.users || 0)}</span>
          </div>
          <div class="admin-statCard">
            <span class="admin-statLabel">Assinaturas ativas</span>
            <span class="admin-statValue">${Number(overview?.stats?.activeSubscriptions || 0)}</span>
          </div>
          <div class="admin-statCard">
            <span class="admin-statLabel">Exclusões pendentes</span>
            <span class="admin-statValue">${Number(overview?.stats?.pendingAccountDeletions || 0)}</span>
          </div>
        </div>
        <div class="admin-userList">
          ${(overview?.users || []).map((user) => `
            <div class="admin-userRow">
              <div>
                <div class="admin-userName">${escapeHtml(user.name || 'Sem nome')}</div>
                <div class="admin-userEmail">${escapeHtml(user.email || '')}</div>
                <div class="account-hint">
                  Plano: ${escapeHtml(user.subscription_plan || 'free')} • ${escapeHtml(user.subscription_status || 'inactive')}
                  ${user.subscription_renew_at ? ` • renova em ${escapeHtml(formatDateShort(user.subscription_renew_at))}` : ''}
                </div>
                ${user.pendingDeletion ? `
                  <div class="account-hint" style="color:#f3c87b;">
                    Exclusão pendente • apaga em ${escapeHtml(formatDateShort(user.pendingDeletion.delete_after || user.pendingDeletion.deleteAfter || ''))}
                  </div>
                ` : ''}
              </div>
              <div class="admin-userControls">
                <div class="admin-userMeta">${user.is_admin ? 'Admin' : 'User'}</div>
                <div class="admin-userActions">
                  <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="starter" type="button">Starter</button>
                  <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="pro" type="button">Pro</button>
                  <button class="btn-secondary" data-action="admin:activate-plan" data-user-id="${Number(user.id)}" data-plan-id="performance" type="button">Performance</button>
                  <button class="btn-secondary" data-action="admin:request-delete" data-user-id="${Number(user.id)}" data-user-email="${escapeHtml(user.email || '')}" type="button">${user.pendingDeletion ? 'Reenviar deleção' : 'Pedir deleção'}</button>
                  <button class="btn-secondary" data-action="admin:delete-now" data-user-id="${Number(user.id)}" data-user-email="${escapeHtml(user.email || '')}" type="button">Excluir agora</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <p class="account-hint">Carregue os dados do painel para ver os últimos usuários.</p>
      `}
      </div>
    </details>
  `;
}

function renderPasswordResetBox({ reset, resetStep, escapeHtml }) {
  return `
    <div class="auth-assist">
      <button class="auth-resetToggle ${reset?.open ? 'isOpen' : ''}" data-action="auth:reset-toggle" type="button">
        ${reset?.open ? 'Voltar ao login' : 'Esqueci minha senha'}
      </button>

      ${reset?.open ? `
        <div class="auth-resetBox">
          <div class="auth-resetIntro">
            <strong>Recuperar senha</strong>
            <p class="account-hint">${resetStep === 'confirm'
              ? 'Agora informe o codigo recebido e defina sua nova senha.'
              : 'Digite o email da conta para receber um codigo de recuperacao.'}</p>
          </div>
          <div class="auth-resetForm">
          <input class="add-input" id="reset-email" type="email" inputmode="email" autocapitalize="off" autocomplete="email username" placeholder="Email da conta" value="${escapeHtml(reset.email || '')}" />
          <button class="btn-secondary auth-resetRequestButton" data-action="auth:reset-request" type="button" ${Number(reset?.cooldownUntil || 0) > Date.now() ? 'disabled' : ''}>${escapeHtml(formatCooldownLabel(reset?.cooldownUntil || 0))}</button>
          ${resetStep === 'confirm' ? `
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
          <input class="add-input" id="reset-code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Código de 6 dígitos" value="${escapeHtml(reset.code || '')}" />
          <input class="add-input" id="reset-newPassword" type="password" autocomplete="new-password" placeholder="Nova senha" />
          <button class="btn-primary auth-resetConfirmButton" data-action="auth:reset-confirm" type="button">Trocar senha</button>
          ` : ''}
          ${reset?.message ? `
            <p class="account-hint auth-resetStatus">${escapeHtml(reset.message)}</p>
          ` : `
            <p class="account-hint auth-resetStatus">Vamos enviar um codigo de 6 digitos para o email da conta.</p>
          `}
        </div>
        </div>
      ` : ''}
    </div>
  `;
}

function formatCooldownLabel(cooldownUntil) {
  const remainingMs = Number(cooldownUntil || 0) - Date.now();
  if (remainingMs <= 0) return 'Gerar código';
  return `Aguardar ${Math.ceil(remainingMs / 1000)}s`;
}
