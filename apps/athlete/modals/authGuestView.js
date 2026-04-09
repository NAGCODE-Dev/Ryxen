import {
  renderGuestIntroSection,
  renderGuestSwitchSection,
  renderPasswordResetBox,
  renderSignupVerificationBox,
} from './authGuestSections.js';
import { getTrustedDeviceUiState, renderTrustedDeviceStatus } from '../features/account/trustedDeviceUi.js';

export function renderGuestAuthView({
  isSignup,
  authMode,
  reset,
  signupVerification,
  escapeHtml,
}) {
  const rememberedEmail = signupVerification.email || reset.email || '';
  const trustedDeviceUi = getTrustedDeviceUiState(rememberedEmail);
  const initialEmail = rememberedEmail || trustedDeviceUi.resolvedEmail || '';

  return `
    <div class="modal-overlay modal-overlay-auth isOpen" id="ui-authModalBackdrop">
      <div class="modal-container modal-container-auth">
        <div class="modal-header">
          <h2 class="modal-title">${isSignup ? 'Criar conta' : 'Entrar'}</h2>
          <button class="modal-close" data-action="modal:close" type="button">✕</button>
        </div>

        <div class="modal-body modal-body-auth">
          ${renderGuestIntroSection({ isSignup })}
          ${renderGuestSwitchSection({ isSignup })}

          <div class="auth-googleBlock" id="google-signin-shell">
            <div id="google-signin-button"></div>
          </div>

          <div class="auth-divider">ou continue com email</div>

          <form class="auth-form" id="ui-authForm">
            <input class="add-input" id="auth-name" type="text" placeholder="Seu nome" autocomplete="name" value="${escapeHtml(signupVerification.name || '')}" ${isSignup ? '' : 'style="display:none"'} />
            <input class="add-input" id="auth-email" type="email" inputmode="email" autocapitalize="off" autocomplete="email username" placeholder="Seu email" value="${escapeHtml(initialEmail)}" />
            <input class="add-input" id="auth-password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${escapeHtml(isSignup ? 'Sua senha' : trustedDeviceUi.passwordPlaceholder)}" />
            ${!isSignup ? renderTrustedDeviceStatus({ email: initialEmail, escapeHtml }) : ''}
            ${isSignup ? renderSignupVerificationBox({ signupVerification, escapeHtml }) : ''}
            <button class="btn-primary auth-submitButton" data-action="auth:submit" data-mode="${escapeHtml(authMode)}" type="button">
              ${isSignup ? 'Criar conta com código' : escapeHtml(trustedDeviceUi.submitLabel)}
            </button>
            ${!isSignup ? `
              <button
                class="btn-secondary auth-trustedSubmitButton"
                data-action="auth:trusted-submit"
                type="button"
                ${trustedDeviceUi.isTrusted ? '' : 'hidden'}
              >
                ${escapeHtml(trustedDeviceUi.trustedSubmitLabel)}
              </button>
            ` : ''}
            ${!isSignup && reset?.message && !reset?.open ? `
              <p class="account-hint auth-inlineStatus">${escapeHtml(reset.message)}</p>
            ` : ''}
          </form>

          ${!isSignup ? renderPasswordResetBox({ reset, escapeHtml }) : ''}
        </div>
      </div>
    </div>
  `;
}
