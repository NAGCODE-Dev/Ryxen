/**
 * PRs Service
 * CRUD e gerenciamento de Personal Records
 */

import { isValidPR, isValidExerciseName, isNonEmptyObject } from '../utils/validators.js';
import { normalizeExerciseName } from '../utils/text.js';

const EXERCISE_ALIASES = {
  'STRICT PRESS': ['SHOULDER PRESS', 'OVERHEAD PRESS', 'MILITARY PRESS'],
  'PULL UP': ['PULL-UP', 'PULLUPS', 'PULL UPS', 'CHEST TO BAR PULL UP', 'CHEST-TO-BAR PULL UP'],
  'CHEST TO BAR': ['CHEST TO BAR PULL UP', 'CHEST-TO-BAR'],
  'CLEAN & JERK': ['CLEAN AND JERK', 'C&J'],
  'SHOULDER TO OVERHEAD': ['S2OH', 'STO', 'SHLDR TO OHD'],
  'BACK SQUAT': ['BSQ', 'BACKSQ'],
  'FRONT SQUAT': ['FSQ', 'FRONTSQ'],
  'DEADLIFT': ['DL'],
  'BENCH PRESS': ['BENCH'],
  'POWER CLEAN': ['PC', 'HANG POWER CLEAN', 'POWER CLEAN FROM HANG'],
  'SQUAT CLEAN': ['SQ CLEAN', 'FULL CLEAN'],
  'POWER SNATCH': ['PSN', 'POWER SN'],
  'SQUAT SNATCH': ['FULL SNATCH', 'SQ SNATCH'],
  'HANG POWER SNATCH': ['HPS', 'HANG PSN'],
  'HANG POWER CLEAN': ['HPC'],
  'THRUSTER': ['THRUSTERS'],
  'TOES TO BAR': ['T2B', 'TOES-TO-BAR'],
  'BAR MUSCLE UP': ['BMU', 'BAR MU', 'BAR MUSCLE-UP'],
  'RING MUSCLE UP': ['RMU', 'RING MU', 'RING MUSCLE-UP'],
  'DOUBLE UNDER': ['DU', 'DOUBLE-UNDER', 'DOUBLE UNDERS'],
  'WALL BALL': ['WALL BALL SHOT', 'WB', 'WBS'],
  'BOX JUMP OVER': ['BJO', 'BOX JUMPS OVER'],
  'HANDSTAND PUSH UP': ['HSPU', 'HANDSTAND PUSH-UP'],
  'HANDSTAND WALK': ['HSW'],
  'BURPEE OVER BAR': ['BOB', 'BURPEE OVER THE BAR'],
  'ROW': ['ROW ERG', 'ROWERG', 'ERG ROW'],
  'BIKE ERG': ['BIKEERG', 'BIKE ERGOMETER'],
  'RUN': ['RUNNING', 'CORRIDA'],
  'ROPE CLIMB': ['RC', 'ROPE CLIMBS'],
  'DEAD HANG': ['HANG HOLD', 'HANG'],
};

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
  return resolvePRMatch(prs, exerciseName)?.pr ?? null;
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

export function resolvePRMatch(prs, exerciseName) {
  if (!prs || typeof prs !== 'object') {
    return createEmptyMatch();
  }

  const normalized = normalizeExerciseName(exerciseName);
  if (!normalized) {
    return createEmptyMatch();
  }

  const entries = Object.entries(prs)
    .filter(([name, load]) => isValidExerciseName(name) && isValidPR(load))
    .map(([name, load]) => ({
      key: normalizeExerciseName(name),
      original: name,
      load,
    }));

  const exact = entries.find((entry) => entry.key === normalized);
  if (exact) {
    return {
      found: true,
      pr: exact.load,
      matchedName: exact.key,
      method: 'exact',
      confidenceScore: 98,
      confidenceLabel: 'alta',
      candidates: [],
    };
  }

  const canonical = resolveCanonicalName(normalized);
  const alias = entries.find((entry) => entry.key === canonical);
  if (alias) {
    return {
      found: true,
      pr: alias.load,
      matchedName: alias.key,
      method: 'alias',
      confidenceScore: 88,
      confidenceLabel: 'média',
      candidates: [],
    };
  }

  const ranked = entries
    .map((entry) => ({
      ...entry,
      score: similarityScore(normalized, entry.key),
    }))
    .filter((entry) => entry.score >= 0.52)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return createEmptyMatch();
  }

  const best = ranked[0];
  const candidates = ranked.slice(0, 4).map((entry) => entry.key);
  const confidenceScore = Math.round(best.score * 100);
  const ambiguous = ranked[1] && Math.abs(best.score - ranked[1].score) < 0.08;

  return {
    found: true,
    pr: best.load,
    matchedName: best.key,
    method: ambiguous ? 'similar-ambiguous' : 'similar',
    confidenceScore: ambiguous ? Math.max(52, confidenceScore - 10) : Math.max(65, confidenceScore),
    confidenceLabel: ambiguous ? 'baixa' : (confidenceScore >= 85 ? 'alta' : 'média'),
    candidates: ambiguous ? candidates : candidates.slice(1),
  };
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

function resolveCanonicalName(name) {
  const safe = normalizeExerciseName(name);
  for (const [canonical, aliases] of Object.entries(EXERCISE_ALIASES)) {
    const normalizedCanonical = normalizeExerciseName(canonical);
    if (safe === normalizedCanonical) return normalizedCanonical;
    if (aliases.some((alias) => normalizeExerciseName(alias) === safe)) {
      return normalizedCanonical;
    }
  }
  return safe;
}

function similarityScore(left, right) {
  const a = tokenSignature(left);
  const b = tokenSignature(right);
  if (!a.length || !b.length) return 0;

  const overlap = a.filter((token) => b.includes(token)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = union ? overlap / union : 0;
  const orderedBoost = a.some((token, index) => b[index] === token) ? 0.12 : 0;
  return Math.min(1, jaccard + orderedBoost);
}

function tokenSignature(name) {
  return normalizeExerciseName(name)
    .replace(/[^A-Z0-9& ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token === '&' ? 'AND' : token);
}

function createEmptyMatch() {
  return {
    found: false,
    pr: null,
    matchedName: '',
    method: 'none',
    confidenceScore: 0,
    confidenceLabel: 'baixa',
    candidates: [],
  };
}
