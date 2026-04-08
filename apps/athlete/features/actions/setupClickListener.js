export function registerAthleteClickListeners({
  root,
  toast,
  clickContext,
  routeAthleteClickAction,
}) {
  root.addEventListener('click', async (event) => {
    const element = event.target.closest('[data-action]');
    if (!element) return;

    const action = element.dataset.action;

    try {
      const handled = await routeAthleteClickAction(action, {
        element,
        ...clickContext,
      });
      if (handled) return;
    } catch (err) {
      toast(err?.message || 'Erro');
      console.error(err);
    }
  });
}
