export function isImageFile(file) {
  return String(file?.type || '').toLowerCase().startsWith('image/');
}

export async function compressImageFile(file, { targetMaxBytes, maxDimension }) {
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
