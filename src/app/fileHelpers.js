export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  if (typeof navigator !== 'undefined' && typeof navigator.msSaveOrOpenBlob === 'function') {
    navigator.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  try {
    link.click();
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  } finally {
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
