/**
 * OCR Reader
 * Extração de texto de imagens usando Tesseract.js carregado dinamicamente.
 */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
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

  const result = await Tesseract.recognize(file, lang, {
    logger: options.logger || (() => {}),
  });

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
