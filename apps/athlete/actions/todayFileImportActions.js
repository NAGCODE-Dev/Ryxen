export async function handleAthletePdfImport(context) {
  const {
    toast,
    getUiState,
    applyUiState,
    renderUi,
    getAppBridge,
    isImportBusy,
    idleImportStatus,
    guardAthleteImport,
    prepareImportFileForClientUse,
    pickPdfFile,
    IMPORT_HARD_MAX_BYTES,
    IMAGE_COMPRESS_THRESHOLD_BYTES,
    IMAGE_TARGET_MAX_BYTES,
    IMAGE_MAX_DIMENSION,
    consumeAthleteImport,
  } = context;

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
  const result = await getAppBridge().previewMultiWeekPdf(file);
  if (!result?.success) {
    throw new Error(result?.error || 'Falha ao importar PDF');
  }
  if (importPolicy.benefits && result?.review) {
    await applyUiState({
      importStatus: {
        review: {
          ...result.review,
          benefits: importPolicy.benefits,
          importType: 'pdf',
        },
      },
    }, { render: false });
  }
  return true;
}

export async function handleAthleteMediaImport(context) {
  const {
    toast,
    getUiState,
    applyUiState,
    renderUi,
    getAppBridge,
    isImportBusy,
    idleImportStatus,
    guardAthleteImport,
    prepareImportFileForClientUse,
    pickUniversalFile,
    explainImportFailure,
    formatBytes,
    IMPORT_HARD_MAX_BYTES,
    IMAGE_COMPRESS_THRESHOLD_BYTES,
    IMAGE_TARGET_MAX_BYTES,
    IMAGE_MAX_DIMENSION,
    consumeAthleteImport,
  } = context;

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
  const result = await getAppBridge().previewImportFromFile(file);
  if (!result?.success) {
    throw new Error(explainImportFailure(result?.error || 'Falha ao importar arquivo', file));
  }

  if (selectedFile && file !== selectedFile) {
    toast(`Imagem reduzida de ${formatBytes(selectedFile.size)} para ${formatBytes(file.size)}`);
  }

  if (importPolicy.benefits && result?.review) {
    await applyUiState({
      importStatus: {
        review: {
          ...result.review,
          benefits: importPolicy.benefits,
          importType: result.source || 'media',
        },
      },
    }, { render: false });
  }
  return true;
}
