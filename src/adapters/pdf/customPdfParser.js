/**
 * Custom PDF Parser
 * Parser especializado para o formato específico dos PDFs de treino.
 */

import { normalizeSpaces, removeEmptyLines } from '../../core/utils/text.js';
import { lbsToKg } from '../../core/utils/math.js';

/**
 * Detecta número da semana no PDF
 * @param {string} text - Texto do PDF
 * @returns {number[]} Array de números de semanas encontradas
 */
export function detectWeekNumbers(text) {
  const matches = text.match(/SEMANA\s+(\d+)/gi);
  if (!matches) return [];

  const weekNumbers = matches
    .map((match) => {
      const num = match.match(/\d+/);
      return num ? parseInt(num[0], 10) : null;
    })
    .filter(Boolean);

  // Remove duplicados e ordena
  return [...new Set(weekNumbers)].sort((a, b) => a - b);
}

/**
 * Divide PDF em múltiplas semanas
 * @param {string} text - Texto do PDF
 * @returns {Array} Array de objetos { weekNumber, text }
 */
export function splitPdfIntoWeeks(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const weeks = [];
  let currentWeek = null;
  let currentText = [];

  lines.forEach((line) => {
    // Detecta início de nova semana
    const weekMatch = line.match(/SEMANA\s+(\d+)/i);

    if (weekMatch) {
      // Salva semana anterior se existir
      if (currentWeek !== null && currentText.length > 0) {
        weeks.push({ weekNumber: currentWeek, text: currentText.join('\n') });
      }

      // Inicia nova semana
      currentWeek = parseInt(weekMatch[1], 10);
      currentText = [line];
    } else if (currentWeek !== null) {
      currentText.push(line);
    }
  });

  // Salva última semana
  if (currentWeek !== null && currentText.length > 0) {
    weeks.push({ weekNumber: currentWeek, text: currentText.join('\n') });
  }

  return weeks;
}

/**
 * Normaliza nomes de dias (suporta variações)
 * @param {string} line - Linha do PDF
 * @returns {string|null} Nome do dia normalizado ou null
 */
export function detectDayName(line) {
  const dayMap = {
    SEGUNDA: 'Segunda',
    TERÇA: 'Terça',
    TERCA: 'Terça',
    QUARTA: 'Quarta',
    QUINTA: 'Quinta',
    QUI: 'Quinta',
    SEXTA: 'Sexta',
    SEX: 'Sexta',
    SÁBADO: 'Sábado',
    SABADO: 'Sábado',
    SAB: 'Sábado',
    DOMINGO: 'Domingo',
  };

  const upper = line.trim().toUpperCase();

  // Verifica se linha é exatamente um nome de dia
  if (dayMap[upper]) return dayMap[upper];

  // Verifica se começa com nome de dia
  for (const [key, value] of Object.entries(dayMap)) {
    if (upper.startsWith(key)) return value;
  }

  return null;
}

/**
 * Detecta blocos de treino (WOD, MANHÃ, TARDE, etc)
 * @param {string} line - Linha
 * @returns {string|null} Tipo de bloco ou null
 */
export function detectBlockType(line) {
  const upper = line.trim().toUpperCase();

  if (/^WOD\b/.test(upper)) return 'WOD';
  if (upper === 'WOD 2') return 'WOD 2';
  if (upper === 'MANHÃ' || upper === 'MANHA') return 'MANHÃ';
  if (upper === 'TARDE') return 'TARDE';
  if (upper.includes('OPTIONAL')) return 'OPTIONAL';
  if (/AMRAP|FOR TIME|EMOM/.test(upper)) return 'TIMED_WOD';

  return null;
}

export function detectPeriodName(line) {
  const upper = line.trim().toUpperCase();
  if (upper === 'MANHÃ' || upper === 'MANHA') return 'manhã';
  if (upper === 'TARDE') return 'tarde';
  return null;
}

/**
 * Verifica se linha deve ser ignorada
 * @param {string} line - Linha
 * @returns {boolean}
 */
export function shouldSkipLine(line) {
  if (!line || line.trim().length === 0) return true;

  const lower = line.toLowerCase();
  const upper = line.trim().toUpperCase();

  return (
    lower.includes('gmail.com') ||
    lower.includes('hotmail.com') ||
    line.startsWith('Garanta') ||
    line.startsWith('Treine') ||
    lower.includes('licensed to') ||
    lower.includes('hp1570') ||
    lower.includes('www.bsbstrong.com') ||
    lower.startsWith('#') ||
    lower.includes('#trainwithapurpose') ||
    upper === 'BSB' ||
    upper === 'STRONG' ||
    upper === 'BSB STRONG' ||
    /^\d{1,3}$/.test(line.trim()) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)
  );
}

/**
 * Parse de uma semana específica em estrutura de treinos
 * @param {string} weekText - Texto de uma semana
 * @param {number} weekNumber - Número da semana
 * @returns {Object} Estrutura de treino da semana
 */
