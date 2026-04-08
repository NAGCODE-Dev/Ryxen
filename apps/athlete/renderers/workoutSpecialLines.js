export function renderWorkoutSpecialLine(line, lineId, { escapeHtml }) {
  const rawText = typeof line === 'string' ? line : (line?.raw || line?.text || '');
  const isHeader = !!(typeof line === 'object' && line.isHeader);
  const isRest = !!(typeof line === 'object' && line.isRest);
  const text = escapeHtml(rawText);

  if (
    rawText.includes('#garanta') ||
    rawText.includes('#treine') ||
    rawText.toLowerCase().includes('@hotmail') ||
    rawText.toLowerCase().includes('@gmail')
  ) {
    return '';
  }

  if (isHeader) {
    return `
      <div class="workout-section-header" data-line-id="${escapeHtml(lineId)}">
        <h3 class="section-title">${text}</h3>
      </div>
    `;
  }

  if (isRest) {
    const restMatch = rawText.match(/(\d+)['\`´]/);
    const restSeconds = restMatch ? parseInt(restMatch[1]) * 60 : null;

    return `
      <div class="workout-rest" data-line-id="${escapeHtml(lineId)}">
        <div class="rest-badge">Descanso</div>
        <div class="rest-content">
          <span class="rest-text">${text}</span>
          ${restSeconds ? `
            <button
              class="btn-timer"
              data-action="timer:start"
              data-seconds="${restSeconds}"
              type="button"
            >
              Timer ${Math.floor(restSeconds / 60)}min
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  if (rawText.startsWith('*')) {
    return `
      <div class="workout-note" data-line-id="${escapeHtml(lineId)}">
        <span class="note-badge">Nota</span>
        <span class="note-text">${text.replace(/^\*+\s*/, '')}</span>
      </div>
    `;
  }

  return null;
}
