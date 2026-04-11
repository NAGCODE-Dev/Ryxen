export function createAuthDomain({
  getState,
  setState,
  remoteHandlers,
  handleGetProfile,
  restoreAppStateFromAccount,
  restoreImportedPlanFromAccount,
  flushPendingAppStateSync,
  flushPendingSyncOutbox,
  clearLocalUserData,
  clearCoachWorkoutFeed,
  updateCurrentDay,
  applyPreferredWorkout,
}) {
  let authHydrationPromise = null;

  async function handleSignUp(credentials) {
    return remoteHandlers.handleSignUp(credentials);
  }

  async function handleConfirmSignUp(payload) {
    const previousProfile = handleGetProfile()?.data || null;
    const result = await remoteHandlers.handleConfirmSignUp(payload);
    await finalizeAuthChange(previousProfile, result?.user);
    return result;
  }

  async function handleSignIn(credentials) {
    const previousProfile = handleGetProfile()?.data || null;
    const result = await remoteHandlers.handleSignIn(credentials);
    await finalizeAuthChange(previousProfile, result?.user);
    return result;
  }

  async function handleSignInWithTrustedDevice(payload) {
    const previousProfile = handleGetProfile()?.data || null;
    const result = await remoteHandlers.handleSignInWithTrustedDevice(payload);
    await finalizeAuthChange(previousProfile, result?.user);
    return result;
  }

  async function handleSignInWithGoogle(payload) {
    const previousProfile = handleGetProfile()?.data || null;
    const result = await remoteHandlers.handleSignInWithGoogle(payload);
    await finalizeAuthChange(previousProfile, result?.user);
    return result;
  }

  function handleStartGoogleRedirect(payload) {
    return remoteHandlers.handleStartGoogleRedirect(payload);
  }

  async function handleRefreshSession() {
    const previousProfile = handleGetProfile()?.data || null;
    const result = await remoteHandlers.handleRefreshSession();
    await finalizeAuthChange(previousProfile, result?.user);
    return result;
  }

  async function handleSignOut() {
    await remoteHandlers.handleSignOut();
    await clearSessionScopedData({ preserveAuth: false });
    return { success: true };
  }

  async function finalizeAuthChange(previousProfile, nextProfile) {
    const shouldResetLocal = shouldResetLocalAfterAuth(previousProfile, nextProfile);
    if (shouldResetLocal) {
      await clearSessionScopedData({ preserveAuth: true });
    }
    await restoreAppStateFromAccount({ force: shouldResetLocal });
    await restoreImportedPlanFromAccount({ force: shouldResetLocal });
    await flushPendingAppStateSync();
    await flushPendingSyncOutbox();
    triggerPostAuthHydration();
  }

  async function postAuthHydration() {
    try {
      await remoteHandlers.handleGetWorkoutFeed();
    } catch (error) {
      console.warn('Falha ao atualizar feed após autenticação:', error?.message || error);
    }
  }

  function triggerPostAuthHydration() {
    if (authHydrationPromise) return authHydrationPromise;
    authHydrationPromise = Promise.resolve()
      .then(() => postAuthHydration())
      .catch((error) => {
        console.warn('Falha na hidratação pós-auth:', error?.message || error);
      })
      .finally(() => {
        authHydrationPromise = null;
      });
    return authHydrationPromise;
  }

  function shouldResetLocalAfterAuth(previousProfile, nextProfile) {
    const nextEmail = String(nextProfile?.email || '').trim().toLowerCase();
    if (!nextEmail) return false;
    const previousEmail = String(previousProfile?.email || '').trim().toLowerCase();
    return Boolean(previousEmail) && previousEmail !== nextEmail;
  }

  async function clearSessionScopedData(options = {}) {
    await clearLocalUserData(options);
    await clearCoachWorkoutFeed();
    setState({
      weeks: [],
      prs: {},
      activeWeekNumber: null,
      workout: null,
      workoutMeta: null,
      workoutContext: {
        coachAvailable: false,
        uploadedPlanAvailable: false,
        canToggle: false,
        preferredSource: 'uploaded',
      },
      preferences: {
        showLbsConversion: true,
        autoConvertLbs: true,
        showEmojis: true,
        showGoals: true,
        showNyxHints: true,
        nyxGuideCompleted: false,
        workoutPriority: 'uploaded',
        theme: 'dark',
        accentTone: 'blue',
        interfaceDensity: 'comfortable',
        reduceMotion: false,
      },
      ui: {
        ...getState().ui,
        activeScreen: 'welcome',
      },
    });
    await updateCurrentDay();
    await applyPreferredWorkout({ fallbackToWelcome: true });
  }

  return {
    handleSignUp,
    handleConfirmSignUp,
    handleSignIn,
    handleSignInWithTrustedDevice,
    handleSignInWithGoogle,
    handleStartGoogleRedirect,
    handleRefreshSession,
    handleSignOut,
    clearSessionScopedData,
  };
}
