import { clearAllPdfs as clearPdfs } from '../adapters/pdf/pdfRepository.js';
import { getDefaultPRs } from '../data/prs.js';
import { exportPRs } from '../core/usecases/exportPRs.js';
import { importPRs } from '../core/usecases/importPRs.js';
import { exportAppBackup, importAppBackup } from '../core/usecases/backupData.js';
import { exportWorkout, importWorkout, importWorkoutAsWeeks } from '../core/usecases/exportWorkout.js';
import { importPRsFromCSV, exportPRsToCSV, getCSVTemplate } from '../core/usecases/importPRsFromCSV.js';

export function createImportExportDomain({
  getState,
  setState,
  emit,
  logDebug,
  downloadFile,
  saveMultiWeekPdf,
  previewMultiWeekPdf,
  saveParsedWeeks,
  isImageFile,
  extractTextFromImageFile,
  isVideoFile,
  extractTextFromVideoFile,
  isSpreadsheetFile,
  extractTextFromSpreadsheetFile,
  isPdfImportFile,
  isTextLikeImportFile,
  classifyUniversalImportFile,
  parseTextIntoWeeks,
  toWorkoutBlocks,
  toWorkoutSections,
  captureAppError,
  prsStorage,
  prefsStorage,
  activeWeekStorage,
  dayOverrideStorage,
  pdfStorage,
  pdfMetaStorage,
  PDF_KEY,
  METADATA_KEY,
  selectActiveWeek,
  syncImportedPlanToAccount,
  applyWorkoutToState,
  applyPreferredWorkout,
  reprocessActiveWeek,
}) {
  let pendingImportReview = null;

  function summarizeWeeksForReview(weeks = [], source = 'text', fileName = '') {
    const normalizedWeeks = Array.isArray(weeks) ? weeks : [];
    const previewDays = [];
    let totalBlocks = 0;

    for (const week of normalizedWeeks) {
      for (const workout of week?.workouts || []) {
        const blocks = Array.isArray(workout?.blocks) ? workout.blocks : [];
        totalBlocks += blocks.length;
        const periods = [...new Set(blocks.map((block) => block?.period).filter(Boolean))];
        const blockTypes = [...new Set(blocks.map((block) => String(block?.type || '').trim()).filter(Boolean))];
        const goals = [...new Set(blocks.map((block) => block?.parsed?.goal).filter(Boolean))];
        const movements = [...new Set(blocks.flatMap((block) => (block?.parsed?.items || [])
          .filter((item) => item?.type === 'movement')
          .map((item) => item?.canonicalName || item?.name || item?.displayName)
          .filter(Boolean)))];

        previewDays.push({
          weekNumber: week?.weekNumber || null,
          day: workout?.day || '',
          periods: periods.slice(0, 3),
          blockTypes: blockTypes.slice(0, 4),
          goal: goals[0] || '',
          movements: movements.slice(0, 3),
        });
      }
    }

    return {
      source,
      fileName,
      weeksCount: normalizedWeeks.length,
      weekNumbers: normalizedWeeks.map((week) => week?.weekNumber).filter(Boolean),
      totalDays: previewDays.length,
      totalBlocks,
      days: previewDays.slice(0, 6),
    };
  }

  async function finalizeImportedWeeks(parsedWeeks, metadata = {}, eventName = 'media:uploaded', eventPayload = {}) {
    const saveResult = await saveParsedWeeks(parsedWeeks, metadata);
    if (!saveResult.success) throw new Error(saveResult.error || 'Falha ao salvar treino importado');

    const weeks = saveResult.data.parsedWeeks;
    setState({ weeks });
    const weekResult = await selectActiveWeek(weeks[0].weekNumber);
    if (!weekResult?.success) throw new Error(weekResult?.error || 'Falha ao selecionar semana');
    await safeSyncImportedPlan(weeks, saveResult.data.metadata);

    emit(eventName, {
      weeksCount: weeks.length,
      weekNumbers: weeks.map((week) => week.weekNumber),
      ...eventPayload,
    });

    return { success: true, weeks };
  }

  function clearPendingImportReview() {
    pendingImportReview = null;
  }

  async function safeSyncImportedPlan(weeks, metadata) {
    try {
      return await syncImportedPlanToAccount(weeks, metadata);
    } catch (error) {
      console.warn('Falha ao sincronizar plano importado com a conta:', error?.message || error);
      return { success: false, queued: true, error };
    }
  }

  async function handleImportPRsFromCSV(csvString, merge = true) {
    const parseResult = importPRsFromCSV(csvString);

    if (!parseResult.success) {
      return parseResult;
    }

    const state = getState();
    const finalPRs = merge
      ? { ...state.prs, ...parseResult.data }
      : parseResult.data;

    setState({ prs: finalPRs });
    await reprocessActiveWeek();

    emit('prs:imported', {
      imported: parseResult.imported,
      total: Object.keys(finalPRs).length,
      format: 'CSV',
    });

    logDebug(`📥 PRs importados do CSV: ${parseResult.imported} exercícios`);

    if (parseResult.errors) {
      console.warn('⚠️ Avisos:', parseResult.errors);
    }

    return {
      success: true,
      imported: parseResult.imported,
      skipped: parseResult.skipped,
      total: Object.keys(finalPRs).length,
      errors: parseResult.errors,
    };
  }

  async function handleImportWorkout(file) {
    try {
      const text = await file.text();
      const result = importWorkout(text);

      if (!result.success) {
        console.error('❌ Falha ao importar:', result.error);
        return { success: false, error: result.error };
      }

      const workout = result.data;

      logDebug('📥 Treino importado:', {
        day: workout.day,
        sections: workout.sections.length,
        weekNumber: result.weekNumber,
      });

      const state = getState();
      await applyWorkoutToState(toWorkoutBlocks(workout), {
        source: 'manual',
        weekNumber: result.weekNumber || state.activeWeekNumber,
        title: file?.name || '',
      });
      setState({
        activeWeekNumber: result.weekNumber || state.activeWeekNumber,
      });

      emit('workout:imported', { workout });

      logDebug('✅ Treino importado com sucesso');
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao importar:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async function handleExportPRsToCSV() {
    const state = getState();
    const result = exportPRsToCSV(state.prs);

    if (!result.success) {
      return result;
    }

    downloadFile(result.csv, result.filename, 'text/csv');

    emit('prs:exported', { count: result.count, format: 'CSV' });

    logDebug('💾 PRs exportados (CSV):', result.filename);

    return { success: true, filename: result.filename };
  }

  async function downloadPRsTemplate() {
    const template = getCSVTemplate();
    downloadFile(template, 'prs-template.csv', 'text/csv');

    logDebug('📥 Template CSV baixado');

    return { success: true };
  }

  async function handleMultiWeekPdfUpload(file) {
    logDebug('📤 Uploading multi-week PDF:', file.name);

    emit('pdf:uploading', { fileName: file.name });

    try {
      const result = await saveMultiWeekPdf(file, {
        onProgress: (progress) => emit('pdf:progress', {
          fileName: file.name,
          ...progress,
        }),
      });

      if (!result.success) {
        emit('pdf:error', { error: result.error });
        return result;
      }

      const weeks = result.data.parsedWeeks;
      setState({ weeks });

      await selectActiveWeek(weeks[0].weekNumber);
      await safeSyncImportedPlan(weeks, result.data.metadata);

      emit('pdf:uploaded', {
        fileName: file.name,
        weeksCount: weeks.length,
        weekNumbers: weeks.map((week) => week.weekNumber),
      });

      logDebug('✅ PDF multi-semana carregado:', weeks.map((week) => week.weekNumber));

      return { success: true, weeks };
    } catch (error) {
      const errorMsg = error.message || 'Erro desconhecido';
      captureAppError(error, {
        tags: { feature: 'import', source: 'pdf_upload' },
        fileName: file?.name || null,
        fileType: file?.type || null,
        fileSize: file?.size || null,
      });
      emit('pdf:error', { error: errorMsg });

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  async function previewMultiWeekPdfUpload(file) {
    logDebug('👀 Preparando preview do PDF:', file?.name);
    emit('pdf:uploading', { fileName: file.name });

    try {
      const result = await previewMultiWeekPdf(file, {
        onProgress: (progress) => emit('pdf:progress', {
          fileName: file.name,
          ...progress,
        }),
      });

      if (!result.success) {
        emit('pdf:error', { error: result.error });
        return result;
      }

      const parsedWeeks = result.data.parsedWeeks;
      const metadata = {
        ...(result.data.metadata || {}),
        fileName: file.name,
        fileSize: file.size,
        source: 'pdf',
      };
      const review = summarizeWeeksForReview(parsedWeeks, 'pdf', file.name);
      pendingImportReview = { parsedWeeks, metadata, review, eventName: 'pdf:uploaded' };

      emit('pdf:review', review);
      return { success: true, review };
    } catch (error) {
      const errorMsg = error.message || 'Erro ao preparar preview do PDF';
      emit('pdf:error', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  async function handleUniversalImport(file) {
    if (!file) {
      return { success: false, error: 'Arquivo não fornecido' };
    }

    const type = file.type || '';
    const fileInfo = classifyUniversalImportFile(file);

    if (isPdfImportFile(file)) {
      return handleMultiWeekPdfUpload(file);
    }

    emit('media:uploading', { fileName: file.name, type });

    try {
      let rawText = '';
      let source = 'text';
      let parsedWeeks = [];

      if (isImageFile(file)) {
        source = 'image';
        emit('media:progress', {
          fileName: file.name,
          type: source,
          message: 'Lendo texto da imagem...',
        });
        rawText = await extractTextFromImageFile(file);
      } else if (isVideoFile(file)) {
        source = 'video';
        emit('media:progress', {
          fileName: file.name,
          type: source,
          message: 'Preparando vídeo para OCR...',
        });
        rawText = await extractTextFromVideoFile(file, {
          onProgress: (progress) => emit('media:progress', {
            fileName: file.name,
            type: source,
            ...progress,
          }),
        });
      } else if (isSpreadsheetFile(file)) {
        source = 'spreadsheet';
        emit('media:progress', {
          fileName: file.name,
          type: source,
          message: 'Lendo planilha...',
        });
        rawText = await extractTextFromSpreadsheetFile(file, {
          onProgress: (progress) => emit('media:progress', {
            fileName: file.name,
            type: source,
            ...progress,
          }),
        });
      } else if (isTextLikeImportFile(file)) {
        source = 'text';
        emit('media:progress', {
          fileName: file.name,
          type: source,
          message: 'Lendo conteúdo do arquivo...',
        });
        rawText = await file.text();
        const maybeStructuredWorkout = importWorkoutAsWeeks(rawText, getState().activeWeekNumber);
        if (maybeStructuredWorkout?.success) {
          source = 'structured-json';
          parsedWeeks = maybeStructuredWorkout.data;
        }
      } else {
        throw new Error(fileInfo.error || `Formato não suportado: ${type || file.name}`);
      }

      emit('media:progress', {
        fileName: file.name,
        type: source,
        message: parsedWeeks.length
          ? 'Convertendo JSON em semana importável...'
          : 'Organizando treinos importados...',
      });

      if (!parsedWeeks.length) {
        parsedWeeks = parseTextIntoWeeks(rawText, getState().activeWeekNumber);
      }
      if (!parsedWeeks.length) {
        throw new Error('Não foi possível identificar treinos no conteúdo importado');
      }

      const review = summarizeWeeksForReview(parsedWeeks, source, file.name);
      pendingImportReview = {
        parsedWeeks,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          source,
        },
        review,
        eventName: 'media:uploaded',
      };

      emit('media:review', review);

      return {
        success: true,
        preview: true,
        review,
        source,
      };
    } catch (error) {
      const errorMsg = error.message || 'Erro ao importar mídia';
      captureAppError(error, {
        tags: { feature: 'import', source: 'universal_import' },
        fileName: file?.name || null,
        fileType: file?.type || null,
        fileSize: file?.size || null,
        detectedSource: fileInfo?.source || null,
      });
      emit('media:error', { error: errorMsg, fileName: file.name });
      return { success: false, error: errorMsg };
    }
  }

  async function previewUniversalImport(file) {
    return handleUniversalImport(file);
  }

  async function commitPendingImportReview() {
    if (!pendingImportReview?.parsedWeeks?.length) {
      return { success: false, error: 'Nenhuma importação pendente para confirmar' };
    }

    const source = pendingImportReview.metadata?.source || 'arquivo';
    const fileName = pendingImportReview.metadata?.fileName || '';
    const progressEvent = pendingImportReview.eventName === 'pdf:uploaded' ? 'pdf:progress' : 'media:progress';
    const errorEvent = pendingImportReview.eventName === 'pdf:uploaded' ? 'pdf:error' : 'media:error';

    emit(progressEvent, {
      fileName,
      type: source,
      message: 'Salvando treino importado...',
    });

    try {
      const result = await finalizeImportedWeeks(
        pendingImportReview.parsedWeeks,
        pendingImportReview.metadata,
        pendingImportReview.eventName || 'media:uploaded',
        {
          fileName,
          type: source,
        },
      );
      clearPendingImportReview();
      return {
        success: true,
        weeks: result.weeks,
        source,
      };
    } catch (error) {
      const errorMsg = error.message || 'Falha ao confirmar importação';
      emit(errorEvent, { error: errorMsg, fileName });
      return { success: false, error: errorMsg };
    }
  }

  async function cancelPendingImportReview() {
    clearPendingImportReview();
    emit('import:review-cleared', {});
    return { success: true };
  }

  async function handleExportBackup() {
    try {
      const state = getState();
      const result = exportAppBackup(state, {
        weeksCount: state.weeks?.length || 0,
        prsCount: Object.keys(state.prs || {}).length,
      });

      if (!result.success) return result;

      downloadFile(result.json, result.filename, 'application/json');
      emit('backup:exported', {
        filename: result.filename,
        weeksCount: state.weeks?.length || 0,
        prsCount: Object.keys(state.prs || {}).length,
      });

      return { success: true, filename: result.filename };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erro ao exportar backup',
      };
    }
  }

  async function handleImportBackup(file) {
    try {
      if (!file) {
        return { success: false, error: 'Arquivo não fornecido' };
      }

      const json = await file.text();
      const result = importAppBackup(json);

      if (!result.success) return result;

      const backup = result.data;
      await applyImportedBackupData(backup, {
        fileName: file.name,
        source: 'backup-import',
      });

      emit('backup:imported', {
        weeksCount: backup.weeks.length,
        prsCount: Object.keys(backup.prs).length,
        version: result.version,
      });

      return {
        success: true,
        imported: {
          weeks: backup.weeks.length,
          prs: Object.keys(backup.prs).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Erro ao importar backup',
      };
    }
  }

  async function applyImportedBackupData(backup, options = {}) {
    const currentState = getState();
    const weeks = Array.isArray(backup?.weeks) ? backup.weeks : [];
    const mergedPreferences = {
      ...currentState.preferences,
      ...(backup?.preferences || {}),
    };

    await prsStorage.set('prs', backup?.prs || {});
    await prefsStorage.set('preferences', mergedPreferences);
    await pdfStorage.set(PDF_KEY, weeks);
    await pdfMetaStorage.set(METADATA_KEY, {
      uploadedAt: new Date().toISOString(),
      fileName: options.fileName || 'backup-importado',
      weeksCount: weeks.length,
      weekNumbers: weeks.map((week) => week.weekNumber),
      source: options.source || 'backup-import',
    });

    if (backup?.activeWeekNumber) {
      await activeWeekStorage.set('active-week', backup.activeWeekNumber);
    } else {
      await activeWeekStorage.remove('active-week');
    }

    if (backup?.currentDay) {
      await dayOverrideStorage.set('custom-day', backup.currentDay);
    } else {
      await dayOverrideStorage.remove('custom-day');
    }

    setState({
      weeks,
      prs: backup?.prs || {},
      preferences: mergedPreferences,
      currentDay: backup?.currentDay || currentState.currentDay,
      activeWeekNumber: backup?.activeWeekNumber || null,
      workoutMeta: null,
      ui: {
        ...currentState.ui,
        activeScreen: weeks.length ? 'workout' : 'welcome',
      },
    });

    if (weeks.length > 0) {
      const preferredWeek = backup?.activeWeekNumber || weeks[0].weekNumber;
      await selectActiveWeek(preferredWeek);
      await safeSyncImportedPlan(weeks, {
        uploadedAt: new Date().toISOString(),
        fileName: options.fileName || 'backup-importado',
        fileSize: 0,
        weeksCount: weeks.length,
        weekNumbers: weeks.map((week) => week.weekNumber),
        source: options.source || 'backup-import',
      });
    } else {
      await applyPreferredWorkout({ fallbackToWelcome: true });
    }

    return {
      success: true,
      imported: {
        weeks: weeks.length,
        prs: Object.keys(backup?.prs || {}).length,
      },
    };
  }

  function handleExportWorkout() {
    const state = getState();
    const workout = state.workout;

    logDebug('📤 [EXPORT] Estado completo:', {
      hasWorkout: !!workout,
      workoutKeys: workout ? Object.keys(workout) : [],
      day: workout?.day,
      blocksLength: workout?.blocks?.length,
      firstBlock: workout?.blocks?.[0],
      firstLine: workout?.blocks?.[0]?.lines?.[0],
      secondLine: workout?.blocks?.[0]?.lines?.[1],
      thirdLine: workout?.blocks?.[0]?.lines?.[2],
    });

    if (!workout || !workout.blocks) {
      return {
        success: false,
        error: 'Nenhum treino carregado',
      };
    }

    const workoutForExport = toWorkoutSections(workout);

    logDebug('📤 [EXPORT] Workout para exportação:', {
      day: workoutForExport.day,
      sectionsLength: workoutForExport.sections.length,
      firstSection: workoutForExport.sections[0],
      firstLine: workoutForExport.sections[0]?.lines?.[0],
      secondLine: workoutForExport.sections[0]?.lines?.[1],
    });

    const result = exportWorkout(workoutForExport, {
      exportedBy: 'Treino do Dia PWA',
      weekNumber: state.activeWeekNumber,
    });

    if (!result.success) {
      console.error('❌ Falha ao exportar:', result.error);
      return result;
    }

    logDebug('✅ JSON gerado (preview):', result.json.substring(0, 500));

    downloadFile(result.json, result.filename, 'application/json');
    emit('workout:exported', { filename: result.filename });

    logDebug('✅ Treino exportado:', result.filename);
    return { success: true };
  }

  function handleExportPRs() {
    const state = getState();
    const result = exportPRs(state.prs);

    if (!result.success) {
      return result;
    }

    downloadFile(result.json, result.filename, 'application/json');

    emit('prs:exported', { count: result.count });

    logDebug('💾 PRs exportados:', result.count);

    return { success: true };
  }

  async function handleImportPRs(jsonString) {
    const state = getState();
    const result = importPRs(jsonString, state.prs, {
      merge: true,
      overwrite: true,
    });

    if (!result.success) {
      return result;
    }

    setState({ prs: result.data });
    await reprocessActiveWeek();

    emit('prs:imported', {
      imported: result.imported,
      total: result.total,
    });

    logDebug('📥 PRs importados:', result.imported);

    return { success: true };
  }

  async function loadDefaultPRs(merge = true) {
    try {
      const defaultPRs = getDefaultPRs();
      const state = getState();

      const finalPRs = merge
        ? { ...defaultPRs, ...state.prs }
        : defaultPRs;

      setState({ prs: finalPRs });
      await reprocessActiveWeek();

      const added = Object.keys(finalPRs).length - Object.keys(state.prs).length;

      emit('prs:loaded', {
        total: Object.keys(finalPRs).length,
        added,
        merged: merge,
      });

      logDebug(`📥 PRs padrão carregados: ${Object.keys(finalPRs).length} exercícios${merge ? ` (+${added} novos)` : ''}`);

      return {
        success: true,
        total: Object.keys(finalPRs).length,
        added,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erro ao carregar PRs padrão: ' + error.message,
      };
    }
  }

  async function clearAllPdfs() {
    try {
      logDebug('🗑️ Limpando todos os PDFs...');

      const result = await clearPdfs();

      if (!result.success) {
        console.error(`❌ Erro ao limpar PDFs: ${result.error}`);
        return { success: false, error: result.error };
      }

      setState({
        weeks: [],
        activeWeekNumber: null,
        workout: null,
        workoutMeta: null,
        ui: { activeScreen: 'welcome' },
      });

      await activeWeekStorage.remove('active-week');
      await applyPreferredWorkout({ fallbackToWelcome: true });

      emit('pdf:cleared');
      logDebug('✅ Todos os PDFs removidos');

      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao limpar PDFs: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  return {
    handleImportPRsFromCSV,
    handleImportWorkout,
    handleExportPRsToCSV,
    downloadPRsTemplate,
    handleMultiWeekPdfUpload,
    handleUniversalImport,
    handleExportBackup,
    handleImportBackup,
    handleExportWorkout,
    handleExportPRs,
    handleImportPRs,
    loadDefaultPRs,
    clearAllPdfs,
    previewMultiWeekPdfUpload,
    previewUniversalImport,
    commitPendingImportReview,
    cancelPendingImportReview,
  };
}
