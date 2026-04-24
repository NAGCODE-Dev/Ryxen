import { cleanPdfText } from '../adapters/pdf/pdfParser.js';
import {
  detectWeekNumbers,
  parseMultiWeekPdf,
  parseWeekText,
} from '../adapters/pdf/customPdfParser.js';

export function prepareImportTextForParsing(rawText, options = {}) {
  return cleanPdfText(String(rawText || ''), {
    fileName: options?.fileName || '',
  });
}

export function parseTextIntoWeeks(rawText, activeWeekNumber = null, options = {}) {
  const cleaned = prepareImportTextForParsing(rawText, options);
  if (!cleaned || cleaned.length < 20) return [];

  let weeks = parseMultiWeekPdf(cleaned);
  if (Array.isArray(weeks) && weeks.length > 0) {
    return weeks;
  }

  const detectedWeek = detectWeekNumbers(cleaned)[0];
  const inferredWeek = detectedWeek || activeWeekNumber || 1;
  const single = parseWeekText(cleaned, inferredWeek, {
    fallbackDay: options?.fallbackDay || null,
  });

  return single?.workouts?.length ? [single] : [];
}

export function toWorkoutBlocks(workout) {
  return {
    day: workout.day,
    blocks: (workout.sections || []).map((section) => ({
      ...section,
      type: section.type || 'DEFAULT',
      lines: section.lines || [],
    })),
  };
}

export function toWorkoutSections(workout) {
  return {
    day: workout.day,
    sections: (workout.blocks || []).map((block) => ({
      ...block,
      type: block.type || 'DEFAULT',
      lines: block.lines || [],
    })),
  };
}

export function normalizeWorkoutBlocks(blocks = []) {
  return blocks.map((block) => ({
    ...block,
    lines: (block.lines || []).map((line) => {
      if (isCalculatedLine(line)) return line;
      if (typeof line === 'object' && line !== null) {
        return String(line.raw || line.text || '');
      }
      return String(line);
    }),
  }));
}

export function isCalculatedLine(line) {
  return typeof line === 'object' && line !== null && !!line.calculated;
}