export function parseWeekText(weekText, weekNumber) {
  const lines = removeEmptyLines(String(weekText || '').replace(/\r/g, '')).split('\n').map((l) => normalizeSpaces(l));
  const workouts = [];
  let currentDay = null;
  let currentBlock = null;
  let currentBlockTitle = '';
  let currentPeriod = null;
  let currentBlockHints = {};
  let pendingBlockHints = {};
  let currentLines = [];
  const flushCurrentBlock = () => {
    if (!currentDay || currentLines.length === 0) return;
    if (!workouts.find((w) => w.day === currentDay)) {
      workouts.push({ day: currentDay, blocks: [] });
    }
    const workout = workouts.find((w) => w.day === currentDay);
    workout.blocks.push(buildStructuredBlock({
      type: currentBlock || 'DEFAULT',
      title: currentBlockTitle,
      period: currentPeriod,
      lines: currentLines,
      hints: currentBlockHints,
    }));
    currentBlockHints = {};
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // Pula linhas vazias ou inválidas
    if (shouldSkipLine(line)) continue;

    // Detecta novo dia
    const dayName = detectDayName(line);
    if (dayName) {
      flushCurrentBlock();
      currentDay = dayName;
      currentBlock = null;
      currentBlockTitle = '';
      currentPeriod = null;
      currentBlockHints = {};
      pendingBlockHints = {};
      currentLines = [];
      continue;
    }

    const period = detectPeriodName(line);
    if (period) {
      flushCurrentBlock();
      currentPeriod = period;
      currentBlock = null;
      currentBlockTitle = '';
      currentBlockHints = {};
      pendingBlockHints = {};
      currentLines = [];
      continue;
    }

    const nextMeaningfulLine = findNextMeaningfulLine(lines, index + 1);
    const nextMeaningfulLines = findNextMeaningfulLines(lines, index + 1, 2);
    if (
      !currentBlock
      && /GIN[ÁA]STICA|QUALIDADE|N[ÃA]O POR TEMPO/i.test(line)
      && /^GYMNASTICS\b/i.test(nextMeaningfulLine)
    ) {
      pendingBlockHints = { ...pendingBlockHints, gymQuality: true, qualityNote: line.trim() };
      continue;
    }
    const timedWodFormatLine = currentBlock && detectBlockType(line) === 'TIMED_WOD';
    const blockDescriptor = timedWodFormatLine
      ? null
      : detectStructuredBlock(line, nextMeaningfulLine, {
          allowInferred: !currentBlock || currentBlock === 'GYMNASTICS' || currentBlock === 'STRENGTH',
          nextLines: nextMeaningfulLines,
        });
    if (blockDescriptor) {
      flushCurrentBlock();
      currentBlock = blockDescriptor.type;
      currentBlockTitle = blockDescriptor.title;
      currentBlockHints = pendingBlockHints;
      pendingBlockHints = {};
      currentLines = blockDescriptor.includeLine ? [line] : [];
      continue;
    }

    if (currentDay) {
      currentLines.push(line);
    }
  }

  // Salva último bloco
  flushCurrentBlock();

  return { weekNumber, workouts };
}

/**
 * Parse completo de PDF com múltiplas semanas (ou apenas 1)
 * @param {string} pdfText - Texto completo do PDF
 * @returns {Array} Array de semanas parseadas
 */
export function parseMultiWeekPdf(pdfText) {
  if (!pdfText || typeof pdfText !== 'string') return [];

  // Divide em semanas
  const weeks = splitPdfIntoWeeks(pdfText);

  // Parse de cada semana
  return weeks.map((week) => parseWeekText(week.text, week.weekNumber));
}

/**
 * Extrai treino de um dia específico de uma semana
 * @param {Object} parsedWeek - Semana parseada
 * @param {string} dayName - Nome do dia
 * @returns {Object|null} Treino do dia ou null
 */
export function getWorkoutFromWeek(parsedWeek, dayName) {
  if (!parsedWeek || !parsedWeek.workouts) return null;
  return parsedWeek.workouts.find((w) => w.day === dayName) || null;
}

/**
 * Valida formato do PDF
 * @param {string} pdfText - Texto do PDF
 * @returns {Object} Resultado da validação
 */
export function validateCustomPdfFormat(pdfText) {
  if (!pdfText || typeof pdfText !== 'string') {
    return { valid: false, error: 'Texto vazio' };
  }

  const weekNumbers = detectWeekNumbers(pdfText);

  // Aceita 1 ou mais semanas (não força mínimo de 2)
  if (weekNumbers.length === 0) {
    return {
      valid: false,
      error: 'Nenhuma semana encontrada. Procure por "SEMANA XX" no PDF.',
    };
  }

  const days = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'];
  const foundDays = days.filter((day) => new RegExp(day, 'i').test(pdfText));

  if (foundDays.length === 0) {
    return {
      valid: false,
      error: 'Nenhum dia da semana encontrado.',
    };
  }

  return {
    valid: true,
    weekNumbers,
    daysFound: foundDays.length,
    weeksCount: weekNumbers.length,
  };
}

function findNextMeaningfulLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const candidate = lines[index]?.trim?.() || '';
    if (!candidate || shouldSkipLine(candidate)) continue;
    return candidate;
  }
  return '';
}

function findNextMeaningfulLines(lines, startIndex, count = 2) {
  const result = [];
  for (let index = startIndex; index < lines.length && result.length < count; index += 1) {
    const candidate = lines[index]?.trim?.() || '';
    if (!candidate || shouldSkipLine(candidate)) continue;
    result.push(candidate);
  }
  return result;
}

function detectStructuredBlock(line, nextLine = '', options = {}) {
  const { allowInferred = true, nextLines = [] } = options;
  const upper = line.trim().toUpperCase();
  const basicBlockType = detectBlockType(line);
  if (basicBlockType && !detectPeriodName(line)) {
    return {
      type: mapLegacyBlockTypeToStructuredType(basicBlockType),
      title: line.trim(),
      includeLine: false,
    };
  }

  if (/^LOW INTENSITY ROW\b/.test(upper)) {
    return { type: 'ENGINE', title: line.trim(), includeLine: true };
  }

  if (/^LOW INTENSITY MIX\b/.test(upper)) {
    return { type: 'ENGINE', title: line.trim(), includeLine: true };
  }

  if (/^GYMNASTICS\b/.test(upper)) {
    return { type: 'GYMNASTICS', title: line.trim(), includeLine: true };
  }

  if (/^ACESS[ÓO]RIOS\b|^ACCESSORIES\b/.test(upper)) {
    return { type: 'ACCESSORIES', title: line.trim(), includeLine: false };
  }

  if (allowInferred && looksLikeStrengthHeader(line, nextLine, nextLines)) {
    return { type: 'STRENGTH', title: line.trim(), includeLine: true };
  }

  return null;
}

function looksLikeStrengthHeader(line, nextLine = '', nextLines = []) {
  const upper = line.trim().toUpperCase();
  if (!upper || /[a-zà-ÿ]/.test(line)) return false;
  if (detectDayName(line) || detectPeriodName(line) || shouldSkipLine(line)) return false;
  if (isCadenceLine(line)) return false;
  if (/^OBJETIVO\b|^REST\b|^RECOVERY\b/.test(upper)) return false;
  if (!/[A-Z]/.test(upper)) return false;
  const candidates = [nextLine, ...nextLines].filter(Boolean);
  return candidates.some((candidate) => isStrengthSchemeLine(candidate) || isAccessorySchemeLine(candidate) || isCadenceLine(candidate));
}

function isStrengthSchemeLine(line = '') {
  const compact = line.trim().replace(/\s+/g, '');
  return /^(\d+\+)+\d+@\d+(?:\.\d+)?%$/i.test(compact)
    || /^(\d+\+)+\d+@\?$/i.test(compact)
    || /^\d+@\d+(?:\.\d+)?%(?:(?:\(x\d+\))|(?:x\d+))?$/i.test(compact)
    || /^\d+@\?(\+\d+)?$/i.test(compact)
    || /^\d+@\d+(?:\.\d+)?%\+\d+$/i.test(compact)
    || /^\d+x\d+@\d+(?:\.\d+)?%$/i.test(compact)
    || /^\d+x\d+@\d+(?:\.\d+)?%\+\d+$/i.test(compact);
}

function isAccessorySchemeLine(line = '') {
  return /^\d+\s*x\s*\d+$/i.test(line.trim());
}

function isCadenceLine(line = '') {
  return /^(A CADA|EVERY)\s+\d+\s*(SEC|SEG|SECONDS?)/i.test(line.trim());
}

function mapLegacyBlockTypeToStructuredType(type) {
  const upper = String(type || '').trim().toUpperCase();
  if (upper.includes('WOD')) return 'WOD';
  if (upper === 'OPTIONAL') return 'OPTIONAL';
  if (upper === 'TIMED_WOD') return 'WOD';
  return upper || 'DEFAULT';
}

function buildStructuredBlock({ type, title, period, lines, hints = {} }) {
  const normalizedLines = (lines || []).map((line) => String(line || '').trim()).filter(Boolean);
  const references = normalizedLines.filter((line) => /https?:\/\/\S+/i.test(line));
  const effectiveLines = normalizedLines.filter((line) => !/https?:\/\/\S+/i.test(line));
  const parsed = parseStructuredBlockContent({
    type,
    title,
    period,
    lines: effectiveLines,
    hints,
  });

  return {
    type: type || 'DEFAULT',
    title: title || '',
    period: period || null,
    lines: effectiveLines,
    references,
    parsed,
  };
}

