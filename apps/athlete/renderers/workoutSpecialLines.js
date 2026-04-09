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
    const restSeconds = resolveRestSeconds(line, rawText);

    return `
      <div class="workout-rest" data-line-id="${escapeHtml(lineId)}">
        <div class="rest-badge">Descanso</div>
        <div class="rest-content">
          <span class="rest-text">${text}</span>
          ${restSeconds ? `
            <div class="rest-actions">
              <button
                class="btn-timer"
                data-action="timer:start"
                data-timer-mode="popup"
                data-seconds="${restSeconds}"
                type="button"
              >
                Popup ${formatRestLabel(restSeconds)}
              </button>
              <button
                class="btn-timer btn-timer-secondary"
                data-action="timer:start"
                data-timer-mode="fullscreen"
                data-seconds="${restSeconds}"
                type="button"
              >
                Tela cheia
              </button>
            </div>
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

function resolveRestSeconds(line, rawText) {
  if (typeof line === 'object' && typeof line.durationSeconds === 'number' && line.durationSeconds > 0) {
    return line.durationSeconds;
  }

  if (typeof line === 'object' && typeof line.durationMinutes === 'number' && line.durationMinutes > 0) {
    return line.durationMinutes * 60;
  }

  const minuteMatch = rawText.match(/(\d+)\s*['\`´]/);
  if (minuteMatch) return parseInt(minuteMatch[1], 10) * 60;

  const secondsMatch = rawText.match(/(\d+)\s*s\b/i);
  if (secondsMatch) return parseInt(secondsMatch[1], 10);

  return null;
}

function formatRestLabel(restSeconds) {
  const minutes = Math.floor(restSeconds / 60);
  const seconds = restSeconds % 60;
  if (minutes && !seconds) return `${minutes}min`;
  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
