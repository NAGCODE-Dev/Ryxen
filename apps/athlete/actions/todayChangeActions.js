export async function handleAthleteTodaySettingsChange(event, context) {
  const {
    root,
    toast,
    getUiState,
    applyUiPatch,
    getAppBridge,
  } = context;

  const preferenceField = event.target?.closest?.('[data-preference-key], [data-setting-toggle]');
  if (!preferenceField) return false;

  const currentUiSettings = getUiState?.()?.settings || {};
  const currentCorePreferences = getAppBridge()?.getStateSnapshot?.()?.preferences || {};

  const readCheckbox = (selector, fallback = false) => {
    const input = root.querySelector(selector);
    return input ? !!input.checked : fallback;
  };

  const readRadio = (selector, fallback = '') => {
    const input = root.querySelector(selector);
    return input ? String(input.value || fallback) : fallback;
  };

  const nextSettings = {
    showLbsConversion: readCheckbox(
      '#setting-showLbsConversion',
      currentUiSettings.showLbsConversion ?? currentCorePreferences.showLbsConversion !== false,
    ),
    showEmojis: readCheckbox(
      '#setting-showEmojis',
      currentUiSettings.showEmojis ?? currentCorePreferences.showEmojis !== false,
    ),
    showObjectivesInWods: readCheckbox(
      '#setting-showObjectives',
      currentUiSettings.showObjectivesInWods ?? currentCorePreferences.showGoals !== false,
    ),
    showNyxHints: readCheckbox(
      '#setting-showNyxHints',
      currentUiSettings.showNyxHints ?? currentCorePreferences.showNyxHints !== false,
    ),
    theme: 'dark',
    accentTone: readRadio(
      'input[name="setting-accentTone"]:checked',
      currentUiSettings.accentTone || currentCorePreferences.accentTone || 'blue',
    ),
    interfaceDensity: readRadio(
      'input[name="setting-interfaceDensity"]:checked',
      currentUiSettings.interfaceDensity || currentCorePreferences.interfaceDensity || 'comfortable',
    ),
    reduceMotion: readCheckbox(
      '#setting-reduceMotion',
      currentUiSettings.reduceMotion ?? currentCorePreferences.reduceMotion === true,
    ),
    workoutPriority: readRadio(
      'input[name="setting-workoutPriority"]:checked',
      currentUiSettings.workoutPriority || currentCorePreferences.workoutPriority || 'uploaded',
    ),
  };

  try {
    if (typeof getAppBridge()?.setPreferences === 'function') {
      const corePrefsResult = await getAppBridge().setPreferences({
        showLbsConversion: nextSettings.showLbsConversion,
        showEmojis: nextSettings.showEmojis,
        showGoals: nextSettings.showObjectivesInWods,
        showNyxHints: nextSettings.showNyxHints,
        autoConvertLbs: nextSettings.showLbsConversion,
        theme: 'dark',
        accentTone: nextSettings.accentTone,
        interfaceDensity: nextSettings.interfaceDensity,
        reduceMotion: nextSettings.reduceMotion,
        workoutPriority: nextSettings.workoutPriority,
      });

      if (!corePrefsResult?.success) {
        throw new Error(corePrefsResult?.error || 'Falha ao salvar preferências');
      }
    }

    await applyUiPatch(
      (state) => ({
        ...state,
        settings: nextSettings,
      }),
      { toastMessage: 'Preferência salva' },
    );
  } catch (error) {
    toast(error?.message || 'Erro ao salvar preferência');
    console.error(error);
  }
  return true;
}

export async function handleAthleteTodayDayChange(event, context) {
  const {
    toast,
    finalizeUiChange,
    getAppBridge,
  } = context;

  const actionElement = event.target.closest('[data-action="day:set"]');
  if (!actionElement) return false;

  const dayName = actionElement.value;
  if (!dayName) return true;

  try {
    const result = await getAppBridge().setDay(dayName);
    if (!result?.success) throw new Error(result?.error || 'Falha ao definir dia');

    actionElement.value = '';
    await finalizeUiChange({ toastMessage: `Dia manual: ${result.day || dayName}` });
  } catch (error) {
    toast(error?.message || 'Erro');
    console.error(error);
  }
  return true;
}
