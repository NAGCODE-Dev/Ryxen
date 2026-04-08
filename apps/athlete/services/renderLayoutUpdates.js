import { updateAthleteRenderCounters } from './renderCounters.js';
import { applyAthleteRenderSurface } from './renderSurfaceUpdates.js';

export function applyAthleteRenderLayout({
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
}) {
  applyAthleteRenderSurface({
    state,
    refs,
    refKey: 'headerAccount',
    signatureKey: 'headerSignature',
    htmlKey: 'headerHtml',
    buildSignature: buildHeaderSignature,
    renderContent: renderHeaderAccount,
    lastRendered,
    setLayoutHtml,
  });

  applyAthleteRenderSurface({
    state,
    refs,
    refKey: 'main',
    signatureKey: 'mainSignature',
    htmlKey: 'mainHtml',
    buildSignature: buildMainSignature,
    renderContent: renderMainContent,
    lastRendered,
    setLayoutHtml,
  });

  applyAthleteRenderSurface({
    state,
    refs,
    refKey: 'bottomNav',
    signatureKey: 'bottomSignature',
    htmlKey: 'bottomHtml',
    buildSignature: buildBottomSignature,
    renderContent: renderBottomNav,
    lastRendered,
    setLayoutHtml,
  });

  applyAthleteRenderSurface({
    state,
    refs,
    refKey: 'modals',
    signatureKey: 'modalSignature',
    htmlKey: 'modalHtml',
    buildSignature: buildModalSignature,
    renderContent: renderModals,
    lastRendered,
    setLayoutHtml,
  });

  updateAthleteRenderCounters({
    state,
    refs,
    setLayoutText,
  });
}
