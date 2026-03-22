/**
 * Use-case: Calcular cargas de um treino
 * Processa todas as linhas e calcula cargas baseadas em PRs
 */

import { calculateWorkoutLoads, hasWarnings, getMissingPRsFromResults, processExerciseLine } from '../services/loadCalculator.js';
import { isValidWorkout } from '../services/workoutService.js';

/**
 * Calcula todas as cargas de um treino
 * @param {Object} workout - Objeto de treino
 * @param {Object} prs - PRs cadastrados
 * @param {Object} preferences - Preferências do usuário
 * @returns {Object} Resultado com cargas calculadas
 */
export function calculateLoads(workout, prs, preferences) {
  // Validações
  if (!isValidWorkout(workout)) {
    return { success: false, error: 'Treino inválido', data: null };
  }
  
  if (!prs || typeof prs !== 'object') {
    return { success: false, error: 'PRs inválidos', data: null };
  }
  
  try {
    // Coleta todas as linhas do treino
    const allLines = workout.sections.reduce((acc, section) => {
      return acc.concat(section.lines);
    }, []);
    
    // 🔥 CORREÇÃO: Processa TODAS as linhas (não só as que já têm percentual)
    const results = allLines.map(line => {
      // Se já é objeto com calculated, mantém
      if (typeof line === 'object' && line.calculated) {
        return {
          hasPercent: true,
          originalLine: line.raw || '',
          calculatedText: line.calculated,
          isWarning: line.hasWarning || false
        };
      }
      
      // Se é string, tenta processar
      const lineStr = typeof line === 'string' ? line : (line?.raw || '');
      return processExerciseLine(lineStr, prs, preferences);
    });
    
    // Calcula cargas de todas as linhas com contexto
    const resultsWithContext = calculateWorkoutLoads(allLines, prs, preferences);
    
    // Verifica avisos
    const warnings = hasWarnings(resultsWithContext);
    const missingPRs = getMissingPRsFromResults(resultsWithContext);
    
    return {
      success: true,
      data: resultsWithContext,
      hasWarnings: warnings,
      missingPRs: missingPRs,
      totalLines: resultsWithContext.length,
      linesWithPercent: resultsWithContext.filter(r => r.hasPercent).length
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Erro ao calcular cargas: ${error.message}`, 
      data: null 
    };
  }
}

/**
 * Calcula carga de uma linha específica
 * @param {string} line - Linha de exercício
 * @param {Object} prs - PRs
 * @param {Object} preferences - Preferências
 * @returns {Object} Resultado do cálculo
 */
export function calculateLineLoad(line, prs, preferences = {}) {
  if (!line || typeof line !== 'string') {
    return {
      success: false,
      error: 'Linha inválida',
      data: null,
    };
  }
  
  try {
    const results = calculateWorkoutLoads([line], prs, preferences);
    
    return {
      success: true,
      data: results[0],
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
}
