import { autoConvertWorkoutLbs } from '../core/services/loadCalculator.js';
import { calculateLoads } from '../core/usecases/calculateLoads.js';
import {
  isCalculatedLine,
  normalizeWorkoutBlocks,
  toWorkoutBlocks,
} from './workoutHelpers.js';

function getActiveWeekFromState(state) {
  if (!state?.activeWeekNumber) return null;
  return state.weeks?.find((week) => week.weekNumber === state.activeWeekNumber) || null;
}

function hasUploadedMultiDayPlan(state) {
  const weeks = Array.isArray(state?.weeks) ? state.weeks : [];
  let totalDays = 0;

  for (const week of weeks) {
    totalDays += Array.isArray(week?.workouts) ? week.workouts.length : 0;
    if (totalDays > 1) return true;
  }

  return false;
}

function buildWorkoutContext(state, coachWorkout) {
  const uploadedPlanAvailable = hasUploadedMultiDayPlan(state);
  const coachAvailable = !!coachWorkout;
  const preferredSource = state?.preferences?.workoutPriority === 'coach' ? 'coach' : 'uploaded';

  return {
    coachAvailable,
    uploadedPlanAvailable,
    canToggle: coachAvailable && uploadedPlanAvailable,
    preferredSource,
  };
}

export function createWorkoutDomain({
  getState,
  setState,
  emit,
  logDebug,
  getWorkoutFromWeek,
  getCoachWorkoutForCurrentDay,
  prepareWorkoutEntity,
  summarizeWorkoutIssues,
  createDefensiveWorkoutSnapshot,
  captureAppError,
  trackError,
}) {
  async function buildWorkoutBlocksWithLoads(workout, state = getState()) {
    let blocks = Array.isArray(workout?.blocks)
      ? normalizeWorkoutBlocks(workout.blocks)
      : normalizeWorkoutBlocks(toWorkoutBlocks(workout).blocks);

    if (state.preferences.autoConvertLbs !== false && blocks.length) {
      blocks = blocks.map((block) => ({
        ...block,
        lines: Array.isArray(block.lines) ? autoConvertWorkoutLbs(block.lines) : [],
      }));
      logDebug('🔄 Conversão lbs→kg aplicada');
    }

    let hasWarnings = false;
    let blocksWithLoads = blocks;

    try {
      const loadResult = calculateLoads({
        day: workout?.day || state.currentDay,
        sections: blocks,
      }, state.prs, state.preferences);

      if (loadResult.success && Array.isArray(loadResult.data) && loadResult.data.length) {
        hasWarnings = loadResult.hasWarnings || false;
        let globalIndex = 0;

        blocksWithLoads = blocks.map((block) => ({
          ...block,
          lines: block.lines.map((line) => {
            const result = loadResult.data[globalIndex++];

            if (isCalculatedLine(line)) return line;
            if (result?.hasPercent && result.calculatedText) {
              return {
                raw: result.originalLine || line,
                calculated: result.calculatedText,
                hasWarning: result.isWarning || false,
                isMax: result.isMax || false,
              };
            }
            if (result?.isExerciseHeader) {
              return {
                ...(typeof line === 'object' && line !== null ? line : {}),
                raw: result.originalLine || line,
                isHeader: true,
                exercise: result.exercise,
              };
            }
            if (result?.isRest) {
              const sourceText = String(result.originalLine || line || '');
              const minuteMatch = sourceText.match(/(\d+)\s*['`´]/);
              const secondMatch = sourceText.match(/(\d+)\s*s\b/i);
              return {
                ...(typeof line === 'object' && line !== null ? line : {}),
                raw: result.originalLine || line,
                isRest: true,
                durationMinutes: minuteMatch ? Number(minuteMatch[1]) : null,
                durationSeconds: minuteMatch
                  ? Number(minuteMatch[1]) * 60
                  : (secondMatch ? Number(secondMatch[1]) : null),
              };
            }
            return line;
          }),
        }));
      }
    } catch (error) {
      console.error('❌ Erro ao calcular cargas:', error);
    }

    return { hasWarnings, blocksWithLoads, blocks };
  }

  async function applyWorkoutToState(workout, meta = {}) {
    const state = getState();
    const prepared = prepareWorkoutEntity(workout, state, meta);

    if (!prepared.isValid) {
      const message = summarizeWorkoutIssues(prepared.issues) || 'Treino inválido';
      const validationError = new Error(message);
      const defensiveContext = {
        tags: { feature: 'workout', source: meta.source || 'unknown', stage: 'prepare_entity' },
        issues: prepared.issues,
        snapshot: createDefensiveWorkoutSnapshot(state),
        day: workout?.day || state.currentDay || null,
        weekNumber: meta.weekNumber || state.activeWeekNumber || null,
      };
      captureAppError(validationError, defensiveContext);
      trackError(validationError, defensiveContext);
      throw validationError;
    }

    const entity = prepared.entity;
    const blocks = await buildWorkoutBlocksWithLoads(entity, state);

    setState({
      workout: {
        ...entity,
        day: entity.day || state.currentDay,
        blocks: blocks.blocksWithLoads,
      },
      workoutMeta: {
        source: meta.source || 'local',
        weekNumber: meta.weekNumber || null,
        coachWorkoutId: meta.coachWorkoutId || null,
        gymId: meta.gymId || null,
        gymName: meta.gymName || '',
        title: meta.title || workout?.title || '',
        scheduledDate: meta.scheduledDate || '',
        receivedAt: meta.receivedAt || '',
        expiresAt: meta.expiresAt || '',
        transformTrace: entity.transformTrace,
        validationIssues: prepared.issues,
      },
      workoutContext: meta.context || state.workoutContext,
      ui: {
        ...state.ui,
        activeScreen: 'workout',
        hasWarnings: blocks.hasWarnings,
      },
    });

    return blocks;
  }

  async function processWorkoutFromWeek(week) {
    const state = getState();
    const dayName = state.currentDay;

    if (dayName === 'Domingo') {
      setState({
        workout: null,
        workoutMeta: null,
        ui: { ...state.ui, activeScreen: 'rest' },
      });
      logDebug('💤 Dia de descanso');
      return;
    }

    const resolvedWorkout = getWorkoutFromWeek(week, dayName);

    if (!resolvedWorkout) {
      setState({
        workout: null,
        workoutMeta: null,
        ui: { ...state.ui, activeScreen: 'welcome' },
      });
      logDebug(`⚠️ Nenhum treino para ${dayName} na semana ${week.weekNumber}`);
      return;
    }

    const applied = await applyWorkoutToState(resolvedWorkout, {
      source: 'local',
      weekNumber: week.weekNumber,
      dayName,
      context: {
        ...buildWorkoutContext(state, null),
        activeSource: 'uploaded',
      },
    });

    logDebug('💪 Treino carregado:', {
      day: dayName,
      week: week.weekNumber,
      blocks: applied.blocks.length,
      totalLines: applied.blocks.reduce((sum, block) => sum + block.lines.length, 0),
    });

    emit('workout:loaded', { workout: resolvedWorkout, week: week.weekNumber });
    return applied;
  }

  async function processCoachWorkout(entry) {
    const state = getState();
    const payload = entry?.payload || {};
    const context = buildWorkoutContext(state, entry);
    const workout = {
      day: state.currentDay,
      title: entry?.title || payload?.title || state.currentDay,
      description: entry?.description || payload?.description || '',
      blocks: Array.isArray(payload?.blocks) ? payload.blocks : toWorkoutBlocks({
        day: state.currentDay,
        sections: Array.isArray(payload?.sections) ? payload.sections : [],
      }).blocks,
    };

    const applied = await applyWorkoutToState(workout, {
      source: 'coach',
      coachWorkoutId: entry?.id || null,
      gymId: entry?.gymId || null,
      gymName: entry?.gymName || '',
      title: entry?.title || '',
      scheduledDate: entry?.scheduledDate || '',
      receivedAt: entry?.receivedAt || '',
      expiresAt: entry?.expiresAt || '',
      context: {
        ...context,
        activeSource: 'coach',
      },
    });

    emit('workout:loaded', {
      workout,
      source: 'coach',
      coachWorkoutId: entry?.id || null,
    });

    logDebug('📨 Treino do coach aplicado:', {
      workoutId: entry?.id,
      gym: entry?.gymName,
      scheduledDate: entry?.scheduledDate,
      blocks: applied.blocks.length,
    });

    return applied;
  }

  async function applyPreferredWorkout(options = {}) {
    const state = getState();
    const coachWorkout = await getCoachWorkoutForCurrentDay(state);
    const context = buildWorkoutContext(state, coachWorkout);

    if (coachWorkout && (!context.uploadedPlanAvailable || context.preferredSource === 'coach')) {
      try {
        await processCoachWorkout(coachWorkout);
        return { success: true, source: 'coach' };
      } catch (error) {
        const defensiveContext = {
          feature: 'workout',
          source: 'coach',
          stage: 'preferred_candidate',
          snapshot: createDefensiveWorkoutSnapshot(state),
        };
        captureAppError(error, { tags: { feature: 'workout', source: 'coach', stage: 'preferred_candidate' }, snapshot: defensiveContext.snapshot });
        trackError(error, defensiveContext);
      }
    }

    const week = getActiveWeekFromState(state);
    if (week) {
      try {
        await processWorkoutFromWeek(week);
        setState({
          workoutContext: {
            ...context,
            activeSource: 'uploaded',
          },
        });
        return { success: true, source: 'local' };
      } catch (error) {
        const defensiveContext = {
          feature: 'workout',
          source: 'uploaded',
          stage: 'preferred_candidate',
          snapshot: createDefensiveWorkoutSnapshot(state),
          weekNumber: week.weekNumber || null,
        };
        captureAppError(error, { tags: { feature: 'workout', source: 'uploaded', stage: 'preferred_candidate' }, snapshot: defensiveContext.snapshot, weekNumber: defensiveContext.weekNumber });
        trackError(error, defensiveContext);
      }
    }

    if (state.workout && state.workoutMeta?.source === 'manual') {
      try {
        await applyWorkoutToState(state.workout, {
          ...(state.workoutMeta || { source: 'manual' }),
          context: {
            ...context,
            activeSource: 'manual',
          },
        });
        return { success: true, source: 'manual' };
      } catch (error) {
        const defensiveContext = {
          feature: 'workout',
          source: 'manual',
          stage: 'preferred_candidate',
          snapshot: createDefensiveWorkoutSnapshot(state),
        };
        captureAppError(error, { tags: { feature: 'workout', source: 'manual', stage: 'preferred_candidate' }, snapshot: defensiveContext.snapshot });
        trackError(error, defensiveContext);
      }
    }

    if (state.currentDay === 'Domingo') {
      setState({
        workout: null,
        workoutMeta: null,
        workoutContext: {
          ...context,
          activeSource: 'rest',
        },
        ui: { ...state.ui, activeScreen: 'rest' },
      });
      return { success: true, source: 'rest' };
    }

    if (options.fallbackToWelcome) {
      setState({
        workout: null,
        workoutMeta: null,
        workoutContext: {
          ...context,
          activeSource: 'empty',
        },
        ui: { ...state.ui, activeScreen: 'welcome' },
      });
    }

    return { success: true, source: 'empty' };
  }

  return {
    applyPreferredWorkout,
    processWorkoutFromWeek,
    processCoachWorkout,
    applyWorkoutToState,
    buildWorkoutBlocksWithLoads,
  };
}
