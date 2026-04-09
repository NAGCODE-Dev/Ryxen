export async function handleAthleteWodNavigation(action, context) {
  const {
    element,
    root,
    toast,
    getUiState,
    applyUiPatch,
    workoutKeyFromAppState,
    getActiveLineIdFromUi,
    getLineIdsFromDOM,
    pickNextId,
    pickPrevId,
    scrollToLine,
    startRestTimer,
    startWorkoutTimer,
  } = context;

  switch (action) {
    case 'wod:toggle': {
      const lineId = element.dataset.lineId;
      if (!lineId) return true;

      await applyUiPatch((state) => {
        const next = { ...state };
        const key = workoutKeyFromAppState();
        next.wod = next.wod || {};
        const wod = next.wod[key] || { activeLineId: null, done: {} };
        wod.done = wod.done || {};
        wod.done[lineId] = !wod.done[lineId];
        wod.activeLineId = lineId;
        next.wod[key] = wod;
        return next;
      });
      scrollToLine(root, lineId);
      return true;
    }

    case 'wod:next': {
      await applyUiPatch((state) => {
        const next = { ...state };
        const key = workoutKeyFromAppState();
        next.wod = next.wod || {};
        const wod = next.wod[key] || { activeLineId: null, done: {} };
        wod.done = wod.done || {};

        const ids = getLineIdsFromDOM(root);
        if (!ids.length) return next;

        const current = wod.activeLineId;
        if (current && ids.includes(current)) wod.done[current] = true;

        const nextId = pickNextId(ids, wod.done, current);
        wod.activeLineId = nextId;
        next.wod[key] = wod;
        return next;
      });
      const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
      if (id) scrollToLine(root, id);
      return true;
    }

    case 'wod:prev': {
      await applyUiPatch((state) => {
        const next = { ...state };
        const key = workoutKeyFromAppState();
        next.wod = next.wod || {};
        const wod = next.wod[key] || { activeLineId: null, done: {} };

        const ids = getLineIdsFromDOM(root);
        if (!ids.length) return next;

        const current = wod.activeLineId;
        wod.activeLineId = pickPrevId(ids, current);
        next.wod[key] = wod;
        return next;
      });
      const id = getActiveLineIdFromUi(getUiState(), workoutKeyFromAppState());
      if (id) scrollToLine(root, id);
      return true;
    }

    case 'timer:start': {
      const seconds = Number(element.dataset.seconds);
      if (!seconds || seconds <= 0) return true;
      startRestTimer(seconds, toast, { mode: element.dataset.timerMode || 'popup' });
      return true;
    }

    case 'timer:workout': {
      const kind = element.dataset.timerKind || 'countdown';
      const config = {
        kind,
        label: element.dataset.label || 'Timer do treino',
        detail: element.dataset.detail || '',
        completionMessage: element.dataset.completionMessage || 'Timer finalizado',
        prepSeconds: Number(element.dataset.prepSeconds || 10),
      };

      if (kind === 'interval') {
        config.rounds = Number(element.dataset.rounds || 0);
        config.workSeconds = Number(element.dataset.workSeconds || 0);
        config.restSeconds = Number(element.dataset.restSeconds || 0);
      } else if (kind === 'sequence') {
        config.rounds = Number(element.dataset.rounds || 0);
        try {
          config.segments = JSON.parse(element.dataset.segments || '[]');
        } catch {
          config.segments = [];
        }
      } else {
        config.totalSeconds = Number(element.dataset.seconds || 0);
        config.capSeconds = Number(element.dataset.capSeconds || 0);
      }

      startWorkoutTimer(config, toast, { mode: element.dataset.timerMode || 'popup' });
      return true;
    }

    default:
      return false;
  }
}
