import { isImageFile } from '../adapters/media/ocrReader.js';
import { isVideoFile } from '../adapters/media/videoTextReader.js';
import { isSpreadsheetFile } from '../adapters/spreadsheet/spreadsheetReader.js';

const TEXT_EXTENSIONS = /\.(txt|md|csv|json)$/i;

export function isPdfImportFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

export function isTextLikeImportFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  return type.startsWith('text/') || TEXT_EXTENSIONS.test(name);
}

export function classifyUniversalImportFile(file) {
  if (!file) {
    return {
      supported: false,
      source: 'missing',
      error: 'Arquivo não fornecido',
    };
  }

  if (isPdfImportFile(file)) {
    return {
      supported: true,
      source: 'pdf',
      reader: 'pdf',
    };
  }

  if (isImageFile(file)) {
    return {
      supported: true,
      source: 'image',
      reader: 'ocr-image',
    };
  }

  if (isVideoFile(file)) {
    return {
      supported: true,
      source: 'video',
      reader: 'ocr-video',
    };
  }

  if (isSpreadsheetFile(file)) {
    return {
      supported: true,
      source: 'spreadsheet',
      reader: 'spreadsheet',
    };
  }

  if (isTextLikeImportFile(file)) {
    return {
      supported: true,
      source: 'text',
      reader: 'text',
    };
  }

  return {
    supported: false,
    source: 'unknown',
    error: `Formato não suportado: ${file.type || file.name}`,
  };
}
