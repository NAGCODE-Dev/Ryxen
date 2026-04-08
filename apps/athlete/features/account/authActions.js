import {
  handleAthletePasswordResetAction,
} from './authResetActions.js';
import { handleAthleteAuthFlowAction } from './authFlowActions.js';

export async function handleAthleteAuthAction(action, context) {
  const {
    root,
    getUiState,
    isDeveloperEmail,
  } = context;

  const handledByReset = await handleAthletePasswordResetAction(action, {
    ...context,
    isDeveloperEmail,
  });
  if (handledByReset) return true;

  return handleAthleteAuthFlowAction(action, context);
}

export function handleAthleteAuthEnterKey(event, context) {
  const { root, getUiState } = context;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (event.key !== 'Enter') return false;

  const modal = getUiState?.()?.modal || null;
  if (modal !== 'auth') return false;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLTextAreaElement) return false;
  if (activeElement instanceof HTMLButtonElement) return false;

  const ui = getUiState?.() || {};
  const authMode = ui.authMode === 'signup' ? 'signup' : 'signin';
  const reset = ui.passwordReset || {};

  const trigger = reset?.open && reset?.step === 'confirm'
    ? root.querySelector('[data-action="auth:reset-confirm"]')
    : reset?.open
      ? root.querySelector('[data-action="auth:reset-request"]')
      : root.querySelector(`[data-action="auth:submit"][data-mode="${authMode}"]`);

  if (!trigger) return false;

  event.preventDefault();
  trigger.click();
  return true;
}
