/**
 * Video Text Reader
 * Extrai texto de vídeos por OCR em frames amostrados.
 */

import { extractTextFromImageAnalysis, extractTextFromImageFile } from './ocrReader.js';

export function isVideoFile(file) {
  return !!file?.type?.startsWith('video/');
}

export async function extractTextFromVideoFile(file, options = {}) {
  const analysis = await extractTextFromVideoAnalysis(file, options);
  return analysis.text;
}

export async function extractTextFromVideoAnalysis(file, options = {}) {
  if (!file) {
    throw new Error('Arquivo de vídeo não fornecido');
  }

  if (!isVideoFile(file)) {
    throw new Error('Arquivo não é um vídeo suportado');
  }

  const frameIntervalSec = options.frameIntervalSec ?? 2;
  const maxFrames = options.maxFrames ?? 24;

  const frames = await sampleVideoFrames(file, frameIntervalSec, maxFrames);
  if (!frames.length) {
    throw new Error('Não foi possível extrair frames do vídeo');
  }

  const chunks = [];
  const frameAnalyses = [];
  for (let i = 0; i < frames.length; i += 1) {
    const blob = frames[i].blob;
    const frameFile = new File([blob], `frame-${i}.png`, { type: 'image/png' });
    const analysis = await extractTextFromImageAnalysis(frameFile, {
      lang: options.lang || 'por+eng',
      logger: options.logger,
    });

    frameAnalyses.push({
      index: i,
      second: frames[i].second,
      textLength: analysis.text.length,
      confidenceScore: analysis.confidenceScore,
      confidenceLabel: analysis.confidenceLabel,
      warnings: analysis.warnings,
    });

    if (analysis.text) {
      chunks.push(analysis.text);
    }
  }

  const usefulFrames = frameAnalyses.filter((frame) => frame.textLength >= 20);
  const totalConfidence = usefulFrames.reduce((acc, frame) => acc + frame.confidenceScore, 0);
  const confidenceScore = usefulFrames.length
    ? Math.round(totalConfidence / usefulFrames.length)
    : (chunks.join('\n').length > 80 ? 58 : 38);
  const warnings = [];
  if (!usefulFrames.length) warnings.push('Pouco texto legível nos frames amostrados');
  if (usefulFrames.length < Math.max(2, Math.ceil(frameAnalyses.length / 3))) warnings.push('Poucos frames úteis foram encontrados');
  if (confidenceScore < 65) warnings.push('OCR do vídeo com confiança baixa, revisão recomendada');

  return {
    text: chunks.join('\n'),
    confidenceScore,
    confidenceLabel: confidenceScore >= 85 ? 'alta' : confidenceScore >= 65 ? 'média' : 'baixa',
    warnings,
    frameCount: frameAnalyses.length,
    usefulFrameCount: usefulFrames.length,
    frames: frameAnalyses,
    engine: 'tesseract-video',
  };
}

async function sampleVideoFrames(file, frameIntervalSec, maxFrames) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await waitForMetadata(video);

  const duration = Number(video.duration || 0);
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  if (!duration || !isFinite(duration)) {
    URL.revokeObjectURL(url);
    return [];
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const frameTimes = [];
  for (let t = 0; t < duration && frameTimes.length < maxFrames; t += frameIntervalSec) {
    frameTimes.push(t);
  }

  if (!frameTimes.includes(duration) && frameTimes.length < maxFrames) {
    frameTimes.push(Math.max(0, duration - 0.1));
  }

  const frames = [];
  for (const t of frameTimes) {
    await seek(video, t);
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    if (blob) frames.push({ second: Math.round(t * 10) / 10, blob });
  }

  URL.revokeObjectURL(url);
  return frames;
}

function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Falha ao carregar metadados do vídeo'));
  });
}

function seek(video, timeSec) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Falha ao navegar no vídeo'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = Math.min(Math.max(0, timeSec), video.duration || timeSec);
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
