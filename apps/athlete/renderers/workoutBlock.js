import { renderWorkoutSpecialLine } from './workoutSpecialLines.js';
import { renderWorkoutStandardLine } from './workoutStandardLine.js';

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
  const specialLineHtml = renderWorkoutSpecialLine(line, lineId, { escapeHtml });
  if (specialLineHtml !== null) return specialLineHtml;
  return renderWorkoutStandardLine(line, lineId, { escapeHtml });
}
