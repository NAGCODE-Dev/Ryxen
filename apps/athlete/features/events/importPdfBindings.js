export function createAthletePdfImportBindings({
  busy,
  updateImportStatus,
  pushEventLine,
  toast,
  rerender,
  stepForImportProgress,
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

    ['pdf:cleared', () => {
      busy(false);
      pushEventLine?.('Todos os PDFs removidos');
      toast?.('PDFs limpos');
      rerender?.();
    }],
  ];
}
