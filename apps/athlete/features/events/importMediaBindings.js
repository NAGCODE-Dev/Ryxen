export function createAthleteMediaImportBindings({
  busy,
  updateImportStatus,
  pushEventLine,
  toast,
  rerender,
  stepForImportProgress,
}) {
  return [
    ['media:uploading', (data) => {
      busy(true, data?.type === 'video' ? 'Preparando vídeo...' : 'Processando arquivo...');
      updateImportStatus({
        active: true,
        tone: 'working',
        title: data?.type === 'video' ? 'Importando vídeo' : 'Importando arquivo',
        message: data?.type === 'video' ? 'Preparando vídeo para OCR...' : 'Preparando arquivo para leitura...',
        fileName: data?.fileName || '',
        step: 'selected',
      });
      pushEventLine?.(`Importando: ${data?.fileName || ''}`.trim());
    }],

    ['media:progress', (data) => {
      busy(true, data?.message || 'Processando arquivo...');
      updateImportStatus({
        active: true,
        tone: 'working',
        title:
          data?.type === 'video' ? 'Importando vídeo' :
          data?.type === 'spreadsheet' ? 'Importando planilha' :
          data?.type === 'image' ? 'Importando imagem' :
          data?.type === 'structured-json' ? 'Importando JSON' :
          'Importando arquivo',
        message: data?.message || 'Processando arquivo...',
        fileName: data?.fileName || '',
        step: stepForImportProgress(data),
      });
      if (data?.stage === 'ocr' && data?.processedFrames && data?.totalFrames) {
        pushEventLine?.(`OCR do vídeo ${data.processedFrames}/${data.totalFrames}`);
      } else if (data?.stage === 'sheet-parse' && data?.currentSheet && data?.totalSheets) {
        pushEventLine?.(`Planilha ${data.currentSheet}/${data.totalSheets}`);
      }
    }],

    ['media:uploaded', (data) => {
      busy(false);
      updateImportStatus({
        active: false,
        tone: 'success',
        title: 'Arquivo importado',
        message: `${data?.weeksCount ?? '?'} semana(s) carregada(s) via ${data?.type || 'arquivo'}.`,
        fileName: '',
        step: 'done',
      });
      pushEventLine?.(`Importado (${data?.weeksCount ?? '?'} semanas)`);
      toast?.(`Importado via ${data?.type || 'arquivo'}`);
      rerender?.();
    }],

    ['media:error', (data) => {
      busy(false);
      updateImportStatus({
        active: true,
        tone: 'error',
        title: 'Falha na importação',
        message: data?.error || 'Erro na importação',
        fileName: data?.fileName || '',
        step: 'read',
      });
      pushEventLine?.(`Erro de importação: ${data?.error || 'desconhecido'}`);
      toast?.(data?.error || 'Erro na importação');
      rerender?.();
    }],
  ];
}
