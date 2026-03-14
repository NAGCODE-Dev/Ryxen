export function bindAppEvents({ pushEventLine, rerender, toast, setBusy }) {
  const busy = typeof setBusy === 'function' ? setBusy : () => {};

  if (!window.__APP__?.on) {
    pushEventLine?.('EventBus indisponível.');
    return () => {};
  }

  const on = window.__APP__.on;

  const handlers = [
    ['app:ready', () => {
      busy(false);
      pushEventLine?.('App pronto');
      rerender?.();
    }],

    ['pdf:uploading', (data) => {
      busy(true, 'Enviando PDF…');
      pushEventLine?.(`Enviando PDF: ${data?.fileName || ''}`.trim());
      toast?.('Enviando PDF…');
    }],

    ['pdf:uploaded', (data) => {
      busy(false);
      pushEventLine?.(`PDF carregado (${data?.weeksCount ?? '?'} semanas)`);
      toast?.('PDF carregado');
      rerender?.();
    }],

    ['pdf:error', (data) => {
      busy(false);
      pushEventLine?.(`Erro PDF: ${data?.error || 'desconhecido'}`);
      toast?.(data?.error || 'Erro no PDF');
      rerender?.();
    }],

    ['media:uploading', (data) => {
      busy(true, 'Processando arquivo...');
      pushEventLine?.(`Importando: ${data?.fileName || ''}`.trim());
    }],

    ['media:uploaded', (data) => {
      busy(false);
      pushEventLine?.(`Importado (${data?.weeksCount ?? '?'} semanas)`);
      toast?.(`Importado via ${data?.type || 'arquivo'}`);
      rerender?.();
    }],

    ['media:error', (data) => {
      busy(false);
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

    ['week:changed', (data) => {
      pushEventLine?.(`Semana: ${data?.weekNumber ?? '?'}`);
      rerender?.();
    }],

    ['day:changed', (data) => {
      pushEventLine?.(`Dia: ${data?.dayName ?? '?'}`);
      rerender?.();
    }],

    ['workout:loaded', (data) => {
      busy(false);
      pushEventLine?.(`Treino: ${data?.workout?.day || 'dia'} (semana ${data?.week ?? '?'})`);
      rerender?.();
    }],

    ['pr:updated', (data) => {
      pushEventLine?.(`PR: ${data?.exercise ?? '?'} = ${data?.load ?? '?'}`);
      rerender?.();
    }],

    ['pr:removed', (data) => {
      pushEventLine?.(`PR removido: ${data?.exercise ?? '?'}`);
      rerender?.();
    }],

    ['prs:imported', (data) => {
      pushEventLine?.(`PRs importados: ${data?.imported ?? '?'}`);
      rerender?.();
    }],

    ['prs:exported', (data) => {
      pushEventLine?.(`PRs exportados: ${data?.count ?? '?'}`);
    }],

    ['backup:exported', (data) => {
      pushEventLine?.(`Backup exportado: ${data?.filename || 'arquivo'}`);
      toast?.('Backup salvo');
    }],

    ['backup:imported', (data) => {
      pushEventLine?.(`Backup restaurado (${data?.weeksCount ?? 0} semanas)`);
      toast?.('Backup restaurado');
      rerender?.();
    }],
  ];

  const unsubscribers = handlers.map(([eventName, handler]) => on(eventName, handler));

  return () => {
    unsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe?.();
      } catch (error) {
        console.warn('Falha ao remover listener:', error);
      }
    });
  };
}
