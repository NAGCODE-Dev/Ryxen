/**
 * Selectors: funções derivadas do estado
 * 
 * Evitam duplicação de lógica e centralizam transformações
 */

import { getState } from './store.js';

/**
 * Retorna o treino do dia atual (já filtrado)
 */
export function getTodayWorkout() {
  const state = getState();
  
  if (!state.workout || !state.currentDay) {
    return null;
  }
  
  return state.workout;
}

/**
 * Retorna exercícios que estão sem PR definido
 */
export function getMissingPRs() {
  const state = getState();
  const workout = getTodayWorkout();
  
  if (!workout) return [];
  
  const exercisesInWorkout = new Set();
  
  const blocks = workout.blocks || workout.sections || [];

  blocks.forEach(section => {
    section.lines?.forEach(rawLine => {
      const line = typeof rawLine === 'string'
        ? rawLine
        : String(rawLine?.raw || rawLine?.text || '');

      // Busca por padrões de exercício (maiúsculas, etc)
      const match = line.match(/\b([A-Z][A-Z\s]+)\b/);
      if (match) {
        const exercise = match[1].trim();
        if (!state.prs[exercise]) {
          exercisesInWorkout.add(exercise);
        }
      }
    });
  });
  
  return Array.from(exercisesInWorkout);
}

/**
 * Retorna se o app está pronto para exibir treino
 */
export function isWorkoutReady() {
  const state = getState();
  return !!(state.weeks?.length && state.currentDay && state.workout);
}

/**
 * Retorna se é dia de descanso
 */
export function isRestDay() {
  const state = getState();
  return state.currentDay === 'Domingo';
}

/**
 * Retorna estatísticas do treino
 */
export function getWorkoutStats() {
  const workout = getTodayWorkout();
  
  if (!workout) {
    return { exercises: 0, sets: 0, sections: 0 };
  }

  const sections = workout.blocks || workout.sections || [];

  return {
    sections: sections.length,
    exercises: sections.reduce((acc, s) => acc + (s.lines?.length || 0), 0),
    sets: sections.reduce((acc, section) => {
      return acc + (section.lines || []).reduce((lineAcc, rawLine) => {
        return lineAcc + extractSetCount(rawLine);
      }, 0);
    }, 0),
  };
}

/**
 * Retorna se há avisos (warnings) no treino
 */
export function hasWarnings() {
  const state = getState();
  return state.ui.hasWarnings || getMissingPRs().length > 0;
}

function extractSetCount(rawLine) {
  const line = typeof rawLine === 'string'
    ? rawLine
    : String(rawLine?.raw || rawLine?.text || '');

  if (!line) return 0;

  const normalized = line.trim();

  const setPatterns = [
    /^(\d+)\s*[x×]\s*\d+/i,
    /\b(\d+)\s*sets?\b/i,
    /\bfor\s+(\d+)\s*sets?\b/i,
    /^emom\s+(\d+)\b/i,
    /^every\s+\d+\s*(?:min|mins|minute|minutes)\s*x\s*(\d+)\b/i,
    /^(\d+)\s*rounds?\b/i,
  ];

  for (const pattern of setPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}
