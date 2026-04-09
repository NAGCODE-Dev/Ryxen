import {
  handleAthleteMediaImport,
  handleAthletePdfImport,
} from './todayFileImportActions.js';
import {
  handleAthleteBackupTransfer,
  handleAthleteWorkoutTransfer,
} from './todayTransferActions.js';

export async function handleAthleteImportAction(action, context) {
  const {
    toast,
    finalizeUiChange,
    getAppBridge,
    getUiState,
    readAppState,
    pickJsonFile,
    explainImportFailure,
    consumeAthleteImport,
  } = context;

  switch (action) {
    case 'pdf:pick': {
      return handleAthletePdfImport(context);
    }

    case 'media:pick': {
      return handleAthleteMediaImport(context);
    }

    case 'import:confirm': {
      const review = getUiState?.()?.importStatus?.review || null;
      const result = await getAppBridge().commitImportReview();
      if (!result?.success) throw new Error(result?.error || 'Falha ao confirmar importação');

      if (review?.benefits) {
        consumeAthleteImport?.(review.benefits, review.importType || result.source || 'media');
      }

      await finalizeUiChange({
        modal: null,
        importStatus: {
          active: false,
          tone: 'success',
          title: 'Importação concluída',
          message: 'Treino salvo com sucesso.',
          fileName: '',
          step: 'done',
          review: null,
        },
        toastMessage: 'Treino importado',
      });
      return true;
    }

    case 'import:cancel-review': {
      const result = await getAppBridge().cancelImportReview();
      if (!result?.success) throw new Error(result?.error || 'Falha ao cancelar review');
      await finalizeUiChange({
        importStatus: {
          active: false,
          tone: 'idle',
          title: '',
          message: '',
          fileName: '',
          step: 'idle',
          review: null,
        },
      });
      toast?.('Preview descartado');
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

    case 'workout:copy': {
      return handleAthleteWorkoutTransfer(action, context);
    }

    case 'backup:export': {
      return handleAthleteBackupTransfer(action, context);
    }

    default:
      return false;
  }
}
