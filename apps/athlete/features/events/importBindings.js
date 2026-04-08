export function stepForImportProgress(data = {}) {
  if (data.stage === 'pdf-save') return 'save';
  if (data.stage === 'pdf-parse') return 'organize';
  if (data.stage === 'pdf-open' || data.stage === 'pdf-text' || data.stage === 'pdf-ocr-start' || data.stage === 'pdf-ocr') return 'read';
  if (data.stage === 'sheet-read' || data.stage === 'sheet-parse' || data.stage === 'ocr' || data.stage === 'frames-ready') return 'read';
  if (data.message && /salvand/i.test(data.message)) return 'save';
  if (data.message && /organizando|convertendo/i.test(data.message)) return 'organize';
  if (data.message && /lendo|ocr|preparando|extraindo|processando/i.test(data.message)) return 'read';
  return 'selected';
}

export function createAthleteImportEventBindings({
  busy,
  updateImportStatus,
  pushEventLine,
  toast,
  rerender,
}) {
  return [
    ['pdf:uploading', (data) => {
      busy(true, 'Enviando PDF…');
      updateImportStatus({
        active: true,
        tone: 'working',
        title: 'Importando PDF',
        message: 'Preparando arquivo para leitura...',
        fileName: data?.fileName || '',
        step: 'selected',
      });
      pushEventLine?.(`Enviando PDF: ${data?.fileName || ''}`.trim());
    }],

    ['pdf:progress', (data) => {
      busy(true, data?.message || 'Processando PDF...');
      updateImportStatus({
        active: true,
        tone: 'working',
        title: 'Importando PDF',
        message: data?.message || 'Processando PDF...',
        fileName: data?.fileName || '',
        step: stepForImportProgress(data),
      });
      if (data?.currentPage && data?.totalPages) {
        pushEventLine?.(`PDF ${data.currentPage}/${data.totalPages}`);
      }
    }],

    ['pdf:uploaded', (data) => {
      busy(false);
      updateImportStatus({
        active: false,
        tone: 'success',
        title: 'PDF importado',
        message: `${data?.weeksCount ?? '?'} semana(s) carregada(s).`,
        fileName: '',
        step: 'done',
      });
      pushEventLine?.(`PDF carregado (${data?.weeksCount ?? '?'} semanas)`);
      toast?.('PDF carregado');
      rerender?.();
    }],

    ['pdf:error', (data) => {
      busy(false);
      updateImportStatus({
        active: true,
        tone: 'error',
        title: 'Falha no PDF',
        message: data?.error || 'Erro no PDF',
        fileName: '',
        step: 'read',
      });
      pushEventLine?.(`Erro PDF: ${data?.error || 'desconhecido'}`);
      toast?.(data?.error || 'Erro no PDF');
      rerender?.();
    }],

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

    ['pdf:cleared', () => {
      busy(false);
      pushEventLine?.('Todos os PDFs removidos');
      toast?.('PDFs limpos');
      rerender?.();
    }],
  ];
}
