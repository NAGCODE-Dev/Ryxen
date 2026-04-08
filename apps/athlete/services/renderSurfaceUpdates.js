export function applyAthleteRenderSurface({
  state,
  refs,
  refKey,
  signatureKey,
  htmlKey,
  buildSignature,
  renderContent,
  lastRendered,
  setLayoutHtml,
}) {
  const signature = buildSignature(state);
  if (signature === lastRendered[signatureKey]) return;

  lastRendered[signatureKey] = signature;
  lastRendered[htmlKey] = renderContent(state);
  setLayoutHtml(refs[refKey], lastRendered[htmlKey]);
}

