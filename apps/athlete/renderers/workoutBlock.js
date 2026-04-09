import { summarizeWorkoutBlock } from '../workoutMetadataSummary.js';
import { renderWorkoutSpecialLine } from './workoutSpecialLines.js';
import { renderWorkoutStandardLine } from './workoutStandardLine.js';
import { getWorkoutTimerConfig } from './workoutTimerConfig.js';

export function renderWorkoutBlock(block, blockIndex, ui, helpers = {}) {
  const { escapeHtml } = helpers;
  const lines = block?.lines || [];
  const timerConfig = getWorkoutTimerConfig(block);
  const title = String(block?.title || '').trim();
  const period = String(block?.period || '').trim();
  const typeLabel = formatBlockTypeLabel(block?.type);
  const blockSummary = summarizeWorkoutBlock(block);
  const headerMeta = [...new Set([timerConfig?.detail, ...blockSummary.summary].filter(Boolean))];
  const showHeader = !!(title || period || typeLabel || headerMeta.length || blockSummary.details.length || blockSummary.normalizedNames.length);

  return `
    <div class="workout-block">
      ${showHeader ? `
        <div class="workout-blockHeader">
          <div class="workout-blockHeading">
            <div class="workout-blockEyebrow">
              ${period ? `<span class="workout-blockTag">${escapeHtml(period)}</span>` : ''}
              ${typeLabel ? `<span class="workout-blockTag">${escapeHtml(typeLabel)}</span>` : ''}
            </div>
            ${title ? `<strong class="workout-blockTitle">${escapeHtml(title)}</strong>` : ''}
            ${headerMeta.length ? `<span class="workout-blockMeta">${escapeHtml(headerMeta.join(' · '))}</span>` : ''}
            ${blockSummary.details.length ? `
              <div class="workout-blockSummaryList">
                ${blockSummary.details.map((detail) => `<span class="workout-blockSummaryItem">${escapeHtml(detail)}</span>`).join('')}
              </div>
            ` : ''}
            ${blockSummary.normalizedNames.length ? `
              <div class="workout-blockNames">
                ${blockSummary.normalizedNames.map((name) => `<span class="workout-blockName">${escapeHtml(name)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          ${timerConfig ? renderWorkoutTimerActions(timerConfig) : ''}
        </div>
      ` : ''}
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

function renderWorkoutTimerActions(timerConfig) {
  const attrs = buildTimerAttrs(timerConfig);
  return `
    <div class="workout-blockActions">
      <button class="btn-timer" data-action="timer:workout" data-timer-mode="popup" ${attrs} type="button">
        Iniciar 10s
      </button>
      <button class="btn-timer btn-timer-secondary" data-action="timer:workout" data-timer-mode="fullscreen" ${attrs} type="button">
        Tela cheia
      </button>
    </div>
  `;
}

function buildTimerAttrs(timerConfig) {
  const attrs = [
    ['data-timer-kind', timerConfig.kind],
    ['data-label', timerConfig.label],
    ['data-detail', timerConfig.detail],
    ['data-completion-message', timerConfig.completionMessage],
    ['data-prep-seconds', 10],
  ];

  if (timerConfig.totalSeconds) attrs.push(['data-seconds', timerConfig.totalSeconds]);
  if (timerConfig.capSeconds) attrs.push(['data-cap-seconds', timerConfig.capSeconds]);
  if (timerConfig.rounds) attrs.push(['data-rounds', timerConfig.rounds]);
  if (timerConfig.workSeconds) attrs.push(['data-work-seconds', timerConfig.workSeconds]);
  if (timerConfig.restSeconds) attrs.push(['data-rest-seconds', timerConfig.restSeconds]);

  return attrs
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(' ');
}

function formatBlockTypeLabel(type) {
  const value = String(type || '').trim().toUpperCase();
  if (!value || value === 'DEFAULT') return '';
  if (value === 'WOD') return 'WOD';
  if (value === 'ENGINE') return 'Engine';
  if (value === 'STRENGTH') return 'Strength';
  if (value === 'ACCESSORIES') return 'Accessories';
  if (value === 'GYMNASTICS') return 'Gymnastics';
  return value;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
