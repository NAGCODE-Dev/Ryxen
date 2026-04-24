/**
 * OCR Reader
 * Extração de texto de imagens usando Tesseract.js carregado dinamicamente.
 */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const DEFAULT_OCR_TIMEOUT_MS = 30000;
const OCR_SCAN_TARGET_WIDTH = 240;
const OCR_MIN_PANEL_HEIGHT = 96;
const OCR_PANEL_HORIZONTAL_PADDING = 10;
const OCR_PANEL_VERTICAL_PADDING = 4;
const OCR_BODY_SCALE = 2;
const OCR_HINT_SCALE = 1.15;
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
  const regions = await prepareImageOcrRegions(file);
  const totalPasses = regions.reduce(
    (sum, region) => sum + (region.hintFile ? 1 : 0) + (region.bodyFile ? 1 : 0),
    0,
  );
  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : DEFAULT_OCR_TIMEOUT_MS * Math.max(1, totalPasses);

  const result = await withTimeout(
    recognizePreparedImageRegions(Tesseract, regions, {
      lang,
      logger: options.logger || (() => {}),
      onProgress: options.onProgress,
    }),
    timeoutMs,
    'OCR da imagem demorou demais. Tente uma imagem menor ou mais nítida.',
  );

  return cleanOcrWorkoutText(String(result || '').trim());
}

export function cleanOcrWorkoutText(text = '') {
  const raw = String(text || '').replace(/\r/g, '\n').trim();
  if (!raw) return '';

  const normalizedText = raw
    .replace(/\b(SEGUNDA|TER[ÇC]A|QUARTA|QU[1I]NTA|SEXTA|S[ÁA]BADO|SABADO|DOMINGO)\s+(MANH[ÃA]|MANHA|MANA|TARDE|TAR0E)\b/gi, '$1\n$2')
    .replace(/\b(MANH[ÃA]|MANHA|MANA|TARDE|TAR0E)\s+(W[O0]D(?:\s*2)?|OPTIONAL|OPCIONAL|OPICIONAL|LOW INTENSITY MIX(?:\s*\d+)?|LOW INTENSITY ROW|GYMNASTICS(?:\s*\d+)?|ACESS[ÓO]RIOS|ACCESSORIES|CORE|SWIM)\b/gi, '$1\n$2');

  const cleanedLines = collapseConsecutiveComparableLines(
    normalizedText
      .split('\n')
      .map((line) => normalizeWorkoutOcrLine(line))
      .filter(Boolean),
  );

  return cleanedLines.join('\n').trim();
}

export function mergeOcrTextVariants(structuralText = '', bodyText = '') {
  const bodyLines = splitOcrLines(bodyText);
  if (!bodyLines.length) {
    return splitOcrLines(structuralText).join('\n');
  }

  const mergedLines = [...bodyLines];
  const mergedKeys = new Set(mergedLines.map((line) => getComparableOcrLineKey(line)));
  const hintLines = splitOcrLines(structuralText).map((line) => normalizeOcrHintLine(line)).filter(Boolean);

  for (let index = 0; index < hintLines.length; index += 1) {
    const line = hintLines[index];
    if (!isStructuralOcrLine(line)) continue;

    const lineKey = getComparableOcrLineKey(line);
    if (mergedKeys.has(lineKey)) continue;

    const nextAnchor = hintLines
      .slice(index + 1)
      .find((candidate) => candidate && mergedKeys.has(getComparableOcrLineKey(candidate)));

    if (nextAnchor) {
      const anchorIndex = mergedLines.findIndex(
        (candidate) => getComparableOcrLineKey(candidate) === getComparableOcrLineKey(nextAnchor),
      );
      if (anchorIndex >= 0) {
        mergedLines.splice(anchorIndex, 0, line);
        mergedKeys.add(lineKey);
        continue;
      }
    }

    const previousAnchor = [...hintLines.slice(0, index)]
      .reverse()
      .find((candidate) => candidate && mergedKeys.has(getComparableOcrLineKey(candidate)));

    if (previousAnchor) {
      const anchorIndex = mergedLines.findIndex(
        (candidate) => getComparableOcrLineKey(candidate) === getComparableOcrLineKey(previousAnchor),
      );
      if (anchorIndex >= 0) {
        mergedLines.splice(anchorIndex + 1, 0, line);
        mergedKeys.add(lineKey);
        continue;
      }
    }

    if (index === 0) {
      mergedLines.unshift(line);
    } else {
      mergedLines.push(line);
    }
    mergedKeys.add(lineKey);
  }

  return collapseConsecutiveComparableLines(mergedLines).join('\n');
}

