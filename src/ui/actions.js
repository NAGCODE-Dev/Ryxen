export function setupActions({ root, toast, rerender, getUiState, setUiState, patchUiState }) {
  if (!root) throw new Error('setupActions: root é obrigatório');

  const emptyCoachPortal = () => ({
    subscription: null,
    entitlements: [],
    gymAccess: [],
    gyms: [],
    benchmarks: [],
    benchmarkQuery: '',
    benchmarkCategory: '',
    feed: [],
    selectedGymId: null,
    members: [],
    insights: null,
  });

  const emptyAthleteOverview = () => ({
    stats: null,
    recentResults: [],
    upcomingCompetitions: [],
    recentWorkouts: [],
    gymAccess: [],
  });

  async function loadCoachPortalSnapshot(selectedGymId) {
    try {
      const [subscriptionResult, entitlementsResult, accessResult, gymsResult, benchmarksResult, feedResult] = await Promise.all([
        window.__APP__?.getSubscriptionStatus?.(),
        window.__APP__?.getEntitlements?.(),
        window.__APP__?.getAccessContext?.(),
        window.__APP__?.getMyGyms?.(),
        window.__APP__?.getBenchmarks?.({ limit: 20 }),
        window.__APP__?.getWorkoutFeed?.(),
      ]);

      const gyms = gymsResult?.data?.gyms || [];
      const resolvedGymId = selectedGymId || gyms[0]?.id || null;
      const [membersResult, insightsResult] = resolvedGymId
        ? await Promise.all([
            window.__APP__?.listGymMembers?.(resolvedGymId),
            window.__APP__?.getGymInsights?.(resolvedGymId),
          ])
        : [null, null];

      return {
        subscription: subscriptionResult?.data || null,
        entitlements: entitlementsResult?.data?.entitlements || [],
        gymAccess: entitlementsResult?.data?.gymAccess || accessResult?.data?.gyms || [],
        gyms,
        benchmarks: benchmarksResult?.data?.benchmarks || [],
        benchmarkQuery: '',
        benchmarkCategory: '',
        feed: feedResult?.data?.workouts || [],
        selectedGymId: resolvedGymId,
        members: membersResult?.data?.memberships || [],
        insights: insightsResult?.data || null,
      };
    } catch {
      return emptyCoachPortal();
    }
  }

  async function loadAthleteOverview() {
    try {
      const result = await window.__APP__?.getAthleteDashboard?.();
      return result?.data || emptyAthleteOverview();
    } catch {
      return emptyAthleteOverview();
    }
  }

  async function loadAccountSnapshot(profile, selectedGymId) {
    const nextState = {
      coachPortal: emptyCoachPortal(),
      athleteOverview: emptyAthleteOverview(),
      admin: { overview: null, query: '' },
    };

    if (!profile?.email) {
      return nextState;
    }

    try {
      const currentPrs = window.__APP__?.getState?.()?.prs || {};
      if (currentPrs && Object.keys(currentPrs).length) {
        await window.__APP__?.syncAthletePrSnapshot?.(currentPrs);
      }
    } catch {}

    const [coachPortal, athleteOverview] = await Promise.all([
      loadCoachPortalSnapshot(selectedGymId),
      loadAthleteOverview(),
    ]);

    nextState.coachPortal = coachPortal;
    nextState.athleteOverview = athleteOverview;

    if (profile?.is_admin || profile?.isAdmin) {
      try {
        const adminResult = await window.__APP__?.getAdminOverview?.({ limit: 25 });
        nextState.admin = { overview: adminResult?.data || null, query: '' };
      } catch {
        nextState.admin = { overview: null, query: '' };
      }
    }

    return nextState;
  }

  async function syncAthletePrIfAuthenticated(exercise, value) {
    const profile = window.__APP__?.getProfile?.()?.data || null;
    if (!profile?.email) return null;

    try {
      await window.__APP__?.logAthletePr?.({
        exercise,
        value,
        unit: 'kg',
        source: 'app',
      });
      const athleteOverview = await loadAthleteOverview();
      await patchUiState((s) => ({ ...s, athleteOverview }));
      return athleteOverview;
    } catch {
      return null;
    }
  }
  
  // Busca de PRs (filtra em tempo real)
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || t.id !== 'ui-prsSearch') return;
    filterPrs(root, t.value);
  });

  function filterPrs(root, query) {
    const q = String(query || '').trim().toUpperCase();
    const table = root.querySelector('#ui-prsTable');
    if (!table) return;

    const items = Array.from(table.querySelectorAll('.pr-item'));
    let visible = 0;

    for (const item of items) {
      const ex = String(item.getAttribute('data-exercise') || '').toUpperCase();
      const show = !q || ex.includes(q);
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    }

    const countEl = root.querySelector('#ui-prsCount');
    if (countEl) countEl.textContent = `${visible} PRs`;
  }

  // Clicks (delegação)
  root.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    try {
      switch (action) {
        // ----- PDF / semana / treino -----
        case 'pdf:pick': {
          const file = await pickPdfFile();
          if (!file) return;
          await window.__APP__.uploadMultiWeekPdf(file);
          await rerender();
          return;
        }

        case 'media:pick': {
          const file = await pickUniversalFile();
          if (!file) return;

          if (typeof window.__APP__?.importFromFile !== 'function') {
            throw new Error('Importação universal não disponível');
          }

          const result = await window.__APP__.importFromFile(file);
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao importar arquivo');
          }

          toast('Arquivo importado');
          await rerender();
          return;
        }

        case 'pdf:clear': {
          const ok = confirm(
            '⚠️ Limpar todos os PDFs salvos?\n\n' +
            'Isso removerá todas as semanas carregadas. Esta ação não pode ser desfeita.'
          );
          if (!ok) return;

          const result = await window.__APP__.clearAllPdfs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao limpar PDFs');

          toast('Todos os PDFs removidos');
          await rerender();
          return;
        }

        case 'week:select': {
          const week = Number(el.dataset.week);
          if (!Number.isFinite(week)) return;

          await window.__APP__.selectWeek(week);
          await rerender();
          return;
        }

        case 'day:auto': {
          if (typeof window.__APP__?.resetDay === 'function') {
            const result = await window.__APP__.resetDay();
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          } else if (typeof window.__APP__?.setDay === 'function') {
            const result = await window.__APP__.setDay('');
            if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
          }
          toast('Dia automático');
          await rerender();
          return;
        }

        case 'workout:copy': {
          const st = window.__APP__?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = await window.__APP__.copyWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao copiar');

          toast('Treino copiado');
          return;
        }

        case 'workout:export': {
          const st = window.__APP__?.getState?.() || {};
          const blocks = st?.workoutOfDay?.blocks || st?.workout?.blocks || [];
          if (!blocks.length) {
            toast('Nenhum treino carregado');
            return;
          }

          const result = window.__APP__.exportWorkout();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar');

          toast('Exportado');
          return;
        }

        case 'workout:import': {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';
          
          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;
            
            try {
              const result = await window.__APP__.importWorkout(file);
              if (result?.success) {
                toast('✅ Treino importado!'); // 🔥 ADICIONA TOAST
                await rerender();
              } else {
                toast(result?.error || 'Erro ao importar');
              }
            } catch (err) {
              toast(err?.message || 'Erro ao importar');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });
          
          document.body.appendChild(input);
          input.click();
          return;
        }

        case 'backup:export': {
          if (typeof window.__APP__?.exportBackup !== 'function') {
            throw new Error('Backup não disponível nesta versão');
          }

          const result = await window.__APP__.exportBackup();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar backup');

          toast('Backup exportado');
          return;
        }

        case 'backup:import': {
          if (typeof window.__APP__?.importBackup !== 'function') {
            throw new Error('Restauração não disponível nesta versão');
          }

          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';

          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;

            try {
              const result = await window.__APP__.importBackup(file);
              if (!result?.success) {
                throw new Error(result?.error || 'Falha ao restaurar backup');
              }
              toast('Backup restaurado');
              await rerender();
            } catch (err) {
              toast(err?.message || 'Erro ao restaurar backup');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });

          document.body.appendChild(input);
          input.click();
          return;
        }

        // ----- Modais -----
        case 'modal:open': {
          const modal = el.dataset.modal || null;
          if (modal === 'auth') {
            const profile = window.__APP__?.getProfile?.()?.data || null;
            const snapshot = await loadAccountSnapshot(profile);
            await setUiState({ modal, ...snapshot });
          } else {
            await setUiState({ modal });
          }
          await rerender();

          if (modal === 'prs') root.querySelector('#ui-prsSearch')?.focus();
          if (modal === 'auth') root.querySelector('#auth-email')?.focus();
          return;
        }

        case 'modal:close': {
          await setUiState({ modal: null });
          await rerender();
          return;
        }

        case 'page:set': {
          const page = String(el.dataset.page || 'today');
          await patchUiState((s) => ({ ...s, currentPage: page }));
          await rerender();
          return;
        }

        case 'prs:open': {
          await setUiState({ modal: 'prs' });
          await rerender();
          root.querySelector('#ui-prsSearch')?.focus();
          return;
        }

        case 'prs:close': {
          await setUiState({ modal: null });
          await rerender();
          return;
        }

        // ----- Config -----
        case 'settings:save': {
          const showLbsConversion = !!root.querySelector('#setting-showLbsConversion')?.checked;
          const showEmojis = !!root.querySelector('#setting-showEmojis')?.checked;
          const showObjectivesInWods = !!root.querySelector('#setting-showObjectives')?.checked;

          if (typeof window.__APP__?.setPreferences === 'function') {
            const corePrefsResult = await window.__APP__.setPreferences({
              showLbsConversion,
              showEmojis,
              showGoals: showObjectivesInWods,
              autoConvertLbs: showLbsConversion,
            });

            if (!corePrefsResult?.success) {
              throw new Error(corePrefsResult?.error || 'Falha ao salvar preferências');
            }
          }

          await setUiState({
            settings: { showLbsConversion, showEmojis, showObjectivesInWods },
            modal: null,
          });

          toast('Configurações salvas');
          await rerender();
          return;
        }

        case 'auth:switch': {
          const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
          await setUiState({ authMode: mode });
          await rerender();
          root.querySelector('#auth-email')?.focus();
          return;
        }

        case 'auth:submit': {
          const mode = el.dataset.mode === 'signup' ? 'signup' : 'signin';
          const name = String(root.querySelector('#auth-name')?.value || '').trim();
          const email = String(root.querySelector('#auth-email')?.value || '').trim().toLowerCase();
          const password = String(root.querySelector('#auth-password')?.value || '');

          if (!email) throw new Error('Informe seu email');
          if (!password || password.length < 6) throw new Error('Use uma senha com pelo menos 6 caracteres');
          if (mode === 'signup' && !name) throw new Error('Informe seu nome');

          const result = mode === 'signup'
            ? await window.__APP__.signUp({ name, email, password })
            : await window.__APP__.signIn({ email, password });

          if (!result?.token && !result?.user) {
            throw new Error('Falha ao autenticar');
          }

          const profile = result?.user || window.__APP__?.getProfile?.()?.data || null;
          const snapshot = await loadAccountSnapshot(profile);
          await setUiState({ modal: null, authMode: 'signin', ...snapshot });
          toast(mode === 'signup' ? 'Conta criada' : 'Login efetuado');
          await rerender();
          return;
        }

        case 'auth:reset-toggle': {
          await patchUiState((s) => ({
            ...s,
            passwordReset: {
              ...(s.passwordReset || {}),
              open: !(s.passwordReset?.open),
            },
          }));
          await rerender();
          root.querySelector('#reset-email')?.focus();
          return;
        }

        case 'auth:reset-request': {
          const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
          if (!email) throw new Error('Informe o email da conta');

          const result = await window.__APP__.requestPasswordReset({ email });
          await patchUiState((s) => ({
            ...s,
            passwordReset: {
              ...(s.passwordReset || {}),
              open: true,
              email,
              previewCode: result?.previewCode || '',
              previewUrl: result?.delivery?.previewUrl || '',
              supportEmail: result?.supportEmail || '',
            },
          }));
          toast(result?.previewCode ? 'Código gerado' : 'Pedido de recuperação enviado');
          await rerender();
          return;
        }

        case 'auth:reset-confirm': {
          const email = String(root.querySelector('#reset-email')?.value || '').trim().toLowerCase();
          const code = String(root.querySelector('#reset-code')?.value || '').trim();
          const newPassword = String(root.querySelector('#reset-newPassword')?.value || '');

          if (!email || !code || !newPassword) {
            throw new Error('Preencha email, código e nova senha');
          }

          const result = await window.__APP__.confirmPasswordReset({ email, code, newPassword });
          if (!result?.success) throw new Error(result?.error || 'Falha ao redefinir senha');

          await patchUiState((s) => ({
            ...s,
            passwordReset: { open: false, email: '', code: '', previewCode: '', previewUrl: '', supportEmail: '' },
          }));
          toast('Senha atualizada');
          await rerender();
          return;
        }

        case 'auth:refresh': {
          const result = await window.__APP__.refreshSession();
          if (!result?.token && !result?.user) {
            throw new Error('Falha ao atualizar sessão');
          }
          const profile = result?.user || window.__APP__?.getProfile?.()?.data || null;
          const ui = getUiState?.() || {};
          const snapshot = await loadAccountSnapshot(profile, ui?.coachPortal?.selectedGymId || null);
          await patchUiState((s) => ({ ...s, ...snapshot }));
          toast('Sessão atualizada');
          await rerender();
          return;
        }

        case 'billing:checkout': {
          const plan = el.dataset.plan || 'coach';
          await window.__APP__.openCheckout(plan);
          return;
        }

        case 'billing:activate-local': {
          const plan = el.dataset.plan || 'coach';
          await window.__APP__.activateMockSubscription(plan);
          const profile = window.__APP__?.getProfile?.()?.data || null;
          const ui = getUiState?.() || {};
          const snapshot = await loadAccountSnapshot(profile, ui?.coachPortal?.selectedGymId || null);
          await patchUiState((s) => ({ ...s, ...snapshot }));
          toast('Plano Coach local ativado');
          await rerender();
          return;
        }

        case 'coach:refresh': {
          const profile = window.__APP__?.getProfile?.()?.data || null;
          const ui = getUiState?.() || {};
          const snapshot = await loadAccountSnapshot(profile, ui?.coachPortal?.selectedGymId || null);
          await patchUiState((s) => ({ ...s, ...snapshot }));
          toast('Coach Portal atualizado');
          await rerender();
          return;
        }

        case 'coach:select-gym': {
          const gymId = Number(el.dataset.gymId);
          if (!Number.isFinite(gymId)) return;
          const [membersResult, insightsResult] = await Promise.all([
            window.__APP__.listGymMembers(gymId),
            window.__APP__?.getGymInsights?.(gymId),
          ]);
          await patchUiState((s) => ({
            ...s,
            coachPortal: {
              ...(s.coachPortal || {}),
              selectedGymId: gymId,
              members: membersResult?.data?.memberships || [],
              insights: insightsResult?.data || null,
            },
          }));
          await rerender();
          return;
        }

        case 'coach:create-gym': {
          const name = String(root.querySelector('#coach-gym-name')?.value || '').trim();
          const slug = String(root.querySelector('#coach-gym-slug')?.value || '').trim();
          if (!name || !slug) throw new Error('Informe nome e slug do gym');
          const result = await window.__APP__.createGym({ name, slug });
          const snapshot = await loadCoachPortalSnapshot(result?.data?.gym?.id || null);
          await patchUiState((s) => ({
            ...s,
            coachPortal: snapshot,
          }));
          toast('Gym criado');
          await rerender();
          return;
        }

        case 'coach:add-member': {
          const ui = getUiState?.() || {};
          const gymId = Number(ui?.coachPortal?.selectedGymId);
          if (!Number.isFinite(gymId)) throw new Error('Selecione um gym');
          const email = String(root.querySelector('#coach-member-email')?.value || '').trim().toLowerCase();
          const role = String(root.querySelector('#coach-member-role')?.value || 'athlete');
          if (!email) throw new Error('Informe o email do membro');
          await window.__APP__.addGymMember(gymId, { email, role });
          const [membersResult, insightsResult] = await Promise.all([
            window.__APP__.listGymMembers(gymId),
            window.__APP__?.getGymInsights?.(gymId),
          ]);
          await patchUiState((s) => ({
            ...s,
            coachPortal: {
              ...(s.coachPortal || {}),
              members: membersResult?.data?.memberships || [],
              insights: insightsResult?.data || null,
            },
          }));
          toast('Membro adicionado');
          await rerender();
          return;
        }

        case 'coach:publish-workout': {
          const ui = getUiState?.() || {};
          const gymId = Number(ui?.coachPortal?.selectedGymId);
          if (!Number.isFinite(gymId)) throw new Error('Selecione um gym');
          const title = String(root.querySelector('#coach-workout-title')?.value || '').trim();
          const scheduledDate = String(root.querySelector('#coach-workout-date')?.value || '').trim();
          const benchmarkSlug = String(root.querySelector('#coach-workout-benchmark')?.value || '').trim();
          const rawLines = String(root.querySelector('#coach-workout-lines')?.value || '').trim();
          if (!title || !scheduledDate || !rawLines) throw new Error('Informe título, data e conteúdo do treino');
          const lines = rawLines.split('\n').map((line) => line.trim()).filter(Boolean);
          const payload = {
            blocks: [{ type: 'PROGRAMMING', lines }],
            ...(benchmarkSlug ? { benchmarkSlug } : {}),
          };
          await window.__APP__.publishGymWorkout(gymId, { title, scheduledDate, payload });
          const [feedResult, insightsResult, athleteOverview] = await Promise.all([
            window.__APP__.getWorkoutFeed(),
            window.__APP__?.getGymInsights?.(gymId),
            window.__APP__?.getAthleteDashboard?.(),
          ]);
          await patchUiState((s) => ({
            ...s,
            athleteOverview: athleteOverview?.data || s.athleteOverview,
            coachPortal: {
              ...(s.coachPortal || {}),
              feed: feedResult?.data?.workouts || [],
              insights: insightsResult?.data || null,
            },
          }));
          toast('Treino publicado');
          await rerender();
          return;
        }

        case 'benchmarks:refresh': {
          const ui = getUiState?.() || {};
          const q = String(root.querySelector('#coach-benchmark-query')?.value || '').trim();
          const category = String(ui?.coachPortal?.benchmarkCategory || '').trim();
          const result = await window.__APP__.getBenchmarks({ q, category, limit: 30 });
          await patchUiState((s) => ({
            ...s,
            coachPortal: {
              ...(s.coachPortal || {}),
              benchmarks: result?.data?.benchmarks || [],
              benchmarkQuery: q,
            },
          }));
          await rerender();
          return;
        }

        case 'benchmarks:filter': {
          const category = String(el.dataset.category || '');
          const q = String(root.querySelector('#coach-benchmark-query')?.value || '').trim();
          const result = await window.__APP__.getBenchmarks({ q, category, limit: 30 });
          await patchUiState((s) => ({
            ...s,
            coachPortal: {
              ...(s.coachPortal || {}),
              benchmarks: result?.data?.benchmarks || [],
              benchmarkQuery: q,
              benchmarkCategory: category,
            },
          }));
          await rerender();
          return;
        }

        case 'auth:signout': {
          await window.__APP__.signOut();
          await setUiState({ modal: null, authMode: 'signin', coachPortal: emptyCoachPortal(), athleteOverview: emptyAthleteOverview(), admin: { overview: null, query: '' } });
          toast('Sessão encerrada');
          await rerender();
          return;
        }

        case 'auth:sync-push': {
          const result = await window.__APP__.syncPush();
          if (!result?.success) throw new Error(result?.error || 'Falha ao enviar sync');
          toast('Sync enviado');
          await rerender();
          return;
        }

        case 'auth:sync-pull': {
          const result = await window.__APP__.syncPull();
          if (!result?.success) throw new Error(result?.error || 'Falha ao baixar sync');
          toast('Sync atualizado');
          await rerender();
          return;
        }

        case 'admin:refresh': {
          const query = String(root.querySelector('#admin-search')?.value || '').trim();
          const result = await window.__APP__.getAdminOverview({ q: query, limit: 25 });
          await setUiState({ admin: { overview: result?.data || null, query } });
          toast('Painel admin atualizado');
          await rerender();
          return;
        }

        // ----- Modo treino / checklist -----
        case 'wod:mode': {
          await patchUiState((s) => ({ ...s, trainingMode: !s.trainingMode }));
          await rerender();
          await ensureActiveLine(root, patchUiState);
          return;
        }

        case 'wod:toggle': {
          const lineId = el.dataset.lineId;
          if (!lineId) return;

          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };
            wod.done = wod.done || {};
            wod.done[lineId] = !wod.done[lineId];
            wod.activeLineId = lineId;
            st.wod[key] = wod;
            return st;
          });

          await rerender();
          scrollToLine(root, lineId);
          return;
        }

        case 'wod:next': {
          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };
            wod.done = wod.done || {};

            const ids = getLineIdsFromDOM(root);
            if (!ids.length) return st;

            const current = wod.activeLineId;
            if (current && ids.includes(current)) wod.done[current] = true;

            const nextId = pickNextId(ids, wod.done, current);
            wod.activeLineId = nextId;

            st.wod[key] = wod;
            return st;
          });

          await rerender();
          const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
          if (id) scrollToLine(root, id);
          return;
        }

        case 'wod:prev': {
          await patchUiState((s) => {
            const st = { ...s };
            const key = workoutKeyFromAppState();
            st.wod = st.wod || {};
            const wod = st.wod[key] || { activeLineId: null, done: {} };

            const ids = getLineIdsFromDOM(root);
            if (!ids.length) return st;

            const current = wod.activeLineId;
            const prevId = pickPrevId(ids, current);
            wod.activeLineId = prevId;

            st.wod[key] = wod;
            return st;
          });

          await rerender();
          const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
          if (id) scrollToLine(root, id);
          return;
        }

        // ----- PRs -----
        case 'prs:add': {
          const nameEl = root.querySelector('#ui-prsNewName');
          const valueEl = root.querySelector('#ui-prsNewValue');

          const rawName = (nameEl?.value || '').trim();
          const value = Number(valueEl?.value);

          if (!rawName) throw new Error('Informe o nome do exercício');
          if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um PR válido');

          const exercise = rawName.toUpperCase();
          const result = window.__APP__.addPR(exercise, value);
          if (!result?.success) throw new Error(result?.error || 'Falha ao adicionar PR');
          await syncAthletePrIfAuthenticated(exercise, value);

          if (nameEl) nameEl.value = '';
          if (valueEl) valueEl.value = '';

          toast('PR salvo');
          await rerender();
          return;
        }

        case 'prs:save': {
          const ex = el.dataset.exercise;
          if (!ex) return;

          const input = root.querySelector(
            `input[data-action="prs:editValue"][data-exercise="${cssEscape(ex)}"]`
          );
          const value = Number(input?.value);

          if (!Number.isFinite(value) || value <= 0) throw new Error('PR inválido');

          const result = window.__APP__.addPR(ex, value);
          if (!result?.success) throw new Error(result?.error || 'Falha ao salvar PR');
          await syncAthletePrIfAuthenticated(ex, value);

          toast('PR atualizado');
          await rerender();
          return;
        }

        case 'prs:remove': {
          const ex = el.dataset.exercise;
          if (!ex) return;

          const ok = confirm(`Remover PR de "${ex}"?`);
          if (!ok) return;

          const result = window.__APP__.removePR(ex);
          if (!result?.success) throw new Error(result?.error || 'Falha ao remover PR');

          toast('PR removido');
          await rerender();
          return;
        }

        case 'prs:import-file': {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.style.display = 'none';

          input.addEventListener('change', async (e2) => {
            const file = e2.target.files?.[0];
            if (!file) return;

            try {
              const text = await file.text();
              const result = window.__APP__.importPRs(text);
              if (!result?.success) throw new Error(result?.error || 'Falha ao importar');

              toast(`${result.imported} PRs importados de ${file.name}`);
              await rerender();
            } catch (err) {
              toast(err?.message || 'Erro ao ler arquivo');
              console.error(err);
            } finally {
              document.body.removeChild(input);
            }
          }, { once: true });

          document.body.appendChild(input);
          input.click();
          return;
        }

        case 'prs:export': {
          const result = window.__APP__.exportPRs();
          if (!result?.success) throw new Error(result?.error || 'Falha ao exportar PRs');
          toast('PRs exportados');
          return;
        }

        case 'prs:import': {
          const json = prompt('Cole aqui o JSON de PRs (ex: {"BACK SQUAT":120})');
          if (!json) return;

          const result = window.__APP__.importPRs(json);
          if (!result?.success) throw new Error(result?.error || 'Falha ao importar PRs');

          toast('PRs importados');
          await rerender();
          return;
        }

        case 'timer:start': {
          const seconds = Number(el.dataset.seconds);
          if (!seconds || seconds <= 0) return;
          
          startRestTimer(seconds, toast);
          return;
        }

        default:
          return;
      }
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  // Dia manual (select)
  root.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-action="day:set"]');
    if (!el) return;

    const dayName = el.value;
    if (!dayName) return;

    try {
      const result = await window.__APP__.setDay(dayName);
      if (!result?.success) throw new Error(result?.error || 'Falha ao definir dia');

      toast(`Dia manual: ${result.day || dayName}`);
      el.value = '';
      await rerender();
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });

  // Clique fora do modal fecha
  root.addEventListener('click', async (e) => {
    const overlay = e.target.closest('.modal-overlay');
    if (!overlay) return;

    if (e.target === overlay) {
      await setUiState({ modal: null });
      await rerender();
    }
  });

  // Esc fecha modal
  document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Escape') return;
    const ui = getUiState?.();
    if (ui?.modal) {
      await setUiState({ modal: null });
      await rerender();
    }
  });

  root.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target?.closest?.('#ui-authForm')) return;
    e.preventDefault();

    const ui = getUiState?.() || {};
    const mode = ui.authMode === 'signup' ? 'signup' : 'signin';
    const trigger = root.querySelector(`[data-action="auth:submit"][data-mode="${mode}"]`);
    trigger?.click();
  });
}

