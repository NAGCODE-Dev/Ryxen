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

    default:
      return false;
  }
}
