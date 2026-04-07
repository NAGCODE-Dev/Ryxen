export function createAthleteInteractionDomain({
  getState,
  setState,
  emit,
  logDebug,
  navigatorObject,
  copyWorkout,
  addOrUpdatePR,
  removePR,
  listAllPRs,
  reprocessActiveWeek,
}) {
  async function handleCopyWorkout() {
    const state = getState();

    if (!state.workout) {
      return {
        success: false,
        error: 'Nenhum treino carregado',
      };
    }

    try {
      const sectionsForCopy = (state.workout.blocks || []).map((block) => ({
        ...block,
        lines: (block.lines || []).map((line) => {
          if (typeof line === 'object' && line !== null) {
            return String(line.raw || line.text || '');
          }
          return String(line);
        }),
      }));

      const workoutForCopy = {
        day: state.workout.day,
        sections: sectionsForCopy,
      };

      const result = copyWorkout(workoutForCopy, state.prs, state.preferences);

      if (!result.success) {
        return result;
      }

      await navigatorObject.clipboard.writeText(result.text);

      emit('workout:copied', { lineCount: result.lineCount });

      logDebug('📋 Treino copiado');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async function handleUpdatePreferences(nextPreferences = {}) {
    if (!nextPreferences || typeof nextPreferences !== 'object') {
      return { success: false, error: 'Preferências inválidas' };
    }

    try {
      const state = getState();
      const merged = {
        ...state.preferences,
        ...nextPreferences,
      };

      setState({ preferences: merged });

      await reprocessActiveWeek();

      emit('preferences:changed', { preferences: merged });

      return { success: true, data: merged };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erro ao atualizar preferências',
      };
    }
  }

  async function handleAddPR(exerciseName, load) {
    const state = getState();
    const result = addOrUpdatePR(state.prs, exerciseName, load);

    if (!result.success) {
      return result;
    }

    setState({ prs: result.data });
    await reprocessActiveWeek();

    emit('pr:updated', {
      exercise: exerciseName,
      load,
      isNew: result.isNew,
    });

    logDebug(`💪 PR ${result.isNew ? 'adicionado' : 'atualizado'}:`, exerciseName, load);

    return { success: true };
  }

  async function handleRemovePR(exerciseName) {
    const state = getState();
    const result = removePR(state.prs, exerciseName);

    if (!result.success) {
      return result;
    }

    setState({ prs: result.data });
    await reprocessActiveWeek();

    emit('pr:removed', { exercise: exerciseName });

    logDebug('🗑️ PR removido:', exerciseName);

    return { success: true };
  }

  function handleListPRs() {
    const state = getState();
    return listAllPRs(state.prs);
  }

  return {
    handleCopyWorkout,
    handleUpdatePreferences,
    handleAddPR,
    handleRemovePR,
    handleListPRs,
  };
}
