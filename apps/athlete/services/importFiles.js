import {
  pickJsonFile,
  pickPdfFile,
  pickUniversalFile,
} from './importPickers.js';
import {
  compressImageFile,
  isImageFile,
} from './importImages.js';

export const IMPORT_HARD_MAX_BYTES = 50 * 1024 * 1024;
export const IMAGE_COMPRESS_THRESHOLD_BYTES = 8 * 1024 * 1024;
export const IMAGE_TARGET_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_MAX_DIMENSION = 2200;

export function idleImportStatus() {
  return {
    active: false,
    tone: 'idle',
    title: '',
    message: '',
    fileName: '',
  };
}

export function explainImportFailure(error, file) {
  const rawMessage = String(error?.message || error || '').trim();
  const fileName = String(file?.name || '').trim();
  const lower = rawMessage.toLowerCase();

  if (!rawMessage) {
    return 'Nao foi possivel importar esse arquivo.';
  }

  if (lower.includes('não foi possível extrair frames') || lower.includes('nao foi possivel extrair frames')) {
    return 'Nao consegui ler esse video. Tente um video mais curto, com texto mais nítido ou envie uma imagem/PDF.';
  }

  if (lower.includes('pdf vazio') || lower.includes('texto não extraído') || lower.includes('texto nao extraido')) {
    return 'Esse PDF nao trouxe texto legivel. Tente um PDF mais nítido ou envie imagem/planilha.';
  }

  if (lower.includes('não é um') || lower.includes('nao e um')) {
    return fileName
      ? `O arquivo ${fileName} nao parece estar em um formato suportado para esse fluxo.`
      : 'Esse arquivo nao parece estar em um formato suportado para esse fluxo.';
  }

  if (lower.includes('vazio')) {
    return 'O arquivo foi lido, mas nao encontrei conteudo suficiente para montar o treino.';
  }

  if (lower.includes('limite')) {
    return rawMessage;
  }

  return rawMessage;
}

export async function prepareImportFileForClientUse(file, {
  hardMaxBytes,
  imageCompressThresholdBytes,
  imageTargetMaxBytes,
  imageMaxDimension,
}) {
  if (!file) return null;

  if (file.size <= hardMaxBytes && (!isImageFile(file) || file.size <= imageCompressThresholdBytes)) {
    return file;
  }

  if (isImageFile(file)) {
    const compressed = await compressImageFile(file, {
      targetMaxBytes: Math.min(imageTargetMaxBytes, hardMaxBytes),
      maxDimension: imageMaxDimension,
    });
    if (compressed.size <= hardMaxBytes) {
      return compressed;
    }
  }

  throw new Error(
    `Arquivo acima do limite de ${formatBytes(hardMaxBytes)}. Reduza o arquivo antes de importar.`,
  );
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}
