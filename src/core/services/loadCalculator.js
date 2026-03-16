/**
 * Load Calculator Service
 * Cálculo de cargas baseado em PRs e percentuais
 */

import { calculatePercent, kgToLbs, roundToNearest, formatNumber } from '../utils/math.js';
import { isValidPercent } from '../utils/validators.js';
import { normalizeExerciseName, extractNumbers } from '../utils/text.js';
import { resolvePRMatch } from './prsService.js';

/**
 * Calcula carga baseada em PR e percentual
 * @param {string} exerciseName - Nome do exercício
 * @param {number} percent - Percentual (ex: 80 para 80%)
 * @param {Object} prs - Objeto de PRs
 * @param {Object} options - Opções de cálculo
 * @returns {Object} Resultado do cálculo
 */
export function calculateLoad(exerciseName, percent, prs, options = {}) {
  const defaults = {
    round: true,
    roundStep: 2.5,
    includeLbs: false,
  };
  
  const opts = { ...defaults, ...options };
  
  // Validações
  if (!isValidPercent(percent)) {
    return {
      success: false,
      warning: true,
      message: 'Percentual inválido',
      load: null,
      confidenceScore: 18,
      confidenceLabel: 'baixa',
      reviewNote: 'Percentual fora do padrão',
    };
  }
  
  const match = resolvePRMatch(prs, exerciseName);
  const pr = match?.pr ?? null;
  
  if (pr === null) {
    return {
      success: false,
      warning: true,
      message: `PR não encontrado para ${exerciseName}`,
      load: null,
      missingPR: exerciseName,
      confidenceScore: 28,
      confidenceLabel: 'baixa',
      reviewNote: 'Cadastre um registro para calcular a carga',
      exerciseOptions: match?.candidates || [],
    };
  }
  
  // Calcula carga
  let load = calculatePercent(pr, percent);
  
  // Arredonda se solicitado
  if (opts.round) {
    load = roundToNearest(load, opts.roundStep);
  }
  
  const result = {
    success: true,
    warning: false,
    load: load,
    suggestedLoad: load,
    loadFormatted: formatNumber(load, 1) + 'kg',
    percent: percent,
    pr: pr,
    exercise: match?.matchedName || normalizeExerciseName(exerciseName),
    confidenceScore: match?.confidenceScore || 84,
    confidenceLabel: match?.confidenceLabel || 'média',
    reviewNote: buildReviewNote(match),
    matchMethod: match?.method || 'none',
    exerciseOptions: match?.candidates || [],
  };
  
  // Adiciona conversão para lbs se solicitado
  if (opts.includeLbs) {
    const lbs = kgToLbs(load);
    result.lbs = roundToNearest(lbs, 5);
    result.lbsFormatted = formatNumber(result.lbs, 0) + 'lbs';
  }
  
  return result;
}

/**
 * Extrai percentual de uma linha - IGNORA tudo antes/depois
 * @param {string} line - Linha do treino (ex: "1@82% x4" → 82)
 * @returns {number|string|null} Percentual, 'MAX' ou null
 */
