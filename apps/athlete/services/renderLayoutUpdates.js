import { updateAthleteRenderCounters } from './renderCounters.js';
import { ATHLETE_RENDER_SURFACES } from './renderSurfaceConfig.js';
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
  const dependencies = {
    buildHeaderSignature,
    buildMainSignature,
    buildBottomSignature,
    buildModalSignature,
    renderHeaderAccount,
    renderMainContent,
    renderBottomNav,
    renderModals,
  };

  ATHLETE_RENDER_SURFACES.forEach((surface) => {
    applyAthleteRenderSurface({
      state,
      refs,
      refKey: surface.refKey,
      signatureKey: surface.signatureKey,
      htmlKey: surface.htmlKey,
      buildSignature: dependencies[surface.buildSignatureKey],
      renderContent: dependencies[surface.renderContentKey],
      lastRendered,
      setLayoutHtml,
    });
  });

  updateAthleteRenderCounters({
    state,
    refs,
    setLayoutText,
  });
}
