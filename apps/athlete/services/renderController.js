import {
  buildAthleteUiForRender,
} from '../state/uiState.js';
import {
  safeGetAthleteAppState,
  safeGetAthleteProfile,
} from './uiController.js';

export function createAthleteRenderController({
  refs,
  getUiState,
  getUiBusy,
  renderHeaderAccount,
  renderMainContent,
  renderBottomNav,
  renderModals,
  setLayoutHtml,
  setLayoutText,
}) {
  const objectIds = new WeakMap();
  let nextObjectId = 1;
  let lastRendered = {
    headerSignature: '',
    headerHtml: '',
    mainSignature: '',
    mainHtml: '',
    bottomSignature: '',
    bottomHtml: '',
    modalSignature: '',
    modalHtml: '',
  };

  let renderQueued = false;
  let renderInflight = null;
  let lastRenderAt = 0;

  const getObjectIdentity = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return String(value ?? '');
    }
    let id = objectIds.get(value);
    if (!id) {
      id = nextObjectId++;
      objectIds.set(value, id);
    }
    return `#${id}`;
  };

  const buildHeaderSignature = (state) => getObjectIdentity(state?.__ui?.auth?.profile || null);
  const buildBottomSignature = (state) => String(state?.__ui?.currentPage || 'today');
  const buildModalSignature = (state) => [
    state?.__ui?.modal || '',
    state?.__ui?.authMode || '',
    getObjectIdentity(state?.__ui?.passwordReset || null),
    getObjectIdentity(state?.__ui?.signupVerification || null),
    getObjectIdentity(state?.__ui?.importStatus || null),
    getObjectIdentity(state?.__ui?.admin || null),
    getObjectIdentity(state?.__ui?.athleteOverview || null),
    getObjectIdentity(state?.__ui?.coachPortal || null),
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    state?.__ui?.isBusy ? '1' : '0',
  ].join('|');
  const buildMainSignature = (state) => [
    state?.__ui?.currentPage || 'today',
    state?.activeWeekNumber ?? '',
    state?.currentDay ?? '',
    getObjectIdentity(state?.weeks || null),
    getObjectIdentity(state?.workout || null),
    getObjectIdentity(state?.workoutOfDay || null),
    getObjectIdentity(state?.workoutContext || null),
    getObjectIdentity(state?.preferences || null),
    getObjectIdentity(state?.prs || null),
    getObjectIdentity(state?.__ui?.settings || null),
    getObjectIdentity(state?.__ui?.athleteOverview || null),
    getObjectIdentity(state?.__ui?.coachPortal || null),
    getObjectIdentity(state?.__ui?.auth?.profile || null),
    state?.__ui?.isBusy ? '1' : '0',
  ].join('|');

  const performRender = async () => {
    const state = safeGetAthleteAppState();
    const uiState = getUiState();

    state.__ui = buildAthleteUiForRender({
      state,
      uiState,
      uiBusy: getUiBusy(),
      profile: safeGetAthleteProfile(),
    });

    document.body.dataset.page = state.__ui.currentPage || 'today';
    const headerSignature = buildHeaderSignature(state);
    if (headerSignature !== lastRendered.headerSignature) {
      lastRendered.headerSignature = headerSignature;
      lastRendered.headerHtml = renderHeaderAccount(state);
      setLayoutHtml(refs.headerAccount, lastRendered.headerHtml);
    }

    const mainSignature = buildMainSignature(state);
    if (mainSignature !== lastRendered.mainSignature) {
      lastRendered.mainSignature = mainSignature;
      lastRendered.mainHtml = renderMainContent(state);
      setLayoutHtml(refs.main, lastRendered.mainHtml);
    }

    const bottomSignature = buildBottomSignature(state);
    if (bottomSignature !== lastRendered.bottomSignature) {
      lastRendered.bottomSignature = bottomSignature;
      lastRendered.bottomHtml = renderBottomNav(state);
      setLayoutHtml(refs.bottomNav, lastRendered.bottomHtml);
    }

    const modalSignature = buildModalSignature(state);
    if (modalSignature !== lastRendered.modalSignature) {
      lastRendered.modalSignature = modalSignature;
      lastRendered.modalHtml = renderModals(state);
      setLayoutHtml(refs.modals, lastRendered.modalHtml);
    }

    if (refs.prsCount) {
      const count = Object.keys(state?.prs || {}).length;
      setLayoutText(refs.prsCount, `${count} PRs`);
    }
  };

  const rerender = () => {
    if (renderInflight) return renderInflight;

    renderInflight = new Promise((resolve, reject) => {
      const flush = () => {
        renderQueued = false;
        Promise.resolve()
          .then(() => performRender())
          .then(() => {
            lastRenderAt = Date.now();
            resolve();
          })
          .catch(reject)
          .finally(() => {
            renderInflight = null;
          });
      };

      if (renderQueued || Date.now() - lastRenderAt < 12) {
        renderQueued = true;
        window.requestAnimationFrame(flush);
        return;
      }

      flush();
    });

    return renderInflight;
  };

  return {
    rerender,
  };
}
