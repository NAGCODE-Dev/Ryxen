import { parseWeekText } from '../adapters/pdf/customPdfParser.js';

export function createImportDraft(weeks = []) {
  const safeWeeks = Array.isArray(weeks) ? weeks : [];
  return {
    weeks: safeWeeks.map((week, weekIndex) => ({
      id: `week-${week?.weekNumber || weekIndex + 1}`,
      weekNumber: Number(week?.weekNumber || weekIndex + 1),
      workouts: Array.isArray(week?.workouts)
        ? week.workouts.map((workout, workoutIndex) => ({
            id: `week-${week?.weekNumber || weekIndex + 1}-workout-${workoutIndex + 1}`,
            enabled: true,
            day: String(workout?.day || '').trim(),
            lines: serializeWorkoutLines(workout),
          }))
        : [],
    })),
  };
}

export function buildWeeksFromImportDraft(draft = {}) {
  const safeWeeks = Array.isArray(draft?.weeks) ? draft.weeks : [];

  return safeWeeks
    .map((week, index) => {
      const weekNumber = Number(week?.weekNumber || index + 1);
      const enabledWorkouts = (Array.isArray(week?.workouts) ? week.workouts : [])
        .filter((workout) => workout?.enabled !== false)
        .map((workout) => ({
          day: String(workout?.day || '').trim(),
          text: buildWorkoutText(workout),
        }))
        .filter((workout) => workout.day && workout.text);

      if (!enabledWorkouts.length) return null;

      const syntheticWeekText = [
        `SEMANA ${weekNumber}`,
        ...enabledWorkouts.flatMap((workout) => [String(workout.day).toUpperCase(), workout.text]),
      ].join('\n');

      const parsed = parseWeekText(syntheticWeekText, weekNumber);
      return parsed?.workouts?.length ? parsed : null;
    })
    .filter(Boolean);
}

function serializeWorkoutLines(workout = {}) {
  const blocks = Array.isArray(workout?.blocks)
    ? workout.blocks
    : Array.isArray(workout?.sections)
      ? workout.sections
      : [];

  const lines = [];
  blocks.forEach((block) => {
    const type = String(block?.type || 'DEFAULT').trim();
    if (type && type !== 'DEFAULT') {
      lines.push({
        id: `line-${lines.length + 1}`,
        enabled: true,
        kind: 'block',
        blockType: type,
        text: type,
      });
    }
    (block?.lines || []).forEach((line) => {
      const text = typeof line === 'string'
        ? line
        : String(line?.raw || line?.text || '').trim();
      if (!text) return;

      lines.push({
        id: `line-${lines.length + 1}`,
        enabled: true,
        kind: 'line',
        blockType: type || 'DEFAULT',
        text,
      });
    });
  });

  return lines;
}

function buildWorkoutText(workout = {}) {
  const draftLines = Array.isArray(workout?.lines) ? workout.lines : [];
  if (draftLines.length) {
    return draftLines
      .filter((line) => line?.enabled !== false)
      .map((line) => String(line?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return serializeWorkoutLines(workout)
    .map((line) => String(line?.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function summarizeDraft(workout = {}) {
  const lines = Array.isArray(workout?.lines) ? workout.lines : [];
  return {
    total: lines.length,
    enabled: lines.filter((line) => line?.enabled !== false).length,
  };
}

function serializeWorkoutText(workout = {}) {
  return serializeWorkoutLines(workout)
    .map((line) => String(line?.text || '').trim())
    .filter(Boolean)
    .join('\n');
}

// backward-compatible helper used by older tests or callers
export { serializeWorkoutText };
