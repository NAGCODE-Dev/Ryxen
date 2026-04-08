import { inferExerciseHelp } from './workoutExerciseHelp.js';
import { renderWorkoutSpecialLine } from './workoutSpecialLines.js';

export function renderWorkoutBlock(block, blockIndex, ui, helpers = {}) {
  const { escapeHtml } = helpers;
  const lines = block?.lines || [];
  return `
    <div class="workout-block">
      ${lines.map((line, lineIndex) => {
        const lineId = `b${blockIndex}-l${lineIndex}`;
        return renderWorkoutLine(line, lineId, ui, { escapeHtml });
      }).join('')}
    </div>
  `;
}

function renderWorkoutLine(line, lineId, ui, { escapeHtml }) {
  const rawText = typeof line === 'string' ? line : (line?.raw || line?.text || '');
  const display = typeof line === 'object' ? (line.calculated ?? '') : '';
  const hasLoad = !!String(display).trim();
  const isWarning = !!(typeof line === 'object' && line.hasWarning);

  const text = escapeHtml(rawText);
  const exerciseHelp = !hasLoad ? inferExerciseHelp(rawText) : null;
  const specialLineHtml = renderWorkoutSpecialLine(line, lineId, { escapeHtml });
  if (specialLineHtml !== null) return specialLineHtml;

  const loadHtml = hasLoad ? `
    <div class="load-calc ${isWarning ? 'load-warning' : ''}">
      ${escapeHtml(display)}
    </div>
  ` : '';
  const helpActionHtml = exerciseHelp ? `
    <button
      class="exercise-helpBtn"
      type="button"
      data-action="exercise:help"
      data-exercise="${escapeHtml(exerciseHelp.label)}"
      data-url="${escapeHtml(exerciseHelp.youtubeUrl)}"
      title="Ver execução"
      aria-label="Ver execução de ${escapeHtml(exerciseHelp.label)}"
    >
      Executar
    </button>
  ` : '';

  return `
    <div class="workout-line" data-line-id="${escapeHtml(lineId)}">
      <span class="workout-lineMarker" aria-hidden="true"></span>
      <div class="exercise-main">
        <div class="exercise-text">${text}</div>
        ${loadHtml}
      </div>
      ${helpActionHtml}
    </div>
  `;
}
