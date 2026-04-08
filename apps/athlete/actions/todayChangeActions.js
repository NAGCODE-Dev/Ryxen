export async function handleAthleteTodaySettingsChange(event, context) {
  const {
    root,
    toast,
    applyUiPatch,
    getAppBridge,
  } = context;

  const settingsToggle = event.target?.closest?.('[data-setting-toggle]');
  if (!settingsToggle) return false;

  const showLbsConversion = !!root.querySelector('#setting-showLbsConversion')?.checked;
  const showEmojis = !!root.querySelector('#setting-showEmojis')?.checked;
  const showObjectivesInWods = !!root.querySelector('#setting-showObjectives')?.checked;

  try {
    if (typeof getAppBridge()?.setPreferences === 'function') {
      const corePrefsResult = await getAppBridge().setPreferences({
        showLbsConversion,
        showEmojis,
        showGoals: showObjectivesInWods,
        autoConvertLbs: showLbsConversion,
      });

      if (!corePrefsResult?.success) {
        throw new Error(corePrefsResult?.error || 'Falha ao salvar preferências');
      }
    }

    await applyUiPatch(
      (state) => ({
        ...state,
        settings: { showLbsConversion, showEmojis, showObjectivesInWods },
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
