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
    root,
    toast,
    applyUiState,
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

    case 'import:reparse': {
      const textField = root?.querySelector?.('#ui-importReviewText');
      const reviewText = String(textField?.value || '').trim();

      if (!reviewText) {
        toast?.('Edite o texto antes de reprocessar o preview');
        return true;
      }

      await applyUiState({
        importStatus: {
          active: true,
          tone: 'working',
          title: 'Reprocessando preview',
          message: 'Aplicando suas correções no texto...',
          step: 'organize',
        },
      }, { render: false });

      const result = await getAppBridge().reparseImportReview(reviewText);
      if (!result?.success) throw new Error(result?.error || 'Falha ao reprocessar preview');

      toast?.('Preview atualizado');
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
