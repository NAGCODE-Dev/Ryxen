import { createAthleteMediaImportBindings } from './importMediaBindings.js';
import { createAthletePdfImportBindings } from './importPdfBindings.js';

export function stepForImportProgress(data = {}) {
  if (data.stage === 'pdf-save') return 'save';
  if (data.stage === 'pdf-parse') return 'organize';
  if (data.stage === 'pdf-open' || data.stage === 'pdf-text' || data.stage === 'pdf-ocr-start' || data.stage === 'pdf-ocr') return 'read';
  if (data.stage === 'sheet-read' || data.stage === 'sheet-parse' || data.stage === 'ocr' || data.stage === 'frames-ready') return 'read';
  if (data.message && /salvand/i.test(data.message)) return 'save';
  if (data.message && /organizando|convertendo/i.test(data.message)) return 'organize';
  if (data.message && /lendo|ocr|preparando|extraindo|processando/i.test(data.message)) return 'read';
  return 'selected';
}

export function createAthleteImportEventBindings({
  busy,
  updateImportStatus,
  pushEventLine,
  toast,
  rerender,
}) {
  return [
    ...createAthletePdfImportBindings({
      busy,
      updateImportStatus,
      pushEventLine,
      toast,
      rerender,
      stepForImportProgress,
    }),
    ...createAthleteMediaImportBindings({
      busy,
      updateImportStatus,
      pushEventLine,
      toast,
      rerender,
      stepForImportProgress,
    }),
  ];
}
