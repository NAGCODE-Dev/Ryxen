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

export async function pickPdfFile() {
  return pickFile({ accept: 'application/pdf' });
}

export async function pickUniversalFile() {
  return pickFile({
    accept: [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/*',
      'video/*',
      '.txt',
      '.md',
      '.csv',
      '.json',
      '.xls',
      '.xlsx',
    ].join(','),
  });
}

export async function pickJsonFile() {
  return pickFile({ accept: '.json,application/json' });
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

async function pickFile({ accept = '' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    const cleanup = () => {
      try { document.body.removeChild(input); } catch {}
    };

    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0] || null;
      cleanup();
      resolve(file);
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

function isImageFile(file) {
  return String(file?.type || '').toLowerCase().startsWith('image/');
}

async function compressImageFile(file, { targetMaxBytes, maxDimension }) {
  const image = await loadImageFromFile(file);
  const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Não foi possível preparar a imagem para importação');
  }
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob.size > targetMaxBytes && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  const nextName = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
  return new File([blob], nextName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler a imagem selecionada'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível reduzir a imagem'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}
