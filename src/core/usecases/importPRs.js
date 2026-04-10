/**
 * Use-case: Importar PRs
 * Carrega PRs de arquivo JSON
 */

import { importFromJSON, mergePRs } from '../services/prsService.js';

/**
 * Importa PRs de JSON
 * @param {string} jsonString - JSON string
 * @param {Object} currentPRs - PRs atuais (para merge)
 * @param {Object} options - Opções de importação
 * @returns {Object} Resultado
 */
export function importPRs(jsonString, currentPRs = {}, options = {}) {
  const defaults = {
    merge: true, // Se true, faz merge; se false, substitui
    overwrite: true, // Se true, sobrescreve PRs existentes
  };
  
  const opts = { ...defaults, ...options };
  
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      success: false,
      error: 'JSON vazio ou inválido',
      data: currentPRs,
    };
  }
  
  try {
    const importedPRs = importFromJSON(jsonString);
    
    let finalPRs;
    
    if (opts.merge) {
      // Merge: mantém PRs atuais + importados
      if (opts.overwrite) {
        finalPRs = mergePRs(currentPRs, importedPRs); // Importados sobrescrevem
      } else {
        finalPRs = mergePRs(importedPRs, currentPRs); // Atuais prevalecem
      }
    } else {
      // Substitui completamente
      finalPRs = importedPRs;
    }
    
    const imported = Object.keys(importedPRs).length;
    const total = Object.keys(finalPRs).length;
    
    return {
      success: true,
      data: finalPRs,
      imported: imported,
      total: total,
      merged: opts.merge,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: currentPRs,
    };
  }
}

/**
 * Valida arquivo de PRs antes de importar
 * @param {string} jsonString - JSON string
 * @returns {Object} Resultado da validação
 */
export function validatePRsFile(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return {
      valid: false,
      error: 'Arquivo vazio',
    };
  }
  
  try {
    const importedPRs = importFromJSON(jsonString);
    const count = Object.keys(importedPRs).length;
    return {
      valid: true,
      count: count,
      exercises: Object.keys(importedPRs),
    };
    
  } catch (error) {
    return {
      valid: false,
      error: 'JSON inválido: ' + error.message,
    };
  }
}
