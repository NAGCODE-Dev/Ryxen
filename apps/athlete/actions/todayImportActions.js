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
    readAppState,
    pickJsonFile,
    explainImportFailure,
  } = context;

  switch (action) {
    case 'pdf:pick': {
      return handleAthletePdfImport(context);
    }

    case 'media:pick': {
      return handleAthleteMediaImport(context);
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
