import {
  buildAthleteUiForRender,
} from '../state/uiState.js';
import {
  safeGetAthleteAppState,
  safeGetAthleteProfile,
} from './uiControllerHelpers.js';
import {
  createObjectIdentityTracker,
  createRenderSignatures,
  createRenderStateCache,
} from './renderControllerHelpers.js';
import { createRenderScheduler } from './renderScheduler.js';

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
  const lastRendered = createRenderStateCache();
  const { getObjectIdentity } = createObjectIdentityTracker();
  const {
    buildHeaderSignature,
    buildBottomSignature,
    buildModalSignature,
    buildMainSignature,
  } = createRenderSignatures({ getObjectIdentity });

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
  return createRenderScheduler({ performRender });
}