export function normalizeOcrStructuralLine(line = '') {
  const cleaned = normalizeWorkoutOcrLineBase(line);
  const upper = cleaned.toUpperCase();

  if (/^SEMANA\s+\d+$/.test(upper)) return cleaned;
  if (/^(SEGUNDA|TERÇA|TERCA|QUARTA|QUINTA|SEXTA|SÁBADO|SABADO|DOMINGO)$/.test(upper)) return cleaned;
  if (upper === 'MANHÃ' || upper === 'MANHA' || /ANH[ÃA]$/.test(upper)) return 'MANHA';
  if (upper === 'TARDE' || /ARDE$/.test(upper)) return 'TARDE';
  if (/^WOD(?:\s*2)?$/.test(upper)) return upper.replace(/\s+/g, ' ');
  if (upper === 'OPTIONAL') return 'OPTIONAL';
  if (/^LOW INTENSITY MIX(?:\s+\d+)?$/.test(upper)) return upper;
  if (upper === 'LOW INTENSITY ROW') return 'LOW INTENSITY ROW';
  if (/^GYMNASTICS(?:\s+\d+)?$/.test(upper)) return upper;
  if (upper === 'ACCESSORIES') return 'ACCESSORIES';
  if (upper === 'CORE') return 'CORE';
  if (upper === 'SWIM') return 'SWIM';

  return cleaned;
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

async function recognizePreparedImageRegions(Tesseract, regions, options = {}) {
  const mergedRegions = [];
  const totalRegions = Math.max(1, regions.length);

  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    options.onProgress?.({
      stage: 'preprocess',
      processedRegions: index,
      totalRegions,
      message: `Preparando leitura da imagem (${index + 1}/${totalRegions})...`,
    });

    const hintText = region.hintFile
      ? await recognizeFile(Tesseract, region.hintFile, options.lang, options.logger)
      : '';
    const bodyText = region.bodyFile
      ? await recognizeFile(Tesseract, region.bodyFile, options.lang, options.logger)
      : '';

    const mergedText = mergeOcrTextVariants(hintText, bodyText);
    if (mergedText) {
      mergedRegions.push(mergedText);
    }

    options.onProgress?.({
      stage: 'ocr',
      processedRegions: index + 1,
      totalRegions,
      message: `Lendo texto da imagem (${index + 1}/${totalRegions})...`,
    });
  }

  return collapseConsecutiveComparableLines(
    mergedRegions
      .join('\n\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  ).join('\n');
}

async function recognizeFile(Tesseract, file, lang, logger) {
  const result = await Tesseract.recognize(file, lang, { logger });
  return result?.data?.text?.trim() || '';
}

async function prepareImageOcrRegions(file) {
  const image = await loadImageFromFile(file);
  const panels = detectReadableImagePanels(image);

  const regions = [];
  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index];
    regions.push({
      hintFile: await renderImagePanelToFile(image, panel, {
        scale: OCR_HINT_SCALE,
        enhanceForOcr: false,
        fileName: `ocr-hint-${index}.png`,
      }),
      bodyFile: await renderImagePanelToFile(image, panel, {
        scale: OCR_BODY_SCALE,
        enhanceForOcr: true,
        fileName: `ocr-body-${index}.png`,
      }),
    });
  }

  return regions;
}

function detectReadableImagePanels(image) {
  const width = image.naturalWidth || image.width || 0;
  const height = image.naturalHeight || image.height || 0;
  if (!width || !height) {
    return [{ x: 0, y: 0, width: 1, height: 1 }];
  }

  const scanWidth = Math.min(OCR_SCAN_TARGET_WIDTH, width);
  const scanHeight = Math.max(1, Math.round((height / width) * scanWidth));
  const canvas = document.createElement('canvas');
  canvas.width = scanWidth;
  canvas.height = scanHeight;
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    return [{ x: 0, y: 0, width, height }];
  }

  context.drawImage(image, 0, 0, scanWidth, scanHeight);
  const imageData = context.getImageData(0, 0, scanWidth, scanHeight);
  const rowStats = measureAxisBrightness(imageData, scanWidth, scanHeight, 'row');
  const rowSpans = findBrightSpans(rowStats, {
    minLength: Math.max(Math.round(scanHeight * 0.07), OCR_MIN_PANEL_HEIGHT * (scanHeight / Math.max(height, 1))),
    maxGap: Math.max(4, Math.round(scanHeight * 0.01)),
  });

  if (!rowSpans.length) {
    return [{ x: 0, y: 0, width, height }];
  }

  const panels = rowSpans.map((rowSpan) => {
    const columnStats = measureAxisBrightness(imageData, scanWidth, scanHeight, 'column', rowSpan);
    const columnSpans = findBrightSpans(columnStats, {
      minLength: Math.max(36, Math.round(scanWidth * 0.35)),
      maxGap: Math.max(3, Math.round(scanWidth * 0.01)),
    });
    const widestColumnSpan = pickWidestSpan(columnSpans) || { start: 0, end: scanWidth - 1 };

    const x = scaleCoordinate(expandStart(widestColumnSpan.start, OCR_PANEL_HORIZONTAL_PADDING, scanWidth), width, scanWidth);
    const y = scaleCoordinate(expandStart(rowSpan.start, OCR_PANEL_VERTICAL_PADDING, scanHeight), height, scanHeight);
    const maxX = scaleCoordinate(expandEnd(widestColumnSpan.end, OCR_PANEL_HORIZONTAL_PADDING, scanWidth), width, scanWidth);
    const maxY = scaleCoordinate(expandEnd(rowSpan.end, OCR_PANEL_VERTICAL_PADDING, scanHeight), height, scanHeight);

    return {
      x,
      y,
      width: Math.max(1, maxX - x),
      height: Math.max(1, maxY - y),
    };
  }).filter((panel) => panel.width > 0 && panel.height > 0);

  return panels.length ? panels : [{ x: 0, y: 0, width, height }];
}