function parseStructuredBlockContent({ type, title, period, lines, hints = {} }) {
  const items = [];
  let format = null;
  let rounds = null;
  let timeCapMinutes = null;
  let goal = '';
  let quality = !!hints.gymQuality;

  if (hints.qualityNote) {
    items.push({ type: 'quality_note', text: hints.qualityNote, raw: hints.qualityNote });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const upper = line.toUpperCase();

    const amrapMatch = upper.match(/^(\d+)\s*['’`´]?\s*AMRAP\b/);
    if (amrapMatch) {
      format = 'amrap';
      timeCapMinutes = Number(amrapMatch[1]);
      items.push({ type: 'format', format, timeCapMinutes, raw: line });
      continue;
    }

    const emomMatch = upper.match(/^(\d+)\s*['’`´]?\s*EMOM\b/);
    if (emomMatch) {
      format = 'emom';
      timeCapMinutes = Number(emomMatch[1]);
      items.push({ type: 'format', format, timeCapMinutes, raw: line });
      continue;
    }

    if (/^FOR TIME\b/.test(upper)) {
      format = 'for_time';
      items.push({ type: 'format', format, timeCapMinutes, raw: line });
      continue;
    }

    const forTimeCapMatch = upper.match(/^(\d+)\s*['’`´]?\s*FOR TIME\b/);
    if (forTimeCapMatch) {
      format = 'for_time';
      timeCapMinutes = Number(forTimeCapMatch[1]);
      items.push({ type: 'format', format, timeCapMinutes, raw: line });
      continue;
    }

    const capMatch = upper.match(/(?:TIME\s*CAP|CAP)\s*(\d+)\s*['’`´]?/);
    if (capMatch) {
      timeCapMinutes = Number(capMatch[1]);
      items.push({ type: 'cap', timeCapMinutes, raw: line });
      continue;
    }

    const roundsMatch = upper.match(/^\(?\s*(\d+)\s*X\s*\)?$/);
    if (roundsMatch) {
      rounds = Number(roundsMatch[1]);
      items.push({ type: 'rounds', rounds, raw: line });
      continue;
    }

    const cadence = parseCadenceLine(line);
    if (cadence) {
      format = 'emom';
      if (cadence.intervalSeconds % 60 === 0) {
        timeCapMinutes = cadence.repeatCount ? (cadence.intervalSeconds / 60) * cadence.repeatCount : timeCapMinutes;
      }
      items.push(cadence);
      continue;
    }

    const goalMatch = line.match(/^OBJETIVO\s*=\s*(.+)$/i);
    if (goalMatch) {
      const goalLines = [goalMatch[1].trim()];
      while (index + 1 < lines.length && isGoalContinuationLine(lines[index + 1])) {
        goalLines.push(String(lines[index + 1] || '').trim());
        index += 1;
      }
      goal = goalLines.join(' ').replace(/\s+/g, ' ').trim();
      items.push({ type: 'goal', text: goal, raw: line });
      continue;
    }

    if (/^\*+/.test(line) || /^FLOW\s*=/i.test(line) || /^DIRETO PARA$/i.test(upper)) {
      items.push({ type: 'note', text: line.trim(), raw: line });
      continue;
    }

    const rest = parseRestLine(line);
    if (rest) {
      items.push(rest);
      continue;
    }

    const timedInterval = parseTimedIntervalLine(line);
    if (timedInterval) {
      items.push(timedInterval);
      continue;
    }

    const recoveryMatch = upper.match(/^(\d+)\s*['’`´]\s*RECOVERY ROW\b/);
    if (recoveryMatch) {
      items.push({ type: 'recovery', modality: 'row', durationMinutes: Number(recoveryMatch[1]), raw: line });
      continue;
    }

    if (/^https?:\/\//i.test(line)) {
      items.push({ type: 'reference', url: line.trim(), raw: line });
      continue;
    }

    if (isStrengthSchemeLine(line)) {
      items.push(parseStrengthSchemeLine(line));
      continue;
    }

    if (isAccessorySchemeLine(line)) {
      const match = line.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
      items.push({
        type: 'scheme',
        sets: Number(match[1]),
        reps: Number(match[2]),
        raw: line,
      });
      continue;
    }

    if (String(type || '').toUpperCase() === 'ENGINE') {
      const engineInterval = parseEngineIntervalLine(line);
      if (engineInterval) {
        items.push(engineInterval);
        continue;
      }
    }

    if (String(type || '').toUpperCase() === 'GYMNASTICS' && /QUALIDADE|N[ÃA]O POR TEMPO/i.test(upper)) {
      quality = true;
      items.push({ type: 'quality_note', text: line.trim(), raw: line });
      continue;
    }

    if (String(type || '').toUpperCase() === 'ACCESSORIES') {
      const accessory = parseAccessoryLine(line);
      if (accessory) {
        items.push(accessory);
        continue;
      }
    }

    const movement = parseMovementLine(line);
    if (movement) {
      items.push(movement);
      continue;
    }

    if (line.trim()) {
      items.push({ type: 'note', text: line.trim(), raw: line });
    }
  }

  const blockType = String(type || 'DEFAULT').toUpperCase();
  const accessoryItems = blockType === 'ACCESSORIES' ? buildAccessoryItems(items) : [];
  const engineSummary = blockType === 'ENGINE' ? buildEngineSummary(items, { title }) : null;
  const gymnasticsSummary = blockType === 'GYMNASTICS' ? buildGymnasticsSummary(items, { title, rounds, quality }) : null;
  const strengthSummary = blockType === 'STRENGTH' ? buildStrengthSummary(items, { title }) : null;

  return {
    blockType: String(type || 'DEFAULT').toLowerCase(),
    title: title || '',
    period: period || null,
    format,
    rounds,
    timeCapMinutes,
    goal: goal || null,
    quality,
    accessories: accessoryItems,
    engine: engineSummary,
    gymnastics: gymnasticsSummary,
    strength: strengthSummary,
    items,
  };
}

function parseMovementLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;
  if (/^\(?\s*\d+(?:-\d+)+\s*\)?(?:\(?\s*\d+(?:-\d+)+\s*\)?)+$/i.test(raw.replace(/\)+/g, ')'))) {
    return { type: 'rep_wave', raw, text: raw };
  }

  const pairLoadMatch = raw.match(/(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*LBS?/i);
  const pairKgLoadMatch = raw.match(/(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*KG/i);
  const heightMatch = raw.match(/\((\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*CM\)/i);
  const alternativeMatch = raw.match(/\(OU\s+([^)]+)\)/i);
  const noteMatch = raw.match(/\((?!OU\s)([^)]+)\)/i);
  const repsMatch = raw.match(/^(\d+)\s+(.*)$/);
  const distanceMatch = raw.match(/^(\d+)\s*M\s+(.*)$/i);

  const item = {
    type: 'movement',
    raw,
    name: raw,
  };

  if (distanceMatch) {
    item.distanceMeters = Number(distanceMatch[1]);
    item.name = cleanupMovementName(distanceMatch[2]);
  } else if (repsMatch) {
    item.reps = Number(repsMatch[1]);
    item.name = cleanupMovementName(repsMatch[2]);
  }

  const normalized = normalizeMovementName(item.name);
  item.name = normalized.name;
  item.displayName = normalized.displayName;
  item.canonicalName = normalized.canonicalName;
  item.canonicalSlug = normalized.canonicalSlug;
  item.aliases = normalized.aliases;

  if (pairLoadMatch) {
    const maleLb = Number(pairLoadMatch[1]);
    const femaleLb = Number(pairLoadMatch[2]);
    item.load = {
      maleLb,
      femaleLb,
      maleKg: roundKg(lbsToKg(maleLb)),
      femaleKg: roundKg(lbsToKg(femaleLb)),
    };
  }

  if (pairKgLoadMatch) {
    item.load = {
      maleKg: Number(pairKgLoadMatch[1]),
      femaleKg: Number(pairKgLoadMatch[2]),
    };
  }

  if (heightMatch) {
    item.boxHeightCm = {
      min: Number(heightMatch[1]),
      max: Number(heightMatch[2]),
    };
  }

  if (alternativeMatch) {
    item.alternatives = [normalizeMovementName(cleanupMovementName(alternativeMatch[1]).replace(/^\d+\s+/, '')).name];
  }

  if (noteMatch) {
    item.notes = noteMatch[1].trim();
  }

  return item;
}

function cleanupMovementName(value) {
  return String(value || '')
    .replace(/\(([^)]+)\)/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*LBS?/gi, '')
    .replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*LBS?/gi, '')
    .replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*KG/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMovementName(value) {
  const displayName = String(value || '').trim();
  const compact = displayName
    .toUpperCase()
    .replace(/[().,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const exactAliasMap = new Map([
    ['WBS', 'wall ball'],
    ['WB', 'wall ball'],
    ['WALL BALLS', 'wall ball'],
    ['DUS', 'double unders'],
    ['DU', 'double unders'],
    ['BMUS', 'bar muscle-up'],
    ['BMU', 'bar muscle-up'],
    ['MUS', 'muscle-up'],
    ['MU', 'muscle-up'],
    ['CTBS', 'chest-to-bar pull-up'],
    ['CTB', 'chest-to-bar pull-up'],
    ['TTBS', 'toes-to-bar'],
    ['TTB', 'toes-to-bar'],
    ['OHS', 'overhead squat'],
    ['OHSQUAT', 'overhead squat'],
    ['SHSPU', 'strict handstand push-up'],
    ['HSPU', 'handstand push-up'],
  ]);

  let normalized = exactAliasMap.get(compact) || null;

  if (!normalized) {
    normalized = compact
      .replace(/\bALT\b/g, 'alternating')
      .replace(/\bDB\b/g, 'dumbbell')
      .replace(/\bKB\b/g, 'kettlebell')
      .replace(/\bBB\b/g, 'barbell')
      .replace(/\bOH\b/g, 'overhead')
      .replace(/\bOHS\b/g, 'overhead squat')
      .replace(/\bPOWER SNATCHES\b/g, 'power snatch')
      .replace(/\bPOWER SNATCH\b/g, 'power snatch')
      .replace(/\bPOWER CLEAN AND JERK\b/g, 'power clean and jerk')
      .replace(/\bPOWER CLEAN\b/g, 'power clean')
      .replace(/\bSQUAT CLEAN AND JERK\b/g, 'squat clean and jerk')
      .replace(/\bSQUAT CLEAN\b/g, 'squat clean')
      .replace(/\bPUSH PRESS\b/g, 'push press')
      .replace(/\bWALKING LUNGE WALKING LUNGE\b/g, 'walking lunge')
      .replace(/\bREGIONALS WALKING LUNGE\b/g, 'walking lunge')
      .replace(/\bWALKING LUNGE\b/g, 'walking lunge')
      .replace(/\bBOX JUMP OVER\b/g, 'box jump over')
      .replace(/\bROPE CLIMBS\b/g, 'rope climb')
      .replace(/\bROPE CLIMB\b/g, 'rope climb')
      .replace(/\bWALL WALKS\b/g, 'wall walk')
      .replace(/\bCTBS\b/g, 'chest-to-bar pull-up')
      .replace(/\bCTB\b/g, 'chest-to-bar pull-up')
      .replace(/\bTTBS\b/g, 'toes-to-bar')
      .replace(/\bTTB\b/g, 'toes-to-bar')
      .replace(/\bDUS\b/g, 'double unders')
      .replace(/\bDU\b/g, 'double unders')
      .replace(/\bWBS\b/g, 'wall ball')
      .replace(/\bWB\b/g, 'wall ball')
      .replace(/\bBMUS\b/g, 'bar muscle-up')
      .replace(/\bBMU\b/g, 'bar muscle-up')
      .replace(/\bMUS\b/g, 'muscle-up')
      .replace(/\bMU\b/g, 'muscle-up')
      .replace(/\bGHD SIT UPS\b/g, 'ghd sit-up')
      .replace(/\bGHD SIT UPS\b/g, 'ghd sit-up')
      .replace(/\bGHD SIT UP\b/g, 'ghd sit-up')
      .replace(/\bSTRICT PULL UPS PEGADA SUPINADA\b/g, 'strict chin-up')
      .replace(/\bSTRICT PULL UPS\b/g, 'strict pull-up')
      .replace(/\bPULL UPS\b/g, 'pull-up')
      .replace(/\bBURPEE FACING BAR\b/g, 'burpee facing bar')
      .replace(/\bSHUTTLE RUN\b/g, 'shuttle run')
      .replace(/\bROW\b/g, 'row')
      .replace(/\bRUN\b/g, 'run')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  const canonicalName = normalized || displayName.toLowerCase();
  return {
    displayName,
    name: canonicalName,
    canonicalName,
    canonicalSlug: canonicalName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    aliases: compact && compact !== canonicalName.toUpperCase() ? [compact] : [],
  };
}

function roundKg(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function parseRestLine(line) {
  const upper = String(line || '').trim().toUpperCase();
  const restMatch = upper.match(/^(?:(\d+)\s*['’`´]\s*)?REST(?:\s+TOTAL)?(?:\s+(\d+)\s*['’`´])?$/);
  if (restMatch) {
    const minutes = Number(restMatch[1] || restMatch[2] || 0);
    return { type: 'rest', durationMinutes: minutes || null, raw: line };
  }

  const mixedDurationRestMatch = upper.match(/^(\d+)\s*['’`´]\s*(\d+)\s*REST(?:\s+TOTAL)?$/);
  if (mixedDurationRestMatch) {
    const minutes = Number(mixedDurationRestMatch[1] || 0);
    const seconds = Number(mixedDurationRestMatch[2] || 0);
    return {
      type: 'rest',
      durationMinutes: minutes || null,
      durationSeconds: (minutes * 60) + seconds,
      raw: line,
    };
  }

  const secondsRestMatch = upper.match(/^(\d+)\s*(SEC|SEG|SECONDS?)\s+(?:OFF|REST)$/);
  if (secondsRestMatch) {
    return {
      type: 'rest',
      durationSeconds: Number(secondsRestMatch[1]),
      raw: line,
    };
  }

  if (/^REST AS NECESSARY$/i.test(upper)) {
    return { type: 'rest', durationMinutes: null, auto: true, raw: line };
  }

  const minuteRestMatch = upper.match(/^(\d+)\s*MIN\s+REST$/);
  if (minuteRestMatch) {
    return { type: 'rest', durationMinutes: Number(minuteRestMatch[1]), raw: line };
  }

  const betweenSetsMatch = upper.match(/(\d+)\s*['’`´]\s*REST\s+BETWEEN\s+SETS/);
  if (betweenSetsMatch) {
    return { type: 'rest', durationMinutes: Number(betweenSetsMatch[1]), raw: line, betweenSets: true };
  }

  return null;
}

function parseStrengthSchemeLine(line) {
  const raw = String(line || '').trim();
  const compact = raw.replace(/\s+/g, '');
  const repeatMatch = compact.match(/^(.*?)(?:\(x(\d+)\)|x(\d+))$/i);
  const repeatCount = repeatMatch ? Number(repeatMatch[2] || repeatMatch[3]) : null;
  const base = repeatMatch ? repeatMatch[1] : compact;
  const percentMatch = base.match(/@(\d+(?:\.\d+)?)%/i);
  const repeatedSetMatch = base.match(/^(\d+)x(\d+)@(\d+(?:\.\d+)?)%$/i);
  if (repeatedSetMatch) {
    return {
      type: 'strength_scheme',
      raw,
      scheme: `${repeatedSetMatch[1]}x${repeatedSetMatch[2]}@${repeatedSetMatch[3]}%`,
      sets: Number(repeatedSetMatch[1]),
      reps: Number(repeatedSetMatch[2]),
      percent: Number(repeatedSetMatch[3]),
      repeatCount,
    };
  }

  const pairedMatch = compact.match(/^(\d+)@(\?)?\+(\d+)$/i);
  if (pairedMatch) {
    return {
      type: 'strength_scheme',
      raw,
      reps: Number(pairedMatch[1]),
      intensityUnknown: !!pairedMatch[2],
      pairedReps: Number(pairedMatch[3]),
      scheme: `${pairedMatch[1]}@${pairedMatch[2] ? '?' : ''}+${pairedMatch[3]}`,
      repeatCount,
      percent: percentMatch ? Number(percentMatch[1]) : null,
    };
  }

  const sequenceMatch = base.match(/^((?:\d+\+)+\d+)@(\d+(?:\.\d+)?%|\?)$/i);
  if (sequenceMatch) {
    return {
      type: 'strength_scheme',
      raw,
      scheme: sequenceMatch[1],
      intensityUnknown: sequenceMatch[2] === '?',
      sequenceReps: sequenceMatch[1].split('+').map((value) => Number(value)),
      percent: percentMatch ? Number(percentMatch[1]) : null,
      repeatCount,
    };
  }

  const singleMatch = base.match(/^(\d+)@(\d+(?:\.\d+)?%|\?)$/i);
  if (singleMatch) {
    return {
      type: 'strength_scheme',
      raw,
      scheme: `${singleMatch[1]}@${singleMatch[2]}`,
      reps: Number(singleMatch[1]),
      intensityUnknown: singleMatch[2] === '?',
      percent: percentMatch ? Number(percentMatch[1]) : null,
      repeatCount,
    };
  }

  return {
    type: 'strength_scheme',
    scheme: raw,
    intensityUnknown: raw.includes('?'),
    percent: percentMatch ? Number(percentMatch[1]) : null,
    repeatCount,
    raw,
  };
}

function parseCadenceLine(line) {
  const raw = String(line || '').trim();
  const match = raw.match(/^(A CADA|EVERY)\s+(\d+)\s*(SEC|SEG|SECONDS?)(?:\s*\(x(\d+)\))?$/i);
  if (!match) return null;
  return {
    type: 'cadence',
    raw,
    intervalSeconds: Number(match[2]),
    repeatCount: match[4] ? Number(match[4]) : null,
  };
}

function parseTimedIntervalLine(line) {
  const raw = String(line || '').trim();
  const upper = raw.toUpperCase();
  const offMatch = upper.match(/^(\d+)\s*(SEC|SEG|SECONDS?)\s+OFF$/);
  if (offMatch) {
    return {
      type: 'rest',
      durationSeconds: Number(offMatch[1]),
      raw,
    };
  }

  const workMatch = raw.match(/^(\d+)\s*(SEC|SEG|SECONDS?)\s+(.+)$/i);
  if (!workMatch) return null;

  const durationSeconds = Number(workMatch[1]);
  const movement = parseMovementLine(workMatch[3]);
  if (!movement) return null;

  return {
    ...movement,
    raw,
    durationSeconds,
    interval: true,
  };
}

function parseEngineIntervalLine(line) {
  const upper = String(line || '').trim().toUpperCase();
  const durationMatch = upper.match(/^(\d+)\s*MIN(?:\s+([A-Z* ]+))?$/);
  if (durationMatch) {
    return {
      type: 'engine_work',
      durationMinutes: Number(durationMatch[1]),
      modality: cleanupMovementName(durationMatch[2] || ''),
      raw: line,
    };
  }

  const hrConstraintMatch = line.match(/frequ[êe]ncia card[íi]aca.+180\s*-\s*idade/i);
  if (hrConstraintMatch) {
    return {
      type: 'constraint',
      metric: 'heart_rate',
      rule: 'never_above',
      formula: '180 - age',
      raw: line,
    };
  }

  return null;
}

function parseAccessoryLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;

  const match = raw.match(/^(.*?)\s+(\d+)\s*x\s*(\d+)$/i);
  if (match) {
    const normalized = normalizeMovementName(match[1].trim());
    return {
      type: 'accessory_item',
      name: normalized.name,
      displayName: normalized.displayName,
      canonicalName: normalized.canonicalName,
      canonicalSlug: normalized.canonicalSlug,
      sets: Number(match[2]),
      reps: Number(match[3]),
      raw,
    };
  }

  const normalized = normalizeMovementName(raw);
  return {
    type: 'accessory_name',
    name: normalized.name,
    displayName: normalized.displayName,
    canonicalName: normalized.canonicalName,
    canonicalSlug: normalized.canonicalSlug,
    raw,
  };
}

function buildAccessoryItems(items) {
  return items
    .filter((item) => item.type === 'accessory_item')
    .map((item) => ({
      name: item.name,
      displayName: item.displayName || item.name,
      canonicalName: item.canonicalName || item.name,
      canonicalSlug: item.canonicalSlug || null,
      sets: item.sets,
      reps: item.reps,
      notes: extractParentheticalNote(item.name),
    }));
}

function buildEngineSummary(items, context = {}) {
  const roundsItem = items.find((item) => item.type === 'rounds');
  const workItem = items.find((item) => item.type === 'engine_work');
  const restItem = items.find((item) => item.type === 'rest' && item.durationMinutes);
  const constraints = items
    .filter((item) => item.type === 'constraint')
    .map((item) => ({
      metric: item.metric,
      rule: item.rule,
      formula: item.formula,
    }));

  if (!roundsItem && !workItem && !constraints.length) return null;

  return {
    title: context.title || '',
    rounds: roundsItem?.rounds || null,
    workMinutes: workItem?.durationMinutes || null,
    modality: workItem?.modality || null,
    restMinutes: restItem?.durationMinutes || null,
    constraints,
  };
}

function isGoalContinuationLine(line = '') {
  const raw = String(line || '').trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw)) return false;
  if (detectDayName(raw) || detectPeriodName(raw) || detectBlockType(raw)) return false;
  if (detectStructuredBlock(raw, '') || isCadenceLine(raw) || isStrengthSchemeLine(raw) || isAccessorySchemeLine(raw)) return false;
  if (/^\(?\s*\d+\s*X\s*\)?$/i.test(raw)) return false;
  if (/^(REST|RECOVERY|OBJETIVO)\b/i.test(raw)) return false;
  return true;
}

function buildGymnasticsSummary(items, context = {}) {
  const normalizedTitle = normalizeMovementName(context.title || '');
  const movements = items
    .filter((item) => item.type === 'movement' || item.type === 'recovery')
    .filter((item) => {
      const itemName = String(item.canonicalName || item.name || item.modality || '').trim();
      return itemName && itemName !== normalizedTitle.canonicalName;
    });
  if (!movements.length && !context.rounds) return null;

  return {
    title: context.title || '',
    rounds: context.rounds || null,
    quality: !!context.quality,
    movements: movements.map((item) => ({
      name: item.name || item.modality || '',
      displayName: item.displayName || item.name || item.modality || '',
      canonicalName: item.canonicalName || item.name || item.modality || '',
      canonicalSlug: item.canonicalSlug || null,
      reps: item.reps || null,
      distanceMeters: item.distanceMeters || null,
      notes: item.notes || null,
      alternatives: item.alternatives || [],
      recovery: item.type === 'recovery',
    })),
  };
}

function buildStrengthSummary(items, context = {}) {
  const schemes = items.filter((item) => item.type === 'strength_scheme');
  const cadence = items.find((item) => item.type === 'cadence');
  if (!schemes.length && !cadence) return null;

  return {
    title: context.title || '',
    sets: schemes.map((item) => ({
      scheme: item.scheme || null,
      sets: item.sets || null,
      sequenceReps: item.sequenceReps || null,
      reps: item.reps || null,
      pairedReps: item.pairedReps || null,
      intensityUnknown: !!item.intensityUnknown,
      percent: item.percent || null,
      repeatCount: item.repeatCount || null,
    })),
    cadenceSeconds: cadence?.intervalSeconds || null,
    cadenceRepeats: cadence?.repeatCount || null,
  };
}

function extractParentheticalNote(value) {
  const match = String(value || '').match(/\(([^)]+)\)/);
  return match ? match[1].trim() : '';
}
