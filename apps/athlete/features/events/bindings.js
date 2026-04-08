import { getAppBridge } from '../../../../src/app/bridge.js';
import { createAthleteAppEventBindings } from './appBindings.js';
import { createAthleteImportEventBindings } from './importBindings.js';

export function bindAthleteAppEvents({ pushEventLine, rerender, toast, setBusy, setImportStatus }) {
  const busy = typeof setBusy === 'function' ? setBusy : () => {};
  const updateImportStatus = typeof setImportStatus === 'function' ? setImportStatus : () => {};

  if (!getAppBridge()?.on) {
    pushEventLine?.('EventBus indisponível.');
    return () => {};
  }

  const on = getAppBridge().on;
  const handlers = [
    ...createAthleteAppEventBindings({
      busy,
      pushEventLine,
      toast,
      rerender,
    }),
    ...createAthleteImportEventBindings({
      busy,
      updateImportStatus,
      pushEventLine,
      toast,
      rerender,
    }),
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
