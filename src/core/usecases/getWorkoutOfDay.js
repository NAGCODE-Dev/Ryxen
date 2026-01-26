/**
 * Use-case: Obter treino do dia atual
 * Orquestra parsing + filtro por dia
 */

import { parseWorkoutText, getWorkoutByDay } from '../services/workoutService.js';
import { getDayName } from '../utils/date.js';
import { isValidDayName } from '../utils/validators.js';
import { autoConvertWorkoutLbs } from '../services/loadCalculator.js';

/**
 * Retorna treino do dia atual
 * @param {string} pdfText - Texto do PDF
 * @param {Date} date - Data de referência (default: hoje)
 * @param {Object} preferences - Preferências do usuário
 * @returns {Object} Resultado com treino ou erro
 */
export function getWorkoutOfDay(pdfText, date = new Date(), preferences = {}) {
  // Validações
  if (!pdfText || typeof pdfText !== 'string') {
    return {
      success: false,
      error: 'PDF vazio ou inválido',
      data: null,
    };
  }
  
  if (pdfText.trim().length < 50) {
    return {
      success: false,
      error: 'PDF muito pequeno (texto insuficiente)',
      data: null,
    };
  }
  
  // Obtém dia atual
  const dayName = getDayName(date);
  
  if (!isValidDayName(dayName)) {
    return {
      success: false,
      error: 'Dia da semana inválido',
      data: null,
    };
  }
  
  try {
    // Parse do PDF completo
    const allWorkouts = parseWorkoutText(pdfText);
    
    if (!allWorkouts || allWorkouts.length === 0) {
      return {
        success: false,
        error: 'Nenhum treino encontrado no PDF',
        data: null,
      };
    }
    
    // Filtra por dia
    let todayWorkout = getWorkoutByDay(allWorkouts, dayName);
    
    if (!todayWorkout) {
      return {
        success: true,
        warning: `Nenhum treino encontrado para ${dayName}`,
        data: null,
        dayName: dayName,
      };
    }
    
    // 🔥 CONVERSÃO AUTOMÁTICA LBS → KG (default: true)
    if (preferences.autoConvertLbs !== false && todayWorkout.sections) {
      todayWorkout.sections.forEach(section => {
        if (section.lines && Array.isArray(section.lines)) {
          section.lines = autoConvertWorkoutLbs(section.lines);
        }
      });
    }
    
    return {
      success: true,
      data: todayWorkout,
      dayName: dayName,
      allWorkouts: allWorkouts, // Útil para debug
    };
    
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao processar PDF: ' + error.message,
      data: null,
    };
  }
}

/**
 * Retorna treino de um dia específico
 * @param {string} pdfText - Texto do PDF
 * @param {string} dayName - Nome do dia (Segunda, Terça, etc)
 * @param {Object} preferences - Preferências do usuário
 * @returns {Object} Resultado
 */
export function getWorkoutByDayName(pdfText, dayName, preferences = {}) {
  if (!isValidDayName(dayName)) {
    return {
      success: false,
      error: 'Nome do dia inválido',
      data: null,
    };
  }
  
  try {
    const allWorkouts = parseWorkoutText(pdfText);
    let workout = getWorkoutByDay(allWorkouts, dayName);
    
    // 🔥 CONVERSÃO AUTOMÁTICA LBS → KG
    if (workout && preferences.autoConvertLbs !== false && workout.sections) {
      workout.sections.forEach(section => {
        if (section.lines && Array.isArray(section.lines)) {
          section.lines = autoConvertWorkoutLbs(section.lines);
        }
      });
    }
    
    return {
      success: true,
      data: workout,
      dayName: dayName,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}

/**
 * Retorna todos os treinos da semana
 * @param {string} pdfText - Texto do PDF
 * @param {Object} preferences - Preferências do usuário
 * @returns {Object} Resultado com todos os treinos
 */
export function getAllWorkouts(pdfText, preferences = {}) {
  if (!pdfText || typeof pdfText !== 'string') {
    return {
      success: false,
      error: 'PDF inválido',
      data: [],
    };
  }
  
  try {
    let workouts = parseWorkoutText(pdfText);
    
    // 🔥 CONVERSÃO AUTOMÁTICA LBS → KG em todos os treinos
    if (preferences.autoConvertLbs !== false) {
      workouts = workouts.map(workout => {
        if (workout.sections) {
          workout.sections.forEach(section => {
            if (section.lines && Array.isArray(section.lines)) {
              section.lines = autoConvertWorkoutLbs(section.lines);
            }
          });
        }
        return workout;
      });
    }
    
    return {
      success: true,
      data: workouts,
      count: workouts.length,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: [],
    };
  }
}