function workoutKeyFromAppState() {
  const s = window.__APP__?.getState?.() || {};
  const week = s?.activeWeekNumber ?? '0';
  const day = s?.currentDay ?? 'Hoje';
  return `${week}:${String(day).toLowerCase()}`;
}

function getActiveLineIdFromUi(uiState, key) {
  try {
    const wod = uiState?.wod?.[key];
    return wod?.activeLineId || null;
  } catch {
    return null;
  }
}

function getLineIdsFromDOM(root) {
  return Array.from(root.querySelectorAll('[data-line-id]'))
    .map((el) => el.getAttribute('data-line-id'))
    .filter(Boolean);
}

function pickNextId(ids, doneMap, currentId) {
  const done = doneMap || {};
  const start = Math.max(0, ids.indexOf(currentId));
  for (let i = start + 1; i < ids.length; i++) if (!done[ids[i]]) return ids[i];
  for (let i = 0; i < ids.length; i++) if (!done[ids[i]]) return ids[i];
  return ids[Math.min(start + 1, ids.length - 1)] || ids[0];
}

function pickPrevId(ids, currentId) {
  const idx = ids.indexOf(currentId);
  if (idx <= 0) return ids[0];
  return ids[idx - 1];
}

function scrollToLine(root, lineId) {
  const el = root.querySelector(`[data-line-id="${cssEscape(lineId)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function ensureActiveLine(root, patchUiState) {
  const ids = getLineIdsFromDOM(root);
  if (!ids.length) return;

  const key = workoutKeyFromAppState();
  await patchUiState((s) => {
    const st = { ...s };
    st.wod = st.wod || {};
    const wod = st.wod[key] || { activeLineId: null, done: {} };
    if (!wod.activeLineId) wod.activeLineId = ids[0];
    st.wod[key] = wod;
    return st;
  });

  scrollToLine(root, ids[0]);
}

function pickPdfFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

function pickUniversalFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'image/*',
      'video/*',
      '.txt',
      '.md',
      '.csv',
      '.json',
    ].join(',');
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

function cssEscape(value) {
  return String(value || '').replace(/[\"\\]/g, '\\$&');
}

function startRestTimer(totalSeconds, toast) {
  let remaining = totalSeconds;
  
  const modal = document.createElement('div');
  modal.className = 'timer-modal';
  modal.innerHTML = `
    <div class="timer-content">
      <div class="timer-time" id="timer-time">${formatTime(remaining)}</div>
      <button class="btn-timer-cancel" id="timer-cancel">Cancelar</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const display = document.getElementById('timer-time');
  const cancel = document.getElementById('timer-cancel');
  
  const interval = setInterval(() => {
    remaining--;
    display.textContent = formatTime(remaining);
    
    if (remaining <= 0) {
      clearInterval(interval);
      document.body.removeChild(modal);
      toast('✅ Descanso finalizado!');
    }
  }, 1000);
  
  cancel.onclick = () => {
    clearInterval(interval);
    document.body.removeChild(modal);
    toast('⏹️ Timer cancelado');
  };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
