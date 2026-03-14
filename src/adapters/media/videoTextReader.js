/**
 * Video Text Reader
 * Extrai texto de vídeos por OCR em frames amostrados.
 */

import { extractTextFromImageFile } from './ocrReader.js';

export function isVideoFile(file) {
  return !!file?.type?.startsWith('video/');
}

export async function extractTextFromVideoFile(file, options = {}) {
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
  for (let i = 0; i < frames.length; i += 1) {
    const blob = frames[i];
    const frameFile = new File([blob], `frame-${i}.png`, { type: 'image/png' });
    const text = await extractTextFromImageFile(frameFile, {
      lang: options.lang || 'por+eng',
      logger: options.logger,
    });

    if (text) {
      chunks.push(text);
    }
  }

  return chunks.join('\n');
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

  const blobs = [];
  for (const t of frameTimes) {
    await seek(video, t);
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    if (blob) blobs.push(blob);
  }

  URL.revokeObjectURL(url);
  return blobs;
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
