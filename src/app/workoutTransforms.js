import { normalizeWorkoutBlocks, toWorkoutBlocks } from './workoutHelpers.js';

function asTrimmedString(value) {
  return String(value || '').trim();
}

export function prepareWorkoutEntity(workout, state = {}, meta = {}) {
  const source = asTrimmedString(meta.source || 'unknown') || 'unknown';
  const day = asTrimmedString(workout?.day || state?.currentDay);
  const title = asTrimmedString(workout?.title || meta.title || day);
  const description = asTrimmedString(workout?.description || '');
  const rawBlocks = Array.isArray(workout?.blocks)
    ? workout.blocks
    : toWorkoutBlocks(workout || {}).blocks;
  const blocks = normalizeWorkoutBlocks(rawBlocks);
  const issues = validateWorkoutBlocks(blocks, { day, source });

  if (!day) {
    issues.push({
      code: 'missing_day',
      severity: 'error',
      message: 'Treino sem dia definido',
    });
  }

  if (!blocks.length) {
    issues.push({
      code: 'missing_blocks',
      severity: 'error',
      message: 'Treino sem blocos',
    });
  }

  return {
    entity: {
      kind: 'Workout',
      source,
      day,
      title,
      description,
      blocks,
      transformTrace: [
        { name: 'entity:hydrate', source },
        { name: 'blocks:normalize', blockCount: blocks.length },
        { name: 'entity:validate', issueCount: issues.length },
      ],
    },
    issues,
    isValid: !issues.some((issue) => issue.severity === 'error'),
  };
}

export function summarizeWorkoutIssues(issues = []) {
  const [first] = issues;
  if (!first) return '';
  return first.message || 'Treino inválido';
}

export function createDefensiveWorkoutSnapshot(state = {}) {
  return {
    hasWorkout: !!state?.workout,
    activeWeekNumber: state?.activeWeekNumber || null,
    currentDay: state?.currentDay || null,
    weeksCount: Array.isArray(state?.weeks) ? state.weeks.length : 0,
    activeSource: state?.workoutContext?.activeSource || null,
  };
}

function validateWorkoutBlocks(blocks = [], context = {}) {
  const issues = [];

  blocks.forEach((block, index) => {
    const type = asTrimmedString(block?.type || 'DEFAULT') || 'DEFAULT';
    const lines = Array.isArray(block?.lines) ? block.lines.filter(Boolean) : [];

    if (!type) {
      issues.push({
        code: 'missing_block_type',
        severity: 'warning',
        message: `Bloco ${index + 1} sem tipo definido`,
      });
    }

    if (!lines.length) {
      issues.push({
        code: 'empty_block_lines',
        severity: 'warning',
        message: `Bloco ${index + 1} sem linhas em ${context.day || 'dia atual'}`,
      });
    }
  });

  const nonEmptyBlocks = blocks.filter((block) => Array.isArray(block?.lines) && block.lines.some(Boolean));
  if (!nonEmptyBlocks.length && blocks.length) {
    issues.push({
      code: 'all_blocks_empty',
      severity: 'error',
      message: `Todos os blocos vieram vazios para ${context.day || 'o treino atual'}`,
    });
  }

  return issues;
}
