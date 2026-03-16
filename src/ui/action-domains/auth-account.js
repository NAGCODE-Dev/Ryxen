import { isDeveloperEmail, isDeveloperProfile } from '../../core/utils/devAccess.js';

let resetCountdownTimer = null;

export async function handleAuthAccountAction(action, el, ctx) {
  const {
    root,
    getUiState,
    setUiState,
    patchUiState,
    rerender,
    resetOpenModalScroll,
    toast,
    normalizeCheckoutPlan,
    hasCheckoutAuth,
    queueCheckoutIntent,
    emptyCoachPortal,
    emptyAthleteOverview,
    emptyCompetitionBrowser,
    loadAccountSnapshot,
    mergeAthleteOverviewSnapshot,
    maybeResumePendingCheckout,
    validatePlanActivation,
  } = ctx;

  function scheduleResetCountdown() {
    clearTimeout(resetCountdownTimer);
    const nextRequestAt = Number(getUiState?.()?.passwordReset?.nextRequestAt || 0);
    if (!nextRequestAt || nextRequestAt <= Date.now()) return;

    resetCountdownTimer = setTimeout(async () => {
      await rerender();
      scheduleResetCountdown();
    }, 1000);
  }

  switch (action) {
    case 'auth:switch': {
      const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
      await patchUiState((s) => ({
        ...s,
        authMode: mode,
        authSubmitting: false,
        passwordReset: {
          ...(s.passwordReset || {}),
          open: false,
          requesting: false,
          confirming: false,
          statusMessage: '',
          statusTone: '',
        },
      }));
      await rerender();
      resetOpenModalScroll?.();
      root.querySelector('#auth-email')?.focus();
      return true;
    }

    case 'auth:submit': {
      const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
      const name = String(root.querySelector('#auth-name')?.value || '').trim();
      const email = String(root.querySelector('#auth-email')?.value || '').trim().toLowerCase();
      const password = String(root.querySelector('#auth-password')?.value || '');

      if (!email) throw new Error('Informe seu email');
      if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');
      if (mode === 'signup' && !name) throw new Error('Informe seu nome');

      await patchUiState((s) => ({ ...s, authSubmitting: true }));
      await rerender();
      resetOpenModalScroll?.();

      let result;
      try {
        result = mode === 'signup'
          ? await window.__APP__.signUp({ name, email, password })
          : await window.__APP__.signIn({ email, password });
      } finally {
        await patchUiState((s) => ({ ...s, authSubmitting: false }));
      }

      if (!result?.token && !result?.user) {
        throw new Error('Falha ao autenticar');
      }

      await setUiState({ modal: null, authMode: 'signin' });
      toast(mode === 'signup' ? 'Conta criada' : 'Login efetuado');
      await rerender();
      const profile = result?.user || window.__APP__?.getProfile?.()?.data || null;
      ctx.hydrateAccountSnapshotInBackground(profile);
      if (await maybeResumePendingCheckout()) return true;
      return true;
    }

    case 'auth:reset-toggle': {
      await patchUiState((s) => ({
        ...s,
        passwordReset: {
          ...(s.passwordReset || {}),
          open: !(s.passwordReset?.open),
          requesting: false,
          confirming: false,
          statusMessage: '',
          statusTone: '',
        },
      }));
      await rerender();
      resetOpenModalScroll?.();
      root.querySelector('#reset-email')?.focus();
      return true;
    }

    case 'auth:reset-request': {
      const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
      if (!email) throw new Error('Informe o email da conta');
      const currentReset = getUiState?.()?.passwordReset || {};
      const cooldownRemaining = Math.max(0, Math.ceil(((currentReset?.nextRequestAt || 0) - Date.now()) / 1000));
      if (cooldownRemaining > 0) {
        throw new Error(`Aguarde ${cooldownRemaining}s para pedir outro código`);
      }

      await patchUiState((s) => ({
        ...s,
        passwordReset: {
          ...(s.passwordReset || {}),
          open: true,
          email,
          requesting: true,
          confirming: false,
          statusMessage: '',
          statusTone: '',
        },
      }));
      await rerender();
      resetOpenModalScroll?.();

      try {
      const result = await window.__APP__.requestPasswordReset({ email });
        const showDeveloperPreview = isDeveloperEmail(email);
        const statusMessage = showDeveloperPreview && result?.previewCode
          ? 'Código gerado para a conta de desenvolvimento.'
          : 'Se o email estiver cadastrado, você receberá um código de recuperação.';
        await patchUiState((s) => ({
          ...s,
          passwordReset: {
            ...(s.passwordReset || {}),
            open: true,
            email,
            requesting: false,
            previewCode: showDeveloperPreview ? (result?.previewCode || '') : '',
            previewUrl: showDeveloperPreview ? (result?.delivery?.previewUrl || '') : '',
            supportEmail: result?.supportEmail || '',
            nextRequestAt: Date.now() + Number(result?.cooldownSeconds || 30) * 1000,
            statusMessage,
            statusTone: 'success',
          },
        }));
        scheduleResetCountdown();
        toast(showDeveloperPreview && result?.previewCode ? 'Código gerado' : 'Pedido de recuperação enviado');
      } catch (err) {
        await patchUiState((s) => ({
          ...s,
          passwordReset: {
            ...(s.passwordReset || {}),
            open: true,
            email,
            requesting: false,
            supportEmail: err?.supportEmail || s?.passwordReset?.supportEmail || '',
            nextRequestAt: Date.now() + Number(err?.retryAfterSeconds || 10) * 1000,
            statusMessage: 'Não conseguimos enviar o código agora. Tente novamente em instantes.',
            statusTone: 'error',
          },
        }));
        scheduleResetCountdown();
        await rerender();
        resetOpenModalScroll?.();
        throw err;
      }
      await rerender();
      resetOpenModalScroll?.();
      return true;
    }

    case 'auth:reset-confirm': {
      const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
      const code = String(root.querySelector('#reset-code')?.value || '').trim();
      const newPassword = String(root.querySelector('#reset-newPassword')?.value || '');
      if (!email || !code || !newPassword) throw new Error('Preencha email, código e nova senha');

      await patchUiState((s) => ({
        ...s,
        passwordReset: {
          ...(s.passwordReset || {}),
          open: true,
          email,
          code,
          confirming: true,
          statusMessage: '',
          statusTone: '',
        },
      }));
      await rerender();
      resetOpenModalScroll?.();

      let result;
      try {
        result = await window.__APP__.confirmPasswordReset({ email, code, newPassword });
      } finally {
        await patchUiState((s) => ({
          ...s,
          passwordReset: {
            ...(s.passwordReset || {}),
            confirming: false,
          },
        }));
      }
      if (!result?.success) throw new Error(result?.error || 'Falha ao redefinir senha');

      await patchUiState((s) => ({
        ...s,
        passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '', statusMessage: '', statusTone: '', nextRequestAt: 0 },
      }));
      clearTimeout(resetCountdownTimer);
      toast('Senha atualizada');
      await rerender();
      resetOpenModalScroll?.();
      return true;
    }

    case 'auth:refresh': {
      const result = await window.__APP__.refreshSession();
      if (!result?.token && !result?.user) throw new Error('Falha ao atualizar sessão');
      const profile = result?.user || window.__APP__?.getProfile?.()?.data || null;
      const ui = getUiState?.() || {};
      toast('Sessão atualizada');
      await rerender();
      ctx.hydrateAccountSnapshotInBackground(profile, ui?.coachPortal?.selectedGymId || null);
      if (await maybeResumePendingCheckout()) return true;
      return true;
    }

    case 'billing:checkout': {
      const plan = normalizeCheckoutPlan(el.dataset.plan || 'coach') || 'coach';
      const profile = window.__APP__?.getProfile?.()?.data || null;
      if (!profile?.email || !hasCheckoutAuth()) {
        queueCheckoutIntent(plan, {
          source: 'app',
          returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        });
        await patchUiState((s) => ({ ...s, modal: 'auth', authMode: 'signin' }));
        toast('Entre para continuar no checkout');
        await rerender();
        return true;
      }
      await window.__APP__.openCheckout(plan);
      return true;
    }

    case 'billing:activate-local': {
      const profile = window.__APP__?.getProfile?.()?.data || null;
      if (!isDeveloperProfile(profile)) {
        throw new Error('Recurso restrito ao ambiente de desenvolvimento');
      }

      const plan = el.dataset.plan || 'coach';
      await window.__APP__.activateMockSubscription(plan);
      const ui = getUiState?.() || {};
      const snapshot = await loadAccountSnapshot(profile, ui?.coachPortal?.selectedGymId || null);
      await patchUiState((s) => ({
        ...s,
        ...snapshot,
        athleteOverview: mergeAthleteOverviewSnapshot(snapshot?.athleteOverview, s?.athleteOverview),
      }));
      toast('Plano Coach local ativado');
      await rerender();
      return true;
    }

    case 'auth:signout': {
      await window.__APP__.signOut();
      await setUiState({
        modal: null,
        authMode: 'signin',
        coachPortal: emptyCoachPortal(),
        athleteOverview: emptyAthleteOverview(),
        competitionBrowser: emptyCompetitionBrowser(),
        admin: { overview: null, health: null, manualReset: null, query: '' },
      });
      toast('Sessão encerrada');
      await rerender();
      return true;
    }

    case 'auth:sync-push': {
      const result = await window.__APP__.syncPush();
      if (!result?.success) throw new Error(result?.error || 'Falha ao enviar sync');
      toast('Sync enviado');
      await rerender();
      return true;
    }

    case 'auth:sync-pull': {
      const result = await window.__APP__.syncPull();
      if (!result?.success) throw new Error(result?.error || 'Falha ao baixar sync');
      toast('Sync atualizado');
      await rerender();
      return true;
    }

    case 'admin:refresh': {
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const [overviewResult, healthResult] = await Promise.all([
        window.__APP__.getAdminOverview({ q: query, limit: 25, verify: true }),
        window.__APP__.getAdminOpsHealth({ verify: true }),
      ]);
      await setUiState({
        admin: {
          overview: overviewResult?.data || null,
          health: healthResult?.data || null,
          manualReset: null,
          query,
        },
      });
      toast('Painel admin atualizado');
      await rerender();
      return true;
    }

    case 'admin:activate-plan': {
      const userId = Number(el.dataset.userId);
      const planId = String(el.dataset.planId || '').trim().toLowerCase();
      validatePlanActivation(userId, planId);

      const confirmed = confirm(`Ativar plano ${planId} para este usuário por 30 dias?`);
      if (!confirmed) return true;

      await window.__APP__.activateCoachSubscription(userId, planId, 30);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const [overviewResult, healthResult] = await Promise.all([
        window.__APP__.getAdminOverview({ q: query, limit: 25, verify: true }),
        window.__APP__.getAdminOpsHealth({ verify: true }),
      ]);
      await setUiState({
        admin: {
          overview: overviewResult?.data || null,
          health: healthResult?.data || null,
          manualReset: null,
          query,
        },
      });
      toast(`Plano ${planId} ativado`);
      await rerender();
      return true;
    }

    case 'admin:reprocess-claim': {
      const claimId = Number(el.dataset.claimId);
      if (!Number.isFinite(claimId) || claimId <= 0) {
        throw new Error('Claim inválida');
      }

      const confirmed = confirm('Reprocessar esta claim de billing agora?');
      if (!confirmed) return true;

      await window.__APP__.reprocessBillingClaim(claimId);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const [overviewResult, healthResult] = await Promise.all([
        window.__APP__.getAdminOverview({ q: query, limit: 25, verify: true }),
        window.__APP__.getAdminOpsHealth({ verify: true }),
      ]);
      await setUiState({
        admin: {
          overview: overviewResult?.data || null,
          health: healthResult?.data || null,
          manualReset: null,
          query,
        },
      });
      toast('Claim reprocessada');
      await rerender();
      return true;
    }

    case 'admin:retry-email-job': {
      const jobId = Number(el.dataset.jobId);
      if (!Number.isFinite(jobId) || jobId <= 0) {
        throw new Error('Job de email inválido');
      }

      const confirmed = confirm('Reenviar este email agora?');
      if (!confirmed) return true;

      await window.__APP__.retryEmailJob(jobId);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const [overviewResult, healthResult] = await Promise.all([
        window.__APP__.getAdminOverview({ q: query, limit: 25, verify: true }),
        window.__APP__.getAdminOpsHealth({ verify: true }),
      ]);
      await setUiState({
        admin: {
          overview: overviewResult?.data || null,
          health: healthResult?.data || null,
          manualReset: null,
          query,
        },
      });
      toast('Email reenviado');
      await rerender();
      return true;
    }

    case 'admin:create-manual-reset': {
      const userId = Number(el.dataset.userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error('Usuário inválido');
      }

      const confirmed = confirm('Gerar um código manual de recuperação para este usuário?');
      if (!confirmed) return true;

      const resetResult = await window.__APP__.createManualPasswordReset(userId);
      const query = String(root.querySelector('#admin-search')?.value || '').trim();
      const [overviewResult, healthResult] = await Promise.all([
        window.__APP__.getAdminOverview({ q: query, limit: 25, verify: true }),
        window.__APP__.getAdminOpsHealth({ verify: true }),
      ]);
      await setUiState({
        admin: {
          overview: overviewResult?.data || null,
          health: healthResult?.data || null,
          manualReset: resetResult?.data || null,
          query,
        },
      });
      toast('Código manual gerado');
      await rerender();
      return true;
    }

    default:
      return false;
  }
}
