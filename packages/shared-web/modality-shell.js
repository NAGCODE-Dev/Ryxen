import { getStoredProfile, refreshSession, signIn, signOut } from './auth.js';
import { getAthleteDashboard, getWorkoutFeed } from './athlete-services.js';

export function startAthleteModalityApp(config) {
  const {
    root,
    sportType,
    loadHistory,
    logSession,
    renderLoading,
    renderApp,
    setStatus,
    hydratePrefill,
    buildLogPayload,
    getModel,
    setModel,
    getViewState,
    setViewState,
    prefillAttribute,
    actionAttribute,
    periodAttribute,
    loginFormId,
    logFormId,
    loginPendingMessage = 'Entrando...',
    loginErrorMessage = 'Falha ao entrar',
    logPendingMessage = 'Registrando sessão...',
    logSuccessMessage = 'Sessão registrada.',
    logErrorMessage = 'Falha ao registrar sessão',
    historyKey = 'history',
  } = config || {};

  if (!root) return;

  root.dataset.sportType = sportType || '';
  void boot();
  bindEvents();

  async function boot() {
    renderLoading();

    const profile = getStoredProfile();
    let dashboard = null;
    let feed = [];
    let history = null;
    let sessionOk = !!profile;

    if (profile) {
      try {
        await refreshSession();
        [dashboard, history, feed] = await Promise.all([
          getAthleteDashboard({ sportType }),
          loadHistory(),
          getWorkoutFeed({ sportType }).then((response) => response?.workouts || []),
        ]);
      } catch {
        sessionOk = false;
      }
    }

    const nextModel = {
      profile: sessionOk ? getStoredProfile() : null,
      dashboard: dashboard || null,
      feed,
      [historyKey]: history || null,
    };

    setModel(nextModel);
    renderApp(nextModel);
  }

  function bindEvents() {
    root.onclick = async (event) => {
      const prefillPayload = event.target.closest(`[${prefillAttribute}]`)?.getAttribute(prefillAttribute);
      if (prefillPayload) {
        hydratePrefill(prefillPayload);
        return;
      }

      const action = event.target.closest(`[${actionAttribute}]`)?.getAttribute(actionAttribute);
      if (!action) return;

      if (action === 'logout') {
        await signOut();
        await boot();
        return;
      }

      if (action === 'refresh') {
        await boot();
      }
    };

    root.onchange = (event) => {
      const period = event.target.closest(`[${periodAttribute}]`)?.value;
      if (!period) return;
      setViewState({ ...getViewState(), period });
      const currentModel = getModel();
      if (currentModel) renderApp(currentModel);
    };

    root.onsubmit = async (event) => {
      if (!(event.target instanceof HTMLFormElement)) return;

      if (event.target.id === loginFormId) {
        event.preventDefault();

        const email = String(event.target.querySelector('[name="email"]')?.value || '').trim();
        const password = String(event.target.querySelector('[name="password"]')?.value || '').trim();
        if (!email || !password) return;

        setStatus(loginPendingMessage);
        try {
          await signIn({ email, password });
          await boot();
        } catch (error) {
          setStatus(error?.message || loginErrorMessage, true);
        }
        return;
      }

      if (event.target.id === logFormId) {
        event.preventDefault();
        const payload = buildLogPayload(event.target);

        setStatus(logPendingMessage);
        try {
          await logSession(payload);
          await boot();
          setStatus(logSuccessMessage);
        } catch (error) {
          setStatus(error?.message || logErrorMessage, true);
        }
      }
    };
  }

  return { boot };
}
