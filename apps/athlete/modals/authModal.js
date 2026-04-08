import {
  renderAuthenticatedAccountView,
  renderGuestAuthView,
} from './authModalSections.js';

export function renderAthleteAuthModal({ auth = {}, authMode = 'signin', helpers = {} } = {}) {
  const {
    escapeHtml,
  } = helpers;

  const profile = auth?.profile || null;
  const isAuthenticated = !!profile?.email;
  const isBusy = !!auth?.isBusy;
  const isSignup = authMode === 'signup';
  const reset = auth?.passwordReset || auth?.reset || {};
  const signupVerification = auth?.signupVerification || {};
  const admin = auth?.admin || {};
  const coachPortal = auth?.coachPortal || {};
  const athleteOverview = auth?.athleteOverview || {};

  if (isAuthenticated) {
    return renderAuthenticatedAccountView({
      profile,
      isBusy,
      admin,
      coachPortal,
      athleteOverview,
      helpers,
    });
  }

  return renderGuestAuthView({
    isSignup,
    authMode,
    reset,
    signupVerification,
    escapeHtml,
  });
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
