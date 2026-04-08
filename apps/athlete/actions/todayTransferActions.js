export async function handleAthleteWorkoutTransfer(action, context) {
  const {
    toast,
    setUiState,
    getAppBridge,
    readAppState,
    pickJsonFile,
    explainImportFailure,
    isImportBusy,
    finalizeUiChange,
  } = context;

  switch (action) {
    case 'workout:copy': {
      const state = readAppState();
      const blocks = state?.workoutOfDay?.blocks || state?.workout?.blocks || [];
      if (!blocks.length) {
        toast('Nenhum treino carregado');
        return true;
      }

      const result = await getAppBridge().copyWorkout();
      if (!result?.success) throw new Error(result?.error || 'Falha ao copiar');
      toast('Treino copiado');
      return true;
    }

    case 'workout:export': {
      await setUiState({ modal: null });
      const state = readAppState();
      const blocks = state?.workoutOfDay?.blocks || state?.workout?.blocks || [];
      if (!blocks.length) {
        toast('Nenhum treino carregado');
        return true;
      }

      const result = getAppBridge().exportWorkout();
      if (!result?.success) throw new Error(result?.error || 'Falha ao exportar');
      toast('Exportado');
      return true;
    }

    case 'workout:import': {
      if (isImportBusy()) {
        toast('Aguarde a importacao atual terminar');
        return true;
      }
      await setUiState({ modal: null });
      const file = await pickJsonFile();
      if (!file) return true;
      try {
        const result = await getAppBridge().importWorkout(file);
        if (result?.success) {
          await finalizeUiChange({ toastMessage: 'Treino importado!' });
        } else {
          toast(explainImportFailure(result?.error || 'Erro ao importar', file));
        }
      } catch (error) {
        toast(explainImportFailure(error?.message || 'Erro ao importar', file));
        console.error(error);
      }
      return true;
    }

    default:
      return false;
  }
}

export async function handleAthleteBackupTransfer(action, context) {
  const {
    toast,
    getAppBridge,
    pickJsonFile,
    finalizeUiChange,
  } = context;

  switch (action) {
    case 'backup:export': {
      if (typeof getAppBridge()?.exportBackup !== 'function') {
        throw new Error('Backup não disponível nesta versão');
      }

      const result = await getAppBridge().exportBackup();
      if (!result?.success) throw new Error(result?.error || 'Falha ao exportar backup');
      toast('Backup exportado');
      return true;
    }

    case 'backup:import': {
      if (typeof getAppBridge()?.importBackup !== 'function') {
        throw new Error('Restauração não disponível nesta versão');
      }

      const file = await pickJsonFile();
      if (!file) return true;
      try {
        const result = await getAppBridge().importBackup(file);
        if (!result?.success) {
          throw new Error(result?.error || 'Falha ao restaurar backup');
        }
        await finalizeUiChange({ toastMessage: 'Backup restaurado' });
      } catch (error) {
        toast(error?.message || 'Erro ao restaurar backup');
        console.error(error);
      }
      return true;
    }

    default:
      return false;
  }
}