function measureAxisBrightness(imageData, width, height, axis, limitSpan = null) {
  const stats = [];
  const start = axis === 'row' ? 0 : 0;
  const end = axis === 'row' ? height : width;

  for (let primary = start; primary < end; primary += 1) {
    let brightCount = 0;
    let darkCount = 0;
    let lumaTotal = 0;
    let sampleCount = 0;
    const secondaryStart = axis === 'row' ? 0 : (limitSpan?.start ?? 0);
    const secondaryEnd = axis === 'row' ? width : (limitSpan?.end ?? height - 1);

    for (let secondary = secondaryStart; secondary <= secondaryEnd; secondary += 1) {
      const x = axis === 'row' ? secondary : primary;
      const y = axis === 'row' ? primary : secondary;
      const offset = ((y * width) + x) * 4;
      const luma = Math.round(
        (imageData.data[offset] * 0.299)
        + (imageData.data[offset + 1] * 0.587)
        + (imageData.data[offset + 2] * 0.114),
      );
      lumaTotal += luma;
      sampleCount += 1;
      if (luma >= 218) brightCount += 1;
      if (luma <= 72) darkCount += 1;
    }

    const averageLuma = sampleCount ? lumaTotal / sampleCount : 0;
    stats.push({
      averageLuma,
      brightRatio: sampleCount ? brightCount / sampleCount : 0,
      darkRatio: sampleCount ? darkCount / sampleCount : 0,
    });
  }

  return stats;
}

function findBrightSpans(stats, { minLength, maxGap }) {
  const spans = [];
  let start = -1;
  let lastBrightIndex = -1;

  for (let index = 0; index < stats.length; index += 1) {
    const stat = stats[index];
    const isBright = stat.brightRatio >= 0.24 || (stat.averageLuma >= 168 && stat.darkRatio <= 0.36);

    if (isBright) {
      if (start === -1) start = index;
      lastBrightIndex = index;
      continue;
    }

    if (start !== -1 && index - lastBrightIndex <= maxGap) {
      continue;
    }

    if (start !== -1) {
      if ((lastBrightIndex - start) + 1 >= minLength) {
        spans.push({ start, end: lastBrightIndex });
      }
      start = -1;
      lastBrightIndex = -1;
    }
  }

  if (start !== -1 && (lastBrightIndex - start) + 1 >= minLength) {
    spans.push({ start, end: lastBrightIndex });
  }

  return spans;
}

function pickWidestSpan(spans = []) {
  if (!spans.length) return null;
  return spans.reduce((widest, span) => (
    ((span.end - span.start) > (widest.end - widest.start)) ? span : widest
  ));
}

function expandStart(value, padding, max) {
  return Math.max(0, value - Math.min(padding, max));
}

function expandEnd(value, padding, max) {
  return Math.min(max - 1, value + Math.min(padding, max));
}

function scaleCoordinate(value, originalSize, scannedSize) {
  return Math.max(0, Math.round((value / Math.max(scannedSize, 1)) * originalSize));
}

async function renderImagePanelToFile(image, panel, options = {}) {
  const scale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(panel.width * scale));
  canvas.height = Math.max(1, Math.round(panel.height * scale));
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    throw new Error('Não foi possível preparar a imagem para OCR');
  }

  context.drawImage(
    image,
    panel.x,
    panel.y,
    panel.width,
    panel.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  if (options.enhanceForOcr) {
    applyOcrContrast(canvas, context);
  }

  return canvasToImageFile(canvas, options.fileName || 'ocr-panel.png');
}

