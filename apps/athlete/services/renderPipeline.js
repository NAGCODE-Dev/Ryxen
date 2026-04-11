import { applyAthleteRenderLayout } from './renderLayoutUpdates.js';
import { buildAthleteRenderState } from './renderViewState.js';
import { getNyxGuideStep } from '../features/guide/steps.js';

export function createAthleteRenderPipeline({
  refs,
  getUiState,
  getUiBusy,
  renderHeaderAccount,
  renderMainContent,
  renderBottomNav,
  renderModals,
  setLayoutHtml,
  setLayoutText,
  lastRendered,
  buildHeaderSignature,
  buildBottomSignature,
  buildModalSignature,
  buildMainSignature,
}) {
  return async function performRender() {
    const state = buildAthleteRenderState({ getUiState, getUiBusy });
    const preferences = state?.preferences || {};

    document.body.dataset.page = state.__ui.currentPage || 'today';
    document.body.dataset.uiTheme = 'dark';
    document.body.dataset.accentTone = ['blue', 'sage', 'sand', 'rose', 'teal', 'plum', 'ember'].includes(preferences.accentTone)
      ? preferences.accentTone
      : 'blue';
    document.body.dataset.interfaceDensity = preferences.interfaceDensity === 'compact'
      ? 'compact'
      : 'comfortable';
    document.body.dataset.motion = preferences.reduceMotion ? 'reduced' : 'full';
    const guideTarget = state?.__ui?.modal === 'nyx-guide'
      ? (getNyxGuideStep(state?.__ui?.guide?.step).target || '')
      : '';
    if (guideTarget) {
      document.body.dataset.guideTarget = guideTarget;
    } else {
      delete document.body.dataset.guideTarget;
    }
    applyAthleteRenderLayout({
      state,
      refs,
      lastRendered,
      buildHeaderSignature,
      buildMainSignature,
      buildBottomSignature,
      buildModalSignature,
      renderHeaderAccount,
      renderMainContent,
      renderBottomNav,
      renderModals,
      setLayoutHtml,
      setLayoutText,
    });
  };
}
