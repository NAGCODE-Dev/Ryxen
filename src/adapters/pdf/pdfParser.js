/**
 * Limpa texto extraído de PDF (remove artefatos comuns)
 * @param {string} rawText - Texto bruto do PDF
 * @returns {string} Texto limpo
 */
export function cleanPdfText(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }
  
  let cleaned = rawText;
  
  // Normaliza quebras de linha
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');
  
  // Remove URLs (mantém quebra de linha)
  cleaned = cleaned.split('\n')
    .map(line => line.replace(/https?:\/\/[^\s]+/g, ''))
    .join('\n');
  
  // Remove emails (mantém quebra de linha)
  cleaned = cleaned.split('\n')
    .map(line => line.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ''))
    .join('\n');
  
  // Remove linhas com "Licensed to"
  cleaned = cleaned.split('\n')
    .filter(line => !line.includes('Licensed to'))
    .join('\n');
  
  // Remove linhas com hashtags
  cleaned = cleaned.split('\n')
    .filter(line => !line.trim().startsWith('#garanta'))
    .filter(line => !line.trim().startsWith('#treine'))
    .join('\n');
  
  // Remove linhas vazias EXCESSIVAS (3+ vazias viram 1)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove espaços no início/fim de cada linha (MAS MANTÉM AS QUEBRAS!)
  cleaned = cleaned.split('\n')
    .map(line => line.trim())
    .join('\n');
  
  // Remove linhas completamente vazias
  cleaned = cleaned.split('\n')
    .filter(line => line.length > 0)
    .filter(line => !shouldDropImportNoiseLine(line, options))
    .join('\n');
  
  return cleaned.trim();
}

function shouldDropImportNoiseLine(line, options = {}) {
  const raw = String(line || '').trim();
  if (!raw) return true;

  const normalized = normalizeImportNoiseComparable(raw);
  if (!normalized) return true;

  if (looksLikeImportedFileName(raw)) return true;
  if (matchesSelectedFileName(raw, options?.fileName)) return true;

  return false;
}

function looksLikeImportedFileName(line) {
  const raw = String(line || '').trim();
  if (!raw) return false;

  if (/\.(pdf|png|jpe?g|webp|heic|txt|csv|xlsx?|ods|mp4|mov|avi|mkv)\b/i.test(raw)) return true;
  if (/^img[-_ ]?\d{6,}/i.test(raw)) return true;
  if (/^rx[._-]/i.test(raw) && /bsbstrong/i.test(raw)) return true;

  return false;
}

function matchesSelectedFileName(line, fileName = '') {
  const comparableLine = normalizeImportNoiseComparable(line);
  const comparableFileName = normalizeImportNoiseComparable(stripFileExtension(fileName));

  if (!comparableLine || !comparableFileName || comparableFileName.length < 8) {
    return false;
  }

  return comparableLine.includes(comparableFileName)
    || comparableFileName.includes(comparableLine);
}

function stripFileExtension(fileName = '') {
  return String(fileName || '').replace(/\.[a-z0-9]{2,5}$/i, '');
}

function normalizeImportNoiseComparable(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
