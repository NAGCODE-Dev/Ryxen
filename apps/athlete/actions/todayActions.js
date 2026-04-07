export async function handleAthleteTodayAction(action, context) {
  const {
    element,
    root,
    toast,
    getUiState,
    applyUiState,
    applyUiPatch,
    finalizeUiChange,
    renderUi,
    setUiState,
    getAppBridge,
    readAppState,
    isImportBusy,
    idleImportStatus,
    guardAthleteImport,
    prepareImportFileForClientUse,
    pickPdfFile,
    pickJsonFile,
    pickUniversalFile,
    explainImportFailure,
    formatBytes,
    IMPORT_HARD_MAX_BYTES,
    IMAGE_COMPRESS_THRESHOLD_BYTES,
    IMAGE_TARGET_MAX_BYTES,
    IMAGE_MAX_DIMENSION,
    workoutKeyFromAppState,
    getActiveLineIdFromUi,
    getLineIdsFromDOM,
    pickNextId,
    pickPrevId,
    scrollToLine,
    syncAthletePrIfAuthenticated,
    invalidateHydrationCache,
    hydrateAthleteSummary,
    hydrateAthleteResultsBlock,
    cssEscape,
    startRestTimer,
  } = context;

  switch (action) {
    case 'pdf:pick': {
      if (isImportBusy()) {
        toast('Aguarde a importacao atual terminar');
        return true;
      }
      const ui = getUiState?.() || {};
      const importPolicy = await guardAthleteImport('pdf', ui);
      await applyUiState({ importStatus: idleImportStatus() }, { render: false });
      const selectedFile = await pickPdfFile();
      if (!selectedFile) {
        await applyUiState({ importStatus: idleImportStatus() });
        return true;
      }
      const file = await prepareImportFileForClientUse(selectedFile, {
        hardMaxBytes: IMPORT_HARD_MAX_BYTES,
        imageCompressThresholdBytes: IMAGE_COMPRESS_THRESHOLD_BYTES,
        imageTargetMaxBytes: IMAGE_TARGET_MAX_BYTES,
        imageMaxDimension: IMAGE_MAX_DIMENSION,
      });
      if (!file) return true;
      await renderUi();
      const result = await getAppBridge().uploadMultiWeekPdf(file);
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao importar PDF');
      }
      importPolicy.benefits && context.consumeAthleteImport?.(importPolicy.benefits, 'pdf');
      await applyUiState(
        {
          modal: null,
          importStatus: idleImportStatus(),
        },
        { toastMessage: 'PDF importado' },
      );
      return true;
    }

    case 'media:pick': {
      if (isImportBusy()) {
        toast('Aguarde a importacao atual terminar');
        return true;
      }
      const ui = getUiState?.() || {};
      const importPolicy = await guardAthleteImport('media', ui);
      await applyUiState({ importStatus: idleImportStatus() }, { render: false });
      const selectedFile = await pickUniversalFile();
      if (!selectedFile) {
        await applyUiState({ importStatus: idleImportStatus() });
        return true;
      }
      const file = await prepareImportFileForClientUse(selectedFile, {
        hardMaxBytes: IMPORT_HARD_MAX_BYTES,
        imageCompressThresholdBytes: IMAGE_COMPRESS_THRESHOLD_BYTES,
        imageTargetMaxBytes: IMAGE_TARGET_MAX_BYTES,
        imageMaxDimension: IMAGE_MAX_DIMENSION,
      });
      if (!file) return true;

      if (typeof getAppBridge()?.importFromFile !== 'function') {
        throw new Error('Importação universal não disponível');
      }

      await renderUi();
      const result = await getAppBridge().importFromFile(file);
      if (!result?.success) {
        throw new Error(explainImportFailure(result?.error || 'Falha ao importar arquivo', file));
      }

      if (selectedFile && file !== selectedFile) {
        toast(`Imagem reduzida de ${formatBytes(selectedFile.size)} para ${formatBytes(file.size)}`);
      }

      importPolicy.benefits && context.consumeAthleteImport?.(importPolicy.benefits, 'media');
      await applyUiState(
        {
          modal: null,
          importStatus: idleImportStatus(),
        },
        { toastMessage: 'Arquivo importado' },
      );
      return true;
    }

    case 'pdf:clear': {
      const confirmed = confirm(
        '⚠️ Limpar todos os PDFs salvos?\n\n' +
        'Isso removerá todas as semanas carregadas. Esta ação não pode ser desfeita.'
      );
      if (!confirmed) return true;

      const result = await getAppBridge().clearAllPdfs();
      if (!result?.success) throw new Error(result?.error || 'Falha ao limpar PDFs');

      await finalizeUiChange({ toastMessage: 'Todos os PDFs removidos' });
      return true;
    }

    case 'week:select': {
      const week = Number(element.dataset.week);
      if (!Number.isFinite(week)) return true;
      await getAppBridge().selectWeek(week);
      await renderUi();
      return true;
    }

    case 'day:auto': {
      if (typeof getAppBridge()?.resetDay === 'function') {
        const result = await getAppBridge().resetDay();
        if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
      } else if (typeof getAppBridge()?.setDay === 'function') {
        const result = await getAppBridge().setDay('');
        if (result?.success === false) throw new Error(result?.error || 'Falha ao voltar para automático');
      }
      await finalizeUiChange({ toastMessage: 'Dia automático' });
      return true;
    }

    case 'workout:source': {
      const source = String(element.dataset.source || 'uploaded').trim().toLowerCase();
      const nextPriority = source === 'coach' ? 'coach' : 'uploaded';

      if (typeof getAppBridge()?.setPreferences !== 'function') {
        throw new Error('Alternância de treino indisponível');
      }

      const result = await getAppBridge().setPreferences({ workoutPriority: nextPriority });
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao alternar fonte do treino');
      }

      await finalizeUiChange({
        toastMessage: nextPriority === 'coach' ? 'Mostrando treino do coach' : 'Mostrando planilha enviada',
      });
      return true;
    }

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
      await applyUiState({ modal: null }, { render: false });
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

    case 'wod:toggle': {
      const lineId = element.dataset.lineId;
      if (!lineId) return true;

      await applyUiPatch((state) => {
        const next = { ...state };
        const key = workoutKeyFromAppState();
        next.wod = next.wod || {};
        const wod = next.wod[key] || { activeLineId: null, done: {} };
        wod.done = wod.done || {};
        wod.done[lineId] = !wod.done[lineId];
        wod.activeLineId = lineId;
        next.wod[key] = wod;
        return next;
      });
      scrollToLine(root, lineId);
      return true;
    }

    case 'wod:next': {
      await applyUiPatch((state) => {
        const next = { ...state };
        const key = workoutKeyFromAppState();
        next.wod = next.wod || {};
        const wod = next.wod[key] || { activeLineId: null, done: {} };
        wod.done = wod.done || {};

        const ids = getLineIdsFromDOM(root);
        if (!ids.length) return next;

        const current = wod.activeLineId;
        if (current && ids.includes(current)) wod.done[current] = true;

        const nextId = pickNextId(ids, wod.done, current);
        wod.activeLineId = nextId;
        next.wod[key] = wod;
        return next;
      });
      const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
      if (id) scrollToLine(root, id);
      return true;
    }

    case 'wod:prev': {
      await applyUiPatch((state) => {
        const next = { ...state };
        const key = workoutKeyFromAppState();
        next.wod = next.wod || {};
        const wod = next.wod[key] || { activeLineId: null, done: {} };

        const ids = getLineIdsFromDOM(root);
        if (!ids.length) return next;

        const current = wod.activeLineId;
        wod.activeLineId = pickPrevId(ids, current);
        next.wod[key] = wod;
        return next;
      });
      const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
      if (id) scrollToLine(root, id);
      return true;
    }

    case 'prs:add': {
      const nameElement = root.querySelector('#ui-prsNewName');
      const valueElement = root.querySelector('#ui-prsNewValue');
      const rawName = (nameElement?.value || '').trim();
      const value = Number(valueElement?.value);

      if (!rawName) throw new Error('Informe o nome do exercício');
      if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um PR válido');

      const exercise = rawName.toUpperCase();
      const result = await getAppBridge().addPR(exercise, value);
      if (!result?.success) throw new Error(result?.error || 'Falha ao adicionar PR');
      await syncAthletePrIfAuthenticated(exercise, value);

      if (nameElement) nameElement.value = '';
      if (valueElement) valueElement.value = '';
      await finalizeUiChange({ toastMessage: 'PR salvo' });
      return true;
    }

    case 'prs:save': {
      const exercise = element.dataset.exercise;
      if (!exercise) return true;

      const input = root.querySelector(
        `input[data-action="prs:editValue"][data-exercise="${cssEscape(exercise)}"]`
      );
      const value = Number(input?.value);
      if (!Number.isFinite(value) || value <= 0) throw new Error('PR inválido');

      const result = await getAppBridge().addPR(exercise, value);
      if (!result?.success) throw new Error(result?.error || 'Falha ao salvar PR');
      await syncAthletePrIfAuthenticated(exercise, value);
      await finalizeUiChange({ toastMessage: 'PR atualizado' });
      return true;
    }

    case 'prs:remove': {
      const exercise = element.dataset.exercise;
      if (!exercise) return true;

      const confirmed = confirm(`Remover PR de "${exercise}"?`);
      if (!confirmed) return true;

      const result = await getAppBridge().removePR(exercise);
      if (!result?.success) throw new Error(result?.error || 'Falha ao remover PR');
      const currentPrs = getAppBridge()?.getState?.()?.prs || {};
      if (getAppBridge()?.getProfile?.()?.data) {
        await getAppBridge()?.syncAthletePrSnapshot?.(currentPrs);
        const profile = getAppBridge()?.getProfile?.()?.data || null;
        invalidateHydrationCache({ coach: false, athlete: true, account: true });
        await hydrateAthleteSummary(profile, { force: true });
        await hydrateAthleteResultsBlock(profile, { force: true });
      }

      await finalizeUiChange({ toastMessage: 'PR removido' });
      return true;
    }

    case 'prs:import-file': {
      const file = await pickJsonFile();
      if (!file) return true;
      try {
        const text = await file.text();
        const result = getAppBridge().importPRs(text);
        if (!result?.success) throw new Error(result?.error || 'Falha ao importar');
        await finalizeUiChange({ toastMessage: `${result.imported} PRs importados de ${file.name}` });
      } catch (error) {
        toast(error?.message || 'Erro ao ler arquivo');
        console.error(error);
      }
      return true;
    }

    case 'prs:export': {
      const result = getAppBridge().exportPRs();
      if (!result?.success) throw new Error(result?.error || 'Falha ao exportar PRs');
      toast('PRs exportados');
      return true;
    }

    case 'prs:import': {
      const json = prompt('Cole aqui o JSON de PRs (ex: {"BACK SQUAT":120})');
      if (!json) return true;

      const result = getAppBridge().importPRs(json);
      if (!result?.success) throw new Error(result?.error || 'Falha ao importar PRs');
      await finalizeUiChange({ toastMessage: 'PRs importados' });
      return true;
    }

    case 'timer:start': {
      const seconds = Number(element.dataset.seconds);
      if (!seconds || seconds <= 0) return true;
      startRestTimer(seconds, toast);
      return true;
    }

    default:
      return false;
  }
}

export async function handleAthleteTodayChange(event, context) {
  const {
    root,
    toast,
    applyUiPatch,
    finalizeUiChange,
    getAppBridge,
  } = context;

  const settingsToggle = event.target?.closest?.('[data-setting-toggle]');
  if (settingsToggle) {
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
