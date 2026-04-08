export function createAthleteAppEventBindings({
  busy,
  pushEventLine,
  toast,
  rerender,
}) {
  return [
    ['app:ready', () => {
      busy(false);
      pushEventLine?.('App pronto');
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
}