export function extractPercent(line) {
  // @? = máximo do dia
  if (/@\?/.test(line)) {
    return 'MAX';
  }
  
  // 🔥 BUSCA: qualquer @XX% (ignora resto)
  const match = line.match(/@\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extrai nome de exercício de uma linha
 * @param {string} line - Linha do treino
 * @param {Object} prs - PRs cadastrados (para validar)
 * @returns {string|null} Nome do exercício ou null
 */
export function extractExerciseName(line, prs) {
  // Busca padrão de exercício em maiúsculas (ex: "BACK SQUAT")
  const matches = line.match(/\b([A-Z][A-Z\s]+)\b/g);
  
  if (!matches) return null;
  
  const ranked = matches
    .map((match) => ({
      normalized: normalizeExerciseName(match),
      resolved: resolvePRMatch(prs, match),
    }))
    .sort((a, b) => (b.resolved?.confidenceScore || 0) - (a.resolved?.confidenceScore || 0));

  if (ranked[0]?.resolved?.found) {
    return ranked[0].resolved.matchedName || ranked[0].normalized;
  }

  return ranked[0]?.normalized || null;
}

/**
 * Processa linha completa de exercício
 * ⚠️ VERSÃO ÚNICA E COMPLETA (mesclada)
 * @param {string} line - Linha do treino (ex: "BACK SQUAT 3x5 @80%")
 * @param {Object} prs - Objeto de PRs
 * @param {Object} preferences - Preferências do usuário
 * @param {string|null} lastExercise - Último exercício identificado (contexto)
 * @returns {Object} Resultado do processamento
 */
export function processExerciseLine(line, prs, preferences = {}, lastExercise = null) {
  const percent = extractPercent(line);
  
  if (!percent) {
    // Linha sem porcentagem - pode ser definição de exercício
    const exerciseName = extractExerciseName(line, prs);
    
    return {
      hasPercent: false,
      originalLine: line,
      exercise: exerciseName, // Retorna exercício identificado para usar como contexto
    };
  }
  
  // 🔥 Trata @? como máximo (100%)
  const percentValue = percent === 'MAX' ? 100 : percent;
  
  // Linha com porcentagem - tenta identificar exercício na própria linha
  let exerciseName = extractExerciseName(line, prs);
  
  // Se não encontrou exercício na linha, usa o último exercício (contexto)
  if (!exerciseName && lastExercise) {
    exerciseName = lastExercise;
  }
  
  if (!exerciseName) {
    return {
      hasPercent: true,
      warning: true,
      message: 'Exercício não identificado',
      originalLine: line,
      confidenceScore: 24,
      confidenceLabel: 'baixa',
      reviewNote: 'Revise a linha antes de usar a carga',
      exerciseOptions: [],
    };
  }
  
  const calculation = calculateLoad(exerciseName, percentValue, prs, {
    includeLbs: preferences.showLbsConversion || false,
  });
  
  return {
    hasPercent: true,
    originalLine: line,
    exercise: exerciseName,
    percent: percentValue,
    isMax: percent === 'MAX', // Sinaliza que é máximo (@?)
    calculatedText: calculation.success 
      ? formatLoadResult(calculation) 
      : null,
    isWarning: calculation.warning || false,
    confidenceScore: calculation.confidenceScore || 0,
    confidenceLabel: calculation.confidenceLabel || 'baixa',
    reviewNote: calculation.reviewNote || '',
    exerciseOptions: calculation.exerciseOptions || [],
    ...calculation,
  };
}

/**
 * Formata resultado de cálculo para exibição
 * @param {Object} result - Resultado de calculateLoad
 * @returns {string} Texto formatado (ex: "→ 80kg (176lbs)")
 */
export function formatLoadResult(result) {
  if (!result.success) {
    return result.message || 'Erro ao calcular';
  }
  
  let text = `→ ${result.loadFormatted}`;
  
  if (result.lbsFormatted) {
    text += ` (${result.lbsFormatted})`;
  }
  
  return text;
}

/**
 * Calcula todas as cargas de um treino MANTENDO CONTEXTO
 * @param {Array} workoutLines - Linhas do treino
 * @param {Object} prs - PRs cadastrados
 * @param {Object} preferences - Preferências
 * @returns {Array} Array com resultados de cada linha
 */
export function calculateWorkoutLoads(workoutLines, prs, preferences = {}) {
  let lastExercise = null; // Mantém contexto do último exercício identificado

  return workoutLines.map(line => {
    // Extrai string da linha
    const lineStr = typeof line === 'object'
      ? (line?.raw || line?.text || '')
      : String(line);

    // 🔥 Detecta se linha é nome de exercício (maiúsculas)
    const exerciseMatch = lineStr.match(/^([A-Z][A-Z\s]+)$/);
    if (exerciseMatch) {
      const exerciseName = normalizeExerciseName(exerciseMatch[1].trim());
      const resolved = resolvePRMatch(prs, exerciseName);
      if (resolved?.found) {
        lastExercise = resolved.matchedName || exerciseName;
        return {
          hasPercent: false,
          originalLine: lineStr,
          exercise: resolved.matchedName || exerciseName,
          isExerciseHeader: true // Flag para identificar cabeçalhos
        };
      }
    }

    // 🔥 CORREÇÃO: Ignora linhas de descanso, mas MANTÉM contexto (não reseta lastExercise)
    if (/A\s+CADA\s+\d+\s+SEC|REST|DESCANSO|EVERY\s+\d+\s+SEC/i.test(lineStr)) {
      return {
        hasPercent: false,
        originalLine: lineStr,
        isRest: true
        // NÃO reseta lastExercise aqui
      };
    }

    // Processa linha normal (com ou sem percentual)
    const result = processExerciseLine(lineStr, prs, preferences, lastExercise);

    // Atualiza contexto se linha identificou um exercício
    if (result.exercise) {
      lastExercise = result.exercise;
    }

    return result;
  });
}

/**
 * Verifica se treino tem avisos (PRs faltantes)
 * @param {Array} results - Resultados de calculateWorkoutLoads
 * @returns {boolean}
 */
export function hasWarnings(results) {
  return results.some(r => r.warning === true);
}

/**
 * Retorna lista de PRs faltantes em um treino
 * @param {Array} results - Resultados de calculateWorkoutLoads
 * @returns {string[]} Exercícios sem PR (únicos)
 */
export function getLoadReviewSummary(results) {
  const safeResults = Array.isArray(results) ? results : [];
  const linesWithPercent = safeResults.filter((item) => item?.hasPercent).length;
  const lowConfidence = safeResults.filter((item) => Number(item?.confidenceScore || 0) < 65).length;
  const averageConfidence = safeResults.length
    ? Math.round(safeResults.reduce((sum, item) => sum + Number(item?.confidenceScore || 0), 0) / safeResults.length)
    : 0;
  return {
    averageConfidence,
    lowConfidence,
    linesWithPercent,
    confidenceLabel: averageConfidence >= 85 ? 'alta' : averageConfidence >= 65 ? 'média' : 'baixa',
  };
}

export function getMissingPRsFromResults(results) {
  const missing = new Set();
  
  results.forEach(r => {
    if (r.missingPR) {
      missing.add(r.missingPR);
    }
  });
  
  return Array.from(missing);
}

/**
 * Converte lbs para kg em uma linha de treino
 * @param {string} line - Linha com lbs (ex: "100lbs")
 * @returns {Object} { kg, formatted }
 */
export function convertLbsInLine(line) {
  const lbsMatch = line.match(/(\d+(?:\.\d+)?)\s*lbs?/i);
  
  if (!lbsMatch) {
    return { found: false, original: line };
  }
  
  const lbs = parseFloat(lbsMatch[1]);
  const kg = lbs / 2.20462;
  const rounded = roundToNearest(kg, 2.5);
  
  return {
    found: true,
    original: line,
    lbs: lbs,
    kg: rounded,
    formatted: `${formatNumber(rounded, 1)}kg`,
  };
}

/**
 * Converte automaticamente lbs para kg em uma linha (substitui inline)
 * Usa a função convertLbsInLine existente
 * @param {string} line - Linha com possível valor em lbs
 * @returns {string} Linha convertida ou original
 */
export function autoConvertLbsInLine(line) {
  if (!line || typeof line !== 'string') return line;
  
  // Suporta múltiplos valores: "95/65lbs", "95lbs/65lbs", etc
  const multiLbsPattern = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*lbs?/i;
  const multiMatch = line.match(multiLbsPattern);
  
  if (multiMatch) {
    // Caso "95/65lbs" → "43.0/29.5kg"
    const lbs1 = parseFloat(multiMatch[1]);
    const lbs2 = parseFloat(multiMatch[2]);
    const kg1 = roundToNearest(lbs1 / 2.20462, 2.5);
    const kg2 = roundToNearest(lbs2 / 2.20462, 2.5);
    
    return line.replace(
      multiLbsPattern,
      `${formatNumber(kg1, 1)}/${formatNumber(kg2, 1)}kg`
    );
  }
  
  // Caso simples: usa a função existente
  const result = convertLbsInLine(line);
  
  if (result.found) {
    // Substitui "XXlbs" por "YYkg" na linha original
    return line.replace(/\d+(?:\.\d+)?\s*lbs?/i, result.formatted);
  }
  
  return line;
}

function buildReviewNote(match) {
  if (!match?.found) return 'Cadastre um registro para calcular a carga';
  if (match.method === 'exact') return 'Carga sugerida com base no seu registro salvo';
  if (match.method === 'alias') return `Carga sugerida com base em ${match.matchedName}`;
  if (match.method === 'similar-ambiguous') {
    const options = [match.matchedName, ...(match.candidates || [])].filter(Boolean).slice(0, 3);
    return `Exercício aproximado: revise entre ${options.join(', ')}`;
  }
  return `Carga sugerida com base em ${match.matchedName}`;
}

/**
 * Processa todas as linhas de um treino convertendo lbs automaticamente
 * @param {Array} lines - Array de linhas de treino
 * @returns {Array} Linhas convertidas
 */
export function autoConvertWorkoutLbs(lines) {
  return lines.map(line => {
    if (typeof line === 'string') {
      return autoConvertLbsInLine(line);
    } else if (typeof line === 'object' && line?.raw) {
      return {
        ...line,
        raw: autoConvertLbsInLine(line.raw),
        text: autoConvertLbsInLine(line.text || line.raw)
      };
    }
    return line;
  });
}
