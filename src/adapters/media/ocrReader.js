/**
 * OCR Reader
 * Extração de texto de imagens usando Tesseract.js carregado dinamicamente.
 */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const DEFAULT_OCR_TIMEOUT_MS = 30000;
let tesseractPromise = null;

export function isImageFile(file) {
  return !!file?.type?.startsWith('image/');
}

export async function extractTextFromImageFile(file, options = {}) {
  if (!file) {
    throw new Error('Arquivo de imagem não fornecido');
  }

  if (!isImageFile(file)) {
    throw new Error('Arquivo não é uma imagem suportada');
  }

  const Tesseract = await ensureTesseract();
  const lang = options.lang || 'por+eng';
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_OCR_TIMEOUT_MS;

  const result = await withTimeout(
    Tesseract.recognize(file, lang, {
      logger: options.logger || (() => {}),
    }),
    timeoutMs,
    'OCR da imagem demorou demais. Tente uma imagem menor ou mais nítida.',
  );

  return result?.data?.text?.trim() || '';
}

async function ensureTesseract() {
  if (typeof window === 'undefined') {
    throw new Error('OCR disponível apenas no navegador');
  }

  if (window.Tesseract) {
    return window.Tesseract;
  }

  if (!tesseractPromise) {
    tesseractPromise = loadScript(TESSERACT_CDN).then(() => {
      if (!window.Tesseract) {
        throw new Error('Tesseract não carregou corretamente');
      }
      return window.Tesseract;
    });
  }

  return tesseractPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((s) => s.src === src);
    if (existing) {
      if (window.Tesseract) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar OCR')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar OCR'));
    document.head.appendChild(script);
  });
}

function withTimeout(task, timeoutMs, message) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([task, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
