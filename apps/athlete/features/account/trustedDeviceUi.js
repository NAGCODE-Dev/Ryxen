import { hasTrustedDeviceGrant } from '../../../../src/core/services/authService.js';

export function getTrustedDeviceUiState(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const isTrusted = !!normalizedEmail && hasTrustedDeviceGrant(normalizedEmail);

  if (isTrusted) {
    return {
      isTrusted: true,
      submitLabel: 'Entrar neste aparelho',
      passwordPlaceholder: 'Senha (opcional neste aparelho)',
      hintTitle: 'Aparelho reconhecido',
      hintBody: 'Voce pode entrar so com o email agora. Se preferir, a senha continua funcionando normalmente.',
    };
  }

  if (normalizedEmail) {
    return {
      isTrusted: false,
      submitLabel: 'Entrar',
      passwordPlaceholder: 'Sua senha',
      hintTitle: 'Primeiro acesso neste aparelho',
      hintBody: 'Use email e senha para autorizar este aparelho. Depois disso, o proximo login pode ser so com o email.',
    };
  }

  return {
    isTrusted: false,
    submitLabel: 'Entrar',
    passwordPlaceholder: 'Sua senha',
    hintTitle: 'Login rapido neste aparelho',
    hintBody: 'Digite seu email. Se este aparelho ja estiver confiavel para essa conta, a senha fica opcional.',
  };
}

export function renderTrustedDeviceStatus({ email, escapeHtml }) {
  const ui = getTrustedDeviceUiState(email);
  return `
    <div class="auth-trustedStatus${ui.isTrusted ? ' isTrusted' : ''}" data-auth-trusted-status>
      <strong class="auth-trustedTitle">${escapeHtml(ui.hintTitle)}</strong>
      <p class="account-hint auth-inlineStatus">${escapeHtml(ui.hintBody)}</p>
    </div>
  `;
}

export function syncTrustedDeviceAuthUi(root) {
  if (!(root instanceof HTMLElement) && !(root instanceof Document)) return;

  const emailInput = root.querySelector('#auth-email');
  const passwordInput = root.querySelector('#auth-password');
  const submitButton = root.querySelector('[data-action="auth:submit"][data-mode="signin"]');
  const status = root.querySelector('[data-auth-trusted-status]');
  const title = status?.querySelector('.auth-trustedTitle');
  const body = status?.querySelector('.auth-inlineStatus');
  const form = root.querySelector('#ui-authForm');

  if (!(emailInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) return;

  const ui = getTrustedDeviceUiState(emailInput.value);

  passwordInput.placeholder = ui.passwordPlaceholder;
  form?.classList.toggle('isTrustedDeviceReady', ui.isTrusted);
  status?.classList.toggle('isTrusted', ui.isTrusted);

  if (submitButton) {
    submitButton.textContent = ui.submitLabel;
  }
  if (title) {
    title.textContent = ui.hintTitle;
  }
  if (body) {
    body.textContent = ui.hintBody;
  }
}
