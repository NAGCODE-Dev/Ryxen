import { previewMultiWeekPdf, saveParsedWeeks } from '../../src/adapters/pdf/pdfRepository.js';
import { isImageFile, extractTextFromImageFile } from '../../src/adapters/media/ocrReader.js';
import { isVideoFile, extractTextFromVideoFile } from '../../src/adapters/media/videoTextReader.js';
import { isSpreadsheetFile, extractTextFromSpreadsheetFile } from '../../src/adapters/spreadsheet/spreadsheetReader.js';
import { importWorkoutAsWeeks } from '../../src/core/usecases/exportWorkout.js';
import { classifyUniversalImportFile, isPdfImportFile, isTextLikeImportFile } from '../../src/app/importFileTypes.js';
import { parseTextIntoWeeks, prepareImportTextForParsing } from '../../src/app/workoutHelpers.js';

export function createAthleteImportReviewAdapter({
  getActiveWeekNumber = () => null,
  getFallbackDay = () => null,
  onProgress = () => {},
  syncImportedPlan = async () => ({ success: false, skipped: true }),
} = {}) {
  let pendingImportReview = null;

  async function previewImportFromFile(file) {
    if (!file) {
      return { success: false, error: 'Arquivo não fornecido' };
    }

    if (isPdfImportFile(file)) {
      return previewPdfImport(file);
    }

    return previewUniversalImport(file);
  }

  async function reparseImportReview(nextText) {
    if (!pendingImportReview?.metadata) {
      return { success: false, error: 'Nenhum preview pendente para revisar' };
    }

    const fileName = pendingImportReview.metadata?.fileName || '';
    const editedText = String(nextText || '').trim();
    if (!editedText) {
      return { success: false, error: 'Edite o texto antes de reprocessar o preview' };
    }

    onProgress({
      stage: 'import-reparse',
      message: 'Organizando preview com suas correções...',
      fileName,
      source: pendingImportReview.metadata?.source || 'arquivo',
    });

    const reviewText = prepareImportTextForParsing(editedText, { fileName });
    const parsedWeeks = parseTextIntoWeeks(reviewText, pendingImportReview.activeWeekNumber, {
      fallbackDay: pendingImportReview.fallbackDay,
      fileName,
    });

    if (!parsedWeeks.length) {
      return { success: false, error: 'Ainda não consegui identificar treinos nesse texto revisado' };
    }

    pendingImportReview = {
      ...pendingImportReview,
      parsedWeeks,
      reviewText,
      review: summarizeWeeksForReview(parsedWeeks, pendingImportReview.metadata?.source || 'arquivo', fileName, { reviewText }),
    };

    return {
      success: true,
      review: pendingImportReview.review,
      source: pendingImportReview.metadata?.source || 'arquivo',
    };
  }

  async function commitImportReview() {
    if (!pendingImportReview?.parsedWeeks?.length) {
      return { success: false, error: 'Nenhuma importação pendente para confirmar' };
    }

    const metadata = pendingImportReview.metadata || {};
    onProgress({
      stage: 'import-save',
      message: 'Salvando treino importado...',
      fileName: metadata.fileName || '',
      source: metadata.source || 'arquivo',
    });

    const result = await saveParsedWeeks(pendingImportReview.parsedWeeks, metadata);
    if (!result?.success) {
      return { success: false, error: result?.error || 'Falha ao salvar plano importado' };
    }

    await syncImportedPlan(result.data.parsedWeeks, result.data.metadata);

    const payload = {
      success: true,
      weeks: result.data.parsedWeeks,
      metadata: result.data.metadata,
      review: pendingImportReview.review,
      source: metadata.source || 'arquivo',
    };

    pendingImportReview = null;
    return payload;
  }

  async function cancelImportReview() {
    pendingImportReview = null;
    return { success: true };
  }

  function getPendingReview() {
    return pendingImportReview?.review || null;
  }

  return {
    previewImportFromFile,
    reparseImportReview,
    commitImportReview,
    cancelImportReview,
    getPendingReview,
  };

  async function previewPdfImport(file) {
    onProgress({
      stage: 'pdf-start',
      message: 'Preparando PDF para importação...',
      fileName: file.name,
      source: 'pdf',
    });

    const result = await previewMultiWeekPdf(file, {
      onProgress: (progress) => onProgress({
        fileName: file.name,
        source: 'pdf',
        ...progress,
      }),
    });

    if (!result?.success) {
      return { success: false, error: result?.error || 'Falha ao preparar preview do PDF' };
    }

    const reviewText = String(result?.data?.reviewText || '').trim();
    pendingImportReview = {
      parsedWeeks: result.data.parsedWeeks,
      metadata: {
        ...(result.data.metadata || {}),
        fileName: file.name,
        fileSize: file.size,
        source: 'pdf',
      },
      reviewText,
      activeWeekNumber: getActiveWeekNumber(),
      fallbackDay: getFallbackDay(),
      review: summarizeWeeksForReview(result.data.parsedWeeks, 'pdf', file.name, { reviewText }),
    };

    return { success: true, review: pendingImportReview.review, source: 'pdf' };
  }

  async function previewUniversalImport(file) {
    const fileInfo = classifyUniversalImportFile(file);
    let source = 'text';
    let rawText = '';
    let parsedWeeks = [];
    let reviewText = '';

    try {
      if (isImageFile(file)) {
        source = 'image';
        onProgress({
          stage: 'media-ocr',
          message: 'Lendo texto da imagem...',
          fileName: file.name,
          source,
        });
        rawText = await extractTextFromImageFile(file);
      } else if (isVideoFile(file)) {
        source = 'video';
        rawText = await extractTextFromVideoFile(file, {
          onProgress: (progress) => onProgress({
            fileName: file.name,
            source,
            ...progress,
          }),
        });
      } else if (isSpreadsheetFile(file)) {
        source = 'spreadsheet';
        rawText = await extractTextFromSpreadsheetFile(file, {
          onProgress: (progress) => onProgress({
            fileName: file.name,
            source,
            ...progress,
          }),
        });
      } else if (isTextLikeImportFile(file)) {
        source = 'text';
        rawText = await file.text();
        const maybeStructuredWorkout = importWorkoutAsWeeks(rawText, getActiveWeekNumber());
        if (maybeStructuredWorkout?.success) {
          source = 'structured-json';
          parsedWeeks = maybeStructuredWorkout.data;
        }
      } else {
        throw new Error(fileInfo.error || `Formato não suportado: ${file.type || file.name}`);
      }

      if (source !== 'structured-json') {
        reviewText = prepareImportTextForParsing(rawText, { fileName: file.name });
      }

      parsedWeeks = parsedWeeks.length
        ? parsedWeeks
        : parseTextIntoWeeks(rawText, getActiveWeekNumber(), {
            fallbackDay: getFallbackDay(),
            fileName: file.name,
          });

      if (!parsedWeeks.length) {
        throw new Error('Não foi possível identificar treinos no conteúdo importado');
      }

      pendingImportReview = {
        parsedWeeks,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          source,
        },
        reviewText,
        activeWeekNumber: getActiveWeekNumber(),
        fallbackDay: getFallbackDay(),
        review: summarizeWeeksForReview(parsedWeeks, source, file.name, { reviewText }),
      };

      return {
        success: true,
        preview: true,
        review: pendingImportReview.review,
        source,
      };
    } catch (error) {
      return { success: false, error: error?.message || 'Erro ao importar arquivo' };
    }
  }
}

