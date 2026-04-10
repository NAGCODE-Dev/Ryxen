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

function normalizePRValue(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === 'object') {
    const nestedValue = value.load ?? value.value ?? value.pr ?? value.kg ?? value.max;
    return normalizePRValue(nestedValue);
  }

  return null;
}

function normalizePRObject(candidate) {
  if (!isNonEmptyObject(candidate)) return null;

  const normalized = {};

  for (const [name, rawValue] of Object.entries(candidate)) {
    if (!isValidExerciseName(name)) return null;
    const value = normalizePRValue(rawValue);
    if (!isValidPR(value)) return null;
    normalized[normalizeExerciseName(name)] = value;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizePRArray(candidate) {
  if (!Array.isArray(candidate) || candidate.length === 0) return null;

  const normalized = {};

  for (const entry of candidate) {
    if (!entry || typeof entry !== 'object') return null;
    const name = entry.exercise ?? entry.name ?? entry.movement ?? entry.label;
    const value = normalizePRValue(entry.load ?? entry.value ?? entry.pr ?? entry.kg ?? entry.max);
    if (!isValidExerciseName(name) || !isValidPR(value)) return null;
    normalized[normalizeExerciseName(name)] = value;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function resolveImportCandidate(parsed) {
  const candidates = [
    parsed,
    parsed?.prs,
    parsed?.data?.prs,
    parsed?.records,
    parsed?.items,
    Array.isArray(parsed) ? parsed : null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = Array.isArray(candidate)
      ? normalizePRArray(candidate)
      : normalizePRObject(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
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
  
  const normalized = resolveImportCandidate(parsed);

  if (!normalized) {
    throw new Error('Formato de PRs inválido no JSON');
  }

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