function applyOcrContrast(canvas, context) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(
      (data[index] * 0.299)
      + (data[index + 1] * 0.587)
      + (data[index + 2] * 0.114),
    );
    const contrasted = gray >= 198
      ? 255
      : gray <= 150
        ? 0
        : Math.round(((gray - 150) / 48) * 255);

    data[index] = contrasted;
    data[index + 1] = contrasted;
    data[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem selecionada'));
    };
    image.src = url;
  });
}

function canvasToImageFile(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível preparar a imagem para OCR'));
        return;
      }

      resolve(new File([blob], fileName, {
        type: 'image/png',
        lastModified: Date.now(),
      }));
    }, 'image/png');
  });
}

function splitOcrLines(text = '') {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function collapseConsecutiveComparableLines(lines = []) {
  const collapsed = [];

  for (const line of lines) {
    const key = getComparableOcrLineKey(line);
    const previousKey = getComparableOcrLineKey(collapsed[collapsed.length - 1] || '');
    if (key && previousKey === key) continue;
    collapsed.push(line);
  }

  return collapsed;
}

function normalizeOcrHintLine(line = '') {
  const structural = normalizeOcrStructuralLine(line);
  if (isStructuralOcrLine(structural)) {
    return structural;
  }

  return normalizeWorkoutOcrLineBase(line);
}

function isStructuralOcrLine(line = '') {
  const upper = normalizeOcrStructuralLine(line).toUpperCase();
  return /^SEMANA\s+\d+$/.test(upper)
    || /^(SEGUNDA|TERÇA|TERCA|QUARTA|QUINTA|SEXTA|SÁBADO|SABADO|DOMINGO)$/.test(upper)
    || upper === 'MANHA'
    || upper === 'MANHÃ'
    || upper === 'TARDE'
    || /^WOD(?:\s*2)?$/.test(upper)
    || upper === 'OPTIONAL'
    || /^LOW INTENSITY MIX(?:\s+\d+)?$/.test(upper)
    || upper === 'LOW INTENSITY ROW'
    || /^GYMNASTICS(?:\s+\d+)?$/.test(upper)
    || upper === 'ACCESSORIES'
    || upper === 'CORE'
    || upper === 'SWIM';
}

function getComparableOcrLineKey(line = '') {
  return normalizeOcrStructuralLine(line)
    .toUpperCase()
    .replace(/[^A-Z0-9À-ÿ]+/g, '');
}

function normalizeWorkoutOcrLine(line = '') {
  const cleaned = normalizeWorkoutOcrLineBase(line);
  if (!cleaned || isWorkoutOcrNoiseLine(cleaned)) return '';

  const structural = normalizeOcrStructuralLine(cleaned);
  if (isStructuralOcrLine(structural)) {
    return structural;
  }

  return cleaned;
}

function normalizeWorkoutOcrLineBase(line = '') {
  return String(line || '')
    .trim()
    .replace(/^[\[\]【】{}<>|()]+/g, '')
    .replace(/[\[\]【】{}<>|()]+$/g, '')
    .replace(/[.,;:]+$/g, '')
    .replace(/\bW[O0]D\b/gi, 'WOD')
    .replace(/^QU[1I]NTA$/i, 'QUINTA')
    .replace(/^QUARTA[.,;:]?$/i, 'QUARTA')
    .replace(/^MAN[HIL1]A$/i, 'MANHA')
    .replace(/^MANA$/i, 'MANHA')
    .replace(/^TAR0E$/i, 'TARDE')
    .replace(/^\[?ARDE\]?$/i, 'TARDE')
    .replace(/^\(?OP(?:TIONAL|CIONAL|ICIONAL)\)?$/i, 'OPTIONAL')
    .replace(/\b0[B8]?JETIVO\b/gi, 'OBJETIVO')
    .replace(/^OBJETIVO\s*[:=-]?\s*/i, 'OBJETIVO= ')
    .replace(/\bIbs\b/gi, 'lbs')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWorkoutOcrNoiseLine(line = '') {
  const raw = String(line || '').trim();
  if (!raw) return true;

  return /^\d{1,2}:\d{2}$/.test(raw)
    || /^RX[\W._+-].*$/i.test(raw)
    || /^IMG-\d{8}-WA\d+/i.test(raw)
    || /^BSB(?:\s+STRONG)?$/i.test(raw)
    || /^(?:www\.)?bsbstrong\.com$/i.test(raw)
    || /^#(?:trainwithapurpose|treinocomproposito)$/i.test(raw);
}