function summarizeWeeksForReview(weeks = [], source = 'text', fileName = '', options = {}) {
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
      const intervalSummary = blocks
        .map((block) => buildIntervalReviewSummary(block))
        .find(Boolean) || '';

      previewDays.push({
        weekNumber: week?.weekNumber || null,
        day: workout?.day || '',
        periods: periods.slice(0, 3),
        blockTypes: blockTypes.slice(0, 4),
        goal: goals[0] || '',
        movements: movements.slice(0, 3),
        intervalSummary,
      });
    }
  }

  return {
    fileName,
    source,
    weeksCount: normalizedWeeks.length,
    totalDays: previewDays.length,
    totalBlocks,
    weekNumbers: normalizedWeeks.map((week) => week?.weekNumber).filter(Boolean),
    days: previewDays.slice(0, 6),
    reviewText: typeof options.reviewText === 'string' ? options.reviewText : '',
    canEditText: Boolean(options.reviewText),
  };
}

function buildIntervalReviewSummary(block = {}) {
  const parsed = block?.parsed || {};
  const rounds = Number(parsed?.rounds || 0);
  const timedItems = (parsed?.items || []).filter((item) => Number(item?.durationSeconds) > 0);
  if (!rounds || !timedItems.length) return '';

  const segments = timedItems
    .map((item) => item.type === 'rest'
      ? `${item.durationSeconds}s rest`
      : `${item.durationSeconds}s ${item.displayName || item.canonicalName || item.name || 'trabalho'}`)
    .slice(0, 4);

  return `${rounds} rounds · ${segments.join(' · ')}`;
}
