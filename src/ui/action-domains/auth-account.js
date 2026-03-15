import { isDeveloperEmail, isDeveloperProfile } from '../../core/utils/devAccess.js';

export async function handleAuthAccountAction(action, el, ctx) {
  const {
    root,
    getUiState,
    setUiState,
    patchUiState,
    rerender,
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

  switch (action) {
    case 'auth:switch': {
      const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
      await setUiState({ authMode: mode });
      await rerender();
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

      const result = mode === 'signup'
        ? await window.__APP__.signUp({ name, email, password })
        : await window.__APP__.signIn({ email, password });

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
          statusMessage: '',
          statusTone: '',
        },
      }));
      await rerender();
      root.querySelector('#reset-email')?.focus();
      return true;
    }

    case 'auth:reset-request': {
      const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
      if (!email) throw new Error('Informe o email da conta');

      try {
        const result = await window.__APP__.requestPasswordReset({ email });
        const showDeveloperPreview = isDeveloperEmail(email);
        const statusMessage = showDeveloperPreview && result?.previewCode
          ? 'Código gerado para a conta de desenvolvimento.'
          : (result?.message || 'Código de recuperação enviado para o email.');
        await patchUiState((s) => ({
          ...s,
          passwordReset: {
            ...(s.passwordReset || {}),
            open: true,
            email,
            previewCode: showDeveloperPreview ? (result?.previewCode || '') : '',
            previewUrl: showDeveloperPreview ? (result?.delivery?.previewUrl || '') : '',
            supportEmail: result?.supportEmail || '',
            statusMessage,
            statusTone: 'success',
          },
        }));
        toast(showDeveloperPreview && result?.previewCode ? 'Código gerado' : 'Pedido de recuperação enviado');
      } catch (err) {
        await patchUiState((s) => ({
          ...s,
          passwordReset: {
            ...(s.passwordReset || {}),
            open: true,
            email,
            supportEmail: err?.supportEmail || s?.passwordReset?.supportEmail || '',
            statusMessage: err?.message || 'Não foi possível enviar o email de recuperação',
            statusTone: 'error',
          },
        }));
        await rerender();
        throw err;
      }
      await rerender();
      return true;
    }

    case 'auth:reset-confirm': {
      const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
      const code = String(root.querySelector('#reset-code')?.value || '').trim();
      const newPassword = String(root.querySelector('#reset-newPassword')?.value || '');
      if (!email || !code || !newPassword) throw new Error('Preencha email, código e nova senha');

      const result = await window.__APP__.confirmPasswordReset({ email, code, newPassword });
      if (!result?.success) throw new Error(result?.error || 'Falha ao redefinir senha');

      await patchUiState((s) => ({
        ...s,
        passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '', statusMessage: '', statusTone: '' },
      }));
      toast('Senha atualizada');
      await rerender();
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
        admin: { overview: null, query: '' },
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
      const result = await window.__APP__.getAdminOverview({ q: query, limit: 25 });
      await setUiState({ admin: { overview: result?.data || null, query } });
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
      const result = await window.__APP__.getAdminOverview({ q: query, limit: 25 });
      await setUiState({ admin: { overview: result?.data || null, query } });
      toast(`Plano ${planId} ativado`);
      await rerender();
      return true;
    }

    default:
      return false;
  }
}
