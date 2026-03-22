/**
 * PRs Service
 * CRUD e gerenciamento de Personal Records
 */

import { isValidPR, isValidExerciseName, isNonEmptyObject } from '../utils/validators.js';
import { normalizeExerciseName } from '../utils/text.js';

/**
 * Adiciona ou atualiza um PR
 * @param {Object} prs - Objeto de PRs atual
 * @param {string} exerciseName - Nome do exercício
 * @param {number} load - Carga máxima (kg)
 * @returns {Object} Novo objeto de PRs (imutável)
 * @throws {Error} Se validação falhar
 */
export function setPR(prs, exerciseName, load) {
  if (!isValidExerciseName(exerciseName)) {
    throw new Error('Nome de exercício inválido (mínimo 2 caracteres)');
  }
  
  if (!isValidPR(load)) {
    throw new Error('PR inválido (deve ser número positivo, máx 500kg)');
  }
  
  const normalized = normalizeExerciseName(exerciseName);
  
  return {
    ...prs,
    [normalized]: load,
  };
}

/**
 * Remove um PR
 * @param {Object} prs - Objeto de PRs atual
 * @param {string} exerciseName - Nome do exercício
 * @returns {Object} Novo objeto de PRs (imutável)
 */
export function removePR(prs, exerciseName) {
  const normalized = normalizeExerciseName(exerciseName);
  const newPRs = { ...prs };
  delete newPRs[normalized];
  return newPRs;
}

/**
 * Busca PR de um exercício
 * @param {Object} prs - Objeto de PRs
 * @param {string} exerciseName - Nome do exercício
 * @returns {number|null} Carga máxima ou null se não encontrado
 */
export function getPR(prs, exerciseName) {
  const normalized = normalizeExerciseName(exerciseName);
  return prs[normalized] || null;
}

/**
 * Verifica se exercício tem PR cadastrado
 * @param {Object} prs - Objeto de PRs
 * @param {string} exerciseName - Nome do exercício
 * @returns {boolean}
 */
export function hasPR(prs, exerciseName) {
  return getPR(prs, exerciseName) !== null;
}

/**
 * Retorna lista de exercícios cadastrados
 * @param {Object} prs - Objeto de PRs
 * @returns {string[]} Array de nomes de exercícios (ordenado)
 */
export function listExercises(prs) {
  return Object.keys(prs).sort();
}

/**
 * Retorna total de PRs cadastrados
 * @param {Object} prs - Objeto de PRs
 * @returns {number} Quantidade de PRs
 */
export function countPRs(prs) {
  return Object.keys(prs).length;
}

/**
 * Valida objeto de PRs
 * @param {*} data - Dados para validar
 * @returns {boolean}
 */
export function isValidPRsObject(data) {
  if (!isNonEmptyObject(data)) return false;
  
  return Object.entries(data).every(([name, load]) => {
    return isValidExerciseName(name) && isValidPR(load);
  });
}

/**
 * Mescla múltiplos objetos de PRs (útil para importação)
 * @param {...Object} prsSets - Múltiplos objetos de PRs
 * @returns {Object} PRs mesclados (último valor prevalece)
 */
export function mergePRs(...prsSets) {
  const merged = {};
  
  prsSets.forEach(prs => {
    if (isNonEmptyObject(prs)) {
      Object.entries(prs).forEach(([name, load]) => {
        const normalized = normalizeExerciseName(name);
        if (isValidPR(load)) {
          merged[normalized] = load;
        }
      });
    }
  });
  
  return merged;
}

/**
 * Exporta PRs para JSON
 * @param {Object} prs - Objeto de PRs
 * @returns {string} JSON formatado
 */
export function exportToJSON(prs) {
  return JSON.stringify(prs, null, 2);
}

/**
 * Importa PRs de JSON
 * @param {string} jsonString - String JSON
 * @returns {Object} Objeto de PRs validado
 * @throws {Error} Se JSON inválido
 */
export function importFromJSON(jsonString) {
  let parsed;
  
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('JSON inválido: ' + error.message);
  }
  
  if (!isValidPRsObject(parsed)) {
    throw new Error('Formato de PRs inválido no JSON');
  }
  
  // Normaliza nomes de exercícios
  const normalized = {};
  Object.entries(parsed).forEach(([name, load]) => {
    const key = normalizeExerciseName(name);
    normalized[key] = load;
  });
  
  return normalized;
}

/**
 * Retorna PRs faltantes baseado em lista de exercícios
 * @param {Object} prs - PRs cadastrados
 * @param {string[]} exerciseNames - Nomes de exercícios
 * @returns {string[]} Exercícios sem PR
 */
export function findMissingPRs(prs, exerciseNames) {
  return exerciseNames.filter(name => !hasPR(prs, name));
}

/**
 * Cria objeto de PRs padrão (vazio)
 * @returns {Object} Objeto vazio de PRs
 */
export function createEmptyPRs() {
  return {};
}

/**
 * Cria objeto de PRs com valores padrão comuns
 * @returns {Object} PRs com exercícios básicos
 */
export function createDefaultPRs() {
  return {
    'BACK SQUAT': 100,
    'FRONT SQUAT': 80,
    'DEADLIFT': 120,
    'BENCH PRESS': 80,
    'SHOULDER PRESS': 50,
    'PULL UP': 0, // Bodyweight
    'PUSH UP': 0, // Bodyweight
  };
}
