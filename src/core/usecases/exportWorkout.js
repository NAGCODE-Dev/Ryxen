/**
 * Use-case: Exportar treino em JSON
 * Serializa treino para arquivo
 */

import { isValidWorkout } from '../services/workoutService.js';
import { getTimestamp } from '../utils/date.js';

const DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';
const logDebug = (...args) => {
  if (DEBUG) console.log(...args);
};

/**
 * Exporta treino para JSON
 * @param {Object} workout - Treino
 * @param {Object} metadata - Metadados adicionais
 * @returns {Object} Resultado com JSON
 */
export function exportWorkout(workout, metadata = {}) {
  if (!isValidWorkout(workout)) {
    return {
      success: false,
      error: 'Treino inválido',
      json: null,
    };
  }
  
  try {
    const payload = {
      version: '1.0.0',
      exportedAt: getTimestamp(),
      day: workout.day,
      sections: workout.sections, // 🔥 JÁ vem com { raw, calculated }
      ...metadata,
    };
    
    logDebug('📦 Payload para JSON.stringify:', {
      day: payload.day,
      sections: payload.sections.length,
      firstSection: payload.sections[0],
      firstLine: payload.sections[0]?.lines?.[0],
      secondLine: payload.sections[0]?.lines?.[1]
    });
    
    const json = JSON.stringify(payload, null, 2);
    
    logDebug('✅ JSON gerado:', json.substring(0, 500));
    
    return {
      success: true,
      json: json,
      size: json.length,
      filename: `treino-${workout.day.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`,
    };
    
  } catch (error) {
    console.error('❌ Erro ao exportar:', error);
    return {
      success: false,
      error: 'Erro ao exportar: ' + error.message,
      json: null,
    };
  }
}

/**
 * Exporta todos os treinos da semana
 * @param {Array} workouts - Array de treinos
 * @returns {Object} Resultado com JSON
 */
export function exportAllWorkouts(workouts) {
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return {
      success: false,
      error: 'Nenhum treino para exportar',
      json: null,
    };
  }
  
  try {
    const payload = {
      version: '1.0.0',
      exportedAt: getTimestamp(),
      workouts: workouts,
    };
    
    const json = JSON.stringify(payload, null, 2);
    
    return {
      success: true,
      json: json,
      size: json.length,
      filename: `treinos-semana-${new Date().toISOString().slice(0, 10)}.json`,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      json: null,
    };
  }
}
/**
 * Importa treino de JSON
 * @param {string} jsonString - JSON string
 * @returns {Object} Resultado com treino
 */
export function importWorkout(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      success: false,
      error: 'JSON vazio ou inválido',
      data: null,
    };
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Valida estrutura
    if (!parsed.day || !Array.isArray(parsed.sections)) {
      return {
        success: false,
        error: 'Formato de treino inválido no JSON',
        data: null,
      };
    }
    
    return {
      success: true,
      data: {
        day: parsed.day,
        sections: parsed.sections,
      },
      version: parsed.version || 'unknown',
      weekNumber: parsed.weekNumber || null,
    };
    
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao importar: ' + error.message,
      data: null,
    };
  }
}
